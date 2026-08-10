import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import express from 'express'
import { authRouter } from './routes/auth.js'
import { cabinetsRouter } from './routes/cabinets.js'
import { healthRouter, summaryRouter } from './routes/misc.js'
import { sql } from './db.js'
import { env } from './env.js'
import { apiNotFound, errorHandler } from './http.js'

const app = express()

// req.ip harus mencerminkan klien sungguhan di belakang proxy — kunci rate limit
// login dibangun darinya. 'loopback' saja: mempercayai X-Forwarded-For dari
// sembarang sumber berarti penyerang bisa mengarang IP dan melewati rate limit
// dengan satu header.
app.set('trust proxy', 'loopback')
app.disable('x-powered-by')

app.use(express.json({ limit: '64kb' }))
app.use(cookieParser())

/**
 * Header keamanan dasar, ditulis tangan alih-alih menambah helmet.
 *
 * Empat header ini yang benar-benar relevan untuk dashboard internal; helmet
 * memasang belasan lainnya yang tidak berlaku di sini, dan saya lebih suka bisa
 * menjelaskan setiap header yang dikirim aplikasi ini.
 */
app.use((_req, res, next) => {
  // Jangan biarkan browser menebak-nebak tipe konten (vektor XSS lewat sniffing).
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Dashboard ini tidak pernah perlu di-embed. Menutup clickjacking.
  res.setHeader('X-Frame-Options', 'DENY')
  // Jangan bocorkan path internal (mis. /cabinets/CB-KMY-01) ke situs luar.
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  next()
})

// Dashboard operasional adalah pembacaan waktu-nyata: jangan pernah biarkan
// proxy atau CDN menyimpan respons API. Kesegaran adalah produknya di sini —
// dan respons ini berisi data per-pengguna, yang tidak boleh dibagi cache.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store')
  next()
})

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/cabinets', cabinetsRouter)
app.use('/api/summary', summaryRouter)

// Path /api yang tidak dikenal tetap menjawab dengan amplop error yang sama,
// bukan halaman HTML 404 dari Express.
app.use('/api', apiNotFound)

// --- SPA hasil build (hanya produksi) --------------------------------------
const here = dirname(fileURLToPath(import.meta.url))
const clientDir = resolve(here, '../client')

if (existsSync(clientDir)) {
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }))

  // Fallback SPA: setiap rute non-API dilayani index.html supaya Vue Router
  // menangani jalurnya. Ditulis sebagai middleware tanpa pola path — Express 5
  // memakai path-to-regexp v8, di mana '*' bukan lagi pola yang sah.
  app.use((_req, res) => {
    res.sendFile(join(clientDir, 'index.html'))
  })
}

// Harus paling akhir: Express mengenali handler error dari jumlah argumennya.
app.use(errorHandler)

const server = app.listen(env.port, () => {
  console.log(`API ECGO Ops berjalan di http://localhost:${env.port}`)
  if (!existsSync(clientDir)) {
    console.log('Mode pengembangan — client dilayani Vite di http://localhost:3000')
  }
})

/** Matikan dengan rapi supaya request yang sedang jalan tidak terpotong. */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void sql.end({ timeout: 5 }).then(() => process.exit(0))
    })
  })
}
