import { a as getQuery } from '../../nitro/nitro.mjs';
import { a as cabinetListQuerySchema } from '../../_/cabinets.mjs';
import { d as defineApiHandler, p as parseOrThrow, u as useDb, s as staleMinutes } from '../../_/db.mjs';
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

const escapeLikePattern = (input) => input.replace(/[\\%_]/g, "\\$&");
const index_get = defineApiHandler(async (event) => {
  var _a, _b;
  const query = parseOrThrow(cabinetListQuerySchema, getQuery(event), "Parameter pencarian");
  const sql = useDb();
  const { q, status, sort, dir, page, pageSize } = query;
  const offset = (page - 1) * pageSize;
  const search = q ? `%${escapeLikePattern(q)}%` : null;
  const statuses = status && status.length > 0 ? status : null;
  const direction = dir === "asc" ? sql`ASC` : sql`DESC`;
  const searchClause = search ? sql`(c.code ILIKE ${search} ESCAPE '\\'
        OR b.name ILIKE ${search} ESCAPE '\\'
        OR b.code ILIKE ${search} ESCAPE '\\')` : sql`true`;
  const statusClause = statuses ? sql`c.status = ANY(${statuses}::cabinet_status[])` : sql`true`;
  const orderBy = {
    swaps24h: sql`swaps_24h ${direction}, f.code ASC`,
    code: sql`f.code ${direction}`,
    // NULLS LAST di kedua arah: cabinet yang belum pernah melapor bukan cabinet
    // "paling lama tidak terlihat", jadi tidak boleh memuncaki daftar itu.
    lastHeartbeat: sql`f.last_heartbeat_at ${direction} NULLS LAST, f.code ASC`
  }[sort];
  const rows = await sql`
    WITH filtered AS (
      SELECT
        c.id,
        c.code,
        c.status,
        c.last_heartbeat_at,
        b.code AS branch_code,
        b.name AS branch_name
      FROM cabinets c
      JOIN branches b ON b.id = c.branch_id
      WHERE ${searchClause} AND ${statusClause}
    ),
    -- Dibatasi ke cabinet yang lolos filter, bukan seluruh armada: kalau ops
    -- menyaring ke satu cabang, agregatnya tidak ikut menyapu yang lain.
    swap_counts AS (
      SELECT s.cabinet_id, count(*)::int AS swaps_24h
      FROM swap_transactions s
      JOIN filtered f ON f.id = s.cabinet_id
      -- Rolling 24 jam, bukan sejak tengah malam. Alasannya di README §Asumsi.
      WHERE s.occurred_at >= now() - interval '24 hours'
        -- Hanya yang berhasil: ini kolom throughput. Cabinet yang menolak 40
        -- rider bukan cabinet sibuk, dan tidak boleh naik ke puncak sortir.
        AND s.status = 'SUCCESS'
      GROUP BY s.cabinet_id
    ),
    slot_counts AS (
      SELECT
        sl.cabinet_id,
        count(*)::int                                          AS slots_total,
        -- "Terisi" = ada baterainya, apa pun state-nya.
        count(sl.battery_id)::int                              AS slots_filled,
        -- "Siap" = benar-benar bisa ditukar rider sekarang. Bukan kolom yang
        -- diminta soal, tapi tanpa itu "8/12 terisi" tidak menjawab satu-satunya
        -- pertanyaan yang penting: bisakah rider swap di sini?
        count(*) FILTER (WHERE sl.state = 'FULL')::int          AS slots_ready
      FROM slots sl
      JOIN filtered f ON f.id = sl.cabinet_id
      GROUP BY sl.cabinet_id
    )
    SELECT
      f.code,
      f.branch_code,
      f.branch_name,
      f.status,
      f.last_heartbeat_at,
      coalesce(sc.swaps_24h, 0)     AS swaps_24h,
      coalesce(slc.slots_total, 0)  AS slots_total,
      coalesce(slc.slots_filled, 0) AS slots_filled,
      coalesce(slc.slots_ready, 0)  AS slots_ready,
      (
        f.last_heartbeat_at IS NOT NULL
        AND f.last_heartbeat_at < now() - make_interval(mins => ${staleMinutes()})
      ) AS is_stale,
      count(*) OVER ()::int AS total_count
    FROM filtered f
    LEFT JOIN swap_counts sc  ON sc.cabinet_id  = f.id
    LEFT JOIN slot_counts slc ON slc.cabinet_id = f.id
    ORDER BY ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const total = (_b = (_a = rows[0]) == null ? void 0 : _a.total_count) != null ? _b : (await sql`
        SELECT count(*)::int AS total
        FROM cabinets c
        JOIN branches b ON b.id = c.branch_id
        WHERE ${searchClause} AND ${statusClause}
      `)[0].total;
  return {
    data: rows.map(
      (row) => {
        var _a2, _b2;
        return {
          code: row.code,
          branchCode: row.branch_code,
          branchName: row.branch_name,
          status: row.status,
          slotsFilled: row.slots_filled,
          slotsReady: row.slots_ready,
          slotsTotal: row.slots_total,
          swaps24h: row.swaps_24h,
          lastHeartbeatAt: (_b2 = (_a2 = row.last_heartbeat_at) == null ? void 0 : _a2.toISOString()) != null ? _b2 : null,
          isStale: row.is_stale
        };
      }
    ),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
