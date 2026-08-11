/**
 * Optimistic UI — menandai cabinet masuk / keluar perawatan.
 *
 * Optimistic update hanya layak dipakai kalau rollback-nya benar-benar bekerja.
 * Karena itu spec ini menguji ketiganya, bukan hanya yang berhasil:
 *   1. layar berubah SEBELUM server menjawab
 *   2. keadaan itu bertahan setelah server mengiyakan
 *   3. keadaan itu DIKEMBALIKAN, beserta alasannya, ketika server menolak
 */
describe('Optimistic UI: tandai perawatan', () => {
  let kode: string

  beforeEach(() => {
    cy.masuk()

    // Sortir bawaan kini "paling bermasalah", jadi baris pertama dari
    // ?status=ONLINE adalah cabinet ONLINE yang PALING rusak — sering kali yang
    // 0 slot siap, yang kondisinya berbunyi "0 slot siap ditukar", bukan
    // "Online · sehat". Spec ini menguji optimistic UI, bukan peringkat
    // keparahan, jadi ia butuh titik awal yang pasti: cabinet yang benar-benar
    // sehat, supaya frasa sebelum dan sesudah toggle bisa diprediksi.
    cy.visit('/cabinets?status=ONLINE&sort=severity&dir=asc')

    cy.contains('table tbody tr', 'Online · sehat')
      .find('td:nth-child(2) a')
      .first()
      .then(($a) => {
        kode = $a.text().trim()
        cy.visit(`/cabinets/${kode}`)
      })
    cy.get('[data-cy=toggle-maintenance]').should('be.visible')
  })

  afterEach(() => {
    // Kembalikan ke ONLINE supaya spec lain tidak mewarisi keadaan ini.
    if (kode) cy.pulihkanStatus(kode)
  })

  it('layar berubah sebelum server menjawab, lalu bertahan', () => {
    // Tahan respons server 1,5 detik. Kalau UI-nya pessimistic, badge belum
    // berubah selama jeda itu dan assert di bawah gagal.
    cy.intercept('PATCH', '/api/cabinets/*/status', (req) => {
      req.on('response', (res) => res.setDelay(1500))
    }).as('simpan')

    cy.get('[data-cy=toggle-maintenance]').click()

    // Sebelum @simpan selesai: pil kondisi sudah berbunyi "Perawatan".
    cy.get('header').should('exist')
    cy.contains('span', 'Perawatan').should('be.visible')

    cy.wait('@simpan').its('response.statusCode').should('eq', 200)

    // Sesudah server mengiyakan: tetap "Perawatan", dan tombolnya berbalik arti.
    cy.contains('span', 'Perawatan').should('be.visible')
    cy.get('[data-cy=toggle-maintenance]').should('contain', 'Selesai perawatan')
  })

  it('perubahan benar-benar tersimpan, bukan hanya di layar', () => {
    cy.get('[data-cy=toggle-maintenance]').click()
    cy.contains('span', 'Perawatan').should('be.visible')

    // Muat ulang penuh: kalau hanya optimistic tanpa tersimpan, statusnya balik.
    cy.reload()
    cy.contains('span', 'Perawatan').should('be.visible')
  })

  it('server menolak → keadaan dikembalikan DAN alasannya ditampilkan', () => {
    cy.intercept('PATCH', '/api/cabinets/*/status', {
      statusCode: 409,
      body: {
        error: {
          code: 'CONFLICT',
          message: 'Cabinet sedang dikunci teknisi lain.',
        },
      },
    }).as('gagal')

    cy.get('[data-cy=toggle-maintenance]').click()
    cy.wait('@gagal')

    // Rollback: kembali ke kondisi semula, bukan tertinggal di Perawatan.
    cy.contains('span', 'Online · sehat').should('be.visible')
    cy.contains('span', 'Perawatan').should('not.exist')

    // Dan alasannya datang dari server, bukan "terjadi kesalahan".
    cy.get('[data-cy=status-error]').should('contain', 'dikunci teknisi lain')
  })

  it('cabinet OFFLINE tidak menawarkan tombolnya sama sekali', () => {
    // Status OFFLINE dilaporkan perangkat; ia tidak pulih karena seseorang
    // mengeklik tombol. Jadi tombolnya memang tidak ada, bukan ada lalu ditolak.
    cy.visit('/cabinets?status=OFFLINE')
    cy.get('table tbody tr td:nth-child(2) a').first().click()
    cy.contains('span', 'Offline').should('be.visible')
    cy.get('[data-cy=toggle-maintenance]').should('not.exist')
  })
})
