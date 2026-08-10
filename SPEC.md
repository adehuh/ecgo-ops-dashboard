# SPEC — ECGO Technical Assessment (TEST-ENG-FS-001)

Kandidat: **Ade Rusmana** · Posisi: Fullstack Developer (Web)
Dokumen ini adalah spesifikasi kerja yang saya tulis **sebelum** menulis kode. Semua
keputusan atas lubang spesifikasi ada di bagian §7.

---

## 1. Objective

Mengerjakan empat bagian assessment dalam satu repositori Git:

| Bagian | Bentuk | Lokasi |
| --- | --- | --- |
| A — Konsep & Fundamental (25) | Tulisan | `docs/A-konsep.md` |
| B1 — Geofence check-in (20) | Kode TS + test | `shared/geofence/` + `tests/` |
| B2/B3 — Scaling & PostGIS (10) | Tulisan | `docs/B-scaling.md` |
| C — Code review & security (20) | Tulisan + kode | `docs/C-code-review.md` |
| D — Battery Swap Monitoring Dashboard (25) | Aplikasi | `src/`, `server/`, `db/`, `scripts/` |

**Target user Bagian D:** tim operasional internal ECGO yang memantau cabinet battery
swap dari desk maupun dari lapangan lewat tablet. Mereka butuh satu pertanyaan
terjawab cepat: *cabinet mana yang bermasalah sekarang, dan seberapa sibuk dia.*

---

## 2. Tech stack & justifikasi

| Layer | Pilihan | Alasan |
| --- | --- | --- |
| Framework | **Vue 3 SPA** (Composition API, Vite, Vue Router, Pinia) | Soal mengizinkan: *"Kalau pengalamanmu di stack lain (Laravel/Vue/Nuxt/Express), tetap kerjakan — untuk Bagian B dan D kamu boleh pakai stack yang kamu kuasai asalkan TypeScript, dan tulis di README."* Vue disebut namanya, dan itu stack produksi saya. |
| API | **Express 5** (TypeScript) | Juga disebut namanya di kalimat izin yang sama. |
| Bahasa | **TypeScript** strict | Wajib, dan memang syarat satu-satunya yang tidak bisa ditawar. |
| Styling | **Tailwind CSS v4** | Diminta eksplisit; juga stack saya. |
| Database | **PostgreSQL 16** via Docker Compose | Diminta; lokal supaya reviewer bisa `docker compose up` tanpa akun Supabase. |
| DB client | **postgres.js** (`postgres`) | SQL mentah dan parameterised. Saya ingin agregasi terlihat sebagai SQL, bukan tersembunyi di balik ORM — Bagian D dinilai pada "agregasi dihitung di database". |
| Validasi | **Zod** | Diminta eksplisit. |
| Test | **Vitest** | Diminta (Vitest atau Jest); juga stack saya. |
| Migrasi | file `.sql` bernomor + runner kecil | Pola Flyway yang saya pakai sehari-hari, tanpa dependency berat. |

**Catatan jujur tentang penyimpangan stack.** Tabel "Wajib ada" di Bagian D menyebut
Next.js 15, sementara bagian "Konteks produk & stack" memberi izin memakai Vue atau
Express. Kedua kalimat itu bertabrakan. Saya memilih Vue + Express karena (a) izinnya
eksplisit dan menyebut keduanya secara nama, dan (b) Sesi 3 mewajibkan saya
menjelaskan tiap baris kode tanpa AI — menulis Next.js hasil generate yang tidak saya
kuasai akan gugur di situ.

**Catatan riwayat.** Beberapa commit pertama memakai Nuxt sebelum dipindahkan ke Vue
murni + Express; riwayatnya sengaja tidak ditulis ulang. Konsekuensi memilih SPA
ketimbang framework SSR saya bahas di README §3.

---

## 3. Commands

```bash
npm install
docker compose up -d          # PostgreSQL 16 di :55432
npm run db:migrate            # jalankan db/migrations/*.sql berurutan
npm run seed                  # 50 cabinet, 600 slot, 20.000 swap (satu perintah, idempotent)
npm run dev                   # http://localhost:3000
npm run typecheck
npm test                      # Vitest: geofence + kontrak API
npm run build
```

`npm run seed` harus bisa dijalankan berkali-kali tanpa menggandakan data
(truncate-then-insert di dalam satu transaksi).

---

## 4. Project structure

```
ecgo-ops-dashboard/
├─ SPEC.md                    ← dokumen ini
├─ README.md                  ← setup, asumsi, trade-off, AI disclosure
├─ docker-compose.yml · index.html · vite.config.ts
├─ docs/{A-konsep,B-scaling,C-code-review}.md
├─ db/migrations/{001_schema,002_indexes,003_auth}.sql
├─ scripts/{migrate,seed,simulate}.ts
├─ shared/                    ← dipakai KEDUA sisi
│  ├─ geofence/evaluateCheckIn.ts   ← Bagian B1
│  ├─ contracts/{cabinets,auth,errors}.ts
│  └─ auth/password.ts              ← scrypt, dipakai server dan seed
├─ server/                    ← Express 5
│  ├─ index.ts · env.ts · db.ts · http.ts · auth.ts
│  └─ routes/{auth,cabinets,misc}.ts
├─ src/                       ← Vue 3 SPA
│  ├─ main.ts · App.vue
│  ├─ api/client.ts · composables/{useApi,useCabinetQuery,useNow,useTheme}.ts
│  ├─ router/index.ts · stores/auth.ts
│  ├─ views/ · components/ · utils/ · assets/css/
└─ tests/{geofence,api-contract,auth}.spec.ts + helpers.ts
```

---

## 5. Data model

```
branches(id pk, code uniq, name, city, lat, lng, radius_m, active)
cabinets(id pk, code uniq, branch_id fk, status, slot_count, last_heartbeat_at, installed_at)
slots(id pk, cabinet_id fk, slot_no, state, battery_id null, soc null, updated_at,
      unique(cabinet_id, slot_no), check(soc between 0 and 100))
swap_transactions(id pk, cabinet_id fk, slot_no, rider_ref, occurred_at,
                  soc_in, soc_out, duration_s, status)
```

- `cabinets.status` ∈ `ONLINE | OFFLINE | MAINTENANCE`
- `slots.state` ∈ `EMPTY | CHARGING | FULL | LOCKED | FAULT`
- `swap_transactions.status` ∈ `SUCCESS | FAILED`
- semua kolom waktu `timestamptz`

**Index yang wajib ada** (dan alasannya, karena ini yang dinilai):

| Index | Untuk |
| --- | --- |
| `swap_transactions(cabinet_id, occurred_at DESC)` | agregasi 24 jam per cabinet + daftar 20 swap terakhir |
| `swap_transactions(occurred_at DESC)` | pemotongan window 24 jam sebelum join |
| `slots(cabinet_id, slot_no)` | grid slot + hitung terisi |
| `cabinets(branch_id)` | join cabang |
| GIN `pg_trgm` pada `cabinets.code` dan `branches.name` | pencarian server-side `ILIKE '%q%'` tanpa seq scan |

---

## 6. API contract

Semua respons sukses: `{ "data": ..., "meta"?: ... }`
Semua respons error: `{ "error": { "code": ..., "message": ..., "details"?: ... } }`
dengan `code` ∈ `VALIDATION_ERROR (400) | UNAUTHORIZED (401) | NOT_FOUND (404) |
TOO_MANY_REQUESTS (429) | INTERNAL (500)`.

Semua endpoint cabinet dan summary menuntut sesi, dan hasilnya dibatasi ke cabang
yang menjadi hak pengguna. Objek di luar ruang lingkup dijawab **404, bukan 403** —
403 mengonfirmasi bahwa objeknya ada.

### `GET /api/cabinets`

| Param | Tipe | Default | Catatan |
| --- | --- | --- | --- |
| `q` | string ≤ 100 | `""` | cocokkan kode cabinet **atau** nama/kode cabang, server-side |
| `status` | `ONLINE\|OFFLINE\|MAINTENANCE`, boleh diulang | semua | |
| `sort` | `swaps24h\|code\|lastHeartbeat` | `swaps24h` | |
| `dir` | `asc\|desc` | `desc` | |
| `page` | int ≥ 1 | `1` | |
| `pageSize` | `10\|25\|50` | `25` | enum, bukan int bebas, supaya tidak bisa diminta 100.000 |

Item: `{ code, branchCode, branchName, status, slotsFilled, slotsTotal, swaps24h,
lastHeartbeatAt, isStale }`
Meta: `{ page, pageSize, total, totalPages }`

### `GET /api/cabinets/:code`

`{ cabinet, slots[], hourly[24], recentSwaps[20] }`
- `slots[]` — `{ slotNo, state, soc, batteryId, updatedAt }`, urut `slotNo`
- `hourly[]` — tepat 24 bucket, **gap-filled nol** lewat `generate_series`, `{ hourStart, count }`
- `recentSwaps[]` — 20 terakhir, `riderRef` disamarkan sebagian

### Aturan query yang tidak boleh dilanggar

1. **Nol N+1.** Halaman list = **satu** query (CTE agregasi + join), bukan satu query per cabinet.
2. Agregasi swap 24 jam dihitung `COUNT(...)` di PostgreSQL. Tidak boleh `SELECT *` lalu `.reduce()`.
3. Halaman detail maksimal 4 query, dijalankan paralel, tanpa query di dalam loop.
4. Tidak ada string interpolation ke dalam SQL. Semua parameterised.
5. Ruang lingkup cabang selalu datang dari **sesi**, tidak pernah dari query string,
   dan dibangun oleh satu fungsi yang dipakai seluruh query.

---

## 7. Keputusan atas lubang spesifikasi

Soal menyatakan spesifikasi sengaja tidak lengkap. Ini keputusan saya dan alasannya.

**7.1 "Swap 24 jam terakhir" = rolling window, bukan sejak tengah malam.**
`occurred_at >= now() - interval '24 hours'`. Alasan: kolom ini dipakai untuk
mengurutkan "cabinet paling sibuk". Kalau dihitung sejak tengah malam, jam 00:05
semua cabinet bernilai ~0 dan kolom sortir itu jadi tidak berguna persis di shift
malam. Rolling window selalu membandingkan rentang yang sama panjang.

**7.2 Cabinet OFFLINE tetap menampilkan state slot terakhir, tapi ditandai stale.**
Menyembunyikan data justru menghambat ops — teknisi perlu tahu kondisi terakhir
sebelum cabinet putus. Tapi menampilkannya seolah live itu berbahaya (bisa
mengirim rider ke cabinet yang "FULL" tiga jam lalu). Kompromi: data tetap tampil,
panel diberi banner stale + umur data relatif ("terakhir terlihat 3 jam lalu"), dan
angka SOC diredupkan. Data basi harus terlihat basi.

**7.3 `last_heartbeat_at` NULL = belum pernah melapor, bukan basi tak terhingga.**
Ditampilkan "Belum pernah", bukan "56 tahun lalu". Diurutkan `NULLS LAST` supaya
cabinet yang baru dipasang tidak menumpuk di puncak daftar "paling bermasalah".
Seed sengaja membuat 2 cabinet seperti ini supaya cabang kode ini benar-benar teruji.

**7.4 Stale ≠ OFFLINE.** `status` adalah kolom yang dilaporkan perangkat/operator
(MAINTENANCE adalah keputusan manusia, mustahil diturunkan dari heartbeat). Tapi
cabinet yang mengaku `ONLINE` sementara heartbeat-nya 40 menit lalu adalah anomali
yang justru paling ingin dilihat ops. Jadi saya turunkan flag terpisah
`isStale = last_heartbeat_at < now() - interval '10 minutes'` dan menampilkan
"ONLINE · stale" — bukan diam-diam menulis ulang statusnya.

**7.5 SOC hanya ada kalau ada baterai.** `EMPTY` → `battery_id` dan `soc` NULL,
dirender "—", bukan "0%". 0% berarti baterai kosong, bukan slot kosong; membedakan
keduanya penting buat ops.

**7.6 Pagination: offset, sadar dengan konsekuensinya.**
Halaman ini mengurutkan berdasarkan **agregat terhitung** (jumlah swap 24 jam) dan
UI-nya butuh "halaman 3 dari 12" plus lompat halaman. Cursor pagination di atas kunci
sortir non-unik dan non-tersimpan butuh cursor komposit `(swaps24h, code)` dan tetap
tidak bisa memberi nomor halaman. Populasinya juga kecil dan terbatas (50 cabinet
sekarang, ~5.000 dalam skenario B2) sehingga `OFFSET` terburuk hanya melewati
ribuan baris, bukan ratusan ribu. **Ini kebalikan dari jawaban saya di A9** untuk
tabel transaksi 500.000 baris, dan memang harus berbeda: pilihan pagination adalah
fungsi dari ukuran data, kunci sortir, dan kebutuhan UI — bukan preferensi.
Titik balik saya: begitu daftar ini melewati ~50.000 baris atau butuh infinite
scroll, saya pindah ke keyset.

**7.7 Zona waktu: simpan UTC, tampilkan WIB.** Semua `timestamptz`. Bucket per jam
di grafik dihitung `AT TIME ZONE 'Asia/Jakarta'` supaya "jam 07:00" berarti jam 7
pagi bagi tim ops di Jakarta, bukan jam 14:00 WIB.

**7.8 Autentikasi di luar cakupan Bagian D — dan saya sebut sebagai lubang, bukan diam.**
Soal D tidak memintanya dan waktu terbatas, jadi endpoint tidak diautentikasi.
Ini akan jadi IDOR/kebocoran data kalau dideploy apa adanya. Bentuk perbaikannya
saya tunjukkan lengkap di jawaban C2 (session check + scoping `branch_id` milik user).
README menyebut ini di bagian "belum selesai".

**7.9 Slot per cabinet disimpan sebagai `slot_count`, default 12.**
Soal menyebut grid 12 slot dan seed 50×12 = 600 slot, jadi angkanya konsisten. Tapi
menghardcode 12 di UI akan pecah saat ECGO memasang cabinet 8 atau 16 slot. Grid
merender `slot_count`, dengan layout responsif, bukan `grid-cols-6` mati.

---

## 8. UI/UX

**Bahasa desain.** Warna diambil dari aset resmi ecgoevmoto.com: hijau ECGO
`#00D95C`, hijau logo `#47A056`, teal gelap `#236057`. Font **Poppins** — font yang
memang dipakai ECGO (Gilroy juga dipakai ECGO tapi lisensinya komersial, jadi tidak
saya bundel). Dark mode jadi default: dashboard ops dipandangi berjam-jam, sering di
ruang kontrol redup.

**Warna state slot** dipilih supaya tetap terbaca oleh mata yang tidak membedakan
merah–hijau — tiap state punya ikon dan label teks, warna tidak pernah jadi
satu-satunya pembawa informasi (WCAG 1.4.1):

| State | Warna | Ikon |
| --- | --- | --- |
| `FULL` | hijau ECGO | baterai penuh |
| `CHARGING` | amber, animasi pulse halus | petir |
| `EMPTY` | slate netral, garis putus-putus | kotak kosong |
| `LOCKED` | biru | gembok |
| `FAULT` | merah | segitiga peringatan |

**Tiga state UI wajib** ditangani di dua halaman, bukan hanya happy path:
- *loading* — skeleton yang bentuknya sama dengan konten aslinya (bukan spinner), supaya tidak ada layout shift
- *empty* — dibedakan antara "belum ada cabinet sama sekali" dan "tidak ada hasil untuk filter ini" (yang kedua menawarkan tombol reset filter)
- *error* — pesan yang bisa ditindaklanjuti + tombol coba lagi, tidak menelan error diam-diam

**Aksesibilitas:** navigasi keyboard penuh, `aria-sort` pada header tabel yang bisa
disortir, `aria-live` saat jumlah hasil berubah, target sentuh ≥44px untuk pemakaian
tablet di lapangan, dan `prefers-reduced-motion` dihormati.

**URL sebagai sumber kebenaran** untuk `q`, `status`, `sort`, `dir`, `page`.
Ditulis dengan `router.replace` (bukan `push`) supaya tombol back tidak
memutar ulang tiap ketukan huruf, dan input pencarian di-debounce 350 ms.

---

## 9. Testing strategy

| Lapis | Cakupan |
| --- | --- |
| Unit | `evaluateCheckIn` — ≥10 test: 5 kasus dari soal + prioritas cek + tie-break leksikografis + toleransi GPS `min(accuracy,30)` + NaN/lat-lng di luar rentang + antimeridian |
| Kontrak | tiap endpoint: happy path, param invalid → `VALIDATION_ERROR`, kode tak dikenal → `NOT_FOUND`, `hourly` selalu 24 bucket |
| Data | seed menghasilkan tepat ≥50/600/20.000; agregat SQL cocok dengan hitungan manual di JS pada dataset kecil |

Tidak mengejar cakupan 100%. Yang diuji adalah aturan yang bisa salah diam-diam.

---

## 10. Boundaries

**Selalu:** TypeScript strict; SQL parameterised; validasi Zod di batas server; commit
kecil bermakna; tulis asumsi begitu diambil; tangani loading/empty/error.

**Tanya dulu:** menambah dependency berat (chart library, UI kit, ORM); mengubah
pilihan stack; apa pun yang mengorbankan requirement wajib demi bonus.

**Jangan pernah:** menaruh secret di client bundle; interpolasi input ke SQL;
`dangerouslySetInnerHTML`/`v-html` untuk data dari user; menyimpan uang sebagai
float; menyebut sesuatu selesai kalau test-nya merah; satu commit "initial commit"
berisi semuanya.

---

## 11. Definition of done

- [ ] `docker compose up -d && npm run db:migrate && npm run seed && npm run dev` jalan dari nol
- [ ] Seed ≥50 cabinet, 600 slot, 20.000 swap tersebar 30 hari
- [ ] List: pencarian server-side, filter status, sort swap 24 jam, pagination, semua tersimpan di URL
- [ ] Detail: grid slot + SOC, grafik 24 jam, 20 swap terakhir
- [ ] Loading/empty/error nyata di kedua halaman
- [ ] ≥10 test geofence hijau, `npm run typecheck` bersih, `npm run build` sukses
- [ ] Nol N+1; agregasi di SQL — dibuktikan dengan `EXPLAIN ANALYZE` di README
- [ ] Bagian A, B2/B3, C terjawab, termasuk premis keliru di A11 & A12
- [ ] README: setup, asumsi, trade-off, belum selesai, daftar AI tool
- [ ] Riwayat commit bertahap dan bisa dibaca
