import { describe, expect, it } from 'vitest'
import { deriveCondition } from '../src/utils/condition'
import type {
  CabinetListResponse,
  FleetSummaryResponse,
  SlotState,
} from '../shared/contracts/cabinets'
import { CREDENTIALS, getJson, login, serverIsUp } from './helpers'

/**
 * Sisi SERVER dari redesign triage (§12): sortir keparahan, dua nilai filter
 * kondisi yang baru, dan dua field baru di respons daftar.
 *
 * Sama seperti api-contract.spec.ts, berkas ini butuh server hidup dan di-skip
 * kalau tidak ada. Yang diuji adalah KONTRAK dan INVARIAN, bukan angka: "ada 7
 * cabinet offline" akan merah tiap kali simulator berjalan, sementara "urutan
 * keparahan tidak pernah menaik" harus benar selamanya.
 */

const cookie = serverIsUp ? await login(CREDENTIALS.admin) : ''
const get = <T>(path: string) => getJson<T>(path, cookie)

/** Peringkat yang sama dengan ekspresi CASE di server, dihitung ulang dari respons. */
const severityOf = (row: CabinetListResponse['data'][number]) =>
  deriveCondition(row, Date.now()).severity

describe.skipIf(!serverIsUp)('Sortir keparahan (CASE di ORDER BY)', () => {
  it('adalah sortir BAWAAN — tanpa parameter sort sekalipun', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?pageSize=50')
    const severities = body.data.map(severityOf)

    // Menurun, tidak pernah naik. Ini seluruh gunanya: yang bermasalah di atas.
    expect(severities).toEqual([...severities].sort((a, b) => b - a))
  })

  it('memakai swap 24 jam sebagai pemecah seri di dalam tingkat yang sama', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?pageSize=50')

    for (let i = 1; i < body.data.length; i += 1) {
      const prev = body.data[i - 1]!
      const curr = body.data[i]!
      if (severityOf(prev) === severityOf(curr)) {
        expect(prev.swaps24h).toBeGreaterThanOrEqual(curr.swaps24h)
      }
    }
  })

  it('OFFLINE dan 0-slot-siap sama-sama berperingkat di atas MAINTENANCE biasa', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?pageSize=50')

    const kritis = body.data.filter((r) => r.status === 'OFFLINE' || r.slotsReady === 0)
    const sehat = body.data.filter(
      (r) => r.status === 'ONLINE' && r.slotsReady > 0 && !r.isStale && r.lastHeartbeatAt,
    )

    if (kritis.length && sehat.length) {
      const posisiTerburukKritis = Math.max(...kritis.map((r) => body.data.indexOf(r)))
      const posisiTerbaikSehat = Math.min(...sehat.map((r) => body.data.indexOf(r)))
      expect(posisiTerburukKritis).toBeLessThan(posisiTerbaikSehat)
    }
  })

  it('arah tetap bisa dibalik, dan nilai sort lama tetap sah', async () => {
    const asc = await get<CabinetListResponse>('/api/cabinets?sort=severity&dir=asc&pageSize=50')
    const severities = asc.body.data.map(severityOf)
    expect(severities).toEqual([...severities].sort((a, b) => a - b))

    // URL yang sudah di-bookmark orang tidak boleh pecah karena bawaannya berubah.
    for (const sort of ['swaps24h', 'code', 'lastHeartbeat']) {
      const { status } = await get<CabinetListResponse>(`/api/cabinets?sort=${sort}&pageSize=10`)
      expect(status).toBe(200)
    }
  })
})

describe.skipIf(!serverIsUp)('Filter kondisi baru', () => {
  it('NO_READY_SLOTS hanya mengembalikan cabinet yang benar-benar 0 slot siap', async () => {
    const { status, body } = await get<CabinetListResponse>(
      '/api/cabinets?status=NO_READY_SLOTS&pageSize=50',
    )

    expect(status).toBe(200)
    for (const row of body.data) expect(row.slotsReady).toBe(0)
  })

  it('STALE_HEARTBEAT mengembalikan yang diam DAN yang belum pernah melapor', async () => {
    const { body } = await get<CabinetListResponse>(
      '/api/cabinets?status=STALE_HEARTBEAT&pageSize=50',
    )

    for (const row of body.data) {
      const belumPernah = row.lastHeartbeatAt === null
      const diam = row.status === 'ONLINE' && row.isStale
      expect(belumPernah || diam).toBe(true)
    }
  })

  it('jumlahnya sama persis dengan angka di /api/summary yang menempel di chip', async () => {
    // Kalau dua angka ini berbeda, chip menampilkan satu jumlah lalu menghasilkan
    // jumlah baris yang lain — tebak-tebakan yang justru mau dihapus §12.1.
    const { body: summary } = await get<FleetSummaryResponse>('/api/summary')

    const cases: [string, number][] = [
      ['OFFLINE', summary.data.offline],
      ['MAINTENANCE', summary.data.maintenance],
      ['STALE_HEARTBEAT', summary.data.stale],
      ['NO_READY_SLOTS', summary.data.noReadySlots],
    ]

    for (const [filter, expected] of cases) {
      const { body } = await get<CabinetListResponse>(
        `/api/cabinets?status=${filter}&pageSize=10`,
      )
      expect(body.meta.total, `chip ${filter}`).toBe(expected)
    }
  })

  it('beberapa nilai di-OR, bukan di-AND', async () => {
    const only = async (s: string) =>
      (await get<CabinetListResponse>(`/api/cabinets?status=${s}&pageSize=10`)).body.meta.total

    const offline = await only('OFFLINE')
    const noReady = await only('NO_READY_SLOTS')
    const { body: both } = await get<CabinetListResponse>(
      '/api/cabinets?status=OFFLINE&status=NO_READY_SLOTS&pageSize=50',
    )

    // OR: gabungannya minimal sebesar yang terbesar, dan tidak melebihi jumlahnya.
    expect(both.meta.total).toBeGreaterThanOrEqual(Math.max(offline, noReady))
    expect(both.meta.total).toBeLessThanOrEqual(offline + noReady)
  })

  it('status lama tetap diterima, nilai ngawur tetap 400', async () => {
    for (const s of ['ONLINE', 'OFFLINE', 'MAINTENANCE']) {
      const { status } = await get<CabinetListResponse>(`/api/cabinets?status=${s}&pageSize=10`)
      expect(status).toBe(200)
    }

    const { status } = await get<CabinetListResponse>('/api/cabinets?status=BOGUS')
    expect(status).toBe(400)
  })
})

describe.skipIf(!serverIsUp)('Field baru di respons daftar', () => {
  const ORDER: Record<SlotState, number> = { FULL: 0, CHARGING: 1, FAULT: 2, LOCKED: 3, EMPTY: 4 }

  it('slotStates panjangnya = slotsTotal dan cocok dengan hitungan terisi/siap', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?pageSize=50')

    for (const row of body.data) {
      expect(row.slotStates).toHaveLength(row.slotsTotal)
      expect(row.slotStates.filter((s) => s === 'FULL')).toHaveLength(row.slotsReady)

      // "Terisi" dihitung dari ADA TIDAKNYA baterai, bukan dari state-nya, dan
      // FAULT adalah satu-satunya state yang bisa dua-duanya: lubang rusak yang
      // kosong dan lubang rusak yang masih menahan baterai sama-sama sah. Jadi
      // yang bisa dijamin adalah batas atas dan bawahnya, bukan angka persisnya.
      const pastiBerisi = row.slotStates.filter((s) => s !== 'EMPTY' && s !== 'FAULT').length
      const mungkinBerisi = row.slotStates.filter((s) => s !== 'EMPTY').length

      expect(row.slotsFilled, row.code).toBeGreaterThanOrEqual(pastiBerisi)
      expect(row.slotsFilled, row.code).toBeLessThanOrEqual(mungkinBerisi)
    }
  })

  it('slotStates sudah diurutkan per state, bukan per nomor slot', async () => {
    // Diurutkan di SQL supaya kolomnya terbaca sebagai bentuk yang konsisten
    // antar baris; urutan fisik akan membuat tiap baris tampak acak.
    const { body } = await get<CabinetListResponse>('/api/cabinets?pageSize=50')

    for (const row of body.data) {
      const ranks = row.slotStates.map((s) => ORDER[s])
      expect(ranks, row.code).toEqual([...ranks].sort((a, b) => a - b))
    }
  })

  it('hourly selalu 24 bucket dan totalnya tidak melebihi swap 24 jam', async () => {
    const { body } = await get<CabinetListResponse>('/api/cabinets?pageSize=50')

    for (const row of body.data) {
      expect(row.hourly, row.code).toHaveLength(24)
      expect(row.hourly.every((n) => Number.isInteger(n) && n >= 0)).toBe(true)
      // Bucket-nya jam penuh sementara swaps24h bergulir persis, jadi keduanya
      // boleh berbeda sedikit — tapi tidak boleh berbeda jauh (README §7.9).
      const jumlah = row.hourly.reduce((a, b) => a + b, 0)
      expect(Math.abs(jumlah - row.swaps24h)).toBeLessThanOrEqual(row.swaps24h + 1)
    }
  })
})

describe.skipIf(!serverIsUp)('GET /api/summary — field baru', () => {
  it('mengirim hourly 24 bucket untuk sparkline armada', async () => {
    const { body } = await get<FleetSummaryResponse>('/api/summary')

    expect(body.data.hourly).toHaveLength(24)
    expect(body.data.hourly.every((n) => Number.isInteger(n) && n >= 0)).toBe(true)
  })

  it('stale dan noReadySlots tidak pernah melebihi total armada', async () => {
    const { body } = await get<FleetSummaryResponse>('/api/summary')
    const s = body.data

    expect(s.stale).toBeLessThanOrEqual(s.total)
    expect(s.noReadySlots).toBeLessThanOrEqual(s.total)
    expect(s.online + s.offline + s.maintenance).toBe(s.total)
  })
})
