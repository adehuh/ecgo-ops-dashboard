<script setup lang="ts">
const props = defineProps<{
  filled: number
  ready: number
  total: number
}>()

// Dua lapis dalam satu bar: bagian gelap adalah slot yang terisi, bagian terang
// yang tumpang tindih adalah yang benar-benar siap ditukar. "10/12 terisi"
// terdengar sehat sampai kelihatan hanya 2 di antaranya yang penuh.
const filledPct = computed(() => (props.total > 0 ? (props.filled / props.total) * 100 : 0))
const readyPct = computed(() => (props.total > 0 ? (props.ready / props.total) * 100 : 0))
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div
      class="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2"
      role="img"
      :aria-label="`${filled} dari ${total} slot terisi, ${ready} siap ditukar`"
    >
      <div class="absolute inset-y-0 left-0 rounded-full bg-accent/30" :style="{ width: `${filledPct}%` }" />
      <div class="absolute inset-y-0 left-0 rounded-full bg-accent" :style="{ width: `${readyPct}%` }" />
    </div>

    <span class="text-sm whitespace-nowrap tabular-nums">
      {{ filled }}<span class="text-faint">/{{ total }}</span>
      <span class="ml-1.5 text-xs text-muted">{{ ready }} siap</span>
    </span>
  </div>
</template>
