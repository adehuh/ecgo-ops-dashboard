import { computed, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { apiFetch, ApiRequestError, describeApiError } from '@/api/client'

export type ApiStatus = 'idle' | 'pending' | 'success' | 'error'

/**
 * Pengambilan data reaktif yang sadar pembatalan.
 *
 * Yang paling penting di sini adalah PEMBATALAN. URL-nya reaktif (berubah tiap
 * kali kata kunci atau halaman berubah), dan tanpa membatalkan permintaan
 * sebelumnya kita mendapat persis bug dari soal A4: ketik "JKT" cepat-cepat,
 * respons "JK" tiba belakangan, dan layar menampilkan hasil untuk kata kunci
 * yang sudah tidak ada lagi di kotak input.
 *
 * Karena itu tiap permintaan baru membatalkan yang lama lewat AbortController,
 * DAN hasil yang datang diperiksa ulang terhadap nomor urut permintaan. Dua
 * lapis, karena pembatalan itu kooperatif: respons yang sudah terlanjur sampai
 * di jaringan tetap bisa menyelesaikan promise-nya.
 */
export function useApi<T>(
  url: MaybeRefOrGetter<string>,
  options: { immediate?: boolean } = {},
) {
  const data = shallowRef<T | null>(null)
  const error = shallowRef<{ message: string; code: string } | null>(null)
  const status = ref<ApiStatus>('idle')

  /**
   * Kapan terakhir kali permintaan BERHASIL — bukan kapan terakhir dicoba.
   *
   * Bedanya itu yang penting di dashboard yang polling. Kalau yang dilaporkan
   * adalah percobaan terakhir, layar akan menulis "diperbarui 3 detik lalu"
   * sementara angkanya sebenarnya dari sepuluh menit lalu karena sepuluh
   * percobaan terakhir gagal berturut-turut. Mode gagal di layar semacam ini
   * bukan halaman kosong, melainkan angka basi yang masih terlihat hidup.
   */
  const lastSuccessAt = ref<number | null>(null)

  let controller: AbortController | undefined
  let requestId = 0

  async function execute(): Promise<void> {
    const target = toValue(url)

    controller?.abort()
    controller = new AbortController()

    const id = ++requestId
    status.value = 'pending'

    try {
      const result = await apiFetch<T>(target, { signal: controller.signal })

      // Respons dari permintaan yang sudah usang tidak boleh menimpa yang baru.
      if (id !== requestId) return

      data.value = result
      error.value = null
      status.value = 'success'
      lastSuccessAt.value = Date.now()
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      if (id !== requestId) return

      error.value = describeApiError(caught)
      // Data lama sengaja TIDAK dibuang: kalau satu kali refresh gagal, lebih
      // baik menampilkan angka lama beserta peringatan daripada mengosongkan
      // layar yang sedang dipakai orang bekerja.
      if (caught instanceof ApiRequestError && caught.status === 404) data.value = null
      status.value = 'error'
    }
  }

  if (options.immediate !== false) {
    watch(() => toValue(url), execute, { immediate: true })
  }

  /** Muat ulang tanpa mengosongkan layar — dipakai auto-refresh. */
  const refresh = () => execute()

  const isFirstLoad = computed(() => status.value === 'pending' && data.value === null)
  const isRefreshing = computed(() => status.value === 'pending' && data.value !== null)

  return { data, error, status, isFirstLoad, isRefreshing, refresh, lastSuccessAt }
}
