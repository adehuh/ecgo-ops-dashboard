<script setup lang="ts">
import { computed } from 'vue'
import ConditionMarker from '@/components/ConditionMarker.vue'
import type { ConditionMarker as MarkerShape } from '@/utils/condition'
import type { CabinetStatus } from '@shared/contracts/cabinets'

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

// Kontras dinaikkan (§12.9): isian 10% → 14–16%, border 30% → 45%. Teks pindah
// ke token *-tint karena warna dasar di atas isian bertint tidak lolos 4,5:1.
const CLASSES = {
  online: 'border-ok/45 bg-ok/14 text-ok',
  suspect: 'border-warn/45 bg-warn/14 text-warn-tint',
  offline: 'border-danger/45 bg-danger/16 text-danger-tint',
  maintenance: 'border-info/40 bg-info/13 text-info-tint',
} as const

/** Bentuk penanda per nada — kosakata yang sama dengan pil kondisi. */
const MARKERS: Record<keyof typeof CLASSES, MarkerShape> = {
  online: 'circle',
  suspect: 'triangle',
  offline: 'ring',
  maintenance: 'square',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    :class="CLASSES[tone]"
  >
    <!-- Bentuk penanda ikut berbeda, bukan hanya warnanya. -->
    <ConditionMarker :shape="MARKERS[tone]" />

    {{ LABELS[tone] }}
    <span v-if="tone === 'suspect'" class="opacity-80">
      · {{ neverReported ? 'belum lapor' : 'basi' }}
    </span>
  </span>
</template>
