<script setup lang="ts">
import { computed } from 'vue'

/**
 * Sparkline batang dari data jam SUNGGUHAN (`hourly` di respons API).
 *
 * Prototipe handoff membangkitkan bentuk ini dari PRNG karena ia tidak punya
 * database. Di sini datanya nyata: 24 bucket jam dihitung di PostgreSQL bersama
 * agregat lain, dalam query yang sama — jadi bentuknya benar-benar menceritakan
 * kapan cabinet ini sibuk, bukan sekadar terlihat sibuk.
 *
 * Digambar sebagai SATU path berisi ruas vertikal, bukan 24 elemen: satu node
 * per baris tabel, bukan dua puluh empat.
 */
const props = defineProps<{
  values: number[]
  width: number
  height: number
  /** Tebal batang. 2 untuk baris tabel, 8 untuk pita armada. */
  strokeWidth: number
  /** Baris bermasalah digambar abu-abu — throughput bukan kabar baik di situ. */
  muted?: boolean
}>()

const path = computed(() => {
  const n = props.values.length
  if (n === 0) return ''

  const max = Math.max(1, ...props.values)
  const step = props.width / n
  const offset = step / 2

  // Dasar di tepi bawah, dan tiap batang naik MINIMAL 1px. Tanpa lantai 1px itu
  // jam bernilai nol menghasilkan ruas sepanjang nol — yang dengan
  // `stroke-linecap: butt` tidak menggambar apa pun, sehingga "nol swap jam ini"
  // terlihat persis sama dengan "tidak ada datanya sama sekali".
  const floorY = props.height
  const span = props.height - 1

  return props.values
    .map((v, i) => {
      const x = (i * step + offset).toFixed(2)
      const y = (floorY - 1 - (v / max) * span).toFixed(2)
      return `M${x} ${floorY}V${y}`
    })
    .join('')
})

const total = computed(() => props.values.reduce((a, b) => a + b, 0))
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    :style="{ width: `${width}px`, height: `${height}px` }"
    class="block shrink-0"
    role="img"
    :aria-label="`Sebaran ${total} swap sepanjang 24 jam terakhir`"
  >
    <path
      :d="path"
      fill="none"
      :stroke-width="strokeWidth"
      stroke-linecap="butt"
      :class="muted ? 'stroke-neutral/70' : 'stroke-ok/70'"
    />
  </svg>
</template>
