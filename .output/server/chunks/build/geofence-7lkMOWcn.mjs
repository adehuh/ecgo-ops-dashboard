import { a as useHead$1 } from '../virtual/entry.mjs';
import { defineComponent, ref, computed, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderAttr, ssrInterpolate, ssrRenderClass, ssrRenderList } from 'vue/server-renderer';
import 'nostics';
import 'nostics/formatters/ansi';
import '../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '../routes/renderer.mjs';
import 'unhead/server';
import 'unhead/legacy';
import 'unhead/plugins';
import 'vue-bundle-renderer/runtime';
import 'devalue';
import 'vue-router';
import 'unhead/utils';

const EARTH_RADIUS_M = 63710088e-1;
const MAX_ACCEPTABLE_ACCURACY_M = 100;
const MAX_ACCURACY_TOLERANCE_M = 30;
const toRadians = (deg) => deg * Math.PI / 180;
function haversineMeters(lat1, lng1, lat2, lng2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);
  const sinHalfPhi = Math.sin(deltaPhi / 2);
  const sinHalfLambda = Math.sin(deltaLambda / 2);
  const a = sinHalfPhi * sinHalfPhi + Math.cos(phi1) * Math.cos(phi2) * sinHalfLambda * sinHalfLambda;
  const aClamped = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(aClamped), Math.sqrt(1 - aClamped));
  return EARTH_RADIUS_M * c;
}
function isValidCoordinate(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}
function evaluateCheckIn(checkIn, branches) {
  if (!isValidCoordinate(checkIn.lat, checkIn.lng)) {
    return { status: "REJECTED", reason: "INVALID_COORDINATE" };
  }
  const { accuracyM } = checkIn;
  if (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > MAX_ACCEPTABLE_ACCURACY_M) {
    return { status: "REJECTED", reason: "LOW_ACCURACY" };
  }
  const activeBranches = branches.filter((b) => b.active);
  if (activeBranches.length === 0) {
    return { status: "REJECTED", reason: "NO_BRANCH_ASSIGNED" };
  }
  const candidates = activeBranches.filter((b) => isValidCoordinate(b.lat, b.lng));
  if (candidates.length === 0) {
    return { status: "OUT_OF_RANGE", nearestBranchId: null, distanceM: null };
  }
  const measured = candidates.map((branch) => ({
    branch,
    distanceM: Math.round(haversineMeters(checkIn.lat, checkIn.lng, branch.lat, branch.lng))
  }));
  const tolerance = Math.min(accuracyM, MAX_ACCURACY_TOLERANCE_M);
  const byDistanceThenId = (a, b) => a.distanceM - b.distanceM || (a.branch.id < b.branch.id ? -1 : a.branch.id > b.branch.id ? 1 : 0);
  const matching = measured.filter((m) => m.distanceM <= m.branch.radiusM + tolerance).sort(byDistanceThenId);
  const best = matching[0];
  if (best) {
    return {
      status: "VALID",
      branchId: best.branch.id,
      branchName: best.branch.name,
      distanceM: best.distanceM
    };
  }
  const nearest = [...measured].sort(byDistanceThenId)[0];
  return {
    status: "OUT_OF_RANGE",
    nearestBranchId: nearest.branch.id,
    distanceM: nearest.distanceM
  };
}

//#region app/pages/geofence.vue?vue&type=script&setup=true&lang.ts
/**
* Halaman peragaan untuk Bagian B.
*
* Bukan bagian dari Bagian D dan tidak menyentuh database — ia meng-import
* fungsi yang sama persis yang diuji `tests/geofence.spec.ts` dan menjalankannya
* di browser. Tujuannya supaya perilaku fungsinya bisa dicoba langsung saat
* Live Defense, bukan hanya dibaca dari kode.
*/
var geofence_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "geofence",
	__ssrInlineRender: true,
	setup(__props) {
		useHead$1({ title: "Geofence check-in · ECGO Ops" });
		const branches = [
			{
				id: "B-01",
				name: "Kemayoran",
				lat: -6.1569,
				lng: 106.8449,
				radiusM: 150,
				active: true
			},
			{
				id: "B-02",
				name: "Sunter",
				lat: -6.142,
				lng: 106.872,
				radiusM: 200,
				active: true
			},
			{
				id: "B-03",
				name: "Cakung",
				lat: -6.185,
				lng: 106.945,
				radiusM: 120,
				active: false
			}
		];
		const lat = ref(-6.157);
		const lng = ref(106.845);
		const accuracy = ref(12);
		const result = computed(() => evaluateCheckIn({
			lat: Number(lat.value),
			lng: Number(lng.value),
			accuracyM: Number(accuracy.value),
			at: (/* @__PURE__ */ new Date()).toISOString()
		}, branches));
		const evaluated = [
			{
				no: 1,
				lat: -6.157,
				lng: 106.845,
				accuracyM: 12,
				expect: "VALID B-01"
			},
			{
				no: 2,
				lat: -6.1851,
				lng: 106.9451,
				accuracyM: 10,
				expect: "OUT_OF_RANGE (B-03 nonaktif)"
			},
			{
				no: 3,
				lat: -6.157,
				lng: 106.845,
				accuracyM: 140,
				expect: "REJECTED / LOW_ACCURACY"
			},
			{
				no: 4,
				lat: 0,
				lng: 0,
				accuracyM: 5,
				expect: "REJECTED / INVALID_COORDINATE"
			},
			{
				no: 5,
				lat: -6.3,
				lng: 106.8,
				accuracyM: 15,
				expect: "OUT_OF_RANGE, terdekat B-01"
			}
		].map((c) => ({
			...c,
			actual: evaluateCheckIn({
				lat: c.lat,
				lng: c.lng,
				accuracyM: c.accuracyM}, branches)
		}));
		const summarise = (r) => {
			if (r.status === "VALID") return `VALID · ${r.branchId} ${r.branchName} · ${r.distanceM} m`;
			if (r.status === "OUT_OF_RANGE") return r.nearestBranchId ? `OUT_OF_RANGE · terdekat ${r.nearestBranchId} · ${r.distanceM} m` : "OUT_OF_RANGE · tidak ada cabang yang bisa dinilai";
			return `REJECTED · ${r.reason}`;
		};
		const tone = (r) => r.status === "VALID" ? "border-ok/40 bg-ok/10 text-ok" : r.status === "OUT_OF_RANGE" ? "border-warn/40 bg-warn/10 text-warn" : "border-danger/40 bg-danger/10 text-danger";
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-5" }, _attrs))}><div><h1 class="text-2xl font-extrabold tracking-tight">Geofence check-in</h1><p class="mt-1 max-w-2xl text-sm text-muted"> Peragaan langsung <code class="font-mono text-xs text-text">evaluateCheckIn()</code> dari Bagian B. Fungsi yang dijalankan di sini adalah modul yang sama yang diuji unit test — tidak ada salinan terpisah. </p></div><div class="grid gap-4 lg:grid-cols-2"><section class="card space-y-4 p-4 sm:p-5"><h2 class="text-sm font-medium">Posisi check-in</h2><div class="grid grid-cols-2 gap-3"><label class="space-y-1.5"><span class="text-xs font-medium tracking-wide text-muted uppercase">Latitude</span><input${ssrRenderAttr("value", unref(lat))} type="number" step="0.0001" class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm focus:border-accent focus:outline-none"></label><label class="space-y-1.5"><span class="text-xs font-medium tracking-wide text-muted uppercase">Longitude</span><input${ssrRenderAttr("value", unref(lng))} type="number" step="0.0001" class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm focus:border-accent focus:outline-none"></label></div><label class="block space-y-1.5"><span class="text-xs font-medium tracking-wide text-muted uppercase"> Akurasi GPS · ${ssrInterpolate(unref(accuracy))} m </span><input${ssrRenderAttr("value", unref(accuracy))} type="range" min="0" max="200" class="w-full accent-[var(--accent)]"><span class="block text-xs text-faint"> Di atas 100 m ditolak. Toleransi yang disumbangkan akurasi dibatasi 30 m. </span></label><div class="${ssrRenderClass([tone(unref(result)), "rounded-lg border px-3.5 py-3 font-mono text-sm"])}">${ssrInterpolate(summarise(unref(result)))}</div></section><section class="card p-4 sm:p-5"><h2 class="mb-3 text-sm font-medium">Cabang yang terdaftar</h2><ul class="space-y-2"><!--[-->`);
			ssrRenderList(branches, (branch) => {
				_push(`<li class="${ssrRenderClass([branch.active ? "" : "opacity-50", "flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"])}"><div><span class="font-mono text-xs text-muted">${ssrInterpolate(branch.id)}</span><span class="ml-2 font-medium">${ssrInterpolate(branch.name)}</span></div><div class="text-right text-xs text-muted"><p class="font-mono">${ssrInterpolate(branch.lat)}, ${ssrInterpolate(branch.lng)}</p><p>radius ${ssrInterpolate(branch.radiusM)} m · ${ssrInterpolate(branch.active ? "aktif" : "nonaktif")}</p></div></li>`);
			});
			_push(`<!--]--></ul></section></div><section class="card overflow-hidden"><h2 class="border-b border-border px-4 py-3.5 text-sm font-medium">Lima kasus uji dari soal</h2><div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b border-border text-xs tracking-wide text-muted uppercase"><tr><th scope="col" class="px-4 py-2.5 font-medium">#</th><th scope="col" class="px-4 py-2.5 font-medium">Input</th><th scope="col" class="px-4 py-2.5 font-medium">Ekspektasi</th><th scope="col" class="px-4 py-2.5 font-medium">Hasil</th><th scope="col" class="px-4 py-2.5 font-medium"><span class="sr-only">Coba</span></th></tr></thead><tbody class="divide-y divide-border"><!--[-->`);
			ssrRenderList(unref(evaluated), (c) => {
				_push(`<tr class="hover:bg-surface-2"><td class="px-4 py-2.5 tabular-nums">${ssrInterpolate(c.no)}</td><td class="px-4 py-2.5 font-mono text-xs text-muted">${ssrInterpolate(c.lat)}, ${ssrInterpolate(c.lng)} · ±${ssrInterpolate(c.accuracyM)} m </td><td class="px-4 py-2.5 text-muted">${ssrInterpolate(c.expect)}</td><td class="px-4 py-2.5 font-mono text-xs">${ssrInterpolate(summarise(c.actual))}</td><td class="px-4 py-2.5 text-right"><button type="button" class="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-text"> Coba </button></td></tr>`);
			});
			_push(`<!--]--></tbody></table></div></section></div>`);
		};
	}
});
//#endregion
//#region app/pages/geofence.vue
var _sfc_setup = geofence_vue_vue_type_script_setup_true_lang_default.setup;
geofence_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/geofence.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var geofence_default = geofence_vue_vue_type_script_setup_true_lang_default;

export { geofence_default as default };
//# sourceMappingURL=geofence-7lkMOWcn.mjs.map
