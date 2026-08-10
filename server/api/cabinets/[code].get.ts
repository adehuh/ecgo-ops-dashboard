import {
  cabinetCodeParamSchema,
  type CabinetDetail,
  type CabinetDetailResponse,
  type CabinetSlot,
  type HourlyBucket,
  type RecentSwap,
} from '../../../shared/contracts/cabinets'
import { defineApiHandler, notFound, parseOrThrow } from '../../utils/api'
import { staleMinutes, useDb } from '../../utils/db'

/**
 * GET /api/cabinets/:code
 *
 * Empat query, dijalankan bersamaan, nol query di dalam loop. Semuanya
 * di-anchor ke `code` supaya tidak ada round-trip berurutan hanya untuk
 * menukar kode menjadi id lebih dulu.
 */

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
 * mencocokkan satu baris dengan keluhan rider lewat CS; mengirim referensi
 * penuh hanya menaruh data yang bisa dikaitkan ke individu di dalam tiap payload
 * halaman, tiap log proxy, dan tiap tab devtools yang terbuka.
 */
function maskRiderRef(riderRef: string): string {
  const [prefix, suffix] = riderRef.split('-')
  if (!suffix) return `••${riderRef.slice(-3)}`
  return `${prefix}-•••${suffix.slice(-3)}`
}

export default defineApiHandler(async (event): Promise<CabinetDetailResponse> => {
  const code = parseOrThrow(
    cabinetCodeParamSchema,
    getRouterParam(event, 'code'),
    'Kode cabinet',
  )
  const sql = useDb()
  const stale = staleMinutes()

  const [cabinetRows, slotRows, hourRows, swapRows] = await Promise.all([
    sql<CabinetRow[]>`
      SELECT
        c.code,
        c.status,
        c.slot_count,
        c.last_heartbeat_at,
        c.installed_at,
        b.code AS branch_code,
        b.name AS branch_name,
        b.city AS branch_city,
        (
          c.last_heartbeat_at IS NOT NULL
          AND c.last_heartbeat_at < now() - make_interval(mins => ${stale})
        ) AS is_stale,
        -- Dihitung di database dengan sub-select berkorelasi pada satu baris,
        -- bukan dengan menarik transaksi ke Node lalu me-reduce-nya.
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
      WHERE c.code = ${code}
    `,

    sql<SlotRow[]>`
      SELECT sl.slot_no, sl.state, sl.soc, sl.battery_id, sl.updated_at
      FROM slots sl
      JOIN cabinets c ON c.id = sl.cabinet_id
      WHERE c.code = ${code}
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
        ON s.cabinet_id = (SELECT id FROM cabinets WHERE code = ${code})
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
      WHERE c.code = ${code}
      -- id sebagai pemecah seri: dua swap bisa punya occurred_at identik, dan
      -- tanpa kunci kedua "20 terakhir" tidak stabil antar request.
      ORDER BY s.occurred_at DESC, s.id DESC
      LIMIT 20
    `,
  ])

  const cabinet = cabinetRows[0]
  if (!cabinet) {
    throw notFound(`Cabinet dengan kode "${code}" tidak ditemukan`)
  }

  return {
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
  }
})
