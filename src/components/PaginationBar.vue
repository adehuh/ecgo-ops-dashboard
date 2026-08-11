<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '@/utils/format'
import type { PageMeta } from '@shared/contracts/cabinets'

const props = defineProps<{ meta: PageMeta }>()
const emit = defineEmits<{ change: [page: number] }>()

const from = computed(() => (props.meta.total === 0 ? 0 : (props.meta.page - 1) * props.meta.pageSize + 1))
const to = computed(() => Math.min(props.meta.page * props.meta.pageSize, props.meta.total))

/**
 * Jendela nomor halaman yang menyusut, dengan elipsis.
 *
 * Merender 200 tombol halaman itu tidak bisa dipakai dan membanjiri pembaca
 * layar. Halaman pertama, terakhir, dan tetangga langsung sudah cukup untuk
 * navigasi; sisanya lebih baik lewat kotak pencarian.
 */
const pages = computed<(number | 'gap')[]>(() => {
  const { page, totalPages } = props.meta
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const out: (number | 'gap')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) out.push('gap')
  for (let p = start; p <= end; p += 1) out.push(p)
  if (end < totalPages - 1) out.push('gap')

  out.push(totalPages)
  return out
})

const go = (page: number) => {
  if (page >= 1 && page <= props.meta.totalPages && page !== props.meta.page) emit('change', page)
}
</script>

<template>
  <nav
    class="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row"
    aria-label="Navigasi halaman"
  >
    <p class="text-sm text-muted tabular-nums">
      Menampilkan <span class="font-medium text-text">{{ formatNumber(from) }}</span>
      –<span class="font-medium text-text">{{ formatNumber(to) }}</span>
      dari <span class="font-medium text-text">{{ formatNumber(meta.total) }}</span> cabinet
      <!-- Catatan opsional dari pemanggil, mis. "· 17 perlu perhatian ada di
           halaman ini". Ditempel di sini, bukan baris sendiri, supaya rentang
           dan peringatannya terbaca sebagai satu kalimat. -->
      <slot name="note" />
    </p>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="grid size-10 place-items-center rounded-lg border border-border text-muted transition-colors enabled:hover:bg-surface-2 enabled:hover:text-text disabled:opacity-35"
        :disabled="meta.page <= 1"
        aria-label="Halaman sebelumnya"
        @click="go(meta.page - 1)"
      >
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7" />
        </svg>
      </button>

      <template v-for="(p, i) in pages" :key="`${p}-${i}`">
        <span v-if="p === 'gap'" class="px-1 text-faint" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="min-w-10 rounded-lg border px-3 py-2.5 text-sm font-medium tabular-nums transition-colors"
          :class="
            p === meta.page
              ? 'border-accent bg-accent text-accent-contrast'
              : 'border-border text-muted hover:bg-surface-2 hover:text-text'
          "
          :aria-current="p === meta.page ? 'page' : undefined"
          :aria-label="`Halaman ${p}`"
          @click="go(p)"
        >
          {{ p }}
        </button>
      </template>

      <button
        type="button"
        class="grid size-10 place-items-center rounded-lg border border-border text-muted transition-colors enabled:hover:bg-surface-2 enabled:hover:text-text disabled:opacity-35"
        :disabled="meta.page >= meta.totalPages"
        aria-label="Halaman berikutnya"
        @click="go(meta.page + 1)"
      >
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  </nav>
</template>
