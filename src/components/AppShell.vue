<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'

const { theme, toggle } = useTheme()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const loggingOut = ref(false)

async function signOut() {
  loggingOut.value = true
  try {
    await auth.logout()
    // Navigasi dilakukan di sini, bukan di dalam store: store mengurus state,
    // router mengurus ke mana pengguna pergi. Mencampurnya membuat store tidak
    // bisa diuji tanpa router.
    await router.push('/login')
  } finally {
    loggingOut.value = false
  }
}

const nav = [
  { label: 'Cabinet', to: '/cabinets' },
  { label: 'Geofence', to: '/geofence' },
]

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>

<template>
  <!--
    Kolom flex, dengan <main> flex-1.

    Tanpa ini, kerangka halaman dirender sebelum komponen rute-nya tiba,
    sehingga <main> sesaat kosong dan footer duduk tepat di bawah header —
    lalu melompat ~660px begitu isinya datang. Terukur sebagai CLS 0,099,
    persis di ambang "perlu perbaikan". flex-1 membuat main selalu mengisi
    sisa tinggi layar, jadi footer tidak pernah berada di tengah halaman.
  -->
  <div class="flex min-h-dvh flex-col bg-bg text-text">
    <a href="#main" class="skip-link">Lompat ke konten utama</a>

    <header
      class="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70"
    >
      <div class="mx-auto flex h-16 max-w-[88rem] items-center gap-4 px-4 sm:px-6">
        <RouterLink to="/cabinets" class="flex shrink-0 items-center gap-2.5" aria-label="ECGO Ops — beranda">
          <img
            src="/brand/ecgo-logo-white.png"
            alt=""
            class="hidden h-7 w-auto dark:block"
            width="254"
            height="74"
          >
          <img src="/brand/ecgo-logo.png" alt="" class="h-7 w-auto dark:hidden" width="254" height="74">
          <span class="sr-only">ECGO</span>
          <span
            class="hidden rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase sm:inline"
          >
            Ops
          </span>
        </RouterLink>

        <nav aria-label="Navigasi utama" class="ml-2 flex items-center gap-1">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
            :class="isActive(item.to) ? 'bg-surface-2 text-text' : 'text-muted'"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <!-- Ruang lingkup ditampilkan terus-menerus, bukan disembunyikan di
               balik menu. Supervisor yang lupa bahwa ia hanya melihat dua cabang
               akan salah membaca setiap angka di layar ini sebagai angka armada. -->
          <div v-if="auth.user" class="hidden text-right leading-tight sm:block">
            <p class="text-sm font-medium">{{ auth.user.name }}</p>
            <p class="text-xs text-faint">{{ auth.scopeLabel }}</p>
          </div>

          <button
            v-if="auth.user"
            type="button"
            class="grid size-11 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
            :disabled="loggingOut"
            aria-label="Keluar"
            title="Keluar"
            @click="signOut"
          >
            <svg
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2" />
              <path d="M11 12h10m0 0-3-3m3 3-3 3" />
            </svg>
          </button>

          <button
            type="button"
            class="grid size-11 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-text"
            :aria-label="theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'"
            @click="toggle"
          >
            <svg
              v-if="theme === 'dark'"
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path
                stroke-linecap="round"
                d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4"
              />
            </svg>
            <svg
              v-else
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <main id="main" class="mx-auto w-full max-w-[88rem] flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <slot />
    </main>

    <footer class="mx-auto w-full max-w-[88rem] px-4 pt-6 pb-10 text-xs text-faint sm:px-6">
      Dashboard operasional internal · data ditampilkan dalam zona waktu WIB (Asia/Jakarta)
    </footer>
  </div>
</template>
