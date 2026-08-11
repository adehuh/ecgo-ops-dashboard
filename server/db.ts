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
  /**
   * Serverless memakai SATU koneksi per instance.
   *
   * Satu proses panjang boleh memegang 10. Tapi platform serverless menjalankan
   * banyak instance secara paralel dan membekukannya di antara request, jadi 10
   * koneksi per instance akan menghabiskan jatah koneksi Postgres jauh sebelum
   * trafiknya sendiri terasa berat — dan gejalanya muncul sebagai
   * "too many connections" yang terlihat seperti database yang rusak.
   */
  max: env.isServerless ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // Postgres terkelola (Neon, Supabase, Vercel Postgres) mewajibkan TLS; server
  // lokal di Docker tidak memakainya sama sekali. `require` di lokal akan
  // menggagalkan koneksi, jadi pilihannya mengikuti lingkungan.
  ssl: env.databaseUrl.includes('sslmode=require') || env.isServerless ? 'require' : false,
  onnotice: () => {},
})

export const staleMinutes = () => env.staleMinutes
