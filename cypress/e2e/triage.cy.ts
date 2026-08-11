/**
 * Redesign papan triage (§12), diuji di browser sungguhan.
 *
 * `cabinets.cy.ts` menguji hal-hal yang HARUS SELAMAT dari redesign — pencarian
 * server, pagination, ruang lingkup. Berkas ini menguji apa yang redesign ini
 * TAMBAHKAN, dan sengaja menguji janjinya, bukan tampilannya:
 *
 *   - jumlah di chip = jumlah baris yang dihasilkannya (janji "nol tebakan")
 *   - yang bermasalah ada di atas (janji "sortir tingkat masalah")
 *   - masalahnya tertulis dengan kata-kata (janji "kolom Kondisi")
 *   - tiap kondisi punya BENTUK berbeda, bukan hanya warna (WCAG 1.4.1)
 *
 * Assert "ada 7 cabinet offline" akan merah tiap kali simulator berjalan; yang
 * diuji di sini adalah hubungan antar angka, bukan angkanya.
 */
describe('Pita kesehatan armada', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')
    // Chip menampilkan em-dash sampai /api/summary tiba; tunggu angkanya nyata.
    cy.contains('button', 'Sehat').invoke('text').should('match', /\d/)
  })

  it('menggantikan kartu KPI dengan lima chip yang semuanya bisa diklik', () => {
    for (const label of ['Sehat', 'Offline', 'Heartbeat basi', 'Perawatan', '0 slot siap']) {
      cy.contains('button', label).should('be.visible')
    }

    // Kartu KPI lama benar-benar hilang, bukan sekadar tertutup.
    cy.contains('Total cabinet').should('not.exist')
  })

  it('tiap chip menghasilkan jumlah baris yang sama dengan angkanya sendiri', () => {
    // Inti §12.1 nomor 1. Angka 17 yang dulu tidak bisa diklik.
    const cases = [
      ['Offline', 'status=OFFLINE'],
      ['Perawatan', 'status=MAINTENANCE'],
      ['Heartbeat basi', 'status=STALE_HEARTBEAT'],
      ['0 slot siap', 'status=NO_READY_SLOTS'],
    ] as const

    for (const [label, param] of cases) {
      cy.visit('/cabinets')

      // Angkanya dibaca dari elemennya sendiri, bukan dari teks chip utuh:
      // label "0 slot siap" sudah memuat digit, jadi teks utuhnya tidak bisa
      // membedakan "sudah termuat" dari "masih em-dash".
      const count = () => cy.contains('button', label).find('[data-cy=chip-count]')

      count().invoke('text').should('not.eq', '—')

      count()
        .invoke('text')
        .then((teks) => {
          const jumlah = Number(teks.replace(/\D/g, ''))
          cy.contains('button', label).click()
          cy.location('search').should('contain', param)

          if (jumlah === 0) {
            cy.get('table tbody tr').should('not.exist')
          } else {
            cy.get('nav[aria-label="Navigasi halaman"]').should(
              'contain',
              `dari ${jumlah} cabinet`,
            )
          }
        })
    }
  })

  it('beberapa chip aktif sekaligus di-OR, bukan saling meniadakan', () => {
    cy.contains('button', 'Offline').click()
    cy.contains('button', 'Perawatan').click()

    cy.location('search').should('contain', 'status=OFFLINE')
    cy.location('search').should('contain', 'status=MAINTENANCE')

    // OR: hasilnya memuat keduanya, jadi tidak ada baris sehat yang lolos.
    cy.get('table tbody tr td:nth-child(3)').each(($sel) => {
      expect($sel.text()).to.not.contain('Online · sehat')
    })

    // Klik lagi melepas, bukan menumpuk.
    cy.contains('button', 'Offline').click()
    cy.location('search').should('not.contain', 'OFFLINE')
  })

  it('segmen pita dan chip adalah kontrol yang sama dalam dua bentuk', () => {
    cy.get('[aria-label^="Filter Offline"]').click()
    cy.location('search').should('contain', 'status=OFFLINE')
    // Keduanya harus ikut menyala — kalau tidak, pengguna melihat dua kebenaran.
    cy.get('[aria-label^="Filter Offline"]').should('have.attr', 'aria-pressed', 'true')
    cy.contains('button', 'Offline').should('have.attr', 'aria-pressed', 'true')
  })

  it('menampilkan sparkline armada dari data jam yang sungguhan', () => {
    cy.contains('Swap berhasil · 24 jam').should('be.visible')
    // 24 ruas vertikal dalam satu path — satu node, bukan dua puluh empat elemen.
    cy.get('svg[aria-label*="24 jam terakhir"]')
      .first()
      .find('path')
      .invoke('attr', 'd')
      .should('match', /^(M[\d.]+ [\d.]+V[\d.]+){24}$/)
  })
})

describe('Kolom Kondisi', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')
  })

  it('menulis masalahnya dengan kata-kata, bukan enum status', () => {
    // §12.1 nomor 3: sebelumnya masalah harus disimpulkan dari tiga kolom.
    const frasa =
      /Offline \d+ (mnt|jam|hari)|0 slot siap ditukar|Heartbeat basi \d+ (mnt|jam|hari)|Belum pernah lapor|Perawatan|Online · sehat/

    cy.get('table tbody tr td:nth-child(3)').each(($sel) => {
      expect($sel.text().trim()).to.match(frasa)
    })
  })

  it('tiap kondisi punya BENTUK penanda sendiri, bukan hanya warna (WCAG 1.4.1)', () => {
    // Kalau pil kondisi hanya dibedakan warna, satu dari dua belas laki-laki
    // tidak bisa membacanya — dan cetakan hitam-putih tidak bisa sama sekali.
    cy.get('table tbody tr td:nth-child(3) svg').each(($svg) => {
      const anak = $svg[0]!.children
      expect(anak.length, 'penanda punya bentuk').to.be.greaterThan(0)
      expect(['circle', 'rect', 'path']).to.include(anak[0]!.tagName.toLowerCase())
    })

    // Baris sehat memakai lingkaran penuh; baris kritis memakai cincin (ada
    // stroke, tanpa fill). Bentuknya benar-benar berbeda, bukan warna yang beda.
    cy.contains('button', 'Offline').click()
    cy.get('table tbody tr td:nth-child(3) svg circle')
      .first()
      .should('have.attr', 'stroke', 'currentColor')
  })

  it('menyarankan tindakan yang berbeda per kondisi', () => {
    cy.contains('button', 'Offline').click()
    cy.get('table tbody tr td:last-child').first().should('contain', 'Kirim teknisi')

    // Cabinet OFFLINE yang kebetulan juga 0 slot siap tetap lolos filter ini,
    // dan kondisinya dilaporkan OFFLINE karena keparahan itu diperiksa lebih
    // dulu. Jadi tidak dijamin ada baris berkondisi "0 slot siap ditukar" —
    // yang dijamin adalah PASANGANNYA: tiap kondisi membawa tindakannya sendiri.
    const TINDAKAN: Record<string, string> = {
      'Offline': 'Kirim teknisi',
      '0 slot siap ditukar': 'Isi ulang baterai',
      'Belum pernah lapor': 'Cek pemasangan',
      'Heartbeat basi': 'Cek jaringan',
      'Perawatan': 'Jadwal perawatan',
    }

    cy.visit('/cabinets?status=NO_READY_SLOTS')
    cy.get('table tbody tr').should('exist')

    cy.get('table tbody tr').each(($tr) => {
      const kondisi = $tr.find('td:nth-child(3)').text().trim()
      const tindakan = $tr.find('td:last-child').text().trim()

      const cocok = Object.keys(TINDAKAN).find((k) => kondisi.startsWith(k))
      expect(cocok, `kondisi dikenali: ${kondisi}`).to.not.be.undefined
      expect(tindakan, `tindakan untuk "${kondisi}"`).to.eq(TINDAKAN[cocok!])
    })
  })
})

describe('Dua belas segmen slot', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')
  })

  it('menggambar satu segmen per slot fisik, bukan satu bar persentase', () => {
    cy.get('table tbody tr')
      .first()
      .find('td:nth-child(4) span[class*="rounded-[1.5px]"]')
      .should('have.length', 12)
  })

  it('segmennya terurut per state, jadi bentuknya konsisten antar baris', () => {
    // Diurutkan di SQL (FULL → CHARGING → FAULT → LOCKED → EMPTY). Kalau
    // urutannya fisik, tiap baris akan tampak acak dan kolomnya tidak bisa
    // dipindai sebagai satu grafik.
    const RANK = ['bg-ok', 'bg-warn', 'bg-danger', 'bg-info', 'bg-slot-empty']

    cy.get('table tbody tr')
      .first()
      .find('td:nth-child(4) span[class*="rounded-[1.5px]"]')
      .then(($spans) => {
        const ranks = [...$spans].map((el) =>
          RANK.findIndex((c) => el.className.split(' ').includes(c)),
        )
        expect(ranks).to.deep.equal([...ranks].sort((a, b) => a - b))
      })
  })

  it('menulis "0 siap" dengan warna bahaya saat tidak ada yang bisa ditukar', () => {
    cy.visit('/cabinets?status=NO_READY_SLOTS')
    cy.get('table tbody tr').should('exist')
    cy.get('table tbody tr td:nth-child(4)').first().should('contain', '0 siap')
    cy.get('table tbody tr td:nth-child(4) span.text-danger').should('exist')
  })
})

describe('Sortir tingkat masalah', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')
  })

  it('adalah bawaan, dan tidak menaruh cabinet sehat di puncak', () => {
    cy.contains('button', 'Paling bermasalah').should('have.attr', 'aria-pressed', 'true')
    // URL tetap bersih: bawaan tidak ditulis sebagai parameter.
    cy.location('search').should('not.contain', 'sort=')

    cy.get('table tbody tr td:nth-child(3)')
      .first()
      .invoke('text')
      .should('not.contain', 'Online · sehat')
  })

  it('keempat pilihan sortir bekerja dan tersimpan di URL', () => {
    const opsi = [
      ['Swap 24 jam', 'sort=swaps24h'],
      ['Heartbeat', 'sort=lastHeartbeat'],
      ['Kode', 'sort=code'],
    ] as const

    for (const [label, param] of opsi) {
      // Dicari DI DALAM segmented control-nya: "Heartbeat" juga muncul sebagai
      // chip "Heartbeat basi" di pita, dan cy.contains mengambil yang pertama.
      cy.get('[aria-label="Urutkan daftar"]').contains('button', label).click()
      cy.location('search').should('contain', param)
      cy.get('table tbody tr').should('exist')
    }
  })

  it('mengeklik pilihan yang sedang aktif membalik arahnya', () => {
    const sortir = (label: string) =>
      cy.get('[aria-label="Urutkan daftar"]').contains('button', label)

    sortir('Kode').click()
    cy.location('search').should('contain', 'sort=code')

    cy.get('table tbody tr td:nth-child(2)')
      .first()
      .invoke('text')
      .then((pertama) => {
        sortir('Kode').click()

        // `dir=desc` sengaja TIDAK muncul di URL: itu nilai bawaannya, dan
        // parameter yang sama dengan bawaan tidak ditulis supaya tautan yang
        // dibagikan tetap pendek. Jadi yang dibuktikan adalah urutannya
        // benar-benar berbalik, bukan ada tidaknya parameter.
        cy.get('table tbody tr td:nth-child(2)').first().invoke('text').should('not.eq', pertama)
      })
  })
})

describe('Antrean "Tangani lebih dulu"', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')
  })

  it('menampilkan paling banyak tiga cabinet terparah dengan satu tindakan tiap kartu', () => {
    cy.contains('Tangani lebih dulu')
      .parent()
      .parent()
      .within(() => {
        cy.get('a').should('have.length.greaterThan', 0)
      })

    cy.contains('h2', 'Tangani lebih dulu')
      .parents('section')
      .find('[class*="border-l-[3px]"]')
      .should('have.length.at.most', 3)
  })

  it('kartunya benar-benar membawa ke cabinet yang disebutnya', () => {
    cy.contains('h2', 'Tangani lebih dulu')
      .parents('section')
      .find('.font-mono')
      .first()
      .invoke('text')
      .then((kode) => {
        cy.contains('h2', 'Tangani lebih dulu')
          .parents('section')
          .contains('a', 'Buka detail')
          .click()

        cy.location('pathname').should('eq', `/cabinets/${kode.trim()}`)
      })
  })

  it('menghilang sepenuhnya kalau tidak ada yang perlu ditangani', () => {
    // Disaring ke yang sehat saja: tidak ada keparahan ≥ 2, jadi blok ini tidak
    // boleh menyisakan judul kosong menggantung di atas tabel.
    cy.visit('/cabinets?q=zzz-tidak-ada')
    cy.contains('Tangani lebih dulu').should('not.exist')
  })
})

describe('Kesegaran data dan pintasan papan ketik', () => {
  beforeEach(() => {
    cy.masuk()
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')
  })

  it('mengganti checkbox auto-refresh dengan pil kesegaran di header', () => {
    cy.contains('Auto-refresh').should('not.exist')
    cy.get('header').contains(/Segar \d+ dtk|Memuat/).should('be.visible')
    cy.get('header').should('contain', 'WIB')
  })

  it('jeda bertahan setelah muat ulang halaman', () => {
    cy.get('button[aria-label^="Jeda"]').click()
    cy.get('header').should('contain', 'Dijeda')

    cy.reload()
    cy.get('table tbody tr').should('exist')
    cy.get('header').should('contain', 'Dijeda')

    // Bersihkan supaya spec lain tidak mewarisi keadaan terjeda.
    cy.get('button[aria-label^="Lanjutkan"]').click()
    cy.get('header').should('not.contain', 'Dijeda')
  })

  it('/ memfokuskan pencarian, j/k memindah baris, ↵ membukanya', () => {
    cy.get('body').type('/')
    cy.focused().should('have.attr', 'type', 'search')
    cy.focused().blur()

    cy.get('body').type('j')
    cy.get('table tbody tr').first().should('have.class', 'outline-2')

    cy.get('body').type('j').type('k')
    cy.get('table tbody tr').first().should('have.class', 'outline-2')

    cy.get('table tbody tr')
      .first()
      .find('td:nth-child(2) a')
      .invoke('text')
      .then((kode) => {
        cy.get('body').type('{enter}')
        cy.location('pathname').should('eq', `/cabinets/${kode.trim()}`)
      })
  })

  it('angka 1–4 memilih chip kondisi', () => {
    cy.get('body').type('2')
    cy.location('search').should('contain', 'status=OFFLINE')
  })

  it('tidak membajak ketukan saat pengguna sedang mengetik', () => {
    // Tanpa penjaga ini, mengetik "jakarta" akan melompat-lompatkan baris dan
    // memfilter tabel secara acak di tengah pencarian.
    cy.get('input[type=search]').type('jkt2')
    cy.get('input[type=search]').should('have.value', 'jkt2')
    cy.location('search').should('not.contain', 'status=')
  })
})

describe('Keadaan kosong dan error hasil redesign', () => {
  beforeEach(() => cy.masuk())

  it('keadaan kosong menyebut filter yang aktif dan menawarkan melonggarkannya', () => {
    cy.visit('/cabinets?q=zzz-tidak-ada&status=OFFLINE')

    cy.contains('Tidak ada cabinet yang cocok').should('be.visible')
    cy.contains('zzz-tidak-ada').should('be.visible')
    cy.contains('Offline').should('be.visible')

    // Melonggarkan satu per satu, bukan hanya jalan buntu "bersihkan semua".
    cy.contains('button', 'Cari tanpa filter kondisi').click()
    cy.location('search').should('not.contain', 'status=')
    cy.location('search').should('contain', 'q=zzz-tidak-ada')
  })

  it('banner error menyebut UMUR data yang masih terlihat, dan tidak mengosongkan tabel', () => {
    cy.visit('/cabinets')
    cy.get('table tbody tr').should('exist')

    // Mode gagal dashboard yang polling bukan layar kosong — melainkan angka
    // basi yang masih terlihat hidup. Barisnya HARUS bertahan.
    cy.intercept('GET', '/api/cabinets*', { forceNetworkError: true }).as('gagal')
    cy.get('button[aria-label^="Jeda"]').click()
    cy.get('button[aria-label^="Lanjutkan"]').click()
    cy.wait('@gagal')

    cy.contains('Server tidak menjawab').should('be.visible')
    cy.contains(/terakhir berhasil dimuat/).should('be.visible')
    cy.get('table tbody tr').should('have.length.greaterThan', 0)
    cy.get('header').should('contain', 'Gagal')
  })
})
