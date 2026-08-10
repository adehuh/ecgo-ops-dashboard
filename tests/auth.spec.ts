import { afterAll, describe, expect, it } from 'vitest'
import type { ApiErrorBody } from '../shared/contracts/errors'
import type { LoginResponse, MeResponse } from '../shared/contracts/auth'
import type { CabinetListResponse, FleetSummaryResponse } from '../shared/contracts/cabinets'
import { BASE_URL, CREDENTIALS, getJson, login, postJson, serverIsUp } from './helpers'

/**
 * Autentikasi dan otorisasi.
 *
 * Yang diuji di sini bukan "apakah login bisa", melainkan hal-hal yang gagalnya
 * diam: apakah endpoint benar-benar tertutup tanpa sesi, apakah supervisor
 * benar-benar tidak bisa menyentuh cabang lain, dan apakah "bukan milikmu"
 * sungguh tidak bisa dibedakan dari "tidak ada".
 */

if (!serverIsUp) {
  console.warn(`\n⏭  Test auth dilewati — tidak ada server di ${BASE_URL}\n`)
}

const PROTECTED = [
  '/api/cabinets',
  '/api/cabinets/CB-KMY-01',
  '/api/summary',
] as const

describe.skipIf(!serverIsUp)('endpoint tertutup tanpa sesi', () => {
  it.each(PROTECTED)('%s -> 401 UNAUTHORIZED', async (path) => {
    const { status, body } = await getJson<ApiErrorBody>(path)

    expect(status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('cookie sesi palsu ditolak', async () => {
    const { status } = await getJson<ApiErrorBody>(
      '/api/cabinets',
      'ecgo_session=token-karangan-yang-panjangnya-mirip-asli-000000000',
    )

    expect(status).toBe(401)
  })

  it('/api/health tetap terbuka — ia dipakai monitoring, bukan membawa data ops', async () => {
    const { status } = await getJson('/api/health')
    expect(status).toBe(200)
  })

  it('/api/auth/me menjawab 200 dengan data null, bukan 401', async () => {
    // "Tidak ada yang masuk" adalah jawaban sah untuk "siapa yang masuk?".
    const { status, body } = await getJson<MeResponse>('/api/auth/me')

    expect(status).toBe(200)
    expect(body.data).toBeNull()
  })
})

describe.skipIf(!serverIsUp)('login', () => {
  it('kredensial benar mengembalikan pengguna dan memasang cookie HttpOnly', async () => {
    const { status, body, setCookie } = await postJson<LoginResponse>(
      '/api/auth/login',
      CREDENTIALS.kemayoran,
    )

    expect(status).toBe(200)
    expect(body.data.email).toBe(CREDENTIALS.kemayoran.email)
    expect(body.data.role).toBe('SUPERVISOR')

    const cookie = setCookie.find((c) => c.startsWith('ecgo_session='))!
    expect(cookie).toBeDefined()
    // HttpOnly berarti XSS tidak otomatis menjadi pengambilalihan sesi.
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('respons login tidak pernah memuat hash password', async () => {
    const { body } = await postJson<LoginResponse>('/api/auth/login', CREDENTIALS.admin)

    expect(JSON.stringify(body)).not.toContain('scrypt')
    expect(JSON.stringify(body)).not.toContain('password')
  })

  it.each([
    ['password salah', { email: CREDENTIALS.admin.email, password: 'jelas-salah' }],
    ['email tidak terdaftar', { email: 'hantu@ecgo.test', password: 'apa-saja' }],
  ])('%s -> 401 dengan pesan yang identik', async (_label, credentials) => {
    const { status, body } = await postJson<ApiErrorBody>('/api/auth/login', credentials)

    expect(status).toBe(401)
    // Pesan yang sama untuk kedua kegagalan. "Email tidak terdaftar" dan
    // "password salah", digabung, memberi penyerang daftar akun yang sah.
    expect(body.error.message).toBe('Email atau password salah')
  })

  it('email tak dikenal tetap memakan waktu, jadi keberadaan akun tidak bocor lewat stopwatch', async () => {
    const timeOf = async (credentials: { email: string; password: string }) => {
      const started = performance.now()
      await postJson('/api/auth/login', credentials)
      return performance.now() - started
    }

    const nyata = await timeOf({ email: CREDENTIALS.bekasi.email, password: 'salah' })
    const hantu = await timeOf({ email: 'tidak-ada-orang@ecgo.test', password: 'salah' })

    // Keduanya membayar biaya scrypt yang sama. Batasnya longgar karena ini
    // pengukuran waktu di mesin bersama; yang dijaga adalah tidak adanya
    // perbedaan sebesar orde besaran (kembali seketika vs ~100 ms).
    expect(hantu).toBeGreaterThan(nyata * 0.4)
  })

  it.each([
    ['email kosong', { email: '', password: 'x' }],
    ['email bukan email', { email: 'bukan-email', password: 'x' }],
    ['password kosong', { email: 'admin@ecgo.test', password: '' }],
  ])('%s -> 400 VALIDATION_ERROR', async (_label, credentials) => {
    const { status, body } = await postJson<ApiErrorBody>('/api/auth/login', credentials)

    expect(status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('body bukan JSON -> 400, bukan 500', async () => {
    // 500 berarti "bug server, coba lagi nanti", sehingga client akan mengulang
    // selamanya request yang tidak akan pernah bisa berhasil.
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'ini-bukan-json',
    })

    expect(response.status).toBe(400)
    expect(((await response.json()) as ApiErrorBody).error.code).toBe('VALIDATION_ERROR')
  })

  it('percobaan berulang akhirnya kena rate limit', async () => {
    // Email unik per pengujian: kuncinya IP+email, dan kunci yang tidak pernah
    // berhasil login tidak pernah dibersihkan. Kalau memakai email tetap, test
    // ini akan lulus sekali lalu gagal pada 10 menit berikutnya.
    const email = `probe-${Date.now()}@ecgo.test`
    const statuses: number[] = []

    for (let i = 0; i < 10; i += 1) {
      const { status } = await postJson<ApiErrorBody>('/api/auth/login', { email, password: 'x' })
      statuses.push(status)
      if (status === 429) break
    }

    expect(statuses).toContain(429)
    // Beberapa percobaan pertama harus tetap dijawab 401 — batasnya membatasi,
    // bukan memblokir sejak percobaan pertama.
    expect(statuses[0]).toBe(401)
  })

  // Login yang berhasil menghapus penghitung percobaan. Dijalankan di akhir agar
  // kegagalan yang sengaja dibuat di atas tidak menumpuk ke pengujian berikutnya.
  afterAll(async () => {
    if (!serverIsUp) return
    await postJson('/api/auth/login', CREDENTIALS.admin)
    await postJson('/api/auth/login', CREDENTIALS.bekasi)
  })
})

describe.skipIf(!serverIsUp)('ruang lingkup cabang', () => {
  it('ADMIN melihat seluruh armada', async () => {
    const cookie = await login(CREDENTIALS.admin)
    const { body } = await getJson<CabinetListResponse>('/api/cabinets?pageSize=50', cookie)

    expect(body.meta.total).toBe(50)
  })

  it('SUPERVISOR hanya melihat cabangnya sendiri', async () => {
    const cookie = await login(CREDENTIALS.kemayoran)
    const { body } = await getJson<CabinetListResponse>('/api/cabinets?pageSize=50', cookie)

    expect(body.meta.total).toBeGreaterThan(0)
    expect(body.meta.total).toBeLessThan(50)
    expect([...new Set(body.data.map((c) => c.branchCode))].sort()).toEqual(['KMY', 'SNT'])
  })

  it('dua supervisor berbeda tidak berbagi satu pun cabinet', async () => {
    const [kmy, bks] = await Promise.all([login(CREDENTIALS.kemayoran), login(CREDENTIALS.bekasi)])

    const [a, b] = await Promise.all([
      getJson<CabinetListResponse>('/api/cabinets?pageSize=50', kmy),
      getJson<CabinetListResponse>('/api/cabinets?pageSize=50', bks),
    ])

    const codesA = new Set(a.body.data.map((c) => c.code))
    const overlap = b.body.data.filter((c) => codesA.has(c.code))
    expect(overlap).toEqual([])
  })

  it('supervisor tanpa cabang tidak melihat apa pun — gagal tertutup', async () => {
    // Ini keadaan yang pasti terjadi di produksi: akun dibuat sebelum penugasan.
    // Kalau array kosong disalahartikan sebagai "tanpa batas", justru akun inilah
    // yang akan melihat seluruh armada.
    const cookie = await login(CREDENTIALS.tanpaCabang)
    const { body } = await getJson<CabinetListResponse>('/api/cabinets?pageSize=50', cookie)

    expect(body.data).toEqual([])
    expect(body.meta.total).toBe(0)
  })

  it('KPI ikut dibatasi ruang lingkup, tidak membocorkan ukuran armada cabang lain', async () => {
    const [adminCookie, kmyCookie] = await Promise.all([
      login(CREDENTIALS.admin),
      login(CREDENTIALS.kemayoran),
    ])

    const [all, scoped] = await Promise.all([
      getJson<FleetSummaryResponse>('/api/summary', adminCookie),
      getJson<FleetSummaryResponse>('/api/summary', kmyCookie),
    ])

    expect(scoped.body.data.total).toBeLessThan(all.body.data.total)
    expect(scoped.body.data.swaps24h).toBeLessThan(all.body.data.swaps24h)
  })

  it('pencarian tidak bisa menembus ruang lingkup', async () => {
    // Mencari cabang milik orang lain secara eksplisit tetap tidak menghasilkan apa pun.
    const cookie = await login(CREDENTIALS.kemayoran)
    const { body } = await getJson<CabinetListResponse>('/api/cabinets?q=bekasi&pageSize=50', cookie)

    expect(body.data).toEqual([])
  })
})

describe.skipIf(!serverIsUp)('IDOR — cabinet milik cabang lain', () => {
  it('mengembalikan 404 yang tidak bisa dibedakan dari cabinet yang tidak ada', async () => {
    const [kmyCookie, adminCookie] = await Promise.all([
      login(CREDENTIALS.kemayoran),
      login(CREDENTIALS.admin),
    ])

    // Ambil kode cabinet nyata milik cabang lain, lewat akun yang berhak.
    const { body: bekasiList } = await getJson<CabinetListResponse>(
      '/api/cabinets?q=BKS&pageSize=10',
      adminCookie,
    )
    const orangLain = bekasiList.data[0]!.code

    const [terlarang, tidakAda] = await Promise.all([
      getJson<ApiErrorBody>(`/api/cabinets/${orangLain}`, kmyCookie),
      getJson<ApiErrorBody>('/api/cabinets/CB-ZZZ-99', kmyCookie),
    ])

    // 404, bukan 403. 403 akan mengonfirmasi bahwa cabinet itu ADA, dan mengubah
    // endpoint ini menjadi alat menghitung armada cabang lain.
    expect(terlarang.status).toBe(404)
    expect(tidakAda.status).toBe(404)
    expect(terlarang.body.error.code).toBe('NOT_FOUND')

    // Dan yang paling penting: kedua responsnya harus berbentuk sama persis.
    expect(Object.keys(terlarang.body.error).sort()).toEqual(Object.keys(tidakAda.body.error).sort())
  })

  it('admin tetap bisa membuka cabinet yang sama', async () => {
    const cookie = await login(CREDENTIALS.admin)
    const { body: list } = await getJson<CabinetListResponse>(
      '/api/cabinets?q=BKS&pageSize=10',
      cookie,
    )

    const { status } = await getJson(`/api/cabinets/${list.data[0]!.code}`, cookie)
    expect(status).toBe(200)
  })
})

describe.skipIf(!serverIsUp)('logout', () => {
  it('membatalkan sesi di server, bukan hanya menghapus cookie di browser', async () => {
    const cookie = await login(CREDENTIALS.kemayoran)
    expect((await getJson('/api/cabinets?pageSize=10', cookie)).status).toBe(200)

    const { status } = await postJson('/api/auth/logout', {}, cookie)
    expect(status).toBe(200)

    // Token yang sama dipakai ulang — kalau logout hanya membuang cookie di
    // browser, token ini akan tetap sah bagi siapa pun yang sempat menyalinnya.
    expect((await getJson('/api/cabinets?pageSize=10', cookie)).status).toBe(401)
  })

  it('logout tanpa sesi tetap 200, tidak membocorkan apakah tokennya tadi sah', async () => {
    const { status } = await postJson('/api/auth/logout', {})
    expect(status).toBe(200)
  })
})
