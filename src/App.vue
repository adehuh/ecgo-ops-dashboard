<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/components/AppShell.vue'

const route = useRoute()

/**
 * Halaman login dan 404 berdiri sendiri tanpa kerangka dashboard: tidak ada
 * navigasi ke tempat yang belum boleh dilihat, dan tidak ada tombol keluar untuk
 * sesi yang belum ada. Ini menggantikan sistem layout Nuxt dengan satu
 * percabangan yang bisa dibaca sekali lihat.
 */
const useShell = computed(() => route.meta.public !== true)
</script>

<template>
  <AppShell v-if="useShell">
    <RouterView />
  </AppShell>
  <RouterView v-else />
</template>
