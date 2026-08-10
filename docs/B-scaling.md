# Bagian B2 & B3 — Skala dan PostGIS

Kandidat: **Ade Rusmana** · TEST-ENG-FS-001
Implementasi B1: `shared/geofence/evaluateCheckIn.ts` · test: `tests/geofence.spec.ts`

---

## B2. 5.000 cabang, 200.000 check-in/hari, puncak 07.00–08.00  [5 poin]

### Ukur dulu — dan hasilnya mengubah jawabannya

Sebelum mengoptimasi, saya menjalankan implementasi B1 apa adanya terhadap 5.000
cabang sintetis di Jabodetabek (Node 22, laptop biasa):

```
evaluateCheckIn atas 5.000 cabang   : 1,002 ms per panggilan
```

Asumsikan sepertiga dari 200.000 check-in menumpuk di jam puncak — 60.000 dalam satu
jam, yaitu **16,7 check-in per detik**:

```
16,7 panggilan/detik × 1,002 ms = 16,7 ms CPU per detik
                                = 1,67% dari SATU core
```

**Jadi perhitungan haversine-nya bukan hambatan.** Bahkan kalau seluruh 200.000
check-in datang dalam satu jam yang sama, angkanya hanya ~5,6% dari satu core.
Mengoptimasi bagian ini akan terasa produktif dan tidak mengubah apa pun.

Saya menuliskan ini lebih dulu karena inilah jawaban yang sebenarnya penting: soal
mengarahkan perhatian ke jumlah panggilan haversine, dan angka menunjukkan biaya
sesungguhnya ada di tempat lain. Pada 16,7 request per detik, yang akan lebih dulu
menyerah adalah **pengambilan 5.000 baris cabang dari database untuk setiap
check-in** — sekitar 500 KB serialisasi, parsing, dan alokasi objek per request,
puluhan kali lipat lebih mahal daripada trigonometrinya.

Dengan itu sebagai dasar, berikut pendekatannya, diurutkan menurut manfaat nyata.

---

### Pendekatan 0 — Jangan evaluasi 5.000 cabang; evaluasi 3 milik karyawan itu

Ini perbaikan model data, bukan algoritma, dan efeknya paling besar.

Soal sendiri menyebut seorang teknisi menangani "3 cabang sekaligus". Berarti sudah
ada relasi `user_branches`. Yang perlu dinilai saat check-in hanyalah cabang yang
memang ditugaskan kepada orang itu — biasanya 1 sampai 5, bukan 5.000. Kontrak
fungsinya sudah mendukung ini: `evaluateCheckIn(checkIn, branches)` menerima daftar
dari pemanggil, jadi tidak ada satu baris pun di B1 yang perlu berubah.

```sql
SELECT b.* FROM branches b
  JOIN user_branches ub ON ub.branch_id = b.id
 WHERE ub.user_id = $1 AND b.active;
```

**Manfaat.** 5.000 → ~3 cabang. Beban turun tiga ordo besaran, di kedua sisi: CPU
maupun transfer data. 1,002 ms menjadi tidak terukur.

**Trade-off.** Berubah menjadi keputusan produk: karyawan tidak bisa lagi absen di
cabang mana pun yang kebetulan ia lewati. Menurut saya itu justru **benar** — absensi
di cabang yang tidak ditugaskan kepada seseorang memang seharusnya butuh persetujuan,
bukan diterima diam-diam. Tapi ini perlu dikonfirmasi ke tim ops, bukan diputuskan
sendiri oleh engineer. Kalau ternyata "absen di cabang mana pun" memang disengaja,
pendekatan 1 dan 2 di bawah yang berlaku.

---

### Pendekatan 1 — Cache cabang di memori, bukan ambil ulang tiap request

Data cabang berubah beberapa kali **setahun**; ia dibaca 200.000 kali **sehari**.
Memuat ulang 5.000 baris dari Postgres pada setiap check-in adalah rasio baca-tulis
yang salah dipahami.

```ts
let cache: { branches: Branch[]; loadedAt: number } | null = null
const TTL_MS = 5 * 60_000

async function activeBranches(): Promise<Branch[]> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.branches
  const branches = await db.query(`SELECT ... WHERE active`)
  cache = { branches, loadedAt: Date.now() }
  return branches
}
```

**Manfaat.** Menghapus satu round-trip database dan ~500 KB serialisasi per check-in —
yaitu biaya dominan sesungguhnya menurut pengukuran di atas. Sekaligus melindungi
database di jam puncak, saat ia paling dibutuhkan untuk hal lain.

**Trade-off.** Data bisa basi sampai 5 menit: cabang yang baru dinonaktifkan masih
menerima check-in selama itu. Untuk geofence absensi, jendela itu bisa diterima —
tapi harus **dipilih sadar**, bukan kebetulan. Kalau tidak boleh basi sama sekali,
lakukan invalidasi eksplisit lewat NOTIFY/LISTEN saat baris cabang berubah. Biaya
lain: tiap instance Node menyimpan salinannya sendiri (5.000 cabang ≈ beberapa MB,
tidak masalah), dan instance yang baru start akan mengalami satu kali cold load.

---

### Pendekatan 2 — Saring dengan bounding box sebelum menghitung haversine

Kalau memang harus memeriksa seluruh 5.000 cabang, jangan panggil trigonometri untuk
cabang yang jelas-jelas ratusan kilometer jauhnya. Buang dulu dengan perbandingan
aritmetika biasa:

```ts
const MAX_RADIUS_M = 500                       // radius terbesar di seluruh armada
const pad = MAX_RADIUS_M + MAX_ACCURACY_TOLERANCE_M
const dLat = pad / 111_320                     // derajat lintang per meter, konstan
const dLng = pad / (111_320 * Math.cos(checkIn.lat * Math.PI / 180))

const candidates = branches.filter(
  (b) => Math.abs(b.lat - checkIn.lat) <= dLat && Math.abs(b.lng - checkIn.lng) <= dLng,
)
// haversine hanya untuk sisa kandidat — biasanya 0 sampai 5 cabang
```

**Manfaat.** Dua pengurangan dan dua perbandingan menggantikan empat panggilan
trigonometri plus `sqrt` dan `atan2`. Untuk pemeriksaan yang benar-benar harus
menyapu semua cabang, ini pengurangan yang nyata — tetap O(n), tapi dengan konstanta
yang jauh lebih kecil.

**Trade-off.** Butuh batas atas radius yang diketahui; kalau ada satu cabang
berradius 50 km, `pad` melebar dan filternya kehilangan gunanya. Perhitungan
`cos(lat)` untuk bujur tidak akurat di lintang tinggi — tidak relevan untuk Indonesia,
tapi jadi bug diam-diam kalau ECGO berekspansi ke luar tropis. Dan kotaknya harus
**lebih longgar** dari lingkarannya (sudut kotak lebih jauh dari jari-jarinya), jadi
filter ini hanya boleh membuang, tidak boleh memutuskan.

---

### Pendekatan 3 — Index spasial (geohash / H3 / S2)

Simpan cabang ke dalam sel grid, lalu saat check-in hanya lihat sel milik titik itu
beserta 8 tetangganya.

**Manfaat.** Waktu pencarian menjadi kira-kira O(1) terhadap jumlah cabang. Ini
satu-satunya pendekatan yang tetap bekerja pada 500.000 cabang, bukan 5.000.

**Trade-off.** Paling mahal ongkos kerumitannya untuk manfaat paling sedikit **pada
skala saat ini**: index harus dipelihara dan disinkronkan, ukuran sel harus disetel
terhadap radius geofence, dan lingkaran yang memotong batas sel menuntut pemeriksaan
tetangga yang gampang salah tulis. Menambahkan H3 hari ini akan menukar kode yang
bisa saya jelaskan baris per baris dengan dependensi yang menyelesaikan masalah yang
belum ECGO miliki. Saya menyimpannya sebagai langkah kalau jumlah cabang naik dua
ordo besaran — dan kalau itu terjadi, saya lebih memilih menyerahkannya ke PostGIS
(B3) daripada membangun index spasial sendiri.

---

### Yang akan saya lakukan sesungguhnya

Pendekatan 0 dan 1. Keduanya sederhana, keduanya menyerang biaya yang benar-benar
terukur, dan keduanya tidak menambah dependensi. Pendekatan 2 saya tambahkan hanya
kalau profiling setelahnya masih menunjuk ke perhitungan jarak — dan berdasarkan
angka 1,67% di atas, saya tidak menduga itu akan terjadi.

---

## B3. Memindahkan perhitungan ke PostgreSQL + PostGIS  [5 poin]

### Skema dan index

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- Kolom geography, bukan geometry: geography menghitung dalam meter di atas bola/
-- spheroid, jadi tidak perlu memilih proyeksi UTM per wilayah. Kolom generated
-- membuatnya mustahil menyimpang dari lat/lng yang sudah ada.
ALTER TABLE branches
  ADD COLUMN geog geography(Point, 4326)
  GENERATED ALWAYS AS (ST_MakePoint(lng, lat)::geography) STORED;

-- GiST adalah index yang bisa melayani ST_DWithin dan operator KNN <->.
-- Partial index: cabang nonaktif tidak pernah menjadi kandidat, jadi tidak perlu
-- ikut memenuhi index.
CREATE INDEX branches_geog_idx ON branches USING gist (geog) WHERE active;
```

### Query

```sql
-- $1 = titik check-in, $2 = accuracyM
WITH probe AS (
  SELECT ST_MakePoint($1::float8, $2::float8)::geography AS g,
         LEAST($3::int, 30) AS tolerance
)
SELECT b.id,
       b.name,
       round(ST_Distance(b.geog, p.g))::int AS distance_m
  FROM branches b, probe p
 WHERE b.active
   -- Predikat pertama INDEXABLE: jaraknya konstanta (radius terbesar di armada
   -- + toleransi maksimum), jadi GiST bisa memangkas kandidat.
   AND ST_DWithin(b.geog, p.g, 530)
   -- Predikat kedua adalah aturan sesungguhnya, per baris. Ia TIDAK bisa memakai
   -- index karena radiusnya kolom, bukan konstanta — makanya ia berjalan setelah
   -- pemangkasan di atas, bukan menggantikannya.
   AND ST_Distance(b.geog, p.g) <= b.radius_m + p.tolerance
 -- Aturan 2 lalu aturan 3: terdekat menang, seri dipecah id terkecil.
 ORDER BY distance_m ASC, b.id ASC
 LIMIT 1;
```

Untuk kasus `OUT_OF_RANGE`, PostGIS punya sesuatu yang tidak dimiliki kode aplikasi —
pencarian tetangga terdekat yang dipercepat index lewat operator `<->`:

```sql
SELECT b.id, round(ST_Distance(b.geog, $1::geography))::int AS distance_m
  FROM branches b
 WHERE b.active
 ORDER BY b.geog <-> $1::geography   -- KNN, memakai GiST, tidak memindai semua baris
 LIMIT 1;
```

### Apa yang berubah — dan apa yang saya korbankan

**Yang didapat.** Pencarian kandidat dipercepat index, jadi 5.000 atau 500.000 cabang
sama saja. Tidak ada lagi 5.000 baris yang diserialisasi ke aplikasi setiap check-in
— pendekatan 1 dan 2 di B2 menjadi tidak perlu. Satu round-trip. Dan konsumen lain
(laporan, panel admin, aplikasi Flutter lewat API yang sama) otomatis mewarisi
perilaku yang sama, tanpa menyalin aturan.

**Yang dikorbankan — dan menurut saya ini yang paling penting dari pertanyaan ini:**

1. **Testabilitas.** Ini kerugian terbesar. 36 unit test di `tests/geofence.spec.ts`
   berjalan dalam **113 ms** tanpa Docker, tanpa jaringan, tanpa apa pun. Pindahkan
   aturannya ke SQL, dan semuanya menjadi integration test yang butuh PostgreSQL +
   PostGIS hidup. Waktu umpan balik naik dari milidetik ke puluhan detik, CI jadi
   lebih rapuh, dan pengembang yang buru-buru akan mulai melewatinya. Aturan yang
   sulit diuji adalah aturan yang lama-lama tidak diuji.

2. **Aturan tercerai di dua bahasa.** Urutan prioritas (koordinat → akurasi →
   cabang), ambang akurasi 100 m, dan batas toleransi 30 m adalah **aturan bisnis**.
   Menuliskannya di SQL berarti keputusan yang sama harus dibaca di dua tempat, dan
   compiler TypeScript tidak lagi bisa memeriksanya. `RejectReason` yang hari ini
   berupa union type akan menjadi string ajaib.

3. **Definisi jarak berubah diam-diam.** `ST_Distance` pada `geography` memakai
   **spheroid** secara default; B1 memakai **bola** dengan R = 6.371.008,8 m sesuai
   perintah soal. Selisihnya sekitar 0,3% — di bawah satu meter untuk geofence 150 m,
   tapi cukup untuk membalik keputusan pada kasus yang tepat berada di garis batas,
   dan cukup untuk membuat test yang membandingkan angka persis menjadi gagal.
   Kalau memang harus identik, `ST_Distance(g1, g2, false)` memakai bola. Ini
   perbedaan yang harus diputuskan sadar, bukan ditemukan lewat laporan bug.

4. **Tidak bisa jalan offline.** ECGO punya aplikasi Flutter, dan teknisi lapangan
   bekerja di tempat yang sinyalnya buruk. Logika di TypeScript bisa dipindahkan ke
   klien untuk memberi umpan balik seketika sebelum check-in dikirim; logika di
   PostGIS tidak bisa. (Server tetap wajib memvalidasi ulang — lihat A10 — tapi
   pengguna tetap dapat jawaban instan.)

5. **CPU database adalah sumber daya termahal yang kita punya.** Proses Node bisa
   ditambah di belakang load balancer dalam hitungan detik. Primary Postgres tidak.
   Memindahkan pekerjaan yang bisa dilakukan aplikasi ke satu-satunya komponen yang
   paling sulit di-scale adalah arah yang salah — kecuali index-nya memang membuat
   pekerjaannya jauh lebih kecil, yang di sini memang benar untuk **pencarian**, tapi
   tidak untuk **aturannya**.

### Rekomendasi saya: bagi berdasarkan siapa yang lebih baik mengerjakannya

Bukan salah satu, melainkan pembagian tugas menurut kekuatan masing-masing:

- **PostGIS mengerjakan pencarian spasial** — "cabang aktif mana yang berada dalam
  530 m dari titik ini, urut dari yang terdekat, maksimal 10". Itu persis yang
  dikuasai index dan tidak dikuasai aplikasi.
- **TypeScript mengerjakan aturan bisnis** — validasi koordinat, ambang akurasi,
  batas toleransi, urutan prioritas, tie-break. Itu tetap berada di
  `evaluateCheckIn()`, tetap tertutup 36 test yang jalan dalam 113 ms, dan tetap bisa
  dibaca oleh siapa pun yang tahu TypeScript.

Kandidat yang dikirim database tinggal segelintir, jadi `evaluateCheckIn` menerima
array berisi 3 elemen alih-alih 5.000 — dan kontrak fungsinya sama sekali tidak perlu
berubah untuk itu.
