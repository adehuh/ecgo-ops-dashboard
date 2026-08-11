<script setup lang="ts">
import { computed, ref } from 'vue'
import { evaluateCheckIn, type Branch, type Result } from '@shared/geofence/evaluateCheckIn'

/**
 * Halaman peragaan untuk Bagian B.
 *
 * Bukan bagian dari Bagian D dan tidak menyentuh database — ia meng-import
 * fungsi yang sama persis yang diuji `tests/geofence.spec.ts` dan menjalankannya
 * di browser. Tujuannya supaya perilaku fungsinya bisa dicoba langsung saat
 * Live Defense, bukan hanya dibaca dari kode.
 */

// Data cabang persis seperti di soal.
const branches: Branch[] = [
  { id: 'B-01', name: 'Kemayoran', lat: -6.1569, lng: 106.8449, radiusM: 150, active: true },
  { id: 'B-02', name: 'Sunter', lat: -6.142, lng: 106.872, radiusM: 200, active: true },
  { id: 'B-03', name: 'Cakung', lat: -6.185, lng: 106.945, radiusM: 120, active: false },
]

const lat = ref(-6.157)
const lng = ref(106.845)
const accuracy = ref(12)

const result = computed<Result>(() =>
  evaluateCheckIn(
    {
      userId: 'U-DEMO',
      lat: Number(lat.value),
      lng: Number(lng.value),
      accuracyM: Number(accuracy.value),
      at: new Date().toISOString(),
    },
    branches,
  ),
)

/** Lima kasus dari soal, dievaluasi langsung supaya terlihat lulus atau tidak. */
const CASES = [
  { no: 1, lat: -6.157, lng: 106.845, accuracyM: 12, expect: 'VALID B-01' },
  { no: 2, lat: -6.1851, lng: 106.9451, accuracyM: 10, expect: 'OUT_OF_RANGE (B-03 nonaktif)' },
  { no: 3, lat: -6.157, lng: 106.845, accuracyM: 140, expect: 'REJECTED / LOW_ACCURACY' },
  { no: 4, lat: 0, lng: 0, accuracyM: 5, expect: 'REJECTED / INVALID_COORDINATE' },
  { no: 5, lat: -6.3, lng: 106.8, accuracyM: 15, expect: 'OUT_OF_RANGE, terdekat B-01' },
] as const

const evaluated = CASES.map((c) => ({
  ...c,
  actual: evaluateCheckIn(
    { userId: 'U-TEST', lat: c.lat, lng: c.lng, accuracyM: c.accuracyM, at: '2026-08-10T07:30:00+07:00' },
    branches,
  ),
}))

const summarise = (r: Result): string => {
  if (r.status === 'VALID') return `VALID · ${r.branchId} ${r.branchName} · ${r.distanceM} m`
  if (r.status === 'OUT_OF_RANGE') {
    return r.nearestBranchId
      ? `OUT_OF_RANGE · terdekat ${r.nearestBranchId} · ${r.distanceM} m`
      : 'OUT_OF_RANGE · tidak ada cabang yang bisa dinilai'
  }
  return `REJECTED · ${r.reason}`
}

const tone = (r: Result) =>
  r.status === 'VALID'
    ? 'border-ok/45 bg-ok/14 text-ok'
    : r.status === 'OUT_OF_RANGE'
      ? 'border-warn/45 bg-warn/14 text-warn-tint'
      : 'border-danger/45 bg-danger/16 text-danger-tint'

const apply = (c: (typeof CASES)[number]) => {
  lat.value = c.lat
  lng.value = c.lng
  accuracy.value = c.accuracyM
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">Geofence check-in</h1>
      <p class="mt-1 max-w-2xl text-sm text-muted">
        Peragaan langsung <code class="font-mono text-xs text-text">evaluateCheckIn()</code> dari
        Bagian B. Fungsi yang dijalankan di sini adalah modul yang sama yang diuji unit test —
        tidak ada salinan terpisah.
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="card space-y-4 p-4 sm:p-5">
        <h2 class="text-sm font-medium">Posisi check-in</h2>

        <div class="grid grid-cols-2 gap-3">
          <label class="space-y-1.5">
            <span class="text-xs font-medium tracking-wide text-muted uppercase">Latitude</span>
            <input
              v-model.number="lat"
              type="number"
              step="0.0001"
              class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm focus:border-accent-ink focus:outline-none"
            >
          </label>
          <label class="space-y-1.5">
            <span class="text-xs font-medium tracking-wide text-muted uppercase">Longitude</span>
            <input
              v-model.number="lng"
              type="number"
              step="0.0001"
              class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm focus:border-accent-ink focus:outline-none"
            >
          </label>
        </div>

        <label class="block space-y-1.5">
          <span class="text-xs font-medium tracking-wide text-muted uppercase">
            Akurasi GPS · {{ accuracy }} m
          </span>
          <input v-model.number="accuracy" type="range" min="0" max="200" class="w-full accent-[var(--accent)]">
          <span class="block text-xs text-faint">
            Di atas 100 m ditolak. Toleransi yang disumbangkan akurasi dibatasi 30 m.
          </span>
        </label>

        <div class="rounded-lg border px-3.5 py-3 font-mono text-sm" :class="tone(result)">
          {{ summarise(result) }}
        </div>
      </section>

      <section class="card p-4 sm:p-5">
        <h2 class="mb-3 text-sm font-medium">Cabang yang terdaftar</h2>
        <ul class="space-y-2">
          <li
            v-for="branch in branches"
            :key="branch.id"
            class="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
            :class="branch.active ? '' : 'opacity-50'"
          >
            <div>
              <span class="font-mono text-xs text-muted">{{ branch.id }}</span>
              <span class="ml-2 font-medium">{{ branch.name }}</span>
            </div>
            <div class="text-right text-xs text-muted">
              <p class="font-mono">{{ branch.lat }}, {{ branch.lng }}</p>
              <p>radius {{ branch.radiusM }} m · {{ branch.active ? 'aktif' : 'nonaktif' }}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <section class="card overflow-hidden">
      <h2 class="border-b border-border px-4 py-3.5 text-sm font-medium">Lima kasus uji dari soal</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-border text-xs tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" class="px-4 py-2.5 font-medium">#</th>
              <th scope="col" class="px-4 py-2.5 font-medium">Input</th>
              <th scope="col" class="px-4 py-2.5 font-medium">Ekspektasi</th>
              <th scope="col" class="px-4 py-2.5 font-medium">Hasil</th>
              <th scope="col" class="px-4 py-2.5 font-medium"><span class="sr-only">Coba</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="c in evaluated" :key="c.no" class="hover:bg-surface-2">
              <td class="px-4 py-2.5 tabular-nums">{{ c.no }}</td>
              <td class="px-4 py-2.5 font-mono text-xs text-muted">
                {{ c.lat }}, {{ c.lng }} · ±{{ c.accuracyM }} m
              </td>
              <td class="px-4 py-2.5 text-muted">{{ c.expect }}</td>
              <td class="px-4 py-2.5 font-mono text-xs">{{ summarise(c.actual) }}</td>
              <td class="px-4 py-2.5 text-right">
                <button
                  type="button"
                  class="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-text"
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
