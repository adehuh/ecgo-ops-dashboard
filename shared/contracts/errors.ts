/**
 * Kontrak error, dipakai bersama oleh API Express dan client Vue.
 *
 * Dipindahkan keluar dari `cabinets.ts` saat autentikasi ditambahkan: bentuk
 * error berlaku untuk seluruh API, jadi menaruhnya di dalam kontrak satu domain
 * sudah salah tempat sejak awal, dan makin salah begitu ada endpoint auth.
 */

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'TOO_MANY_REQUESTS',
  'INTERNAL',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode
    message: string
    details?: { path: string; message: string }[]
  }
}

/**
 * Perhatikan yang TIDAK ada di sini: `FORBIDDEN`.
 *
 * Itu disengaja. Meminta cabinet milik cabang lain menghasilkan NOT_FOUND, bukan
 * 403 — 403 mengonfirmasi bahwa objeknya ada, yang mengubah endpoint menjadi alat
 * enumerasi bagi siapa pun yang penasaran seberapa besar armada cabang lain.
 * Lihat jawaban A8 §IDOR.
 */
export const HTTP_STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
}
