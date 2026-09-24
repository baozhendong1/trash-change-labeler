<script setup lang="ts">
import { PhArrowCounterClockwise as ArrowCounterClockwise, PhArrowClockwise as ArrowClockwise, PhCrop as Crop, PhEraser as Eraser, PhHand as Hand, PhPaintBrush as PaintBrush, PhPolygon as Polygon, PhTrash as Trash } from '@phosphor-icons/vue'
import type { ToolMode } from '../types'

defineProps<{ mode: ToolMode }>()
const emit = defineEmits<{ mode: [value: ToolMode]; undo: []; redo: []; clear: [] }>()
const tools = [
  { mode: 'brush' as const, label: '画笔 B', icon: PaintBrush },
  { mode: 'eraser' as const, label: '橡皮 E', icon: Eraser },
  { mode: 'polygon' as const, label: '多边形 P', icon: Polygon },
  { mode: 'crop' as const, label: '裁切框 C', icon: Crop },
  { mode: 'pan' as const, label: '平移 H', icon: Hand },
]
</script>

<template>
  <aside class="tool-rail" aria-label="标注工具">
    <button v-for="tool in tools" :key="tool.mode" :title="tool.label" class="tool-button"
      :class="{ 'tool-button--active': mode === tool.mode }" @click="emit('mode', tool.mode)">
      <component :is="tool.icon" :size="19" />
    </button>
    <span class="separator" />
    <button title="撤销 Ctrl+Z" class="tool-button" @click="emit('undo')"><ArrowCounterClockwise :size="19" /></button>
    <button title="重做 Ctrl+Y" class="tool-button" @click="emit('redo')"><ArrowClockwise :size="19" /></button>
    <span class="spacer" />
    <button title="清空掩膜" class="tool-button tool-button--danger" @click="emit('clear')"><Trash :size="19" /></button>
  </aside>
</template>

<style scoped>
.tool-rail { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 7px; border-right: 1px solid #27303b; background: #111720; }
.tool-button { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid transparent; background: transparent; color: #7f8b9a; cursor: pointer; }
.tool-button:hover { border-color: #394554; background: #1b232e; color: #e4eaf0; }
.tool-button--active { border-color: #42e8c7; background: #15312d; color: #42e8c7; }
.tool-button--danger:hover { border-color: #6b3037; background: #2b191d; color: #ff727d; }
.separator { width: 24px; border-top: 1px solid #2d3641; margin: 3px 0; }
.spacer { flex: 1; }
</style>
