import { describe, expect, it } from 'vitest'
import {
  evaluateCheckIn,
  haversineMeters,
  type Branch,
  type CheckIn,
} from '../shared/geofence/evaluateCheckIn'

/** Data uji persis seperti di soal. */
const branches: Branch[] = [
  { id: 'B-01', name: 'Kemayoran', lat: -6.1569, lng: 106.8449, radiusM: 150, active: true },
  { id: 'B-02', name: 'Sunter', lat: -6.142, lng: 106.872, radiusM: 200, active: true },
  { id: 'B-03', name: 'Cakung', lat: -6.185, lng: 106.945, radiusM: 120, active: false },
]

/** Bikin CheckIn tanpa mengulang field yang tidak relevan di tiap test. */
function checkIn(partial: Partial<CheckIn> & Pick<CheckIn, 'lat' | 'lng' | 'accuracyM'>): CheckIn {
  return {
    userId: 'U-001',
    at: '2026-08-10T07:30:00+07:00',
    ...partial,
  }
}

describe('evaluateCheckIn — lima kasus dari soal', () => {
  it('1. di dalam radius Kemayoran dengan akurasi baik -> VALID B-01', () => {
    const result = evaluateCheckIn(
      checkIn({ lat: -6.157, lng: 106.845, accuracyM: 12 }),
      branches,
    )

    expect(result).toMatchObject({
      status: 'VALID',
      branchId: 'B-01',
      branchName: 'Kemayoran',
    })
    // ~16 m dari titik pusat cabang.
    expect(result.status === 'VALID' && result.distanceM).toBeLessThan(50)
  })

  it('2. berdiri tepat di atas cabang nonaktif -> OUT_OF_RANGE, bukan VALID', () => {
    const result = evaluateCheckIn(
      checkIn({ lat: -6.1851, lng: 106.9451, accuracyM: 10 }),
      branches,
    )

    // Ini aturan 1 yang sesungguhnya diuji: cabang nonaktif tidak boleh ikut
    // dievaluasi meskipun karyawannya berdiri persis di dalam radiusnya.
    expect(result.status).toBe('OUT_OF_RANGE')
    expect(result).not.toMatchObject({ nearestBranchId: 'B-03' })
    expect(result.status === 'OUT_OF_RANGE' && result.nearestBranchId).toBe('B-02')
  })

  it('3. akurasi 140 m -> REJECTED / LOW_ACCURACY', () => {
    expect(
      evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: 140 }), branches),
    ).toEqual({ status: 'REJECTED', reason: 'LOW_ACCURACY' })
  })

  it('4. koordinat (0, 0) -> REJECTED / INVALID_COORDINATE', () => {
    expect(evaluateCheckIn(checkIn({ lat: 0, lng: 0, accuracyM: 5 }), branches)).toEqual({
      status: 'REJECTED',
      reason: 'INVALID_COORDINATE',
    })
  })

  it('5. jauh di selatan -> OUT_OF_RANGE dengan B-01 sebagai yang terdekat', () => {
    const result = evaluateCheckIn(checkIn({ lat: -6.3, lng: 106.8, accuracyM: 15 }), branches)

    expect(result.status).toBe('OUT_OF_RANGE')
    expect(result.status === 'OUT_OF_RANGE' && result.nearestBranchId).toBe('B-01')
    // ~16,7 km — dilaporkan supaya UI bisa bilang "kamu 16 km dari Kemayoran".
    expect(result.status === 'OUT_OF_RANGE' && result.distanceM).toBeGreaterThan(15_000)
  })
})

describe('pemilihan cabang (aturan 1, 2, 3)', () => {
  const overlapping: Branch[] = [
    { id: 'B-FAR', name: 'Jauh', lat: -6.1, lng: 106.8, radiusM: 5_000, active: true },
    { id: 'B-NEAR', name: 'Dekat', lat: -6.1005, lng: 106.8005, radiusM: 5_000, active: true },
  ]

  it('memilih yang paling dekat ketika berada di dalam radius beberapa cabang', () => {
    const result = evaluateCheckIn(
      checkIn({ lat: -6.1006, lng: 106.8006, accuracyM: 8 }),
      overlapping,
    )

    expect(result).toMatchObject({ status: 'VALID', branchId: 'B-NEAR' })
  })

  it('mengevaluasi seluruh cabang, bukan berhenti di yang pertama cocok', () => {
    // Kandidat terbaik sengaja ditaruh di elemen terakhir. Implementasi yang
    // memakai .find() dan berhenti di kecocokan pertama akan gagal di sini.
    const result = evaluateCheckIn(
      checkIn({ lat: -6.1006, lng: 106.8006, accuracyM: 8 }),
      [...overlapping].reverse(),
    )

    expect(result).toMatchObject({ status: 'VALID', branchId: 'B-NEAR' })
  })

  it('jarak seri -> menang id yang lebih kecil secara leksikografis', () => {
    // Dua cabang berjarak sama persis di timur dan barat titik check-in.
    const symmetric: Branch[] = [
      { id: 'B-ZZ', name: 'Timur', lat: -6, lng: 106.001, radiusM: 300, active: true },
      { id: 'B-AA', name: 'Barat', lat: -6, lng: 105.999, radiusM: 300, active: true },
    ]

    const result = evaluateCheckIn(checkIn({ lat: -6, lng: 106, accuracyM: 5 }), symmetric)

    expect(result).toMatchObject({ status: 'VALID', branchId: 'B-AA' })
  })

  it('seri yang muncul karena pembulatan juga kena tie-break, bukan hanya seri sempurna', () => {
    // 110,59 m vs 111,30 m: berbeda kalau dibandingkan mentah, dua-duanya 111 m
    // setelah dibulatkan. Karena aturan 2 dan 4 dinyatakan dalam `distanceM` yang
    // sudah dibulatkan, ini seri — dan id terkecil yang menang. Kalau
    // implementasinya diam-diam membandingkan nilai mentah, B-ZZ yang menang dan
    // test ini gagal.
    const roundsToSame: Branch[] = [
      { id: 'B-ZZ', name: 'Mentah lebih dekat', lat: -6, lng: 106.001, radiusM: 300, active: true },
      { id: 'B-AA', name: 'Mentah lebih jauh', lat: -6, lng: 106.0010065, radiusM: 300, active: true },
    ]

    const result = evaluateCheckIn(checkIn({ lat: -6, lng: 106, accuracyM: 5 }), roundsToSame)

    expect(result).toMatchObject({ status: 'VALID', branchId: 'B-AA', distanceM: 111 })
  })

  it('tie-break tidak bergantung pada urutan array masukan', () => {
    const symmetric: Branch[] = [
      { id: 'B-AA', name: 'Barat', lat: -6, lng: 105.999, radiusM: 300, active: true },
      { id: 'B-ZZ', name: 'Timur', lat: -6, lng: 106.001, radiusM: 300, active: true },
    ]

    expect(evaluateCheckIn(checkIn({ lat: -6, lng: 106, accuracyM: 5 }), symmetric)).toMatchObject({
      branchId: 'B-AA',
    })
  })
})

describe('toleransi GPS (aturan 4)', () => {
  const single: Branch[] = [
    { id: 'B-01', name: 'Kemayoran', lat: -6.1569, lng: 106.8449, radiusM: 100, active: true },
  ]
  const here = { lat: -6.158, lng: 106.846, accuracyM: 10 }
  const distance = Math.round(haversineMeters(here.lat, here.lng, -6.1569, 106.8449))

  it('cocok tepat di ambang: distanceM === radiusM + toleransi', () => {
    const tolerance = 10
    const atBoundary: Branch[] = [{ ...single[0]!, radiusM: distance - tolerance }]

    // Aturan memakai `<=`, jadi berdiri persis di garis batas itu VALID.
    expect(evaluateCheckIn(checkIn(here), atBoundary)).toMatchObject({ status: 'VALID' })
  })

  it('meleset satu meter di luar ambang -> OUT_OF_RANGE', () => {
    const tolerance = 10
    const justOutside: Branch[] = [{ ...single[0]!, radiusM: distance - tolerance - 1 }]

    expect(evaluateCheckIn(checkIn(here), justOutside)).toMatchObject({
      status: 'OUT_OF_RANGE',
      nearestBranchId: 'B-01',
    })
  })

  it('toleransi dibatasi 30 m: akurasi 90 tidak melebarkan geofence sejauh 90 m', () => {
    // Radius dipasang supaya titiknya berjarak 60 m di luar radius: lolos kalau
    // toleransi = akurasi penuh (90), tertolak kalau toleransi dibatasi 30.
    const capped: Branch[] = [{ ...single[0]!, radiusM: distance - 60 }]

    expect(evaluateCheckIn(checkIn({ ...here, accuracyM: 90 }), capped)).toMatchObject({
      status: 'OUT_OF_RANGE',
    })
    // Sanity check: 60 m memang akan lolos kalau toleransinya tidak dibatasi.
    expect(distance - (capped[0]!.radiusM + 90)).toBeLessThan(0)
  })
})

describe('ambang akurasi (aturan 5)', () => {
  it('akurasi tepat 100 masih diterima — aturannya "> 100", bukan ">= 100"', () => {
    expect(
      evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: 100 }), branches).status,
    ).toBe('VALID')
  })

  it('akurasi 101 ditolak', () => {
    expect(
      evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: 101 }), branches),
    ).toEqual({ status: 'REJECTED', reason: 'LOW_ACCURACY' })
  })

  it('akurasi NaN ditolak, bukan diloloskan diam-diam', () => {
    // `NaN > 100` bernilai false. Implementasi yang menyalin aturan secara harfiah
    // akan meloloskan ini, lalu memakai min(NaN, 30) = NaN sebagai toleransi dan
    // mengubah check-in yang sah menjadi OUT_OF_RANGE tanpa jejak.
    expect(
      evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: Number.NaN }), branches),
    ).toEqual({ status: 'REJECTED', reason: 'LOW_ACCURACY' })
  })

  it('akurasi negatif ditolak', () => {
    expect(
      evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: -5 }), branches),
    ).toEqual({ status: 'REJECTED', reason: 'LOW_ACCURACY' })
  })
})

describe('cabang tidak tersedia (aturan 6)', () => {
  it('array cabang kosong -> NO_BRANCH_ASSIGNED', () => {
    expect(evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: 12 }), [])).toEqual({
      status: 'REJECTED',
      reason: 'NO_BRANCH_ASSIGNED',
    })
  })

  it('semua cabang nonaktif -> NO_BRANCH_ASSIGNED', () => {
    const allInactive = branches.map((b) => ({ ...b, active: false }))

    expect(
      evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: 12 }), allInactive),
    ).toEqual({ status: 'REJECTED', reason: 'NO_BRANCH_ASSIGNED' })
  })

  it('cabang aktif tapi koordinatnya rusak -> OUT_OF_RANGE dengan nearest null', () => {
    const corrupt: Branch[] = [
      { id: 'B-X', name: 'Rusak', lat: Number.NaN, lng: 106.8, radiusM: 100, active: true },
    ]

    expect(evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: 12 }), corrupt)).toEqual(
      { status: 'OUT_OF_RANGE', nearestBranchId: null, distanceM: null },
    )
  })
})

describe('validasi koordinat dan urutan prioritas (aturan 7)', () => {
  it.each([
    ['lat NaN', Number.NaN, 106.8],
    ['lng NaN', -6.15, Number.NaN],
    ['lat > 90', 91, 106.8],
    ['lat < -90', -90.001, 106.8],
    ['lng > 180', -6.15, 180.5],
    ['lng < -180', -6.15, -180.5],
    ['lat Infinity', Number.POSITIVE_INFINITY, 106.8],
  ])('%s -> INVALID_COORDINATE', (_label, lat, lng) => {
    expect(evaluateCheckIn(checkIn({ lat, lng, accuracyM: 10 }), branches)).toEqual({
      status: 'REJECTED',
      reason: 'INVALID_COORDINATE',
    })
  })

  it('lat 0 dengan lng bukan 0 adalah tempat sungguhan, bukan koordinat rusak', () => {
    // Hanya (0, 0) yang ditolak. Khatulistiwa melewati Indonesia — menolak setiap
    // lat === 0 akan memblokir check-in yang sah di Pontianak.
    const equator: Branch[] = [
      { id: 'B-PNK', name: 'Pontianak', lat: 0, lng: 109.3, radiusM: 200, active: true },
    ]

    expect(evaluateCheckIn(checkIn({ lat: 0, lng: 109.3, accuracyM: 10 }), equator)).toMatchObject({
      status: 'VALID',
      branchId: 'B-PNK',
    })
  })

  it('koordinat menang atas akurasi ketika keduanya buruk', () => {
    expect(evaluateCheckIn(checkIn({ lat: 0, lng: 0, accuracyM: 500 }), branches)).toEqual({
      status: 'REJECTED',
      reason: 'INVALID_COORDINATE',
    })
  })

  it('koordinat menang atas ketiadaan cabang', () => {
    expect(evaluateCheckIn(checkIn({ lat: 0, lng: 0, accuracyM: 500 }), [])).toEqual({
      status: 'REJECTED',
      reason: 'INVALID_COORDINATE',
    })
  })

  it('akurasi menang atas ketiadaan cabang', () => {
    expect(evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: 500 }), [])).toEqual({
      status: 'REJECTED',
      reason: 'LOW_ACCURACY',
    })
  })
})

describe('perhitungan jarak (aturan 9)', () => {
  it('satu derajat lintang kira-kira 111,2 km', () => {
    // Nilai acuan independen untuk membuktikan haversine-nya tidak terbalik
    // radian/derajat: 1 derajat = R * pi/180 = 111.195 m.
    expect(haversineMeters(0, 0, 1, 0)).toBeCloseTo(111_194.9, 0)
  })

  it('jarak titik ke dirinya sendiri adalah nol, bukan NaN', () => {
    // Membuktikan clamp pada `a` bekerja: tanpa clamp, sqrt(1 - a) dengan a yang
    // sedikit melewati 1 akan menghasilkan NaN.
    expect(haversineMeters(-6.1569, 106.8449, -6.1569, 106.8449)).toBe(0)
  })

  it('menangani perlintasan antimeridian tanpa meledak jadi setengah keliling bumi', () => {
    const acrossDateLine: Branch[] = [
      { id: 'B-IDL', name: 'Garis Tanggal', lat: 0.5, lng: -179.9999, radiusM: 50, active: true },
    ]

    const result = evaluateCheckIn(
      checkIn({ lat: 0.5, lng: 179.9999, accuracyM: 5 }),
      acrossDateLine,
    )

    // Selisih bujurnya 359,9998 derajat, tapi jarak sesungguhnya ~22 m.
    expect(result).toMatchObject({ status: 'VALID', branchId: 'B-IDL' })
    expect(result.status === 'VALID' && result.distanceM).toBeLessThan(50)
  })

  it('distanceM selalu bilangan bulat', () => {
    const result = evaluateCheckIn(checkIn({ lat: -6.157, lng: 106.845, accuracyM: 12 }), branches)

    expect(result.status).toBe('VALID')
    expect(Number.isInteger(result.status === 'VALID' && result.distanceM)).toBe(true)
  })
})

describe('kebersihan fungsi', () => {
  it('tidak memutasi array atau objek cabang yang dikirim pemanggil', () => {
    // Fungsi ini melakukan sort; sort di JavaScript memutasi di tempat. Kalau
    // implementasinya menyortir array milik pemanggil, urutan cabang di layar
    // absensi bisa berubah sendiri setiap kali ada yang check-in.
    const input: Branch[] = branches.map((b) => ({ ...b }))
    const snapshot = JSON.stringify(input)

    evaluateCheckIn(checkIn({ lat: -6.3, lng: 106.8, accuracyM: 15 }), input)

    expect(JSON.stringify(input)).toBe(snapshot)
  })
})
