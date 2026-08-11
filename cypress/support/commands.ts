/// <reference types="cypress" />

export const AKUN = {
  admin: { email: 'admin@ecgo.test', password: 'ops-admin-2026' },
  kemayoran: { email: 'kemayoran@ecgo.test', password: 'ops-kemayoran-2026' },
  tanpaCabang: { email: 'baru@ecgo.test', password: 'ops-baru-2026' },
} as const

declare global {
  namespace Cypress {
    interface Chainable {
      /** Masuk lewat API, bukan lewat form. */
      masuk(akun?: { email: string; password: string }): Chainable<void>
      /** Kembalikan status cabinet ke ONLINE apa pun keadaan test sebelumnya. */
      pulihkanStatus(code: string): Chainable<void>
    }
  }
}

/**
 * Masuk lewat `cy.request`, bukan mengetik di form.
 *
 * Form login sudah punya test-nya sendiri di auth.cy.ts. Mengulang alur itu
 * sebagai prasyarat setiap spec lain hanya menambah beberapa detik per test dan
 * membuat kegagalan login terlihat seperti kegagalan fitur lain.
 */
Cypress.Commands.add('masuk', (akun = AKUN.admin) => {
  cy.request('POST', '/api/auth/login', akun)
  // Cookie sesi HttpOnly; Cypress menyimpannya di jar browser secara otomatis.
})

/**
 * Test yang mengubah status harus membersihkan jejaknya.
 *
 * Tanpa ini, urutan spec menentukan hasilnya: satu test menandai cabinet masuk
 * perawatan, test berikutnya menghitung "filter ONLINE = 38" dan gagal. Test
 * yang bergantung pada urutan adalah test yang akan di-skip orang.
 */
Cypress.Commands.add('pulihkanStatus', (code: string) => {
  cy.request({
    method: 'PATCH',
    url: `/api/cabinets/${code}/status`,
    body: { status: 'ONLINE' },
    failOnStatusCode: false,
  })
})
