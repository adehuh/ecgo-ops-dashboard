import { d as useNuxtApp, $ as $fetch$1$1 } from '../virtual/entry.mjs';

//#region node_modules/nuxt/dist/app/composables/ssr.js
var $fetch$1 = $fetch$1$1;
/** @since 3.0.0 */
function useRequestEvent(nuxtApp) {
	nuxtApp ||= useNuxtApp();
	return nuxtApp.ssrContext?.event;
}
/** @since 3.2.0 */
function useRequestFetch() {
	return useRequestEvent()?.$fetch || $fetch$1;
}

export { useRequestEvent as a, useRequestFetch as u };
//# sourceMappingURL=ssr-Deiv8cWh.mjs.map
