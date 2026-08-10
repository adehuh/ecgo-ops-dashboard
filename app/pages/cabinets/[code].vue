<script setup lang="ts">
import type { CabinetDetailResponse } from '~~/shared/contracts/cabinets'

const route = useRoute()
const code = computed(() => String(route.params.code ?? ''))

const { data, status, error, refresh } = await useFetch<CabinetDetailResponse>(
  () => `/api/cabinets/${code.value}`,
)

const cabinet = computed(() => data.value?.data ?? null)
const failure = computed(() => (error.value ? describeApiError(error.value) : null))
const isFirstLoad = computed(() => status.value === 'pending' && !data.value)

useHead({ title: () => (cabinet.value ? `${cabinet.value.code} · ECGO Ops` : 'Cabinet · ECGO Ops') })

/**
 * Kapan data slot tidak boleh dipercaya sebagai keadaan saat ini.
 *
 * Ditampilkan, bukan disembunyikan — teknisi butuh kondisi terakhir yang
 * diketahui sebelum cabinet putus. Tapi ditampilkan dengan jujur: mengirim rider
 * ke cabinet yang "FULL" tiga jam lalu adalah perjalanan sia-sia.
 */
const staleness = computed(() => {
  const c = cabinet.value
  if (!c) return null

  if (c.lastHeartbeatAt === null) {
    return {
      title: 'Cabinet ini belum pernah mengirim heartbeat',
      body: 'Kemungkinan baru dipasang dan belum terhubung. State slot di bawah adalah nilai awal, bukan pembacaan dari perangkat.',
    }
  }
  if (c.status === 'OFFLINE') {
    return {
      title: 'Cabinet sedang offline',
      body: 'State slot di bawah adalah kondisi terakhir yang diketahui sebelum koneksi terputus. Kondisi sebenarnya sekarang bisa berbeda.',
    }
  }
  if (c.isStale) {
    return {
      title: 'Cabinet melaporkan diri online, tetapi sudah lama tidak terdengar',
      body: 'Statusnya masih ONLINE sementara heartbeat-nya tertinggal. Perlakukan pembacaan di bawah sebagai data lama sampai heartbeat berikutnya masuk.',
    }
  }
  return null
})

const attempts = computed(() => (cabinet.value ? cabinet.value.swaps24h + cabinet.value.failed24h : 0))

const stats = computed(() => {
  const c = cabinet.value
  if (!c) return []
  return [
    { label: 'Swap berhasil 24 jam', value: formatNumber(c.swaps24h), hint: 'rolling 24 jam' },
    {
      label: 'Gagal 24 jam',
      value: formatNumber(c.failed24h),
      hint: attempts.value ? `${((c.failed24h / attempts.value) * 100).toFixed(1)}% dari percobaan` : 'belum ada percobaan',
      tone: c.failed24h > 0 ? 'warn' : undefined,
    },
    {
      label: 'Slot siap ditukar',
      value: `${c.slots.filter((s) => s.state === 'FULL').length}/${c.slotCount}`,
      hint: `${c.slots.filter((s) => s.batteryId !== null).length} slot terisi`,
    },
    { label: 'Terpasang sejak', value: formatDate(c.installedAt), hint: c.branchCity },
  ]
})

const SWAP_STATUS = { SUCCESS: 'Berhasil', FAILED: 'Gagal' } as const
</script>

<template>
  <div class="space-y-5">
    <NuxtLink
      to="/cabinets"
      class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
    >
      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7" />
      </svg>
      Semua cabinet
    </NuxtLink>

    <!-- ERROR: 404 dibedakan dari kegagalan lain. "Tidak ditemukan" adalah
         jalan buntu yang butuh navigasi; kegagalan jaringan butuh tombol ulangi. -->
    <div v-if="failure" class="card">
      <StateMessage
        v-if="failure.code === 'NOT_FOUND'"
        title="Cabinet tidak ditemukan"
        :description="`Tidak ada cabinet dengan kode ${code}. Mungkin sudah dinonaktifkan, atau kodenya salah ketik.`"
        action-label="Kembali ke daftar cabinet"
        @action="navigateTo('/cabinets')"
      />
      <StateMessage
        v-else
        tone="danger"
        title="Gagal memuat detail cabinet"
        :description="failure.message"
        action-label="Coba lagi"
        @action="refresh()"
      />
    </div>

    <!-- LOADING -->
    <div v-else-if="isFirstLoad" class="space-y-5" aria-hidden="true">
      <div class="h-9 w-56 rounded-lg shimmer" />
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-24 rounded-card shimmer" />
      </div>
      <div class="h-72 rounded-card shimmer" />
      <div class="h-64 rounded-card shimmer" />
    </div>

    <template v-else-if="cabinet">
      <!-- Judul -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="font-mono text-2xl font-extrabold tracking-tight">{{ cabinet.code }}</h1>
          <p class="mt-1 text-sm text-muted">
            {{ cabinet.branchName }}
            <span class="text-faint">· {{ cabinet.branchCity }} · {{ cabinet.branchCode }}</span>
          </p>
        </div>

        <div class="flex flex-col items-end gap-1.5">
          <StatusBadge
            :status="cabinet.status"
            :is-stale="cabinet.isStale"
            :never-reported="cabinet.lastHeartbeatAt === null"
          />
          <p class="text-xs text-muted">
            Heartbeat <TimeAgo :iso="cabinet.lastHeartbeatAt" />
          </p>
        </div>
      </div>

      <div
        v-if="staleness"
        class="flex gap-3 rounded-card border border-warn/30 bg-warn/10 px-4 py-3"
        role="status"
      >
        <svg
          class="mt-0.5 size-5 shrink-0 text-warn"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path stroke-linecap="round" d="M12 7.5v5M12 16h.01" />
        </svg>
        <div>
          <p class="text-sm font-medium text-warn">{{ staleness.title }}</p>
          <p class="mt-0.5 text-sm text-muted">{{ staleness.body }}</p>
        </div>
      </div>

      <!-- Statistik -->
      <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="stat in stats" :key="stat.label" class="card px-4 py-3.5">
          <dt class="text-xs font-medium tracking-wide text-muted uppercase">{{ stat.label }}</dt>
          <dd
            class="mt-1 text-2xl font-extrabold tabular-nums"
            :class="stat.tone === 'warn' ? 'text-warn' : 'text-text'"
          >
            {{ stat.value }}
          </dd>
          <dd class="mt-0.5 text-xs text-faint">{{ stat.hint }}</dd>
        </div>
      </dl>

      <!-- Slot -->
      <section class="card p-4 sm:p-5">
        <div class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="text-sm font-medium">Slot baterai</h2>
          <p class="text-xs text-muted">
            Diperbarui <TimeAgo :iso="cabinet.slots[0]?.updatedAt ?? null" />
          </p>
        </div>

        <SlotGrid
          :slots="cabinet.slots"
          :stale="Boolean(staleness)"
        />
      </section>

      <!-- Grafik -->
      <section class="card p-4 sm:p-5">
        <SwapChart :hourly="cabinet.hourly" />
      </section>

      <!-- Transaksi terakhir -->
      <section class="card overflow-hidden">
        <h2 class="border-b border-border px-4 py-3.5 text-sm font-medium">
          20 swap terakhir
        </h2>

        <StateMessage
          v-if="cabinet.recentSwaps.length === 0"
          title="Belum ada transaksi swap"
          description="Cabinet ini belum pernah melayani penukaran baterai."
        />

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-border text-xs tracking-wide text-muted uppercase">
              <tr>
                <th scope="col" class="px-4 py-2.5 font-medium">Waktu</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Slot</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Rider</th>
                <th scope="col" class="px-4 py-2.5 font-medium">SOC</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Durasi</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="swap in cabinet.recentSwaps" :key="swap.id" class="hover:bg-surface-2">
                <td class="px-4 py-2.5 whitespace-nowrap" :title="formatFull(swap.occurredAt)">
                  {{ formatDateTime(swap.occurredAt) }}
                </td>
                <td class="px-4 py-2.5 font-mono text-xs">#{{ String(swap.slotNo).padStart(2, '0') }}</td>
                <td class="px-4 py-2.5 font-mono text-xs text-muted">{{ swap.riderRef }}</td>
                <td class="px-4 py-2.5 tabular-nums">
                  <span class="text-muted">{{ swap.socIn }}%</span>
                  <span class="mx-1 text-faint">→</span>
                  <span class="font-medium">{{ swap.socOut }}%</span>
                </td>
                <td class="px-4 py-2.5 text-muted tabular-nums">{{ formatDurationSeconds(swap.durationS) }}</td>
                <td class="px-4 py-2.5">
                  <span
                    class="rounded-full border px-2 py-0.5 text-xs font-medium"
                    :class="
                      swap.status === 'SUCCESS'
                        ? 'border-ok/30 bg-ok/10 text-ok'
                        : 'border-danger/30 bg-danger/10 text-danger'
                    "
                  >
                    {{ SWAP_STATUS[swap.status] }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
