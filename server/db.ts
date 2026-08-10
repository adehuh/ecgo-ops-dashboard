import postgres from 'postgres'
import { env } from './env.js'

/**
 * Satu connection pool untuk seluruh proses.
 *
 * Singleton tingkat modul, disengaja. Membuat client baru di dalam route handler
 * berarti satu pool TCP baru per request; di bawah beban, Postgres akan menolak
 * koneksi jauh sebelum aplikasinya sendiri kehabisan tenaga.
 */
export const sql = postgres(env.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
})

export const staleMinutes = () => env.staleMinutes
