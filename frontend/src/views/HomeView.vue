<template>
  <div class="home">
    <CesiumMap />
  </div>
</template>

<script setup lang="ts">
import CesiumMap from '../components/CesiumMap.vue'
</script>

<style scoped>
.home {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  padding: 0;
}
</style> 