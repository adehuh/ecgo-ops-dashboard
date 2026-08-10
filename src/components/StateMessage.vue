<script setup lang="ts">
/**
 * Satu komponen untuk keadaan kosong dan keadaan error.
 *
 * Keduanya sengaja tidak dipisah: bentuknya identik dan menyatukannya memastikan
 * keduanya benar-benar dibangun, bukan hanya yang happy path plus satu spinner.
 * Yang membedakan hanya nada warna dan ada tidaknya tombol aksi.
 */
defineProps<{
  tone?: 'neutral' | 'danger'
  title: string
  description?: string
  /** Teks tombol aksi. Tanpa ini tombolnya tidak dirender. */
  actionLabel?: string
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
    <div
      class="grid size-12 place-items-center rounded-full border"
      :class="
        tone === 'danger'
          ? 'border-danger/30 bg-danger/10 text-danger'
          : 'border-border bg-surface-2 text-faint'
      "
    >
      <svg
        v-if="tone === 'danger'"
        class="size-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v5m0 3.5h.01" />
        <path
          stroke-linejoin="round"
          d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        />
      </svg>
      <svg
        v-else
        class="size-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path stroke-linecap="round" d="m20 20-3.5-3.5" />
      </svg>
    </div>

    <p class="text-base font-medium text-text">{{ title }}</p>
    <p v-if="description" class="max-w-md text-sm text-muted">{{ description }}</p>

    <button
      v-if="actionLabel"
      type="button"
      class="mt-1 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-border-strong"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
