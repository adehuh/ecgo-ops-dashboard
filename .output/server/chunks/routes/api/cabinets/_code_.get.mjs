import { g as getRouterParam } from '../../../nitro/nitro.mjs';
import { c as cabinetCodeParamSchema } from '../../../_/cabinets.mjs';
import { d as defineApiHandler, p as parseOrThrow, u as useDb, s as staleMinutes, n as notFound } from '../../../_/db.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'zod';
import 'postgres';

function maskRiderRef(riderRef) {
  const [prefix, suffix] = riderRef.split("-");
  if (!suffix) return `\u2022\u2022${riderRef.slice(-3)}`;
  return `${prefix}-\u2022\u2022\u2022${suffix.slice(-3)}`;
}
const _code__get = defineApiHandler(async (event) => {
  var _a, _b;
  const code = parseOrThrow(
    cabinetCodeParamSchema,
    getRouterParam(event, "code"),
    "Kode cabinet"
  );
  const sql = useDb();
  const stale = staleMinutes();
  const [cabinetRows, slotRows, hourRows, swapRows] = await Promise.all([
    sql`
      SELECT
        c.code,
        c.status,
        c.slot_count,
        c.last_heartbeat_at,
        c.installed_at,
        b.code AS branch_code,
        b.name AS branch_name,
        b.city AS branch_city,
        (
          c.last_heartbeat_at IS NOT NULL
          AND c.last_heartbeat_at < now() - make_interval(mins => ${stale})
        ) AS is_stale,
        -- Dihitung di database dengan sub-select berkorelasi pada satu baris,
        -- bukan dengan menarik transaksi ke Node lalu me-reduce-nya.
        (
          SELECT count(*)::int FROM swap_transactions s
          WHERE s.cabinet_id = c.id
            AND s.occurred_at >= now() - interval '24 hours'
            AND s.status = 'SUCCESS'
        ) AS swaps_24h,
        (
          SELECT count(*)::int FROM swap_transactions s
          WHERE s.cabinet_id = c.id
            AND s.occurred_at >= now() - interval '24 hours'
            AND s.status = 'FAILED'
        ) AS failed_24h
      FROM cabinets c
      JOIN branches b ON b.id = c.branch_id
      WHERE c.code = ${code}
    `,
    sql`
      SELECT sl.slot_no, sl.state, sl.soc, sl.battery_id, sl.updated_at
      FROM slots sl
      JOIN cabinets c ON c.id = sl.cabinet_id
      WHERE c.code = ${code}
      ORDER BY sl.slot_no
    `,
    // Grafik 24 jam. `generate_series` menyediakan kerangka jamnya, jadi jam
    // tanpa aktivitas keluar sebagai nol, bukan hilang dari hasil. Kalau
    // gap-filling diserahkan ke client, jam sepi akan menyusut hilang dan
    // grafiknya diam-diam berbohong tentang bentuk hari itu.
    sql`
      WITH bounds AS (
        SELECT date_trunc('hour', now() AT TIME ZONE 'Asia/Jakarta') AS latest
      ),
      hours AS (
        SELECT generate_series(b.latest - interval '23 hours', b.latest, interval '1 hour') AS hour_start
        FROM bounds b
      )
      SELECT
        -- Dikirim sebagai teks jam-dinding WIB. Mengirimnya sebagai timestamp
        -- tanpa zona akan diparse ulang sebagai UTC oleh driver dan menggeser
        -- seluruh grafik tujuh jam.
        to_char(h.hour_start, 'YYYY-MM-DD"T"HH24:MI:SS') AS hour_start,
        count(s.id)::int AS count
      FROM hours h
      LEFT JOIN swap_transactions s
        ON s.cabinet_id = (SELECT id FROM cabinets WHERE code = ${code})
        -- Predikat rentang ini yang membuat index (cabinet_id, occurred_at)
        -- terpakai; date_trunc di bawah tidak sargable dan sendirian akan
        -- memaksa pemindaian seluruh 30 hari riwayat cabinet ini.
       AND s.occurred_at >= now() - interval '24 hours'
       AND s.status = 'SUCCESS'
       AND date_trunc('hour', s.occurred_at AT TIME ZONE 'Asia/Jakarta') = h.hour_start
      GROUP BY h.hour_start
      ORDER BY h.hour_start
    `,
    sql`
      SELECT s.id, s.slot_no, s.rider_ref, s.occurred_at, s.soc_in, s.soc_out,
             s.duration_s, s.status
      FROM swap_transactions s
      JOIN cabinets c ON c.id = s.cabinet_id
      WHERE c.code = ${code}
      -- id sebagai pemecah seri: dua swap bisa punya occurred_at identik, dan
      -- tanpa kunci kedua "20 terakhir" tidak stabil antar request.
      ORDER BY s.occurred_at DESC, s.id DESC
      LIMIT 20
    `
  ]);
  const cabinet = cabinetRows[0];
  if (!cabinet) {
    throw notFound(`Cabinet dengan kode "${code}" tidak ditemukan`);
  }
  return {
    data: {
      code: cabinet.code,
      branchCode: cabinet.branch_code,
      branchName: cabinet.branch_name,
      branchCity: cabinet.branch_city,
      status: cabinet.status,
      slotCount: cabinet.slot_count,
      lastHeartbeatAt: (_b = (_a = cabinet.last_heartbeat_at) == null ? void 0 : _a.toISOString()) != null ? _b : null,
      isStale: cabinet.is_stale,
      installedAt: cabinet.installed_at.toISOString(),
      swaps24h: cabinet.swaps_24h,
      failed24h: cabinet.failed_24h,
      slots: slotRows.map(
        (row) => ({
          slotNo: row.slot_no,
          state: row.state,
          soc: row.soc,
          batteryId: row.battery_id,
          updatedAt: row.updated_at.toISOString()
        })
      ),
      hourly: hourRows.map((row) => ({ hourStart: row.hour_start, count: row.count })),
      recentSwaps: swapRows.map(
        (row) => ({
          id: Number(row.id),
          slotNo: row.slot_no,
          riderRef: maskRiderRef(row.rider_ref),
          occurredAt: row.occurred_at.toISOString(),
          socIn: row.soc_in,
          socOut: row.soc_out,
          durationS: row.duration_s,
          status: row.status
        })
      )
    }
  };
});

export { _code__get as default };
//# sourceMappingURL=_code_.get.mjs.map
