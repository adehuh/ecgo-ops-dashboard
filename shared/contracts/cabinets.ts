/**
 * Kontrak bersama antara API Express dan client Vue.
 *
 * Skema Zod di sini adalah SATU-SATUNYA definisi bentuk query. Server memakainya
 * untuk memvalidasi input yang masuk; client memakai tipe yang diturunkan
 * darinya untuk membangun URL. Kalau keduanya punya definisi sendiri-sendiri,
 * keduanya pasti akan menyimpang, dan yang jadi korban adalah URL yang
 * di-bookmark pengguna.
 */
import { z } from 'zod'

export const CABINET_STATUSES = ['ONLINE', 'OFFLINE', 'MAINTENANCE'] as const
export const SLOT_STATES = ['EMPTY', 'CHARGING', 'FULL', 'LOCKED', 'FAULT'] as const

/**
 * Nilai `status` yang diterima filter daftar.
 *
 * Tiga yang pertama adalah status yang DILAPORKAN perangkat dan tersimpan di
 * kolom `cabinets.status`. Dua terakhir bukan status — keduanya KONDISI yang
 * diturunkan, dan sengaja ikut di parameter yang sama supaya URL lama tetap
 * sah: `?status=ONLINE` yang sudah di-bookmark orang tidak boleh berubah arti
 * hanya karena filternya bertambah.
 *
 * Keduanya diselesaikan di server memakai predikat yang PERSIS sama dengan
 * ekspresi `CASE` pada sortir keparahan. Kalau keduanya menyimpang, memfilter
 * "heartbeat basi" akan mengembalikan baris yang kolom Kondisi-nya menuliskan
 * hal lain.
 */
export const CONDITION_FILTERS = [
  'ONLINE',
  'OFFLINE',
  'MAINTENANCE',
  'STALE_HEARTBEAT',
  'NO_READY_SLOTS',
] as const

export const SORT_KEYS = ['severity', 'swaps24h', 'code', 'lastHeartbeat'] as const
export const SORT_DIRECTIONS = ['asc', 'desc'] as const

/** Enum, bukan integer bebas — supaya tidak ada yang bisa meminta pageSize=1000000. */
export const PAGE_SIZES = [10, 25, 50] as const

export const cabinetStatusSchema = z.enum(CABINET_STATUSES)
export const slotStateSchema = z.enum(SLOT_STATES)
export const conditionFilterSchema = z.enum(CONDITION_FILTERS)

export type CabinetStatus = z.infer<typeof cabinetStatusSchema>
export type SlotState = z.infer<typeof slotStateSchema>
export type ConditionFilter = z.infer<typeof conditionFilterSchema>

/** Berapa bucket jam yang dikirim untuk sparkline. Satu hari penuh. */
export const HOURLY_BUCKETS = 24

/**
 * `?status=ONLINE&status=OFFLINE` sampai sebagai array, `?status=ONLINE` sebagai
 * string tunggal, dan `?status=` sebagai string kosong. Ketiganya dinormalkan di
 * sini supaya route handler tidak perlu memikirkannya.
 */
const asStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined
  const list = (Array.isArray(value) ? value : [value])
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0)
  return list.length > 0 ? list : undefined
}

export const cabinetListQuerySchema = z.object({
  /** Cocokkan kode cabinet, kode cabang, atau nama cabang. Dicari di server. */
  q: z.string().trim().max(100, 'Kata kunci maksimal 100 karakter').default(''),

  status: z.preprocess(asStringArray, z.array(conditionFilterSchema).max(5)).optional(),

  // Bawaan berubah dari `swaps24h` ke `severity` (§12.1 nomor 2): mengurutkan
  // menurut kesibukan mengangkat cabinet paling SEHAT ke puncak, sehingga yang
  // bermasalah justru tersebar ke halaman dua. `?sort=swaps24h` tetap sah, jadi
  // URL lama yang menyebutkannya secara eksplisit tidak berubah perilaku.
  sort: z.enum(SORT_KEYS).default('severity'),
  dir: z.enum(SORT_DIRECTIONS).default('desc'),

  // Batas atas halaman itu disengaja: OFFSET yang besar membuat Postgres tetap
  // menghitung lalu membuang tiap baris yang dilewati, jadi ?page=999999999
  // adalah cara murah membebani database dari luar.
  page: z.coerce.number().int().min(1).max(10_000).default(1),

  pageSize: z.coerce
    .number()
    .int()
    .refine((v) => (PAGE_SIZES as readonly number[]).includes(v), {
      message: `pageSize harus salah satu dari ${PAGE_SIZES.join(', ')}`,
    })
    .default(25),
})

export type CabinetListQuery = z.infer<typeof cabinetListQuerySchema>

export const cabinetCodeParamSchema = z
  .string()
  .trim()
  .min(1, 'Kode cabinet wajib diisi')
  .max(32, 'Kode cabinet maksimal 32 karakter')
  // Kode cabinet punya bentuk yang pasti (CB-KMY-01). Menyaringnya di sini
  // berarti tebakan asal ditolak sebagai 400 sebelum menyentuh database.
  .regex(/^[A-Za-z0-9-]+$/, 'Kode cabinet hanya boleh huruf, angka, dan tanda hubung')

/**
 * Perubahan status yang boleh dilakukan MANUSIA.
 *
 * Sengaja hanya ONLINE dan MAINTENANCE. OFFLINE tidak ada di daftar ini karena
 * OFFLINE adalah keadaan yang DILAPORKAN perangkat — cabinet tidak menjadi
 * kembali online karena seseorang mengeklik tombol, ia menjadi online karena
 * heartbeat-nya kembali. Membiarkan operator menulis OFFLINE lewat API berarti
 * membiarkan dashboard berbohong tentang perangkat kerasnya sendiri.
 * (Lihat README §7.5 — status dilaporkan perangkat, "basi" diturunkan.)
 */
export const cabinetStatusPatchSchema = z.object({
  status: z.enum(['ONLINE', 'MAINTENANCE'], {
    message: 'Status hanya boleh diubah ke ONLINE atau MAINTENANCE',
  }),
})

export type CabinetStatusPatch = z.infer<typeof cabinetStatusPatchSchema>
export type CabinetStatusPatchResponse = { data: { code: string; status: CabinetStatus } }

// ---------------------------------------------------------------------------
// Bentuk respons
// ---------------------------------------------------------------------------

export type CabinetListItem = {
  code: string
  branchCode: string
  branchName: string
  status: CabinetStatus
  slotsFilled: number
  slotsReady: number
  slotsTotal: number
  /**
   * Swap BERHASIL dalam 24 jam bergulir terakhir.
   *
   * Percobaan yang gagal sengaja tidak dihitung: ini metrik throughput, dan
   * cabinet yang menolak 40 rider tidak sedang "sibuk", ia sedang rusak.
   * Kegagalan muncul terpisah di halaman detail.
   */
  swaps24h: number
  /** ISO-8601, atau null kalau cabinet belum pernah mengirim heartbeat. */
  lastHeartbeatAt: string | null
  /** Heartbeat lebih tua dari ambang basi. Selalu false kalau belum pernah lapor. */
  isStale: boolean
  /**
   * State tiap slot fisik, SUDAH DIURUTKAN FULL → CHARGING → FAULT → LOCKED →
   * EMPTY — bukan menurut nomor slot.
   *
   * Diurutkan supaya bentuknya terbaca konsisten antar baris: mata memindai
   * kolom ini sebagai satu grafik batang, dan urutan fisik akan membuat tiap
   * baris terlihat acak. Nomor slot fisik tetap dipakai di halaman detail, di
   * mana teknisi memang butuh "nomor di layar = nomor di pintu" (§12.7).
   *
   * Panjangnya mengikuti `slotsTotal`, bukan 12 mati — ECGO bisa memasang
   * cabinet 8 atau 16 slot (README §7.10).
   */
  slotStates: SlotState[]
  /**
   * Swap BERHASIL per jam untuk 24 bucket terakhir, paling lama di indeks 0.
   *
   * Dipakai sparkline di kolom "Swap 24 jam". Dihitung di database bersama
   * agregat lain dalam query yang sama — satu CTE tambahan, nol round-trip
   * tambahan.
   */
  hourly: number[]
}

export type PageMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CabinetListResponse = { data: CabinetListItem[]; meta: PageMeta }

export type CabinetSlot = {
  slotNo: number
  state: SlotState
  /** null kalau tidak ada baterai di slot ini — bukan 0. */
  soc: number | null
  batteryId: string | null
  updatedAt: string
}

export type HourlyBucket = {
  /** Awal jam dalam WIB, ISO-8601 tanpa offset (mis. "2026-08-10T07:00:00"). */
  hourStart: string
  /** Swap BERHASIL pada jam ini. */
  success: number
  /**
   * Swap GAGAL pada jam ini.
   *
   * Sebelumnya grafik hanya menggambar yang berhasil (§7.2), jadi cabinet yang
   * menolak 40 rider terlihat SEPI — bukan rusak. Ditumpuk merah di atas batang
   * berhasil supaya kegagalan tidak lagi tak terlihat.
   */
  failed: number
  /**
   * Median swap berhasil pada jam yang SAMA selama 7 hari sebelumnya.
   *
   * Dua puluh empat batang sendirian tidak bisa menjawab "ini normal atau
   * tidak" — 12 swap pukul 3 pagi luar biasa ramai, 12 swap pukul 8 pagi
   * berarti ada yang rusak. Median (bukan rata-rata) supaya satu hari libur
   * atau satu hari mati total tidak menggeser garis dasarnya.
   */
  median7d: number
}

export type RecentSwap = {
  id: number
  slotNo: number
  /** Sudah disamarkan di server; referensi rider penuh tidak pernah dikirim ke browser. */
  riderRef: string
  occurredAt: string
  socIn: number
  socOut: number
  durationS: number
  status: 'SUCCESS' | 'FAILED'
}

export type CabinetDetail = {
  code: string
  branchCode: string
  branchName: string
  branchCity: string
  status: CabinetStatus
  slotCount: number
  lastHeartbeatAt: string | null
  isStale: boolean
  installedAt: string
  /** Swap berhasil, 24 jam bergulir. */
  swaps24h: number
  /** Swap gagal pada rentang yang sama — konteks yang hilang kalau hanya throughput yang ditampilkan. */
  failed24h: number
  /**
   * Rider UNIK yang dilayani dalam 24 jam.
   *
   * Bukan jumlah swap: satu rider yang menukar empat kali adalah satu orang yang
   * dilayani. Menghitungnya empat kali membuat cabinet sepi terlihat ramai.
   */
  riders24h: number
  slots: CabinetSlot[]
  hourly: HourlyBucket[]
  recentSwaps: RecentSwap[]
}

export type CabinetDetailResponse = { data: CabinetDetail }

export type FleetSummary = {
  total: number
  online: number
  offline: number
  maintenance: number
  /** Bukan ONLINE, atau ONLINE tapi basi, atau belum pernah melapor. */
  needsAttention: number
  /**
   * ONLINE tapi heartbeat-nya lewat ambang, ATAU belum pernah melapor sama
   * sekali. Dikirim eksplisit, tidak lagi disimpulkan client dari
   * `needsAttention - offline - maintenance`: begitu chip "0 slot siap" ikut
   * dihitung, pengurangan itu berhenti benar karena kondisinya bertumpang tindih.
   */
  stale: number
  /** Cabinet tanpa satu pun slot siap ditukar — rider datang, tidak bisa swap. */
  noReadySlots: number
  swaps24h: number
  failed24h: number
  /** Swap berhasil per jam, 24 bucket, paling lama di indeks 0. Untuk sparkline armada. */
  hourly: number[]
}

export type FleetSummaryResponse = { data: FleetSummary }

// Kontrak error pindah ke `./errors.ts` — bentuknya berlaku untuk seluruh API,
// bukan hanya domain cabinet.
export type { ApiErrorBody, ApiErrorCode } from './errors.js'
