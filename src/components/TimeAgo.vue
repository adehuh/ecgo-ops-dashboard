<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@/composables/useNow'
import { formatFull, formatRelative } from '@/utils/format'

/**
 * Stempel waktu relatif yang berdetak sendiri.
 *
 * Waktu persisnya selalu tersedia di atribut `title`, karena "3 jam lalu" cukup
 * untuk memindai tapi tidak cukup untuk menulis laporan insiden.
 */
const props = defineProps<{
  iso: string | null
  /** Ditampilkan saat iso null. "Tidak pernah" ≠ "sangat lama" — bedanya penting. */
  emptyLabel?: string
}>()

const now = useNow()

const label = computed(() =>
  props.iso ? formatRelative(props.iso, now.value) : (props.emptyLabel ?? 'Belum pernah'),
)
</script>

<template>
  <time v-if="iso" :datetime="iso" :title="formatFull(iso)">{{ label }}</time>
  <span v-else class="text-faint italic" title="Cabinet ini belum pernah mengirim heartbeat">
    {{ label }}
  </span>
</template>
