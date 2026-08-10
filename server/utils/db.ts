import postgres from 'postgres'

/**
 * Satu connection pool untuk seluruh proses server.
 *
 * Ini disengaja sebagai singleton tingkat modul. Membuat client baru di dalam
 * route handler berarti satu pool TCP baru per request; di bawah beban, Postgres
 * akan menolak koneksi jauh sebelum aplikasinya sendiri kehabisan tenaga.
 */
let client: postgres.Sql | undefined

export function useDb(): postgres.Sql {
  if (client) return client

  const config = useRuntimeConfig()
  const url = config.databaseUrl || process.env.DATABASE_URL

  if (!url) {
    throw new Error(
      'DATABASE_URL belum diset. Salin .env.example menjadi .env, lalu jalankan `docker compose up -d`.',
    )
  }

  client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  })

  return client
}

/** Ambang "basi" dalam menit, bisa diatur lewat env tanpa menyentuh SQL. */
export function staleMinutes(): number {
  const parsed = Number(useRuntimeConfig().staleMinutes)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}
