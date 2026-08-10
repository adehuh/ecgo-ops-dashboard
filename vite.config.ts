import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const API_PORT = Number(process.env.API_PORT ?? 3001)

export default defineConfig({
  plugins: [vue(), tailwindcss()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Skema Zod dan tipe dipakai bersama client dan server. Satu definisi,
      // dua konsumen — supaya keduanya tidak bisa menyimpang.
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },

  server: {
    port: 3000,
    // Client dan API berjalan di port berbeda saat pengembangan, tapi browser
    // hanya pernah melihat satu origin. Ini bukan kenyamanan: cookie sesi kita
    // SameSite=Lax dan HttpOnly, dan same-origin membuatnya terkirim apa adanya
    // tanpa perlu CORS atau `credentials: 'include'` di setiap pemanggilan.
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: false,
      },
    },
  },

  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    // Peta sumber tetap dibuat: dashboard internal, dan bisa men-debug stack
    // trace produksi jauh lebih berharga daripada menyembunyikan kodenya.
    sourcemap: true,
  },
})
