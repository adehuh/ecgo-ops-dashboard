<script setup lang="ts">
/**
 * Satu komponen untuk keadaan kosong dan keadaan error.
 *
 * Keduanya sengaja tidak dipisah: menyatukannya memastikan keduanya
 * benar-benar dibangun, bukan hanya happy path plus satu spinner.
 *
 * Dua bentuk (§12.6 dan handoff bagian 5):
 *
 *   block   — kosong. Blok tengah, tanpa lingkaran ikon. Ikonnya dulu tidak
 *             menambah apa pun: kaca pembesar di atas tulisan "tidak ada hasil"
 *             hanya mengulang kalimatnya dalam bentuk gambar.
 *   banner  — error. Baris horizontal rapat, BUKAN blok tengah setinggi 160px.
 *             Alasannya: pada dashboard yang polling, mode gagalnya bukan layar
 *             kosong melainkan angka basi yang masih terlihat hidup. Banner
 *             membiarkan angka lama tetap terlihat sambil menyebut umurnya;
 *             blok tengah justru mengusir angka itu dari layar.
 */
defineProps<{
  tone?: 'neutral' | 'danger'
  variant?: 'block' | 'banner'
  title: string
  /** Teks biasa. Untuk deskripsi berisi penekanan, pakai slot `description`. */
  description?: string
  /** Tanpa ini tombolnya tidak dirender. */
  actionLabel?: string
  /** Tombol kedua, tanpa isian — mis. "Bersihkan semua". */
  secondaryLabel?: string
}>()

defineEmits<{ action: []; secondary: [] }>()
</script>

<template>
  <!-- BANNER -->
  <div
    v-if="variant === 'banner'"
    class="flex flex-wrap items-start gap-3 border-b border-border bg-danger/8 px-4 py-3.5"
    role="alert"
  >
    <div
      class="grid size-9 shrink-0 place-items-center rounded-[9px] border border-danger/45 bg-danger/16 text-danger-tint"
    >
      <svg
        class="size-5"
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
    </div>

    <div class="min-w-[16rem] flex-1">
      <p class="text-sm font-semibold text-text">{{ title }}</p>
      <p class="mt-0.5 text-[13px] leading-[1.55] text-muted">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>

    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <button
        v-if="actionLabel"
        type="button"
        class="rounded-lg border border-border-raised bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-text transition-colors hover:border-border-strong"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </button>
      <button
        v-if="secondaryLabel"
        type="button"
        class="rounded-lg border border-border-raised px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-border-strong hover:text-text"
        @click="$emit('secondary')"
      >
        {{ secondaryLabel }}
      </button>
    </div>
  </div>

  <!-- BLOCK -->
  <div v-else class="flex flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
    <p class="text-[15px] font-semibold text-text">{{ title }}</p>

    <p class="max-w-[360px] text-[13px] leading-[1.55] text-muted">
      <slot name="description">{{ description }}</slot>
    </p>

    <div v-if="actionLabel || secondaryLabel" class="mt-1.5 flex flex-wrap justify-center gap-2">
      <button
        v-if="actionLabel"
        type="button"
        class="rounded-lg border border-border-raised bg-surface-2 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-border-strong"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </button>
      <button
        v-if="secondaryLabel"
        type="button"
        class="rounded-lg border border-border-raised px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-text"
        @click="$emit('secondary')"
      >
        {{ secondaryLabel }}
      </button>
    </div>
  </div>
</template>
