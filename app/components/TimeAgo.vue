<script setup lang="ts">
/**
 * Stempel waktu relatif yang aman untuk SSR.
 *
 * Sebelum mount, `useNow()` bernilai null dan komponen ini menampilkan waktu
 * absolut — sehingga HTML dari server dan render pertama di client identik.
 * Setelah mount ia berganti ke "3 mnt lalu" dan ikut berdetak. Waktu persisnya
 * selalu tersedia di atribut title.
 */
const props = defineProps<{
  iso: string | null
  /** Ditampilkan saat iso null. "Tidak pernah" ≠ "sangat lama" — bedanya penting. */
  emptyLabel?: string
}>()

const now = useNow()

const label = computed(() => {
  if (!props.iso) return props.emptyLabel ?? 'Belum pernah'
  return now.value === null ? formatDateTime(props.iso) : formatRelative(props.iso, now.value)
})
</script>

<template>
  <time v-if="iso" :datetime="iso" :title="formatFull(iso)">{{ label }}</time>
  <span v-else class="text-faint italic" :title="'Cabinet ini belum pernah mengirim heartbeat'">
    {{ label }}
  </span>
</template>
