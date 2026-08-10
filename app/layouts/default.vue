<script setup lang="ts">
const { theme, toggle } = useTheme()
const route = useRoute()

const nav = [
  { label: 'Cabinet', to: '/cabinets' },
  { label: 'Geofence', to: '/geofence' },
]

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>

<template>
  <div class="min-h-dvh bg-bg text-text">
    <a href="#main" class="skip-link">Lompat ke konten utama</a>

    <header
      class="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70"
    >
      <div class="mx-auto flex h-16 max-w-[88rem] items-center gap-4 px-4 sm:px-6">
        <NuxtLink to="/cabinets" class="flex shrink-0 items-center gap-2.5" aria-label="ECGO Ops — beranda">
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
        </NuxtLink>

        <nav aria-label="Navigasi utama" class="ml-2 flex items-center gap-1">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
            :class="isActive(item.to) ? 'bg-surface-2 text-text' : 'text-muted'"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
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

    <main id="main" class="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 sm:py-8">
      <slot />
    </main>

    <footer class="mx-auto max-w-[88rem] px-4 pb-10 text-xs text-faint sm:px-6">
      Dashboard operasional internal · data ditampilkan dalam zona waktu WIB (Asia/Jakarta)
    </footer>
  </div>
</template>
