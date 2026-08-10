<script setup lang="ts">
import type { HourlyBucket } from '~~/shared/contracts/cabinets'

/**
 * Grafik batang swap per jam, 24 jam terakhir.
 *
 * SVG inline, tanpa library grafik. Chart.js atau ApexCharts akan menambah
 * 60–200 KB JavaScript untuk 24 buah persegi panjang — dan keduanya butuh kerja
 * tambahan justru pada bagian yang paling saya pedulikan di sini: aksesibilitas
 * dan pewarnaan yang mengikuti tema.
 *
 * Grafik adalah gambar, dan gambar tidak bisa dibaca pembaca layar. Jadi data
 * yang sama juga tersedia sebagai tabel sungguhan di dalam <figure>, terlihat
 * hanya oleh teknologi bantu.
 */
const props = defineProps<{ hourly: HourlyBucket[] }>()

const max = computed(() => Math.max(1, ...props.hourly.map((h) => h.count)))
const total = computed(() => props.hourly.reduce((sum, h) => sum + h.count, 0))

// API menjamin 24 bucket, tapi komponen ini tidak boleh meledak kalau suatu saat
// menerima array kosong — `reduce` dengan elemen pertama sebagai nilai awal akan
// menghasilkan undefined, dan `peak.count` di template melempar TypeError yang
// mematikan seluruh halaman demi satu grafik.
const peak = computed<HourlyBucket | null>(() =>
  props.hourly.length === 0
    ? null
    : props.hourly.reduce((a, b) => (b.count > a.count ? b : a), props.hourly[0]!),
)

/**
 * Judulnya menyebut jam mulai yang sebenarnya, bukan "24 jam terakhir".
 *
 * Grafik ini berisi 24 bucket JAM PENUH, jadi ia mulai dari puncak jam 23 jam
 * lalu — antara 23 dan 24 jam data. Kartu KPI di atas memakai rolling 24 jam
 * yang persis. Keduanya benar untuk keperluannya masing-masing, tapi totalnya
 * akan berbeda beberapa swap, dan angka yang berbeda tanpa penjelasan terbaca
 * sebagai bug. Menyebutkan rentangnya membuat selisih itu masuk akal.
 */
const rangeLabel = computed(() => {
  const first = props.hourly[0]
  return first ? `sejak pukul ${wibHourLabel(first.hourStart)}.00 WIB` : ''
})

// Bilangan bulat yang enak dibaca untuk garis bantu atas, supaya sumbunya tidak
// pernah bertuliskan "37".
const axisTop = computed(() => {
  const m = max.value
  const step = m <= 10 ? 2 : m <= 50 ? 10 : m <= 200 ? 25 : 100
  return Math.ceil(m / step) * step
})
</script>

<template>
  <figure class="space-y-3">
    <figcaption class="flex flex-wrap items-baseline justify-between gap-2">
      <span class="text-sm font-medium">Swap berhasil per jam · {{ rangeLabel }}</span>
      <span v-if="peak" class="text-xs text-muted">
        {{ formatNumber(total) }} swap pada rentang ini · puncak {{ peak.count }} pukul
        {{ wibHourLabel(peak.hourStart) }}.00
      </span>
    </figcaption>

    <div class="relative">
      <!-- Garis bantu + label sumbu Y -->
      <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
        <div v-for="tick in [axisTop, Math.round(axisTop / 2), 0]" :key="tick" class="flex items-center gap-2">
          <span class="w-6 shrink-0 text-right text-[10px] text-faint tabular-nums">{{ tick }}</span>
          <span class="h-px flex-1 bg-border" />
        </div>
      </div>

      <div class="relative flex h-40 items-end gap-1 pl-8">
        <div
          v-for="bucket in hourly"
          :key="bucket.hourStart"
          class="group relative flex flex-1 items-end justify-center"
          :style="{ height: '100%' }"
        >
          <div
            class="w-full rounded-t-[3px] bg-accent/75 transition-colors group-hover:bg-accent"
            :class="bucket.count === 0 ? 'bg-border' : ''"
            :style="{ height: `${Math.max(bucket.count === 0 ? 1.5 : 3, (bucket.count / axisTop) * 100)}%` }"
          />

          <!-- Tooltip hover. aria-hidden karena informasi yang sama sudah
               tersedia lewat tabel di bawah. -->
          <div
            class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-lg group-hover:block"
            aria-hidden="true"
          >
            <span class="font-medium">{{ bucket.count }}</span> swap ·
            {{ wibHourLabel(bucket.hourStart) }}.00
          </div>
        </div>
      </div>
    </div>

    <!-- Label sumbu X tiap 3 jam; 24 label akan bertumpuk di layar sempit. -->
    <div class="flex gap-1 pl-8" aria-hidden="true">
      <span
        v-for="(bucket, i) in hourly"
        :key="bucket.hourStart"
        class="flex-1 text-center text-[10px] text-faint tabular-nums"
      >
        {{ i % 3 === 0 ? wibHourLabel(bucket.hourStart) : '' }}
      </span>
    </div>

    <table class="sr-only">
      <caption>
        Jumlah swap berhasil per jam selama 24 jam terakhir, waktu WIB
      </caption>
      <thead>
        <tr><th scope="col">Jam (WIB)</th><th scope="col">Jumlah swap</th></tr>
      </thead>
      <tbody>
        <tr v-for="bucket in hourly" :key="bucket.hourStart">
          <th scope="row">{{ wibHourLabel(bucket.hourStart) }}.00</th>
          <td>{{ bucket.count }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
