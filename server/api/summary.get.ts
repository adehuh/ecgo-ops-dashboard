import type { FleetSummaryResponse } from '../../shared/contracts/cabinets'
import { defineApiHandler } from '../utils/api'
import { staleMinutes, useDb } from '../utils/db'

/**
 * GET /api/summary
 *
 * Ringkasan armada untuk deretan KPI di atas daftar.
 *
 * Sengaja TIDAK mengikuti filter daftar. Deretan ini menjawab "bagaimana keadaan
 * armada?", dan angka yang ikut mengecil saat pengguna mengetik di kotak
 * pencarian tidak menjawab pertanyaan itu — ia hanya mengulang jumlah baris yang
 * sudah terlihat di bawahnya.
 *
 * Ditempatkan di /api/summary, bukan /api/cabinets/summary, supaya tidak pernah
 * berlomba dengan rute dinamis /api/cabinets/[code].
 */
export default defineApiHandler(async (): Promise<FleetSummaryResponse> => {
  const sql = useDb()

  const [row] = await sql<
    {
      total: number
      online: number
      offline: number
      maintenance: number
      needs_attention: number
      swaps_24h: number
      failed_24h: number
    }[]
  >`
    SELECT
      count(*)::int                                                        AS total,
      count(*) FILTER (WHERE status = 'ONLINE')::int                       AS online,
      count(*) FILTER (WHERE status = 'OFFLINE')::int                      AS offline,
      count(*) FILTER (WHERE status = 'MAINTENANCE')::int                  AS maintenance,
      -- Yang benar-benar menuntut tindakan: bukan ONLINE, ATAU mengaku ONLINE
      -- tapi diam terlalu lama, ATAU belum pernah melapor sama sekali.
      count(*) FILTER (
        WHERE status <> 'ONLINE'
           OR last_heartbeat_at IS NULL
           OR last_heartbeat_at < now() - make_interval(mins => ${staleMinutes()})
      )::int                                                               AS needs_attention,
      (
        SELECT count(*)::int FROM swap_transactions
        WHERE occurred_at >= now() - interval '24 hours' AND status = 'SUCCESS'
      )                                                                    AS swaps_24h,
      (
        SELECT count(*)::int FROM swap_transactions
        WHERE occurred_at >= now() - interval '24 hours' AND status = 'FAILED'
      )                                                                    AS failed_24h
    FROM cabinets
  `

  return {
    data: {
      total: row?.total ?? 0,
      online: row?.online ?? 0,
      offline: row?.offline ?? 0,
      maintenance: row?.maintenance ?? 0,
      needsAttention: row?.needs_attention ?? 0,
      swaps24h: row?.swaps_24h ?? 0,
      failed24h: row?.failed_24h ?? 0,
    },
  }
})
