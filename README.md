# ECGO — Battery Swap Monitoring Dashboard

Jawaban untuk **TEST-ENG-FS-001 · Fullstack Developer (Web)**
Kandidat: **Ade Rusmana** · ar.xendit@bti.id

> ⚠️ **Sebelum dikirim, lengkapi dulu:** nomor WhatsApp dan tanggal selesai di tabel
> identitas di bawah. Saya sengaja tidak mengisinya dengan tebakan.

| Field | Isi |
| --- | --- |
| Nama lengkap | Ade Rusmana |
| Email | ar.xendit@bti.id |
| Nomor WhatsApp | _(isi sebelum kirim)_ |
| Tanggal mulai mengerjakan | 10 Agustus 2026 |
| Tanggal selesai | _(isi sebelum kirim)_ |
| AI tool yang dipakai | Claude Code (Opus) — rincian per bagian di §9 |

---

## 1. Isi repositori ini

| Bagian | Bentuk | Lokasi |
| --- | --- | --- |
| **A** — Konsep & Fundamental | Tulisan | [`docs/A-konsep.md`](docs/A-konsep.md) |
| **B1** — Geofence check-in | Kode + 36 test | [`shared/geofence/evaluateCheckIn.ts`](shared/geofence/evaluateCheckIn.ts) · [`tests/geofence.spec.ts`](tests/geofence.spec.ts) |
| **B2/B3** — Skala & PostGIS | Tulisan | [`docs/B-scaling.md`](docs/B-scaling.md) |
| **C** — Code review & security | Tulisan + kode | [`docs/C-code-review.md`](docs/C-code-review.md) |
| **D** — Dashboard | Aplikasi | `app/` · `server/` · `db/` · `scripts/` |
| — | Spesifikasi yang saya tulis sebelum ngoding | [`SPEC.md`](SPEC.md) |

Bagian B1 juga bisa dicoba langsung di browser pada halaman **`/geofence`** — halaman
itu meng-import modul yang sama persis yang diuji unit test, bukan salinannya.

---

## 2. Menjalankan dari nol

Butuh **Node ≥ 20.19** dan **Docker**.

```bash
cp .env.example .env
npm install
docker compose up -d      # PostgreSQL 16 di port 55432
npm run db:migrate        # jalankan db/migrations/*.sql
npm run seed              # 12 cabang · 50 cabinet · 600 slot · 22.000 swap
npm run dev               # http://localhost:3000
```

Perintah lain:

```bash
npm test          # 60 test (36 geofence + 24 kontrak API)
npm run typecheck
npm run build
npm run db:reset  # buang schema, migrasi ulang dari nol
npm run simulate  # opsional — lihat §2.1
```

### 2.1 `npm run simulate` — dan kenapa ada

Jalankan di terminal terpisah, biarkan hidup:

```bash
npm run simulate
```

Seed menulis heartbeat sebagai **stempel waktu absolut**. Cabinet sungguhan mengirim
heartbeat terus-menerus; data seed tidak. Jadi sepuluh menit setelah `npm run seed`,
seluruh armada melewati ambang basi dan dashboard menampilkan **50 cabinet kuning** —
bukan karena kodenya salah, melainkan karena data statis menua sementara "sekarang"
terus berjalan. Saya menemukan ini saat membuka halaman daftar 20 menit setelah
menyemai; screenshot-nya waktu itu menunjukkan "Perlu perhatian: 50".

Simulator menjadikan armadanya hidup — heartbeat berdetak, swap baru masuk — sehingga
angka 24 jam dan indikator basi berperilaku seperti di produksi. Ia sengaja **proses
terpisah, bukan cron di dalam server**: di produksi, satu-satunya yang berhak menulis
kolom heartbeat adalah cabinet-nya sendiri, dan aplikasi tidak boleh punya jalur kode
untuk memalsukannya.

Kalau tidak ingin menjalankannya, cukup `npm run seed` ulang sebelum melihat dashboard.

---

## 3. Pilihan stack — dan penyimpangan yang saya ambil

**Nuxt 4 · Vue 3 (Composition API) · TypeScript strict · Tailwind CSS v4 · PostgreSQL 16 · Zod · Vitest**

Tabel "Wajib ada" di Bagian D menyebut Next.js 15. Bagian "Konteks produk & stack"
di dokumen yang sama menyebut: *"Kalau pengalamanmu di stack lain (Laravel/Vue/Nuxt/
Express), tetap kerjakan — untuk Bagian B dan D kamu boleh pakai stack yang kamu
kuasai asalkan TypeScript, dan tulis di README."*

Kedua kalimat itu bertabrakan, jadi saya harus memilih dan menyatakannya terbuka.
**Saya memilih Nuxt**, karena:

1. Izinnya eksplisit dan menyebut Nuxt secara nama.
2. Pengalaman produksi saya Vue 3 — sekitar 900 komponen Vue di beberapa produk —
   dan nol React.
3. **Sesi 3 mewajibkan saya menjelaskan setiap baris tanpa bantuan AI dan melakukan
   perubahan live.** Mengirimkan Next.js yang saya tulis sambil belajar akan lolos di
   kertas dan gugur di sesi itu. Saya lebih memilih dinilai atas kode yang benar-benar
   saya kuasai.

Semua syarat lain dipenuhi apa adanya: TypeScript, Tailwind, PostgreSQL, Zod.

### Peta konsep Next.js 15 → Nuxt 4

Supaya penilaiannya tetap apple-to-apple:

| Next.js 15 (App Router) | Nuxt 4 | Di repo ini |
| --- | --- | --- |
| Server Component | komponen dirender Nitro saat SSR (default) | semua halaman |
| `"use client"` | `onMounted` / `<ClientOnly>` / `.client.vue` | `useNow()`, auto-refresh |
| Route Handler `app/api/*/route.ts` | Nitro `server/api/*.get.ts` | 4 endpoint |
| `searchParams` | `useRoute().query` + `router.replace` | `useCabinetQuery()` |
| `useFormStatus` / `useActionState` | status dari `useFetch` | state loading/error |
| `next.config` `headers` | `nitro.routeRules` | `no-store` untuk `/api/**` |

---

## 4. Arsitektur

```
app/                     Vue 3 — halaman, komponen, composable
server/api/              Nitro route handler (validasi Zod, amplop error seragam)
server/utils/            pool database, pembungkus error
shared/contracts/        skema Zod + tipe, dipakai server DAN client
shared/geofence/         Bagian B1 — murni, tanpa dependensi
db/migrations/           SQL bernomor, dijalankan sekali, tercatat
scripts/                 migrate · seed · simulate
tests/                   Vitest
```

`shared/` adalah intinya: skema query dan tipe respons hanya punya **satu** definisi.
Server memvalidasi dengan skema itu, client membangun URL dari tipe yang sama. Kalau
keduanya punya definisi sendiri-sendiri, keduanya pasti menyimpang — dan korbannya
adalah URL yang sudah di-bookmark pengguna.

### Endpoint

| Endpoint | Kegunaan |
| --- | --- |
| `GET /api/cabinets` | daftar — pencarian, filter, sortir, pagination |
| `GET /api/cabinets/:code` | detail — slot, grafik per jam, 20 swap terakhir |
| `GET /api/summary` | KPI armada |
| `GET /api/health` | health check yang benar-benar menyentuh database |

Amplop sukses: `{ data, meta? }`. Amplop error: `{ error: { code, message, details? } }`
dengan `code` ∈ `VALIDATION_ERROR (400) | NOT_FOUND (404) | INTERNAL (500)`.

---

## 5. Nol N+1 — dan buktinya

Halaman daftar dilayani **satu query**: dua CTE agregasi di-join sekali, dengan
`count(*) OVER ()` menyediakan total pagination. Bentuk naifnya — ambil cabinet, lalu
untuk tiap cabinet hitung swap dan slot — adalah 1 + 2×25 = **51 round-trip** untuk
satu layar.

Agregasi 24 jam dihitung `count(*)` di PostgreSQL, bukan dengan menarik baris ke
JavaScript. `EXPLAIN (ANALYZE, BUFFERS)` atas query daftar:

```
Limit (actual rows=5 loops=1)
  ...
  ->  Bitmap Heap Scan on swap_transactions s (actual rows=24 loops=5)
        Recheck Cond: ((cabinet_id = f_1.id) AND (occurred_at >= (now() - '24:00:00')))
        ->  Bitmap Index Scan on swap_tx_cabinet_time_idx (actual rows=25 loops=5)
              Index Cond: ((cabinet_id = f_1.id) AND (occurred_at >= (now() - '24:00:00')))
Planning Time: 1.353 ms
Execution Time: 0.425 ms
```

Index `(cabinet_id, occurred_at DESC)` terpakai persis seperti rancangannya. Halaman
detail: 4 query dijalankan paralel, nol query di dalam loop.

**Catatan jujur soal index trigram.** `002_indexes.sql` membuat index GIN `pg_trgm`
untuk pencarian `ILIKE '%q%'`. Pada 50 cabinet, planner **mengabaikannya** dan memilih
Seq Scan — dan itu keputusan yang benar. Saya verifikasi index-nya memang berfungsi
dengan tabel percobaan 200.000 baris; di situ planner memilih Bitmap Index Scan dan
selesai dalam 0,074 ms. Ada satu batasan lagi yang tidak bisa diselesaikan index:
query pencarian meng-OR tiga kolom dari **dua tabel**, dan OR lintas tabel memaksa
filter dievaluasi setelah join berapa pun besar datanya. Perbaikannya bukan menambah
index, melainkan mengubah bentuk query — UNION dua pencarian, atau kolom
`search_text` terdenormalisasi. Belum saya lakukan karena akan menambah jalur
sinkronisasi demi masalah yang belum ada.

---

## 6. Asumsi — lubang spesifikasi yang saya putuskan sendiri

Soal menyatakan spesifikasinya sengaja tidak lengkap. Ini keputusan saya, beserta
alasannya. Versi lengkap ada di [`SPEC.md`](SPEC.md) §7.

**6.1 "Swap 24 jam terakhir" = rolling 24 jam, bukan sejak tengah malam.**
Kolom ini dipakai mengurutkan cabinet paling sibuk. Kalau dihitung sejak tengah malam,
pukul 00.05 semua cabinet bernilai ~0 dan kolom sortirnya jadi tak berguna persis di
shift malam.

**6.2 Swap = yang BERHASIL saja.** Cabinet yang menolak 40 rider tidak sedang sibuk,
ia sedang rusak, dan tidak boleh naik ke puncak sortir. Kegagalan ditampilkan
terpisah di halaman detail dan di KPI, jadi tidak ada informasi yang hilang.

**6.3 Cabinet OFFLINE tetap menampilkan state slot terakhir, tapi ditandai basi.**
Menyembunyikannya menghambat teknisi yang butuh kondisi terakhir sebelum putus.
Menampilkannya seolah live berbahaya — bisa mengirim rider ke cabinet yang "FULL"
tiga jam lalu. Kompromi: data tampil, panel diberi banner, umur data ditulis relatif,
grid diredupkan. **Data basi harus terlihat basi.**

**6.4 `last_heartbeat` NULL = belum pernah melapor.** Ditampilkan "Belum pernah",
bukan "56 tahun lalu", dan diurutkan `NULLS LAST` supaya cabinet yang baru dipasang
tidak menumpuk di puncak daftar "paling bermasalah". Seed menjamin selalu ada 2
cabinet seperti ini supaya cabang kode ini benar-benar teruji.

**6.5 Basi ≠ OFFLINE.** `status` adalah kolom yang dilaporkan perangkat atau operator
— MAINTENANCE adalah keputusan manusia, mustahil diturunkan dari heartbeat. Tapi
cabinet yang mengaku ONLINE sementara heartbeat-nya 40 menit lalu adalah anomali yang
**paling ingin dilihat ops**. Jadi saya turunkan flag terpisah `isStale` (ambang 10
menit, bisa diatur lewat env) dan menampilkan "Online · basi" — bukan diam-diam
menulis ulang statusnya.

**6.6 SOC ada jika dan hanya jika ada baterainya.** Slot `EMPTY` punya `soc` NULL dan
dirender "—", bukan "0%". 0% berarti baterai habis; itu pekerjaan ops yang berbeda
dari lubang kosong. Invarian ini ditegakkan CHECK constraint di database, bukan hanya
oleh kode aplikasi.

**6.7 Pagination: offset, sadar konsekuensinya.** Halaman ini mengurutkan berdasarkan
**agregat terhitung** yang tidak tersimpan di kolom mana pun, dan UI-nya butuh
"halaman 3 dari 12" plus lompat halaman. Cursor pagination di atas kunci sortir
non-unik butuh cursor komposit dan tetap tidak bisa memberi nomor halaman.
Populasinya kecil dan terbatas (50 sekarang, ~5.000 pada skenario B2), jadi OFFSET
terburuk melewati ribuan baris, bukan ratusan ribu.
**Ini kebalikan dari jawaban saya di A9** untuk tabel 500.000 transaksi — dan memang
harus berbeda: pilihan pagination adalah fungsi dari ukuran data, kunci sortir, dan
kebutuhan UI. Titik balik saya: begitu daftar ini melewati ~50.000 baris atau butuh
infinite scroll, saya pindah ke keyset.

**6.8 Zona waktu: simpan UTC, tampilkan WIB.** Semua kolom `timestamptz`. Bucket
grafik dihitung `AT TIME ZONE 'Asia/Jakarta'` supaya "pukul 07.00" berarti jam 7 pagi
bagi tim ops. Data seed pun dibangkitkan dalam WIB — kalau puncaknya dibangkitkan
pada jam UTC, "jam sibuk pagi" akan muncul pukul 2 siang di layar.

**6.9 Grafik dan KPI memakai jendela yang sedikit berbeda, dan itu disengaja.**
Grafik berisi 24 **bucket jam penuh**, jadi mulai dari puncak jam 23 jam lalu — antara
23 dan 24 jam data. KPI memakai rolling 24 jam yang persis. Totalnya akan berbeda
beberapa swap. Karena angka berbeda tanpa penjelasan terbaca sebagai bug, judul
grafiknya menyebut rentang sesungguhnya ("sejak pukul 18.00 WIB"), bukan "24 jam
terakhir".

**6.10 `slot_count` disimpan per cabinet, default 12.** Soal menyebut grid 12 slot dan
50×12 = 600, jadi angkanya konsisten. Tapi menghardcode 12 akan pecah saat ECGO
memasang cabinet 8 atau 16 slot; grid merender `slot_count`.

**6.11 Kolom tambahan "slot siap".** Soal meminta "jumlah slot terisi per total".
Saya menambahkan hitungan slot `FULL` di sebelahnya, karena "10/12 terisi" terdengar
sehat sampai kelihatan hanya 2 yang benar-benar penuh — dan pertanyaan yang sebenarnya
dipedulikan ops adalah "bisakah rider swap di sini sekarang?".

---

## 7. Trade-off lain yang saya ambil sadar

**SQL mentah (postgres.js), bukan ORM.** Bagian D dinilai atas "agregasi dihitung di
database". Saya ingin agregasi itu terlihat sebagai SQL yang bisa dibaca dan
di-`EXPLAIN`, bukan tersembunyi di balik query builder. Konsekuensinya: tidak ada
tipe hasil query yang dihasilkan otomatis, jadi saya mendeklarasikan tipe baris secara
manual — kalau SQL dan tipe menyimpang, TypeScript tidak akan menangkapnya. Di proyek
jangka panjang saya akan menambahkan pengecekan tipe SQL di CI.

**Grafik SVG inline, bukan library.** Chart.js atau ApexCharts menambah 60–200 KB
JavaScript untuk 24 buah persegi panjang, dan tetap menyisakan pekerjaan pada bagian
yang saya pedulikan: aksesibilitas dan pewarnaan yang mengikuti tema. Versi yang bisa
dibaca pembaca layar (tabel sungguhan di dalam `<figure>`) lebih mudah dibuat sendiri
daripada dipasang belakangan. Konsekuensinya: tidak ada zoom, brush, atau tooltip
canggih. Kalau nanti butuh itu, library adalah jawaban yang benar.

**Migration runner sendiri, 40 baris.** Yang saya butuhkan hanya "jalankan file .sql
yang belum pernah dijalankan, di dalam transaksi, lalu catat". Menukarnya dengan
tool yang punya DSL sendiri membuat SQL di repo ini tidak lagi bisa dibaca apa adanya.
Konsekuensinya: tidak ada `down` migration. Untuk produksi saya akan memakai Flyway
seperti yang saya pakai sehari-hari.

**Poppins di-bundle, Gilroy tidak.** Keduanya dipakai ECGO di situs resminya. Poppins
berlisensi SIL OFL, jadi aman disertakan (di-subset latin: 158 KB TTF → 7,4 KB woff2
per weight). Gilroy berlisensi komersial, jadi tidak saya sertakan meski tersedia di
server ECGO.

**Aset dan warna diambil dari ecgoevmoto.com.** Hijau `#00D95C`, hijau logo `#47A056`,
teal `#236057` — disampel dari file aset resmi, bukan dikira-kira.

---

## 8. Yang belum selesai

Saya menulisnya di sini alih-alih berharap tidak ketahuan.

1. **Tidak ada autentikasi.** Endpoint-nya terbuka. Kalau di-deploy apa adanya, ini
   kebocoran data dan IDOR. Soal Bagian D tidak memintanya, dan bentuk perbaikannya
   saya tunjukkan lengkap di jawaban C2 (cek sesi + scoping `branch_id` dari sesi,
   bukan dari URL). **Ini yang pertama akan saya kerjakan.**
2. **Tidak ada E2E test.** Ada 36 unit test dan 24 test kontrak API, tapi tidak ada
   yang mengklik UI. Saya memverifikasinya secara visual dengan Playwright
   (light/dark, mobile, empty, error, 404) dan tidak menemukan error konsol, tapi
   itu belum saya jadikan test yang berjalan otomatis.
3. **Test kontrak API butuh server hidup** dan akan di-skip kalau tidak ada. Idealnya
   memakai testcontainers supaya berjalan mandiri di CI.
4. **Pencarian tidak akan berskala** melewati puluhan ribu cabinet karena OR lintas
   tabel (§5). Perbaikannya sudah saya tuliskan; belum saya kerjakan.
5. **Belum di-deploy.** Semuanya lokal lewat Docker Compose. Aplikasinya tidak
   bergantung pada apa pun yang khusus lokal, jadi deploy ke Vercel + Neon mestinya
   lurus, tapi saya belum membuktikannya — jadi saya tidak mengklaimnya.
6. **Realtime masih polling 30 detik**, bukan WebSocket atau SSE. Cukup untuk
   pemantauan cabinet; kalau ops butuh yang lebih cepat, `LISTEN/NOTIFY` Postgres
   yang diteruskan lewat SSE adalah langkah berikutnya.
7. **Belum ada rate limiting** dan belum ada log terstruktur dengan request id.

---

## 9. Penggunaan AI

Saya memakai **Claude Code (Opus)** untuk mengerjakan tes ini, dan berikut jujurnya
untuk bagian apa:

| Bagian | Peran AI | Peran saya |
| --- | --- | --- |
| Bagian A, B2/B3, C | Menyusun draf dan merapikan bahasa | Semua keputusan teknis, contoh, dan penolakan premis A11/A12 |
| B1 `evaluateCheckIn` | Membuat kerangka dan test | Empat keputusan penafsiran (§A–D di kode) dan verifikasi tie-break |
| Skema & seed | Draf SQL dan generator | Rancangan index, invarian CHECK, kuota status deterministik |
| API | Draf route handler | Bentuk query, kontrak error, keputusan swaps24h SUCCESS-saja |
| UI | Draf komponen Vue | Rancangan UX, keputusan aksesibilitas, keputusan bahwa data basi harus terlihat basi |
| Benchmark & EXPLAIN | Menjalankan | Menafsirkan, dan mengubah jawaban B2 karenanya |

Beberapa hal yang saya temukan dan perbaiki sendiri selama pengerjaan, sebagai bukti
bahwa saya tidak sekadar menerima keluaran AI:

- `count(*) OVER ()` melaporkan **total 0** untuk armada 50 cabinet pada halaman di
  luar jangkauan, karena ia menumpang pada baris yang dikembalikan. Ditemukan oleh
  test kontrak yang saya tulis, bukan oleh mata.
- Kuota status yang diundi per cabinet menghasilkan **nol cabinet MAINTENANCE** pada
  setiap kali seed dijalankan — undian 0,5% yang menjadi permanen karena PRNG-nya
  deterministik, sehingga filter MAINTENANCE selalu kosong.
- Seluruh armada tampak basi 20 menit setelah seed (§2.1).
- Benchmark B2 membalik arah jawabannya: perhitungan haversine hanya **1,67% dari
  satu core** di beban puncak, jadi mengoptimasinya akan sia-sia.

**Saya siap menjelaskan setiap baris di repo ini tanpa bantuan AI di Sesi 3**, dan
itu pertimbangan utama di balik pemilihan Vue ketimbang React (§3).

---

## 10. Riwayat commit

Commit dibuat bertahap per lapisan, dengan pesan yang menjelaskan **kenapa**, bukan
hanya apa:

```
chore: scaffold Nuxt 4 + Tailwind v4 + Postgres 16 with ECGO brand theme
feat(bagian-b): evaluateCheckIn geofence evaluator with 36 tests
feat(db): schema, indexes, migration runner and deterministic seed
feat(api): cabinet list and detail endpoints with Zod validation
feat(ui): cabinet list and detail pages, URL-driven state, three real UI states
docs: answers for Bagian A, B2/B3, and C
```
