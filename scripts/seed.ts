/**
 * Seed data untuk Battery Swap Monitoring Dashboard.
 *
 *   npm run seed
 *
 * Menghasilkan (target soal: minimal 50 / 600 / 20.000):
 *   12 cabang · 50 cabinet · 600 slot · 22.000 transaksi swap selama 30 hari
 *
 * Dua sifat yang saya anggap wajib untuk data seed:
 *
 * 1. IDEMPOTEN. Diawali TRUNCATE ... RESTART IDENTITY dan seluruhnya berada di
 *    dalam satu transaksi. Menjalankan `npm run seed` dua kali menghasilkan
 *    database yang sama, bukan data ganda. Seed yang menggandakan diri akan
 *    diam-diam merusak angka "swap 24 jam" yang sedang saya bangun.
 *
 * 2. DETERMINISTIK PADA BENTUKNYA. PRNG-nya mulberry32 dengan seed tetap, bukan
 *    Math.random(), sehingga bug yang muncul di dataset ini bisa direproduksi
 *    persis. Stempel waktunya tetap relatif terhadap `now()` — memang harus,
 *    karena "24 jam terakhir" tidak punya arti pada tanggal yang dibekukan.
 *
 * Distribusinya sengaja dibuat tidak rata. Data seed yang seragam membuat semua
 * bug menarik tidak terlihat: dengan distribusi rata, sortir apa pun terlihat
 * benar, grafik per jam terlihat datar dan wajar, dan tidak ada satu pun cabang
 * kode "stale"/"belum pernah melapor" yang teruji.
 */
import { hashPassword } from '../shared/auth/password'
import { createClient, explainConnectionError } from './_client'

// ---------------------------------------------------------------------------
// PRNG deterministik
// ---------------------------------------------------------------------------

/** mulberry32 — kecil, cepat, cukup baik untuk data uji, dan bisa diulang. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function random(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260810)

const randInt = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1))
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!
const chance = (probability: number): boolean => rand() < probability

/** Ambil satu indeks dari daftar bobot, sebanding dengan bobotnya. */
function weightedIndex(weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let threshold = rand() * total
  for (let i = 0; i < weights.length; i += 1) {
    threshold -= weights[i]!
    if (threshold <= 0) return i
  }
  return weights.length - 1
}

// ---------------------------------------------------------------------------
// Konstanta domain
// ---------------------------------------------------------------------------

const TOTAL_CABINETS = 50
const SLOTS_PER_CABINET = 12
const TOTAL_SWAPS = 22_000
const HISTORY_DAYS = 30

/**
 * Bentuk permintaan swap per jam dalam WIB. Dua puncak: berangkat kerja
 * (06.00–09.00) dan pulang plus jam sibuk ojol malam (16.00–20.00). Angkanya
 * bobot relatif, bukan jumlah absolut.
 *
 * Ini yang membuat grafik 24 jam di halaman detail punya bentuk yang bisa
 * dinilai benar atau salah — dengan angka acak rata, grafik salah pun terlihat
 * masuk akal.
 */
const HOURLY_DEMAND_WIB = [
  1, 1, 1, 2, 4, 9, 18, 26, 22, 14, 10, 11, 13, 11, 10, 12, 18, 24, 26, 20, 14, 9, 5, 2,
] as const

const BRANCHES = [
  { code: 'KMY', name: 'Kemayoran', city: 'Jakarta Pusat', lat: -6.1569, lng: 106.8449, radiusM: 150 },
  { code: 'SNT', name: 'Sunter', city: 'Jakarta Utara', lat: -6.142, lng: 106.872, radiusM: 200 },
  { code: 'CKG', name: 'Cakung', city: 'Jakarta Timur', lat: -6.185, lng: 106.945, radiusM: 120 },
  { code: 'TBS', name: 'Tebet Barat', city: 'Jakarta Selatan', lat: -6.2265, lng: 106.8506, radiusM: 150 },
  { code: 'KBJ', name: 'Kebayoran Baru', city: 'Jakarta Selatan', lat: -6.2444, lng: 106.7991, radiusM: 180 },
  { code: 'GRG', name: 'Grogol', city: 'Jakarta Barat', lat: -6.1667, lng: 106.7897, radiusM: 150 },
  { code: 'PLG', name: 'Palmerah', city: 'Jakarta Barat', lat: -6.2044, lng: 106.7938, radiusM: 140 },
  { code: 'PSM', name: 'Pasar Minggu', city: 'Jakarta Selatan', lat: -6.2842, lng: 106.8442, radiusM: 160 },
  { code: 'JTN', name: 'Jatinegara', city: 'Jakarta Timur', lat: -6.2151, lng: 106.8705, radiusM: 150 },
  { code: 'BKS', name: 'Bekasi Kota', city: 'Bekasi', lat: -6.2383, lng: 106.9756, radiusM: 220 },
  { code: 'DPK', name: 'Depok Margonda', city: 'Depok', lat: -6.3862, lng: 106.8318, radiusM: 200 },
  { code: 'TNG', name: 'Tangerang Alam Sutera', city: 'Tangerang', lat: -6.2261, lng: 106.6534, radiusM: 220 },
] as const

/**
 * Akun demo. Password sengaja ditulis terbuka di sini karena ini data seed untuk
 * pengembangan lokal — dan tertulis jelas di README bahwa akun-akun ini tidak
 * boleh ikut ke lingkungan mana pun selain laptop.
 *
 * Empat akun ini dipilih supaya seluruh cabang keputusan otorisasi punya wakil:
 *   - ADMIN            : allowedBranchIds = null  → melihat semua
 *   - dua SUPERVISOR   : ruang lingkup berbeda    → membuktikan pemisahannya nyata
 *   - SUPERVISOR kosong: allowedBranchIds = []    → membuktikan gagalnya tertutup
 *
 * Yang terakhir itu yang paling penting. Akun tanpa cabang adalah keadaan yang
 * pasti terjadi di produksi (karyawan baru dibuatkan akun sebelum ditugaskan),
 * dan kalau array kosong disalahartikan sebagai "tanpa batas", akun itulah yang
 * akan melihat seluruh armada.
 */
const USERS = [
  {
    email: 'admin@ecgo.test',
    name: 'Admin Operasional',
    password: 'ops-admin-2026',
    role: 'ADMIN' as const,
    branches: [] as string[],
  },
  {
    email: 'kemayoran@ecgo.test',
    name: 'Supervisor Kemayoran',
    password: 'ops-kemayoran-2026',
    role: 'SUPERVISOR' as const,
    branches: ['KMY', 'SNT'],
  },
  {
    email: 'bekasi@ecgo.test',
    name: 'Supervisor Bekasi',
    password: 'ops-bekasi-2026',
    role: 'SUPERVISOR' as const,
    branches: ['BKS', 'DPK', 'TNG'],
  },
  {
    email: 'baru@ecgo.test',
    name: 'Supervisor Baru (belum ditugaskan)',
    password: 'ops-baru-2026',
    role: 'SUPERVISOR' as const,
    branches: [],
  },
]

const CABINET_STATUSES = ['ONLINE', 'OFFLINE', 'MAINTENANCE'] as const
type CabinetStatus = (typeof CABINET_STATUSES)[number]

type SlotState = 'EMPTY' | 'CHARGING' | 'FULL' | 'LOCKED' | 'FAULT'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// ---------------------------------------------------------------------------
// Pembangkit
// ---------------------------------------------------------------------------

type CabinetSeed = {
  code: string
  branchIndex: number
  status: CabinetStatus
  slotCount: number
  lastHeartbeatAt: Date | null
  installedAt: Date
  /** Bobot relatif seberapa sibuk cabinet ini. */
  popularity: number
}

/** Acak urutan di tempat dengan Fisher-Yates, memakai PRNG deterministik kita. */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}

/**
 * Kuota status dialokasikan tepat, lalu diacak — bukan diundi per cabinet.
 *
 * Versi pertama saya mengundi tiap cabinet (76/14/10) dan seed dengan seed tetap
 * itu menghasilkan NOL cabinet MAINTENANCE. Peluangnya cuma ~0,5%, tapi karena
 * PRNG-nya deterministik, hasil itu terjadi setiap kali dijalankan — filter
 * MAINTENANCE selalu kosong, dan cabang MAINTENANCE di pickSlotState jadi kode
 * mati yang tidak pernah teruji.
 *
 * Data seed harus MENJAMIN tiap keadaan yang bisa difilter di UI benar-benar ada.
 * Itu terlalu penting untuk diserahkan pada undian.
 */
function buildStatusPlan(total: number): CabinetStatus[] {
  const online = Math.round(total * 0.76)
  const offline = Math.round(total * 0.14)
  const maintenance = total - online - offline

  return shuffle([
    ...Array<CabinetStatus>(online).fill('ONLINE'),
    ...Array<CabinetStatus>(offline).fill('OFFLINE'),
    ...Array<CabinetStatus>(maintenance).fill('MAINTENANCE'),
  ])
}

function buildCabinets(now: number): CabinetSeed[] {
  const statusPlan = buildStatusPlan(TOTAL_CABINETS)

  // Heartbeat mencakup empat keadaan, karena keempatnya dirender berbeda dan
  // tiga di antaranya tempat bug biasa bersembunyi:
  //   a. ONLINE segar       — beberapa menit lalu
  //   b. ONLINE tapi basi   — mengaku ONLINE, terakhir terlihat 30–180 menit lalu
  //   c. OFFLINE            — terakhir terlihat berjam-jam lalu
  //   d. belum pernah lapor — NULL, baru dipasang
  //
  // (b) dan (d) dipilih dari cabinet yang statusnya ONLINE, dan dijamin ada,
  // dengan alasan yang sama seperti kuota status di atas.
  const onlineIndexes = statusPlan
    .map((status, index) => (status === 'ONLINE' ? index : -1))
    .filter((index) => index >= 0)

  const neverReported = new Set(onlineIndexes.slice(0, 2))
  const staleOnline = new Set(onlineIndexes.slice(2, 5))

  const perBranchCounter = new Map<number, number>()

  return statusPlan.map((status, i): CabinetSeed => {
    const branchIndex = i % BRANCHES.length
    const branch = BRANCHES[branchIndex]!
    const n = (perBranchCounter.get(branchIndex) ?? 0) + 1
    perBranchCounter.set(branchIndex, n)

    // Beberapa cabinet adalah hub yang jauh lebih sibuk daripada sisanya. Tanpa
    // ini, kolom sortir "swap 24 jam" tidak punya urutan yang berarti untuk
    // dibuktikan benar.
    const popularity = chance(0.16) ? 3 + rand() * 3 : 0.35 + rand() * 1.4

    return {
      code: `CB-${branch.code}-${String(n).padStart(2, '0')}`,
      branchIndex,
      status,
      slotCount: SLOTS_PER_CABINET,
      lastHeartbeatAt: buildHeartbeat(status, now, {
        neverReported: neverReported.has(i),
        stale: staleOnline.has(i),
      }),
      installedAt: new Date(now - randInt(40, 900) * DAY),
      popularity,
    }
  })
}

function buildHeartbeat(
  status: CabinetStatus,
  now: number,
  flags: { neverReported: boolean; stale: boolean },
): Date | null {
  if (flags.neverReported) return null
  if (status === 'OFFLINE') return new Date(now - randInt(70, 2_880) * MINUTE)
  if (status === 'MAINTENANCE') return new Date(now - randInt(2, 240) * MINUTE)
  if (flags.stale) return new Date(now - randInt(30, 180) * MINUTE)
  return new Date(now - randInt(0, 6) * MINUTE)
}

type SlotSeed = {
  slotNo: number
  state: SlotState
  batteryId: string | null
  soc: number | null
  updatedAt: Date
}

function buildSlots(cabinet: CabinetSeed, now: number): SlotSeed[] {
  // Cabinet OFFLINE membekukan state terakhir yang diketahui; itulah kenapa
  // updated_at-nya mengikuti heartbeat terakhir dan bukan sekarang. UI memakai
  // selisih ini untuk menandai panelnya basi.
  const frozenAt = cabinet.lastHeartbeatAt?.getTime() ?? now - 3 * DAY

  return Array.from({ length: cabinet.slotCount }, (_, i): SlotSeed => {
    const slotNo = i + 1
    const state = pickSlotState(cabinet.status)

    // Invarian yang juga dijaga CHECK constraint di database: SOC ada jika dan
    // hanya jika ada baterainya.
    const hasBattery = state !== 'EMPTY' && !(state === 'FAULT' && chance(0.4))

    return {
      slotNo,
      state,
      batteryId: hasBattery ? `BAT-${String(randInt(10_000, 99_999))}` : null,
      soc: hasBattery ? socForState(state) : null,
      updatedAt: new Date(
        cabinet.status === 'OFFLINE' ? frozenAt : now - randInt(0, 90) * MINUTE,
      ),
    }
  })
}

function pickSlotState(status: CabinetStatus): SlotState {
  if (status === 'MAINTENANCE') {
    // Sedang diservis: kebanyakan slot dikunci, dan justru di sinilah FAULT
    // menumpuk.
    return pick(['LOCKED', 'LOCKED', 'LOCKED', 'FAULT', 'FAULT', 'EMPTY', 'FULL'] as const)
  }
  if (status === 'OFFLINE') {
    return pick(['FULL', 'CHARGING', 'EMPTY', 'EMPTY', 'LOCKED', 'FAULT'] as const)
  }
  return pick([
    'FULL', 'FULL', 'FULL', 'FULL', 'FULL',
    'CHARGING', 'CHARGING', 'CHARGING',
    'EMPTY', 'EMPTY',
    'LOCKED',
    'FAULT',
  ] as const)
}

function socForState(state: SlotState): number {
  switch (state) {
    case 'FULL':
      return randInt(96, 100)
    case 'CHARGING':
      return randInt(18, 94)
    case 'LOCKED':
      return randInt(60, 100)
    case 'FAULT':
      // Baterai rusak melaporkan apa saja, termasuk nol — dan nol di sini
      // artinya benar-benar habis, bukan "slot kosong".
      return randInt(0, 100)
    default:
      return randInt(0, 100)
  }
}

type SwapSeed = {
  cabinetIndex: number
  slotNo: number
  riderRef: string
  occurredAt: Date
  socIn: number
  socOut: number
  durationS: number
  status: 'SUCCESS' | 'FAILED'
}

function buildSwaps(cabinets: CabinetSeed[], now: number): SwapSeed[] {
  // Bobot per cabinet: popularitas dasar, tapi cabinet yang sedang MAINTENANCE
  // atau OFFLINE hampir tidak melayani swap. Ini yang membuat halaman daftar
  // punya korelasi yang bisa diperiksa mata: cabinet OFFLINE seharusnya duduk di
  // dasar urutan "swap 24 jam".
  const cabinetWeights = cabinets.map((c) => {
    if (c.status === 'MAINTENANCE') return c.popularity * 0.05
    if (c.status === 'OFFLINE') return c.popularity * 0.25
    return c.popularity
  })

  // Hari yang lebih baru sedikit lebih berat: armada bertumbuh selama 30 hari.
  const dayWeights = Array.from({ length: HISTORY_DAYS }, (_, d) => 0.7 + (d / HISTORY_DAYS) * 0.6)

  const swaps: SwapSeed[] = []

  // Sebagian jam hari ini belum terjadi, jadi kandidat yang jatuh di masa depan
  // harus DIULANG, bukan dibuang. Membuangnya membuat TOTAL_SWAPS berbohong:
  // meminta 22.000 lalu menyimpan 21.638, dengan selisih yang berubah-ubah
  // menurut jam berapa seed dijalankan.
  const maxAttempts = TOTAL_SWAPS * 4
  let attempts = 0

  while (swaps.length < TOTAL_SWAPS && attempts < maxAttempts) {
    attempts += 1

    const cabinetIndex = weightedIndex(cabinetWeights)
    const cabinet = cabinets[cabinetIndex]!

    // daysAgo 0 = hari ini
    const daysAgo = HISTORY_DAYS - 1 - weightedIndex(dayWeights)
    const hour = weightedIndex(HOURLY_DEMAND_WIB)

    const occurredAt = wibTimestamp(now, daysAgo, hour)
    if (occurredAt.getTime() > now) continue

    const failed = chance(0.031)
    const socIn = randInt(3, 38)

    swaps.push({
      cabinetIndex,
      slotNo: randInt(1, cabinet.slotCount),
      riderRef: `RD-${String(randInt(100_000, 999_999))}`,
      occurredAt,
      socIn,
      // Swap gagal: rider pergi membawa baterainya sendiri, jadi SOC keluar =
      // SOC masuk. Baris seperti ini yang membongkar asumsi "socOut selalu > socIn".
      socOut: failed ? socIn : randInt(92, 100),
      durationS: failed ? randInt(5, 40) : randInt(38, 165),
      status: failed ? 'FAILED' : 'SUCCESS',
    })
  }

  return swaps
}

/**
 * Bangun stempel waktu UTC untuk jam WIB tertentu, `daysAgo` hari lalu.
 *
 * Bucket grafik dihitung dalam WIB, jadi datanya juga harus dibangkitkan dalam
 * WIB. Kalau puncaknya dibangkitkan pada jam UTC, "jam sibuk pagi" akan muncul
 * jam 2 siang di layar dan bentuk grafiknya jadi omong kosong.
 */
function wibTimestamp(now: number, daysAgo: number, hourWib: number): Date {
  const WIB_OFFSET_MS = 7 * HOUR
  const wibNow = now + WIB_OFFSET_MS
  const wibMidnight = Math.floor(wibNow / DAY) * DAY - daysAgo * DAY
  const wibMoment = wibMidnight + hourWib * HOUR + randInt(0, 59) * MINUTE + randInt(0, 59) * 1000
  return new Date(wibMoment - WIB_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// Penulisan ke database
// ---------------------------------------------------------------------------

/** Kirim baris per batch. 22.000 baris dalam satu statement membuat query berukuran megabyte. */
async function insertInChunks<T>(
  rows: T[],
  size: number,
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await write(rows.slice(i, i + size))
  }
}

async function main() {
  const startedAt = Date.now()
  const sql = createClient()

  try {
    const now = Date.now()

    const cabinets = buildCabinets(now)
    const swaps = buildSwaps(cabinets, now)

    await sql.begin(async (tx) => {
      // Idempoten: satu-satunya cara `npm run seed` bisa dijalankan berkali-kali
      // tanpa menggandakan riwayat swap dan merusak agregat 24 jam.
      // users dan sessions ikut disebut eksplisit. CASCADE dari branches memang
      // sudah mengosongkan user_branches, tapi itu akan meninggalkan pengguna
      // tanpa satu pun cabang — yaitu setiap supervisor mendadak tidak bisa
      // melihat apa-apa setelah seed ulang. Lebih baik dibangun ulang seluruhnya.
      await tx`
        TRUNCATE swap_transactions, slots, cabinets, branches, user_branches, sessions, users
        RESTART IDENTITY CASCADE
      `

      const branchRows = await tx<{ id: string }[]>`
        INSERT INTO branches ${tx(
          BRANCHES.map((b) => ({
            code: b.code,
            name: b.name,
            city: b.city,
            lat: b.lat,
            lng: b.lng,
            radius_m: b.radiusM,
            active: true,
          })),
          'code',
          'name',
          'city',
          'lat',
          'lng',
          'radius_m',
          'active',
        )}
        RETURNING id
      `
      const branchIds = branchRows.map((r) => Number(r.id))
      const branchIdByCode = new Map(BRANCHES.map((b, i) => [b.code, branchIds[i]!]))

      // Hashing dilakukan paralel: scrypt N=2^16 butuh ~100 ms per password, dan
      // berurutan akan menambah setengah detik ke tiap kali seed dijalankan.
      const userRows = await tx<{ id: string }[]>`
        INSERT INTO users ${tx(
          await Promise.all(
            USERS.map(async (u) => ({
              email: u.email,
              name: u.name,
              password_hash: await hashPassword(u.password),
              role: u.role,
              active: true,
            })),
          ),
          'email',
          'name',
          'password_hash',
          'role',
          'active',
        )}
        RETURNING id
      `
      const userIds = userRows.map((r) => Number(r.id))

      const scopeRows = USERS.flatMap((u, i) =>
        u.branches.map((code) => ({
          user_id: userIds[i]!,
          branch_id: branchIdByCode.get(code)!,
        })),
      )

      if (scopeRows.length > 0) {
        await tx`INSERT INTO user_branches ${tx(scopeRows, 'user_id', 'branch_id')}`
      }

      const cabinetRows = await tx<{ id: string }[]>`
        INSERT INTO cabinets ${tx(
          cabinets.map((c) => ({
            code: c.code,
            branch_id: branchIds[c.branchIndex]!,
            status: c.status,
            slot_count: c.slotCount,
            last_heartbeat_at: c.lastHeartbeatAt,
            installed_at: c.installedAt,
          })),
          'code',
          'branch_id',
          'status',
          'slot_count',
          'last_heartbeat_at',
          'installed_at',
        )}
        RETURNING id
      `
      const cabinetIds = cabinetRows.map((r) => Number(r.id))

      const slotRows = cabinets.flatMap((cabinet, index) =>
        buildSlots(cabinet, now).map((slot) => ({
          cabinet_id: cabinetIds[index]!,
          slot_no: slot.slotNo,
          state: slot.state,
          battery_id: slot.batteryId,
          soc: slot.soc,
          updated_at: slot.updatedAt,
        })),
      )

      await insertInChunks(slotRows, 1_000, (chunk) =>
        tx`INSERT INTO slots ${tx(chunk, 'cabinet_id', 'slot_no', 'state', 'battery_id', 'soc', 'updated_at')}`,
      )

      const swapRows = swaps.map((s) => ({
        cabinet_id: cabinetIds[s.cabinetIndex]!,
        slot_no: s.slotNo,
        rider_ref: s.riderRef,
        occurred_at: s.occurredAt,
        soc_in: s.socIn,
        soc_out: s.socOut,
        duration_s: s.durationS,
        status: s.status,
      }))

      await insertInChunks(swapRows, 2_000, (chunk) =>
        tx`INSERT INTO swap_transactions ${tx(chunk, 'cabinet_id', 'slot_no', 'rider_ref', 'occurred_at', 'soc_in', 'soc_out', 'duration_s', 'status')}`,
      )

      // Planner butuh statistik yang segar tepat setelah pemuatan massal —
      // tanpa ini, query pertama bisa memilih rencana yang buruk sampai autovacuum
      // sempat berjalan.
      await tx`ANALYZE branches, cabinets, slots, swap_transactions`
    })

    const [summary] = await sql<
      { branches: string; cabinets: string; slots: string; swaps: string; swaps_24h: string }[]
    >`
      SELECT
        (SELECT count(*) FROM branches)                             AS branches,
        (SELECT count(*) FROM cabinets)                             AS cabinets,
        (SELECT count(*) FROM slots)                                AS slots,
        (SELECT count(*) FROM swap_transactions)                    AS swaps,
        (SELECT count(*) FROM swap_transactions
          WHERE occurred_at >= now() - interval '24 hours')          AS swaps_24h
    `

    console.log(
      [
        '',
        'Seed selesai.',
        `  cabang            ${summary!.branches}`,
        `  cabinet           ${summary!.cabinets}`,
        `  slot              ${summary!.slots}`,
        `  transaksi swap    ${summary!.swaps}  (${HISTORY_DAYS} hari)`,
        `  di 24 jam terakhir ${summary!.swaps_24h}`,
        `  pengguna          ${USERS.length}`,
        `  waktu             ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
        '',
        'Akun demo (hanya untuk lokal):',
        ...USERS.map(
          (u) =>
            `  ${u.email.padEnd(22)} ${u.password.padEnd(22)} ${u.role}` +
            (u.role === 'ADMIN'
              ? '  (semua cabang)'
              : u.branches.length
                ? `  (${u.branches.join(', ')})`
                : '  (belum punya cabang — sengaja)'),
        ),
        '',
        // Heartbeat disemai sebagai stempel waktu absolut, jadi ia menua sementara
        // "sekarang" terus berjalan. Tanpa catatan ini, orang yang membuka dashboard
        // 15 menit kemudian akan melihat 50 cabinet kuning dan mengira ada yang rusak.
        'Catatan: heartbeat disemai relatif terhadap saat ini, jadi setelah ~10 menit',
        'cabinet ONLINE akan mulai tampak "basi". Jalankan `npm run simulate` di',
        'terminal lain agar armadanya hidup, atau cukup jalankan `npm run seed` lagi.',
        '',
      ].join('\n'),
    )
  } catch (error) {
    console.error(`\nSeed gagal:\n${explainConnectionError(error)}`)
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 5 })
  }
}

void main()
