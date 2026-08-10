import { d as defineApiHandler, u as useDb } from '../../_/db.mjs';
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

const health_get = defineApiHandler(async () => {
  var _a;
  const sql = useDb();
  const startedAt = performance.now();
  const [row] = await sql`SELECT count(*)::int AS cabinets FROM cabinets`;
  return {
    data: {
      status: "ok",
      database: "reachable",
      cabinets: (_a = row == null ? void 0 : row.cabinets) != null ? _a : 0,
      latencyMs: Math.round(performance.now() - startedAt)
    }
  };
});

export { health_get as default };
//# sourceMappingURL=health.get.mjs.map
