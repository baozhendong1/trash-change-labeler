<script setup lang="ts">
import { PhCheckCircle as CheckCircle, PhCircle as Circle, PhWarning as Warning } from '@phosphor-icons/vue'
import type { SamplePair } from '../types'

defineProps<{ samples: SamplePair[]; selectedId: string }>()
const emit = defineEmits<{ select: [id: string] }>()

function state(sample: SamplePair) {
  if (!sample.t1 || !sample.t2) return 'incomplete'
  return sample.annotated || sample.mask ? 'done' : 'pending'
}
</script>

<template>
  <nav class="sample-list" aria-label="样本列表">
    <button v-for="sample in samples" :key="sample.id" class="sample-row"
      :class="{ 'sample-row--active': sample.id === selectedId }" @click="emit('select', sample.id)">
      <CheckCircle v-if="state(sample) === 'done'" :size="17" weight="fill" class="state state--done" />
      <Warning v-else-if="state(sample) === 'incomplete'" :size="17" weight="fill" class="state state--warn" />
      <Circle v-else :size="17" class="state" />
      <span class="sample-row__text">
        <strong>{{ sample.name }}</strong>
        <small>{{ sample.t1?.width ?? '—' }} × {{ sample.t1?.height ?? '—' }}</small>
      </span>
    </button>
    <div v-if="!samples.length" class="list-empty">导入目录后，样本将按文件名自动配对。</div>
  </nav>
</template>

<style scoped>
.sample-list { display: grid; align-content: start; gap: 2px; overflow: auto; padding: 8px; }
.sample-row { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 8px; align-items: center; width: 100%; padding: 9px 10px; border: 1px solid transparent; background: transparent; color: #8c99aa; text-align: left; cursor: pointer; }
.sample-row:hover { background: #151b24; color: #dfe6ee; }
.sample-row--active { border-color: #384658; background: #19212c; color: #fff; }
.sample-row__text { display: grid; min-width: 0; gap: 3px; }
.sample-row__text strong { overflow: hidden; font: 600 12px/1.2 "IBM Plex Sans", sans-serif; text-overflow: ellipsis; white-space: nowrap; }
.sample-row__text small { color: #657183; font: 10px/1 "IBM Plex Mono", monospace; }
.state { color: #566171; }
.state--done { color: #42e8c7; }
.state--warn { color: #f3b44b; }
.list-empty { padding: 28px 16px; color: #667284; font-size: 12px; line-height: 1.7; text-align: center; }
</style>
