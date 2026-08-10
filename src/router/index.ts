import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * Rute ditulis eksplisit, bukan diturunkan dari struktur folder.
 *
 * Kehilangan file-based routing Nuxt ternyata bukan kerugian di sini: berkas ini
 * adalah satu tempat yang bisa dibaca untuk menjawab "halaman apa saja yang ada,
 * dan mana yang publik" — pertanyaan keamanan yang, dengan routing berbasis
 * folder, harus dijawab dengan menelusuri direktori.
 */
const routes = [
  { path: '/', redirect: '/cabinets' },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: 'Masuk' },
  },
  {
    path: '/cabinets',
    name: 'cabinets',
    component: () => import('@/views/CabinetListView.vue'),
    meta: { title: 'Cabinet' },
  },
  {
    path: '/cabinets/:code',
    name: 'cabinet-detail',
    component: () => import('@/views/CabinetDetailView.vue'),
    meta: { title: 'Detail cabinet' },
  },
  {
    path: '/geofence',
    name: 'geofence',
    component: () => import('@/views/GeofenceView.vue'),
    meta: { title: 'Geofence check-in' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true, title: 'Halaman tidak ditemukan' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

/**
 * Penjaga navigasi — daftar putih, bukan daftar hitam.
 *
 * Setiap rute butuh sesi kecuali yang menandai dirinya `meta.public`. Arah ini
 * disengaja: kalau yang didaftar adalah rute yang DILINDUNGI, rute baru yang
 * lupa didaftarkan akan terbuka untuk publik. Dengan daftar putih, rute yang
 * lupa ditandai hanya menjadi tidak bisa diakses — gagal ke arah yang aman, dan
 * langsung ketahuan.
 *
 * Ini kenyamanan navigasi, BUKAN kontrol keamanan. Penjaga ini berjalan di
 * browser dan bisa dilewati siapa pun dengan devtools. Yang benar-benar
 * menegakkan otorisasi adalah requireSession() di server.
 */
router.beforeEach(async (to: RouteLocationNormalized) => {
  const auth = useAuthStore()
  await auth.ensureLoaded()

  if (to.meta.public) {
    // Yang sudah masuk tidak perlu melihat halaman login lagi.
    if (to.name === 'login' && auth.isAuthenticated) {
      return safeReturnTo(to.query.returnTo) ?? '/cabinets'
    }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { returnTo: to.fullPath } }
  }

  return true
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · ECGO Ops` : 'ECGO Ops · Battery Swap Monitoring'
})

/**
 * `returnTo` datang dari URL, jadi ia input yang tidak dipercaya.
 *
 * Tanpa penyaringan ini, `/login?returnTo=https://phishing.example` membuat
 * aplikasi kita sendiri memantulkan pengguna ke situs penyerang tepat setelah
 * mereka memasukkan password — open redirect klasik, dan sangat meyakinkan
 * karena tautannya benar-benar berasal dari domain kita.
 *
 * Yang diterima hanya path relatif. `//evil.com` ikut ditolak: browser
 * memperlakukannya sebagai URL protocol-relative, bukan sebagai path.
 */
export function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}
