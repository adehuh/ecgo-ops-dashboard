import { a as useHead$1, u as useRoute$1, b as useRouter } from '../virtual/entry.mjs';
import { N as NuxtLink } from './nuxt-link-UghHcseA.mjs';
import { u as useFetch, d as describeApiError, S as StateMessage_default, b as StatusBadge_default, f as formatNumber, T as TimeAgo_default } from './apiError-D1F1t0TF.mjs';
import { defineComponent, withAsyncContext, computed, ref, watch, mergeProps, unref, withCtx, createTextVNode, toDisplayString, createVNode, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrIncludeBooleanAttr, ssrLooseContain, ssrRenderComponent, ssrRenderAttr, ssrRenderList, ssrRenderClass, ssrInterpolate, ssrRenderStyle } from 'vue/server-renderer';
import { C as CABINET_STATUSES, P as PAGE_SIZES, a as cabinetListQuerySchema } from '../_/cabinets.mjs';
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
import './ssr-Deiv8cWh.mjs';
import '@vue/shared';
import 'fnv1a-64';
import 'object-identity';
import 'zod';

//#region app/components/KpiStrip.vue?vue&type=script&setup=true&lang.ts
var KpiStrip_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "KpiStrip",
	__ssrInlineRender: true,
	props: {
		summary: {},
		pending: { type: Boolean }
	},
	setup(__props) {
		const props = __props;
		const tiles = computed(() => {
			const s = props.summary;
			return [
				{
					key: "total",
					label: "Total cabinet",
					value: s?.total,
					hint: `${s?.online ?? 0} online`
				},
				{
					key: "attention",
					label: "Perlu perhatian",
					value: s?.needsAttention,
					hint: `${s?.offline ?? 0} offline · ${s?.maintenance ?? 0} perawatan`,
					tone: (s?.needsAttention ?? 0) > 0 ? "warn" : "ok"
				},
				{
					key: "swaps",
					label: "Swap 24 jam",
					value: s?.swaps24h,
					hint: "berhasil, rolling 24 jam"
				},
				{
					key: "failed",
					label: "Gagal 24 jam",
					value: s?.failed24h,
					hint: failureRate(s),
					tone: (s?.failed24h ?? 0) > 0 ? "warn" : "ok"
				}
			];
		});
		function failureRate(s) {
			if (!s) return "";
			const attempts = s.swaps24h + s.failed24h;
			if (attempts === 0) return "belum ada percobaan";
			return `${(s.failed24h / attempts * 100).toFixed(1)}% dari percobaan`;
		}
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<dl${ssrRenderAttrs(mergeProps({ class: "grid grid-cols-2 gap-3 lg:grid-cols-4" }, _attrs))}><!--[-->`);
			ssrRenderList(unref(tiles), (tile) => {
				_push(`<div class="card px-4 py-3.5"><dt class="text-xs font-medium tracking-wide text-muted uppercase">${ssrInterpolate(tile.label)}</dt>`);
				if (__props.pending && tile.value === void 0) _push(`<dd class="mt-1.5 h-8 w-16 rounded-md shimmer"></dd>`);
				else _push(`<dd class="${ssrRenderClass([tile.tone === "warn" ? "text-warn" : "text-text", "mt-1 text-2xl font-extrabold tabular-nums"])}">${ssrInterpolate(("formatNumber" in _ctx ? _ctx.formatNumber : unref(formatNumber))(tile.value ?? 0))}</dd>`);
				_push(`<dd class="mt-0.5 text-xs text-faint">${ssrInterpolate(tile.hint)}</dd></div>`);
			});
			_push(`<!--]--></dl>`);
		};
	}
});
//#endregion
//#region app/components/KpiStrip.vue
var _sfc_setup$3 = KpiStrip_vue_vue_type_script_setup_true_lang_default.setup;
KpiStrip_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/KpiStrip.vue");
	return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
var KpiStrip_default = Object.assign(KpiStrip_vue_vue_type_script_setup_true_lang_default, { __name: "KpiStrip" });
//#endregion
//#region app/components/SlotFillBar.vue?vue&type=script&setup=true&lang.ts
var SlotFillBar_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "SlotFillBar",
	__ssrInlineRender: true,
	props: {
		filled: {},
		ready: {},
		total: {}
	},
	setup(__props) {
		const props = __props;
		const filledPct = computed(() => props.total > 0 ? props.filled / props.total * 100 : 0);
		const readyPct = computed(() => props.total > 0 ? props.ready / props.total * 100 : 0);
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "flex items-center gap-2.5" }, _attrs))}><div class="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2" role="img"${ssrRenderAttr("aria-label", `${__props.filled} dari ${__props.total} slot terisi, ${__props.ready} siap ditukar`)}><div class="absolute inset-y-0 left-0 rounded-full bg-accent/30" style="${ssrRenderStyle({ width: `${unref(filledPct)}%` })}"></div><div class="absolute inset-y-0 left-0 rounded-full bg-accent" style="${ssrRenderStyle({ width: `${unref(readyPct)}%` })}"></div></div><span class="text-sm whitespace-nowrap tabular-nums">${ssrInterpolate(__props.filled)}<span class="text-faint">/${ssrInterpolate(__props.total)}</span><span class="ml-1.5 text-xs text-muted">${ssrInterpolate(__props.ready)} siap</span></span></div>`);
		};
	}
});
//#endregion
//#region app/components/SlotFillBar.vue
var _sfc_setup$2 = SlotFillBar_vue_vue_type_script_setup_true_lang_default.setup;
SlotFillBar_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/SlotFillBar.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var SlotFillBar_default = Object.assign(SlotFillBar_vue_vue_type_script_setup_true_lang_default, { __name: "SlotFillBar" });
//#endregion
//#region app/components/PaginationBar.vue?vue&type=script&setup=true&lang.ts
var PaginationBar_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "PaginationBar",
	__ssrInlineRender: true,
	props: { meta: {} },
	emits: ["change"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const from = computed(() => props.meta.total === 0 ? 0 : (props.meta.page - 1) * props.meta.pageSize + 1);
		const to = computed(() => Math.min(props.meta.page * props.meta.pageSize, props.meta.total));
		/**
		* Jendela nomor halaman yang menyusut, dengan elipsis.
		*
		* Merender 200 tombol halaman itu tidak bisa dipakai dan membanjiri pembaca
		* layar. Halaman pertama, terakhir, dan tetangga langsung sudah cukup untuk
		* navigasi; sisanya lebih baik lewat kotak pencarian.
		*/
		const pages = computed(() => {
			const { page, totalPages } = props.meta;
			if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
			const out = [1];
			const start = Math.max(2, page - 1);
			const end = Math.min(totalPages - 1, page + 1);
			if (start > 2) out.push("gap");
			for (let p = start; p <= end; p += 1) out.push(p);
			if (end < totalPages - 1) out.push("gap");
			out.push(totalPages);
			return out;
		});
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<nav${ssrRenderAttrs(mergeProps({
				class: "flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row",
				"aria-label": "Navigasi halaman"
			}, _attrs))}><p class="text-sm text-muted tabular-nums"> Menampilkan <span class="font-medium text-text">${ssrInterpolate(("formatNumber" in _ctx ? _ctx.formatNumber : unref(formatNumber))(unref(from)))}</span> –<span class="font-medium text-text">${ssrInterpolate(("formatNumber" in _ctx ? _ctx.formatNumber : unref(formatNumber))(unref(to)))}</span> dari <span class="font-medium text-text">${ssrInterpolate(("formatNumber" in _ctx ? _ctx.formatNumber : unref(formatNumber))(__props.meta.total))}</span> cabinet </p><div class="flex items-center gap-1"><button type="button" class="grid size-10 place-items-center rounded-lg border border-border text-muted transition-colors enabled:hover:bg-surface-2 enabled:hover:text-text disabled:opacity-35"${ssrIncludeBooleanAttr(__props.meta.page <= 1) ? " disabled" : ""} aria-label="Halaman sebelumnya"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7"></path></svg></button><!--[-->`);
			ssrRenderList(unref(pages), (p, i) => {
				_push(`<!--[-->`);
				if (p === "gap") _push(`<span class="px-1 text-faint" aria-hidden="true">…</span>`);
				else _push(`<button type="button" class="${ssrRenderClass([p === __props.meta.page ? "border-accent bg-accent text-accent-contrast" : "border-border text-muted hover:bg-surface-2 hover:text-text", "min-w-10 rounded-lg border px-3 py-2.5 text-sm font-medium tabular-nums transition-colors"])}"${ssrRenderAttr("aria-current", p === __props.meta.page ? "page" : void 0)}${ssrRenderAttr("aria-label", `Halaman ${p}`)}>${ssrInterpolate(p)}</button>`);
				_push(`<!--]-->`);
			});
			_push(`<!--]--><button type="button" class="grid size-10 place-items-center rounded-lg border border-border text-muted transition-colors enabled:hover:bg-surface-2 enabled:hover:text-text disabled:opacity-35"${ssrIncludeBooleanAttr(__props.meta.page >= __props.meta.totalPages) ? " disabled" : ""} aria-label="Halaman berikutnya"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7"></path></svg></button></div></nav>`);
		};
	}
});
//#endregion
//#region app/components/PaginationBar.vue
var _sfc_setup$1 = PaginationBar_vue_vue_type_script_setup_true_lang_default.setup;
PaginationBar_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/PaginationBar.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var PaginationBar_default = Object.assign(PaginationBar_vue_vue_type_script_setup_true_lang_default, { __name: "PaginationBar" });
//#endregion
//#region app/composables/useCabinetQuery.ts
/**
* State daftar cabinet, dengan URL sebagai satu-satunya sumber kebenaran.
*
* Tidak ada salinan bayangan di ref lokal. Kalau state pencarian hidup di dua
* tempat, keduanya pasti akan menyimpang — biasanya persis saat pengguna menekan
* tombol back — dan yang tampil di layar tidak lagi cocok dengan URL yang mereka
* bagikan ke rekan.
*/
var DEFAULTS = cabinetListQuerySchema.parse({});
function useCabinetQuery() {
	const route = useRoute$1();
	const router = useRouter();
	/**
	* URL bisa saja dibuat manusia atau berasal dari bookmark lama, jadi ia
	* diperlakukan sebagai input yang tidak dipercaya. Kalau tidak lolos parse,
	* halaman turun ke nilai default dan MENGATAKANNYA, alih-alih menampilkan
	* layar kosong yang membingungkan.
	*/
	const parsed = computed(() => cabinetListQuerySchema.safeParse(route.query));
	const hasInvalidParams = computed(() => !parsed.value.success);
	const state = computed(() => parsed.value.success ? parsed.value.data : DEFAULTS);
	/** Query yang dikirim ke API — sudah tervalidasi, jadi selalu bisa diterima server. */
	const apiQuery = computed(() => ({
		q: state.value.q || void 0,
		status: state.value.status,
		sort: state.value.sort,
		dir: state.value.dir,
		page: state.value.page,
		pageSize: state.value.pageSize
	}));
	/**
	* Tulis perubahan ke URL, buang apa pun yang sama dengan default.
	*
	* `replace`, bukan `push`: mengetik "kemayoran" akan meninggalkan sepuluh entri
	* riwayat kalau tiap ketukan di-push, dan tombol back berubah jadi mesin
	* penghapus huruf.
	*/
	function patch(changes, options = {}) {
		const next = {
			...state.value,
			...changes
		};
		if (options.resetPage !== false && !("page" in changes)) next.page = 1;
		const query = {};
		if (next.q) query.q = next.q;
		if (next.status?.length) query.status = next.status;
		if (next.sort !== DEFAULTS.sort) query.sort = next.sort;
		if (next.dir !== DEFAULTS.dir) query.dir = next.dir;
		if (next.page !== DEFAULTS.page) query.page = String(next.page);
		if (next.pageSize !== DEFAULTS.pageSize) query.pageSize = String(next.pageSize);
		return router.replace({ query });
	}
	function toggleStatus(status) {
		const current = state.value.status ?? [];
		const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
		return patch({ status: next.length > 0 ? next : void 0 });
	}
	/**
	* Klik header kolom: kolom baru mulai dari arah yang paling berguna, kolom
	* yang sama membalik arah.
	*/
	function toggleSort(sort) {
		if (state.value.sort === sort) return patch({ dir: state.value.dir === "asc" ? "desc" : "asc" });
		return patch({
			sort,
			dir: sort === "code" ? "asc" : "desc"
		});
	}
	const isFiltered = computed(() => Boolean(state.value.q) || Boolean(state.value.status?.length));
	const reset = () => router.replace({ query: {} });
	return {
		state,
		apiQuery,
		hasInvalidParams,
		isFiltered,
		patch,
		toggleStatus,
		toggleSort,
		reset
	};
}
//#endregion
//#region app/pages/cabinets/index.vue?vue&type=script&setup=true&lang.ts
var index_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "index",
	__ssrInlineRender: true,
	async setup(__props) {
		let __temp, __restore;
		useHead$1({ title: "Cabinet · ECGO Ops" });
		const { state, apiQuery, hasInvalidParams, isFiltered, patch, reset } = useCabinetQuery();
		const { data, status, error, refresh } = ([__temp, __restore] = withAsyncContext(() => useFetch("/api/cabinets", { query: apiQuery }, "$tgsd96o_WH")), __temp = await __temp, __restore(), __temp);
		const { data: summary, status: summaryStatus } = ([__temp, __restore] = withAsyncContext(() => useFetch("/api/summary", "$7l9pzBLMQj")), __temp = await __temp, __restore(), __temp);
		const isFirstLoad = computed(() => status.value === "pending" && !data.value);
		const isRefreshing = computed(() => status.value === "pending" && Boolean(data.value));
		const rows = computed(() => data.value?.data ?? []);
		const meta = computed(() => data.value?.meta ?? null);
		const failure = computed(() => error.value ? describeApiError(error.value) : null);
		const searchInput = ref(state.value.q);
		let debounce;
		watch(() => state.value.q, (value) => {
			if (value !== searchInput.value) searchInput.value = value;
		});
		watch(searchInput, (value) => {
			clearTimeout(debounce);
			debounce = setTimeout(() => {
				if (value.trim() !== state.value.q) patch({ q: value.trim() });
			}, 350);
		});
		const autoRefresh = ref(true);
		const COLUMNS = [
			{
				key: "code",
				label: "Kode",
				sortable: true
			},
			{
				key: "branch",
				label: "Cabang",
				sortable: false
			},
			{
				key: "status",
				label: "Status",
				sortable: false
			},
			{
				key: "slots",
				label: "Slot terisi",
				sortable: false
			},
			{
				key: "swaps24h",
				label: "Swap 24 jam",
				sortable: true
			},
			{
				key: "lastHeartbeat",
				label: "Heartbeat",
				sortable: true
			}
		];
		const ariaSort = (key) => state.value.sort === key ? state.value.dir === "asc" ? "ascending" : "descending" : "none";
		const STATUS_LABELS = {
			ONLINE: "Online",
			OFFLINE: "Offline",
			MAINTENANCE: "Perawatan"
		};
		return (_ctx, _push, _parent, _attrs) => {
			const _component_KpiStrip = KpiStrip_default;
			const _component_StateMessage = StateMessage_default;
			const _component_NuxtLink = NuxtLink;
			const _component_StatusBadge = StatusBadge_default;
			const _component_SlotFillBar = SlotFillBar_default;
			const _component_TimeAgo = TimeAgo_default;
			const _component_PaginationBar = PaginationBar_default;
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-5" }, _attrs))}><div class="flex flex-wrap items-end justify-between gap-3"><div><h1 class="text-2xl font-extrabold tracking-tight">Cabinet battery swap</h1><p class="mt-1 text-sm text-muted"> Pantau status, ketersediaan slot, dan throughput tiap cabinet. </p></div><label class="flex cursor-pointer items-center gap-2 text-sm text-muted select-none"><input${ssrIncludeBooleanAttr(Array.isArray(unref(autoRefresh)) ? ssrLooseContain(unref(autoRefresh), null) : unref(autoRefresh)) ? " checked" : ""} type="checkbox" class="size-4 accent-[var(--accent)]"> Auto-refresh 30 dtk `);
			if (unref(isRefreshing)) _push(`<span class="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true"></span>`);
			else _push(`<!---->`);
			_push(`</label></div>`);
			_push(ssrRenderComponent(_component_KpiStrip, {
				summary: unref(summary)?.data ?? null,
				pending: unref(summaryStatus) === "pending"
			}, null, _parent));
			if (unref(hasInvalidParams)) _push(`<p class="rounded-lg border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-sm text-warn" role="status"> Sebagian parameter di URL tidak dikenali dan diabaikan. Menampilkan tampilan default. </p>`);
			else _push(`<!---->`);
			_push(`<div class="card overflow-hidden"><div class="flex flex-col gap-3 border-b border-border p-3.5 lg:flex-row lg:items-center"><div class="relative flex-1"><svg class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path stroke-linecap="round" d="m20 20-3.5-3.5"></path></svg><input${ssrRenderAttr("value", unref(searchInput))} type="search"${ssrRenderAttr("maxlength", 100)} placeholder="Cari kode cabinet atau cabang…" aria-label="Cari kode cabinet atau cabang" class="w-full rounded-lg border border-border bg-surface-2 py-2.5 pr-3 pl-9 text-sm placeholder:text-faint focus:border-accent focus:outline-none"></div><div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter status"><!--[-->`);
			ssrRenderList(unref(CABINET_STATUSES), (s) => {
				_push(`<button type="button" class="${ssrRenderClass([unref(state).status?.includes(s) ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2 hover:text-text", "rounded-lg border px-3 py-2 text-sm font-medium transition-colors"])}"${ssrRenderAttr("aria-pressed", unref(state).status?.includes(s) ?? false)}>${ssrInterpolate(STATUS_LABELS[s])}</button>`);
			});
			_push(`<!--]--><select${ssrRenderAttr("value", unref(state).pageSize)} aria-label="Jumlah baris per halaman" class="rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-sm text-muted focus:border-accent focus:outline-none"><!--[-->`);
			ssrRenderList(unref(PAGE_SIZES), (size) => {
				_push(`<option${ssrRenderAttr("value", size)}>${ssrInterpolate(size)} / hal</option>`);
			});
			_push(`<!--]--></select></div></div><p aria-live="polite" class="sr-only">${ssrInterpolate(unref(meta) ? `${unref(meta).total} cabinet ditemukan` : "Memuat cabinet")}</p>`);
			if (unref(failure)) _push(ssrRenderComponent(_component_StateMessage, {
				tone: "danger",
				title: "Gagal memuat daftar cabinet",
				description: unref(failure).message,
				"action-label": "Coba lagi",
				onAction: ($event) => unref(refresh)()
			}, null, _parent));
			else if (unref(isFirstLoad)) {
				_push(`<div class="divide-y divide-border" aria-hidden="true"><!--[-->`);
				ssrRenderList(8, (i) => {
					_push(`<div class="flex items-center gap-4 px-4 py-3.5"><div class="h-4 w-24 rounded shimmer"></div><div class="h-4 w-32 rounded shimmer"></div><div class="h-5 w-20 rounded-full shimmer"></div><div class="ml-auto h-4 w-28 rounded shimmer"></div><div class="h-4 w-10 rounded shimmer"></div><div class="h-4 w-20 rounded shimmer"></div></div>`);
				});
				_push(`<!--]--></div>`);
			} else if (unref(rows).length === 0 && unref(isFiltered)) _push(ssrRenderComponent(_component_StateMessage, {
				title: "Tidak ada cabinet yang cocok",
				description: "Tidak ada cabinet yang sesuai dengan kata kunci dan filter ini. Coba longgarkan filternya.",
				"action-label": "Bersihkan filter",
				onAction: ($event) => unref(reset)()
			}, null, _parent));
			else if (unref(rows).length === 0) _push(ssrRenderComponent(_component_StateMessage, {
				title: "Belum ada cabinet",
				description: "Database belum berisi cabinet. Jalankan `npm run seed` untuk memuat data contoh."
			}, null, _parent));
			else {
				_push(`<!--[--><div class="${ssrRenderClass([unref(isRefreshing) ? "opacity-60" : "opacity-100", "overflow-x-auto transition-opacity"])}"><table class="hidden w-full text-left text-sm md:table"><thead class="border-b border-border text-xs tracking-wide text-muted uppercase"><tr><!--[-->`);
				ssrRenderList(COLUMNS, (col) => {
					_push(`<th scope="col" class="${ssrRenderClass([col.key === "swaps24h" ? "text-right" : "", "px-4 py-3 font-medium"])}"${ssrRenderAttr("aria-sort", col.sortable ? ariaSort(col.key) : void 0)}>`);
					if (col.sortable) _push(`<button type="button" class="${ssrRenderClass([unref(state).sort === col.key ? "text-text" : "", "inline-flex items-center gap-1 transition-colors hover:text-text"])}">${ssrInterpolate(col.label)} <svg class="${ssrRenderClass([[unref(state).sort === col.key ? "opacity-100" : "opacity-30", unref(state).sort === col.key && unref(state).dir === "asc" ? "rotate-180" : ""], "size-3.5 transition-transform"])}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m0 0 5-5m-5 5-5-5"></path></svg></button>`);
					else _push(`<span>${ssrInterpolate(col.label)}</span>`);
					_push(`</th>`);
				});
				_push(`<!--]--></tr></thead><tbody class="divide-y divide-border"><!--[-->`);
				ssrRenderList(unref(rows), (cabinet) => {
					_push(`<tr class="transition-colors hover:bg-surface-2"><td class="px-4 py-3">`);
					_push(ssrRenderComponent(_component_NuxtLink, {
						to: `/cabinets/${cabinet.code}`,
						class: "font-mono font-medium text-text hover:text-accent hover:underline"
					}, {
						default: withCtx((_, _push, _parent, _scopeId) => {
							if (_push) _push(`${ssrInterpolate(cabinet.code)}`);
							else return [createTextVNode(toDisplayString(cabinet.code), 1)];
						}),
						_: 2
					}, _parent));
					_push(`</td><td class="px-4 py-3"><span class="text-text">${ssrInterpolate(cabinet.branchName)}</span><span class="ml-1.5 text-xs text-faint">${ssrInterpolate(cabinet.branchCode)}</span></td><td class="px-4 py-3">`);
					_push(ssrRenderComponent(_component_StatusBadge, {
						status: cabinet.status,
						"is-stale": cabinet.isStale,
						"never-reported": cabinet.lastHeartbeatAt === null
					}, null, _parent));
					_push(`</td><td class="px-4 py-3">`);
					_push(ssrRenderComponent(_component_SlotFillBar, {
						filled: cabinet.slotsFilled,
						ready: cabinet.slotsReady,
						total: cabinet.slotsTotal
					}, null, _parent));
					_push(`</td><td class="px-4 py-3 text-right font-medium tabular-nums">${ssrInterpolate(("formatNumber" in _ctx ? _ctx.formatNumber : unref(formatNumber))(cabinet.swaps24h))}</td><td class="px-4 py-3 text-muted">`);
					_push(ssrRenderComponent(_component_TimeAgo, { iso: cabinet.lastHeartbeatAt }, null, _parent));
					_push(`</td></tr>`);
				});
				_push(`<!--]--></tbody></table><ul class="divide-y divide-border md:hidden"><!--[-->`);
				ssrRenderList(unref(rows), (cabinet) => {
					_push(`<li>`);
					_push(ssrRenderComponent(_component_NuxtLink, {
						to: `/cabinets/${cabinet.code}`,
						class: "block px-4 py-3.5 hover:bg-surface-2"
					}, {
						default: withCtx((_, _push, _parent, _scopeId) => {
							if (_push) {
								_push(`<div class="flex items-start justify-between gap-3"${_scopeId}><div${_scopeId}><p class="font-mono font-medium"${_scopeId}>${ssrInterpolate(cabinet.code)}</p><p class="mt-0.5 text-sm text-muted"${_scopeId}>${ssrInterpolate(cabinet.branchName)}</p></div>`);
								_push(ssrRenderComponent(_component_StatusBadge, {
									status: cabinet.status,
									"is-stale": cabinet.isStale,
									"never-reported": cabinet.lastHeartbeatAt === null
								}, null, _parent, _scopeId));
								_push(`</div><div class="mt-3 flex items-center justify-between gap-3"${_scopeId}>`);
								_push(ssrRenderComponent(_component_SlotFillBar, {
									filled: cabinet.slotsFilled,
									ready: cabinet.slotsReady,
									total: cabinet.slotsTotal
								}, null, _parent, _scopeId));
								_push(`<p class="text-sm text-muted"${_scopeId}><span class="font-medium text-text tabular-nums"${_scopeId}>${ssrInterpolate(("formatNumber" in _ctx ? _ctx.formatNumber : unref(formatNumber))(cabinet.swaps24h))}</span> swap · `);
								_push(ssrRenderComponent(_component_TimeAgo, { iso: cabinet.lastHeartbeatAt }, null, _parent, _scopeId));
								_push(`</p></div>`);
							} else return [createVNode("div", { class: "flex items-start justify-between gap-3" }, [createVNode("div", null, [createVNode("p", { class: "font-mono font-medium" }, toDisplayString(cabinet.code), 1), createVNode("p", { class: "mt-0.5 text-sm text-muted" }, toDisplayString(cabinet.branchName), 1)]), createVNode(_component_StatusBadge, {
								status: cabinet.status,
								"is-stale": cabinet.isStale,
								"never-reported": cabinet.lastHeartbeatAt === null
							}, null, 8, [
								"status",
								"is-stale",
								"never-reported"
							])]), createVNode("div", { class: "mt-3 flex items-center justify-between gap-3" }, [createVNode(_component_SlotFillBar, {
								filled: cabinet.slotsFilled,
								ready: cabinet.slotsReady,
								total: cabinet.slotsTotal
							}, null, 8, [
								"filled",
								"ready",
								"total"
							]), createVNode("p", { class: "text-sm text-muted" }, [
								createVNode("span", { class: "font-medium text-text tabular-nums" }, toDisplayString(("formatNumber" in _ctx ? _ctx.formatNumber : unref(formatNumber))(cabinet.swaps24h)), 1),
								createTextVNode(" swap · "),
								createVNode(_component_TimeAgo, { iso: cabinet.lastHeartbeatAt }, null, 8, ["iso"])
							])])];
						}),
						_: 2
					}, _parent));
					_push(`</li>`);
				});
				_push(`<!--]--></ul></div>`);
				if (unref(meta)) _push(ssrRenderComponent(_component_PaginationBar, {
					meta: unref(meta),
					onChange: ($event) => unref(patch)({ page: $event })
				}, null, _parent));
				else _push(`<!---->`);
				_push(`<!--]-->`);
			}
			_push(`</div></div>`);
		};
	}
});
//#endregion
//#region app/pages/cabinets/index.vue
var _sfc_setup = index_vue_vue_type_script_setup_true_lang_default.setup;
index_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/cabinets/index.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var cabinets_default = index_vue_vue_type_script_setup_true_lang_default;

export { cabinets_default as default };
//# sourceMappingURL=cabinets-BEBbMLr1.mjs.map
