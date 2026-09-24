<script setup lang="ts">
import type { ImageAsset, SamplePair } from '../types'

defineProps<{
  sample: SamplePair | null
  error: string
  changedPixels: number
  coverage: number
  dimensionError: string
}>()

function label(asset?: ImageAsset) { return asset ? `${asset.width} × ${asset.height}` : '缺失' }
</script>

<template>
  <aside class="inspector">
    <section class="panel-block">
      <div class="eyebrow">样本质检</div>
      <h2>{{ sample?.name ?? '未选择样本' }}</h2>
      <dl class="facts">
        <div><dt>T1 影像</dt><dd>{{ label(sample?.t1) }}</dd></div>
        <div><dt>T2 影像</dt><dd>{{ label(sample?.t2) }}</dd></div>
        <div><dt>已有掩膜</dt><dd>{{ sample?.mask ? '已载入' : '无' }}</dd></div>
        <div><dt>变化像素</dt><dd>{{ changedPixels.toLocaleString() }}</dd></div>
        <div><dt>变化占比</dt><dd>{{ (coverage * 100).toFixed(2) }}%</dd></div>
      </dl>
      <p v-if="error || dimensionError" class="warning">{{ error || dimensionError }}</p>
      <p v-else-if="sample?.t1 && sample?.t2" class="healthy">尺寸一致，可以标注</p>
      <p v-else class="muted">当前样本缺少一个时相</p>
    </section>

    <section class="panel-block guide">
      <div class="eyebrow">标签规范</div>
      <div class="legend"><span class="legend__swatch" /> <strong>1 · 垃圾变化</strong></div>
      <p>涂抹新增或清理的垃圾区域。未变化区域保持黑色背景。</p>
      <p>掩膜导出为原图尺寸 PNG，像素值只有 0 和 255。</p>
    </section>

    <section class="panel-block shortcuts">
      <div class="eyebrow">快捷键</div>
      <dl><div><dt>B</dt><dd>画笔</dd></div><div><dt>E</dt><dd>橡皮</dd></div><div><dt>P</dt><dd>多边形</dd></div><div><dt>C</dt><dd>裁切框</dd></div><div><dt>H</dt><dd>平移</dd></div><div><dt>Ctrl Z</dt><dd>撤销</dd></div><div><dt>Ctrl S</dt><dd>保存裁片</dd></div></dl>
    </section>
  </aside>
</template>

<style scoped>
.inspector { display: grid; align-content: start; overflow: auto; background: #10151d; border-left: 1px solid #27303b; }
.panel-block { padding: 18px; border-bottom: 1px solid #252e39; }
.eyebrow { margin-bottom: 9px; color: #697688; font: 700 10px/1 "IBM Plex Mono", monospace; letter-spacing: .13em; text-transform: uppercase; }
h2 { overflow: hidden; margin: 0 0 18px; color: #f2f5f8; font: 650 16px/1.25 "IBM Plex Sans", sans-serif; text-overflow: ellipsis; white-space: nowrap; }
.facts, .shortcuts dl { display: grid; gap: 0; margin: 0; }
.facts div, .shortcuts dl div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid #202832; }
dt { color: #7e8a9a; font-size: 11px; }
dd { margin: 0; color: #cbd3dd; font: 11px/1 "IBM Plex Mono", monospace; }
.warning, .healthy, .muted { margin: 14px 0 0; padding: 9px 10px; border-left: 2px solid; font-size: 11px; line-height: 1.5; }
.warning { border-color: #f3b44b; background: #2a2113; color: #e9c787; }
.healthy { border-color: #42e8c7; background: #102620; color: #83dbc9; }
.muted { border-color: #566171; background: #171d25; color: #7d8999; }
.legend { display: flex; align-items: center; gap: 9px; color: #e6ebf1; font-size: 12px; }
.legend__swatch { width: 15px; height: 15px; background: #ff4e5a; box-shadow: 0 0 0 3px rgb(255 78 90 / .16); }
.guide p { margin: 12px 0 0; color: #7e8a99; font-size: 11px; line-height: 1.65; }
.shortcuts dt { padding: 3px 5px; border: 1px solid #3a4654; background: #171e27; color: #b9c4d0; font: 9px/1 "IBM Plex Mono", monospace; }
</style>
