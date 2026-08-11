/**
 * Halaman 1 dan 2 dari Bagian D, dipakai seperti tim ops memakainya.
 */
describe('Halaman daftar cabinet', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')
  })

  it('menampilkan enam keterangan yang diminta soal', () => {
    // Soal meminta ENAM KETERANGAN. Redesign §12 menyatukan kode + cabang ke
    // dalam satu kolom dan mengganti "Status" dengan "Kondisi" yang merupakan
    // supersetnya (ia menyebut statusnya SEKALIGUS alasannya). Jadi yang diuji
    // di sini adalah keterangannya, bukan jumlah <th>-nya — kalau salah satu
    // hilang dari layar, test ini tetap gagal.
    // Judulnya di-uppercase lewat CSS, jadi teks DOM-nya tetap huruf kecil —
    // dicocokkan apa adanya, bukan seperti yang terlihat di layar.
    for (const judul of ['Cabinet', 'Kondisi', '12 slot', 'Swap 24 jam', 'Heartbeat']) {
      cy.get('table thead').should('contain', judul)
    }

    cy.get('table tbody tr')
      .first()
      .within(() => {
        cy.get('td:nth-child(2)').invoke('text').should('match', /CB-[A-Z]{3}-\d+/) // kode
        cy.get('td:nth-child(2)').invoke('text').should('match', /[A-Za-z]{3,}/) // nama cabang
        cy.get('td:nth-child(3)').invoke('text').should('not.be.empty') // kondisi = status + sebabnya
        // Slot kini 12 segmen + "N siap · M terisi", bukan lagi rasio "8/12".
        cy.get('td:nth-child(4)').invoke('text').should('match', /\d+ siap · \d+ terisi/)
        cy.get('td:nth-child(4) span[class*="rounded"]').should('have.length.greaterThan', 1)
        cy.get('td:nth-child(5)').invoke('text').should('match', /\d/) // swap 24 jam
        cy.get('td:nth-child(6)').invoke('text').should('not.be.empty') // heartbeat
      })
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

  it('chip pita kesehatan menyaring dan masuk ke URL', () => {
    // Chip di pita kesehatan ADALAH filter statusnya sekarang (§12.1 nomor 1).
    cy.contains('button', 'Perawatan').click()
    cy.location('search').should('contain', 'status=MAINTENANCE')
    cy.get('table tbody tr').should('have.length.greaterThan', 0)

    // Kolom Kondisi menuliskan frasa, bukan enum, dan frasa untuk cabinet
    // MAINTENANCE tidak selalu berbunyi "Perawatan": kalau slot siapnya 0 ia
    // naik jadi "0 slot siap ditukar", persis seperti urutan CASE di server.
    // Yang HARUS benar adalah tidak ada baris sehat yang lolos filter ini.
    cy.get('table tbody tr td:nth-child(3)').each(($sel) => {
      expect($sel.text()).to.not.contain('Online · sehat')
    })
  })

  it('jumlah di chip sama dengan jumlah baris yang dihasilkannya', () => {
    // Inti dari §12.1 nomor 1: angka 17 yang dulu tidak bisa diklik. Kalau
    // jumlah di chip berbeda dari jumlah baris hasilnya, chip itu mengembalikan
    // tebak-tebakan yang justru mau dihapus redesign ini.
    // Tunggu angkanya benar-benar tiba: selama /api/summary masih terbang, chip
    // menampilkan em-dash, dan membacanya saat itu menghasilkan 0.
    cy.contains('button', 'Offline').invoke('text').should('match', /\d/)

    cy.contains('button', 'Offline')
      .invoke('text')
      .then((teks) => {
        const jumlah = Number(teks.replace(/\D/g, ''))
        expect(jumlah, 'jumlah di chip sudah termuat').to.be.greaterThan(0)
        cy.contains('button', 'Offline').click()
        cy.location('search').should('contain', 'status=OFFLINE')
        // Ditargetkan ke nav pagination, bukan `cy.contains('cabinet')` — kata
        // itu juga ada di subjudul halaman.
        cy.get('nav[aria-label="Navigasi halaman"]').should('contain', `dari ${jumlah} cabinet`)
      })
  })

  it('sortir jumlah swap 24 jam benar-benar mengurutkan', () => {
    // Bawaannya sekarang "paling bermasalah" (§12.1 nomor 2), jadi urutan swap
    // harus diminta lebih dulu lewat segmented control-nya.
    cy.contains('button', 'Swap 24 jam').click()
    cy.location('search').should('contain', 'sort=swaps24h')

    cy.get('table tbody tr td:nth-child(5)').then(($sel) => {
      // Sel ini juga memuat sparkline; angkanya diambil dari span pertama saja.
      const angka = [...$sel].map((el) =>
        Number(el.querySelector('span')!.textContent!.replace(/\D/g, '')),
      )
      expect(angka).to.deep.equal([...angka].sort((a, b) => b - a))
    })
  })

  it('sortir bawaan menaruh yang paling bermasalah di atas', () => {
    // Ini perubahan strukturalnya: yang tersibuk hampir selalu yang tersehat,
    // jadi mengurutkan menurut kesibukan justru menyembunyikan yang bermasalah.
    cy.contains('button', 'Paling bermasalah').should('have.attr', 'aria-pressed', 'true')

    cy.get('table tbody tr').first().find('td:nth-child(3)').invoke('text').should('not.contain', 'Online · sehat')
  })

  it('pagination pindah halaman dan tidak mengulang baris yang sama', () => {
    cy.get('table tbody tr td:nth-child(2)').then(($hal1) => {
      const kode1 = [...$hal1].map((el) => el.textContent!.trim())

      cy.get('button[aria-label="Halaman 2"]').click()
      cy.location('search').should('contain', 'page=2')

      cy.get('table tbody tr td:nth-child(2)').then(($hal2) => {
        const kode2 = [...$hal2].map((el) => el.textContent!.trim())
        expect(kode2.some((k) => kode1.includes(k)), 'tidak ada baris berulang').to.be.false
      })
    })
  })

  it('empty state membedakan "tidak cocok filter" dari "tidak ada data"', () => {
    cy.get('input[type=search]').type('zzzz-tidak-ada')
    cy.contains('Tidak ada cabinet yang cocok').should('be.visible')

    // Jalan keluar, bukan jalan buntu. Label berubah di redesign: keadaan
    // kosong kini menawarkan melonggarkan filter satu per satu DAN membersihkan
    // semuanya, jadi tombolnya tidak bisa lagi bernama "Bersihkan filter" saja.
    cy.contains('button', 'Bersihkan semua').click()
    cy.location('search').should('be.empty')
    cy.get('table tbody tr').should('have.length', 25)
  })
})

describe('Halaman detail cabinet', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr td:nth-child(2) a').first().click()
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
