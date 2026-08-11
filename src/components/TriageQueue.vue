<script setup lang="ts">
import { computed } from 'vue'
import type { Condition, ConditionTone } from '@/utils/condition'
import type { CabinetListItem } from '@shared/contracts/cabinets'

/**
 * "Tangani lebih dulu" — tiga cabinet terparah, naik ke atas tabel (§12.5).
 *
 * Melihat masalah tidak sama dengan bisa menanganinya. Tabel menjawab "mana yang
 * bermasalah"; kartu-kartu ini menjawab "lalu apa", dengan satu tindakan yang
 * jelas per kartu dan satu baris dampak ke rider — supaya jalur dari peringatan
 * ke tindakan tidak harus lewat halaman detail dulu.
 */
const props = defineProps<{
  items: { cabinet: CabinetListItem; condition: Condition }[]
}>()

const BORDER: Record<ConditionTone, string> = {
  critical: 'border-danger/40',
  warning: 'border-warn/40',
  info: 'border-info/40',
  healthy: 'border-border',
}

const RAIL: Record<ConditionTone, string> = {
  critical: 'border-l-danger',
  warning: 'border-l-warn',
  info: 'border-l-info',
  healthy: 'border-l-border',
}

const REASON: Record<ConditionTone, string> = {
  critical: 'text-danger',
  warning: 'text-warn',
  info: 'text-info',
  healthy: 'text-muted',
}

/**
 * Kalimat dampak, disusun dari angka yang MEMANG dikirim API.
 *
 * Prototipe handoff menuliskannya sebagai teks tetap ("8 baterai terkunci di
 * dalam. Cabang punya 2 cabinet lain."), tapi separuh kalimat itu tidak bisa
 * dihitung dari data yang ada — jumlah cabinet lain di cabang yang sama tidak
 * ikut di respons daftar. Menuliskannya tetap berarti mengarang. Jadi yang
 * dipakai hanya bagian yang bisa dipertanggungjawabkan dari `slotStates`.
 */
function impact({ cabinet, condition }: (typeof props.items)[number]): string {
  const charging = cabinet.slotStates.filter((s) => s === 'CHARGING').length
  const empty = cabinet.slotStates.filter((s) => s === 'EMPTY').length
  const fault = cabinet.slotStates.filter((s) => s === 'FAULT').length
  const locked = cabinet.slotStates.filter((s) => s === 'LOCKED').length

  if (condition.severity === 3 && cabinet.status === 'OFFLINE') {
    const terkunci = cabinet.slotsFilled
    return `${terkunci} baterai terkunci di dalam. Tidak ada laporan sejak heartbeat terakhir.`
  }

  if (cabinet.slotsReady === 0) {
    return `Rider tidak bisa swap di sini. ${charging} slot mengisi, ${empty} kosong.`
  }

  if (cabinet.lastHeartbeatAt === null) {
    return 'Belum pernah mengirim heartbeat. Bacaan slot belum bisa dipercaya.'
  }

  if (condition.severity === 2) {
    return 'Melapor ONLINE tapi diam. Bacaan slot mungkin sudah lama.'
  }

  return `${fault} slot rusak, ${locked} terkunci. Sedang dalam perawatan.`
}

/** Sembunyikan seluruh blok kalau tidak ada yang keparahannya ≥ 2. */
const visible = computed(() => props.items.filter((i) => i.condition.severity >= 2).slice(0, 3))
</script>

<template>
  <section v-if="visible.length" aria-labelledby="triage-heading">
    <div class="mb-2.5 flex items-baseline gap-2.5">
      <h2 id="triage-heading" class="text-[13px] font-semibold tracking-[.02em]">
        Tangani lebih dulu
      </h2>
      <span class="text-xs text-faint">{{ visible.length }} teratas menurut dampak ke rider</span>
    </div>

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="item in visible"
        :key="item.cabinet.code"
        class="flex gap-3 rounded-xl border border-l-[3px] bg-surface px-4 py-3.5"
        :class="[BORDER[item.condition.tone], RAIL[item.condition.tone]]"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm font-semibold">{{ item.cabinet.code }}</span>
            <span class="truncate text-xs text-label">{{ item.cabinet.branchName }}</span>
          </div>

          <p class="mt-1.5 text-[13px] font-medium" :class="REASON[item.condition.tone]">
            {{ item.condition.phrase }}
          </p>

          <p class="mt-0.5 text-xs leading-[1.45] text-label">{{ impact(item) }}</p>
        </div>

        <div class="flex shrink-0 flex-col gap-1.5">
          <!-- Tindakan utama membuka detail dengan maksudnya terbawa di URL.
               Endpoint tiket perawatan belum ada, dan handoff sendiri melarang
               mengirim tombol yang tidak melakukan apa-apa — jadi verbanya tetap
               dipakai, tapi ia benar-benar membawa ops ke tempat kerjanya. -->
          <RouterLink
            :to="{ path: `/cabinets/${item.cabinet.code}`, query: { aksi: 'perawatan' } }"
            class="rounded-md border border-border-raised bg-surface-2 px-2.5 py-1.5 text-center text-xs font-medium whitespace-nowrap text-text transition-colors hover:border-border-strong"
          >
            {{ item.condition.action }}
          </RouterLink>

          <RouterLink
            :to="`/cabinets/${item.cabinet.code}`"
            class="px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-muted transition-colors hover:text-text"
          >
            Buka detail
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>
