import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '@/App.vue'
import { router } from '@/router'
import '@/assets/css/main.css'

const app = createApp(App).use(createPinia()).use(router)

// Tunggu navigasi pertama selesai sebelum mount.
//
// Penjaga rute memanggil /api/auth/me, jadi ia asinkron. Tanpa menunggu, Vue
// merender kerangka halaman dengan <RouterView> kosong lebih dulu, dan footer
// sempat duduk di bawah layar sebelum isinya datang dan mendorongnya keluar.
await router.isReady()
app.mount('#app')
