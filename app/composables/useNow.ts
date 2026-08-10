/**
 * Jam bersama untuk seluruh label waktu relatif.
 *
 * Dua masalah yang diselesaikan sekaligus:
 *
 * 1. HYDRATION. Nilainya `null` selama SSR dan pada render pertama di client,
 *    jadi kedua sisi menghasilkan HTML yang identik (komponen menampilkan waktu
 *    absolut selama nilainya null). Jam baru mulai berdetak setelah mount,
 *    setelah itu waktu relatif aman ditampilkan.
 *
 * 2. SATU TIMER, BUKAN SERATUS. Tabel berisi 50 baris dengan stempel waktu akan
 *    membuat 50 interval kalau tiap komponen memasang timernya sendiri. Di sini
 *    ref-nya berada di scope modul dan dihitung berapa yang memakai, jadi hanya
 *    ada satu interval berapa pun banyak komponen yang membacanya.
 */
const TICK_MS = 30_000

const now = ref<number | null>(null)
let subscribers = 0
let timer: ReturnType<typeof setInterval> | undefined

export function useNow() {
  // Di server tidak ada yang berdetak dan nilainya tetap null — persis yang
  // dibutuhkan supaya markup SSR cocok dengan render pertama client.
  if (import.meta.client) {
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
  }

  return now
}
