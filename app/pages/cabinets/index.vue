<script setup lang="ts">
import {
  CABINET_STATUSES,
  PAGE_SIZES,
  type CabinetListQuery,
  type CabinetListResponse,
  type FleetSummaryResponse,
} from '~~/shared/contracts/cabinets'

useHead({ title: 'Cabinet · ECGO Ops' })

const { state, apiQuery, hasInvalidParams, isFiltered, patch, toggleStatus, toggleSort, reset } =
  useCabinetQuery()

// `query` reaktif: Nuxt mengambil ulang sendiri setiap kali URL berubah, jadi
// tidak perlu watcher manual yang gampang lupa satu dependensi.
const { data, status, error, refresh } = await useFetch<CabinetListResponse>('/api/cabinets', {
  query: apiQuery,
})

const { data: summary, status: summaryStatus } = await useFetch<FleetSummaryResponse>('/api/summary')

// Skeleton hanya pada pemuatan pertama. Menampilkannya lagi di tiap ketukan
// pencarian membuat tabel berkedip dan justru terasa lebih lambat, meski
// datanya datang lebih cepat.
const isFirstLoad = computed(() => status.value === 'pending' && !data.value)
const isRefreshing = computed(() => status.value === 'pending' && Boolean(data.value))

const rows = computed(() => data.value?.data ?? [])
const meta = computed(() => data.value?.meta ?? null)
const failure = computed(() => (error.value ? describeApiError(error.value) : null))

// --- Pencarian -------------------------------------------------------------

const searchInput = ref(state.value.q)
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
    if (value.trim() !== state.value.q) patch({ q: value.trim() })
  }, 350)
})

onUnmounted(() => clearTimeout(debounce))

// --- Auto-refresh ----------------------------------------------------------

const autoRefresh = ref(true)
let poll: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  poll = setInterval(() => {
    // Jangan menumpuk permintaan di atas permintaan yang belum selesai, dan
    // jangan membebani database untuk tab yang tidak dilihat siapa pun.
    if (autoRefresh.value && status.value !== 'pending' && !document.hidden) void refresh()
  }, 30_000)
})

onUnmounted(() => clearInterval(poll))

// --- Header tabel ----------------------------------------------------------

const COLUMNS = [
  { key: 'code', label: 'Kode', sortable: true },
  { key: 'branch', label: 'Cabang', sortable: false },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'slots', label: 'Slot terisi', sortable: false },
  { key: 'swaps24h', label: 'Swap 24 jam', sortable: true },
  { key: 'lastHeartbeat', label: 'Heartbeat', sortable: true },
] as const

const ariaSort = (key: string) =>
  state.value.sort === key ? (state.value.dir === 'asc' ? 'ascending' : 'descending') : 'none'

const STATUS_LABELS = { ONLINE: 'Online', OFFLINE: 'Offline', MAINTENANCE: 'Perawatan' } as const
</script>

<template>
  <div class="space-y-5">
    <!-- Judul -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Cabinet battery swap</h1>
        <p class="mt-1 text-sm text-muted">
          Pantau status, ketersediaan slot, dan throughput tiap cabinet.
        </p>
      </div>

      <label class="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
        <input v-model="autoRefresh" type="checkbox" class="size-4 accent-[var(--accent)]">
        Auto-refresh 30 dtk
        <span
          v-if="isRefreshing"
          class="size-1.5 animate-pulse rounded-full bg-accent"
          aria-hidden="true"
        />
      </label>
    </div>

    <KpiStrip :summary="summary?.data ?? null" :pending="summaryStatus === 'pending'" />

    <!-- URL yang dibuat manusia bisa memuat parameter ngawur. Diberitahukan,
         bukan didiamkan sambil menampilkan hasil yang tidak diminta. -->
    <p
      v-if="hasInvalidParams"
      class="rounded-lg border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-sm text-warn"
      role="status"
    >
      Sebagian parameter di URL tidak dikenali dan diabaikan. Menampilkan tampilan default.
    </p>

    <!-- Kontrol -->
    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-border p-3.5 lg:flex-row lg:items-center">
        <div class="relative flex-1">
          <svg
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
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
            v-model="searchInput"
            type="search"
            :maxlength="100"
            placeholder="Cari kode cabinet atau cabang…"
            aria-label="Cari kode cabinet atau cabang"
            class="w-full rounded-lg border border-border bg-surface-2 py-2.5 pr-3 pl-9 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
          >
        </div>

        <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter status">
          <button
            v-for="s in CABINET_STATUSES"
            :key="s"
            type="button"
            class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            :class="
              state.status?.includes(s)
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-muted hover:bg-surface-2 hover:text-text'
            "
            :aria-pressed="state.status?.includes(s) ?? false"
            @click="toggleStatus(s)"
          >
            {{ STATUS_LABELS[s] }}
          </button>

          <select
            :value="state.pageSize"
            aria-label="Jumlah baris per halaman"
            class="rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-sm text-muted focus:border-accent focus:outline-none"
            @change="
              patch({ pageSize: Number(($event.target as HTMLSelectElement).value) as CabinetListQuery['pageSize'] })
            "
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

      <!-- ERROR -->
      <StateMessage
        v-if="failure"
        tone="danger"
        title="Gagal memuat daftar cabinet"
        :description="failure.message"
        action-label="Coba lagi"
        @action="refresh()"
      />

      <!-- LOADING (pertama kali) -->
      <div v-else-if="isFirstLoad" class="divide-y divide-border" aria-hidden="true">
        <div v-for="i in 8" :key="i" class="flex items-center gap-4 px-4 py-3.5">
          <div class="h-4 w-24 rounded shimmer" />
          <div class="h-4 w-32 rounded shimmer" />
          <div class="h-5 w-20 rounded-full shimmer" />
          <div class="ml-auto h-4 w-28 rounded shimmer" />
          <div class="h-4 w-10 rounded shimmer" />
          <div class="h-4 w-20 rounded shimmer" />
        </div>
      </div>

      <!-- EMPTY -->
      <StateMessage
        v-else-if="rows.length === 0 && isFiltered"
        title="Tidak ada cabinet yang cocok"
        description="Tidak ada cabinet yang sesuai dengan kata kunci dan filter ini. Coba longgarkan filternya."
        action-label="Bersihkan filter"
        @action="reset()"
      />
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
          <!-- Tabel untuk layar lebar -->
          <table class="hidden w-full text-left text-sm md:table">
            <thead class="border-b border-border text-xs tracking-wide text-muted uppercase">
              <tr>
                <th
                  v-for="col in COLUMNS"
                  :key="col.key"
                  scope="col"
                  class="px-4 py-3 font-medium"
                  :class="col.key === 'swaps24h' ? 'text-right' : ''"
                  :aria-sort="col.sortable ? ariaSort(col.key) : undefined"
                >
                  <button
                    v-if="col.sortable"
                    type="button"
                    class="inline-flex items-center gap-1 transition-colors hover:text-text"
                    :class="state.sort === col.key ? 'text-text' : ''"
                    @click="toggleSort(col.key as CabinetListQuery['sort'])"
                  >
                    {{ col.label }}
                    <svg
                      class="size-3.5 transition-transform"
                      :class="[
                        state.sort === col.key ? 'opacity-100' : 'opacity-30',
                        state.sort === col.key && state.dir === 'asc' ? 'rotate-180' : '',
                      ]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.2"
                      aria-hidden="true"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m0 0 5-5m-5 5-5-5" />
                    </svg>
                  </button>
                  <span v-else>{{ col.label }}</span>
                </th>
              </tr>
            </thead>

            <tbody class="divide-y divide-border">
              <tr
                v-for="cabinet in rows"
                :key="cabinet.code"
                class="transition-colors hover:bg-surface-2"
              >
                <td class="px-4 py-3">
                  <NuxtLink
                    :to="`/cabinets/${cabinet.code}`"
                    class="font-mono font-medium text-text hover:text-accent hover:underline"
                  >
                    {{ cabinet.code }}
                  </NuxtLink>
                </td>
                <td class="px-4 py-3">
                  <span class="text-text">{{ cabinet.branchName }}</span>
                  <span class="ml-1.5 text-xs text-faint">{{ cabinet.branchCode }}</span>
                </td>
                <td class="px-4 py-3">
                  <StatusBadge
                    :status="cabinet.status"
                    :is-stale="cabinet.isStale"
                    :never-reported="cabinet.lastHeartbeatAt === null"
                  />
                </td>
                <td class="px-4 py-3">
                  <SlotFillBar
                    :filled="cabinet.slotsFilled"
                    :ready="cabinet.slotsReady"
                    :total="cabinet.slotsTotal"
                  />
                </td>
                <td class="px-4 py-3 text-right font-medium tabular-nums">
                  {{ formatNumber(cabinet.swaps24h) }}
                </td>
                <td class="px-4 py-3 text-muted">
                  <TimeAgo :iso="cabinet.lastHeartbeatAt" />
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Kartu untuk layar sempit: tabel enam kolom tidak bisa dipakai di
               ponsel, dan tim ops memang membukanya dari lapangan. -->
          <ul class="divide-y divide-border md:hidden">
            <li v-for="cabinet in rows" :key="cabinet.code">
              <NuxtLink :to="`/cabinets/${cabinet.code}`" class="block px-4 py-3.5 hover:bg-surface-2">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-mono font-medium">{{ cabinet.code }}</p>
                    <p class="mt-0.5 text-sm text-muted">{{ cabinet.branchName }}</p>
                  </div>
                  <StatusBadge
                    :status="cabinet.status"
                    :is-stale="cabinet.isStale"
                    :never-reported="cabinet.lastHeartbeatAt === null"
                  />
                </div>

                <div class="mt-3 flex items-center justify-between gap-3">
                  <SlotFillBar
                    :filled="cabinet.slotsFilled"
                    :ready="cabinet.slotsReady"
                    :total="cabinet.slotsTotal"
                  />
                  <p class="text-sm text-muted">
                    <span class="font-medium text-text tabular-nums">{{ formatNumber(cabinet.swaps24h) }}</span>
                    swap · <TimeAgo :iso="cabinet.lastHeartbeatAt" />
                  </p>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <PaginationBar v-if="meta" :meta="meta" @change="patch({ page: $event })" />
      </template>
    </div>
  </div>
</template>
