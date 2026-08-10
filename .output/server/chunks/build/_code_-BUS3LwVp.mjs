import { u as useRoute$1, a as useHead$1, n as navigateTo } from '../virtual/entry.mjs';
import { N as NuxtLink } from './nuxt-link-UghHcseA.mjs';
import { u as useFetch, d as describeApiError, f as formatNumber, a as formatDate, S as StateMessage_default, b as StatusBadge_default, T as TimeAgo_default, c as formatFull, e as formatDateTime, g as formatDurationSeconds, w as wibHourLabel } from './apiError-D1F1t0TF.mjs';
import { defineComponent, computed, withAsyncContext, mergeProps, withCtx, openBlock, createBlock, createVNode, createTextVNode, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderList, ssrInterpolate, ssrRenderClass, ssrRenderAttr, ssrRenderStyle } from 'vue/server-renderer';
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

//#region app/components/SlotGrid.vue?vue&type=script&setup=true&lang.ts
var SlotGrid_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "SlotGrid",
	__ssrInlineRender: true,
	props: {
		slots: {},
		stale: { type: Boolean }
	},
	setup(__props) {
		const props = __props;
		/**
		* Tiap state punya warna DAN ikon DAN label. Grid yang hanya dibedakan warna
		* tidak bisa dibaca oleh sekitar 1 dari 12 laki-laki, dan teknisi lapangan
		* membaca layar ini di bawah matahari langsung — kondisi yang menghapus
		* perbedaan warna halus jauh sebelum menghapus perbedaan bentuk.
		*/
		const STATES = {
			FULL: {
				label: "Penuh",
				classes: "border-ok/40 bg-ok/10 text-ok",
				icon: "M5 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm16 3v4"
			},
			CHARGING: {
				label: "Mengisi",
				classes: "border-warn/40 bg-warn/10 text-warn",
				icon: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z"
			},
			EMPTY: {
				label: "Kosong",
				classes: "border-dashed border-border-strong bg-transparent text-faint",
				icon: "M5 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
			},
			LOCKED: {
				label: "Terkunci",
				classes: "border-info/40 bg-info/10 text-info",
				icon: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
			},
			FAULT: {
				label: "Rusak",
				classes: "border-danger/45 bg-danger/10 text-danger",
				icon: "M12 8v5m0 3.5h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
			}
		};
		const legend = computed(() => Object.keys(STATES).map((state) => ({
			state,
			...STATES[state],
			count: props.slots.filter((s) => s.state === state).length
		})));
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-4" }, _attrs))}><ul class="${ssrRenderClass([__props.stale ? "opacity-70" : "", "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"])}"><!--[-->`);
			ssrRenderList(__props.slots, (slot) => {
				_push(`<li class="${ssrRenderClass([STATES[slot.state].classes, "rounded-xl border p-3 transition-colors"])}"><div class="flex items-center justify-between"><span class="font-mono text-xs font-medium opacity-70"> #${ssrInterpolate(String(slot.slotNo).padStart(2, "0"))}</span><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path${ssrRenderAttr("d", STATES[slot.state].icon)}></path></svg></div><p class="mt-2 text-sm font-medium">${ssrInterpolate(STATES[slot.state].label)}</p>`);
				if (slot.soc !== null) _push(`<!--[--><div class="mt-2 flex items-center gap-2"><div class="h-1 flex-1 overflow-hidden rounded-full bg-current/20"><div class="h-full rounded-full bg-current" style="${ssrRenderStyle({ width: `${slot.soc}%` })}"></div></div><span class="text-xs font-medium tabular-nums">${ssrInterpolate(slot.soc)}%</span></div><p class="mt-1.5 truncate font-mono text-[10px] opacity-60"${ssrRenderAttr("title", slot.batteryId ?? "")}>${ssrInterpolate(slot.batteryId)}</p><!--]-->`);
				else _push(`<p class="mt-2 text-xs opacity-60">Tidak ada baterai</p>`);
				_push(`</li>`);
			});
			_push(`<!--]--></ul><ul class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted"><!--[-->`);
			ssrRenderList(unref(legend), (item) => {
				_push(`<li class="flex items-center gap-1.5"><span class="${ssrRenderClass([item.classes, "size-2 rounded-full border"])}" aria-hidden="true"></span> ${ssrInterpolate(item.label)} <span class="tabular-nums opacity-70">${ssrInterpolate(item.count)}</span></li>`);
			});
			_push(`<!--]--></ul></div>`);
		};
	}
});
//#endregion
//#region app/components/SlotGrid.vue
var _sfc_setup$2 = SlotGrid_vue_vue_type_script_setup_true_lang_default.setup;
SlotGrid_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/SlotGrid.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var SlotGrid_default = Object.assign(SlotGrid_vue_vue_type_script_setup_true_lang_default, { __name: "SlotGrid" });
//#endregion
//#region app/components/SwapChart.vue?vue&type=script&setup=true&lang.ts
/**
* Grafik batang swap per jam, 24 jam terakhir.
*
* SVG inline, tanpa library grafik. Chart.js atau ApexCharts akan menambah
* 60–200 KB JavaScript untuk 24 buah persegi panjang — dan keduanya butuh kerja
* tambahan justru pada bagian yang paling saya pedulikan di sini: aksesibilitas
* dan pewarnaan yang mengikuti tema.
*
* Grafik adalah gambar, dan gambar tidak bisa dibaca pembaca layar. Jadi data
* yang sama juga tersedia sebagai tabel sungguhan di dalam <figure>, terlihat
* hanya oleh teknologi bantu.
*/
var SwapChart_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "SwapChart",
	__ssrInlineRender: true,
	props: { hourly: {} },
	setup(__props) {
		const props = __props;
		const max = computed(() => Math.max(1, ...props.hourly.map((h) => h.count)));
		const total = computed(() => props.hourly.reduce((sum, h) => sum + h.count, 0));
		const peak = computed(() => props.hourly.reduce((a, b) => b.count > a.count ? b : a, props.hourly[0]));
		/**
		* Judulnya menyebut jam mulai yang sebenarnya, bukan "24 jam terakhir".
		*
		* Grafik ini berisi 24 bucket JAM PENUH, jadi ia mulai dari puncak jam 23 jam
		* lalu — antara 23 dan 24 jam data. Kartu KPI di atas memakai rolling 24 jam
		* yang persis. Keduanya benar untuk keperluannya masing-masing, tapi totalnya
		* akan berbeda beberapa swap, dan angka yang berbeda tanpa penjelasan terbaca
		* sebagai bug. Menyebutkan rentangnya membuat selisih itu masuk akal.
		*/
		const rangeLabel = computed(() => {
			const first = props.hourly[0];
			return first ? `sejak pukul ${wibHourLabel(first.hourStart)}.00 WIB` : "";
		});
		const axisTop = computed(() => {
			const m = max.value;
			const step = m <= 10 ? 2 : m <= 50 ? 10 : m <= 200 ? 25 : 100;
			return Math.ceil(m / step) * step;
		});
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<figure${ssrRenderAttrs(mergeProps({ class: "space-y-3" }, _attrs))}><figcaption class="flex flex-wrap items-baseline justify-between gap-2"><span class="text-sm font-medium">Swap berhasil per jam · ${ssrInterpolate(unref(rangeLabel))}</span><span class="text-xs text-muted">${ssrInterpolate(("formatNumber" in _ctx ? _ctx.formatNumber : unref(formatNumber))(unref(total)))} swap pada rentang ini · puncak ${ssrInterpolate(unref(peak).count)} pukul ${ssrInterpolate(("wibHourLabel" in _ctx ? _ctx.wibHourLabel : unref(wibHourLabel))(unref(peak).hourStart))}.00 </span></figcaption><div class="relative"><div class="pointer-events-none absolute inset-0 flex flex-col justify-between"><!--[-->`);
			ssrRenderList([
				unref(axisTop),
				Math.round(unref(axisTop) / 2),
				0
			], (tick) => {
				_push(`<div class="flex items-center gap-2"><span class="w-6 shrink-0 text-right text-[10px] text-faint tabular-nums">${ssrInterpolate(tick)}</span><span class="h-px flex-1 bg-border"></span></div>`);
			});
			_push(`<!--]--></div><div class="relative flex h-40 items-end gap-1 pl-8"><!--[-->`);
			ssrRenderList(__props.hourly, (bucket) => {
				_push(`<div class="group relative flex flex-1 items-end justify-center" style="${ssrRenderStyle({ height: "100%" })}"><div class="${ssrRenderClass([bucket.count === 0 ? "bg-border" : "", "w-full rounded-t-[3px] bg-accent/75 transition-colors group-hover:bg-accent"])}" style="${ssrRenderStyle({ height: `${Math.max(bucket.count === 0 ? 1.5 : 3, bucket.count / unref(axisTop) * 100)}%` })}"></div><div class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-lg group-hover:block" aria-hidden="true"><span class="font-medium">${ssrInterpolate(bucket.count)}</span> swap · ${ssrInterpolate(("wibHourLabel" in _ctx ? _ctx.wibHourLabel : unref(wibHourLabel))(bucket.hourStart))}.00 </div></div>`);
			});
			_push(`<!--]--></div></div><div class="flex gap-1 pl-8" aria-hidden="true"><!--[-->`);
			ssrRenderList(__props.hourly, (bucket, i) => {
				_push(`<span class="flex-1 text-center text-[10px] text-faint tabular-nums">${ssrInterpolate(i % 3 === 0 ? ("wibHourLabel" in _ctx ? _ctx.wibHourLabel : unref(wibHourLabel))(bucket.hourStart) : "")}</span>`);
			});
			_push(`<!--]--></div><table class="sr-only"><caption> Jumlah swap berhasil per jam selama 24 jam terakhir, waktu WIB </caption><thead><tr><th scope="col">Jam (WIB)</th><th scope="col">Jumlah swap</th></tr></thead><tbody><!--[-->`);
			ssrRenderList(__props.hourly, (bucket) => {
				_push(`<tr><th scope="row">${ssrInterpolate(("wibHourLabel" in _ctx ? _ctx.wibHourLabel : unref(wibHourLabel))(bucket.hourStart))}.00</th><td>${ssrInterpolate(bucket.count)}</td></tr>`);
			});
			_push(`<!--]--></tbody></table></figure>`);
		};
	}
});
//#endregion
//#region app/components/SwapChart.vue
var _sfc_setup$1 = SwapChart_vue_vue_type_script_setup_true_lang_default.setup;
SwapChart_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/SwapChart.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var SwapChart_default = Object.assign(SwapChart_vue_vue_type_script_setup_true_lang_default, { __name: "SwapChart" });
//#endregion
//#region app/pages/cabinets/[code].vue?vue&type=script&setup=true&lang.ts
var _code__vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "[code]",
	__ssrInlineRender: true,
	async setup(__props) {
		let __temp, __restore;
		const route = useRoute$1();
		const code = computed(() => String(route.params.code ?? ""));
		const { data, status, error, refresh } = ([__temp, __restore] = withAsyncContext(() => useFetch(() => `/api/cabinets/${code.value}`, "$MEk-m_Nylx")), __temp = await __temp, __restore(), __temp);
		const cabinet = computed(() => data.value?.data ?? null);
		const failure = computed(() => error.value ? describeApiError(error.value) : null);
		const isFirstLoad = computed(() => status.value === "pending" && !data.value);
		useHead$1({ title: () => cabinet.value ? `${cabinet.value.code} · ECGO Ops` : "Cabinet · ECGO Ops" });
		/**
		* Kapan data slot tidak boleh dipercaya sebagai keadaan saat ini.
		*
		* Ditampilkan, bukan disembunyikan — teknisi butuh kondisi terakhir yang
		* diketahui sebelum cabinet putus. Tapi ditampilkan dengan jujur: mengirim rider
		* ke cabinet yang "FULL" tiga jam lalu adalah perjalanan sia-sia.
		*/
		const staleness = computed(() => {
			const c = cabinet.value;
			if (!c) return null;
			if (c.lastHeartbeatAt === null) return {
				title: "Cabinet ini belum pernah mengirim heartbeat",
				body: "Kemungkinan baru dipasang dan belum terhubung. State slot di bawah adalah nilai awal, bukan pembacaan dari perangkat."
			};
			if (c.status === "OFFLINE") return {
				title: "Cabinet sedang offline",
				body: "State slot di bawah adalah kondisi terakhir yang diketahui sebelum koneksi terputus. Kondisi sebenarnya sekarang bisa berbeda."
			};
			if (c.isStale) return {
				title: "Cabinet melaporkan diri online, tetapi sudah lama tidak terdengar",
				body: "Statusnya masih ONLINE sementara heartbeat-nya tertinggal. Perlakukan pembacaan di bawah sebagai data lama sampai heartbeat berikutnya masuk."
			};
			return null;
		});
		const attempts = computed(() => cabinet.value ? cabinet.value.swaps24h + cabinet.value.failed24h : 0);
		const stats = computed(() => {
			const c = cabinet.value;
			if (!c) return [];
			return [
				{
					label: "Swap berhasil 24 jam",
					value: formatNumber(c.swaps24h),
					hint: "rolling 24 jam"
				},
				{
					label: "Gagal 24 jam",
					value: formatNumber(c.failed24h),
					hint: attempts.value ? `${(c.failed24h / attempts.value * 100).toFixed(1)}% dari percobaan` : "belum ada percobaan",
					tone: c.failed24h > 0 ? "warn" : void 0
				},
				{
					label: "Slot siap ditukar",
					value: `${c.slots.filter((s) => s.state === "FULL").length}/${c.slotCount}`,
					hint: `${c.slots.filter((s) => s.batteryId !== null).length} slot terisi`
				},
				{
					label: "Terpasang sejak",
					value: formatDate(c.installedAt),
					hint: c.branchCity
				}
			];
		});
		const SWAP_STATUS = {
			SUCCESS: "Berhasil",
			FAILED: "Gagal"
		};
		return (_ctx, _push, _parent, _attrs) => {
			const _component_NuxtLink = NuxtLink;
			const _component_StateMessage = StateMessage_default;
			const _component_StatusBadge = StatusBadge_default;
			const _component_TimeAgo = TimeAgo_default;
			const _component_SlotGrid = SlotGrid_default;
			const _component_SwapChart = SwapChart_default;
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-5" }, _attrs))}>`);
			_push(ssrRenderComponent(_component_NuxtLink, {
				to: "/cabinets",
				class: "inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"${_scopeId}><path stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7"${_scopeId}></path></svg> Semua cabinet `);
					else return [(openBlock(), createBlock("svg", {
						class: "size-4",
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						"stroke-width": "2",
						"aria-hidden": "true"
					}, [createVNode("path", {
						"stroke-linecap": "round",
						"stroke-linejoin": "round",
						d: "m15 5-7 7 7 7"
					})])), createTextVNode(" Semua cabinet ")];
				}),
				_: 1
			}, _parent));
			if (unref(failure)) {
				_push(`<div class="card">`);
				if (unref(failure).code === "NOT_FOUND") _push(ssrRenderComponent(_component_StateMessage, {
					title: "Cabinet tidak ditemukan",
					description: `Tidak ada cabinet dengan kode ${unref(code)}. Mungkin sudah dinonaktifkan, atau kodenya salah ketik.`,
					"action-label": "Kembali ke daftar cabinet",
					onAction: ($event) => ("navigateTo" in _ctx ? _ctx.navigateTo : unref(navigateTo))("/cabinets")
				}, null, _parent));
				else _push(ssrRenderComponent(_component_StateMessage, {
					tone: "danger",
					title: "Gagal memuat detail cabinet",
					description: unref(failure).message,
					"action-label": "Coba lagi",
					onAction: ($event) => unref(refresh)()
				}, null, _parent));
				_push(`</div>`);
			} else if (unref(isFirstLoad)) {
				_push(`<div class="space-y-5" aria-hidden="true"><div class="h-9 w-56 rounded-lg shimmer"></div><div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><!--[-->`);
				ssrRenderList(4, (i) => {
					_push(`<div class="h-24 rounded-card shimmer"></div>`);
				});
				_push(`<!--]--></div><div class="h-72 rounded-card shimmer"></div><div class="h-64 rounded-card shimmer"></div></div>`);
			} else if (unref(cabinet)) {
				_push(`<!--[--><div class="flex flex-wrap items-start justify-between gap-4"><div><h1 class="font-mono text-2xl font-extrabold tracking-tight">${ssrInterpolate(unref(cabinet).code)}</h1><p class="mt-1 text-sm text-muted">${ssrInterpolate(unref(cabinet).branchName)} <span class="text-faint">· ${ssrInterpolate(unref(cabinet).branchCity)} · ${ssrInterpolate(unref(cabinet).branchCode)}</span></p></div><div class="flex flex-col items-end gap-1.5">`);
				_push(ssrRenderComponent(_component_StatusBadge, {
					status: unref(cabinet).status,
					"is-stale": unref(cabinet).isStale,
					"never-reported": unref(cabinet).lastHeartbeatAt === null
				}, null, _parent));
				_push(`<p class="text-xs text-muted"> Heartbeat `);
				_push(ssrRenderComponent(_component_TimeAgo, { iso: unref(cabinet).lastHeartbeatAt }, null, _parent));
				_push(`</p></div></div>`);
				if (unref(staleness)) _push(`<div class="flex gap-3 rounded-card border border-warn/30 bg-warn/10 px-4 py-3" role="status"><svg class="mt-0.5 size-5 shrink-0 text-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path stroke-linecap="round" d="M12 7.5v5M12 16h.01"></path></svg><div><p class="text-sm font-medium text-warn">${ssrInterpolate(unref(staleness).title)}</p><p class="mt-0.5 text-sm text-muted">${ssrInterpolate(unref(staleness).body)}</p></div></div>`);
				else _push(`<!---->`);
				_push(`<dl class="grid grid-cols-2 gap-3 lg:grid-cols-4"><!--[-->`);
				ssrRenderList(unref(stats), (stat) => {
					_push(`<div class="card px-4 py-3.5"><dt class="text-xs font-medium tracking-wide text-muted uppercase">${ssrInterpolate(stat.label)}</dt><dd class="${ssrRenderClass([stat.tone === "warn" ? "text-warn" : "text-text", "mt-1 text-2xl font-extrabold tabular-nums"])}">${ssrInterpolate(stat.value)}</dd><dd class="mt-0.5 text-xs text-faint">${ssrInterpolate(stat.hint)}</dd></div>`);
				});
				_push(`<!--]--></dl><section class="card p-4 sm:p-5"><div class="mb-4 flex items-baseline justify-between gap-3"><h2 class="text-sm font-medium">Slot baterai</h2><p class="text-xs text-muted"> Diperbarui `);
				_push(ssrRenderComponent(_component_TimeAgo, { iso: unref(cabinet).slots[0]?.updatedAt ?? null }, null, _parent));
				_push(`</p></div>`);
				_push(ssrRenderComponent(_component_SlotGrid, {
					slots: unref(cabinet).slots,
					stale: Boolean(unref(staleness))
				}, null, _parent));
				_push(`</section><section class="card p-4 sm:p-5">`);
				_push(ssrRenderComponent(_component_SwapChart, { hourly: unref(cabinet).hourly }, null, _parent));
				_push(`</section><section class="card overflow-hidden"><h2 class="border-b border-border px-4 py-3.5 text-sm font-medium"> 20 swap terakhir </h2>`);
				if (unref(cabinet).recentSwaps.length === 0) _push(ssrRenderComponent(_component_StateMessage, {
					title: "Belum ada transaksi swap",
					description: "Cabinet ini belum pernah melayani penukaran baterai."
				}, null, _parent));
				else {
					_push(`<div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b border-border text-xs tracking-wide text-muted uppercase"><tr><th scope="col" class="px-4 py-2.5 font-medium">Waktu</th><th scope="col" class="px-4 py-2.5 font-medium">Slot</th><th scope="col" class="px-4 py-2.5 font-medium">Rider</th><th scope="col" class="px-4 py-2.5 font-medium">SOC</th><th scope="col" class="px-4 py-2.5 font-medium">Durasi</th><th scope="col" class="px-4 py-2.5 font-medium">Status</th></tr></thead><tbody class="divide-y divide-border"><!--[-->`);
					ssrRenderList(unref(cabinet).recentSwaps, (swap) => {
						_push(`<tr class="hover:bg-surface-2"><td class="px-4 py-2.5 whitespace-nowrap"${ssrRenderAttr("title", ("formatFull" in _ctx ? _ctx.formatFull : unref(formatFull))(swap.occurredAt))}>${ssrInterpolate(("formatDateTime" in _ctx ? _ctx.formatDateTime : unref(formatDateTime))(swap.occurredAt))}</td><td class="px-4 py-2.5 font-mono text-xs">#${ssrInterpolate(String(swap.slotNo).padStart(2, "0"))}</td><td class="px-4 py-2.5 font-mono text-xs text-muted">${ssrInterpolate(swap.riderRef)}</td><td class="px-4 py-2.5 tabular-nums"><span class="text-muted">${ssrInterpolate(swap.socIn)}%</span><span class="mx-1 text-faint">→</span><span class="font-medium">${ssrInterpolate(swap.socOut)}%</span></td><td class="px-4 py-2.5 text-muted tabular-nums">${ssrInterpolate(("formatDurationSeconds" in _ctx ? _ctx.formatDurationSeconds : unref(formatDurationSeconds))(swap.durationS))}</td><td class="px-4 py-2.5"><span class="${ssrRenderClass([swap.status === "SUCCESS" ? "border-ok/30 bg-ok/10 text-ok" : "border-danger/30 bg-danger/10 text-danger", "rounded-full border px-2 py-0.5 text-xs font-medium"])}">${ssrInterpolate(SWAP_STATUS[swap.status])}</span></td></tr>`);
					});
					_push(`<!--]--></tbody></table></div>`);
				}
				_push(`</section><!--]-->`);
			} else _push(`<!---->`);
			_push(`</div>`);
		};
	}
});
//#endregion
//#region app/pages/cabinets/[code].vue
var _sfc_setup = _code__vue_vue_type_script_setup_true_lang_default.setup;
_code__vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/cabinets/[code].vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var _code__default = _code__vue_vue_type_script_setup_true_lang_default;

export { _code__default as default };
//# sourceMappingURL=_code_-BUS3LwVp.mjs.map
