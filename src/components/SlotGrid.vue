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
    classes: 'border-ok/45 bg-ok/14 text-ok',
    icon: 'M5 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm16 3v4',
  },
  CHARGING: {
    label: 'Mengisi',
    classes: 'border-warn/45 bg-warn/14 text-warn-tint',
    icon: 'M13 3 5 14h6l-1 7 8-11h-6l1-7Z',
  },
  EMPTY: {
    label: 'Kosong',
    classes: 'border-dashed border-border-strong bg-transparent text-faint',
    icon: 'M5 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
  },
  LOCKED: {
    label: 'Terkunci',
    classes: 'border-info/40 bg-info/13 text-info-tint',
    icon: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  },
  FAULT: {
    label: 'Rusak',
    classes: 'border-danger/45 bg-danger/16 text-danger-tint',
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
  <div class="flex flex-col gap-3.5">
    <!-- Tata letaknya mengikuti susunan fisik cabinet (§12.7): dua kolom, enam
         baris, di dalam sebuah "badan" cabinet. Grid 6×2 tidak ada di dunia
         nyata, dan setiap kali teknisi melihatnya ia harus menerjemahkan nomor
         di layar menjadi posisi di pintu. Sekarang nomornya sama posisinya. -->
    <div class="rounded-xl border border-border-raised bg-panel-deep p-2.5">
      <ul
        data-cy="slot-grid"
        class="grid grid-cols-2 gap-1.5"
        :class="stale ? 'opacity-70' : ''"
      >
        <li
          v-for="slot in slots"
          :key="slot.slotNo"
          class="flex items-center gap-[9px] rounded-lg border p-[8px_9px] transition-colors"
          :class="STATES[slot.state].classes"
        >
          <svg
            class="size-4 shrink-0"
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

          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2">
              <span class="font-mono text-[11px] font-semibold opacity-75">
                #{{ String(slot.slotNo).padStart(2, '0') }}
              </span>
              <!-- SOC null berarti tidak ada baterai. Merendernya sebagai 0%
                   akan melaporkan "baterai habis" untuk lubang yang sebenarnya
                   kosong — dua kondisi yang menuntut tindakan ops berbeda. -->
              <span v-if="slot.soc !== null" class="text-[13px] font-bold tabular-nums">
                {{ slot.soc }}%
              </span>
            </div>

            <div
              v-if="slot.soc !== null"
              class="mt-1 h-[3px] overflow-hidden rounded-full bg-current/20"
            >
              <div class="h-full rounded-full bg-current" :style="{ width: `${slot.soc}%` }" />
            </div>

            <p class="mt-1 truncate text-[10px] leading-[1.3] opacity-70">
              <template v-if="slot.batteryId">
                {{ STATES[slot.state].label }} ·
                <span class="font-mono">{{ slot.batteryId }}</span>
              </template>
              <template v-else>{{ STATES[slot.state].label }} · tidak ada baterai</template>
            </p>
          </div>
        </li>
      </ul>
    </div>

    <ul class="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-label">
      <li v-for="item in legend" :key="item.state" class="flex items-center gap-1.5">
        <span class="size-[9px] rounded-[2px] border" :class="item.classes" aria-hidden="true" />
        {{ item.label }}
        <span class="tabular-nums" :class="item.count === 0 ? 'text-dim' : ''">
          {{ item.count }}
        </span>
      </li>
    </ul>
  </div>
</template>
