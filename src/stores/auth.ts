import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiFetch } from '@/api/client'
import type {
  LoginInput,
  LoginResponse,
  MeResponse,
  SessionUser,
} from '@shared/contracts/auth'

/**
 * Sesi pengguna.
 *
 * Pinia, bukan ref di scope modul: store memberi satu tempat yang jelas untuk
 * state lintas komponen, bisa diinspeksi lewat devtools, dan tidak menyebar
 * sebagai import melingkar antar composable.
 *
 * Perhatikan yang TIDAK disimpan di sini: token sesi. Token ada di cookie
 * HttpOnly dan tidak pernah bisa dibaca JavaScript — jadi tidak ada di store,
 * tidak ada di localStorage, dan tidak ikut terbawa kalau ada XSS.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null)

  // Dibedakan dari `user === null`: "belum pernah dicek" bukan "sudah dicek dan
  // ternyata tidak ada". Tanpa ini, penjaga rute akan memanggil /me pada setiap
  // navigasi.
  const loaded = ref(false)

  async function fetchMe(): Promise<SessionUser | null> {
    try {
      const response = await apiFetch<MeResponse>('/api/auth/me')
      user.value = response.data
    } catch {
      // Sampai di sini hanya kalau permintaannya benar-benar gagal (server mati,
      // jaringan putus). "Belum masuk" bukan error — ia datang sebagai 200
      // dengan data null.
      user.value = null
    } finally {
      loaded.value = true
    }
    return user.value
  }

  /** Ambil sesi sekali saja, lalu pakai hasilnya. */
  async function ensureLoaded(): Promise<SessionUser | null> {
    return loaded.value ? user.value : fetchMe()
  }

  async function login(credentials: LoginInput): Promise<SessionUser> {
    const response = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
    user.value = response.data
    loaded.value = true
    return response.data
  }

  async function logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      // Bersihkan state lokal apa pun yang terjadi di jaringan. Layar yang masih
      // menampilkan nama pengguna setelah tombol keluar ditekan lebih buruk
      // daripada permintaan yang gagal diam-diam.
      user.value = null
      loaded.value = true
    }
  }

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  /** Ringkasan ruang lingkup untuk header. */
  const scopeLabel = computed(() => {
    if (!user.value) return ''
    if (user.value.role === 'ADMIN') return 'Semua cabang'

    const names = user.value.branchNames
    if (names.length === 0) return 'Belum ada cabang'
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
  })

  return { user, loaded, isAuthenticated, isAdmin, scopeLabel, fetchMe, ensureLoaded, login, logout }
})
