import { d as defineApiHandler, u as useDb, s as staleMinutes } from '../../_/db.mjs';
import '../../nitro/nitro.mjs';
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

const summary_get = defineApiHandler(async () => {
  var _a, _b, _c, _d, _e, _f, _g;
  const sql = useDb();
  const [row] = await sql`
    SELECT
      count(*)::int                                                        AS total,
      count(*) FILTER (WHERE status = 'ONLINE')::int                       AS online,
      count(*) FILTER (WHERE status = 'OFFLINE')::int                      AS offline,
      count(*) FILTER (WHERE status = 'MAINTENANCE')::int                  AS maintenance,
      -- Yang benar-benar menuntut tindakan: bukan ONLINE, ATAU mengaku ONLINE
      -- tapi diam terlalu lama, ATAU belum pernah melapor sama sekali.
      count(*) FILTER (
        WHERE status <> 'ONLINE'
           OR last_heartbeat_at IS NULL
           OR last_heartbeat_at < now() - make_interval(mins => ${staleMinutes()})
      )::int                                                               AS needs_attention,
      (
        SELECT count(*)::int FROM swap_transactions
        WHERE occurred_at >= now() - interval '24 hours' AND status = 'SUCCESS'
      )                                                                    AS swaps_24h,
      (
        SELECT count(*)::int FROM swap_transactions
        WHERE occurred_at >= now() - interval '24 hours' AND status = 'FAILED'
      )                                                                    AS failed_24h
    FROM cabinets
  `;
  return {
    data: {
      total: (_a = row == null ? void 0 : row.total) != null ? _a : 0,
      online: (_b = row == null ? void 0 : row.online) != null ? _b : 0,
      offline: (_c = row == null ? void 0 : row.offline) != null ? _c : 0,
      maintenance: (_d = row == null ? void 0 : row.maintenance) != null ? _d : 0,
      needsAttention: (_e = row == null ? void 0 : row.needs_attention) != null ? _e : 0,
      swaps24h: (_f = row == null ? void 0 : row.swaps_24h) != null ? _f : 0,
      failed24h: (_g = row == null ? void 0 : row.failed_24h) != null ? _g : 0
    }
  };
});

export { summary_get as default };
//# sourceMappingURL=summary.get.mjs.map
