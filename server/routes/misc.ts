import { Router } from 'express'
import type { FleetSummaryResponse } from '../../shared/contracts/cabinets.js'
import { branchScopeClause, requireSession, sessionOf } from '../auth.js'
import { sql, staleMinutes } from '../db.js'
import { ok } from '../http.js'

export const summaryRouter = Router()

summaryRouter.use(requireSession)

/**
 * GET /api/summary — ringkasan armada untuk deretan KPI.
 *
 * Sengaja TIDAK mengikuti filter daftar. Deretan ini menjawab "bagaimana keadaan
 * armada?", dan angka yang ikut mengecil saat pengguna mengetik di kotak
 * pencarian tidak menjawab pertanyaan itu — ia hanya mengulang jumlah baris yang
 * sudah terlihat di bawahnya.
 *
 * Tapi ia TETAP mengikuti ruang lingkup cabang. Kalau KPI menghitung 50 cabinet
 * sementara tabel di bawahnya hanya berisi 10, angkanya bukan cuma membingungkan
 * — ia membocorkan ukuran armada cabang lain.
 */
summaryRouter.get('/', async (req, res) => {
  const scopeClause = branchScopeClause(sessionOf(req))

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
    WITH visible AS (
      SELECT c.id, c.status, c.last_heartbeat_at
      FROM cabinets c
      WHERE ${scopeClause}
    )
    SELECT
      count(*)::int                                       AS total,
      count(*) FILTER (WHERE status = 'ONLINE')::int      AS online,
      count(*) FILTER (WHERE status = 'OFFLINE')::int     AS offline,
      count(*) FILTER (WHERE status = 'MAINTENANCE')::int AS maintenance,
      -- Yang benar-benar menuntut tindakan: bukan ONLINE, ATAU mengaku ONLINE
      -- tapi diam terlalu lama, ATAU belum pernah melapor sama sekali.
      count(*) FILTER (
        WHERE status <> 'ONLINE'
           OR last_heartbeat_at IS NULL
           OR last_heartbeat_at < now() - make_interval(mins => ${staleMinutes()})
      )::int                                              AS needs_attention,
      (
        SELECT count(*)::int FROM swap_transactions s
        JOIN visible v ON v.id = s.cabinet_id
        WHERE s.occurred_at >= now() - interval '24 hours' AND s.status = 'SUCCESS'
      )                                                   AS swaps_24h,
      (
        SELECT count(*)::int FROM swap_transactions s
        JOIN visible v ON v.id = s.cabinet_id
        WHERE s.occurred_at >= now() - interval '24 hours' AND s.status = 'FAILED'
      )                                                   AS failed_24h
    FROM visible
  `

  ok<FleetSummaryResponse>(res, {
    data: {
      total: row?.total ?? 0,
      online: row?.online ?? 0,
      offline: row?.offline ?? 0,
      maintenance: row?.maintenance ?? 0,
      needsAttention: row?.needs_attention ?? 0,
      swaps24h: row?.swaps_24h ?? 0,
      failed24h: row?.failed_24h ?? 0,
    },
  })
})

export const healthRouter = Router()

/**
 * GET /api/health — health check yang benar-benar menyentuh database.
 *
 * Tidak diberi penjaga sesi: ia dipakai monitoring dan load balancer, dan tidak
 * membawa satu pun data operasional. Endpoint yang cuma membalas `{ ok: true }`
 * akan tetap hijau sementara Postgres mati — persis saat ia paling dibutuhkan
 * untuk berteriak.
 */
healthRouter.get('/', async (_req, res) => {
  const startedAt = performance.now()
  const [row] = await sql<{ cabinets: number }[]>`SELECT count(*)::int AS cabinets FROM cabinets`

  ok(res, {
    data: {
      status: 'ok' as const,
      database: 'reachable' as const,
      cabinets: row?.cabinets ?? 0,
      latencyMs: Math.round(performance.now() - startedAt),
    },
  })
})
