import { c as appDiagnostics, s as sanitizeTag, d as useNuxtApp, e as asyncDataDefaults, f as fetchDefaults, p as prodReporters, g as docsBase, $ as $fetch$1$1, h as createError$1 } from '../virtual/entry.mjs';
import { u as useRequestFetch } from './ssr-Deiv8cWh.mjs';
import { defineProdDiagnostics } from 'nostics';
import { defineComponent, mergeProps, computed, unref, ref, useSSRContext, createElementBlock, shallowRef, getCurrentInstance, provide, cloneVNode, h, isRef, toValue, onServerPrefetch, reactive, nextTick, toRef, queuePostFlushCb } from 'vue';
import { isPlainObject } from '@vue/shared';
import { ssrRenderAttrs, ssrRenderClass, ssrInterpolate } from 'vue/server-renderer';
import { fnv1a64Base36 } from 'fnv1a-64';
import { identify } from 'object-identity';

//#region app/components/StateMessage.vue?vue&type=script&setup=true&lang.ts
var StateMessage_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "StateMessage",
	__ssrInlineRender: true,
	props: {
		tone: {},
		title: {},
		description: {},
		actionLabel: {}
	},
	emits: ["action"],
	setup(__props) {
		/**
		* Satu komponen untuk keadaan kosong dan keadaan error.
		*
		* Keduanya sengaja tidak dipisah: bentuknya identik dan menyatukannya memastikan
		* keduanya benar-benar dibangun, bukan hanya yang happy path plus satu spinner.
		* Yang membedakan hanya nada warna dan ada tidaknya tombol aksi.
		*/
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center" }, _attrs))}><div class="${ssrRenderClass([__props.tone === "danger" ? "border-danger/30 bg-danger/10 text-danger" : "border-border bg-surface-2 text-faint", "grid size-12 place-items-center rounded-full border"])}">`);
			if (__props.tone === "danger") _push(`<svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v5m0 3.5h.01"></path><path stroke-linejoin="round" d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path></svg>`);
			else _push(`<svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path stroke-linecap="round" d="m20 20-3.5-3.5"></path></svg>`);
			_push(`</div><p class="text-base font-medium text-text">${ssrInterpolate(__props.title)}</p>`);
			if (__props.description) _push(`<p class="max-w-md text-sm text-muted">${ssrInterpolate(__props.description)}</p>`);
			else _push(`<!---->`);
			if (__props.actionLabel) _push(`<button type="button" class="mt-1 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-border-strong">${ssrInterpolate(__props.actionLabel)}</button>`);
			else _push(`<!---->`);
			_push(`</div>`);
		};
	}
});
//#endregion
//#region app/components/StateMessage.vue
var _sfc_setup$2 = StateMessage_vue_vue_type_script_setup_true_lang_default.setup;
StateMessage_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/StateMessage.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var StateMessage_default = Object.assign(StateMessage_vue_vue_type_script_setup_true_lang_default, { __name: "StateMessage" });
//#endregion
//#region app/components/StatusBadge.vue?vue&type=script&setup=true&lang.ts
/**
* Warna tidak pernah menjadi satu-satunya pembawa informasi (WCAG 1.4.1): tiap
* badge punya titik BERBENTUK berbeda dan label teks, jadi tetap terbaca oleh
* mata yang tidak membedakan merah–hijau maupun di cetakan hitam putih.
*/
var StatusBadge_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "StatusBadge",
	__ssrInlineRender: true,
	props: {
		status: {},
		isStale: { type: Boolean },
		neverReported: { type: Boolean }
	},
	setup(__props) {
		const props = __props;
		const tone = computed(() => {
			if (props.status === "MAINTENANCE") return "maintenance";
			if (props.status === "OFFLINE") return "offline";
			return props.isStale || props.neverReported ? "suspect" : "online";
		});
		const LABELS = {
			online: "Online",
			suspect: "Online",
			offline: "Offline",
			maintenance: "Perawatan"
		};
		const CLASSES = {
			online: "border-ok/30 bg-ok/10 text-ok",
			suspect: "border-warn/35 bg-warn/10 text-warn",
			offline: "border-danger/30 bg-danger/10 text-danger",
			maintenance: "border-info/30 bg-info/10 text-info"
		};
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<span${ssrRenderAttrs(mergeProps({ class: ["inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", CLASSES[unref(tone)]] }, _attrs))}><svg class="size-2 shrink-0" viewBox="0 0 8 8" aria-hidden="true">`);
			if (unref(tone) === "online") _push(`<circle cx="4" cy="4" r="4" fill="currentColor"></circle>`);
			else if (unref(tone) === "suspect") _push(`<path d="M4 0 8 7H0z" fill="currentColor"></path>`);
			else if (unref(tone) === "maintenance") _push(`<rect x="0" y="0" width="8" height="8" rx="1.5" fill="currentColor"></rect>`);
			else _push(`<circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="2"></circle>`);
			_push(`</svg> ${ssrInterpolate(LABELS[unref(tone)])} `);
			if (unref(tone) === "suspect") _push(`<span class="opacity-80"> · ${ssrInterpolate(__props.neverReported ? "belum lapor" : "basi")}</span>`);
			else _push(`<!---->`);
			_push(`</span>`);
		};
	}
});
//#endregion
//#region app/components/StatusBadge.vue
var _sfc_setup$1 = StatusBadge_vue_vue_type_script_setup_true_lang_default.setup;
StatusBadge_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/StatusBadge.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var StatusBadge_default = Object.assign(StatusBadge_vue_vue_type_script_setup_true_lang_default, { __name: "StatusBadge" });
//#endregion
//#region app/composables/useNow.ts
var now = ref(null);
function useNow() {
	return now;
}
//#endregion
//#region app/utils/format.ts
/**
* Pemformat untuk tampilan.
*
* Seluruh waktu disimpan UTC dan ditampilkan WIB. Zona waktunya ditulis
* eksplisit di setiap pemanggilan Intl, tidak pernah mengandalkan zona waktu
* mesin: dashboard ini dibuka dari laptop tim ops, dan laptop yang zonanya
* salah setting tidak boleh menggeser jam kejadian operasional.
*/
var TZ = "Asia/Jakarta";
var numberFormatter = new Intl.NumberFormat("id-ID");
var dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
	timeZone: TZ,
	day: "2-digit",
	month: "short",
	hour: "2-digit",
	minute: "2-digit"
});
var dateFormatter = new Intl.DateTimeFormat("id-ID", {
	timeZone: TZ,
	day: "2-digit",
	month: "short",
	year: "numeric"
});
var fullFormatter = new Intl.DateTimeFormat("id-ID", {
	timeZone: TZ,
	dateStyle: "full",
	timeStyle: "medium"
});
var formatNumber = (value) => numberFormatter.format(value);
var formatDateTime = (iso) => dateTimeFormatter.format(new Date(iso));
/** Tanggal saja, dengan tahun. Untuk hal seperti "terpasang sejak". */
var formatDate = (iso) => dateFormatter.format(new Date(iso));
/** Dipakai sebagai title/tooltip, jadi waktu persisnya selalu bisa diperiksa. */
var formatFull = (iso) => `${fullFormatter.format(new Date(iso))} WIB`;
/**
* Jarak waktu dalam bahasa manusia, dari `nowMs` yang dikirim pemanggil.
*
* "Sekarang" sengaja menjadi PARAMETER, bukan `Date.now()` di dalam fungsi.
* Kalau fungsi ini membaca jamnya sendiri, HTML hasil SSR ("3 menit lalu") akan
* berbeda dari render pertama di client beberapa ratus milidetik kemudian, dan
* Vue akan melaporkan hydration mismatch. Pemanggil yang mengendalikan jam bisa
* menahannya sampai komponen ter-mount. Lihat useNow().
*/
function formatRelative(iso, nowMs) {
	const diffMs = nowMs - new Date(iso).getTime();
	if (diffMs < 0) return "baru saja";
	const seconds = Math.floor(diffMs / 1e3);
	if (seconds < 45) return "baru saja";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} mnt lalu`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} jam lalu`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} hari lalu`;
	return `${Math.floor(days / 30)} bln lalu`;
}
/** Ubah string jam-dinding WIB dari API ("2026-08-10T07:00:00") menjadi "07". */
function wibHourLabel(hourStart) {
	return hourStart.slice(11, 13);
}
var formatDurationSeconds = (seconds) => seconds < 60 ? `${seconds} dtk` : `${Math.floor(seconds / 60)} mnt ${seconds % 60} dtk`;
//#endregion
//#region app/components/TimeAgo.vue?vue&type=script&setup=true&lang.ts
var TimeAgo_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "TimeAgo",
	__ssrInlineRender: true,
	props: {
		iso: {},
		emptyLabel: {}
	},
	setup(__props) {
		/**
		* Stempel waktu relatif yang aman untuk SSR.
		*
		* Sebelum mount, `useNow()` bernilai null dan komponen ini menampilkan waktu
		* absolut — sehingga HTML dari server dan render pertama di client identik.
		* Setelah mount ia berganti ke "3 mnt lalu" dan ikut berdetak. Waktu persisnya
		* selalu tersedia di atribut title.
		*/
		const props = __props;
		const now = useNow();
		const label = computed(() => {
			if (!props.iso) return props.emptyLabel ?? "Belum pernah";
			return now.value === null ? formatDateTime(props.iso) : formatRelative(props.iso, now.value);
		});
		return (_ctx, _push, _parent, _attrs) => {
			if (__props.iso) _push(`<time${ssrRenderAttrs(mergeProps({
				datetime: __props.iso,
				title: ("formatFull" in _ctx ? _ctx.formatFull : unref(formatFull))(__props.iso)
			}, _attrs))}>${ssrInterpolate(unref(label))}</time>`);
			else _push(`<span${ssrRenderAttrs(mergeProps({
				class: "text-faint italic",
				title: "Cabinet ini belum pernah mengirim heartbeat"
			}, _attrs))}>${ssrInterpolate(unref(label))}</span>`);
		};
	}
});
//#endregion
//#region app/components/TimeAgo.vue
var _sfc_setup = TimeAgo_vue_vue_type_script_setup_true_lang_default.setup;
TimeAgo_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/TimeAgo.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var TimeAgo_default = Object.assign(TimeAgo_vue_vue_type_script_setup_true_lang_default, { __name: "TimeAgo" });
//#endregion
//#region node_modules/nuxt/dist/app/utils/hash.js
/**
* Hash an arbitrary value into a short, stable string key.
*
* Values are serialized to a canonical, locale-independent representation
* (equal structures hash equally regardless of key order or runtime locale),
* then digested with a fast non-cryptographic hash. This is what `useFetch` and
* `useAsyncData` use internally to derive their cache keys, so it is safe to use
* for the same purpose in your own code.
*
* The digest is non-cryptographic and must not be used for integrity checks.
*
* @since 4.5.0
*/
function hashKey(value) {
	return fnv1a64Base36(identify(value));
}
//#endregion
//#region node_modules/nuxt/dist/compiler/runtime/index.js
/**
* Define a factory for a function that should be registered for automatic key injection.
* @since 4.2.0
* @param factory
*/
function defineKeyedFunctionFactory(factory) {
	const placeholder = function() {
		throw appDiagnostics.NUXT_E1007({ name: factory.name });
	};
	return Object.defineProperty(placeholder, "__nuxt_factory", {
		enumerable: false,
		get: () => factory.factory
	});
}
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/data.js
/**
* E3xxx
* Data fetching (useFetch / useAsyncData) runtime diagnostics.
*/
var dataDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/app/utils/debounce-tick.js
/**
* Debounce an async function so that repeated calls within the same tick are
* collapsed into a single call (plus a trailing call if arguments arrived
* while the debounced call was still pending).
*
* Adapted from https://github.com/unjs/perfect-debounce with the timeout
* replaced by Vue's post-flush callback queue.
*/
function debounceTick(fn, options = {}) {
	let leadingValue;
	let active = false;
	let resolveList = [];
	let currentPromise;
	let trailingArgs;
	const applyFn = (_this, args) => {
		const promise = _applyPromised(fn, _this, args);
		currentPromise = promise;
		promise.finally(() => {
			currentPromise = void 0;
			if (trailingArgs && !active) {
				const args = trailingArgs;
				trailingArgs = void 0;
				applyFn(_this, args);
			}
		});
		return promise;
	};
	return function(...args) {
		trailingArgs = args;
		if (currentPromise) return currentPromise;
		return new Promise((resolve) => {
			const shouldCallNow = options.leading && !active;
			if (!active) {
				active = true;
				queuePostFlushCb(() => {
					active = false;
					const flushArgs = trailingArgs ?? args;
					trailingArgs = void 0;
					const promise = options.leading ? leadingValue : applyFn(this, flushArgs);
					for (const _resolve of resolveList) _resolve(promise);
					resolveList = [];
				});
			}
			if (shouldCallNow) {
				leadingValue = applyFn(this, args);
				resolve(leadingValue);
			} else resolveList.push(resolve);
		});
	};
}
async function _applyPromised(fn, _this, args) {
	return await fn.apply(_this, args);
}
defineComponent({
	name: "ServerPlaceholder",
	render() {
		return createElementBlock("div");
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/components/client-only.js
var clientOnlySymbol = Symbol.for("nuxt:client-only");
defineComponent({
	name: "ClientOnly",
	inheritAttrs: false,
	props: [
		"fallback",
		"placeholder",
		"placeholderTag",
		"fallbackTag"
	],
	setup(props, { slots, attrs }) {
		const mounted = shallowRef(false);
		const vm = getCurrentInstance();
		if (vm) vm._nuxtClientOnly = true;
		provide(clientOnlySymbol, true);
		return () => {
			if (mounted.value) {
				const vnodes = slots.default?.();
				if (vnodes && vnodes.length === 1) return [cloneVNode(vnodes[0], attrs)];
				return vnodes;
			}
			const slot = slots.fallback || slots.placeholder;
			if (slot) return h(slot);
			const fallbackStr = props.fallback || props.placeholder || "";
			const fallbackTag = sanitizeTag(props.fallbackTag || props.placeholderTag, "span");
			return createElementBlock(fallbackTag, attrs, fallbackStr);
		};
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/composables/asyncData.js
var createUseAsyncData = defineKeyedFunctionFactory({
	name: "createUseAsyncData",
	factory(options = {}) {
		function useAsyncData(...args) {
			const autoKey = typeof args[args.length - 1] === "string" ? args.pop() : void 0;
			if (_isAutoKeyNeeded(args[0], args[1])) args.unshift(autoKey);
			let [_key, _handler, opts = {}] = args;
			const key = isRef(_key) || typeof _key === "function" ? computed(() => toValue(_key)) : { value: _key };
			if (!key.value || typeof key.value !== "string") throw dataDiagnostics.NUXT_E3008();
			if (typeof _handler !== "function") throw dataDiagnostics.NUXT_E3009();
			const shouldFactoryOptionsOverride = typeof options === "function";
			const nuxtApp = useNuxtApp();
			const factoryOptions = shouldFactoryOptionsOverride ? options(opts) : options;
			if (!shouldFactoryOptionsOverride) for (const key in factoryOptions) {
				if (factoryOptions[key] === void 0) continue;
				if (opts[key] !== void 0) continue;
				opts[key] = factoryOptions[key];
			}
			opts.server ??= true;
			opts.default ??= getDefault;
			opts.getCachedData ??= getDefaultCachedData;
			opts.lazy ??= false;
			opts.immediate ??= true;
			opts.deep ??= asyncDataDefaults.deep;
			opts.dedupe ??= "cancel";
			opts.enabled ??= true;
			if (shouldFactoryOptionsOverride) for (const key in factoryOptions) {
				if (factoryOptions[key] === void 0) continue;
				opts[key] = factoryOptions[key];
			}
			nuxtApp._asyncData[key.value];
			function createInitialFetch() {
				const initialFetchOptions = {
					cause: "initial",
					dedupe: opts.dedupe
				};
				const existing = nuxtApp._asyncData[key.value];
				if (!existing?._init) {
					initialFetchOptions.cachedData = opts.getCachedData(key.value, nuxtApp, { cause: "initial" });
					nuxtApp._asyncData[key.value] = buildAsyncData(nuxtApp, key.value, _handler, opts, initialFetchOptions.cachedData);
					nuxtApp._asyncData[key.value]._initialCachedData = initialFetchOptions.cachedData;
				} else if (nuxtApp._asyncDataPromises[key.value]) initialFetchOptions.cachedData = existing._initialCachedData;
				return () => nuxtApp._asyncData[key.value].execute(initialFetchOptions);
			}
			const initialFetch = createInitialFetch();
			const asyncData = nuxtApp._asyncData[key.value];
			asyncData._deps++;
			if (opts.server !== false && nuxtApp.payload.serverRendered && opts.immediate) {
				const promise = initialFetch();
				if (getCurrentInstance()) onServerPrefetch(() => promise);
				else nuxtApp.hook("app:created", async () => {
					await promise;
				});
			}
			const asyncReturn = {
				data: writableComputedRef(() => nuxtApp._asyncData[key.value]?.data),
				pending: writableComputedRef(() => nuxtApp._asyncData[key.value]?.pending),
				status: writableComputedRef(() => nuxtApp._asyncData[key.value]?.status),
				error: writableComputedRef(() => nuxtApp._asyncData[key.value]?.error),
				refresh: (...args) => {
					if (!nuxtApp._asyncData[key.value]?._init) return createInitialFetch()();
					return nuxtApp._asyncData[key.value].execute(...args);
				},
				execute: (...args) => asyncReturn.refresh(...args),
				clear: () => {
					const entry = nuxtApp._asyncData[key.value];
					if (entry?._abortController) try {
						entry._abortController.abort(new DOMException("AsyncData aborted by user.", "AbortError"));
					} finally {
						entry._abortController = void 0;
					}
					clearNuxtDataByKey(nuxtApp, key.value);
				}
			};
			const asyncDataPromise = Promise.resolve(nuxtApp._asyncDataPromises[key.value]).then(() => asyncReturn);
			Object.assign(asyncDataPromise, asyncReturn);
			Object.defineProperties(asyncDataPromise, {
				then: {
					enumerable: true,
					value: asyncDataPromise.then.bind(asyncDataPromise)
				},
				catch: {
					enumerable: true,
					value: asyncDataPromise.catch.bind(asyncDataPromise)
				},
				finally: {
					enumerable: true,
					value: asyncDataPromise.finally.bind(asyncDataPromise)
				}
			});
			return asyncDataPromise;
		}
		return useAsyncData;
	}
});
var useAsyncData = createUseAsyncData.__nuxt_factory();
createUseAsyncData.__nuxt_factory({
	lazy: true,
	_functionName: "useLazyAsyncData"
});
function writableComputedRef(getter) {
	return computed({
		get() {
			return getter()?.value;
		},
		set(value) {
			const ref = getter();
			if (ref) ref.value = value;
		}
	});
}
function _isAutoKeyNeeded(keyOrFetcher, fetcher) {
	if (typeof keyOrFetcher === "string") return false;
	if (typeof keyOrFetcher === "object" && keyOrFetcher !== null) return false;
	if (typeof keyOrFetcher === "function" && typeof fetcher === "function") return false;
	return true;
}
function clearNuxtDataByKey(nuxtApp, key) {
	delete nuxtApp.payload.data[key];
	delete nuxtApp.payload._errors[key];
	if (nuxtApp._asyncData[key]) {
		nuxtApp._asyncData[key].data.value = unref(nuxtApp._asyncData[key]._default());
		nuxtApp._asyncData[key].error.value = void 0;
		nuxtApp._asyncData[key].status.value = "idle";
		nuxtApp._asyncData[key]._initialCachedData = void 0;
	}
	delete nuxtApp._asyncDataPromises[key];
}
function pick(obj, keys) {
	const newObj = {};
	for (const key of keys) newObj[key] = obj[key];
	return newObj;
}
function buildAsyncData(nuxtApp, key, _handler, options, initialCachedData) {
	nuxtApp.payload._errors[key] ??= void 0;
	const hasCustomGetCachedData = options.getCachedData !== getDefaultCachedData;
	const handler = _handler ;
	const _ref = options.deep ? ref : shallowRef;
	const hasCachedData = initialCachedData !== void 0;
	const unsubRefreshAsyncData = nuxtApp.hook("app:data:refresh", async (keys) => {
		if (!keys || keys.includes(key)) await asyncData.execute({ cause: "refresh:hook" });
	});
	const asyncData = {
		data: _ref(hasCachedData ? initialCachedData : options.default()),
		pending: computed(() => asyncData.status.value === "pending"),
		error: toRef(nuxtApp.payload._errors, key),
		status: shallowRef("idle"),
		execute: (...args) => {
			const [_opts, newValue = void 0] = args;
			const opts = _opts && newValue === void 0 && typeof _opts === "object" ? _opts : {};
			if (nuxtApp._asyncDataPromises[key]) {
				if ((opts.dedupe ?? options.dedupe) === "defer") return nuxtApp._asyncDataPromises[key];
			}
			{
				const cachedData = "cachedData" in opts ? opts.cachedData : options.getCachedData(key, nuxtApp, { cause: opts.cause ?? "refresh:manual" });
				if (cachedData !== void 0) {
					nuxtApp.payload.data[key] = asyncData.data.value = cachedData;
					asyncData.error.value = void 0;
					asyncData.status.value = "success";
					return Promise.resolve(cachedData);
				}
			}
			if (toValue(options.enabled) === false) return Promise.resolve(asyncData.data.value);
			if (asyncData._abortController) asyncData._abortController.abort(new DOMException("AsyncData request cancelled by deduplication", "AbortError"));
			asyncData._abortController = new AbortController();
			asyncData.status.value = "pending";
			const cleanupController = new AbortController();
			const promise = new Promise((resolve, reject) => {
				try {
					const timeout = opts.timeout ?? options.timeout;
					const mergedSignal = mergeAbortSignals([asyncData._abortController?.signal, opts?.signal], cleanupController.signal, timeout);
					if (mergedSignal.aborted) {
						const reason = mergedSignal.reason;
						reject(reason instanceof Error ? reason : new DOMException(String(reason ?? "Aborted"), "AbortError"));
						return;
					}
					mergedSignal.addEventListener("abort", () => {
						const reason = mergedSignal.reason;
						reject(reason instanceof Error ? reason : new DOMException(String(reason ?? "Aborted"), "AbortError"));
					}, {
						once: true,
						signal: cleanupController.signal
					});
					return Promise.resolve(handler(nuxtApp, { signal: mergedSignal })).then(resolve, reject);
				} catch (err) {
					reject(err);
				}
			}).then(async (_result) => {
				if (nuxtApp._asyncDataPromises[key] !== promise) return;
				let result = _result;
				if (options.transform) result = await options.transform(_result);
				if (options.pick) result = pick(result, options.pick);
				nuxtApp.payload.data[key] = result;
				asyncData.data.value = result;
				asyncData.error.value = void 0;
				asyncData.status.value = "success";
			}).catch((error) => {
				if (nuxtApp._asyncDataPromises[key] !== promise) return nuxtApp._asyncDataPromises[key];
				if (asyncData._abortController?.signal.aborted) return nuxtApp._asyncDataPromises[key];
				if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
					asyncData.status.value = "idle";
					return nuxtApp._asyncDataPromises[key];
				}
				asyncData.error.value = createError$1(error);
				asyncData.data.value = unref(options.default());
				asyncData.status.value = "error";
			}).finally(() => {
				cleanupController.abort();
				if (nuxtApp._asyncDataPromises[key] === promise) delete nuxtApp._asyncDataPromises[key];
			});
			nuxtApp._asyncDataPromises[key] = promise;
			return nuxtApp._asyncDataPromises[key];
		},
		_execute: debounceTick((...args) => asyncData.execute(...args)),
		_default: options.default,
		_deps: 0,
		_init: true,
		_hash: void 0,
		_off: () => {
			unsubRefreshAsyncData();
			if (nuxtApp._asyncData[key]?._init) nuxtApp._asyncData[key]._init = false;
			if (nuxtApp._asyncDataPromises[key]) {
				asyncData._abortController?.abort(new DOMException("AsyncData request cancelled by unmount", "AbortError"));
				delete nuxtApp._asyncDataPromises[key];
				if (asyncData.status.value === "pending") asyncData.status.value = "idle";
			}
			if (!hasCustomGetCachedData) nextTick(() => {
				if (!nuxtApp._asyncData[key]?._init) {
					clearNuxtDataByKey(nuxtApp, key);
					asyncData.execute = () => Promise.resolve();
				}
			});
		}
	};
	return asyncData;
}
var getDefault = () => void 0;
var getDefaultCachedData = (key, nuxtApp, ctx) => {
	if (nuxtApp.isHydrating) return nuxtApp.payload.data[key];
	if (ctx.cause !== "refresh:manual" && ctx.cause !== "refresh:hook") return nuxtApp.static.data[key];
};
function mergeAbortSignals(signals, cleanupSignal, timeout) {
	const list = signals.filter((s) => !!s);
	if (typeof timeout === "number" && timeout >= 0) {
		const timeoutSignal = AbortSignal.timeout?.(timeout);
		if (timeoutSignal) list.push(timeoutSignal);
	}
	if (AbortSignal.any) return AbortSignal.any(list);
	const controller = new AbortController();
	for (const sig of list) if (sig.aborted) {
		const reason = sig.reason ?? new DOMException("Aborted", "AbortError");
		try {
			controller.abort(reason);
		} catch {
			controller.abort();
		}
		return controller.signal;
	}
	const onAbort = () => {
		const reason = list.find((s) => s.aborted)?.reason ?? new DOMException("Aborted", "AbortError");
		try {
			controller.abort(reason);
		} catch {
			controller.abort();
		}
	};
	for (const sig of list) sig.addEventListener?.("abort", onAbort, {
		once: true,
		signal: cleanupSignal
	});
	return controller.signal;
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/fetch.js
var $fetch$1 = $fetch$1$1;
var MAYBE_REF_OR_GETTER_OPTION_KEYS = [
	"method",
	"baseURL",
	"query",
	"params",
	"body",
	"headers"
];
function generateOptionSegments(opts) {
	const segments = [toValue(opts.method)?.toUpperCase() || "GET", toValue(opts.baseURL)];
	for (const _obj of [opts.query || opts.params]) {
		const obj = toValue(_obj);
		if (!obj) continue;
		const unwrapped = {};
		for (const [key, value] of Object.entries(obj)) unwrapped[toValue(key)] = toValue(value);
		segments.push(unwrapped);
	}
	if (opts.body) {
		const value = toValue(opts.body);
		if (!value) segments.push(hashKey(value));
		else if (value instanceof ArrayBuffer) segments.push(hashKey(Object.fromEntries([...new Uint8Array(value).entries()].map(([k, v]) => [k, v.toString()]))));
		else if (value instanceof FormData) {
			const entries = [];
			for (const entry of value.entries()) {
				const [key, val] = entry;
				entries.push([key, val instanceof File ? `${val.name}:${val.size}:${val.lastModified}` : val]);
			}
			segments.push(hashKey(entries));
		} else if (isPlainObject(value)) segments.push(hashKey(reactive(value)));
		else try {
			segments.push(hashKey(value));
		} catch {
			dataDiagnostics.NUXT_E3002({ cause: value });
		}
	}
	return segments;
}
/**
* A factory function to create a custom `useFetch` composable with pre-defined default options.
* @since 4.2.0
*/
var createUseFetch = defineKeyedFunctionFactory({
	name: "createUseFetch",
	factory(options = {}) {
		function useFetch(request, arg1, arg2) {
			const [opts = {}, autoKey] = typeof arg1 === "string" ? [{}, arg1] : [arg1, arg2];
			const factoryOptions = typeof options === "function" ? options(opts) : options;
			const { server, lazy, default: defaultFn, transform, pick, watch: watchSources, immediate, getCachedData, deep, dedupe, timeout, enabled, ...fetchOptions } = {
				...typeof options === "function" ? {} : factoryOptions,
				...opts,
				...typeof options === "function" ? factoryOptions : {}
			};
			const _request = computed(() => toValue(request));
			const key = computed(() => toValue(fetchOptions.key) || "$f" + hashKey([
				autoKey,
				typeof _request.value === "string" ? _request.value : "",
				...generateOptionSegments(fetchOptions)
			]));
			if (!fetchOptions.baseURL && typeof _request.value === "string" && _request.value[0] === "/" && _request.value[1] === "/") throw dataDiagnostics.NUXT_E3001({ url: _request.value });
			const _fetchOptions = reactive({
				...fetchDefaults,
				...fetchOptions,
				cache: typeof fetchOptions.cache === "boolean" ? void 0 : fetchOptions.cache
			});
			const _asyncDataOptions = {
				server,
				lazy,
				default: defaultFn,
				transform,
				pick,
				immediate,
				getCachedData,
				deep,
				dedupe,
				timeout,
				enabled,
				watch: watchSources === false ? [] : [...watchSources || [], _fetchOptions]
			};
			if (watchSources === false) _asyncDataOptions._keyTriggersExecute = false;
			return useAsyncData(key, (_, { signal }) => {
				let _$fetch = fetchOptions.$fetch || $fetch$1;
				if (!fetchOptions.$fetch) {
					if (typeof _request.value === "string" && _request.value[0] === "/" && (!toValue(fetchOptions.baseURL) || toValue(fetchOptions.baseURL)[0] === "/")) _$fetch = useRequestFetch();
				}
				const resolvedOptions = {
					signal,
					..._fetchOptions
				};
				for (const key of MAYBE_REF_OR_GETTER_OPTION_KEYS) if (typeof resolvedOptions[key] === "function") resolvedOptions[key] = toValue(resolvedOptions[key]);
				return _$fetch(_request.value, resolvedOptions);
			}, _asyncDataOptions);
		}
		return useFetch;
	}
});
var useFetch = createUseFetch.__nuxt_factory();
createUseFetch.__nuxt_factory({
	lazy: true,
	_functionName: "useLazyFetch"
});
//#endregion
//#region app/utils/apiError.ts
/**
* Ubah kegagalan `useFetch` menjadi sesuatu yang bisa ditampilkan.
*
* $fetch menaruh body respons di `error.data`, jadi amplop `{ error: { code,
* message } }` dari server bisa dibaca kembali di sini. Kalau permintaannya
* tidak pernah sampai (DNS mati, server belum hidup, browser offline), tidak ada
* body sama sekali — dan itu kasus yang berbeda: yang satu bug di sisi kita,
* yang satu lagi masalah jaringan, dan keduanya menuntut kalimat yang berbeda.
*/
function describeApiError(error) {
	const body = error?.data;
	if (body?.error?.message) return {
		message: body.error.message,
		code: body.error.code
	};
	return {
		message: "Tidak bisa menghubungi server. Pastikan `npm run dev` dan `docker compose up -d` sedang berjalan, lalu coba lagi.",
		code: "NETWORK"
	};
}

export { StateMessage_default as S, TimeAgo_default as T, formatDate as a, StatusBadge_default as b, formatFull as c, describeApiError as d, formatDateTime as e, formatNumber as f, formatDurationSeconds as g, useFetch as u, wibHourLabel as w };
//# sourceMappingURL=apiError-D1F1t0TF.mjs.map
