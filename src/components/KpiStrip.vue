<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '@/utils/format'
import type { FleetSummary } from '@shared/contracts/cabinets'

const props = defineProps<{
  summary: FleetSummary | null
  pending: boolean
}>()

const tiles = computed(() => {
  const s = props.summary
  return [
    { key: 'total', label: 'Total cabinet', value: s?.total, hint: `${s?.online ?? 0} online` },
    {
      key: 'attention',
      label: 'Perlu perhatian',
      value: s?.needsAttention,
      hint: `${s?.offline ?? 0} offline · ${s?.maintenance ?? 0} perawatan`,
      tone: (s?.needsAttention ?? 0) > 0 ? 'warn' : 'ok',
    },
    { key: 'swaps', label: 'Swap 24 jam', value: s?.swaps24h, hint: 'berhasil, rolling 24 jam' },
    {
      key: 'failed',
      label: 'Gagal 24 jam',
      value: s?.failed24h,
      hint: failureRate(s),
      tone: (s?.failed24h ?? 0) > 0 ? 'warn' : 'ok',
    },
  ]
})

function failureRate(s: FleetSummary | null): string {
  if (!s) return ''
  const attempts = s.swaps24h + s.failed24h
  if (attempts === 0) return 'belum ada percobaan'
  return `${((s.failed24h / attempts) * 100).toFixed(1)}% dari percobaan`
}
</script>

<template>
  <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div v-for="tile in tiles" :key="tile.key" class="card px-4 py-3.5">
      <dt class="text-xs font-medium tracking-wide text-muted uppercase">{{ tile.label }}</dt>

      <!-- Skeleton berukuran sama dengan angka yang akan menggantikannya, jadi
           tidak ada pergeseran tata letak saat data tiba. -->
      <dd v-if="pending && tile.value === undefined" class="mt-1.5 h-8 w-16 rounded-md shimmer" />
      <dd
        v-else
        class="mt-1 text-2xl font-extrabold tabular-nums"
        :class="tile.tone === 'warn' ? 'text-warn' : 'text-text'"
      >
        {{ formatNumber(tile.value ?? 0) }}
      </dd>

      <dd class="mt-0.5 text-xs text-faint">{{ tile.hint }}</dd>
    </div>
  </dl>
</template>
