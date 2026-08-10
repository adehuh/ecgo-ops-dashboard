import type { ApiErrorBody, ApiErrorCode } from '~~/shared/contracts/cabinets'

/**
 * Ubah kegagalan `useFetch` menjadi sesuatu yang bisa ditampilkan.
 *
 * $fetch menaruh body respons di `error.data`, jadi amplop `{ error: { code,
 * message } }` dari server bisa dibaca kembali di sini. Kalau permintaannya
 * tidak pernah sampai (DNS mati, server belum hidup, browser offline), tidak ada
 * body sama sekali — dan itu kasus yang berbeda: yang satu bug di sisi kita,
 * yang satu lagi masalah jaringan, dan keduanya menuntut kalimat yang berbeda.
 */
export function describeApiError(error: unknown): { message: string; code: ApiErrorCode | 'NETWORK' } {
  const body = (error as { data?: ApiErrorBody } | null)?.data

  if (body?.error?.message) {
    return { message: body.error.message, code: body.error.code }
  }

  return {
    message:
      'Tidak bisa menghubungi server. Pastikan `npm run dev` dan `docker compose up -d` sedang berjalan, lalu coba lagi.',
    code: 'NETWORK',
  }
}
