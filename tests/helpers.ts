/**
 * Perkakas bersama untuk test yang menghantam server dev yang sedang hidup.
 */

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

export const serverIsUp = await fetch(`${BASE_URL}/api/health`, {
  signal: AbortSignal.timeout(2_000),
})
  .then((r) => r.ok)
  .catch(() => false)

export const CREDENTIALS = {
  admin: { email: 'admin@ecgo.test', password: 'ops-admin-2026' },
  kemayoran: { email: 'kemayoran@ecgo.test', password: 'ops-kemayoran-2026' },
  bekasi: { email: 'bekasi@ecgo.test', password: 'ops-bekasi-2026' },
  /** Supervisor tanpa satu pun cabang — membuktikan otorisasinya gagal tertutup. */
  tanpaCabang: { email: 'baru@ecgo.test', password: 'ops-baru-2026' },
} as const

export type ApiResult<T> = { status: number; body: T }

export async function postJson<T>(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<ApiResult<T> & { setCookie: string[] }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })

  return {
    status: response.status,
    body: (await response.json()) as T,
    setCookie: response.headers.getSetCookie(),
  }
}

export async function getJson<T>(path: string, cookie?: string): Promise<ApiResult<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: cookie ? { cookie } : {},
  })
  return { status: response.status, body: (await response.json()) as T }
}

/**
 * Masuk dan kembalikan header Cookie yang siap dipakai.
 *
 * Sengaja lewat endpoint login sungguhan, bukan dengan menyuntikkan baris sesi
 * ke database: yang ingin saya uji adalah jalur yang benar-benar dilewati
 * pengguna, termasuk hashing password dan pemasangan cookie.
 */
export async function login(credentials: { email: string; password: string }): Promise<string> {
  const { status, setCookie } = await postJson('/api/auth/login', credentials)
  if (status !== 200) throw new Error(`Login gagal untuk ${credentials.email}: HTTP ${status}`)

  const session = setCookie.find((c) => c.startsWith('ecgo_session='))
  if (!session) throw new Error('Respons login tidak memasang cookie sesi')

  return session.split(';')[0]!
}
