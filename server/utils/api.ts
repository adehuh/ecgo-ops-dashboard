import type { H3Event } from 'h3'
import { ZodError, type ZodType } from 'zod'
import type { ApiErrorBody, ApiErrorCode } from '../../shared/contracts/cabinets'

/**
 * Satu bentuk respons error untuk seluruh API.
 *
 * Alasan memakai wrapper sendiri dan bukan `createError` bawaan Nitro: bentuk
 * default Nitro adalah `{ statusCode, statusMessage, stack, ... }`, yang (a)
 * berubah antara mode dev dan production, dan (b) memaksa client menebak apakah
 * sebuah kegagalan layak dicoba ulang. Client di sini bercabang berdasarkan
 * `error.code`, jadi kode itu harus menjadi bagian kontrak yang stabil.
 */

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const notFound = (message: string) => new ApiError('NOT_FOUND', message)

/**
 * Validasi dengan Zod dan ubah kegagalannya menjadi VALIDATION_ERROR yang
 * menyebutkan field mana yang salah — bukan sekadar "Bad Request".
 */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown, what: string): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data

  throw new ApiError(
    'VALIDATION_ERROR',
    `${what} tidak valid`,
    result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  )
}

/**
 * Bungkus route handler supaya tiap kegagalan keluar dengan amplop yang sama.
 *
 * Handler mengembalikan payload suksesnya sendiri (`{ data }` atau
 * `{ data, meta }`) sehingga endpoint yang berpaginasi tetap bisa menyertakan
 * meta tanpa lapisan pembungkus tambahan.
 */
export function defineApiHandler<T>(handler: (event: H3Event) => Promise<T>) {
  return defineEventHandler(async (event): Promise<T | ApiErrorBody> => {
    try {
      return await handler(event)
    } catch (error) {
      return respondWithError(event, error)
    }
  })
}

function respondWithError(event: H3Event, error: unknown): ApiErrorBody {
  if (error instanceof ApiError) {
    setResponseStatus(event, STATUS_BY_CODE[error.code])
    return { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }
  }

  // ZodError yang lolos tanpa lewat parseOrThrow — tetap perlakukan sebagai
  // kesalahan input, bukan 500, supaya client tidak mencoba ulang selamanya.
  if (error instanceof ZodError) {
    setResponseStatus(event, 400)
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Parameter tidak valid',
        details: error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message })),
      },
    }
  }

  // Apa pun sisanya adalah bug atau database yang mati. Detailnya dicatat di
  // server dan TIDAK dikirim ke client: pesan driver Postgres membocorkan nama
  // tabel, nama kolom, dan potongan SQL yang berguna bagi penyerang.
  console.error('[api] kegagalan tak tertangani', error)
  setResponseStatus(event, 500)
  return {
    error: {
      code: 'INTERNAL',
      message: 'Terjadi kesalahan tak terduga di server. Silakan coba lagi.',
    },
  }
}
