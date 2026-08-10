import { z } from 'zod'

export const USER_ROLES = ['ADMIN', 'SUPERVISOR'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email wajib diisi')
    .max(254, 'Email terlalu panjang')
    .email('Format email tidak valid'),

  // Batas atas ada bukan demi kerumitan password, melainkan demi menahan biaya:
  // KDF-nya memory-hard, dan password 1 MB adalah cara murah membuat server
  // menghabiskan memori dari luar.
  password: z.string().min(1, 'Password wajib diisi').max(200, 'Password terlalu panjang'),
})

export type LoginInput = z.infer<typeof loginSchema>

export type SessionUser = {
  id: number
  email: string
  name: string
  role: UserRole
  /**
   * Nama cabang yang boleh dilihat, untuk ditampilkan di UI.
   * Kosong untuk ADMIN — yang berarti "semua", bukan "tidak ada".
   */
  branchNames: string[]
  /** Kapan sesi ini berakhir, supaya UI bisa memberi tahu sebelum tiba-tiba keluar. */
  expiresAt: string
}

/** `data: null` berarti tidak ada yang masuk — itu jawaban, bukan error. */
export type MeResponse = { data: SessionUser | null }
export type LoginResponse = { data: SessionUser }
export type LogoutResponse = { data: { ok: true } }
