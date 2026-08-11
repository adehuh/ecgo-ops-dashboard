<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConditionPill from '@/components/ConditionPill.vue'
import SlotGrid from '@/components/SlotGrid.vue'
import StateMessage from '@/components/StateMessage.vue'
import SwapChart from '@/components/SwapChart.vue'
import TimeAgo from '@/components/TimeAgo.vue'
import { apiFetch, describeApiError, toQueryString } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useNow } from '@/composables/useNow'
import { deriveCondition } from '@/utils/condition'
import {
  formatDate,
  formatDateTime,
  formatDurationSeconds,
  formatFull,
  formatNumber,
} from '@/utils/format'
import {
  cabinetListQuerySchema,
  type CabinetDetailResponse,
  type CabinetListResponse,
  type CabinetStatus,
  type CabinetStatusPatchResponse,
} from '@shared/contracts/cabinets'

const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code ?? ''))

const { data, error, isFirstLoad, refresh } = useApi<CabinetDetailResponse>(
  () => `/api/cabinets/${encodeURIComponent(code.value)}`,
)

const cabinet = computed(() => data.value?.data ?? null)
const failure = computed(() => error.value)
const now = useNow()

// ---------------------------------------------------------------------------
// Prev / next menyusuri daftar yang BARU SAJA dilihat
// ---------------------------------------------------------------------------

/**
 * Daftar saudara SELALU diambil, bukan hanya saat rutenya membawa parameter.
 *
 * Versi pertama menggerbangi ini pada "apakah ada parameter daftar di URL", dan
 * hasilnya fiturnya nyaris tidak pernah muncul: tampilan daftar bawaan sengaja
 * punya URL bersih tanpa parameter sama sekali (nilai yang sama dengan default
 * tidak ditulis), jadi mengeklik baris dari layar yang paling sering dipakai
 * justru tidak memberi konteks apa pun. Urutan bawaan tetap urutan yang jelas —
 * keparahan menurun, halaman satu — jadi tidak ada alasan menyembunyikannya.
 *
 * Harganya satu permintaan tambahan di halaman detail. Itu satu, bukan N.
 */
const listQuery = computed(() => {
  const parsed = cabinetListQuerySchema.safeParse(route.query)
  if (!parsed.success) return null
  const s = parsed.data
  return {
    q: s.q || undefined,
    status: s.status,
    sort: s.sort,
    dir: s.dir,
    page: s.page,
    pageSize: s.pageSize,
  }
})

const { data: siblingsData } = useApi<CabinetListResponse>(() =>
  listQuery.value ? `/api/cabinets${toQueryString(listQuery.value)}` : '',
)

const siblings = computed(() => siblingsData.value?.data.map((c) => c.code) ?? [])

const position = computed(() => siblings.value.indexOf(code.value))

const neighbours = computed(() => {
  const i = position.value
  if (i < 0) return { prev: null as string | null, next: null as string | null }
  return {
    prev: i > 0 ? (siblings.value[i - 1] ?? null) : null,
    next: i < siblings.value.length - 1 ? (siblings.value[i + 1] ?? null) : null,
  }
})

const goTo = (target: string | null) => {
  if (target) void router.push({ path: `/cabinets/${target}`, query: route.query })
}

/** Kembali ke daftar dengan filter dan halaman yang sama seperti saat ditinggalkan. */
const listRoute = computed(() => ({ path: '/cabinets', query: route.query }))

// ---------------------------------------------------------------------------
// Kondisi dan kebasian
// ---------------------------------------------------------------------------

/**
 * Kapan data slot tidak boleh dipercaya sebagai keadaan saat ini.
 *
 * Ditampilkan, bukan disembunyikan — teknisi butuh kondisi terakhir yang
 * diketahui sebelum cabinet putus. Tapi ditampilkan dengan jujur: mengirim rider
 * ke cabinet yang "FULL" tiga jam lalu adalah perjalanan sia-sia.
 */
const staleness = computed(() => {
  const c = cabinet.value
  if (!c) return null

  if (c.lastHeartbeatAt === null) {
    return {
      title: 'Cabinet ini belum pernah mengirim heartbeat',
      body: 'Kemungkinan baru dipasang dan belum terhubung. State slot di bawah adalah nilai awal, bukan pembacaan dari perangkat.',
    }
  }
  if (c.status === 'OFFLINE') {
    return {
      title: 'Cabinet sedang offline',
      body: 'State slot di bawah adalah kondisi terakhir yang diketahui sebelum koneksi terputus. Kondisi sebenarnya sekarang bisa berbeda.',
    }
  }
  if (c.isStale) {
    return {
      title: 'Cabinet melaporkan diri online, tetapi sudah lama tidak terdengar',
      body: 'Statusnya masih ONLINE sementara heartbeat-nya tertinggal. Perlakukan pembacaan di bawah sebagai data lama sampai heartbeat berikutnya masuk.',
    }
  }
  return null
})

const slotsReady = computed(
  () => cabinet.value?.slots.filter((s) => s.state === 'FULL').length ?? 0,
)
const slotsFilled = computed(
  () => cabinet.value?.slots.filter((s) => s.batteryId !== null).length ?? 0,
)

/** Frasa kondisi yang SAMA dengan yang ditulis di tabel daftar. */
const condition = computed(() => {
  const c = cabinet.value
  if (!c) return null
  return deriveCondition(
    {
      status: pendingStatus.value ?? c.status,
      slotsReady: slotsReady.value,
      lastHeartbeatAt: c.lastHeartbeatAt,
      isStale: c.isStale && pendingStatus.value === null,
    },
    now.value,
  )
})

const attempts = computed(() =>
  cabinet.value ? cabinet.value.swaps24h + cabinet.value.failed24h : 0,
)

const stats = computed(() => {
  const c = cabinet.value
  if (!c) return []

  const charging = c.slots.filter((s) => s.state === 'CHARGING').length

  return [
    { label: 'Swap berhasil', value: formatNumber(c.swaps24h), hint: 'rolling 24 jam' },
    {
      label: 'Gagal',
      value: formatNumber(c.failed24h),
      hint: attempts.value
        ? `${((c.failed24h / attempts.value) * 100).toFixed(1)}% dari ${attempts.value} percobaan`
        : 'belum ada percobaan',
      tone: c.failed24h > 0 ? 'warn' : undefined,
    },
    {
      label: 'Siap ditukar',
      value: `${slotsReady.value}/${c.slotCount}`,
      hint: `${slotsFilled.value} terisi · ${charging} mengisi`,
    },
    // Menggantikan "Terpasang sejak", yang pindah ke baris metadata judul: itu
    // data referensi, bukan metrik, dan tidak berubah sepanjang umur cabinet.
    { label: 'Rider dilayani', value: formatNumber(c.riders24h), hint: 'unik, 24 jam' },
  ]
})

/**
 * Kapan panel slot terakhir berubah = slot yang PALING BARU diperbarui.
 *
 * Versi pertama memakai `slots[0].updatedAt`, yaitu slot nomor 1 — bukan yang
 * terbaru. Tiap slot punya stempel waktunya sendiri, jadi labelnya bisa
 * melaporkan "diperbarui 90 menit lalu" untuk cabinet yang salah satu slotnya
 * berubah semenit lalu. Salah dengan cara yang tidak akan pernah terlihat
 * mencurigakan.
 */
const slotsUpdatedAt = computed<string | null>(() => {
  const slots = cabinet.value?.slots ?? []
  if (slots.length === 0) return null
  return slots.reduce(
    (latest, s) => (s.updatedAt > latest ? s.updatedAt : latest),
    slots[0]!.updatedAt,
  )
})

// ---------------------------------------------------------------------------
// Optimistic UI — tandai cabinet masuk / keluar perawatan
// ---------------------------------------------------------------------------

/**
 * Di sini saya memilih OPTIMISTIC, dan itu tidak bertentangan dengan jawaban A6
 * yang memilih pessimistic untuk persetujuan klaim garansi — justru mengikutinya.
 *
 * Aturan yang saya tulis di A6: optimistic layak ketika aksinya sering, murah,
 * dan bisa dibatalkan sendiri oleh pengguna; pessimistic ketika aksinya jarang,
 * berkonsekuensi uang, dan tidak bisa ditarik kembali. Menandai cabinet masuk
 * perawatan adalah yang pertama — teknisi melakukannya sambil berdiri di depan
 * cabinet, dan salah klik diperbaiki dengan satu klik lagi.
 *
 * Yang tetap wajib ada pada optimistic: rollback yang benar-benar mengembalikan
 * keadaan, dan alasan penolakan dari server yang ditampilkan apa adanya.
 */
const pendingStatus = ref<CabinetStatus | null>(null)
const statusError = ref<string | null>(null)
const statusSaving = ref(false)

const shownStatus = computed<CabinetStatus | null>(
  () => pendingStatus.value ?? cabinet.value?.status ?? null,
)

const canToggleMaintenance = computed(() => shownStatus.value !== 'OFFLINE')

const toggleLabel = computed(() =>
  shownStatus.value === 'MAINTENANCE' ? 'Selesai perawatan' : 'Tandai perawatan',
)

async function toggleMaintenance() {
  const current = shownStatus.value
  if (!current || current === 'OFFLINE' || statusSaving.value) return

  const next: CabinetStatus = current === 'MAINTENANCE' ? 'ONLINE' : 'MAINTENANCE'

  statusError.value = null
  statusSaving.value = true
  pendingStatus.value = next // ← optimistic: layar berubah sekarang juga

  try {
    await apiFetch<CabinetStatusPatchResponse>(
      `/api/cabinets/${encodeURIComponent(code.value)}/status`,
      { method: 'PATCH', body: { status: next } },
    )
    await refresh()
  } catch (error) {
    // Rollback: kembalikan ke keadaan sebelum klik, lalu katakan kenapa.
    statusError.value = describeApiError(error).message
  } finally {
    pendingStatus.value = null
    statusSaving.value = false
  }
}

// ---------------------------------------------------------------------------
// Salin kode
// ---------------------------------------------------------------------------

const copied = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* clipboard ditolak browser — tombolnya diam saja, bukan melempar */
  }
}

// ---------------------------------------------------------------------------
// Transaksi
// ---------------------------------------------------------------------------

/** Ambang "lama" untuk satu penukaran. Di atas ini biasanya rider kesulitan. */
const SLOW_SWAP_S = 120

type SwapFilter = 'all' | 'failed' | 'slow'

const swapFilter = ref<SwapFilter>('all')

const allSwaps = computed(() => cabinet.value?.recentSwaps ?? [])
const failedCount = computed(() => allSwaps.value.filter((s) => s.status === 'FAILED').length)
const slowCount = computed(() => allSwaps.value.filter((s) => s.durationS > SLOW_SWAP_S).length)

/** Disaring di CLIENT: kedua puluh baris sudah ada di memori, jadi memanggil
 *  server lagi hanya untuk membuang sebagian darinya adalah round-trip sia-sia. */
const visibleSwaps = computed(() => {
  if (swapFilter.value === 'failed') return allSwaps.value.filter((s) => s.status === 'FAILED')
  if (swapFilter.value === 'slow') return allSwaps.value.filter((s) => s.durationS > SLOW_SWAP_S)
  return allSwaps.value
})

const SWAP_FILTERS = computed(() => [
  { key: 'all' as const, label: 'Semua' },
  { key: 'failed' as const, label: `Hanya gagal ${failedCount.value}` },
  { key: 'slow' as const, label: `Durasi > 2 mnt ${slowCount.value}` },
])

const backToList = () => router.push('/cabinets')
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ERROR: 404 dibedakan dari kegagalan lain. "Tidak ditemukan" adalah jalan
         buntu yang butuh navigasi; kegagalan jaringan butuh tombol ulangi. -->
    <div v-if="failure" class="overflow-hidden rounded-[14px] border border-border bg-surface">
      <StateMessage
        v-if="failure!.code === 'NOT_FOUND'"
        title="Cabinet tidak ditemukan"
        :description="`Tidak ada cabinet dengan kode ${code}. Mungkin sudah dinonaktifkan, atau kodenya salah ketik.`"
        action-label="Kembali ke daftar cabinet"
        @action="backToList()"
      />
      <StateMessage
        v-else
        tone="danger"
        title="Gagal memuat detail cabinet"
        :description="failure!.message"
        action-label="Coba lagi"
        @action="refresh()"
      />
    </div>

    <!-- LOADING -->
    <div v-else-if="isFirstLoad" class="flex flex-col gap-4" aria-hidden="true">
      <div class="h-10 w-72 rounded-lg shimmer" />
      <div class="grid gap-4 xl:grid-cols-[400px_1fr]">
        <div class="h-[520px] rounded-[14px] shimmer" />
        <div class="flex flex-col gap-4">
          <div class="h-24 rounded-[14px] shimmer" />
          <div class="h-64 rounded-[14px] shimmer" />
          <div class="h-72 rounded-[14px] shimmer" />
        </div>
      </div>
    </div>

    <template v-else-if="cabinet">
      <!-- ===== Baris judul ===== -->
      <div class="flex flex-wrap items-center gap-4">
        <RouterLink
          :to="listRoute"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-raised px-[11px] py-[7px] text-[13px] text-muted transition-colors hover:border-border-strong hover:text-text"
        >
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7" />
          </svg>
          Daftar
        </RouterLink>

        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="font-mono text-[26px] leading-[1.1] font-extrabold tracking-[-.02em]">
              {{ cabinet.code }}
            </h1>
            <!-- Pil kondisi, kosakata yang sama dengan tabel daftar — bukan
                 badge status yang hanya menyebut enum-nya. -->
            <ConditionPill v-if="condition" :condition="condition" />
          </div>

          <p class="mt-1 text-[13px] text-label">
            {{ cabinet.branchName }} · {{ cabinet.branchCity }} · {{ cabinet.branchCode }}
            <span class="text-dim">
              · heartbeat <TimeAgo :iso="cabinet.lastHeartbeatAt" /> · terpasang
              {{ formatDate(cabinet.installedAt) }}
            </span>
          </p>
        </div>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-border-raised bg-surface-2 px-3 py-2 text-[13px] font-medium transition-colors hover:border-border-strong"
            @click="copyCode"
          >
            {{ copied ? 'Tersalin' : 'Salin kode' }}
          </button>

          <!-- Aksi utama. Handoff menamainya "Tiket perawatan", tapi endpoint
               tiket belum ada — dan handoff sendiri melarang mengirim tombol
               yang tidak melakukan apa-apa. Yang dipakai adalah aksi yang MEMANG
               ada dan bermaksud sama: menandai cabinet masuk perawatan. -->
          <button
            v-if="canToggleMaintenance"
            type="button"
            data-cy="toggle-maintenance"
            class="rounded-lg bg-accent px-[13px] py-2 text-[13px] font-semibold text-accent-contrast transition-opacity disabled:opacity-60"
            :disabled="statusSaving"
            @click="toggleMaintenance"
          >
            {{ toggleLabel }}
          </button>

          <template v-if="neighbours.prev || neighbours.next">
            <span class="h-6 w-px bg-border" aria-hidden="true" />
            <div class="flex">
              <button
                type="button"
                class="grid size-[34px] place-items-center rounded-l-md border border-border-raised text-muted transition-colors enabled:hover:text-text disabled:opacity-35"
                :disabled="!neighbours.prev"
                aria-label="Cabinet sebelumnya di daftar"
                @click="goTo(neighbours.prev)"
              >
                <svg
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                class="-ml-px grid size-[34px] place-items-center rounded-r-md border border-border-raised text-muted transition-colors enabled:hover:text-text disabled:opacity-35"
                :disabled="!neighbours.next"
                aria-label="Cabinet berikutnya di daftar"
                @click="goTo(neighbours.next)"
              >
                <svg
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </template>
        </div>
      </div>

      <p
        v-if="statusError"
        class="rounded-lg border border-danger/45 bg-danger/16 px-3.5 py-2.5 text-sm text-danger-tint"
        role="alert"
        data-cy="status-error"
      >
        {{ statusError }}
      </p>

      <div
        v-if="staleness"
        class="flex gap-3 rounded-[14px] border border-warn/45 bg-warn/14 px-4 py-3"
        role="status"
      >
        <svg
          class="mt-0.5 size-5 shrink-0 text-warn"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path stroke-linecap="round" d="M12 7.5v5M12 16h.01" />
        </svg>
        <div>
          <p class="text-sm font-semibold text-warn-tint">{{ staleness.title }}</p>
          <p class="mt-0.5 text-sm text-muted">{{ staleness.body }}</p>
        </div>
      </div>

      <!-- ===== Dua kolom: slot kiri, sisanya kanan =====
           Pada 1440px ini menaikkan grafik dan tabel transaksi ke atas lipatan,
           yang tidak dicapai tumpukan vertikal penuh-lebar. -->
      <div class="grid items-start gap-4 xl:grid-cols-[400px_1fr]">
        <section class="rounded-[14px] border border-border bg-surface p-[18px]">
          <div class="mb-1 flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-semibold">Slot baterai</h2>
            <p class="text-xs text-label">
              Diperbarui <TimeAgo :iso="slotsUpdatedAt" />
            </p>
          </div>
          <p class="mb-3.5 text-xs leading-[1.5] text-faint">
            Tata letaknya mengikuti susunan fisik cabinet: nomor di layar = nomor di pintu, jadi
            teknisi tidak perlu menerjemahkannya.
          </p>

          <SlotGrid :slots="cabinet.slots" :stale="Boolean(staleness)" />
        </section>

        <div class="flex min-w-0 flex-col gap-4">
          <!-- Statistik -->
          <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div
              v-for="stat in stats"
              :key="stat.label"
              class="rounded-[14px] border border-border bg-surface p-[13px_15px]"
            >
              <dt class="text-[11px] font-semibold tracking-[.05em] text-label uppercase">
                {{ stat.label }}
              </dt>
              <dd
                class="mt-1 text-2xl leading-[1.1] font-extrabold tabular-nums"
                :class="stat.tone === 'warn' ? 'text-warn' : 'text-text'"
              >
                {{ stat.value }}
              </dd>
              <dd class="mt-0.5 text-[11px] text-faint">{{ stat.hint }}</dd>
            </div>
          </dl>

          <section class="rounded-[14px] border border-border bg-surface p-[18px]">
            <SwapChart :hourly="cabinet.hourly" />
          </section>

          <!-- Transaksi terakhir -->
          <section class="overflow-hidden rounded-[14px] border border-border bg-surface">
            <div
              class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"
            >
              <h2 class="text-sm font-semibold">20 swap terakhir</h2>

              <div
                class="flex gap-0.5 rounded-md border border-border-raised bg-surface-2 p-0.5"
                role="group"
                aria-label="Saring transaksi"
              >
                <button
                  v-for="f in SWAP_FILTERS"
                  :key="f.key"
                  type="button"
                  class="cursor-pointer rounded-[5px] px-2.5 py-[5px] text-xs font-medium transition-colors"
                  :class="
                    swapFilter === f.key ? 'bg-segment-active text-text' : 'text-muted hover:text-text'
                  "
                  :aria-pressed="swapFilter === f.key"
                  @click="swapFilter = f.key"
                >
                  {{ f.label }}
                </button>
              </div>
            </div>

            <StateMessage
              v-if="allSwaps.length === 0"
              title="Belum ada transaksi swap"
              description="Cabinet ini belum pernah melayani penukaran baterai."
            />
            <StateMessage
              v-else-if="visibleSwaps.length === 0"
              title="Tidak ada yang cocok dengan saringan ini"
              description="Dua puluh transaksi terakhir tidak memuat baris seperti itu."
              action-label="Tampilkan semua"
              @action="swapFilter = 'all'"
            />

            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-[13px]">
                <thead class="border-b border-border bg-table-head">
                  <tr>
                    <th
                      v-for="h in ['Waktu', 'Slot', 'Rider', 'SOC masuk → keluar', 'Durasi', 'Hasil']"
                      :key="h"
                      scope="col"
                      class="p-[8px_15px] text-[11px] font-semibold tracking-[.06em] text-label uppercase"
                    >
                      {{ h }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="swap in visibleSwaps"
                    :key="swap.id"
                    class="border-b border-border-soft hover:bg-surface-2"
                    :class="swap.status === 'FAILED' ? 'bg-danger/[.05]' : ''"
                  >
                    <td
                      class="p-[8px_15px] whitespace-nowrap tabular-nums"
                      :title="formatFull(swap.occurredAt)"
                    >
                      {{ formatDateTime(swap.occurredAt) }}
                    </td>
                    <td class="p-[8px_15px] font-mono text-xs">
                      #{{ String(swap.slotNo).padStart(2, '0') }}
                    </td>
                    <td class="p-[8px_15px] font-mono text-xs text-label">{{ swap.riderRef }}</td>

                    <!-- SOC sebagai batang, bukan "29% → 94%": panjang batangnya
                         menjawab "seberapa penuh rider pergi" tanpa membaca. -->
                    <td class="p-[8px_15px]">
                      <div class="flex items-center gap-2">
                        <span class="min-w-[30px] text-right text-label tabular-nums">
                          {{ swap.socIn }}%
                        </span>
                        <span class="h-1 w-14 overflow-hidden rounded-full bg-track">
                          <span
                            class="block h-full rounded-full"
                            :class="swap.status === 'FAILED' ? 'bg-danger' : 'bg-ok'"
                            :style="{ width: `${swap.socOut}%` }"
                          />
                        </span>
                        <span class="min-w-[34px] font-semibold tabular-nums">
                          {{ swap.socOut }}%
                        </span>
                      </div>
                    </td>

                    <td
                      class="p-[8px_15px] tabular-nums"
                      :class="swap.durationS > SLOW_SWAP_S ? 'text-warn' : 'text-muted'"
                    >
                      {{ formatDurationSeconds(swap.durationS) }}
                    </td>

                    <td class="p-[8px_15px]">
                      <span
                        class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
                        :class="
                          swap.status === 'SUCCESS'
                            ? 'bg-ok/14 text-ok'
                            : 'bg-danger/16 text-danger-tint'
                        "
                      >
                        <!-- Bentuk penanda, bukan hanya warna: lingkaran penuh
                             untuk berhasil, cincin untuk gagal. -->
                        <svg class="size-2 shrink-0" viewBox="0 0 8 8" aria-hidden="true">
                          <circle
                            v-if="swap.status === 'SUCCESS'"
                            cx="4"
                            cy="4"
                            r="4"
                            fill="currentColor"
                          />
                          <circle
                            v-else
                            cx="4"
                            cy="4"
                            r="3"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          />
                        </svg>
                        {{ swap.status === 'SUCCESS' ? 'Berhasil' : 'Gagal' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
