<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  evaluateCheckIn,
  type Branch,
  type RejectReason,
  type Result,
} from '@shared/geofence/evaluateCheckIn'

/**
 * Halaman peragaan untuk Bagian B1 — Multi-Branch Geofence Check-In.
 *
 * Bukan bagian dari Bagian D dan tidak menyentuh database: ia meng-import fungsi
 * yang SAMA PERSIS dengan yang diuji `tests/geofence.spec.ts`, bukan salinannya,
 * lalu menjalankannya di browser. Tujuannya supaya perilakunya bisa dicoba
 * langsung saat Live Defense, bukan hanya dibaca dari kode.
 *
 * Data cabang dan kelima kasus uji diambil apa adanya dari soal
 * (TEST-Fullstack-Developer-ECGO, Bagian B1).
 */

const branches: Branch[] = [
  { id: 'B-01', name: 'Kemayoran', lat: -6.1569, lng: 106.8449, radiusM: 150, active: true },
  { id: 'B-02', name: 'Sunter', lat: -6.142, lng: 106.872, radiusM: 200, active: true },
  { id: 'B-03', name: 'Cakung', lat: -6.185, lng: 106.945, radiusM: 120, active: false },
]

const lat = ref(-6.157)
const lng = ref(106.845)
const accuracy = ref(12)

const run = (lat: number, lng: number, accuracyM: number, at = new Date().toISOString()): Result =>
  evaluateCheckIn({ userId: 'U-DEMO', lat, lng, accuracyM, at }, branches)

const result = computed(() => run(Number(lat.value), Number(lng.value), Number(accuracy.value)))

/**
 * Ekspektasi kelima kasus soal, ditulis sebagai DATA, bukan kalimat.
 *
 * Versi sebelumnya menaruh ekspektasi sebagai teks ("VALID B-01") di sebelah
 * hasil yang juga teks, sehingga yang memutuskan lulus atau tidak adalah mata
 * pembacanya. Di sini bentuknya dibandingkan field demi field, jadi halaman ini
 * bisa menyatakan sendiri "5 dari 5 lulus" — dan akan berteriak kalau suatu saat
 * tidak.
 */
type Expectation =
  | { status: 'VALID'; branchId: string }
  | { status: 'OUT_OF_RANGE'; nearestBranchId: string | null }
  | { status: 'REJECTED'; reason: RejectReason }

const CASES: {
  no: number
  lat: number
  lng: number
  accuracyM: number
  note: string
  expect: Expectation
}[] = [
  {
    no: 1,
    lat: -6.157,
    lng: 106.845,
    accuracyM: 12,
    note: 'Di dalam radius Kemayoran, akurasi bagus',
    expect: { status: 'VALID', branchId: 'B-01' },
  },
  {
    no: 2,
    lat: -6.1851,
    lng: 106.9451,
    accuracyM: 10,
    note: 'Tepat di atas Cakung — tapi cabangnya nonaktif',
    expect: { status: 'OUT_OF_RANGE', nearestBranchId: 'B-02' },
  },
  {
    no: 3,
    lat: -6.157,
    lng: 106.845,
    accuracyM: 140,
    note: 'Posisi benar, tapi akurasi GPS di atas 100 m',
    expect: { status: 'REJECTED', reason: 'LOW_ACCURACY' },
  },
  {
    no: 4,
    lat: 0,
    lng: 0,
    accuracyM: 5,
    note: 'Null Island — nilai default device saat GPS gagal',
    expect: { status: 'REJECTED', reason: 'INVALID_COORDINATE' },
  },
  {
    no: 5,
    lat: -6.3,
    lng: 106.8,
    accuracyM: 15,
    note: 'Jauh dari semua cabang; terdekat Kemayoran',
    expect: { status: 'OUT_OF_RANGE', nearestBranchId: 'B-01' },
  },
]

/** Jam tetap: kasus soal tidak boleh berubah hasil karena dijalankan sore hari. */
const FIXED_AT = '2026-08-10T07:30:00+07:00'

/**
 * Ekspektasi sebagai satu string.
 *
 * Dirakit di sini, bukan dari beberapa <template v-if> berdampingan: Vue
 * memangkas spasi antar tag, dan versi inline-nya mencetak "VALIDB-01".
 */
function expectLabel(e: Expectation): string {
  if (e.status === 'VALID') return `VALID · ${e.branchId}`
  if (e.status === 'REJECTED') return `REJECTED / ${e.reason}`
  return e.nearestBranchId ? `OUT_OF_RANGE → ${e.nearestBranchId}` : 'OUT_OF_RANGE'
}

function matches(actual: Result, expect: Expectation): boolean {
  if (actual.status !== expect.status) return false
  if (actual.status === 'VALID' && expect.status === 'VALID') {
    return actual.branchId === expect.branchId
  }
  if (actual.status === 'OUT_OF_RANGE' && expect.status === 'OUT_OF_RANGE') {
    return actual.nearestBranchId === expect.nearestBranchId
  }
  if (actual.status === 'REJECTED' && expect.status === 'REJECTED') {
    return actual.reason === expect.reason
  }
  return false
}

const evaluated = CASES.map((c) => {
  const actual = run(c.lat, c.lng, c.accuracyM, FIXED_AT)
  return { ...c, actual, pass: matches(actual, c.expect) }
})

const passed = evaluated.filter((c) => c.pass).length

/** Cabang yang sedang dirujuk hasil — dipakai menampilkan jarak TERHADAP radiusnya. */
const referenced = computed(() => {
  const r = result.value
  const id = r.status === 'VALID' ? r.branchId : r.status === 'OUT_OF_RANGE' ? r.nearestBranchId : null
  return id ? (branches.find((b) => b.id === id) ?? null) : null
})

const LABEL: Record<Result['status'], string> = {
  VALID: 'VALID',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  REJECTED: 'REJECTED',
}

const TONE: Record<Result['status'], string> = {
  VALID: 'border-ok/55 bg-ok/14 text-ok',
  OUT_OF_RANGE: 'border-warn/45 bg-warn/14 text-warn-tint',
  REJECTED: 'border-danger/45 bg-danger/16 text-danger-tint',
}

/** Ringkasan satu baris untuk tabel kasus. */
const summarise = (r: Result): string => {
  if (r.status === 'VALID') return `VALID · ${r.branchId} · ${r.distanceM} m`
  if (r.status === 'OUT_OF_RANGE') {
    return r.nearestBranchId
      ? `OUT_OF_RANGE · terdekat ${r.nearestBranchId} · ${r.distanceM} m`
      : 'OUT_OF_RANGE · tidak ada cabang yang bisa dinilai'
  }
  return `REJECTED · ${r.reason}`
}

const apply = (c: (typeof CASES)[number]) => {
  lat.value = c.lat
  lng.value = c.lng
  accuracy.value = c.accuracyM
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 class="text-2xl font-extrabold tracking-tight">Geofence check-in</h1>
        <!-- Dihitung, bukan diketik: kalau fungsinya berubah dan kasus soal
             tidak lagi lulus, halaman ini yang memberi tahu lebih dulu. -->
        <span
          class="text-[11px] font-semibold"
          :class="passed === evaluated.length ? 'text-ok' : 'text-danger'"
        >
          {{ passed }} dari {{ evaluated.length }} kasus soal lulus
        </span>
      </div>
      <p class="mt-1 max-w-2xl text-sm text-muted">
        Peragaan langsung <code class="font-mono text-xs text-text">evaluateCheckIn()</code> dari
        Bagian B1. Fungsi yang dijalankan di sini adalah modul yang sama yang diuji unit test —
        tidak ada salinan terpisah.
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="rounded-[14px] border border-border bg-surface p-5">
        <h2 class="mb-4 text-sm font-semibold">Posisi check-in</h2>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1.5 block text-[11px] font-semibold text-soft">Latitude</span>
            <input
              v-model.number="lat"
              type="number"
              step="0.0001"
              class="w-full rounded-[9px] border border-border-raised bg-surface-2 px-3 py-[11px] font-mono text-sm focus:border-accent-ink focus:outline-none"
            >
          </label>
          <label class="block">
            <span class="mb-1.5 block text-[11px] font-semibold text-soft">Longitude</span>
            <input
              v-model.number="lng"
              type="number"
              step="0.0001"
              class="w-full rounded-[9px] border border-border-raised bg-surface-2 px-3 py-[11px] font-mono text-sm focus:border-accent-ink focus:outline-none"
            >
          </label>
        </div>

        <label class="mt-3 block">
          <span class="mb-1.5 flex items-baseline justify-between text-[11px] font-semibold text-soft">
            Akurasi GPS
            <span class="font-mono tabular-nums">{{ accuracy }} m</span>
          </span>
          <input
            v-model.number="accuracy"
            type="range"
            min="0"
            max="200"
            class="w-full accent-[var(--accent)]"
          >
          <span class="mt-1 block text-[11px] text-faint">
            Di atas 100 m ditolak (aturan 5). Toleransi yang disumbangkan akurasi dibatasi 30 m
            (aturan 4).
          </span>
        </label>

        <!-- Banner hasil: satu baris. Jaraknya ditulis TERHADAP radiusnya —
             "74 m / 150 m" menjawab "seberapa jauh dari batas", sementara "74 m"
             sendirian menuntut pembacanya mengingat radius tiap cabang. -->
        <div
          class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2.5"
          :class="TONE[result.status]"
          role="status"
        >
          <span class="rounded-md border border-current px-2 py-0.5 text-xs font-bold">
            {{ LABEL[result.status] }}
          </span>

          <span v-if="result.status === 'VALID'" class="text-sm font-medium text-text">
            {{ result.branchName }}
          </span>
          <span v-else-if="result.status === 'REJECTED'" class="text-sm text-text">
            {{ result.reason }}
          </span>
          <span v-else-if="referenced" class="text-sm text-text">
            terdekat {{ referenced.name }}
          </span>
          <span v-else class="text-sm text-text">tidak ada cabang yang bisa dinilai</span>

          <span
            v-if="result.status !== 'REJECTED' && referenced && result.distanceM !== null"
            class="ml-auto font-mono text-sm tabular-nums"
          >
            {{ result.distanceM }} m / {{ referenced.radiusM }} m
          </span>
        </div>
      </section>

      <section class="rounded-[14px] border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold">Cabang yang terdaftar</h2>
        <ul class="flex flex-col gap-2">
          <li
            v-for="branch in branches"
            :key="branch.id"
            class="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
            :class="branch.active ? '' : 'opacity-50'"
          >
            <div>
              <span class="font-mono text-xs text-label">{{ branch.id }}</span>
              <span class="ml-2 font-medium">{{ branch.name }}</span>
            </div>
            <div class="text-right text-xs text-label">
              <p class="font-mono tabular-nums">{{ branch.lat }}, {{ branch.lng }}</p>
              <p>radius {{ branch.radiusM }} m · {{ branch.active ? 'aktif' : 'nonaktif' }}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <section class="overflow-hidden rounded-[14px] border border-border bg-surface">
      <h2 class="border-b border-border px-4 py-3 text-sm font-semibold">
        Lima kasus uji dari soal
      </h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-[13px]">
          <thead class="border-b border-border bg-table-head">
            <tr>
              <th
                v-for="h in ['#', 'Input', 'Ekspektasi', 'Hasil', '']"
                :key="h"
                scope="col"
                class="p-[9px_14px] text-[11px] font-semibold tracking-[.06em] text-label uppercase"
              >
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in evaluated"
              :key="c.no"
              class="border-b border-border-soft hover:bg-surface-2"
            >
              <td class="p-[8px_14px] tabular-nums">{{ c.no }}</td>
              <td class="p-[8px_14px]">
                <span class="font-mono text-xs text-label tabular-nums">
                  {{ c.lat }}, {{ c.lng }} · ±{{ c.accuracyM }} m
                </span>
                <p class="mt-0.5 text-xs text-dim">{{ c.note }}</p>
              </td>
              <td class="p-[8px_14px] font-mono text-xs text-label">
                {{ expectLabel(c.expect) }}
              </td>
              <td class="p-[8px_14px]">
                <span
                  class="inline-flex items-center gap-1.5 font-mono text-xs"
                  :class="c.pass ? 'text-ok' : 'text-danger'"
                >
                  <!-- Lulus ditandai bentuk DAN warna, sama seperti di seluruh
                       aplikasi ini: warna tidak pernah jadi satu-satunya sinyal. -->
                  <svg class="size-2 shrink-0" viewBox="0 0 8 8" aria-hidden="true">
                    <circle v-if="c.pass" cx="4" cy="4" r="4" fill="currentColor" />
                    <path v-else d="M4 0 8 7H0z" fill="currentColor" />
                  </svg>
                  {{ summarise(c.actual) }}
                </span>
              </td>
              <td class="p-[8px_14px] text-right">
                <button
                  type="button"
                  class="rounded-md border border-border-raised px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-text"
                  @click="apply(c)"
                >
                  Coba
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
