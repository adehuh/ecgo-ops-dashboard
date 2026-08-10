import type { ErrorRequestHandler, Request, Response } from 'express'
import { ZodError, type ZodType } from 'zod'
import {
  HTTP_STATUS_BY_CODE,
  type ApiErrorBody,
  type ApiErrorCode,
} from '../shared/contracts/errors.js'

/**
 * Satu bentuk error untuk seluruh API.
 *
 * Client bercabang berdasarkan `error.code`, jadi kode itu bagian kontrak yang
 * stabil — bukan detail yang boleh berubah antara mode dev dan produksi.
 */
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
 * Dipakai untuk "belum masuk". Untuk "objek ini bukan milikmu" kita justru
 * memakai notFound() — 403 akan mengonfirmasi bahwa objeknya ada. Lihat
 * shared/contracts/errors.ts.
 */
export const unauthorized = (
  message = 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.',
) => new ApiError('UNAUTHORIZED', message)

/**
 * Validasi dengan Zod, dan ubah kegagalannya menjadi VALIDATION_ERROR yang
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

export const ok = <T>(res: Response, payload: T): void => {
  res.json(payload)
}

/**
 * Penangan error terpusat.
 *
 * Express 5 meneruskan penolakan promise dari handler `async` ke sini secara
 * otomatis, jadi tidak perlu membungkus tiap route dengan try/catch — inilah
 * satu-satunya alasan kode route di bawah bisa sesederhana itu. (Di Express 4
 * error async akan hilang diam-diam dan requestnya menggantung.)
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(HTTP_STATUS_BY_CODE[error.code]).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    } satisfies ApiErrorBody)
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Parameter tidak valid',
        details: error.issues.map((i) => ({
          path: i.path.join('.') || '(root)',
          message: i.message,
        })),
      },
    } satisfies ApiErrorBody)
    return
  }

  // Body JSON rusak diberi status 400 oleh express.json(). Ini kesalahan KLIEN:
  // menjawab 500 akan membuat client mengulang selamanya request yang tidak akan
  // pernah bisa berhasil.
  if (isBodyParseError(error)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Body request bukan JSON yang valid' },
    } satisfies ApiErrorBody)
    return
  }

  // Sisanya adalah bug atau database yang mati. Detail lengkap ke log server,
  // dan TIDAK ke client: pesan driver Postgres membocorkan nama tabel, nama
  // kolom, dan potongan SQL yang berguna bagi penyerang.
  console.error('[api] kegagalan tak tertangani', { path: req.path, error })

  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Terjadi kesalahan tak terduga di server. Silakan coba lagi.',
    },
  } satisfies ApiErrorBody)
}

function isBodyParseError(error: unknown): boolean {
  const candidate = error as { type?: string; status?: number } | null
  return candidate?.type === 'entity.parse.failed' || candidate?.status === 400
}

/**
 * 404 untuk path /api yang tidak dikenal, tetap dalam amplop yang sama.
 *
 * `originalUrl`, bukan `req.path`: di dalam router yang di-mount, Express sudah
 * memotong awalan mount-nya, sehingga `/api/tidak-ada` dilaporkan sebagai
 * `/tidak-ada` — pesan error yang menunjuk ke alamat yang tidak pernah diminta
 * siapa pun.
 */
export const apiNotFound = (req: Request, res: Response): void => {
  const path = req.originalUrl.split('?')[0]
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Endpoint ${req.method} ${path} tidak ditemukan` },
  } satisfies ApiErrorBody)
}
