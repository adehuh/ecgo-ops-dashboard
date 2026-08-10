import { z } from 'zod';

const CABINET_STATUSES = ["ONLINE", "OFFLINE", "MAINTENANCE"];
const SLOT_STATES = ["EMPTY", "CHARGING", "FULL", "LOCKED", "FAULT"];
const SORT_KEYS = ["swaps24h", "code", "lastHeartbeat"];
const SORT_DIRECTIONS = ["asc", "desc"];
const PAGE_SIZES = [10, 25, 50];
const cabinetStatusSchema = z.enum(CABINET_STATUSES);
z.enum(SLOT_STATES);
const asStringArray = (value) => {
  if (value === void 0 || value === null) return void 0;
  const list = (Array.isArray(value) ? value : [value]).map((v) => String(v).trim()).filter((v) => v.length > 0);
  return list.length > 0 ? list : void 0;
};
const cabinetListQuerySchema = z.object({
  /** Cocokkan kode cabinet, kode cabang, atau nama cabang. Dicari di server. */
  q: z.string().trim().max(100, "Kata kunci maksimal 100 karakter").default(""),
  status: z.preprocess(asStringArray, z.array(cabinetStatusSchema).max(3)).optional(),
  sort: z.enum(SORT_KEYS).default("swaps24h"),
  dir: z.enum(SORT_DIRECTIONS).default("desc"),
  // Batas atas halaman itu disengaja: OFFSET yang besar membuat Postgres tetap
  // menghitung lalu membuang tiap baris yang dilewati, jadi ?page=999999999
  // adalah cara murah membebani database dari luar.
  page: z.coerce.number().int().min(1).max(1e4).default(1),
  pageSize: z.coerce.number().int().refine((v) => PAGE_SIZES.includes(v), {
    message: `pageSize harus salah satu dari ${PAGE_SIZES.join(", ")}`
  }).default(25)
});
const cabinetCodeParamSchema = z.string().trim().min(1, "Kode cabinet wajib diisi").max(32, "Kode cabinet maksimal 32 karakter").regex(/^[A-Za-z0-9-]+$/, "Kode cabinet hanya boleh huruf, angka, dan tanda hubung");

export { CABINET_STATUSES as C, PAGE_SIZES as P, cabinetListQuerySchema as a, cabinetCodeParamSchema as c };
//# sourceMappingURL=cabinets.mjs.map
