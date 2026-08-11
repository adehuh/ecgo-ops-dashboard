import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // Aplikasi harus sudah berjalan (`npm run dev`). Cypress sengaja tidak
    // menyalakannya sendiri: menyembunyikan proses yang dikelola orang lain di
    // dalam test runner membuat kegagalan sulit dibaca — "gagal karena apa,
    // aplikasinya atau test-nya?".
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: false,
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
  },
})
