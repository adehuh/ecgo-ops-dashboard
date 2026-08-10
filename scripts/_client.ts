/**
 * Koneksi Postgres untuk skrip CLI (migrate, seed).
 *
 * Terpisah dari `server/utils/db.ts` karena skrip ini jalan di luar Nitro, jadi
 * `useRuntimeConfig()` tidak tersedia. Keduanya membaca variabel yang sama.
 */
import { existsSync } from 'node:fs'
import postgres from 'postgres'

// tsx tidak memuat .env sendiri. Node >= 21.7 punya loadEnvFile bawaan, jadi
// tidak perlu dependency dotenv hanya untuk ini.
if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

const DEFAULT_URL = 'postgres://ecgo:ecgo_dev_password@localhost:55432/ecgo_ops'

export const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_URL

export function createClient() {
  return postgres(databaseUrl, {
    // Notice dari `CREATE EXTENSION IF NOT EXISTS` dan sejenisnya hanya bikin
    // output migrasi berisik tanpa menambah informasi.
    onnotice: () => {},
    max: 4,
  })
}

/** Bikin pesan kegagalan koneksi yang bisa ditindaklanjuti, bukan ECONNREFUSED telanjang. */
export function explainConnectionError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return [
      `Tidak bisa terhubung ke Postgres di ${databaseUrl.replace(/:\/\/[^@]*@/, '://***@')}`,
      '',
      'Database-nya sudah jalan? Coba:',
      '  docker compose up -d',
      '  docker compose ps',
    ].join('\n')
  }
  return String((error as Error)?.message ?? error)
}
