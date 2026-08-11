<script setup lang="ts">
import ConditionMarker from '@/components/ConditionMarker.vue'
import type { Condition, ConditionTone } from '@/utils/condition'

/**
 * Kolom "Kondisi" — perubahan dengan pengaruh terbesar ke kecepatan pemindaian.
 *
 * Isian dan border memakai konvensi kontras BARU (§12.9): isian 14–16%, border
 * 45%. Yang lama (10% / 30%) hilang di layar laptop yang kena matahari langsung,
 * dan tim ops memang membuka ini dari lapangan.
 */
defineProps<{
  condition: Condition
  /** Versi rapat untuk kartu mobile. */
  compact?: boolean
}>()

// Teks memakai token *-tint, bukan warna dasar: #f2635c murni di atas isian
// rgb(242 99 92 / 16%) hanya ~4,1:1, di bawah syarat AA. Rail, titik, dan stroke
// tetap memakai warna dasarnya — di sana kontrasnya dihitung terhadap latar.
const CLASSES: Record<ConditionTone, string> = {
  critical: 'border-danger/45 bg-danger/14 text-danger-tint',
  warning: 'border-warn/45 bg-warn/14 text-warn-tint',
  info: 'border-info/40 bg-info/13 text-info-tint',
  healthy: 'border-border-raised text-label',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap"
    :class="[
      CLASSES[condition.tone],
      compact ? 'px-[7px] py-0.5 text-[11px]' : 'px-[9px] py-[3px] text-xs',
    ]"
  >
    <!-- Baris sehat: penanda tetap hijau penuh walau teksnya kalem, karena titik
         hijau adalah satu-satunya sinyal "aman" yang terbaca sekilas. -->
    <ConditionMarker
      :shape="condition.marker"
      :class="condition.tone === 'healthy' ? 'text-ok' : ''"
    />
    {{ condition.phrase }}
  </span>
</template>
