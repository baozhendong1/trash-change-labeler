<script setup lang="ts">
import type { ImageAsset } from '../types'
defineProps<{ title: string; image?: ImageAsset }>()
</script>

<template>
  <section class="image-card">
    <div class="image-card__head"><span>{{ title }}</span><small v-if="image">{{ image.width }} × {{ image.height }}</small></div>
    <div class="image-card__body">
      <img v-if="image" :src="image.url" :alt="title" />
      <span v-else>未加载</span>
    </div>
  </section>
</template>

<style scoped>
.image-card { min-width: 0; overflow: hidden; border: 1px solid #273450; border-radius: 14px; background: #0c1424; }
.image-card__head { display: flex; justify-content: space-between; padding: 10px 12px; color: #e6edf8; font-size: 13px; font-weight: 650; }
.image-card__head small { color: #72839e; font-weight: 500; }
.image-card__body { display: grid; place-items: center; min-height: 150px; color: #60728f; background: #080d18; }
.image-card img { display: block; width: 100%; max-height: 190px; object-fit: contain; }
</style>
