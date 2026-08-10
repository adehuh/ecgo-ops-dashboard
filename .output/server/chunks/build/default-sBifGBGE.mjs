import { u as useRoute$1, a as useHead$1, d as useNuxtApp } from '../virtual/entry.mjs';
import { N as NuxtLink } from './nuxt-link-UghHcseA.mjs';
import { a as useRequestEvent } from './ssr-Deiv8cWh.mjs';
import { defineComponent, mergeProps, withCtx, createVNode, createTextVNode, toDisplayString, unref, computed, ref, customRef, useSSRContext } from 'vue';
import { x as klona, y as getRequestHeader, z as isEqual, A as setCookie, B as getCookie, C as deleteCookie } from '../nitro/nitro.mjs';
import { p as publicAssetsURL } from '../routes/renderer.mjs';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderAttr, ssrRenderList, ssrInterpolate, ssrRenderSlot } from 'vue/server-renderer';
import 'nostics';
import 'nostics/formatters/ansi';
import 'vue-router';
import 'unhead/utils';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'unhead/server';
import 'unhead/legacy';
import 'unhead/plugins';
import 'vue-bundle-renderer/runtime';
import 'devalue';

function endIndex(str, min, len) {
	const index = str.indexOf(";", min);
	return index === -1 ? len : index;
}
function eqIndex(str, min, max) {
	const index = str.indexOf("=", min);
	return index < max ? index : -1;
}
function valueSlice(str, min, max) {
	if (min === max) return "";
	let start = min;
	let end = max;
	do {
		const code = str.charCodeAt(start);
		if (code !== 32 && code !== 9) break;
	} while (++start < end);
	while (end > start) {
		const code = str.charCodeAt(end - 1);
		if (code !== 32 && code !== 9) break;
		end--;
	}
	return str.slice(start, end);
}
const NullObject = /* @__PURE__ */ (() => {
	const C = function() {};
	C.prototype = Object.create(null);
	return C;
})();
function parse(str, options) {
	const obj = new NullObject();
	const len = str.length;
	if (len < 2) return obj;
	const dec = options?.decode || decode;
	const allowMultiple = options?.allowMultiple || false;
	let index = 0;
	do {
		const eqIdx = eqIndex(str, index, len);
		if (eqIdx === -1) break;
		const endIdx = endIndex(str, index, len);
		if (eqIdx > endIdx) {
			index = str.lastIndexOf(";", eqIdx - 1) + 1;
			continue;
		}
		const key = valueSlice(str, index, eqIdx);
		if (options?.filter && !options.filter(key)) {
			index = endIdx + 1;
			continue;
		}
		const val = dec(valueSlice(str, eqIdx + 1, endIdx));
		if (allowMultiple) {
			const existing = obj[key];
			if (existing === void 0) obj[key] = val;
			else if (Array.isArray(existing)) existing.push(val);
			else obj[key] = [existing, val];
		} else if (obj[key] === void 0) obj[key] = val;
		index = endIdx + 1;
	} while (index < len);
	return obj;
}
function decode(str) {
	if (!str.includes("%")) return str;
	try {
		return decodeURIComponent(str);
	} catch {
		return str;
	}
}

//#region node_modules/nuxt/dist/app/composables/cookie.js
function parseCookieValue(value) {
	if (value === "undefined") return;
	try {
		const parsed = JSON.parse(value);
		if (typeof parsed === "number" && String(parsed) !== value) return value;
		return parsed;
	} catch {
		return value;
	}
}
var CookieDefaults = {
	path: "/",
	watch: true,
	decode: (val) => val ? parseCookieValue(decodeURIComponent(val)) : val,
	encode: (val) => {
		if (typeof val !== "string" || val === "undefined") return encodeURIComponent(JSON.stringify(val));
		try {
			if (typeof JSON.parse(val) !== "string") return encodeURIComponent(JSON.stringify(val));
		} catch {}
		return encodeURIComponent(val);
	},
	refresh: false
};
function useCookie(name, _opts) {
	const opts = {
		...CookieDefaults,
		..._opts
	};
	opts.filter ??= (key) => key === name;
	const cookies = readRawCookies(opts) || {};
	let delay;
	if (opts.maxAge !== void 0) delay = opts.maxAge * 1e3;
	else if (opts.expires) delay = opts.expires.getTime() - Date.now();
	const cookie = cookieServerRef(name, klona(delay !== void 0 && delay <= 0 ? void 0 : cookies[name] ?? opts.default?.()));
	{
		const nuxtApp = useNuxtApp();
		const writeFinalCookieValue = () => {
			const valueIsSame = isEqual(cookie.value, cookies[name]);
			if (opts.readonly || valueIsSame && !opts.refresh) return;
			nuxtApp._cookiesChanged ||= {};
			if (valueIsSame && opts.refresh && !nuxtApp._cookiesChanged[name]) return;
			nuxtApp._cookies ||= {};
			if (name in nuxtApp._cookies) {
				if (isEqual(cookie.value, nuxtApp._cookies[name])) return;
			}
			nuxtApp._cookies[name] = cookie.value;
			const encoded = cookie.value === null || cookie.value === void 0 ? void 0 : opts.encode(cookie.value);
			writeServerCookie(useRequestEvent(nuxtApp), name, encoded, opts);
		};
		const unhook = nuxtApp.hooks.hookOnce("app:rendered", writeFinalCookieValue);
		nuxtApp.hooks.hookOnce("app:error", () => {
			unhook();
			return writeFinalCookieValue();
		});
	}
	return cookie;
}
function readRawCookies(opts = {}) {
	return parse(getRequestHeader(useRequestEvent(), "cookie") || "", opts);
}
var identityEncode = (val) => val;
function toSerializeOptions(opts) {
	const { encode: _encode, decode: _decode, ...rest } = opts;
	return {
		...rest,
		encode: identityEncode
	};
}
function writeServerCookie(event, name, value, opts = {}) {
	if (event) {
		const serializeOpts = toSerializeOptions(opts);
		if (value !== void 0) return setCookie(event, name, value, serializeOpts);
		if (getCookie(event, name) !== void 0) return deleteCookie(event, name, serializeOpts);
	}
}
/**
* Custom ref that tracks explicit cookie writes on the server.
*
* This is required for the `refresh` option to ensure the cookie is
* re-written on SSR even when the value remains unchanged.
*/
function cookieServerRef(name, value) {
	const internalRef = ref(value);
	const nuxtApp = useNuxtApp();
	return customRef((track, trigger) => {
		return {
			get() {
				track();
				return internalRef.value;
			},
			set(newValue) {
				nuxtApp._cookiesChanged ||= {};
				nuxtApp._cookiesChanged[name] = true;
				internalRef.value = newValue;
				trigger();
			}
		};
	});
}
//#endregion
//#region app/composables/useTheme.ts
function useTheme() {
	const cookie = useCookie("ecgo-theme", {
		default: () => "dark",
		maxAge: 31536e3,
		sameSite: "lax"
	});
	const theme = computed(() => cookie.value === "light" ? "light" : "dark");
	useHead$1({ htmlAttrs: { class: computed(() => theme.value === "dark" ? "dark" : "") } });
	function toggle() {
		cookie.value = theme.value === "dark" ? "light" : "dark";
	}
	return {
		theme,
		toggle
	};
}
//#endregion
//#region \0virtual:public?%2Fbrand%2Fecgo-logo-white.png
var _virtual_public__2Fbrand_2Fecgo_logo_white_default = publicAssetsURL("/brand/ecgo-logo-white.png");
//#endregion
//#region \0virtual:public?%2Fbrand%2Fecgo-logo.png
var _virtual_public__2Fbrand_2Fecgo_logo_default = publicAssetsURL("/brand/ecgo-logo.png");
//#endregion
//#region app/layouts/default.vue?vue&type=script&setup=true&lang.ts
var default_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "default",
	__ssrInlineRender: true,
	setup(__props) {
		const { theme} = useTheme();
		const route = useRoute$1();
		const nav = [{
			label: "Cabinet",
			to: "/cabinets"
		}, {
			label: "Geofence",
			to: "/geofence"
		}];
		const isActive = (to) => route.path === to || route.path.startsWith(`${to}/`);
		return (_ctx, _push, _parent, _attrs) => {
			const _component_NuxtLink = NuxtLink;
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-dvh bg-bg text-text" }, _attrs))}><a href="#main" class="skip-link">Lompat ke konten utama</a><header class="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70"><div class="mx-auto flex h-16 max-w-[88rem] items-center gap-4 px-4 sm:px-6">`);
			_push(ssrRenderComponent(_component_NuxtLink, {
				to: "/cabinets",
				class: "flex shrink-0 items-center gap-2.5",
				"aria-label": "ECGO Ops — beranda"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`<img${ssrRenderAttr("src", _virtual_public__2Fbrand_2Fecgo_logo_white_default)} alt="" class="hidden h-7 w-auto dark:block" width="254" height="74"${_scopeId}><img${ssrRenderAttr("src", _virtual_public__2Fbrand_2Fecgo_logo_default)} alt="" class="h-7 w-auto dark:hidden" width="254" height="74"${_scopeId}><span class="sr-only"${_scopeId}>ECGO</span><span class="hidden rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase sm:inline"${_scopeId}> Ops </span>`);
					else return [
						createVNode("img", {
							src: _virtual_public__2Fbrand_2Fecgo_logo_white_default,
							alt: "",
							class: "hidden h-7 w-auto dark:block",
							width: "254",
							height: "74"
						}),
						createVNode("img", {
							src: _virtual_public__2Fbrand_2Fecgo_logo_default,
							alt: "",
							class: "h-7 w-auto dark:hidden",
							width: "254",
							height: "74"
						}),
						createVNode("span", { class: "sr-only" }, "ECGO"),
						createVNode("span", { class: "hidden rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase sm:inline" }, " Ops ")
					];
				}),
				_: 1
			}, _parent));
			_push(`<nav aria-label="Navigasi utama" class="ml-2 flex items-center gap-1"><!--[-->`);
			ssrRenderList(nav, (item) => {
				_push(ssrRenderComponent(_component_NuxtLink, {
					key: item.to,
					to: item.to,
					class: ["rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2", isActive(item.to) ? "bg-surface-2 text-text" : "text-muted"],
					"aria-current": isActive(item.to) ? "page" : void 0
				}, {
					default: withCtx((_, _push, _parent, _scopeId) => {
						if (_push) _push(`${ssrInterpolate(item.label)}`);
						else return [createTextVNode(toDisplayString(item.label), 1)];
					}),
					_: 2
				}, _parent));
			});
			_push(`<!--]--></nav><div class="ml-auto flex items-center gap-2"><button type="button" class="grid size-11 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-text"${ssrRenderAttr("aria-label", unref(theme) === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap")}>`);
			if (unref(theme) === "dark") _push(`<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path stroke-linecap="round" d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4"></path></svg>`);
			else _push(`<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"></path></svg>`);
			_push(`</button></div></div></header><main id="main" class="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 sm:py-8">`);
			ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
			_push(`</main><footer class="mx-auto max-w-[88rem] px-4 pb-10 text-xs text-faint sm:px-6"> Dashboard operasional internal · data ditampilkan dalam zona waktu WIB (Asia/Jakarta) </footer></div>`);
		};
	}
});
//#endregion
//#region app/layouts/default.vue
var _sfc_setup = default_vue_vue_type_script_setup_true_lang_default.setup;
default_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("layouts/default.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var default_default = default_vue_vue_type_script_setup_true_lang_default;

export { default_default as default };
//# sourceMappingURL=default-sBifGBGE.mjs.map
