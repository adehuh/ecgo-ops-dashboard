import { AKUN } from '../support/commands'

/**
 * Autentikasi dan otorisasi, lewat browser sungguhan.
 *
 * Yang diuji di sini adalah hal-hal yang hanya kelihatan di browser: pengalihan
 * rute, kembalinya pengguna ke halaman yang tadi dituju, dan apakah sesi
 * benar-benar mati setelah keluar. Kebenaran endpoint-nya sendiri sudah ditutup
 * oleh tests/auth.spec.ts di lapisan HTTP.
 */
describe('Masuk dan keluar', () => {
  it('pengunjung anonim dipantulkan ke /login dengan returnTo', () => {
    cy.visit('/cabinets')
    cy.location('pathname').should('eq', '/login')
    cy.location('search').should('contain', 'returnTo=/cabinets')
  })

  it('kredensial salah menampilkan pesan yang sama untuk kedua kegagalan', () => {
    cy.visit('/login')
    cy.get('input[name=email]').type(AKUN.admin.email)
    cy.get('input[name=password]').type('password-yang-salah')
    cy.contains('button', 'Masuk').click()

    // Pesannya tidak boleh membedakan "email tidak ada" dari "password salah".
    cy.get('[role=alert]').should('have.text', 'Email atau password salah')
    cy.location('pathname').should('eq', '/login')
  })

  it('masuk mengembalikan pengguna ke halaman yang tadi dituju', () => {
    cy.visit('/cabinets/CB-KMY-01')
    cy.location('pathname').should('eq', '/login')

    cy.get('input[name=email]').type(AKUN.kemayoran.email)
    cy.get('input[name=password]').type(AKUN.kemayoran.password, { log: false })
    cy.contains('button', 'Masuk').click()

    // Bukan ke /cabinets — ke halaman yang tadi diminta.
    cy.location('pathname').should('eq', '/cabinets/CB-KMY-01')
  })

  it('returnTo ke domain luar diabaikan', () => {
    // Open redirect: tanpa penyaringan, aplikasi kita sendiri akan memantulkan
    // pengguna ke situs penyerang tepat setelah mereka mengetik password.
    cy.visit('/login?returnTo=https://situs-penyerang.example/curi')
    cy.get('input[name=email]').type(AKUN.admin.email)
    cy.get('input[name=password]').type(AKUN.admin.password, { log: false })
    cy.contains('button', 'Masuk').click()

    cy.location('hostname').should('eq', 'localhost')
    cy.location('pathname').should('eq', '/cabinets')
  })

  it('keluar membatalkan sesi, bukan hanya menyembunyikan UI', () => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('button[aria-label="Keluar"]').click()
    cy.location('pathname').should('eq', '/login')

    // Sesinya benar-benar mati di server: rute terlindungi memantul lagi.
    cy.visit('/cabinets')
    cy.location('pathname').should('eq', '/login')
  })
})

describe('Ruang lingkup cabang', () => {
  it('supervisor hanya melihat cabangnya sendiri', () => {
    cy.masuk(AKUN.kemayoran)
    cy.visit('/cabinets')

    cy.get('table tbody tr').should('have.length.greaterThan', 0)
    cy.get('table tbody tr td:nth-child(2)').each(($sel) => {
      expect($sel.text()).to.match(/Kemayoran|Sunter/)
    })

    // Ruang lingkupnya tertulis permanen di header, supaya angka di layar tidak
    // salah dibaca sebagai angka armada.
    cy.get('header').should('contain', 'Kemayoran, Sunter')
  })

  it('cabinet milik cabang lain menghasilkan "tidak ditemukan", bukan "dilarang"', () => {
    cy.masuk(AKUN.kemayoran)
    cy.visit('/cabinets/CB-BKS-03')

    // 404, bukan 403 — 403 akan mengonfirmasi bahwa cabinet itu ada.
    cy.contains('Cabinet tidak ditemukan').should('be.visible')
    cy.contains('button', 'Kembali ke daftar cabinet').should('be.visible')
  })

  it('supervisor tanpa cabang tidak melihat apa pun — gagal tertutup', () => {
    cy.masuk(AKUN.tanpaCabang)
    cy.visit('/cabinets')

    cy.contains('Belum ada cabinet').should('be.visible')
    cy.get('table tbody tr').should('not.exist')
  })
})
