import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Jam bersama untuk seluruh label waktu relatif.
 *
 * SATU timer, bukan seratus. Tabel berisi 50 baris berstempel waktu akan
 * membuat 50 interval kalau tiap komponen memasang timernya sendiri. Di sini
 * ref-nya berada di scope modul dan pemakainya dihitung, jadi hanya ada satu
 * interval berapa pun banyak komponen yang membacanya — dan intervalnya berhenti
 * begitu komponen terakhir dilepas.
 */
const TICK_MS = 30_000

const now = ref<number>(Date.now())

let subscribers = 0
let timer: ReturnType<typeof setInterval> | undefined

export function useNow() {
  onMounted(() => {
    subscribers += 1
    now.value = Date.now()

    timer ??= setInterval(() => {
      now.value = Date.now()
    }, TICK_MS)
  })

  onUnmounted(() => {
    subscribers -= 1
    if (subscribers <= 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  })

  return now
}
