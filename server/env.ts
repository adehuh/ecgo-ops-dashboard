import { existsSync } from 'node:fs'

// Node >= 21.7 punya loadEnvFile bawaan, jadi tidak perlu dotenv hanya untuk ini.
if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

const DEFAULT_DATABASE_URL = 'postgres://ecgo:ecgo_dev_password@localhost:55432/ecgo_ops'

export const env = {
  /** Port API. Client Vite berjalan di 3000 dan mem-proxy /api ke sini. */
  port: Number(process.env.API_PORT ?? 3001),

  databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,

  /** Cabinet ditandai basi bila heartbeat-nya lebih tua dari ini. */
  staleMinutes: Number(process.env.ECGO_STALE_MINUTES ?? 10),

  isProduction: process.env.NODE_ENV === 'production',

  /** Zona waktu tampilan tim ops. Penyimpanan selalu UTC. */
  timeZone: 'Asia/Jakarta',
} as const

if (!Number.isFinite(env.staleMinutes) || env.staleMinutes <= 0) {
  throw new Error(`ECGO_STALE_MINUTES tidak valid: ${process.env.ECGO_STALE_MINUTES}`)
}
