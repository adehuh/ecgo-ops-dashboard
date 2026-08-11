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
      stale: number
      no_ready_slots: number
      swaps_24h: number
      failed_24h: number
      hourly: number[]
    }[]
  >`
    WITH visible AS (
      SELECT c.id, c.status, c.last_heartbeat_at
      FROM cabinets c
      WHERE ${scopeClause}
    ),
    -- Jumlah slot siap per cabinet, supaya chip "0 slot siap" punya angka yang
    -- benar-benar dihitung dan bukan ditebak dari selisih hitungan lain.
    ready AS (
      SELECT sl.cabinet_id, count(*) FILTER (WHERE sl.state = 'FULL')::int AS slots_ready
      FROM slots sl
      JOIN visible v ON v.id = sl.cabinet_id
      GROUP BY sl.cabinet_id
    ),
    -- Sparkline armada: 24 bucket jam, digabung set-based seperti di query daftar.
    fleet_hours AS (
      SELECT 23 - floor(extract(epoch FROM (now() - s.occurred_at)) / 3600)::int AS idx,
             count(*)::int AS n
      FROM swap_transactions s
      JOIN visible v ON v.id = s.cabinet_id
      WHERE s.occurred_at >= now() - interval '24 hours' AND s.status = 'SUCCESS'
      GROUP BY 1
    ),
    fleet_spark AS (
      SELECT array_agg(coalesce(fh.n, 0) ORDER BY g.i) AS hourly
      FROM generate_series(0, 23) AS g(i)
      LEFT JOIN fleet_hours fh ON fh.idx = g.i
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
      -- Sama persis dengan cabang STALE_HEARTBEAT di query daftar: hanya yang
      -- MENGAKU online tapi diam, ditambah yang belum pernah melapor.
      count(*) FILTER (
        WHERE last_heartbeat_at IS NULL
           OR (
             status = 'ONLINE'
             AND last_heartbeat_at < now() - make_interval(mins => ${staleMinutes()})
           )
      )::int                                              AS stale,
      (
        SELECT count(*)::int FROM ready r WHERE r.slots_ready = 0
      )                                                   AS no_ready_slots,
      (SELECT hourly FROM fleet_spark)                    AS hourly,
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
      stale: row?.stale ?? 0,
      noReadySlots: row?.no_ready_slots ?? 0,
      swaps24h: row?.swaps_24h ?? 0,
      failed24h: row?.failed_24h ?? 0,
      hourly: row?.hourly ?? [],
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
