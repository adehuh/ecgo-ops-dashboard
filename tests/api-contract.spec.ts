import { describe, expect, it } from 'vitest'
import type { CabinetDetailResponse, CabinetListResponse } from '../shared/contracts/cabinets'
import type { ApiErrorBody } from '../shared/contracts/errors'
import { BASE_URL, CREDENTIALS, getJson, login, serverIsUp } from './helpers'

/**
 * Test kontrak API — dijalankan terhadap server dev yang sedang hidup.
 *
 *   Terminal 1: docker compose up -d && npm run db:migrate && npm run seed && npm run dev
 *   Terminal 2: npm test
 *
 * Kalau servernya tidak ada, seluruh berkas ini di-skip, bukan gagal: suite
 * geofence (Bagian B) harus tetap hijau di checkout kosong tanpa Docker.
 *
 * Yang diuji di sini adalah KONTRAK-nya, bukan angkanya. Assert "CB-KBJ-03 punya
 * 84 swap" akan merah setiap jam karena window-nya bergulir. Yang harus tetap
 * benar selamanya adalah bentuknya: selalu 24 bucket, error selalu punya `code`,
 * pagination tidak pernah menampilkan baris yang sama dua kali.
 */

const cookie = serverIsUp ? await login(CREDENTIALS.admin) : ''

/**
 * Semua endpoint di bawah kini butuh sesi, jadi test kontrak masuk sebagai ADMIN
 * — peran yang melihat seluruh armada, supaya yang diuji tetap bentuk kontraknya
 * dan bukan efek penyempitan ruang lingkup. Perilaku ruang lingkup itu sendiri
 * diuji terpisah di auth.spec.ts.
 */
const get = <T>(path: string) => getJson<T>(path, cookie)

describe.skipIf(!serverIsUp)('GET /api/cabinets', () => {
  it('mengembalikan data dan meta pagination yang konsisten', async () => {
    const { status, body } = await get<CabinetListResponse>('/api/cabinets?pageSize=10')

    expect(status).toBe(200)
    expect(body.data.length).toBeLessThanOrEqual(10)
    expect(body.meta.page).toBe(1)
    expect(body.meta.pageSize).toBe(10)
    expect(body.meta.totalPages).toBe(Math.max(1, Math.ceil(body.meta.total / 10)))
  })

  it('tiap baris memenuhi invarian domain', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?pageSize=50')

    for (const cabinet of body.data) {
      expect(cabinet.slotsFilled).toBeLessThanOrEqual(cabinet.slotsTotal)
      expect(cabinet.slotsReady).toBeLessThanOrEqual(cabinet.slotsFilled)
      expect(cabinet.swaps24h).toBeGreaterThanOrEqual(0)

      // "Belum pernah melapor" bukan "basi". Cabinet tanpa heartbeat tidak boleh
      // ikut ditandai basi, karena keduanya menuntut tindakan ops yang berbeda.
      if (cabinet.lastHeartbeatAt === null) {
        expect(cabinet.isStale).toBe(false)
      }
    }
  })

  it('pencarian dikerjakan di server, bukan mengirim semua baris lalu difilter', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?q=sunter&pageSize=50')

    expect(body.data.length).toBeGreaterThan(0)
    // Kalau filternya bocor ke client, total-nya akan tetap 50 (seluruh armada).
    expect(body.meta.total).toBeLessThan(50)
    for (const cabinet of body.data) {
      const haystack = `${cabinet.code} ${cabinet.branchName} ${cabinet.branchCode}`.toLowerCase()
      expect(haystack).toContain('s')
    }
  })

  it('filter status hanya mengembalikan status yang diminta', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?status=MAINTENANCE&pageSize=50')

    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data.every((c) => c.status === 'MAINTENANCE')).toBe(true)
  })

  it('menerima beberapa status sekaligus', async () => {
    const { body } = await get<CabinetListResponse>(
      '/api/cabinets?status=OFFLINE&status=MAINTENANCE&pageSize=50',
    )

    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data.every((c) => c.status === 'OFFLINE' || c.status === 'MAINTENANCE')).toBe(true)
  })

  it('sortir swaps24h desc benar-benar menurun', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?sort=swaps24h&dir=desc&pageSize=50')
    const counts = body.data.map((c) => c.swaps24h)

    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  it('sortir lastHeartbeat menaruh cabinet yang belum pernah melapor di akhir', async () => {
    const { body } = await get<CabinetListResponse>(
      '/api/cabinets?sort=lastHeartbeat&dir=asc&pageSize=50',
    )

    const firstNullAt = body.data.findIndex((c) => c.lastHeartbeatAt === null)
    if (firstNullAt >= 0) {
      // Sekali NULL muncul, sisanya harus NULL semua — tidak ada yang menyelinap
      // kembali di tengah.
      expect(body.data.slice(firstNullAt).every((c) => c.lastHeartbeatAt === null)).toBe(true)
    }
  })

  it('pagination tidak menampilkan cabinet yang sama di dua halaman', async () => {
    // Ini yang membuktikan pemecah seri di ORDER BY bekerja. Tanpa kunci unik di
    // akhir, baris dengan jumlah swap sama bisa bertukar urutan antar request dan
    // muncul dua kali sambil menyembunyikan yang lain.
    const [p1, p2] = await Promise.all([
      get<CabinetListResponse>('/api/cabinets?pageSize=25&page=1'),
      get<CabinetListResponse>('/api/cabinets?pageSize=25&page=2'),
    ])

    const codes = [...p1.body.data, ...p2.body.data].map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('halaman di luar jangkauan mengembalikan daftar kosong, bukan error', async () => {
    const { status, body } = await get<CabinetListResponse>('/api/cabinets?page=9999&pageSize=50')

    expect(status).toBe(200)
    expect(body.data).toEqual([])
    // Meta tetap jujur soal berapa banyak yang sebenarnya ada.
    expect(body.meta.total).toBeGreaterThan(0)
  })

  it.each([
    ['status tidak dikenal', '/api/cabinets?status=BROKEN'],
    ['pageSize di luar enum', '/api/cabinets?pageSize=1000'],
    ['page nol', '/api/cabinets?page=0'],
    ['page bukan angka', '/api/cabinets?page=abc'],
    ['sort tidak dikenal', '/api/cabinets?sort=; DROP TABLE cabinets'],
    ['q terlalu panjang', `/api/cabinets?q=${'x'.repeat(101)}`],
  ])('%s -> 400 VALIDATION_ERROR dengan detail field', async (_label, path) => {
    const { status, body } = await get<ApiErrorBody>(path)

    expect(status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details?.length).toBeGreaterThan(0)
  })

  it('wildcard LIKE di kata kunci diperlakukan sebagai teks biasa', async () => {
    // '%' tidak boleh berperilaku sebagai "cocokkan semua".
    const [all, wildcard] = await Promise.all([
      get<CabinetListResponse>('/api/cabinets?pageSize=50'),
      get<CabinetListResponse>('/api/cabinets?q=%25&pageSize=50'),
    ])

    expect(all.body.meta.total).toBeGreaterThan(0)
    expect(wildcard.body.meta.total).toBe(0)
  })
})

describe.skipIf(!serverIsUp)('GET /api/cabinets/:code', () => {
  const firstCode = async (): Promise<string> => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?pageSize=10')
    return body.data[0]!.code
  }

  it('mengembalikan detail lengkap dengan bentuk yang benar', async () => {
    const { status, body } = await get<CabinetDetailResponse>(`/api/cabinets/${await firstCode()}`)

    expect(status).toBe(200)
    expect(body.data.slots).toHaveLength(body.data.slotCount)
    expect(body.data.recentSwaps.length).toBeLessThanOrEqual(20)
  })

  it('grafik selalu tepat 24 bucket berurutan, termasuk jam yang nol', async () => {
    const { body } = await get<CabinetDetailResponse>(`/api/cabinets/${await firstCode()}`)
    const { hourly } = body.data

    expect(hourly).toHaveLength(24)
    // Gap-filling dilakukan di SQL; jam sepi harus muncul sebagai 0, bukan hilang.
    expect(hourly.every((h) => Number.isInteger(h.count) && h.count >= 0)).toBe(true)
    const timestamps = hourly.map((h) => h.hourStart)
    expect(timestamps).toEqual([...timestamps].sort())
  })

  it('SOC ada jika dan hanya jika slotnya berisi baterai', async () => {
    const { body } = await get<CabinetDetailResponse>(`/api/cabinets/${await firstCode()}`)

    for (const slot of body.data.slots) {
      // Slot kosong harus soc null, BUKAN 0 — 0% berarti baterai habis, dan itu
      // tindakan ops yang berbeda dari lubang kosong.
      expect(slot.soc === null).toBe(slot.batteryId === null)
      if (slot.state === 'EMPTY') expect(slot.batteryId).toBeNull()
      if (slot.soc !== null) expect(slot.soc).toBeGreaterThanOrEqual(0)
      if (slot.soc !== null) expect(slot.soc).toBeLessThanOrEqual(100)
    }
  })

  it('referensi rider disamarkan sebelum meninggalkan server', async () => {
    const { body } = await get<CabinetDetailResponse>(`/api/cabinets/${await firstCode()}`)

    for (const swap of body.data.recentSwaps) {
      expect(swap.riderRef).toContain('•')
      expect(swap.riderRef).not.toMatch(/RD-\d{6}/)
    }
  })

  it('20 swap terakhir terurut menurun berdasarkan waktu', async () => {
    const { body } = await get<CabinetDetailResponse>(`/api/cabinets/${await firstCode()}`)
    const times = body.data.recentSwaps.map((s) => s.occurredAt)

    expect(times).toEqual([...times].sort().reverse())
  })

  it('kode yang tidak ada -> 404 NOT_FOUND', async () => {
    const { status, body } = await get<ApiErrorBody>('/api/cabinets/CB-TIDAK-ADA')

    expect(status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('kode berbentuk tidak sah ditolak 400 sebelum menyentuh database', async () => {
    const { status, body } = await get<ApiErrorBody>('/api/cabinets/CB%20OR%201%3D1')

    expect(status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('pesan error tidak membocorkan detail internal database', async () => {
    const { body } = await get<ApiErrorBody>('/api/cabinets/CB-TIDAK-ADA')
    const message = JSON.stringify(body).toLowerCase()

    for (const leak of ['select', 'from cabinets', 'postgres', 'stack', 'at object.']) {
      expect(message).not.toContain(leak)
    }
  })
})
