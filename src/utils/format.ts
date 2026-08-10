/**
 * Pemformat untuk tampilan.
 *
 * Seluruh waktu disimpan UTC dan ditampilkan WIB. Zona waktunya ditulis
 * eksplisit di setiap pemanggilan Intl, tidak pernah mengandalkan zona waktu
 * mesin: dashboard ini dibuka dari laptop tim ops, dan laptop yang zonanya
 * salah setting tidak boleh menggeser jam kejadian operasional.
 */

const TZ = 'Asia/Jakarta'

const numberFormatter = new Intl.NumberFormat('id-ID')

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const fullFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  dateStyle: 'full',
  timeStyle: 'medium',
})

export const formatNumber = (value: number): string => numberFormatter.format(value)

export const formatTime = (iso: string): string => timeFormatter.format(new Date(iso))

export const formatDateTime = (iso: string): string => dateTimeFormatter.format(new Date(iso))

/** Tanggal saja, dengan tahun. Untuk hal seperti "terpasang sejak". */
export const formatDate = (iso: string): string => dateFormatter.format(new Date(iso))

/** Dipakai sebagai title/tooltip, jadi waktu persisnya selalu bisa diperiksa. */
export const formatFull = (iso: string): string => `${fullFormatter.format(new Date(iso))} WIB`

/**
 * Jarak waktu dalam bahasa manusia, dari `nowMs` yang dikirim pemanggil.
 *
 * "Sekarang" sengaja menjadi PARAMETER, bukan `Date.now()` di dalam fungsi.
 * Kalau fungsi ini membaca jamnya sendiri, HTML hasil SSR ("3 menit lalu") akan
 * berbeda dari render pertama di client beberapa ratus milidetik kemudian, dan
 * Vue akan melaporkan hydration mismatch. Pemanggil yang mengendalikan jam bisa
 * menahannya sampai komponen ter-mount. Lihat useNow().
 */
export function formatRelative(iso: string, nowMs: number): string {
  const diffMs = nowMs - new Date(iso).getTime()

  // Jam device bisa berjalan lebih lambat dari server; jangan tampilkan
  // "-2 menit lalu".
  if (diffMs < 0) return 'baru saja'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 45) return 'baru saja'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} mnt lalu`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`

  const months = Math.floor(days / 30)
  return `${months} bln lalu`
}

/** Ubah string jam-dinding WIB dari API ("2026-08-10T07:00:00") menjadi "07". */
export function wibHourLabel(hourStart: string): string {
  return hourStart.slice(11, 13)
}

export const formatDurationSeconds = (seconds: number): string =>
  seconds < 60 ? `${seconds} dtk` : `${Math.floor(seconds / 60)} mnt ${seconds % 60} dtk`
