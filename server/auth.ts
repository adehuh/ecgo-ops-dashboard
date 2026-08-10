import { createHash, randomBytes } from 'node:crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { hashPassword } from '../shared/auth/password.js'
import type { SessionUser, UserRole } from '../shared/contracts/auth.js'
import { sql } from './db.js'
import { env } from './env.js'
import { ApiError, unauthorized } from './http.js'

export const SESSION_COOKIE = 'ecgo_session'

/** Satu shift kerja, ditambah kelonggaran. Absolut, bukan sliding. */
const SESSION_TTL_SECONDS = 12 * 60 * 60

export type Session = {
  user: { id: number; email: string; name: string; role: UserRole }
  /** Nama cabang yang boleh dilihat; kosong untuk ADMIN. */
  branchNames: string[]
  /**
   * `null` berarti TIDAK DIBATASI (ADMIN).
   * Array KOSONG berarti tidak boleh melihat apa pun — bukan hal yang sama.
   *
   * Membedakan keduanya penting ke dua arah: menyamakan null dengan [] membuat
   * ADMIN tidak melihat apa-apa (menjengkelkan), dan menyamakan [] dengan null
   * membuka seluruh armada untuk supervisor yang belum diberi cabang (kegagalan
   * terbuka). Yang kedua itulah yang harus mustahil.
   */
  allowedBranchIds: number[] | null
  expiresAt: Date
}

// Menempelkan sesi ke request supaya route tidak perlu mengambilnya dua kali.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session
    }
  }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export async function createSession(
  req: Request,
  res: Response,
  userId: number,
): Promise<{ expiresAt: Date }> {
  // 256 bit dari CSPRNG. Inilah yang membuat penyimpanan SHA-256 tanpa salt
  // aman: ruang tebakannya terlalu besar untuk diserang, jadi hash yang bocor
  // tidak bisa dibalikkan menjadi cookie yang sah.
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at, user_agent, ip)
    VALUES (
      ${sha256(token)},
      ${userId},
      ${expiresAt},
      ${req.get('user-agent')?.slice(0, 300) ?? null},
      ${req.ip ?? null}
    )
  `

  res.cookie(SESSION_COOKIE, token, {
    // Tidak bisa dibaca JavaScript, sehingga XSS tidak otomatis berarti
    // pengambilalihan sesi.
    httpOnly: true,
    // Lax memblokir pengiriman cookie pada POST lintas situs, jadi ia sudah
    // menutup CSRF untuk endpoint yang mengubah state di aplikasi ini (login
    // dan logout). Begitu ada mutasi yang lebih serius, saya akan menambahkan
    // token CSRF, bukan bersandar pada SameSite saja.
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  })

  return { expiresAt }
}

type UserScopeRow = {
  id: number
  email: string
  name: string
  role: UserRole
  branch_ids: number[]
  branch_names: string[]
}

const toSession = (row: UserScopeRow, expiresAt: Date): Session => ({
  user: { id: row.id, email: row.email, name: row.name, role: row.role },
  branchNames: row.role === 'ADMIN' ? [] : row.branch_names,
  allowedBranchIds: row.role === 'ADMIN' ? null : row.branch_ids,
  expiresAt,
})

/** Baca sesi kalau ada dan masih berlaku. Tidak melempar — dipakai /me juga. */
export async function resolveSession(req: Request): Promise<Session | null> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined
  if (!token) return null

  const [row] = await sql<(UserScopeRow & { expires_at: Date })[]>`
    SELECT
      s.expires_at,
      u.id::int,
      u.email,
      u.name,
      u.role,
      coalesce(array_agg(b.id::int ORDER BY b.name) FILTER (WHERE b.id IS NOT NULL), '{}') AS branch_ids,
      coalesce(array_agg(b.name  ORDER BY b.name) FILTER (WHERE b.name IS NOT NULL), '{}') AS branch_names
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_branches ub ON ub.user_id = u.id
    LEFT JOIN branches b ON b.id = ub.branch_id AND b.active
    WHERE s.token_hash = ${sha256(token)}
      -- Kedaluwarsa ditegakkan DI SINI, di server. maxAge pada cookie hanya
      -- petunjuk untuk browser dan sepele diabaikan.
      AND s.expires_at > now()
      -- Akun yang dinonaktifkan langsung kehilangan akses, tanpa menunggu
      -- sesinya berakhir sendiri.
      AND u.active
    GROUP BY s.expires_at, u.id, u.email, u.name, u.role
  `

  return row ? toSession(row, row.expires_at) : null
}

/**
 * Bentuk SessionUser langsung dari userId, tanpa lewat cookie.
 *
 * Dipakai endpoint login. Percobaan pertama saya memanggil resolveSession()
 * tepat setelah createSession(), dengan alasan "baca ulang lewat jalur yang sama
 * dengan request berikutnya". Itu tidak bisa bekerja: resolveSession membaca
 * cookie dari REQUEST, sedangkan cookie yang baru dipasang ada di RESPONSE.
 * Requestnya datang tanpa cookie, jadi hasilnya selalu null — login membuat sesi
 * yang sah, memasang cookie yang sah, lalu membalas 500.
 */
export async function loadSessionUser(userId: number, expiresAt: Date): Promise<SessionUser | null> {
  const [row] = await sql<UserScopeRow[]>`
    SELECT
      u.id::int,
      u.email,
      u.name,
      u.role,
      coalesce(array_agg(b.id::int ORDER BY b.name) FILTER (WHERE b.id IS NOT NULL), '{}') AS branch_ids,
      coalesce(array_agg(b.name  ORDER BY b.name) FILTER (WHERE b.name IS NOT NULL), '{}') AS branch_names
    FROM users u
    LEFT JOIN user_branches ub ON ub.user_id = u.id
    LEFT JOIN branches b ON b.id = ub.branch_id AND b.active
    WHERE u.id = ${userId} AND u.active
    GROUP BY u.id, u.email, u.name, u.role
  `

  return row ? toSessionUser(toSession(row, expiresAt)) : null
}

/**
 * Middleware penjaga. Dipasang di router, bukan diingat satu per satu di tiap
 * handler — cara yang kedua akan gagal pada endpoint pertama yang lupa.
 */
export const requireSession: RequestHandler = async (req, _res, next: NextFunction) => {
  try {
    const session = await resolveSession(req)
    if (!session) throw unauthorized()
    req.session = session
    next()
  } catch (error) {
    next(error)
  }
}

/** Ambil sesi yang sudah dipasang requireSession. Melempar kalau lupa dipasang. */
export function sessionOf(req: Request): Session {
  if (!req.session) {
    throw new Error('requireSession belum dipasang pada route ini')
  }
  return req.session
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined

  if (token) {
    // Dihapus di server, bukan sekadar cookie-nya dibuang di browser. Logout
    // yang hanya membuang cookie meninggalkan token yang masih sah — dan token
    // itu tetap bisa dipakai siapa pun yang sempat menyalinnya.
    await sql`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`
  }

  res.clearCookie(SESSION_COOKIE, { path: '/' })
}

/** Buang sesi kedaluwarsa. Dipanggil saat login; murah karena ada index. */
export async function pruneExpiredSessions(): Promise<void> {
  await sql`DELETE FROM sessions WHERE expires_at < now()`
}

export const toSessionUser = (session: Session): SessionUser => ({
  id: session.user.id,
  email: session.user.email,
  name: session.user.name,
  role: session.user.role,
  branchNames: session.branchNames,
  expiresAt: session.expiresAt.toISOString(),
})

/**
 * Klausa ruang lingkup cabang untuk dipakai di WHERE.
 *
 * Satu fungsi dipakai SEMUA query, supaya tidak mungkin ada endpoint yang
 * menyaring dengan aturan berbeda dari yang lain. Nama kolomnya ditulis tetap,
 * bukan parameter — setiap query yang memakainya meng-alias `cabinets` sebagai
 * `c`, dan kolom yang bisa dioper berarti ada tempat masuk untuk `sql.unsafe`.
 */
export function branchScopeClause(session: Session) {
  return session.allowedBranchIds === null
    ? sql`true`
    : sql`c.branch_id = ANY(${session.allowedBranchIds}::bigint[])`
}

// ---------------------------------------------------------------------------
// Hash boneka + rate limit login
// ---------------------------------------------------------------------------

/**
 * Hash boneka untuk email yang tidak terdaftar.
 *
 * Tanpa ini, login dengan email yang tidak ada akan kembali seketika sementara
 * email yang ada butuh ~100 ms untuk verifikasi scrypt. Selisih itu adalah
 * oracle enumerasi pengguna yang bisa dibaca dengan stopwatch, betapapun samanya
 * pesan error yang kita tampilkan. Jadi kita tetap membayar biaya KDF-nya.
 */
let dummyHashPromise: Promise<string> | undefined
export function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString('base64'))
  return dummyHashPromise
}

/**
 * Penghitung percobaan di memori proses.
 *
 * Batasnya jujur: PER PROSES, jadi di belakang beberapa instance batasnya
 * berlipat, dan restart menghapusnya. Untuk produksi ini harus pindah ke Redis
 * atau ke gateway. Saya tetap memasangnya karena endpoint login tanpa batas apa
 * pun di depan KDF 64 MiB adalah dua kerentanan sekaligus — penebakan password
 * dan pengurasan memori — dan versi tidak sempurna yang berjalan mengalahkan
 * versi sempurna yang belum ada.
 */
const MAX_ATTEMPTS = 8
const WINDOW_MS = 10 * 60_000

const attempts = new Map<string, { count: number; firstAt: number }>()

export function checkLoginRateLimit(key: string): void {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now })
    return
  }

  entry.count += 1

  if (entry.count > MAX_ATTEMPTS) {
    const retryInMinutes = Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 60_000)
    throw new ApiError(
      'TOO_MANY_REQUESTS',
      `Terlalu banyak percobaan masuk. Coba lagi dalam ${retryInMinutes} menit.`,
    )
  }
}

export const clearLoginRateLimit = (key: string): void => void attempts.delete(key)

/**
 * Kunci rate limit: IP digabung email.
 *
 * IP saja akan menghukum seluruh kantor yang berbagi satu NAT ketika satu orang
 * salah ketik. Email saja memungkinkan penyerang mengunci akun orang lain dari
 * luar — denial of service yang dibungkus sebagai fitur keamanan. Gabungannya
 * membatasi penyerang tanpa membiarkannya mengunci siapa pun.
 */
export const loginRateKey = (req: Request, email: string): string =>
  `${req.ip ?? 'unknown'}:${email.toLowerCase()}`
