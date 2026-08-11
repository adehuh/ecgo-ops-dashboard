/**
 * Pembuat ulang tangkapan layar README.
 *
 * SENGAJA di luar `cypress/e2e/`, jadi `specPattern` tidak memungutnya dan
 * `npm run test:e2e` tidak ikut menjalankannya. Jalankan manual saat UI berubah:
 *
 *   npx cypress run --spec cypress/docs/capture.cy.ts
 *   npm run docs:screenshots        (menyalin hasilnya ke docs/screenshots/)
 *
 * Kenapa Cypress dan bukan menyeret jendela browser: `cy.viewport()` menetapkan
 * ukuran yang PERSIS sama tiap kali, termasuk 390×844 untuk ponsel. Tangkapan
 * layar dokumentasi yang ukurannya berubah-ubah membuat README-nya bergoyang
 * tiap kali diperbarui, dan yang paling penting — ia harus bisa dibuat ulang
 * oleh orang lain, bukan hanya oleh yang kebetulan punya monitor yang sama.
 *
 * Tiap tangkapan memakai ukuran yang sama dengan berkas yang digantikannya.
 */
/**
 * `fullPage`, bukan `viewport`.
 *
 * Cypress headless menjalankan jendela browser berukuran tetap, sehingga
 * `capture: 'viewport'` memotong semuanya pada tinggi jendela itu berapa pun
 * `cy.viewport()` diminta — sepuluh tangkapan keluar dengan tinggi yang sama
 * persis, yang jelas bukan yang diminta. `fullPage` menjahit seluruh halaman
 * yang bisa digulir, jadi tiap layar tampil utuh apa adanya.
 */
/**
 * `fullPage`, bukan `viewport`.
 *
 * Cypress headless menjalankan jendela browser berukuran tetap, sehingga
 * `capture: 'viewport'` memotong semuanya pada tinggi jendela itu berapa pun
 * `cy.viewport()` diminta. `fullPage` menjahit seluruh halaman yang bisa
 * digulir, jadi tiap layar tampil utuh apa adanya.
 *
 * Header dibuat `static` selama pemotretan. `fullPage` bekerja dengan menggulir
 * lalu menjahit potongan-potongannya, dan elemen `position: sticky` ikut
 * terpotret di SETIAP posisi gulir — hasilnya header muncul dua kali di tengah
 * gambar, yang terbaca sebagai UI rusak padahal aplikasinya baik-baik saja.
 */
const shot = (nama: string) => {
  cy.document().then((doc) => {
    doc.head.insertAdjacentHTML(
      'beforeend',
      '<style id="shot-fix">header{position:static !important}</style>',
    )
  })
  cy.screenshot(nama, { capture: 'fullPage', overwrite: true })
  cy.document().then((doc) => doc.getElementById('shot-fix')?.remove())
}

/**
 * Ponsel dipotret sebatas layar, bukan seluruh halaman: gulungan setinggi 1.900
 * piksel di dalam README terbaca sebagai pita tipis, bukan sebagai tangkapan
 * layar sebuah telepon.
 */
const shotViewport = (nama: string) => cy.screenshot(nama, { capture: 'viewport', overwrite: true })

describe('Tangkapan layar README', () => {
  it('01 · halaman masuk', () => {
    cy.viewport(1280, 800)
    cy.visit('/login')
    cy.contains('Dashboard Operasional').should('be.visible')
    shot('01-login')
  })

  it('02 · daftar cabinet, tema gelap', () => {
    cy.viewport(1280, 860)
    cy.masuk()
    cy.visit('/cabinets?pageSize=10')
    cy.contains('button', 'Online').find('[data-cy=chip-count]').should('not.contain', '—')
    cy.contains('Tangani lebih dulu').should('be.visible')
    shot('02-list-dark')
  })

  it('03 · daftar cabinet, tema terang', () => {
    cy.viewport(1280, 860)
    cy.masuk()
    cy.visit('/cabinets?pageSize=10')
    cy.contains('button', 'Online').find('[data-cy=chip-count]').should('not.contain', '—')
    cy.get('button[aria-label="Aktifkan mode terang"]').click()
    cy.get('html').should('not.have.class', 'dark')
    shot('03-list-light')
    // Kembalikan supaya tangkapan berikutnya tetap gelap.
    cy.get('button[aria-label="Aktifkan mode gelap"]').click()
  })

  it('04 · detail cabinet', () => {
    cy.viewport(1280, 1500)
    cy.masuk()
    cy.visit('/cabinets?pageSize=10')
    cy.get('table tbody tr td:nth-child(2) a').first().click()
    cy.contains('Slot baterai').should('be.visible')
    cy.contains('20 swap terakhir').should('be.visible')
    shot('04-detail')
  })

  it('05 · keadaan kosong', () => {
    cy.viewport(1280, 720)
    cy.masuk()
    cy.visit('/cabinets?q=cikarang&status=OFFLINE')
    cy.contains('Tidak ada cabinet yang cocok').should('be.visible')
    shot('05-empty')
  })

  it('06 · ruang lingkup supervisor', () => {
    cy.viewport(1280, 780)
    cy.masuk({ email: 'kemayoran@ecgo.test', password: 'ops-kemayoran-2026' })
    cy.visit('/cabinets?pageSize=10')
    cy.get('header').should('contain', 'Kemayoran, Sunter')
    cy.get('table tbody tr').should('exist')
    shot('06-scoped-supervisor')
  })

  it('07 · 404 lintas cabang', () => {
    cy.viewport(1280, 620)
    cy.masuk({ email: 'kemayoran@ecgo.test', password: 'ops-kemayoran-2026' })
    cy.visit('/cabinets/CB-BKS-03')
    cy.contains('Cabinet tidak ditemukan').should('be.visible')
    shot('07-cross-branch-404')
  })

  it('08 · ponsel', () => {
    cy.viewport(390, 844)
    cy.masuk()
    cy.visit('/cabinets?pageSize=10')
    cy.contains('perlu perhatian').should('be.visible')
    shotViewport('08-mobile')
  })

  it('09 · geofence', () => {
    cy.viewport(1280, 1000)
    cy.masuk()
    cy.visit('/geofence')
    cy.contains('kasus soal lulus').should('be.visible')
    shot('09-geofence')
  })

  it('10 · optimistic UI — ditandai perawatan', () => {
    cy.viewport(1280, 640)
    cy.masuk()

    // Cabinet yang benar-benar sehat, supaya pil kondisinya berubah dari
    // "Online · sehat" menjadi "Perawatan" dan perubahannya terbaca jelas.
    cy.visit('/cabinets?status=ONLINE&sort=severity&dir=asc')
    cy.contains('table tbody tr', 'Online · sehat')
      .find('td:nth-child(2) a')
      .first()
      .then(($a) => {
        const kode = $a.text().trim()
        cy.visit(`/cabinets/${kode}`)
        cy.get('[data-cy=toggle-maintenance]').click()
        cy.contains('span', 'Perawatan').should('be.visible')
        shot('10-optimistic-maintenance')
        cy.pulihkanStatus(kode)
      })
  })
})
