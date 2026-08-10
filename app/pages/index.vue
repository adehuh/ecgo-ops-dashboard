<script setup lang="ts">
// The dashboard has no distinct home screen: the cabinet list *is* the landing
// view for ops. Redirect on the server so there is no client-side flash.
await navigateTo('/cabinets', { redirectCode: 302, replace: true })
</script>

<template>
  <div />
</template>
