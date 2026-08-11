<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { formatTime } from '@/utils/format'

/**
 * Kesegaran data di header — pengganti checkbox "Auto-refresh 30 dtk" (§12.6).
 *
 * Checkbox lama hanya mengatakan apakah polling menyala. Yang perlu diketahui
 * ops sebelum memutuskan sesuatu bukan itu, melainkan **kapan angka di layar
 * terakhir benar-benar berhasil dimuat**. Polling yang menyala tapi gagal enam
 * kali berturut-turut terlihat persis sama dengan polling yang sehat.
 *
 * Ini kelanjutan prinsip §7.3 yang sudah dipakai untuk cabinet basi — data basi
 * harus TERLIHAT basi — hanya saja diterapkan ke halamannya sendiri.
 */
const props = defineProps<{
  /** Dari `useApi`. null berarti belum pernah berhasil sama sekali. */
  lastSuccessAt: number | null
  paused: boolean
  /** Permintaan terakhir gagal. Umur datanya tetap dihitung dari keberhasilan terakhir. */
  failing: boolean
}>()

const emit = defineEmits<{ 'toggle-pause': [] }>()

// Detik ditampilkan, jadi jamnya harus berdetak per detik. `useNow` berdetak tiap
// 30 detik — cukup untuk "5 mnt lalu", tapi akan membuat "Segar 8 dtk" membeku.
const now = ref(Date.now())
const tick = setInterval(() => (now.value = Date.now()), 1000)
onUnmounted(() => clearInterval(tick))

const ageSeconds = computed(() =>
  props.lastSuccessAt === null ? null : Math.max(0, Math.floor((now.value - props.lastSuccessAt) / 1000)),
)

type Tone = 'paused' | 'fresh' | 'stale' | 'failed'

const tone = computed<Tone>(() => {
  if (props.paused) return 'paused'
  const age = ageSeconds.value
  if (age === null) return 'stale'
  if (props.failing || age > 120) return 'failed'
  if (age >= 45) return 'stale'
  return 'fresh'
})

const label = computed(() => {
  const age = ageSeconds.value
  if (props.paused) return 'Dijeda'
  if (age === null) return 'Memuat…'
  if (tone.value === 'failed') return `Gagal · data ${Math.floor(age / 60)} mnt lalu`
  if (tone.value === 'stale') return `Terakhir ${age} dtk lalu`
  return `Segar ${age} dtk`
})

/**
 * Versi ponsel: kata keadaannya saja, tanpa hitungan detik.
 *
 * Di header selebar 390px, "Terakhir 54 dtk lalu" mendorong nama pengguna keluar
 * layar demi ketelitian yang tidak dipakai siapa pun sambil berjalan. Yang perlu
 * terbaca sekilas adalah apakah datanya masih bisa dipercaya; angka pastinya ada
 * di layar lebar.
 */
const shortLabel = computed(() => {
  if (props.paused) return 'Dijeda'
  if (ageSeconds.value === null) return 'Memuat…'
  return { fresh: 'Segar', stale: 'Menua', failed: 'Gagal', paused: 'Dijeda' }[tone.value]
})

const DOT: Record<Tone, string> = {
  fresh: 'bg-ok shadow-[0_0_0_3px_color-mix(in_oklab,var(--ok)_18%,transparent)]',
  stale: 'bg-warn',
  failed: 'bg-danger',
  paused: 'bg-neutral',
}

const wallClock = computed(() => formatTime(new Date(now.value).toISOString()))
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="flex items-center gap-2 rounded-lg border border-border-raised bg-surface py-[5px] pr-2.5 pl-2"
    >
      <!-- `role="status"` supaya perubahan ke keadaan gagal diumumkan pembaca
           layar; tanpa itu, kegagalan polling hanya terlihat oleh yang melihat. -->
      <span
        class="size-1.5 shrink-0 rounded-full sm:size-[7px]"
        :class="DOT[tone]"
        aria-hidden="true"
      />
      <!-- Label PENUH selalu ada di pohon aksesibilitas, hanya disembunyikan
           secara visual di layar sempit — kalau ia di-`hidden`, pembaca layar
           ikut kehilangan pengumuman saat polling gagal, dan kegagalan itu jadi
           hanya terlihat oleh yang bisa melihat. Versi ringkas sebaliknya:
           aria-hidden, supaya tidak diumumkan dua kali. -->
      <span class="sr-only text-xs text-soft tabular-nums sm:not-sr-only" role="status">
        {{ label }}
      </span>
      <span class="text-[11px] text-soft sm:hidden" aria-hidden="true">{{ shortLabel }}</span>

      <span class="h-3.5 w-px bg-border-raised" aria-hidden="true" />

      <button
        type="button"
        class="grid place-items-center rounded text-muted transition-colors hover:text-text"
        :aria-label="paused ? 'Lanjutkan pembaruan otomatis' : 'Jeda pembaruan otomatis'"
        :title="paused ? 'Lanjutkan pembaruan otomatis' : 'Jeda pembaruan otomatis'"
        @click="emit('toggle-pause')"
      >
        <svg class="size-3.5" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <template v-if="paused">
            <path d="M3 1.5v11l9-5.5z" />
          </template>
          <template v-else>
            <rect x="2.5" y="0" width="3.5" height="14" rx="1.4" />
            <rect x="8" y="0" width="3.5" height="14" rx="1.4" />
          </template>
        </svg>
      </button>
    </div>

    <span class="hidden text-xs text-faint tabular-nums lg:inline">{{ wallClock }} WIB</span>
  </div>
</template>
