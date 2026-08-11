<script setup lang="ts">
import { computed } from 'vue'
import type { SlotState } from '@shared/contracts/cabinets'

/**
 * Dua belas segmen, satu per slot fisik — pengganti `SlotFillBar` di tabel (§12.4).
 *
 * Bar dua lapis menunjukkan PROPORSI tapi menyembunyikan KOMPOSISI: "10/12
 * terisi" terdengar sehat sampai ketahuan hanya 2 yang benar-benar penuh.
 * Segmen berwarna per state menjawab pertanyaan yang sebenarnya dipedulikan
 * ops — "bisakah rider swap di sini sekarang?" — tanpa membaca satu angka pun.
 *
 * State-nya datang SUDAH TERURUT dari server (FULL → CHARGING → FAULT → LOCKED
 * → EMPTY), jadi bentuk kolomnya konsisten antar baris.
 */
const props = defineProps<{
  states: SlotState[]
  ready: number
  filled: number
  /** Versi lebih besar untuk kartu mobile — jempol butuh target yang lebih tinggi. */
  large?: boolean
}>()

// Blok warna penuh, bukan bertint: ini bukan teks, kontrasnya dihitung terhadap
// latar kartu dan justru harus pekat supaya terbaca sekilas.
const FILL: Record<SlotState, string> = {
  FULL: 'bg-ok',
  CHARGING: 'bg-warn',
  FAULT: 'bg-danger',
  LOCKED: 'bg-info',
  EMPTY: 'bg-slot-empty',
}

/** Nol slot siap harus terlihat merah tanpa perlu dibaca. */
const readyTone = computed(() =>
  props.ready === 0 ? 'text-danger' : props.ready <= 2 ? 'text-warn' : 'text-text',
)
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="flex shrink-0 gap-0.5" :class="large ? 'gap-[3px]' : ''">
      <span
        v-for="(state, i) in states"
        :key="i"
        class="rounded-[1.5px]"
        :class="[FILL[state], large ? 'h-5 w-1.5' : 'h-[18px] w-[5px]']"
      />
    </div>

    <!-- Angka tetap ada di sebelahnya: bentuk menjawab "kira-kira seberapa",
         angka menjawab "berapa persisnya". Keduanya dibutuhkan. -->
    <span class="text-[13px] whitespace-nowrap tabular-nums" :class="readyTone">
      <span class="font-semibold">{{ ready }}</span> siap
      <span class="text-dim">· {{ filled }} terisi</span>
    </span>
  </div>
</template>
