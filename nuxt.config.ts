import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    // Server-only. Nothing here is serialised into the client payload — only the
    // `public` block below is. Keeping DATABASE_URL out of `public` is the whole
    // reason the credential never reaches the browser bundle.
    // Read from DATABASE_URL so the app and the CLI scripts share one variable;
    // NUXT_DATABASE_URL still overrides it at runtime in production.
    databaseUrl: process.env.DATABASE_URL ?? '',
    staleMinutes: process.env.ECGO_STALE_MINUTES ?? '10',

    public: {
      appName: 'ECGO Ops',
      // Display timezone for the operations team. Storage is always UTC.
      displayTimeZone: 'Asia/Jakarta',
    },
  },

  app: {
    head: {
      // The `dark` class is applied by useTheme() from a cookie, so it is correct
      // in the first byte of SSR HTML instead of flashing on hydration.
      htmlAttrs: { lang: 'id' },
      title: 'ECGO Ops · Battery Swap Monitoring',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Dashboard operasional internal ECGO untuk memantau cabinet battery swap.',
        },
        { name: 'theme-color', content: '#0B1210' },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/brand/favicon.png' }],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // run explicitly via `npm run typecheck`, keeps dev server fast
  },

  nitro: {
    // The dashboard is internal tooling: never let a proxy or CDN cache an
    // operational reading. Freshness is the product here.
    routeRules: {
      '/api/**': { headers: { 'cache-control': 'no-store' } },
    },
  },
})
