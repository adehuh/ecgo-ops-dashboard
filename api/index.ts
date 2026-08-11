/**
 * Titik masuk serverless (Vercel).
 *
 * Harus berada di `api/` pada akar repo — itu konvensi Vercel untuk mendeteksi
 * fungsi, bukan pilihan gaya. Berkas konfigurasi dan panduannya ada di
 * `vercel/`; yang di sini sengaja setipis mungkin.
 *
 * Vercel tidak menjalankan proses yang hidup terus: ia memanggil fungsi ini per
 * request. Jadi TIDAK ADA `listen()` di sini — Express-nya dipakai langsung
 * sebagai `(req, res)` handler, yang memang bentuk aslinya.
 *
 * Objeknya sama persis dengan yang dipakai `server/index.ts` untuk mode satu
 * proses, jadi tidak ada jalur kode "khusus Vercel" yang bisa menyimpang
 * diam-diam dari yang diuji 50 test Cypress.
 *
 * `vercel.json` mengarahkan SELURUH /api/* ke satu fungsi ini, bukan satu fungsi
 * per endpoint. Satu fungsi berarti satu cold start dan satu connection pool
 * untuk semua route; memecahnya per endpoint akan mengalikan keduanya tanpa
 * menambah apa pun.
 */
export { app as default } from '../server/app.js'
