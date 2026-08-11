/**
 * Kondisi cabinet sebagai SATU frasa, diturunkan dari field yang sudah dikirim API.
 *
 * Ini perubahan §12.1 nomor 3. Sebelumnya masalah harus disimpulkan dari tiga
 * kolom sekaligus — status `ONLINE`, heartbeat "38 mnt lalu", slot "11/12 · 5
 * siap" — dan mata harus mendekode tiga hal untuk menjawab satu pertanyaan.
 * Sekarang satu kolom menuliskannya: "Heartbeat basi 38 mnt".
 *
 * Fungsi di berkas ini MURNI dan "sekarang" adalah parameter, bukan `Date.now()`
 * di dalam. Alasannya sama dengan `formatRelative` di `format.ts`: fungsi yang
 * membaca jamnya sendiri tidak bisa diuji tanpa memalsukan waktu global.
 *
 * Peringkat keparahan di sini WAJIB sama persis dengan ekspresi `CASE` di
 * `ORDER BY` pada query daftar (lihat handoff "API changes" nomor 1). Kalau
 * keduanya menyimpang, tabel akan terurut menurut satu aturan sambil menuliskan
 * aturan yang lain di kolom Kondisi — dan yang terlihat salah adalah datanya,
 * bukan kodenya.
 */
import type { CabinetStatus } from '@shared/contracts/cabinets'

/** 3 kritis · 2 peringatan · 1 info · 0 sehat. Dipakai untuk sortir dan warna. */
export type ConditionSeverity = 0 | 1 | 2 | 3

export type ConditionTone = 'healthy' | 'info' | 'warning' | 'critical'

/**
 * Bentuk penanda, bukan hanya warna (WCAG 1.4.1).
 *
 * Kosakata bentuknya diwarisi apa adanya dari `StatusBadge.vue` yang sudah ada,
 * jadi lingkaran tetap berarti sehat di seluruh aplikasi.
 */
export type ConditionMarker = 'circle' | 'ring' | 'triangle' | 'square'

export type Condition = {
  severity: ConditionSeverity
  tone: ConditionTone
  marker: ConditionMarker
  /** Frasa siap tampil, mis. "Offline 5 jam". */
  phrase: string
  /** Langkah berikutnya yang disarankan; null untuk baris sehat. */
  action: string | null
}

/** Field minimum yang dibutuhkan — sengaja bukan `CabinetListItem` utuh supaya
 *  fungsi ini juga bisa dipakai halaman detail, yang bentuk barisnya berbeda. */
export type ConditionInput = {
  status: CabinetStatus
  slotsReady: number
  lastHeartbeatAt: string | null
  /** Diturunkan SERVER dari ambang `ECGO_STALE_MINUTES`. Jangan hitung ulang di client. */
  isStale: boolean
}

const TONE_BY_SEVERITY: Record<ConditionSeverity, ConditionTone> = {
  3: 'critical',
  2: 'warning',
  1: 'info',
  0: 'healthy',
}

const MARKER_BY_TONE: Record<ConditionTone, ConditionMarker> = {
  critical: 'ring',
  warning: 'triangle',
  info: 'square',
  healthy: 'circle',
}

/**
 * Umur ringkas TANPA akhiran "lalu" — "38 mnt", bukan "38 mnt lalu".
 *
 * Frasa kondisi sudah membawa kata kerjanya sendiri ("Heartbeat basi 38 mnt"),
 * jadi "lalu" di ujungnya membuat kalimatnya salah.
 */
export function formatAge(iso: string, nowMs: number): string {
  const diffMs = nowMs - new Date(iso).getTime()

  // Jam device bisa berjalan lebih lambat dari server — jangan tampilkan "-2 mnt".
  const minutes = Math.max(0, Math.floor(diffMs / 60_000))
  // "0 mnt" terbaca seperti angka yang gagal dihitung, bukan seperti "baru saja".
  // Ini terlihat di banner error: "terakhir berhasil dimuat 0 mnt lalu".
  if (minutes === 0) return '<1 mnt'
  if (minutes < 60) return `${minutes} mnt`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam`

  const days = Math.floor(hours / 24)
  return `${days} hari`
}

/**
 * Urutan pemeriksaannya adalah spesifikasinya, jadi jangan diacak.
 *
 * Catatan yang sengaja dibiarkan seperti di handoff: `slotsReady === 0`
 * berperingkat DI ATAS `MAINTENANCE`. Artinya cabinet yang sedang dirawat dan
 * kebetulan kosong akan tampil kritis, bukan info. Itu memang bunyi ekspresi
 * `CASE`-nya, dan client tidak boleh menyimpang sendiri dari server.
 */
export function deriveCondition(cabinet: ConditionInput, nowMs: number): Condition {
  const { status, slotsReady, lastHeartbeatAt, isStale } = cabinet

  if (status === 'OFFLINE') {
    // Heartbeat terakhir adalah perkiraan terbaik untuk "offline sejak kapan".
    // Kalau belum pernah lapor, tidak ada angka yang jujur untuk ditulis.
    const age = lastHeartbeatAt ? ` ${formatAge(lastHeartbeatAt, nowMs)}` : ''
    return build(3, `Offline${age}`, 'Kirim teknisi')
  }

  if (slotsReady === 0) {
    return build(3, '0 slot siap ditukar', 'Isi ulang baterai')
  }

  if (lastHeartbeatAt === null) {
    return build(2, 'Belum pernah lapor', 'Cek pemasangan')
  }

  // Syarat `status === 'ONLINE'` itu WAJIB, bukan hiasan. Ekspresi `CASE` di
  // server berbunyi `WHEN status = 'ONLINE' AND last_heartbeat_at < ...`, jadi
  // menghilangkannya di sini membuat cabinet MAINTENANCE yang heartbeat-nya
  // menua dilaporkan "Heartbeat basi" (keparahan 2) oleh client sementara server
  // mengurutkannya sebagai "Perawatan" (keparahan 1). Ditemukan test Cypress,
  // bukan oleh mata.
  //
  // `isStale` juga selalu false kalau belum pernah lapor (README §7.4), jadi
  // cabang ini tidak pernah bentrok dengan yang di atas.
  if (status === 'ONLINE' && isStale) {
    return build(2, `Heartbeat basi ${formatAge(lastHeartbeatAt, nowMs)}`, 'Cek jaringan')
  }

  if (status === 'MAINTENANCE') {
    // Handoff menulis "Perawatan · {n} slot rusak", tapi jumlah slot FAULT belum
    // ada di respons daftar — ia baru ikut bersama `slotStates` di langkah 6.
    // Menulis angka yang belum ada akan jadi kebohongan, jadi angkanya menyusul.
    return build(1, 'Perawatan', 'Jadwal perawatan')
  }

  return build(0, 'Online · sehat', null)
}

function build(severity: ConditionSeverity, phrase: string, action: string | null): Condition {
  const tone = TONE_BY_SEVERITY[severity]
  return { severity, tone, marker: MARKER_BY_TONE[tone], phrase, action }
}
