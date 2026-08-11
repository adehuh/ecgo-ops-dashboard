<script setup lang="ts">
import type { ConditionMarker } from '@/utils/condition'

/**
 * Penanda berbentuk, satu-satunya tempat kosakata bentuk ini didefinisikan.
 *
 * Warna tidak boleh menjadi satu-satunya pembawa informasi (WCAG 1.4.1). Bentuk
 * ini sebelumnya hidup di dalam `StatusBadge.vue`; redesign memakainya juga di
 * pil kondisi, chip pita kesehatan, dan hasil swap. Kalau tiap tempat menggambar
 * SVG-nya sendiri, cepat atau lambat lingkaran akan berarti "sehat" di satu
 * layar dan "berhasil" di layar lain. Satu komponen, satu kosakata.
 */
defineProps<{ shape: ConditionMarker }>()
</script>

<template>
  <svg class="size-2 shrink-0" viewBox="0 0 8 8" aria-hidden="true">
    <circle v-if="shape === 'circle'" cx="4" cy="4" r="4" fill="currentColor" />
    <circle
      v-else-if="shape === 'ring'"
      cx="4"
      cy="4"
      r="3"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    />
    <path v-else-if="shape === 'triangle'" d="M4 0 8 7H0z" fill="currentColor" />
    <rect v-else x="0" y="0" width="8" height="8" rx="1.5" fill="currentColor" />
  </svg>
</template>
