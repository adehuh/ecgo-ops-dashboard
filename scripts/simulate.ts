/**
 * Simulator perangkat — opsional, hanya untuk demo dan pengembangan.
 *
 *   npm run simulate        (biarkan berjalan di terminal terpisah, Ctrl-C untuk berhenti)
 *
 * MASALAH YANG DISELESAIKAN. Seed menulis heartbeat sebagai stempel waktu
 * absolut. Cabinet sungguhan mengirim heartbeat terus-menerus; data seed tidak.
 * Jadi sepuluh menit setelah `npm run seed`, SELURUH armada melewati ambang basi
 * dan dashboard menampilkan 50 cabinet berwarna kuning — bukan karena kodenya
 * salah, melainkan karena data statis menua sementara "sekarang" terus berjalan.
 * Saya menemukan ini saat melihat halaman daftar 20 menit setelah menyemai.
 *
 * Skrip ini menjadikan armadanya hidup: heartbeat berdetak dan swap baru masuk,
 * sehingga angka 24 jam dan indikator basi berperilaku seperti di produksi.
 *
 * SENGAJA DIPISAH DARI APLIKASI. Ini bukan cron tersembunyi di dalam server:
 * proses terpisah yang harus dijalankan orang dengan sadar. Aplikasi tidak boleh
 * punya jalur kode yang menulis heartbeat palsu — di produksi, satu-satunya yang
 * berhak menulis kolom itu adalah cabinet-nya sendiri.
 */
import { createClient, explainConnectionError } from './_client'

const TICK_MS = 15_000

/**
 * Kembalikan armada ke keadaan yang DIMAKSUD seed, sekali di awal.
 *
 * Kenapa perlu: begitu simulator berjalan, ia hanya bisa membedakan "sengaja
 * dibuat basi" dari "menjadi basi karena waktu berlalu" lewat umur heartbeat —
 * dan keduanya terlihat identik kalau seed dijalankan setengah jam lalu. Versi
 * pertama saya memakai ambang 25 menit dan hasilnya bergantung pada jeda antara
 * `npm run seed` dan `npm run simulate`: menunggu 20 menit meninggalkan 12
 * cabinet basi permanen, bukan 3.
 *
 * Jadi startup menegakkan ulang niatnya: semua cabinet ONLINE yang pernah
 * melapor dibuat segar, lalu TEPAT tiga di antaranya didorong mundur. Dipilih
 * dengan `ORDER BY code` supaya cabinet yang sama yang selalu terpilih di tiap
 * kali menjalankan. Yang NULL tidak pernah disentuh: "belum pernah melapor"
 * adalah keadaan permanen, bukan keadaan basi.
 */
async function primeFleet(sql: ReturnType<typeof createClient>): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE cabinets SET last_heartbeat_at = now()
       WHERE status = 'ONLINE' AND last_heartbeat_at IS NOT NULL
    `
    await tx`
      UPDATE cabinets
         SET last_heartbeat_at = now() - make_interval(mins => 30 + (random() * 150)::int)
       WHERE code IN (
         SELECT code FROM cabinets
          WHERE status = 'ONLINE' AND last_heartbeat_at IS NOT NULL
          ORDER BY code
          LIMIT 3
       )
    `
  })
}

/**
 * Hanya menyegarkan cabinet ONLINE yang heartbeat-nya SUDAH segar.
 *
 * Setelah primeFleet(), predikat ini aman: tiga cabinet yang sengaja dibuat basi
 * berumur lebih dari 25 menit dan dua yang belum pernah melapor bernilai NULL,
 * jadi keduanya berada di luar jangkauan dan tetap seperti itu. Tanpa batas ini,
 * simulator akan "menyembuhkan" justru keadaan yang paling ingin saya tunjukkan.
 */
async function beat(sql: ReturnType<typeof createClient>): Promise<number> {
  const rows = await sql<{ code: string }[]>`
    UPDATE cabinets
       SET last_heartbeat_at = now()
     WHERE status = 'ONLINE'
       AND last_heartbeat_at IS NOT NULL
       AND last_heartbeat_at > now() - interval '25 minutes'
    RETURNING code
  `
  return rows.length
}

/** Beberapa swap baru per tick, hanya di cabinet yang benar-benar melayani. */
async function swap(sql: ReturnType<typeof createClient>): Promise<number> {
  const rows = await sql<{ id: string }[]>`
    WITH candidate AS (
      SELECT c.id, c.slot_count
      FROM cabinets c
      WHERE c.status = 'ONLINE'
      ORDER BY random()
      LIMIT 3
    )
    INSERT INTO swap_transactions
      (cabinet_id, slot_no, rider_ref, occurred_at, soc_in, soc_out, duration_s, status)
    SELECT
      c.id,
      1 + floor(random() * c.slot_count)::int,
      'RD-' || lpad(floor(random() * 900000 + 100000)::text, 6, '0'),
      now(),
      floor(random() * 35 + 3)::int,
      floor(random() * 8 + 92)::int,
      floor(random() * 120 + 40)::int,
      -- ~4% gagal, supaya kartu "gagal 24 jam" ikut bergerak.
      CASE WHEN random() < 0.04 THEN 'FAILED' ELSE 'SUCCESS' END::swap_status
    FROM candidate c
    RETURNING id
  `
  return rows.length
}

async function main() {
  const sql = createClient()
  let stopping = false

  const shutdown = () => {
    if (stopping) return
    stopping = true
    console.log('\nSimulator berhenti.')
    void sql.end({ timeout: 5 }).then(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await primeFleet(sql)

  console.log(
    `Armada disetel ulang: cabinet ONLINE dibuat segar, 3 sengaja dibiarkan basi, 2 tetap belum pernah melapor.`,
  )
  console.log(`Simulator berjalan. Heartbeat + swap tiap ${TICK_MS / 1000} detik. Ctrl-C untuk berhenti.\n`)

  while (!stopping) {
    try {
      const [beats, swaps] = await Promise.all([beat(sql), swap(sql)])
      const stamp = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        timeStyle: 'medium',
      }).format(new Date())

      console.log(`${stamp}  ${beats} heartbeat · ${swaps} swap baru`)
    } catch (error) {
      console.error(explainConnectionError(error))
      shutdown()
      return
    }

    await new Promise((resolve) => setTimeout(resolve, TICK_MS))
  }
}

void main()
