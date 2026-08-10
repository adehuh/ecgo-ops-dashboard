/**
 * Bagian B1 — Multi-Branch Geofence Check-In
 *
 * Menentukan apakah sebuah check-in absensi valid, dan cabang mana yang dipakai,
 * ketika seorang karyawan terdaftar di lebih dari satu cabang.
 *
 * Tanpa library eksternal untuk perhitungan jarak (syarat soal).
 *
 * Empat titik di soal yang bisa ditafsirkan lebih dari satu cara; keputusan saya
 * dan alasannya ada di komentar §A–§D di bawah supaya bisa dibantah saat review.
 */

export type Branch = {
  id: string
  name: string
  lat: number
  lng: number
  radiusM: number // radius geofence dalam meter
  active: boolean
}

export type CheckIn = {
  userId: string
  lat: number
  lng: number
  accuracyM: number // akurasi GPS dari device, dalam meter
  at: string // ISO-8601 dengan offset
}

export type RejectReason = 'NO_BRANCH_ASSIGNED' | 'LOW_ACCURACY' | 'INVALID_COORDINATE'

export type Result =
  | { status: 'VALID'; branchId: string; branchName: string; distanceM: number }
  | { status: 'OUT_OF_RANGE'; nearestBranchId: string | null; distanceM: number | null }
  | { status: 'REJECTED'; reason: RejectReason }

/** Radius bumi rata-rata (IUGG mean radius), ditetapkan oleh soal. */
const EARTH_RADIUS_M = 6_371_008.8

/** Akurasi GPS di atas nilai ini tidak bisa dipercaya sama sekali (aturan 5). */
const MAX_ACCEPTABLE_ACCURACY_M = 100

/** Batas atas toleransi yang boleh disumbang oleh akurasi GPS (aturan 4). */
const MAX_ACCURACY_TOLERANCE_M = 30

const toRadians = (deg: number): number => (deg * Math.PI) / 180

/**
 * Jarak lingkaran besar antara dua titik, dalam meter, dengan formula haversine.
 *
 * Haversine menganggap bumi bola sempurna, jadi meleset sekitar 0,3% dibanding
 * elipsoid (Vincenty). Untuk geofence berjari-jari 120–200 m, 0,3% adalah
 * kurang dari satu meter — jauh di bawah galat GPS ponsel itu sendiri, yang
 * puluhan meter. Jadi presisi tambahan Vincenty tidak membeli apa pun di sini.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)
  const deltaPhi = toRadians(lat2 - lat1)
  const deltaLambda = toRadians(lng2 - lng1)

  const sinHalfPhi = Math.sin(deltaPhi / 2)
  const sinHalfLambda = Math.sin(deltaLambda / 2)

  const a =
    sinHalfPhi * sinHalfPhi + Math.cos(phi1) * Math.cos(phi2) * sinHalfLambda * sinHalfLambda

  // Pembulatan floating point bisa mendorong `a` sedikit ke luar [0,1] untuk titik
  // yang berimpit atau antipodal; Math.sqrt dari nilai negatif akan jadi NaN.
  const aClamped = Math.min(1, Math.max(0, a))

  const c = 2 * Math.atan2(Math.sqrt(aClamped), Math.sqrt(1 - aClamped))
  return EARTH_RADIUS_M * c
}

/**
 * Koordinat dianggap tidak valid bila bukan angka berhingga, di luar rentang
 * geografis, atau persis (0, 0).
 *
 * (0, 0) — "Null Island" di Teluk Guinea — hampir tidak pernah merupakan posisi
 * sungguhan. Itu adalah nilai default yang dikirim device saat GPS gagal atau
 * saat field koordinat tidak pernah diisi, jadi soal benar memperlakukannya
 * sebagai input rusak, bukan sebagai lokasi.
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90) return false
  if (lng < -180 || lng > 180) return false
  if (lat === 0 && lng === 0) return false
  return true
}

export function evaluateCheckIn(checkIn: CheckIn, branches: Branch[]): Result {
  // Aturan 7 menetapkan urutan prioritas secara eksplisit:
  // koordinat -> akurasi -> cabang. Urutan ini penting: kasus uji 4 mengirim
  // koordinat (0,0) dengan akurasi bagus dan mengharapkan INVALID_COORDINATE,
  // jadi pengecekan koordinat harus mendahului yang lain.

  // --- 1. Koordinat ---------------------------------------------------------
  if (!isValidCoordinate(checkIn.lat, checkIn.lng)) {
    return { status: 'REJECTED', reason: 'INVALID_COORDINATE' }
  }

  // --- 2. Akurasi (aturan 5: sebelum perhitungan jarak apa pun) -------------
  //
  // §A. Soal hanya menyebut `accuracyM > 100`. Saya perlakukan juga NaN,
  // Infinity, dan nilai negatif sebagai LOW_ACCURACY. Alasannya: `NaN > 100`
  // bernilai false, jadi membaca aturan itu secara harfiah akan MELOLOSKAN
  // pembacaan akurasi yang rusak dan kemudian memakai `min(NaN, 30)` = NaN
  // sebagai toleransi, yang membuat setiap perbandingan jarak menjadi false dan
  // diam-diam mengubah check-in valid menjadi OUT_OF_RANGE. Akurasi negatif juga
  // secara fisik mustahil. Menolak lebih aman daripada menghitung dengan sampah.
  const { accuracyM } = checkIn
  if (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > MAX_ACCEPTABLE_ACCURACY_M) {
    return { status: 'REJECTED', reason: 'LOW_ACCURACY' }
  }

  // --- 3. Cabang ------------------------------------------------------------
  const activeBranches = branches.filter((b) => b.active)
  if (activeBranches.length === 0) {
    return { status: 'REJECTED', reason: 'NO_BRANCH_ASSIGNED' }
  }

  // §B. Cabang yang aktif tapi koordinatnya rusak dibuang dari kandidat, bukan
  // dibiarkan menghasilkan NaN. Kalau setelah pembuangan tidak ada kandidat
  // tersisa, hasilnya OUT_OF_RANGE dengan nearestBranchId null — bukan
  // NO_BRANCH_ASSIGNED, karena karyawannya memang punya cabang, datanyalah yang
  // rusak. Bentuk tipe Result sendiri mendukung tafsiran ini: `nearestBranchId`
  // dan `distanceM` sengaja dibuat nullable, dan inilah satu-satunya keadaan
  // yang bisa menghasilkan null itu.
  const candidates = activeBranches.filter((b) => isValidCoordinate(b.lat, b.lng))
  if (candidates.length === 0) {
    return { status: 'OUT_OF_RANGE', nearestBranchId: null, distanceM: null }
  }

  // §C. Aturan 9 mendefinisikan distanceM sebagai meter bulat, dan aturan 4 serta
  // aturan 2 dinyatakan dalam `distanceM`. Jadi saya membulatkan SEKALI di sini
  // dan memakai bilangan bulat itu untuk pencocokan, pengurutan, dan output.
  //
  // Ini juga yang membuat aturan 3 punya arti praktis. Seri pada nilai mentah
  // memang mungkin — dua cabang yang simetris sempurna terhadap titik check-in
  // menghasilkan float yang identik bit demi bit — tapi itu kebetulan geometris
  // yang langka. Yang sering terjadi di lapangan adalah dua cabang berjarak
  // 110,59 m dan 111,30 m: berbeda kalau dibandingkan mentah, sama-sama 111 m
  // begitu dibulatkan. Membandingkan pada meter bulat membuat kedua kasus itu
  // jatuh ke aturan tie-break yang sama, jadi hasil yang dilaporkan ke pengguna
  // ("111 m") tidak pernah bertentangan dengan cabang yang dipilih.
  const measured = candidates.map((branch) => ({
    branch,
    distanceM: Math.round(haversineMeters(checkIn.lat, checkIn.lng, branch.lat, branch.lng)),
  }))

  // Aturan 4: toleransi GPS dibatasi 30 m, supaya pembacaan yang buruk tapi masih
  // di bawah ambang 100 m tidak bisa melebarkan geofence sesuka hati.
  const tolerance = Math.min(accuracyM, MAX_ACCURACY_TOLERANCE_M)

  // Aturan 2 dan 3: paling dekat menang; kalau seri, id terkecil secara
  // leksikografis. Satu comparator dipakai untuk kedua keperluan (cabang yang
  // cocok, dan cabang terdekat saat tidak ada yang cocok) supaya keduanya tidak
  // bisa berbeda aturan.
  const byDistanceThenId = (
    a: { branch: Branch; distanceM: number },
    b: { branch: Branch; distanceM: number },
  ): number => a.distanceM - b.distanceM || (a.branch.id < b.branch.id ? -1 : a.branch.id > b.branch.id ? 1 : 0)

  // §D. `localeCompare` sengaja TIDAK dipakai. Soal meminta urutan leksikografis,
  // sedangkan localeCompare mengurutkan menurut locale — hasilnya bisa berbeda
  // antar mesin dan versi ICU, persis lawan dari determinisme yang diminta
  // aturan 3. Perbandingan `<`/`>` membandingkan unit kode UTF-16 dan stabil di
  // mana pun kode ini berjalan.

  const matching = measured
    .filter((m) => m.distanceM <= m.branch.radiusM + tolerance)
    .sort(byDistanceThenId)

  const best = matching[0]
  if (best) {
    return {
      status: 'VALID',
      branchId: best.branch.id,
      branchName: best.branch.name,
      distanceM: best.distanceM,
    }
  }

  // Aturan 8: tidak ada yang cocok — laporkan cabang aktif terdekat supaya UI
  // bisa memberi tahu karyawan seberapa jauh dia dan dari mana.
  const nearest = [...measured].sort(byDistanceThenId)[0]!
  return {
    status: 'OUT_OF_RANGE',
    nearestBranchId: nearest.branch.id,
    distanceM: nearest.distanceM,
  }
}
