import { Router } from 'express'
import {
  cabinetCodeParamSchema,
  cabinetListQuerySchema,
  cabinetStatusPatchSchema,
  type CabinetDetail,
  type CabinetDetailResponse,
  type CabinetListItem,
  type CabinetListResponse,
  type CabinetSlot,
  type CabinetStatusPatchResponse,
  type HourlyBucket,
  type RecentSwap,
} from '../../shared/contracts/cabinets.js'
import { branchScopeClause, requireSession, sessionOf } from '../auth.js'
import { sql, staleMinutes } from '../db.js'
import { ApiError, notFound, ok, parseOrThrow } from '../http.js'

export const cabinetsRouter = Router()

// Penjaga dipasang di tingkat router, bukan diulang di tiap handler. Route baru
// yang ditambahkan di bawah otomatis ikut terlindungi — kebalikan dari pola yang
// mengandalkan setiap penulis route mengingat satu baris.
cabinetsRouter.use(requireSession)

/**
 * Escape wildcard LIKE di dalam masukan pengguna.
 *
 * Tanpa ini, mencari `%` cocok dengan setiap baris dan `_` cocok dengan karakter
 * apa pun — pengguna mengira pencariannya rusak, dan satu query bisa dipaksa
 * mengembalikan seluruh tabel. Ini soal kebenaran dan beban, bukan injection:
 * nilainya tetap terikat sebagai parameter.
 */
const escapeLikePattern = (input: string): string => input.replace(/[\\%_]/g, '\\$&')

type ListRow = {
  code: string
  branch_code: string
  branch_name: string
  status: CabinetListItem['status']
  slots_filled: number
  slots_ready: number
  slots_total: number
  swaps_24h: number
  last_heartbeat_at: Date | null
  is_stale: boolean
  total_count: number
}

/**
 * GET /api/cabinets
 *
 * SATU query melayani seluruh halaman. Bentuk yang naif — ambil cabinet, lalu
 * untuk tiap cabinet hitung swap dan slotnya — adalah N+1 klasik: 1 + 2×25 = 51
 * round-trip untuk satu layar. Di sini agregasinya dua CTE yang di-join sekali,
 * dan jumlah total baris ikut lewat `count(*) OVER ()` pada query yang sama.
 */
cabinetsRouter.get('/', async (req, res) => {
  const session = sessionOf(req)
  const { q, status, sort, dir, page, pageSize } = parseOrThrow(
    cabinetListQuerySchema,
    req.query,
    'Parameter pencarian',
  )

  const offset = (page - 1) * pageSize
  const search = q ? `%${escapeLikePattern(q)}%` : null
  const statuses = status && status.length > 0 ? status : null
  const direction = dir === 'asc' ? sql`ASC` : sql`DESC`

  // Predikat dibangun sekali dan dipakai ulang, supaya query halaman dan query
  // hitung-cadangan di bawah tidak mungkin menyaring dengan aturan berbeda.
  const searchClause = search
    ? sql`(c.code ILIKE ${search} ESCAPE '\\'
        OR b.name ILIKE ${search} ESCAPE '\\'
        OR b.code ILIKE ${search} ESCAPE '\\')`
    : sql`true`

  const statusClause = statuses ? sql`c.status = ANY(${statuses}::cabinet_status[])` : sql`true`

  // Ruang lingkup datang dari SESI, tidak pernah dari query string. Inilah
  // perbedaan antara endpoint ini dan kode C2 yang saya review: di sana `branch`
  // diambil dari URL, sehingga mengganti satu parameter membuka cabang lain.
  const scopeClause = branchScopeClause(session)

  // ORDER BY dibangun dari peta tetap, bukan dari teks pengguna; `sort` sudah
  // dipersempit Zod menjadi salah satu dari tiga literal sebelum sampai sini.
  //
  // Tiap varian diakhiri kunci unik (f.code). Tanpa pemecah seri itu, dua baris
  // dengan jumlah swap sama bisa bertukar urutan antar request, dan pagination
  // OFFSET akan menampilkan baris yang sama dua kali di halaman berbeda sambil
  // menyembunyikan yang lain.
  const orderBy = {
    swaps24h: sql`swaps_24h ${direction}, f.code ASC`,
    code: sql`f.code ${direction}`,
    // NULLS LAST di kedua arah: cabinet yang belum pernah melapor bukan cabinet
    // "paling lama tidak terlihat", jadi tidak boleh memuncaki daftar itu.
    lastHeartbeat: sql`f.last_heartbeat_at ${direction} NULLS LAST, f.code ASC`,
  }[sort]

  const rows = await sql<ListRow[]>`
    WITH filtered AS (
      SELECT c.id, c.code, c.status, c.last_heartbeat_at,
             b.code AS branch_code, b.name AS branch_name
      FROM cabinets c
      JOIN branches b ON b.id = c.branch_id
      WHERE ${searchClause} AND ${statusClause} AND ${scopeClause}
    ),
    -- Dibatasi ke cabinet yang lolos filter, bukan seluruh armada: kalau ops
    -- menyaring ke satu cabang, agregatnya tidak ikut menyapu yang lain.
    swap_counts AS (
      SELECT s.cabinet_id, count(*)::int AS swaps_24h
      FROM swap_transactions s
      JOIN filtered f ON f.id = s.cabinet_id
      -- Rolling 24 jam, bukan sejak tengah malam. Alasannya di README §Asumsi.
      WHERE s.occurred_at >= now() - interval '24 hours'
        -- Hanya yang berhasil: ini kolom throughput. Cabinet yang menolak 40
        -- rider bukan cabinet sibuk, dan tidak boleh naik ke puncak sortir.
        AND s.status = 'SUCCESS'
      GROUP BY s.cabinet_id
    ),
    slot_counts AS (
      SELECT sl.cabinet_id,
             count(*)::int                                 AS slots_total,
             count(sl.battery_id)::int                     AS slots_filled,
             count(*) FILTER (WHERE sl.state = 'FULL')::int AS slots_ready
      FROM slots sl
      JOIN filtered f ON f.id = sl.cabinet_id
      GROUP BY sl.cabinet_id
    )
    SELECT
      f.code, f.branch_code, f.branch_name, f.status, f.last_heartbeat_at,
      coalesce(sc.swaps_24h, 0)     AS swaps_24h,
      coalesce(slc.slots_total, 0)  AS slots_total,
      coalesce(slc.slots_filled, 0) AS slots_filled,
      coalesce(slc.slots_ready, 0)  AS slots_ready,
      (
        f.last_heartbeat_at IS NOT NULL
        AND f.last_heartbeat_at < now() - make_interval(mins => ${staleMinutes()})
      ) AS is_stale,
      count(*) OVER ()::int AS total_count
    FROM filtered f
    LEFT JOIN swap_counts sc  ON sc.cabinet_id  = f.id
    LEFT JOIN slot_counts slc ON slc.cabinet_id = f.id
    ORDER BY ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `

  // `count(*) OVER ()` menumpang pada baris yang dikembalikan, jadi ia
  // menghilang persis ketika halamannya kosong — dan melaporkan total 0 untuk
  // armada berisi 50 cabinet. Itu bukan cuma angka yang salah: UI akan bilang
  // "tidak ada cabinet" kepada orang yang sebenarnya hanya berdiri di halaman 4
  // setelah mempersempit filter.
  //
  // Jalur cepatnya tetap satu query; query kedua hanya dibayar pada kasus langka
  // halaman di luar jangkauan.
  const total =
    rows[0]?.total_count ??
    (
      await sql<{ total: number }[]>`
        SELECT count(*)::int AS total
        FROM cabinets c
        JOIN branches b ON b.id = c.branch_id
        WHERE ${searchClause} AND ${statusClause} AND ${scopeClause}
      `
    )[0]!.total

  ok<CabinetListResponse>(res, {
    data: rows.map(
      (row): CabinetListItem => ({
        code: row.code,
        branchCode: row.branch_code,
        branchName: row.branch_name,
        status: row.status,
        slotsFilled: row.slots_filled,
        slotsReady: row.slots_ready,
        slotsTotal: row.slots_total,
        swaps24h: row.swaps_24h,
        lastHeartbeatAt: row.last_heartbeat_at?.toISOString() ?? null,
        isStale: row.is_stale,
      }),
    ),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  })
})

type CabinetRow = {
  code: string
  branch_code: string
  branch_name: string
  branch_city: string
  status: CabinetDetail['status']
  slot_count: number
  last_heartbeat_at: Date | null
  installed_at: Date
  is_stale: boolean
  swaps_24h: number
  failed_24h: number
}

type SlotRow = {
  slot_no: number
  state: CabinetSlot['state']
  soc: number | null
  battery_id: string | null
  updated_at: Date
}

type HourRow = { hour_start: string; count: number }

type SwapRow = {
  id: string
  slot_no: number
  rider_ref: string
  occurred_at: Date
  soc_in: number
  soc_out: number
  duration_s: number
  status: RecentSwap['status']
}

/**
 * Referensi rider dipotong sebelum meninggalkan server.
 *
 * Dashboard ini memantau perangkat keras, bukan orang. Ekor 3 digit cukup untuk
 * mencocokkan satu baris dengan keluhan rider lewat CS; mengirim referensi penuh
 * hanya menaruh data yang bisa dikaitkan ke individu di tiap payload halaman,
 * tiap log proxy, dan tiap tab devtools yang terbuka.
 */
function maskRiderRef(riderRef: string): string {
  const [prefix, suffix] = riderRef.split('-')
  if (!suffix) return `••${riderRef.slice(-3)}`
  return `${prefix}-•••${suffix.slice(-3)}`
}

/**
 * GET /api/cabinets/:code
 *
 * Empat query dijalankan bersamaan, nol query di dalam loop. Semuanya membawa
 * klausa ruang lingkup, bukan hanya query cabinet-nya: kalau nanti ada yang
 * memindahkan pemeriksaan 404, tidak ada satu pun query yang tetap bisa bocor.
 */
cabinetsRouter.get('/:code', async (req, res) => {
  const session = sessionOf(req)
  const code = parseOrThrow(cabinetCodeParamSchema, req.params.code, 'Kode cabinet')
  const stale = staleMinutes()
  const scopeClause = branchScopeClause(session)

  const [cabinetRows, slotRows, hourRows, swapRows] = await Promise.all([
    sql<CabinetRow[]>`
      SELECT
        c.code, c.status, c.slot_count, c.last_heartbeat_at, c.installed_at,
        b.code AS branch_code, b.name AS branch_name, b.city AS branch_city,
        (
          c.last_heartbeat_at IS NOT NULL
          AND c.last_heartbeat_at < now() - make_interval(mins => ${stale})
        ) AS is_stale,
        -- Dihitung di database, bukan dengan menarik transaksi ke Node lalu
        -- me-reduce-nya.
        (
          SELECT count(*)::int FROM swap_transactions s
          WHERE s.cabinet_id = c.id
            AND s.occurred_at >= now() - interval '24 hours'
            AND s.status = 'SUCCESS'
        ) AS swaps_24h,
        (
          SELECT count(*)::int FROM swap_transactions s
          WHERE s.cabinet_id = c.id
            AND s.occurred_at >= now() - interval '24 hours'
            AND s.status = 'FAILED'
        ) AS failed_24h
      FROM cabinets c
      JOIN branches b ON b.id = c.branch_id
      WHERE c.code = ${code} AND ${scopeClause}
    `,

    sql<SlotRow[]>`
      SELECT sl.slot_no, sl.state, sl.soc, sl.battery_id, sl.updated_at
      FROM slots sl
      JOIN cabinets c ON c.id = sl.cabinet_id
      WHERE c.code = ${code} AND ${scopeClause}
      ORDER BY sl.slot_no
    `,

    // Grafik 24 jam. `generate_series` menyediakan kerangka jamnya, jadi jam
    // tanpa aktivitas keluar sebagai nol, bukan hilang dari hasil. Kalau
    // gap-filling diserahkan ke client, jam sepi akan menyusut hilang dan
    // grafiknya diam-diam berbohong tentang bentuk hari itu.
    sql<HourRow[]>`
      WITH bounds AS (
        SELECT date_trunc('hour', now() AT TIME ZONE 'Asia/Jakarta') AS latest
      ),
      hours AS (
        SELECT generate_series(b.latest - interval '23 hours', b.latest, interval '1 hour') AS hour_start
        FROM bounds b
      )
      SELECT
        -- Dikirim sebagai teks jam-dinding WIB. Mengirimnya sebagai timestamp
        -- tanpa zona akan diparse ulang sebagai UTC oleh driver dan menggeser
        -- seluruh grafik tujuh jam.
        to_char(h.hour_start, 'YYYY-MM-DD"T"HH24:MI:SS') AS hour_start,
        count(s.id)::int AS count
      FROM hours h
      LEFT JOIN swap_transactions s
        ON s.cabinet_id = (SELECT c.id FROM cabinets c WHERE c.code = ${code} AND ${scopeClause})
        -- Predikat rentang ini yang membuat index (cabinet_id, occurred_at)
        -- terpakai; date_trunc di bawah tidak sargable dan sendirian akan
        -- memaksa pemindaian seluruh 30 hari riwayat cabinet ini.
       AND s.occurred_at >= now() - interval '24 hours'
       AND s.status = 'SUCCESS'
       AND date_trunc('hour', s.occurred_at AT TIME ZONE 'Asia/Jakarta') = h.hour_start
      GROUP BY h.hour_start
      ORDER BY h.hour_start
    `,

    sql<SwapRow[]>`
      SELECT s.id, s.slot_no, s.rider_ref, s.occurred_at, s.soc_in, s.soc_out,
             s.duration_s, s.status
      FROM swap_transactions s
      JOIN cabinets c ON c.id = s.cabinet_id
      WHERE c.code = ${code} AND ${scopeClause}
      -- id sebagai pemecah seri: dua swap bisa punya occurred_at identik, dan
      -- tanpa kunci kedua "20 terakhir" tidak stabil antar request.
      ORDER BY s.occurred_at DESC, s.id DESC
      LIMIT 20
    `,
  ])

  const cabinet = cabinetRows[0]
  if (!cabinet) {
    // 404, bukan 403, juga ketika cabinet-nya ADA tapi milik cabang lain: 403
    // mengonfirmasi keberadaannya dan mengubah endpoint ini menjadi alat
    // menghitung armada cabang lain.
    throw notFound(`Cabinet dengan kode "${code}" tidak ditemukan`)
  }

  ok<CabinetDetailResponse>(res, {
    data: {
      code: cabinet.code,
      branchCode: cabinet.branch_code,
      branchName: cabinet.branch_name,
      branchCity: cabinet.branch_city,
      status: cabinet.status,
      slotCount: cabinet.slot_count,
      lastHeartbeatAt: cabinet.last_heartbeat_at?.toISOString() ?? null,
      isStale: cabinet.is_stale,
      installedAt: cabinet.installed_at.toISOString(),
      swaps24h: cabinet.swaps_24h,
      failed24h: cabinet.failed_24h,

      slots: slotRows.map(
        (row): CabinetSlot => ({
          slotNo: row.slot_no,
          state: row.state,
          soc: row.soc,
          batteryId: row.battery_id,
          updatedAt: row.updated_at.toISOString(),
        }),
      ),

      hourly: hourRows.map((row): HourlyBucket => ({ hourStart: row.hour_start, count: row.count })),

      recentSwaps: swapRows.map(
        (row): RecentSwap => ({
          id: Number(row.id),
          slotNo: row.slot_no,
          riderRef: maskRiderRef(row.rider_ref),
          occurredAt: row.occurred_at.toISOString(),
          socIn: row.soc_in,
          socOut: row.soc_out,
          durationS: row.duration_s,
          status: row.status,
        }),
      ),
    },
  })
})

/**
 * PATCH /api/cabinets/:code/status — tandai cabinet masuk atau keluar perawatan.
 *
 * Ini satu-satunya endpoint yang MENULIS, dan ia sengaja sempit: hanya berpindah
 * antara ONLINE dan MAINTENANCE. Alasannya ada di kontraknya — OFFLINE dilaporkan
 * perangkat, bukan diputuskan orang.
 *
 * Cabinet yang sedang OFFLINE ditolak dengan 409, bukan 400: requestnya sendiri
 * sah, keadaan dunianya yang belum memungkinkan. Bedanya penting bagi client —
 * 400 berarti "perbaiki requestmu", 409 berarti "coba lagi setelah keadaannya
 * berubah".
 */
cabinetsRouter.patch('/:code/status', async (req, res) => {
  const session = sessionOf(req)
  const code = parseOrThrow(cabinetCodeParamSchema, req.params.code, 'Kode cabinet')
  const { status } = parseOrThrow(cabinetStatusPatchSchema, req.body, 'Status cabinet')
  const scopeClause = branchScopeClause(session)

  const [current] = await sql<{ status: CabinetDetail['status'] }[]>`
    SELECT c.status FROM cabinets c WHERE c.code = ${code} AND ${scopeClause}
  `

  // Di luar ruang lingkup dan tidak ada sama sekali menghasilkan jawaban yang
  // sama, seperti pada endpoint baca.
  if (!current) throw notFound(`Cabinet dengan kode "${code}" tidak ditemukan`)

  if (current.status === 'OFFLINE') {
    throw new ApiError(
      'CONFLICT',
      'Cabinet sedang OFFLINE. Statusnya akan pulih sendiri saat heartbeat kembali, dan tidak bisa diubah dari sini.',
    )
  }

  const [updated] = await sql<{ code: string; status: CabinetDetail['status'] }[]>`
    UPDATE cabinets
       SET status = ${status}::cabinet_status
     WHERE code = ${code}
       -- Dijaga sekali lagi di UPDATE, bukan hanya pada SELECT di atas: dua
       -- query terpisah berarti ada jeda di antaranya, dan ruang lingkup tidak
       -- boleh bergantung pada jeda itu.
       AND status <> 'OFFLINE'
    RETURNING code, status
  `

  if (!updated) throw new ApiError('CONFLICT', 'Status cabinet berubah sebelum permintaan ini selesai. Muat ulang lalu coba lagi.')

  ok<CabinetStatusPatchResponse>(res, { data: { code: updated.code, status: updated.status } })
})
