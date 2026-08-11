/**
 * Halaman 1 dan 2 dari Bagian D, dipakai seperti tim ops memakainya.
 */
describe('Halaman daftar cabinet', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')
  })

  it('menampilkan enam kolom yang diminta soal', () => {
    for (const kolom of ['Kode', 'Cabang', 'Status', 'Slot terisi', 'Swap 24 jam', 'Heartbeat']) {
      cy.get('table thead').should('contain', kolom)
    }
  })

  it('pencarian dikerjakan server dan tersimpan di URL', () => {
    cy.get('input[type=search]').type('sunter')

    // URL berubah, artinya tampilan ini bisa dibagikan dan di-refresh.
    cy.location('search').should('contain', 'q=sunter')
    cy.get('table tbody tr').should('have.length.lessThan', 25)
    cy.get('table tbody tr td:nth-child(2)').each(($sel) => {
      expect($sel.text().toLowerCase()).to.contain('sunter')
    })

    // Muat ulang: hasilnya harus sama, bukan kembali ke daftar penuh.
    cy.reload()
    cy.get('input[type=search]').should('have.value', 'sunter')
    cy.get('table tbody tr').should('have.length.lessThan', 25)
  })

  it('mengetik cepat hanya menghasilkan satu permintaan', () => {
    // Debounce. Tanpa ini setiap ketukan memicu query LIKE di database.
    cy.intercept('GET', '/api/cabinets?*').as('cari')
    cy.get('input[type=search]').type('kemayoran')
    cy.wait('@cari')
    cy.wait(600)
    cy.get('@cari.all').should('have.length', 1)
  })

  it('filter status menyaring dan masuk ke URL', () => {
    cy.contains('button', 'Perawatan').click()
    cy.location('search').should('contain', 'status=MAINTENANCE')
    cy.get('table tbody tr td:nth-child(3)').each(($sel) => {
      expect($sel.text()).to.contain('Perawatan')
    })
  })

  it('sortir jumlah swap 24 jam benar-benar mengurutkan', () => {
    cy.get('table tbody tr td:nth-child(5)').then(($sel) => {
      const angka = [...$sel].map((el) => Number(el.textContent!.replace(/\D/g, '')))
      expect(angka).to.deep.equal([...angka].sort((a, b) => b - a))
    })
  })

  it('pagination pindah halaman dan tidak mengulang baris yang sama', () => {
    cy.get('table tbody tr td:first-child').then(($hal1) => {
      const kode1 = [...$hal1].map((el) => el.textContent!.trim())

      cy.get('button[aria-label="Halaman 2"]').click()
      cy.location('search').should('contain', 'page=2')

      cy.get('table tbody tr td:first-child').then(($hal2) => {
        const kode2 = [...$hal2].map((el) => el.textContent!.trim())
        expect(kode2.some((k) => kode1.includes(k)), 'tidak ada baris berulang').to.be.false
      })
    })
  })

  it('empty state membedakan "tidak cocok filter" dari "tidak ada data"', () => {
    cy.get('input[type=search]').type('zzzz-tidak-ada')
    cy.contains('Tidak ada cabinet yang cocok').should('be.visible')

    // Jalan keluar, bukan jalan buntu.
    cy.contains('button', 'Bersihkan filter').click()
    cy.location('search').should('be.empty')
    cy.get('table tbody tr').should('have.length', 25)
  })
})

describe('Halaman detail cabinet', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr td:first-child a').first().click()
    cy.location('pathname').should('match', /\/cabinets\/CB-/)
  })

  it('menampilkan grid 12 slot dengan state dan SOC', () => {
    // Ditargetkan lewat data-cy, bukan 'ul > li': di dalam section yang sama ada
    // <ul> kedua untuk legenda, dan selektor struktural ikut menghitungnya.
    cy.get('[data-cy=slot-grid] > li').should('have.length', 12)
    // Slot kosong ditulis apa adanya, bukan 0% — 0% berarti baterai habis.
    cy.get('[data-cy=slot-grid]').should('contain', '#01')
  })

  it('grafik berisi 24 bucket jam, termasuk jam yang nol', () => {
    // Versi grafik yang bisa dibaca pembaca layar adalah tabel sungguhan.
    cy.get('figure table tbody tr').should('have.length', 24)
  })

  it('menampilkan 20 transaksi swap terakhir', () => {
    cy.contains('section', '20 swap terakhir').find('tbody tr').should('have.length', 20)
  })

  it('referensi rider sudah disamarkan sebelum sampai ke browser', () => {
    cy.contains('section', '20 swap terakhir')
      .find('tbody tr td:nth-child(3)')
      .first()
      .invoke('text')
      .should('match', /•/)
  })
})
