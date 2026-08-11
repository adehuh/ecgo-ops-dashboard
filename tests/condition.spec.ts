import { describe, expect, it } from 'vitest'
import {
  deriveCondition,
  formatAge,
  type ConditionInput,
} from '../src/utils/condition'

/**
 * Turunan frasa kondisi (§12.1 nomor 3).
 *
 * Yang diuji di sini bukan tampilannya, melainkan URUTAN PEMERIKSAANNYA. Urutan
 * itu adalah spesifikasi: ia harus sama persis dengan ekspresi `CASE` di
 * `ORDER BY` pada query daftar. Kalau keduanya menyimpang, tabel akan terurut
 * menurut satu aturan sambil menuliskan aturan lain di kolom Kondisi, dan yang
 * terlihat salah adalah datanya — bukan kodenya.
 */

/** Jam acuan tetap. "Sekarang" adalah parameter, jadi tidak ada waktu global yang perlu dipalsukan. */
const NOW = Date.parse('2026-08-11T12:00:00+07:00')

const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString()
const hoursAgo = (n: number) => new Date(NOW - n * 3_600_000).toISOString()

/** Cabinet sehat sebagai titik awal; tiap test hanya mengubah yang relevan. */
function cabinet(partial: Partial<ConditionInput> = {}): ConditionInput {
  return {
    status: 'ONLINE',
    slotsReady: 7,
    lastHeartbeatAt: minutesAgo(2),
    isStale: false,
    ...partial,
  }
}

describe('deriveCondition — peringkat keparahan', () => {
  it('OFFLINE adalah kritis (3) dan menyebutkan lamanya', () => {
    const c = deriveCondition(cabinet({ status: 'OFFLINE', lastHeartbeatAt: hoursAgo(5) }), NOW)

    expect(c.severity).toBe(3)
    expect(c.tone).toBe('critical')
    expect(c.phrase).toBe('Offline 5 jam')
  })

  it('0 slot siap adalah kritis (3) walau cabinet mengaku ONLINE', () => {
    const c = deriveCondition(cabinet({ slotsReady: 0 }), NOW)

    expect(c.severity).toBe(3)
    expect(c.phrase).toBe('0 slot siap ditukar')
  })

  it('belum pernah lapor adalah peringatan (2), bukan "56 tahun lalu"', () => {
    const c = deriveCondition(cabinet({ lastHeartbeatAt: null }), NOW)

    expect(c.severity).toBe(2)
    expect(c.phrase).toBe('Belum pernah lapor')
  })

  it('heartbeat basi adalah peringatan (2) dan menyebutkan umurnya', () => {
    const c = deriveCondition(cabinet({ isStale: true, lastHeartbeatAt: minutesAgo(38) }), NOW)

    expect(c.severity).toBe(2)
    expect(c.tone).toBe('warning')
    expect(c.phrase).toBe('Heartbeat basi 38 mnt')
  })

  it('MAINTENANCE adalah info (1)', () => {
    const c = deriveCondition(cabinet({ status: 'MAINTENANCE' }), NOW)

    expect(c.severity).toBe(1)
    expect(c.tone).toBe('info')
  })

  it('sisanya sehat (0) dan tidak menyarankan tindakan apa pun', () => {
    const c = deriveCondition(cabinet(), NOW)

    expect(c.severity).toBe(0)
    expect(c.phrase).toBe('Online · sehat')
    expect(c.action).toBeNull()
  })
})

describe('deriveCondition — urutan pemeriksaan saat beberapa syarat bertemu', () => {
  it('OFFLINE menang atas 0 slot siap', () => {
    const c = deriveCondition(cabinet({ status: 'OFFLINE', slotsReady: 0 }), NOW)

    expect(c.phrase).toMatch(/^Offline/)
  })

  it('OFFLINE menang atas heartbeat basi', () => {
    const c = deriveCondition(
      cabinet({ status: 'OFFLINE', isStale: true, lastHeartbeatAt: minutesAgo(40) }),
      NOW,
    )

    expect(c.phrase).toBe('Offline 40 mnt')
  })

  it('0 slot siap menang atas MAINTENANCE — sama seperti ekspresi CASE di server', () => {
    // Sengaja: cabinet yang sedang dirawat dan kosong tetap dilaporkan kritis.
    // Client tidak boleh memutuskan sendiri untuk berbeda dari urutan server.
    const c = deriveCondition(cabinet({ status: 'MAINTENANCE', slotsReady: 0 }), NOW)

    expect(c.severity).toBe(3)
    expect(c.phrase).toBe('0 slot siap ditukar')
  })

  it('0 slot siap menang atas heartbeat basi', () => {
    const c = deriveCondition(cabinet({ slotsReady: 0, isStale: true }), NOW)

    expect(c.phrase).toBe('0 slot siap ditukar')
  })

  it('MAINTENANCE yang heartbeat-nya menua tetap "Perawatan", bukan "Heartbeat basi"', () => {
    // Ekspresi CASE di server memberi syarat `status = 'ONLINE'` pada cabang
    // basi. Tanpa syarat itu, client melaporkan keparahan 2 sementara server
    // mengurutkan sebagai 1, dan tabel jadi terurut beda dari yang ia tulis.
    const c = deriveCondition(
      cabinet({ status: 'MAINTENANCE', isStale: true, lastHeartbeatAt: minutesAgo(45) }),
      NOW,
    )

    expect(c.severity).toBe(1)
    expect(c.phrase).toBe('Perawatan')
  })

  it('OFFLINE yang basi tetap dilaporkan sebagai Offline', () => {
    const c = deriveCondition(
      cabinet({ status: 'OFFLINE', isStale: true, lastHeartbeatAt: minutesAgo(90) }),
      NOW,
    )

    expect(c.severity).toBe(3)
    expect(c.phrase).toBe('Offline 1 jam')
  })

  it('belum pernah lapor menang atas MAINTENANCE', () => {
    const c = deriveCondition(cabinet({ status: 'MAINTENANCE', lastHeartbeatAt: null }), NOW)

    expect(c.severity).toBe(2)
    expect(c.phrase).toBe('Belum pernah lapor')
  })

  it('OFFLINE yang belum pernah lapor tidak mengarang durasi', () => {
    const c = deriveCondition(cabinet({ status: 'OFFLINE', lastHeartbeatAt: null }), NOW)

    expect(c.phrase).toBe('Offline')
  })
})

describe('deriveCondition — bentuk penanda (WCAG 1.4.1)', () => {
  it('tiap nada memakai bentuk yang berbeda, bukan hanya warna', () => {
    const shapes = [
      deriveCondition(cabinet(), NOW),
      deriveCondition(cabinet({ status: 'MAINTENANCE' }), NOW),
      deriveCondition(cabinet({ isStale: true }), NOW),
      deriveCondition(cabinet({ status: 'OFFLINE' }), NOW),
    ].map((c) => c.marker)

    expect(shapes).toEqual(['circle', 'square', 'triangle', 'ring'])
    expect(new Set(shapes).size).toBe(4)
  })
})

describe('formatAge', () => {
  it('menit di bawah satu jam', () => {
    expect(formatAge(minutesAgo(38), NOW)).toBe('38 mnt')
  })

  it('jam di bawah satu hari', () => {
    expect(formatAge(hoursAgo(5), NOW)).toBe('5 jam')
  })

  it('hari di atas itu', () => {
    expect(formatAge(hoursAgo(50), NOW)).toBe('2 hari')
  })

  it('di bawah semenit tidak ditulis "0 mnt" — itu terbaca seperti gagal hitung', () => {
    expect(formatAge(new Date(NOW - 30_000).toISOString(), NOW)).toBe('<1 mnt')
  })

  it('tidak pernah negatif walau jam device tertinggal dari server', () => {
    expect(formatAge(new Date(NOW + 120_000).toISOString(), NOW)).toBe('<1 mnt')
  })

  it('tidak memakai akhiran "lalu" — frasanya sudah membawa kata kerjanya sendiri', () => {
    expect(formatAge(minutesAgo(10), NOW)).not.toMatch(/lalu/)
  })
})
