import type { ApiErrorBody, ApiErrorCode } from '@shared/contracts/errors'

/**
 * Client HTTP tipis di atas fetch.
 *
 * Ditulis sendiri, bukan memakai pustaka, supaya dua hal yang biasanya
 * tersembunyi menjadi eksplisit: bagaimana error diubah menjadi sesuatu yang
 * layak ditampilkan ke pengguna, dan bagaimana request lama dibatalkan.
 */

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode | 'NETWORK',
    message: string,
    readonly status: number,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

const NETWORK_MESSAGE =
  'Tidak bisa menghubungi server. Pastikan `npm run dev` dan `docker compose up -d` sedang berjalan, lalu coba lagi.'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response

  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      // Client dan API berbagi origin (Vite mem-proxy /api saat pengembangan),
      // jadi cookie sesi terkirim apa adanya tanpa perlu credentials: 'include'
      // dan tanpa perlu CORS.
      headers: options.body ? { 'content-type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    // Pembatalan bukan kegagalan — biarkan pemanggil membedakannya.
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiRequestError('NETWORK', NETWORK_MESSAGE, 0)
  }

  // fetch TIDAK menolak promise pada 404 atau 500 — status harus diperiksa
  // sendiri. Ini kesalahan yang saya sebut di jawaban A4 dan C1.
  if (!response.ok) {
    let body: ApiErrorBody | undefined
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      // Respons error tanpa body JSON (mis. dari proxy) — tetap ditangani.
    }

    throw new ApiRequestError(
      body?.error.code ?? 'INTERNAL',
      body?.error.message ?? `Permintaan gagal (HTTP ${response.status})`,
      response.status,
      body?.error.details,
    )
  }

  return (await response.json()) as T
}

/** Ubah kegagalan apa pun menjadi sesuatu yang layak ditampilkan ke pengguna. */
export function describeApiError(error: unknown): {
  message: string
  code: ApiErrorCode | 'NETWORK'
} {
  if (error instanceof ApiRequestError) return { message: error.message, code: error.code }
  return { message: NETWORK_MESSAGE, code: 'NETWORK' }
}

/** Bangun query string, membuang nilai kosong dan meratakan array. */
export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item))
    } else {
      search.set(key, String(value))
    }
  }

  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
