import { computed } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import {
  cabinetListQuerySchema,
  type CabinetListQuery,
  type CabinetStatus,
} from '@shared/contracts/cabinets'

/**
 * State daftar cabinet, dengan URL sebagai satu-satunya sumber kebenaran.
 *
 * Tidak ada salinan bayangan di ref lokal. Kalau state pencarian hidup di dua
 * tempat, keduanya pasti akan menyimpang — biasanya persis saat pengguna menekan
 * tombol back — dan yang tampil di layar tidak lagi cocok dengan URL yang mereka
 * bagikan ke rekan.
 */

const DEFAULTS = cabinetListQuerySchema.parse({})

export function useCabinetQuery() {
  const route = useRoute()
  const router = useRouter()

  /**
   * URL bisa saja dibuat manusia atau berasal dari bookmark lama, jadi ia
   * diperlakukan sebagai input yang tidak dipercaya. Kalau tidak lolos parse,
   * halaman turun ke nilai default dan MENGATAKANNYA, alih-alih menampilkan
   * layar kosong yang membingungkan.
   */
  const parsed = computed(() => cabinetListQuerySchema.safeParse(route.query))

  const hasInvalidParams = computed(() => !parsed.value.success)

  const state = computed<CabinetListQuery>(() =>
    parsed.value.success ? parsed.value.data : DEFAULTS,
  )

  /** Query yang dikirim ke API — sudah tervalidasi, jadi selalu bisa diterima server. */
  const apiQuery = computed(() => ({
    q: state.value.q || undefined,
    status: state.value.status,
    sort: state.value.sort,
    dir: state.value.dir,
    page: state.value.page,
    pageSize: state.value.pageSize,
  }))

  /**
   * Tulis perubahan ke URL, buang apa pun yang sama dengan default.
   *
   * `replace`, bukan `push`: mengetik "kemayoran" akan meninggalkan sepuluh entri
   * riwayat kalau tiap ketukan di-push, dan tombol back berubah jadi mesin
   * penghapus huruf.
   */
  function patch(changes: Partial<CabinetListQuery>, options: { resetPage?: boolean } = {}) {
    const next = { ...state.value, ...changes }

    // Mengubah filter apa pun harus mengembalikan ke halaman 1. Kalau tidak,
    // menyaring dari 50 hasil ke 3 sambil berada di halaman 4 memberi tabel
    // kosong yang terlihat seperti "tidak ada data".
    if (options.resetPage !== false && !('page' in changes)) next.page = 1

    const query: LocationQueryRaw = {}
    if (next.q) query.q = next.q
    if (next.status?.length) query.status = next.status
    if (next.sort !== DEFAULTS.sort) query.sort = next.sort
    if (next.dir !== DEFAULTS.dir) query.dir = next.dir
    if (next.page !== DEFAULTS.page) query.page = String(next.page)
    if (next.pageSize !== DEFAULTS.pageSize) query.pageSize = String(next.pageSize)

    return router.replace({ query })
  }

  function toggleStatus(status: CabinetStatus) {
    const current = state.value.status ?? []
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]

    return patch({ status: next.length > 0 ? next : undefined })
  }

  /**
   * Klik header kolom: kolom baru mulai dari arah yang paling berguna, kolom
   * yang sama membalik arah.
   */
  function toggleSort(sort: CabinetListQuery['sort']) {
    if (state.value.sort === sort) {
      return patch({ dir: state.value.dir === 'asc' ? 'desc' : 'asc' })
    }
    // Jumlah swap paling menarik dari yang terbesar; kode paling wajar A→Z.
    return patch({ sort, dir: sort === 'code' ? 'asc' : 'desc' })
  }

  const isFiltered = computed(() => Boolean(state.value.q) || Boolean(state.value.status?.length))

  const reset = () => router.replace({ query: {} })

  return { state, apiQuery, hasInvalidParams, isFiltered, patch, toggleStatus, toggleSort, reset }
}
