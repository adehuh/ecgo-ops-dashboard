import { Router } from 'express'
import { verifyPassword } from '../../shared/auth/password.js'
import { loginSchema, type LoginResponse, type MeResponse } from '../../shared/contracts/auth.js'
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  createSession,
  destroySession,
  dummyHash,
  loadSessionUser,
  loginRateKey,
  pruneExpiredSessions,
  resolveSession,
  toSessionUser,
} from '../auth.js'
import { sql } from '../db.js'
import { ApiError, ok, parseOrThrow } from '../http.js'

export const authRouter = Router()

type UserRow = {
  id: number
  email: string
  name: string
  role: 'ADMIN' | 'SUPERVISOR'
  password_hash: string
}

authRouter.post('/login', async (req, res) => {
  const { email, password } = parseOrThrow(loginSchema, req.body, 'Data masuk')

  // Rate limit SEBELUM menyentuh database dan sebelum membayar biaya KDF.
  checkLoginRateLimit(loginRateKey(req, email))

  const [user] = await sql<UserRow[]>`
    SELECT id::int, email, name, role, password_hash
    FROM users
    WHERE lower(email) = lower(${email}) AND active
  `

  // Email tidak dikenal tetap membayar biaya verifikasi yang sama. Kembali
  // seketika di sini akan membocorkan siapa saja yang punya akun, lewat
  // stopwatch, betapapun identiknya pesan error kita.
  const passwordOk = await verifyPassword(password, user?.password_hash ?? (await dummyHash()))

  if (!user || !passwordOk) {
    // Satu pesan untuk kedua kegagalan. "Email tidak terdaftar" dan "password
    // salah" adalah dua kalimat yang, digabung, memberi penyerang daftar akun
    // yang sah untuk diserang.
    throw new ApiError('UNAUTHORIZED', 'Email atau password salah')
  }

  clearLoginRateLimit(loginRateKey(req, email))
  await pruneExpiredSessions()

  const { expiresAt } = await createSession(req, res, user.id)

  const sessionUser = await loadSessionUser(user.id, expiresAt)
  if (!sessionUser) throw new ApiError('INTERNAL', 'Gagal membuat sesi')

  ok<LoginResponse>(res, { data: sessionUser })
})

/**
 * POST, bukan GET.
 *
 * Logout mengubah state, dan endpoint GET yang mengubah state bisa dipicu oleh
 * sesuatu sesepele `<img src="/api/auth/logout">` di halaman lain — mengeluarkan
 * pengguna tanpa mereka menyentuh apa pun.
 *
 * Selalu 200, bahkan tanpa sesi: tidak ada gunanya memberi tahu pemanggil apakah
 * tadi ia memegang token yang sah.
 */
authRouter.post('/logout', async (req, res) => {
  await destroySession(req, res)
  ok(res, { data: { ok: true } })
})

/**
 * GET /api/auth/me — siapa yang sedang masuk.
 *
 * Membalas 200 dengan `data: null` ketika tidak ada sesi, BUKAN 401. Endpoint
 * ini menjawab "siapa yang masuk?", dan "tidak ada" adalah jawaban yang sah —
 * bukan kegagalan. Versi pertama saya melempar 401 dan akibatnya setiap
 * kunjungan pertama pengguna anonim mencetak error merah di konsol browser,
 * sementara client harus membungkus panggilan yang sepenuhnya normal dengan
 * try/catch.
 */
authRouter.get('/me', async (req, res) => {
  const session = await resolveSession(req)
  ok<MeResponse>(res, { data: session ? toSessionUser(session) : null })
})
