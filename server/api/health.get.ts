import { defineApiHandler } from '../utils/api'
import { useDb } from '../utils/db'

/**
 * GET /api/health
 *
 * Health check yang benar-benar menyentuh database. Endpoint yang cuma membalas
 * `{ ok: true }` akan tetap hijau sementara Postgres mati — persis saat ia
 * paling dibutuhkan untuk berteriak.
 */
export default defineApiHandler(async () => {
  const sql = useDb()
  const startedAt = performance.now()

  const [row] = await sql<{ cabinets: number }[]>`SELECT count(*)::int AS cabinets FROM cabinets`

  return {
    data: {
      status: 'ok' as const,
      database: 'reachable' as const,
      cabinets: row?.cabinets ?? 0,
      latencyMs: Math.round(performance.now() - startedAt),
    },
  }
})
