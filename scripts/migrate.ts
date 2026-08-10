/**
 * Migration runner minimal, pola Flyway: file .sql bernomor, dijalankan sekali,
 * tercatat di tabel schema_migrations.
 *
 * Kenapa bukan ORM migration tool: satu-satunya hal yang saya butuhkan adalah
 * "jalankan file .sql yang belum pernah dijalankan, dalam transaksi, dan catat".
 * Itu 40 baris. Menukarnya dengan dependency yang punya DSL sendiri membuat SQL
 * di repo ini tidak lagi bisa dibaca apa adanya.
 *
 *   npm run db:migrate
 *   npm run db:reset     # buang seluruh schema, lalu migrasi ulang dari nol
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient, explainConnectionError } from './_client'

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations')

async function main() {
  const reset = process.argv.includes('--reset')
  const sql = createClient()

  try {
    if (reset) {
      // Hanya untuk pengembangan lokal. Tidak ada jalan agar ini terpanggil dari
      // aplikasi: skrip ini tidak pernah di-import oleh kode server mana pun.
      console.warn('⚠️  --reset: DROP SCHEMA public CASCADE')
      await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    }

    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `

    const applied = new Set(
      (await sql<{ version: string }[]>`SELECT version FROM schema_migrations`).map(
        (r) => r.version,
      ),
    )

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()

    if (files.length === 0) {
      console.error(`Tidak ada file .sql di ${MIGRATIONS_DIR}`)
      process.exitCode = 1
      return
    }

    let ran = 0
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`· ${file} (sudah diterapkan)`)
        continue
      }

      const ddl = await readFile(join(MIGRATIONS_DIR, file), 'utf8')

      // Satu transaksi per file: migrasi yang gagal di tengah tidak boleh
      // meninggalkan setengah tabel lalu tercatat sebagai berhasil.
      await sql.begin(async (tx) => {
        await tx.unsafe(ddl)
        await tx`INSERT INTO schema_migrations (version) VALUES (${file})`
      })

      console.log(`✓ ${file}`)
      ran += 1
    }

    console.log(ran === 0 ? '\nSkema sudah paling baru.' : `\n${ran} migrasi diterapkan.`)
  } catch (error) {
    console.error(`\nMigrasi gagal:\n${explainConnectionError(error)}`)
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 5 })
  }
}

void main()
