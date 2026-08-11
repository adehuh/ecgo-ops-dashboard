# Deploy ke Vercel

Konfigurasi dan langkah untuk menjalankan dashboard ini di Vercel, lengkap dengan
datanya. Ditulis supaya bisa diulang orang lain, bukan hanya oleh yang kebetulan
sudah punya semua tab-nya terbuka.

## Kenapa aplikasi ini tidak bisa langsung di-deploy apa adanya

Dua hal harus berubah, dan keduanya sudah dikerjakan di repo ini:

**1. Vercel tidak menjalankan proses yang hidup terus.** `npm start` memanggil
`app.listen()` dan menunggu di sebuah port. Vercel memanggil sebuah *fungsi* per
request; port itu tidak pernah ada. Karena itu aplikasinya dipecah:

| Berkas | Peran |
| --- | --- |
| `server/app.ts` | aplikasi Express-nya saja, tanpa `listen()` |
| `server/index.ts` | menambahkan port + graceful shutdown (Docker, VPS, `npm start`) |
| `api/index.ts` | mengekspor `app` yang SAMA sebagai handler serverless |

Objeknya satu dan sama. Tidak ada cabang "versi Vercel" yang bisa menyimpang
diam-diam dari yang diuji 50 test Cypress.

**2. Databasenya lokal.** `DATABASE_URL` bawaan menunjuk
`localhost:55432` — Postgres di Docker. Fungsi di Vercel tidak punya akses ke
sana. Perlu Postgres terkelola, dan skema serta datanya harus dipasang ke sana.

## Berkas konfigurasi

| Berkas | Kenapa di situ |
| --- | --- |
| `vercel.json` (akar repo) | Vercel hanya membaca `vercel.json` di akar. Tidak bisa dipindah ke folder ini. |
| `api/index.ts` (akar repo) | Konvensi Vercel untuk mendeteksi fungsi. |
| `vercel/env.example` | Daftar environment variable yang harus diisi. |

Isi `vercel.json`:

- `buildCommand: npm run build:web` — hanya SPA-nya yang di-build jadi aset
  statis. Sisi server dikompilasi Vercel sendiri dari `api/index.ts`.
- `outputDirectory: dist/client`
- rewrite `/api/(.*)` → `/api` — SELURUH API masuk ke **satu** fungsi, bukan satu
  fungsi per endpoint. Satu fungsi berarti satu cold start dan satu connection
  pool; memecahnya per endpoint mengalikan keduanya tanpa menambah apa pun.
- rewrite sisanya → `/index.html` supaya Vue Router menangani rutenya. Vercel
  memeriksa berkas statis lebih dulu, jadi `/assets/*` tetap dilayani CDN.

## Environment variable

Wajib:

| Nama | Nilai |
| --- | --- |
| `DATABASE_URL` | connection string Postgres terkelola, **harus** `?sslmode=require` |

Opsional (ada defaultnya):

| Nama | Default | Catatan |
| --- | --- | --- |
| `ECGO_STALE_MINUTES` | `10` | ambang heartbeat basi |
| `TRUST_PROXY` | `1` di Vercel | jangan dilonggarkan; rate limit login memakai `req.ip` |

`NODE_ENV=production` dan `VERCEL=1` dipasang Vercel sendiri. `VERCEL` yang
membuat pool database menyusut ke satu koneksi per instance dan menyalakan TLS —
lihat `server/db.ts`.

## Langkah

### 1. Sediakan Postgres

Vercel → **Storage** → **Neon** (Serverless Postgres) → region **Singapore
(ap-southeast-1)**, yang paling dekat ke Jakarta. Neon dipilih karena ia partner
Postgres bawaan Vercel dan `DATABASE_URL`-nya langsung disuntikkan ke project.

Provider lain juga bisa — Supabase, atau Postgres mana pun yang bisa diakses
dari internet dengan TLS. Yang dibutuhkan cuma satu connection string.

### 2. Import repo

Vercel → **Add New** → **Project** → import `adehuh/ecgo-ops-dashboard`.
Framework preset: **Other**. Sisanya sudah dijawab `vercel.json`.

### 3. Pasang skema dan data

Migrasi dan seed dijalankan DARI MESIN LOKAL terhadap database terkelola itu —
bukan dari dalam Vercel. Fungsi serverless punya batas waktu, dan menyemai 22.000
transaksi bukan pekerjaan yang pantas dijalankan di dalam sebuah request:

```bash
export DATABASE_URL='postgres://…?sslmode=require'   # dari Neon
npm run db:migrate
npm run seed
```

`npm run seed` idempoten (truncate-then-insert dalam satu transaksi), jadi aman
dijalankan berulang.

### 4. Verifikasi

```bash
curl -s https://<domain>/api/health          # menyentuh database sungguhan
```

Lalu masuk dengan akun demo dari README §2. Tombol akun demo TIDAK dirender di
produksi — Vite membuangnya dari bundel lewat `import.meta.env.DEV` — jadi
kredensialnya diketik manual.

## Yang harus diingat setelah deploy

**Data seed menua.** Heartbeat disemai sebagai stempel waktu absolut, jadi
sekitar sepuluh menit setelah `npm run seed` seluruh armada melewati ambang basi
dan dashboard menampilkan 50 cabinet kuning (README §2.1). Di lokal itu diatasi
`npm run simulate`. Di deployment demo, jalankan ulang `npm run seed` sebelum
menunjukkannya, atau arahkan simulator ke `DATABASE_URL` yang sama.

**Rate limit login masih per-instance.** Ia disimpan di memori proses (README §9
nomor 3). Serverless menjalankan banyak instance, jadi di Vercel batasnya
menjadi per-instance, bukan global — lebih longgar dari yang tertulis. Untuk
produksi sungguhan ia harus pindah ke Redis; untuk demo ini, ini catatan jujur,
bukan perbaikan yang dipura-purakan.
