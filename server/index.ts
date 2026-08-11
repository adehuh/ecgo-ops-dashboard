import { app, servesClient } from './app.js'
import { sql } from './db.js'
import { env } from './env.js'

/**
 * Titik masuk untuk SATU PROSES yang mendengarkan sebuah port.
 *
 * Dipakai `npm run dev`, `npm start`, Docker, dan VPS mana pun. Aplikasinya
 * sendiri ada di `app.ts`; berkas ini hanya menambahkan port dan mematikan
 * dengan rapi — dua hal yang justru tidak boleh ada di lingkungan serverless.
 */
const server = app.listen(env.port, () => {
  console.log(`API ECGO Ops berjalan di http://localhost:${env.port}`)
  if (!servesClient) {
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
