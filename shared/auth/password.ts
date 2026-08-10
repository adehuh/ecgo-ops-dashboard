import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

/**
 * Hashing password — murni, tanpa dependensi ke Express maupun ke database.
 *
 * Dipisahkan ke `shared/` supaya skrip seed bisa memakai fungsi yang PERSIS SAMA
 * dengan yang dipakai endpoint login. Kalau seed punya penghasil hash sendiri,
 * cepat atau lambat keduanya akan berbeda parameter, dan gejalanya adalah
 * "password seed tidak bisa dipakai masuk" — yang akan saya cari di tempat yang
 * salah selama satu jam.
 */

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

/**
 * N=2^16 ≈ 64 MiB per verifikasi.
 *
 * Kenapa scrypt dan bukan argon2id/bcrypt: keduanya butuh dependensi, dan argon2
 * butuh binding native yang harus dikompilasi. scrypt sudah ada di `node:crypto`,
 * memory-hard, dan diterima OWASP sebagai KDF password. Argon2id tetap pilihan
 * pertama saya untuk produksi; di sini nol dependensi lebih berharga supaya
 * `npm install` di mesin reviewer tidak bisa gagal karena toolchain native.
 *
 * Tidak dinaikkan ke 2^17 dengan sengaja: 128 MiB per percobaan login menjadikan
 * endpoint login sendiri sebagai vektor pengurasan memori. Rate limit di
 * server/utils/auth.ts adalah pasangan wajibnya.
 */
const PARAMS = { N: 2 ** 16, r: 8, p: 1 } as const
const KEY_LENGTH = 64

/** Kelonggaran di atas kebutuhan sebenarnya (128 * N * r). */
const maxmemFor = (N: number, r: number) => 256 * N * r

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const { N, r, p } = PARAMS
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: maxmemFor(N, r),
  })

  // Parameter disimpan bersama hash-nya, jadi biayanya bisa dinaikkan nanti
  // tanpa membatalkan password yang sudah terlanjur ada: hash lama tetap
  // terverifikasi dengan parameter lamanya.
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, nRaw, rRaw, pRaw, saltRaw, keyRaw] = stored.split('$')
  if (scheme !== 'scrypt' || !nRaw || !rRaw || !pRaw || !saltRaw || !keyRaw) return false

  const N = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  const expected = Buffer.from(keyRaw, 'base64')
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltRaw, 'base64'), expected.length, {
    N,
    r,
    p,
    maxmem: maxmemFor(N, r),
  })

  // Perbandingan waktu-konstan. `===` pada string keluar lebih cepat pada
  // ketidakcocokan pertama, dan selisih waktu itu bisa diukur dari jarak jauh.
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
