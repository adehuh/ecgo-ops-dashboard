<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toQueryString } from '@/api/client'
// Tiap komponen di-import eksplisit: lebih berisik satu kali, tapi "komponen ini
// datang dari mana?" bisa dijawab tanpa menebak.
import ConditionPill from '@/components/ConditionPill.vue'
import FleetHealthBand from '@/components/FleetHealthBand.vue'
import FreshnessPill from '@/components/FreshnessPill.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import Sparkline from '@/components/Sparkline.vue'
import SlotSegments from '@/components/SlotSegments.vue'
import StateMessage from '@/components/StateMessage.vue'
import TimeAgo from '@/components/TimeAgo.vue'
import TriageQueue from '@/components/TriageQueue.vue'
import { useApi } from '@/composables/useApi'
import { useCabinetQuery } from '@/composables/useCabinetQuery'
import { useNow } from '@/composables/useNow'
import { deriveCondition, formatAge, type ConditionTone } from '@/utils/condition'
import { formatNumber } from '@/utils/format'
import {
  PAGE_SIZES,
  type CabinetListQuery,
  type CabinetListResponse,
  type ConditionFilter,
  type FleetSummaryResponse,
} from '@shared/contracts/cabinets'

const router = useRouter()
const { state, apiQuery, hasInvalidParams, isFiltered, patch, toggleStatus, toggleSort, reset } =
  useCabinetQuery()

// URL-nya sebuah getter, jadi useApi mengambil ulang setiap kali query berubah —
// dan membatalkan permintaan sebelumnya saat melakukannya.
const { data, error, isFirstLoad, isRefreshing, refresh, status, lastSuccessAt } =
  useApi<CabinetListResponse>(() => `/api/cabinets${toQueryString(apiQuery.value)}`)

const {
  data: summaryData,
  isFirstLoad: summaryLoading,
  refresh: refreshSummary,
} = useApi<FleetSummaryResponse>(() => '/api/summary')

const rows = computed(() => data.value?.data ?? [])
const meta = computed(() => data.value?.meta ?? null)
const failure = computed(() => error.value)
const summary = computed(() => summaryData.value?.data ?? null)

const now = useNow()

/**
 * Kondisi dihitung sekali per baris, lalu dipakai kolom Kondisi, rail keparahan,
 * tint baris, kolom tindakan, warna sparkline, dan antrean triage. Menghitungnya
 * enam kali di template memberi enam kesempatan untuk saling menyimpang.
 */
const decorated = computed(() =>
  rows.value.map((cabinet) => ({ cabinet, condition: deriveCondition(cabinet, now.value) })),
)

const attentionOnPage = computed(
  () => decorated.value.filter((r) => r.condition.severity >= 2).length,
)

// --- Pencarian -------------------------------------------------------------

const searchInput = ref(state.value.q)
const searchEl = ref<HTMLInputElement | null>(null)
let debounce: ReturnType<typeof setTimeout> | undefined

// URL bisa berubah tanpa lewat kotak input (tombol back, tautan yang dibagikan),
// jadi input ikut mengejar URL — bukan sebaliknya.
watch(
  () => state.value.q,
  (value) => {
    if (value !== searchInput.value) searchInput.value = value
  },
)

watch(searchInput, (value) => {
  clearTimeout(debounce)
  // 350 ms: cukup lama untuk melewatkan ketukan di tengah kata, cukup singkat
  // agar tidak terasa seperti jeda.
  debounce = setTimeout(() => {
    if (value.trim() !== state.value.q) void patch({ q: value.trim() })
  }, 350)
})

onUnmounted(() => clearTimeout(debounce))

// --- Polling ---------------------------------------------------------------

/** Jeda bertahan lintas muat ulang: yang menjeda karena sedang membaca satu
 *  angka tidak mau jedanya hilang begitu ia menekan F5. */
const POLL_PAUSED_KEY = 'ecgo:poll-paused'

function readPaused(): boolean {
  // localStorage bisa melempar di mode privat sebagian browser; gagal menyimpan
  // preferensi tidak boleh menjatuhkan halaman.
  try {
    return localStorage.getItem(POLL_PAUSED_KEY) === '1'
  } catch {
    return false
  }
}

const pollPaused = ref(readPaused())

watch(pollPaused, (paused) => {
  try {
    localStorage.setItem(POLL_PAUSED_KEY, paused ? '1' : '0')
  } catch {
    /* preferensi tidak tersimpan — tidak fatal */
  }
})

function togglePause() {
  pollPaused.value = !pollPaused.value
  // Melanjutkan harus langsung mengambil data: menunggu sampai 30 detik
  // berikutnya membuat tombolnya terasa rusak.
  if (!pollPaused.value) {
    void refresh()
    void refreshSummary()
  }
}

const poll = setInterval(() => {
  // Jangan menumpuk permintaan di atas yang belum selesai, dan jangan membebani
  // database untuk tab yang tidak dilihat siapa pun.
  if (!pollPaused.value && status.value !== 'pending' && !document.hidden) {
    void refresh()
    void refreshSummary()
  }
}, 30_000)

onUnmounted(() => clearInterval(poll))

// --- Sortir ----------------------------------------------------------------

const SORTS = [
  { key: 'severity', label: 'Paling bermasalah' },
  { key: 'swaps24h', label: 'Swap 24 jam' },
  { key: 'lastHeartbeat', label: 'Heartbeat' },
  { key: 'code', label: 'Kode' },
] as const satisfies readonly { key: CabinetListQuery['sort']; label: string }[]

const COLUMNS = [
  { key: 'code', label: 'Cabinet' },
  { key: 'condition', label: 'Kondisi' },
  { key: 'slots', label: '12 slot · siap ditukar' },
  { key: 'swaps24h', label: 'Swap 24 jam' },
  { key: 'lastHeartbeat', label: 'Heartbeat' },
  { key: 'action', label: '' },
] as const

const ariaSort = (key: string) =>
  state.value.sort === key ? (state.value.dir === 'asc' ? 'ascending' : 'descending') : 'none'

/**
 * Kolom yang memakai panah urutan. `severity` tidak punya kolom sendiri, jadi
 * panahnya jatuh ke pemecah serinya — kolom yang benar-benar terlihat menentukan
 * urutan baris di layar.
 */
const arrowColumn = computed(() =>
  state.value.sort === 'severity' ? 'swaps24h' : state.value.sort,
)

// --- Warna per keparahan ---------------------------------------------------

const RAIL: Record<ConditionTone, string> = {
  critical: 'bg-danger',
  warning: 'bg-warn',
  info: 'bg-info',
  healthy: 'bg-[#233029] dark:bg-[#233029]',
}

const RAIL_BORDER: Record<ConditionTone, string> = {
  critical: 'border-l-danger',
  warning: 'border-l-warn',
  info: 'border-l-info',
  healthy: 'border-l-border',
}

/** Tint baris sangat tipis: cukup untuk mengelompokkan, tidak sampai menyilaukan. */
const ROW_TINT: Record<ConditionTone, string> = {
  critical: 'bg-danger/[.04]',
  warning: 'bg-warn/[.03]',
  info: '',
  healthy: '',
}

/** Pil heartbeat: netral saat segar, ikut warna keparahan saat bermasalah. */
const HEARTBEAT_PILL: Record<ConditionTone, string> = {
  critical: 'border-danger/45 bg-danger/14 text-danger-tint',
  warning: 'border-warn/45 bg-warn/14 text-warn-tint',
  info: 'border-border-raised text-muted',
  healthy: 'border-border-raised text-muted',
}

// --- Keadaan kosong --------------------------------------------------------

const FILTER_LABELS: Record<ConditionFilter, string> = {
  ONLINE: 'Sehat',
  OFFLINE: 'Offline',
  MAINTENANCE: 'Perawatan',
  STALE_HEARTBEAT: 'Heartbeat basi',
  NO_READY_SLOTS: '0 slot siap',
}

const activeFilterLabels = computed(() =>
  (state.value.status ?? []).map((s) => FILTER_LABELS[s]).join(', '),
)

/** Umur data yang MASIH TERLIHAT di layar saat polling gagal. */
const staleAge = computed(() =>
  lastSuccessAt.value === null
    ? null
    : formatAge(new Date(lastSuccessAt.value).toISOString(), now.value),
)

// --- Keyboard --------------------------------------------------------------

/**
 * Pintasan papan ketik (§1.5 handoff). Ini alat internal yang dibuka
 * berulang-ulang setiap hari, dan `j`/`k`/`↵` menghemat perjalanan ke mouse
 * pada pekerjaan yang bentuknya "periksa enam cabinet".
 */
const focusedRow = ref(-1)

function onKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  // Jangan pernah membajak ketukan saat pengguna sedang mengetik di suatu tempat.
  const typing =
    el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || el?.isContentEditable
  if (typing) {
    if (e.key === 'Escape') el?.blur()
    return
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return

  const max = decorated.value.length - 1

  if (e.key === '/') {
    e.preventDefault()
    searchEl.value?.focus()
    return
  }

  if (e.key === 'j' || e.key === 'ArrowDown') {
    e.preventDefault()
    focusedRow.value = Math.min(max, focusedRow.value + 1)
    return
  }

  if (e.key === 'k' || e.key === 'ArrowUp') {
    e.preventDefault()
    focusedRow.value = Math.max(0, focusedRow.value - 1)
    return
  }

  if (e.key === 'Enter' && focusedRow.value >= 0) {
    const row = decorated.value[focusedRow.value]
    if (row) void router.push(`/cabinets/${row.cabinet.code}`)
    return
  }

  // 1–4 memilih chip kondisi, mengikuti urutan yang terlihat di pita.
  if (['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault()
    const chip = document.querySelector<HTMLButtonElement>(`[data-shortcut="${e.key}"]`)
    chip?.click()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// Baris yang difokus tidak boleh menunjuk ke baris yang sudah berganti isi.
watch(decorated, () => {
  focusedRow.value = -1
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Pil kesegaran hidup di header aplikasi, tapi state polling-nya milik
         halaman ini. Teleport menyatukan keduanya tanpa menaikkan state ke App. -->
    <Teleport to="#app-header-status" defer>
      <FreshnessPill
        :last-success-at="lastSuccessAt"
        :paused="pollPaused"
        :failing="Boolean(failure)"
        @toggle-pause="togglePause"
      />
    </Teleport>
    <Teleport to="#app-header-scope" defer>
      <span v-if="summary"> · {{ formatNumber(summary.total) }} cabinet</span>
    </Teleport>

    <!--
      Tanpa <h1> "Cabinet battery swap" di atas pita.
      Judul itu hanya mengulang label nav yang sudah aktif di header, dan
      mendorong satu-satunya blok yang benar-benar menjawab pertanyaan ops
      turun 90px. Nama halamannya sudah ada di <title> dan di navigasi.
    -->
    <h1 class="sr-only">Papan triage cabinet battery swap</h1>

    <FleetHealthBand
      :summary="summary"
      :pending="summaryLoading"
      :active="state.status ?? []"
      @toggle="toggleStatus"
    />

    <TriageQueue :items="decorated" />

    <!-- URL yang dibuat manusia bisa memuat parameter ngawur. Diberitahukan,
         bukan didiamkan sambil menampilkan hasil yang tidak diminta. -->
    <p
      v-if="hasInvalidParams"
      class="rounded-lg border border-warn/45 bg-warn/14 px-3.5 py-2.5 text-sm text-warn-tint"
      role="status"
    >
      Sebagian parameter di URL tidak dikenali dan diabaikan. Menampilkan tampilan default.
    </p>

    <div class="overflow-hidden rounded-[14px] border border-border bg-surface">
      <!-- Toolbar -->
      <div class="flex flex-col gap-3 border-b border-border p-[12px_14px] lg:flex-row lg:items-center">
        <div class="relative max-w-[420px] flex-1">
          <svg
            class="pointer-events-none absolute top-1/2 left-[11px] size-[15px] -translate-y-1/2 text-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path stroke-linecap="round" d="m20 20-3.5-3.5" />
          </svg>

          <input
            ref="searchEl"
            v-model="searchInput"
            type="search"
            :maxlength="100"
            placeholder="Cari kode atau cabang…"
            aria-label="Cari kode cabinet atau cabang"
            class="w-full rounded-lg border border-border-raised bg-surface-2 py-[9px] pr-11 pl-[34px] text-sm placeholder:text-faint focus:border-accent-ink focus:outline-none"
          >
          <!-- Petunjuk pintasan ditempel di kotaknya sendiri: tempat pengguna
               sudah melihat ketika ia bertanya "bagaimana cara cepat ke sini". -->
          <span
            class="pointer-events-none absolute top-1/2 right-[9px] -translate-y-1/2 rounded-[5px] border border-border-strong px-1.5 py-px font-mono text-[11px] text-faint"
            aria-hidden="true"
          >
            /
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-2 lg:ml-auto">
          <span class="text-xs text-faint">Urut</span>

          <div
            class="flex gap-0.5 rounded-lg border border-border-raised bg-surface-2 p-0.5"
            role="group"
            aria-label="Urutkan daftar"
          >
            <button
              v-for="s in SORTS"
              :key="s.key"
              type="button"
              class="cursor-pointer rounded-md px-[11px] py-1.5 text-[13px] font-medium transition-colors"
              :class="
                state.sort === s.key
                  ? 'bg-segment-active text-text'
                  : 'text-muted hover:text-text'
              "
              :aria-pressed="state.sort === s.key"
              @click="toggleSort(s.key)"
            >
              {{ s.label }}
            </button>
          </div>

          <select
            :value="state.pageSize"
            aria-label="Jumlah baris per halaman"
            class="rounded-lg border border-border-raised bg-surface-2 px-2.5 py-[7px] text-[13px] text-muted focus:border-accent-ink focus:outline-none"
            @change="patch({ pageSize: Number(($event.target as HTMLSelectElement).value) })"
          >
            <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }} / hal</option>
          </select>
        </div>
      </div>

      <!-- Pembaca layar diberi tahu saat jumlah hasil berubah; tanpa ini,
           mengetik di kotak pencarian tidak mengumumkan apa pun. -->
      <p aria-live="polite" class="sr-only">
        {{ meta ? `${meta.total} cabinet ditemukan` : 'Memuat cabinet' }}
      </p>

      <!-- ERROR — banner, bukan blok tengah. Baris lama sengaja TETAP dirender
           di bawahnya; yang berubah hanya bahwa umurnya kini disebut. -->
      <StateMessage
        v-if="failure"
        variant="banner"
        title="Server tidak menjawab"
        action-label="Coba lagi"
        @action="refresh()"
      >
        <template #description>
          <template v-if="staleAge && rows.length">
            Angka di bawah adalah yang terakhir berhasil dimuat
            <strong class="font-semibold text-text">{{ staleAge }} lalu</strong> — jangan dipakai
            untuk keputusan sekarang.
          </template>
          <template v-else>{{ failure.message }}</template>
        </template>
      </StateMessage>

      <!-- LOADING (pertama kali): jumlah baris mengikuti pageSize, bukan angka
           tetap. Skeleton hanya berguna kalau bentuknya sama dengan penggantinya. -->
      <div v-if="isFirstLoad" class="divide-y divide-border-soft" aria-hidden="true">
        <div v-for="i in state.pageSize" :key="i" class="flex items-center gap-4 px-3.5 py-2.5">
          <div class="h-8 w-28 rounded shimmer" />
          <div class="h-5 w-36 rounded-md shimmer" />
          <div class="h-[18px] w-40 rounded shimmer" />
          <div class="ml-auto h-4 w-16 rounded shimmer" />
          <div class="h-5 w-20 rounded-md shimmer" />
        </div>
      </div>

      <!-- EMPTY — menyebut filter yang sedang aktif dan menawarkan melonggarkan
           satu per satu, bukan hanya "bersihkan semua". -->
      <StateMessage
        v-else-if="rows.length === 0 && isFiltered"
        title="Tidak ada cabinet yang cocok"
        :action-label="state.status?.length ? 'Cari tanpa filter kondisi' : undefined"
        secondary-label="Bersihkan semua"
        @action="patch({ status: undefined })"
        @secondary="reset()"
      >
        <template #description>
          <template v-if="state.q">
            Kata kunci <span class="font-mono text-text">{{ state.q }}</span>
          </template>
          <template v-else>Filter yang aktif</template>
          <template v-if="state.status?.length">
            dengan filter <span class="text-text">{{ activeFilterLabels }}</span>
          </template>
          tidak cocok dengan cabinet mana pun.
        </template>
      </StateMessage>

      <StateMessage
        v-else-if="rows.length === 0"
        title="Belum ada cabinet"
        description="Database belum berisi cabinet. Jalankan `npm run seed` untuk memuat data contoh."
      />

      <!-- DATA -->
      <template v-else>
        <div
          class="overflow-x-auto transition-opacity"
          :class="isRefreshing ? 'opacity-60' : 'opacity-100'"
        >
          <table class="hidden w-full text-left text-[13px] md:table">
            <thead class="border-b border-border bg-table-head">
              <tr>
                <th scope="col" class="w-[3px] p-0"><span class="sr-only">Keparahan</span></th>
                <th
                  v-for="col in COLUMNS"
                  :key="col.key"
                  scope="col"
                  class="p-[9px_14px] text-[11px] font-semibold tracking-[.06em] text-label uppercase"
                  :aria-sort="col.key === state.sort ? ariaSort(col.key) : undefined"
                >
                  {{ col.label }}
                  <!-- Panah menandai kolom yang BENAR-BENAR menentukan urutan.
                       Saat sortirnya "paling bermasalah", keparahan bukan kolom
                       yang terlihat — yang kasatmata adalah pemecah serinya,
                       swap 24 jam, dan di situlah panahnya berdiri. Sortirnya
                       sendiri dikendalikan segmented control di toolbar, jadi
                       header tidak perlu jadi tombol kedua untuk hal yang sama. -->
                  <span v-if="col.key === arrowColumn" class="text-accent-ink" aria-hidden="true">
                    {{ state.dir === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="({ cabinet, condition }, i) in decorated"
                :key="cabinet.code"
                class="border-b border-border-soft transition-colors hover:bg-surface-2"
                :class="[
                  ROW_TINT[condition.tone],
                  i === focusedRow ? 'outline-2 -outline-offset-2 outline-accent-ink' : '',
                ]"
              >
                <!-- Rail keparahan sebagai KOLOM setinggi baris penuh, bukan
                     border-left: border akan tertimpa saat baris di-hover. -->
                <td class="w-[3px] p-0">
                  <div class="h-full min-h-[46px] w-[3px]" :class="RAIL[condition.tone]" />
                </td>

                <td class="p-[8px_14px]">
                  <RouterLink
                    :to="`/cabinets/${cabinet.code}`"
                    class="font-mono text-[13px] font-semibold tracking-[-.01em] text-text hover:text-accent-ink hover:underline"
                  >
                    {{ cabinet.code }}
                  </RouterLink>
                  <p class="mt-px text-xs text-label">
                    {{ cabinet.branchName }} <span class="text-dim">{{ cabinet.branchCode }}</span>
                  </p>
                </td>

                <td class="p-[8px_14px]">
                  <ConditionPill :condition="condition" />
                </td>

                <td class="p-[8px_14px]">
                  <SlotSegments
                    :states="cabinet.slotStates"
                    :ready="cabinet.slotsReady"
                    :filled="cabinet.slotsFilled"
                  />
                </td>

                <td class="p-[8px_14px]">
                  <div class="flex items-center gap-2.5">
                    <span class="min-w-[26px] text-right text-sm font-semibold tabular-nums">
                      {{ formatNumber(cabinet.swaps24h) }}
                    </span>
                    <!-- Baris bermasalah digambar abu-abu: throughput cabinet yang
                         sedang rusak bukan sinyal keberhasilan. -->
                    <Sparkline
                      :values="cabinet.hourly"
                      :width="74"
                      :height="20"
                      :stroke-width="2"
                      :muted="condition.severity >= 2"
                    />
                  </div>
                </td>

                <td class="p-[8px_14px]">
                  <span
                    class="inline-block rounded-md border px-2 py-0.5 text-xs whitespace-nowrap tabular-nums"
                    :class="HEARTBEAT_PILL[condition.tone]"
                  >
                    <TimeAgo :iso="cabinet.lastHeartbeatAt" />
                  </span>
                </td>

                <!-- Bukan tombol: barisnya sendiri yang bisa diklik. Ini label
                     yang memberi tahu apa yang akan dihadapi kalau dibuka. -->
                <td class="p-[8px_14px] text-right text-xs whitespace-nowrap">
                  <span v-if="condition.action" class="text-soft">{{ condition.action }}</span>
                  <span v-else class="text-dim">—</span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Kartu untuk layar sempit: tabel tujuh kolom tidak bisa dipakai di
               ponsel, dan tim ops memang membukanya dari lapangan. -->
          <ul class="divide-y divide-border-soft md:hidden">
            <li v-for="{ cabinet, condition } in decorated" :key="cabinet.code">
              <RouterLink
                :to="`/cabinets/${cabinet.code}`"
                class="block border-l-[3px] p-[12px_13px] hover:bg-surface-2"
                :class="[RAIL_BORDER[condition.tone], ROW_TINT[condition.tone]]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-mono text-sm font-semibold">{{ cabinet.code }}</p>
                    <p class="mt-0.5 truncate text-xs text-label">{{ cabinet.branchName }}</p>
                  </div>
                  <ConditionPill :condition="condition" compact />
                </div>

                <div class="mt-3 flex items-center justify-between gap-3">
                  <SlotSegments
                    :states="cabinet.slotStates"
                    :ready="cabinet.slotsReady"
                    :filled="cabinet.slotsFilled"
                    large
                  />
                  <p class="shrink-0 text-xs text-muted">
                    <span class="font-semibold text-text tabular-nums">
                      {{ formatNumber(cabinet.swaps24h) }}
                    </span>
                    swap · <TimeAgo :iso="cabinet.lastHeartbeatAt" />
                  </p>
                </div>
              </RouterLink>
            </li>
          </ul>
        </div>

        <PaginationBar v-if="meta" :meta="meta" @change="patch({ page: $event })">
          <template v-if="attentionOnPage > 0" #note>
            <span class="text-warn">· {{ attentionOnPage }} perlu perhatian ada di halaman ini</span>
          </template>
        </PaginationBar>
      </template>
    </div>

    <!-- Petunjuk pintasan: baris terakhir, tempat mata mendarat setelah selesai
         membaca tabel dan mulai bertanya "ada cara lebih cepat?" -->
    <div class="flex flex-wrap gap-4 text-xs text-faint">
      <span>
        Keyboard:
        <kbd class="font-mono text-muted">/</kbd> cari ·
        <kbd class="font-mono text-muted">j k</kbd> pindah baris ·
        <kbd class="font-mono text-muted">↵</kbd> buka ·
        <kbd class="font-mono text-muted">1–4</kbd> filter kondisi
      </span>
      <span class="ml-auto">Data dalam zona waktu WIB (Asia/Jakarta)</span>
    </div>
  </div>
</template>
