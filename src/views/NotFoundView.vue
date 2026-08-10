<script setup lang="ts">
/**
 * 404 di sisi client.
 *
 * Ditandai `public` di router supaya alamat yang salah ketik memberi halaman
 * "tidak ditemukan", bukan memantulkan orang ke layar login — memaksa masuk demi
 * memberitahu bahwa halamannya tidak ada adalah dua kebingungan sekaligus.
 */
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-bg px-4 text-center text-text">
    <div class="max-w-md space-y-4">
      <p class="font-mono text-5xl font-extrabold text-accent">404</p>
      <h1 class="text-xl font-extrabold tracking-tight">Halaman tidak ditemukan</h1>
      <p class="text-sm text-muted">
        Alamat yang kamu buka tidak ada di dashboard ini. Mungkin salah ketik, atau tautannya sudah
        usang.
      </p>
      <RouterLink
        to="/cabinets"
        class="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast"
      >
        Kembali ke daftar cabinet
      </RouterLink>
    </div>
  </div>
</template>
