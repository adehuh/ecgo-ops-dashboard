<script setup lang="ts">
import { computed } from 'vue'
import ConditionMarker from '@/components/ConditionMarker.vue'
import Sparkline from '@/components/Sparkline.vue'
import { formatNumber } from '@/utils/format'
import type { ConditionMarker as MarkerShape } from '@/utils/condition'
import type { ConditionFilter, FleetSummary } from '@shared/contracts/cabinets'

/**
 * Pita kesehatan armada — pengganti deretan empat kartu KPI (§12.1 nomor 1).
 * Komponen lamanya (KpiStrip.vue) sudah dihapus, bukan ditinggal menganggur.
 *
 * Empat kartu KPI menjawab "apa keadaan armada". Yang dibuka ops adalah "mana
 * yang saya tangani lebih dulu". Angka 17 di kartu lama tidak bisa diklik, dan
 * untuk melihat ke-17 itu pengguna harus menebak filter mana yang menghasilkan
 * 17. Di sini tiap segmen dan tiap chip ADALAH filternya, dengan jumlahnya
 * menempel di tombolnya sendiri — nol tebakan.
 *
 * Tiap jumlah di sini datang dari `/api/summary`, dan tiap chip memakai nilai
 * `status` yang menghasilkan JUMLAH BARIS YANG SAMA PERSIS. Ada test kontrak
 * yang membandingkan keduanya, karena chip yang menjanjikan 5 lalu menampilkan
 * 7 baris hanya memindahkan tebak-tebakannya, bukan menghapusnya.
 */
const props = defineProps<{
  summary: FleetSummary | null
  pending: boolean
  active: readonly ConditionFilter[]
}>()

const emit = defineEmits<{
  toggle: [filter: ConditionFilter]
  /** Kartu ponsel: pasang SELURUH himpunan "perlu perhatian" sekaligus. */
  attention: []
}>()

type Chip = {
  key: string
  label: string
  /**
   * `undefined` selama ringkasan belum tiba — BUKAN 0.
   *
   * Nol adalah pernyataan ("tidak ada cabinet offline"), dan menampilkannya
   * sebelum datanya ada adalah berbohong dengan angka. Ini prinsip yang sama
   * dengan §7.3 untuk data basi, hanya pada keadaan memuat.
   */
  count: number | undefined
  marker: MarkerShape
  /** Warna isian segmen pita — penuh, bukan bertint. */
  bar: string
  idle: string
  activeClass: string
  filter: ConditionFilter
  /** Ikut jadi segmen pita? "0 slot siap" tidak: ia beririsan dengan yang lain. */
  inBar: boolean
}

/**
 * Urutan mengikuti prototipe: Sehat, Offline, Heartbeat basi, Perawatan,
 * 0 slot siap.
 *
 * Bentuk penanda TIDAK mengikuti tabel chip di handoff, yang memberi Offline
 * lingkaran dan heartbeat-basi persegi. Itu bertabrakan dengan kosakata yang
 * dipakai seluruh aplikasi ini — lingkaran = sehat, cincin = kritis, segitiga =
 * peringatan, persegi = perawatan. Dua kosakata bentuk di satu layar lebih
 * buruk daripada menyimpang dari handoff.
 */
const chips = computed<Chip[]>(() => {
  const s = props.summary

  return [
    {
      key: 'online',
      // Dulu berlabel "Sehat" dengan jumlah `total - needsAttention`, tapi
      // filternya `status=ONLINE`. Itu DUA definisi berbeda di satu tombol:
      // ONLINE mencakup yang heartbeat-nya basi, sehingga chip bisa menuliskan
      // 33 lalu menghasilkan 38 baris — persis tebak-tebakan yang redesign ini
      // ada untuk menghapus, dan satu-satunya chip yang luput dari test.
      //
      // Sekarang label, jumlah, dan filternya menyebut hal yang SAMA: status.
      // "Seberapa sehat" tetap terjawab oleh angka besar di atas dan oleh dua
      // chip kondisi di bawah.
      label: 'Online',
      count: s?.online,
      marker: 'circle',
      bar: 'bg-ok',
      idle: 'border-border-raised text-label',
      activeClass: 'border-ok bg-ok/22 text-ok',
      filter: 'ONLINE',
      inBar: true,
    },
    {
      key: 'offline',
      label: 'Offline',
      count: s?.offline,
      marker: 'ring',
      bar: 'bg-danger',
      idle: 'border-danger/45 bg-danger/14 text-danger-tint',
      activeClass: 'border-danger bg-danger/22 text-danger-tint',
      filter: 'OFFLINE',
      inBar: true,
    },
    {
      key: 'basi',
      label: 'Heartbeat basi',
      count: s?.stale,
      marker: 'triangle',
      bar: 'bg-warn',
      idle: 'border-warn/45 bg-warn/14 text-warn-tint',
      activeClass: 'border-warn bg-warn/22 text-warn-tint',
      filter: 'STALE_HEARTBEAT',
      // Bagian dari Online, bukan kategori sejajar dengannya: memasukkannya ke
      // pita membuat total segmen melebihi ukuran armada. Ia tetap chip filter.
      inBar: false,
    },
    {
      key: 'perawatan',
      label: 'Perawatan',
      count: s?.maintenance,
      marker: 'square',
      bar: 'bg-info',
      idle: 'border-info/40 bg-info/13 text-info-tint',
      activeClass: 'border-info bg-info/22 text-info-tint',
      filter: 'MAINTENANCE',
      inBar: true,
    },
    {
      key: 'noready',
      label: '0 slot siap',
      count: s?.noReadySlots,
      marker: 'ring',
      bar: 'bg-danger',
      idle: 'border-danger/45 bg-danger/14 text-danger-tint',
      activeClass: 'border-danger bg-danger/22 text-danger-tint',
      filter: 'NO_READY_SLOTS',
      // Sengaja di luar pita: cabinet 0-slot-siap juga terhitung di salah satu
      // segmen lain, dan menambahkannya akan membuat pita menjumlah lebih dari
      // ukuran armadanya sendiri.
      inBar: false,
    },
  ]
})

const barChips = computed(() => chips.value.filter((c) => c.inBar && (c.count ?? 0) > 0))

const isActive = (c: Chip) => props.active.includes(c.filter)

const failureRate = computed(() => {
  const s = props.summary
  if (!s) return '—'
  const attempts = s.swaps24h + s.failed24h
  if (attempts === 0) return '0'
  return ((s.failed24h / attempts) * 100).toFixed(1).replace('.', ',')
})

/** Jam puncak, dibaca dari data sungguhan — bukan angka yang ditulis tangan. */
const peak = computed(() => {
  const h = props.summary?.hourly
  if (!h?.length) return null

  const max = Math.max(...h)
  if (max === 0) return null

  const idx = h.indexOf(max)
  // Bucket 0 adalah 23 jam lalu, bucket 23 adalah jam ini.
  const at = new Date(Date.now() - (h.length - 1 - idx) * 3_600_000)
  const jam = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at)

  return { max, jam }
})

const startHour = computed(() => {
  const h = props.summary?.hourly
  if (!h?.length) return null
  const at = new Date(Date.now() - (h.length - 1) * 3_600_000)
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at)
})

/** Placeholder saat memuat: garis, bukan nol. Nol adalah angka yang salah. */
const show = (v: number | undefined) => (v === undefined ? '—' : formatNumber(v))
</script>

<template>
  <!--
    PONSEL: satu kartu peringatan yang bisa diketuk, bukan pita penuh.

    Di layar 390px, lima chip dan sebuah bar tersegmen menghabiskan setengah
    layar untuk sesuatu yang hanya bisa disentuh dengan tepat oleh jempol yang
    beruntung. Yang benar-benar ditindaklanjuti di lapangan cuma satu:
    "berapa yang perlu perhatian, tunjukkan". "Total cabinet: 50" tidak bisa
    ditindaklanjuti dari motor dan tidak layak mendapat ruang itu.
  -->
  <div v-if="!summary" class="h-[76px] rounded-xl shimmer lg:hidden" aria-hidden="true" />

  <button
    v-else
    type="button"
    class="flex w-full items-center gap-3 rounded-xl border border-l-[3px] border-warn/40 border-l-warn bg-surface p-3.5 text-left lg:hidden"
    @click="emit('attention')"
  >
    <span class="text-[32px] leading-none font-extrabold text-warn tabular-nums">
      {{ formatNumber(summary.needsAttention) }}
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-[13px] font-semibold">perlu perhatian</span>
      <span class="block truncate text-xs text-label">
        {{ summary.offline }} offline · {{ summary.stale }} basi ·
        {{ summary.maintenance }} perawatan
      </span>
    </span>
    <svg
      class="size-4 shrink-0 text-faint"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  </button>

  <section
    class="hidden gap-4 rounded-[14px] border border-border bg-surface px-5 py-[18px] lg:grid lg:grid-cols-[1fr_340px]"
    aria-label="Kesehatan armada"
  >
    <!-- Kiri: judul, pita tersegmen, chip -->
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-end gap-x-3.5 gap-y-1">
        <div class="flex items-baseline gap-2">
          <span v-if="pending && !summary" class="h-9 w-14 rounded-md shimmer" aria-hidden="true" />
          <span v-else class="text-[38px] leading-none font-extrabold text-warn tabular-nums">
            {{ formatNumber(summary?.needsAttention ?? 0) }}
          </span>
          <span class="text-sm font-medium text-text">cabinet perlu perhatian</span>
        </div>
        <span class="ml-auto text-xs text-faint">Klik segmen untuk memfilter tabel</span>
      </div>

      <!-- Segmen pita adalah PARTISI STATUS: Online + Perawatan + Offline
           selalu tepat sama dengan ukuran armada, karena ketiga status itu
           saling lepas dan menghabiskan semua kemungkinan. Kondisi turunan
           (basi, 0 slot siap) sengaja tidak ikut — keduanya beririsan dengan
           status, dan pita yang menjumlah lebih dari 50 dari 50 cabinet adalah
           gambar yang berbohong.

           Lebar tiap segmen proporsional terhadap jumlah sungguhan, jadi
           bentuknya menceritakan distribusinya sebelum satu angka dibaca. -->
      <div class="flex h-3 gap-[3px] overflow-hidden rounded-full">
        <button
          v-for="c in barChips"
          :key="c.key"
          type="button"
          class="h-full cursor-pointer rounded-full transition-opacity first:rounded-l-full last:rounded-r-full"
          :class="[c.bar, isActive(c) ? 'opacity-100' : 'opacity-90 hover:opacity-100']"
          :style="{ flexGrow: c.count ?? 0 }"
          :title="`${c.count} ${c.label.toLowerCase()}`"
          :aria-label="`Filter ${c.label}: ${c.count} cabinet`"
          :aria-pressed="isActive(c)"
          @click="emit('toggle', c.filter)"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="(c, i) in chips"
          :key="c.key"
          type="button"
          class="inline-flex cursor-pointer items-center gap-[7px] rounded-lg border px-[11px] py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors"
          :class="isActive(c) ? c.activeClass : `${c.idle} hover:border-border-strong`"
          :aria-pressed="isActive(c)"
          :data-shortcut="i + 1"
          @click="emit('toggle', c.filter)"
        >
          <ConditionMarker :shape="c.marker" :class="c.key === 'online' ? 'text-ok' : ''" />
          {{ c.label }}
          <!-- Jumlahnya ditandai tersendiri: label "0 slot siap" sudah memuat
               angka, jadi membaca teks chip utuh tidak bisa membedakan angka
               label dari angka hitungan. -->
          <span data-cy="chip-count" class="font-semibold tabular-nums">{{ show(c.count) }}</span>
        </button>
      </div>
    </div>

    <!-- Kanan: total 24 jam + sparkline armada -->
    <div class="flex flex-col justify-between gap-2.5 border-border lg:border-l lg:pl-5">
      <div class="flex items-baseline justify-between gap-2">
        <div>
          <p class="text-[11px] font-semibold tracking-[.06em] text-label uppercase">
            Swap berhasil · 24 jam
          </p>
          <p class="mt-0.5 text-[26px] leading-[1.1] font-extrabold tabular-nums">
            {{ show(summary?.swaps24h) }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-[11px] font-semibold tracking-[.06em] text-label uppercase">Gagal</p>
          <p class="mt-0.5 text-lg leading-[1.2] font-extrabold text-warn tabular-nums">
            {{ failureRate }}<span class="text-[13px]">%</span>
          </p>
        </div>
      </div>

      <div>
        <Sparkline
          v-if="summary?.hourly?.length"
          :values="summary.hourly"
          :width="300"
          :height="42"
          :stroke-width="8"
          class="!w-full"
        />
        <div v-else class="h-[42px] rounded shimmer" aria-hidden="true" />

        <p class="mt-1.5 text-[11px] text-faint">
          <template v-if="peak && startHour">
            Per jam sejak {{ startHour }} WIB · puncak {{ peak.max }} pukul {{ peak.jam }}
          </template>
          <template v-else>Belum ada swap dalam 24 jam terakhir</template>
        </p>
      </div>
    </div>
  </section>
</template>
