<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber, wibHourLabel } from '@/utils/format'
import type { HourlyBucket } from '@shared/contracts/cabinets'

/**
 * Grafik swap per jam, 24 jam terakhir — berhasil, gagal, dan garis dasar.
 *
 * SVG inline, tanpa library grafik (§8). Chart.js atau ApexCharts akan menambah
 * 60–200 KB JavaScript untuk 24 buah persegi panjang, dan tetap menyisakan
 * pekerjaan justru pada bagian yang paling dipedulikan di sini: aksesibilitas
 * dan pewarnaan yang mengikuti tema. Menumpuk satu seri dan menambah satu garis
 * tidak mengubah perhitungan itu.
 *
 * Dua tambahan dari versi sebelumnya (§12.8), keduanya menutup lubang nyata:
 *
 *   Kegagalan ditumpuk merah. Grafik lama hanya menggambar swap BERHASIL (§7.2),
 *   jadi cabinet yang menolak 40 rider terlihat sepi — bukan rusak. Justru itu
 *   keadaan yang paling perlu terlihat.
 *
 *   Median 7 hari sebagai garis putus-putus. Dua puluh empat batang sendirian
 *   tidak bisa menjawab "ini normal atau tidak": 12 swap pukul 3 pagi luar biasa
 *   ramai, 12 swap pukul 8 pagi berarti ada yang rusak.
 *
 * Grafik adalah gambar, dan gambar tidak bisa dibaca pembaca layar. Data yang
 * sama tersedia sebagai tabel sungguhan di dalam <figure>.
 */
const props = defineProps<{ hourly: HourlyBucket[] }>()

const W = 480
const H = 184

const totalSuccess = computed(() => props.hourly.reduce((s, h) => s + h.success, 0))
const totalFailed = computed(() => props.hourly.reduce((s, h) => s + h.failed, 0))

/** Skala mengikuti batang TERTINGGI setelah ditumpuk, plus garis mediannya. */
const max = computed(() =>
  Math.max(1, ...props.hourly.map((h) => h.success + h.failed), ...props.hourly.map((h) => h.median7d)),
)

/** Bilangan bulat yang enak dibaca, supaya sumbunya tidak pernah bertuliskan "37". */
const axisTop = computed(() => {
  const m = max.value
  const step = m <= 10 ? 2 : m <= 50 ? 10 : m <= 200 ? 25 : 100
  return Math.ceil(m / step) * step
})

// API menjamin 24 bucket, tapi komponen ini tidak boleh meledak kalau suatu saat
// menerima array kosong.
const peak = computed<HourlyBucket | null>(() =>
  props.hourly.length === 0
    ? null
    : props.hourly.reduce((a, b) => (b.success > a.success ? b : a), props.hourly[0]!),
)

/**
 * Judulnya menyebut jam mulai yang sebenarnya, bukan "24 jam terakhir".
 *
 * Grafik ini berisi 24 bucket JAM PENUH, jadi ia mulai dari puncak jam 23 jam
 * lalu — antara 23 dan 24 jam data. Kartu statistik di atas memakai rolling 24
 * jam yang persis, jadi totalnya berbeda beberapa swap. Angka yang berbeda tanpa
 * penjelasan terbaca sebagai bug; menyebutkan rentangnya membuatnya masuk akal.
 */
const rangeLabel = computed(() => {
  const first = props.hourly[0]
  return first ? `sejak pukul ${wibHourLabel(first.hourStart)}.00 WIB` : ''
})

const y = (value: number) => H - (value / axisTop.value) * H

const barWidth = computed(() => W / Math.max(1, props.hourly.length))

/** Batang berhasil: dari dasar ke atas. */
const successPath = computed(() =>
  props.hourly
    .map((h, i) => {
      if (h.success <= 0) return ''
      const x = i * barWidth.value + 2
      const w = barWidth.value - 4
      return `M${x} ${H}H${(x + w).toFixed(1)}V${y(h.success).toFixed(1)}H${x}Z`
    })
    .join(''),
)

/** Batang gagal: DITUMPUK di atas batang berhasil pada kolom yang sama. */
const failedPath = computed(() =>
  props.hourly
    .map((h, i) => {
      if (h.failed <= 0) return ''
      const x = i * barWidth.value + 2
      const w = barWidth.value - 4
      return `M${x} ${y(h.success).toFixed(1)}H${(x + w).toFixed(1)}V${y(h.success + h.failed).toFixed(1)}H${x}Z`
    })
    .join(''),
)

/** Garis median lewat titik tengah tiap jam. */
const medianPath = computed(() =>
  props.hourly
    .map(
      (h, i) =>
        `${i === 0 ? 'M' : 'L'}${(i * barWidth.value + barWidth.value / 2).toFixed(1)} ${y(h.median7d).toFixed(1)}`,
    )
    .join(' '),
)

const hasMedian = computed(() => props.hourly.some((h) => h.median7d > 0))
</script>

<template>
  <figure class="flex flex-col gap-3">
    <figcaption class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span class="text-sm font-semibold">Swap per jam · {{ rangeLabel }}</span>

      <!-- Legenda memakai bentuk DAN warna: kotak untuk seri batang, garis
           putus-putus untuk garis dasar. -->
      <span class="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-label">
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-[2px] bg-ok" aria-hidden="true" />
          Berhasil {{ formatNumber(totalSuccess) }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-[2px] bg-danger" aria-hidden="true" />
          Gagal {{ formatNumber(totalFailed) }}
        </span>
        <span v-if="hasMedian" class="inline-flex items-center gap-1.5">
          <svg class="h-px w-4" viewBox="0 0 16 1" aria-hidden="true">
            <line x1="0" y1="0.5" x2="16" y2="0.5" stroke="currentColor" stroke-dasharray="5 4" />
          </svg>
          Median 7 hari
        </span>
      </span>
    </figcaption>

    <div class="relative" :style="{ height: `${H}px` }">
      <!-- Garis bantu + label sumbu Y -->
      <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
        <div
          v-for="(tick, i) in [axisTop, Math.round(axisTop / 2), 0]"
          :key="tick"
          class="flex items-center gap-2"
        >
          <span class="w-5 shrink-0 text-right text-[10px] text-dim tabular-nums">{{ tick }}</span>
          <span class="h-px flex-1" :class="i === 2 ? 'bg-border-raised' : 'bg-track'" />
        </div>
      </div>

      <div class="absolute inset-y-0 right-0 left-7">
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          preserveAspectRatio="none"
          class="h-full w-full"
          aria-hidden="true"
        >
          <path :d="successPath" class="fill-ok/[.78]" />
          <!-- Gagal digambar SETELAH berhasil, jadi ia menumpuk di atasnya. -->
          <path :d="failedPath" class="fill-danger" />
          <path
            v-if="hasMedian"
            :d="medianPath"
            fill="none"
            class="stroke-neutral"
            stroke-width="1.5"
            stroke-dasharray="5 4"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>

    <!-- Label sumbu X tiap 3 jam; 24 label akan bertumpuk di layar sempit. -->
    <div class="flex pl-7" aria-hidden="true">
      <span
        v-for="(bucket, i) in hourly"
        :key="bucket.hourStart"
        class="flex-1 text-center text-[10px] text-dim tabular-nums"
      >
        {{ i % 3 === 0 ? wibHourLabel(bucket.hourStart) : '' }}
      </span>
    </div>

    <p v-if="peak" class="text-xs text-faint">
      Puncak {{ peak.success }} swap pukul {{ wibHourLabel(peak.hourStart) }}.00
    </p>

    <table class="sr-only">
      <caption>
        Swap per jam selama 24 jam terakhir, waktu WIB — berhasil, gagal, dan
        median tujuh hari
      </caption>
      <thead>
        <tr>
          <th scope="col">Jam (WIB)</th>
          <th scope="col">Berhasil</th>
          <th scope="col">Gagal</th>
          <th scope="col">Median 7 hari</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="bucket in hourly" :key="bucket.hourStart">
          <th scope="row">{{ wibHourLabel(bucket.hourStart) }}.00</th>
          <td>{{ bucket.success }}</td>
          <td>{{ bucket.failed }}</td>
          <td>{{ bucket.median7d }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
