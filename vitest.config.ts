import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
    // Contract tests hit a real Postgres and are skipped automatically when it is
    // not reachable, so the geofence suite alone still runs on a bare checkout.
    testTimeout: 20_000,
  },
})
