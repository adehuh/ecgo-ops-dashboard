import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Alias yang sama dengan vite.config.ts, supaya berkas di `src/` yang diuji
  // memakai jalur import yang persis sama dengan saat dibundel.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },

  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
    // Contract tests hit a real Postgres and are skipped automatically when it is
    // not reachable, so the geofence suite alone still runs on a bare checkout.
    testTimeout: 20_000,
  },
})
