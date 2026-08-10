<script setup lang="ts">
import type { CabinetStatus } from '~~/shared/contracts/cabinets'

/**
 * Warna tidak pernah menjadi satu-satunya pembawa informasi (WCAG 1.4.1): tiap
 * badge punya titik BERBENTUK berbeda dan label teks, jadi tetap terbaca oleh
 * mata yang tidak membedakan merah–hijau maupun di cetakan hitam putih.
 */
const props = defineProps<{
  status: CabinetStatus
  /** Heartbeat lebih tua dari ambang. ONLINE yang basi adalah keadaannya sendiri. */
  isStale?: boolean
  neverReported?: boolean
}>()

const tone = computed(() => {
  if (props.status === 'MAINTENANCE') return 'maintenance'
  if (props.status === 'OFFLINE') return 'offline'
  // Cabinet yang mengaku ONLINE tapi diam berjam-jam adalah anomali yang paling
  // ingin dilihat ops — jadi tidak boleh terlihat sama dengan yang sehat.
  return props.isStale || props.neverReported ? 'suspect' : 'online'
})

const LABELS = {
  online: 'Online',
  suspect: 'Online',
  offline: 'Offline',
  maintenance: 'Perawatan',
} as const

const CLASSES = {
  online: 'border-ok/30 bg-ok/10 text-ok',
  suspect: 'border-warn/35 bg-warn/10 text-warn',
  offline: 'border-danger/30 bg-danger/10 text-danger',
  maintenance: 'border-info/30 bg-info/10 text-info',
} as const
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    :class="CLASSES[tone]"
  >
    <!-- Bentuk penanda ikut berbeda, bukan hanya warnanya. -->
    <svg class="size-2 shrink-0" viewBox="0 0 8 8" aria-hidden="true">
      <circle v-if="tone === 'online'" cx="4" cy="4" r="4" fill="currentColor" />
      <path v-else-if="tone === 'suspect'" d="M4 0 8 7H0z" fill="currentColor" />
      <rect v-else-if="tone === 'maintenance'" x="0" y="0" width="8" height="8" rx="1.5" fill="currentColor" />
      <circle v-else cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>

    {{ LABELS[tone] }}
    <span v-if="tone === 'suspect'" class="opacity-80">
      · {{ neverReported ? 'belum lapor' : 'basi' }}
    </span>
  </span>
</template>
