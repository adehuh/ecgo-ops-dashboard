<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { describeApiError } from '@/api/client'
import { safeReturnTo } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { loginSchema } from '@shared/contracts/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const pending = ref(false)
const failure = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

/**
 * Akun demo hanya ditampilkan saat pengembangan.
 *
 * `import.meta.env.DEV` diganti konstanta saat build, jadi Vite membuang blok
 * ini seluruhnya dari bundel produksi — bukan sekadar menyembunyikannya dengan
 * CSS. Kredensial yang "disembunyikan" di halaman login tetap ada di dalam
 * berkas JavaScript yang bisa diunduh siapa pun.
 */
const showDemoAccounts = import.meta.env.DEV

const DEMO_ACCOUNTS = [
  { email: 'admin@ecgo.test', password: 'ops-admin-2026', label: 'Admin · semua cabang' },
  { email: 'kemayoran@ecgo.test', password: 'ops-kemayoran-2026', label: 'Supervisor · Kemayoran, Sunter' },
  { email: 'bekasi@ecgo.test', password: 'ops-bekasi-2026', label: 'Supervisor · Bekasi, Depok, Tangerang' },
  { email: 'baru@ecgo.test', password: 'ops-baru-2026', label: 'Supervisor · belum punya cabang' },
]

function useDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
  email.value = account.email
  password.value = account.password
  failure.value = null
  fieldErrors.value = {}
}

/** Hanya path relatif; lihat catatan open redirect di src/router/index.ts. */
const returnTo = computed(() => safeReturnTo(route.query.returnTo) ?? '/cabinets')

async function submit() {
  failure.value = null
  fieldErrors.value = {}

  // Validasi client memakai skema yang SAMA dengan server. Ini demi umpan balik
  // cepat, bukan keamanan — server tetap memvalidasi ulang, karena form ini bisa
  // dilewati sepenuhnya dengan satu perintah curl.
  const parsed = loginSchema.safeParse({ email: email.value, password: password.value })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      fieldErrors.value[String(issue.path[0] ?? '')] = issue.message
    }
    return
  }

  pending.value = true
  try {
    await auth.login(parsed.data)
    await router.push(returnTo.value)
  } catch (error) {
    failure.value = describeApiError(error).message
    password.value = ''
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-text">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex flex-col items-center gap-3 text-center">
        <img src="/brand/ecgo-logo-white.png" alt="ECGO" class="hidden h-8 w-auto dark:block" width="254" height="74">
        <img src="/brand/ecgo-logo.png" alt="ECGO" class="h-8 w-auto dark:hidden" width="254" height="74">
        <div>
          <h1 class="text-lg font-extrabold tracking-tight">Dashboard Operasional</h1>
          <p class="mt-1 text-sm text-muted">Masuk untuk memantau cabinet battery swap.</p>
        </div>
      </div>

      <form class="card space-y-4 p-5" novalidate @submit.prevent="submit">
        <div
          v-if="failure"
          class="rounded-lg border border-danger/45 bg-danger/16 px-3.5 py-2.5 text-sm text-danger-tint"
          role="alert"
        >
          {{ failure }}
        </div>

        <label class="block space-y-1.5">
          <span class="text-xs font-medium tracking-wide text-muted uppercase">Email</span>
          <input
            v-model="email"
            type="email"
            name="email"
            autocomplete="username"
            required
            :aria-invalid="Boolean(fieldErrors.email)"
            class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm focus:border-accent-ink focus:outline-none"
            :class="fieldErrors.email ? 'border-danger' : ''"
          >
          <span v-if="fieldErrors.email" class="block text-xs text-danger">{{ fieldErrors.email }}</span>
        </label>

        <label class="block space-y-1.5">
          <span class="text-xs font-medium tracking-wide text-muted uppercase">Password</span>
          <input
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            :aria-invalid="Boolean(fieldErrors.password)"
            class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm focus:border-accent-ink focus:outline-none"
            :class="fieldErrors.password ? 'border-danger' : ''"
          >
          <span v-if="fieldErrors.password" class="block text-xs text-danger">{{ fieldErrors.password }}</span>
        </label>

        <button
          type="submit"
          :disabled="pending"
          class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast transition-opacity disabled:opacity-60"
        >
          {{ pending ? 'Memeriksa…' : 'Masuk' }}
        </button>
      </form>

      <section v-if="showDemoAccounts" class="mt-6">
        <p class="mb-2 text-xs font-medium tracking-wide text-faint uppercase">
          Akun demo · hanya di mode pengembangan
        </p>
        <ul class="space-y-1.5">
          <li v-for="account in DEMO_ACCOUNTS" :key="account.email">
            <button
              type="button"
              class="w-full rounded-lg border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2"
              @click="useDemo(account)"
            >
              <span class="font-mono text-text">{{ account.email }}</span>
              <span class="mt-0.5 block text-faint">{{ account.label }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
