<script setup lang="ts">
import { computed } from 'vue'
import type { CabinetSlot, SlotState } from '@shared/contracts/cabinets'

const props = defineProps<{
  slots: CabinetSlot[]
  /** Cabinet OFFLINE / basi: state slot ini adalah yang terakhir diketahui, bukan yang sekarang. */
  stale?: boolean
}>()

/**
 * Tiap state punya warna DAN ikon DAN label. Grid yang hanya dibedakan warna
 * tidak bisa dibaca oleh sekitar 1 dari 12 laki-laki, dan teknisi lapangan
 * membaca layar ini di bawah matahari langsung — kondisi yang menghapus
 * perbedaan warna halus jauh sebelum menghapus perbedaan bentuk.
 */
const STATES: Record<SlotState, { label: string; classes: string; icon: string }> = {
  FULL: {
    label: 'Penuh',
    classes: 'border-ok/40 bg-ok/10 text-ok',
    icon: 'M5 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm16 3v4',
  },
  CHARGING: {
    label: 'Mengisi',
    classes: 'border-warn/40 bg-warn/10 text-warn',
    icon: 'M13 3 5 14h6l-1 7 8-11h-6l1-7Z',
  },
  EMPTY: {
    label: 'Kosong',
    classes: 'border-dashed border-border-strong bg-transparent text-faint',
    icon: 'M5 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
  },
  LOCKED: {
    label: 'Terkunci',
    classes: 'border-info/40 bg-info/10 text-info',
    icon: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  },
  FAULT: {
    label: 'Rusak',
    classes: 'border-danger/45 bg-danger/10 text-danger',
    icon: 'M12 8v5m0 3.5h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  },
}

const legend = computed(() =>
  (Object.keys(STATES) as SlotState[]).map((state) => ({
    state,
    ...STATES[state],
    count: props.slots.filter((s) => s.state === state).length,
  })),
)
</script>

<template>
  <div class="space-y-4">
    <ul
      class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      :class="stale ? 'opacity-70' : ''"
    >
      <li
        v-for="slot in slots"
        :key="slot.slotNo"
        class="rounded-xl border p-3 transition-colors"
        :class="STATES[slot.state].classes"
      >
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs font-medium opacity-70">
            #{{ String(slot.slotNo).padStart(2, '0') }}
          </span>
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="STATES[slot.state].icon" />
          </svg>
        </div>

        <p class="mt-2 text-sm font-medium">{{ STATES[slot.state].label }}</p>

        <!-- SOC null berarti tidak ada baterai. Merendernya sebagai 0% akan
             melaporkan "baterai habis" untuk lubang yang sebenarnya kosong —
             dua kondisi yang menuntut tindakan ops berbeda. -->
        <template v-if="slot.soc !== null">
          <div class="mt-2 flex items-center gap-2">
            <div class="h-1 flex-1 overflow-hidden rounded-full bg-current/20">
              <div class="h-full rounded-full bg-current" :style="{ width: `${slot.soc}%` }" />
            </div>
            <span class="text-xs font-medium tabular-nums">{{ slot.soc }}%</span>
          </div>
          <p class="mt-1.5 truncate font-mono text-[10px] opacity-60" :title="slot.batteryId ?? ''">
            {{ slot.batteryId }}
          </p>
        </template>
        <p v-else class="mt-2 text-xs opacity-60">Tidak ada baterai</p>
      </li>
    </ul>

    <ul class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
      <li v-for="item in legend" :key="item.state" class="flex items-center gap-1.5">
        <span class="size-2 rounded-full border" :class="item.classes" aria-hidden="true" />
        {{ item.label }}
        <span class="tabular-nums opacity-70">{{ item.count }}</span>
      </li>
    </ul>
  </div>
</template>
