import {
  cabinetListQuerySchema,
  type CabinetListItem,
  type CabinetListResponse,
} from '../../../shared/contracts/cabinets'
import { defineApiHandler, parseOrThrow } from '../../utils/api'
import { staleMinutes, useDb } from '../../utils/db'

/**
 * GET /api/cabinets
 *
 * Daftar cabinet dengan pencarian server-side, filter status, sortir, dan
 * pagination. Semuanya dikerjakan di database.
 *
 * SATU query melayani seluruh halaman. Bentuk yang naif — ambil cabinet, lalu
 * untuk tiap cabinet hitung swap dan slotnya — adalah N+1 klasik: 1 + 2×25 = 51
 * round-trip untuk satu layar. Di sini agregasinya dua CTE yang di-join sekali,
 * dan jumlah total baris diambil lewat `count(*) OVER ()` pada query yang sama,
 * jadi tidak ada query kedua hanya untuk mengisi angka pagination.
 */

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
 * Escape wildcard LIKE di dalam masukan pengguna.
 *
 * Tanpa ini, mencari `%` cocok dengan setiap baris dan `_` cocok dengan karakter
 * apa pun — pengguna mengira pencariannya rusak, dan satu query bisa dipaksa
 * mengembalikan seluruh tabel. Ini soal kebenaran dan beban, bukan injection:
 * nilainya tetap terikat sebagai parameter.
 */
const escapeLikePattern = (input: string): string => input.replace(/[\\%_]/g, '\\$&')

export default defineApiHandler(async (event): Promise<CabinetListResponse> => {
  const query = parseOrThrow(cabinetListQuerySchema, getQuery(event), 'Parameter pencarian')
  const sql = useDb()

  const { q, status, sort, dir, page, pageSize } = query
  const offset = (page - 1) * pageSize

  const search = q ? `%${escapeLikePattern(q)}%` : null
  const statuses = status && status.length > 0 ? status : null

  const direction = dir === 'asc' ? sql`ASC` : sql`DESC`

  // Predikat filter dibangun sekali dan dipakai ulang, supaya query halaman dan
  // query hitung-cadangan di bawah tidak mungkin menyaring dengan aturan berbeda.
  const searchClause = search
    ? sql`(c.code ILIKE ${search} ESCAPE '\\'
        OR b.name ILIKE ${search} ESCAPE '\\'
        OR b.code ILIKE ${search} ESCAPE '\\')`
    : sql`true`

  const statusClause = statuses ? sql`c.status = ANY(${statuses}::cabinet_status[])` : sql`true`

  // ORDER BY dibangun dari peta tetap, bukan dari teks pengguna. `sort` sudah
  // dipersempit oleh Zod menjadi salah satu dari tiga literal sebelum sampai
  // sini, jadi tidak ada jalan bagi masukan luar untuk mencapai SQL ini.
  //
  // Tiap varian diakhiri kunci unik (f.code). Tanpa pemecah seri itu, dua baris
  // dengan jumlah swap sama bisa bertukar urutan antar request, dan pagination
  // OFFSET akan menampilkan baris yang sama dua kali di halaman berbeda sambil
  // menyembunyikan yang lain — bug yang nyaris mustahil dilaporkan pengguna
  // dengan benar.
  const orderBy = {
    swaps24h: sql`swaps_24h ${direction}, f.code ASC`,
    code: sql`f.code ${direction}`,
    // NULLS LAST di kedua arah: cabinet yang belum pernah melapor bukan cabinet
    // "paling lama tidak terlihat", jadi tidak boleh memuncaki daftar itu.
    lastHeartbeat: sql`f.last_heartbeat_at ${direction} NULLS LAST, f.code ASC`,
  }[sort]

  const rows = await sql<ListRow[]>`
    WITH filtered AS (
      SELECT
        c.id,
        c.code,
        c.status,
        c.last_heartbeat_at,
        b.code AS branch_code,
        b.name AS branch_name
      FROM cabinets c
      JOIN branches b ON b.id = c.branch_id
      WHERE ${searchClause} AND ${statusClause}
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
      SELECT
        sl.cabinet_id,
        count(*)::int                                          AS slots_total,
        -- "Terisi" = ada baterainya, apa pun state-nya.
        count(sl.battery_id)::int                              AS slots_filled,
        -- "Siap" = benar-benar bisa ditukar rider sekarang. Bukan kolom yang
        -- diminta soal, tapi tanpa itu "8/12 terisi" tidak menjawab satu-satunya
        -- pertanyaan yang penting: bisakah rider swap di sini?
        count(*) FILTER (WHERE sl.state = 'FULL')::int          AS slots_ready
      FROM slots sl
      JOIN filtered f ON f.id = sl.cabinet_id
      GROUP BY sl.cabinet_id
    )
    SELECT
      f.code,
      f.branch_code,
      f.branch_name,
      f.status,
      f.last_heartbeat_at,
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

  // `count(*) OVER ()` ikut menumpang pada baris yang dikembalikan, jadi ia
  // menghilang persis ketika halamannya kosong — dan melaporkan total 0 untuk
  // armada berisi 50 cabinet. Itu bukan cuma angka yang salah: UI akan bilang
  // "tidak ada cabinet" kepada seseorang yang sebenarnya hanya berdiri di
  // halaman 4 setelah mempersempit filter.
  //
  // Jalur cepatnya tetap satu query. Query hitung kedua hanya dibayar pada
  // kasus langka halaman di luar jangkauan.
  const total =
    rows[0]?.total_count ??
    (
      await sql<{ total: number }[]>`
        SELECT count(*)::int AS total
        FROM cabinets c
        JOIN branches b ON b.id = c.branch_id
        WHERE ${searchClause} AND ${statusClause}
      `
    )[0]!.total

  return {
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
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
})
