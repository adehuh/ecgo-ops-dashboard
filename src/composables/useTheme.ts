import { ref } from 'vue'

/**
 * Tema terang/gelap, disimpan di cookie.
 *
 * Cookie, bukan localStorage — dan alasannya berubah setelah pindah dari Nuxt.
 * Dulu alasannya SSR (cookie ikut request dokumen, jadi server bisa merender
 * kelas yang benar). Sekarang alasannya skrip kecil di <head> index.html:
 * skrip itu berjalan sebelum paint pertama dan membaca cookie yang sama, jadi
 * tidak ada kilatan putih sebelum Vue sempat di-mount.
 *
 * localStorage sebenarnya juga bisa dibaca skrip itu. Cookie tetap dipilih agar
 * preferensinya ikut terkirim ke server — berguna nanti kalau ada laporan PDF
 * atau email yang perlu mengikuti tema pengguna.
 */
export type ThemeName = 'dark' | 'light'

const COOKIE = 'ecgo-theme'
const ONE_YEAR = 60 * 60 * 24 * 365

function readCookie(): ThemeName {
  const match = document.cookie.match(/(?:^|;\s*)ecgo-theme=(light|dark)/)
  // Default gelap: dashboard ini dipandangi berjam-jam, sering di ruang kontrol
  // yang redup.
  return match?.[1] === 'light' ? 'light' : 'dark'
}

const theme = ref<ThemeName>(typeof document === 'undefined' ? 'dark' : readCookie())

function apply(next: ThemeName) {
  theme.value = next
  document.documentElement.classList.toggle('dark', next === 'dark')
  // SameSite=Lax: preferensi tampilan, bukan rahasia, tapi tetap tidak perlu
  // ikut terkirim pada request lintas situs.
  document.cookie = `${COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

export function useTheme() {
  const toggle = () => apply(theme.value === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}
