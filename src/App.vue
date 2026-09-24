<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef, useTemplateRef } from 'vue'
import { PhFloppyDisk as FloppyDisk, PhFolderOpen as FolderOpen, PhPlus as Plus, PhSkipBack as SkipBack, PhSkipForward as SkipForward, PhTrash as Trash, PhUploadSimple as UploadSimple } from '@phosphor-icons/vue'
import AnnotationCanvas from './components/AnnotationCanvas.vue'
import InspectorPanel from './components/InspectorPanel.vue'
import SampleList from './components/SampleList.vue'
import ToolRail from './components/ToolRail.vue'
import { useDataset } from './composables/useDataset'
import type { ToolMode } from './types'
import { downloadCanvas } from './utils/image'
import { validateMaskDimensions } from './utils/mask'
import { cropOutputName, trainingPaths, type CropRegion, type DatasetSplit } from './utils/crop'
import { saveTrainingTriplet, type DirectoryHandleLike } from './utils/storage'

const { samples, selected, selectedId, error, addTemporalFiles, createNewSample, removeSample, select, updateSample } = useDataset()
const canvas = useTemplateRef<InstanceType<typeof AnnotationCanvas>>('canvas')
const t1Input = useTemplateRef<HTMLInputElement>('t1Input')
const t2Input = useTemplateRef<HTMLInputElement>('t2Input')
const mode = shallowRef<ToolMode>('brush')
const viewMode = shallowRef<'t1' | 't2' | 'blend'>('blend')
const brushSize = shallowRef(28)
const opacity = shallowRef(0.48)
const blend = shallowRef(0.5)
const cropSize = shallowRef(512)
const cropRegion = shallowRef<CropRegion>({ x: 0, y: 0, size: 512 })
const split = shallowRef<DatasetSplit>('train')
const outputDirectory = shallowRef<DirectoryHandleLike | null>(null)
const saveMessage = shallowRef('尚未选择结果目录')
const stats = reactive({ changed: 0, coverage: 0 })
const completed = computed(() => samples.value.filter((sample) => sample.annotated || sample.mask).length)
const progress = computed(() => samples.value.length ? completed.value / samples.value.length : 0)
const dimensionError = computed(() => selected.value?.t1 && selected.value?.t2 ? validateMaskDimensions(selected.value.t1, selected.value.t2) ?? '' : '')
const selectedIndex = computed(() => samples.value.findIndex((sample) => sample.id === selectedId.value))

function ingestTemporal(role: 't1' | 't2', event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) void addTemporalFiles(role, input.files)
  input.value = ''
}
function newSample() {
  const name = window.prompt('输入样本名称（可选）', `sample_${String(samples.value.length + 1).padStart(3, '0')}`)
  if (name === null) return
  createNewSample(name)
}
function deleteCurrentSample() {
  if (!selected.value) return
  if (window.confirm(`删除样本“${selected.value.name}”？当前样本的本地草稿也会移除。`)) removeSample()
}
function maskChanged(payload: { dataUrl: string; changed: number; coverage: number }) {
  stats.changed = payload.changed; stats.coverage = payload.coverage
  if (selectedId.value) updateSample(selectedId.value, { draft: payload.dataUrl, annotated: payload.changed > 0 })
}
function selectSample(id: string) { select(id); stats.changed = 0; stats.coverage = 0 }
function navigate(offset: number) {
  if (!samples.value.length) return
  const next = Math.max(0, Math.min(samples.value.length - 1, selectedIndex.value + offset))
  selectSample(samples.value[next].id)
}
async function chooseOutputDirectory() {
  const picker = (window as typeof window & { showDirectoryPicker?: () => Promise<DirectoryHandleLike> }).showDirectoryPicker
  if (!picker) { saveMessage.value = '当前浏览器不支持目录写入；保存时将下载三个 PNG 文件'; return }
  try {
    outputDirectory.value = await picker.call(window)
    saveMessage.value = `结果目录：${outputDirectory.value.name}/${split.value}/{t1,t2,masks}`
  } catch (reason) {
    if ((reason as DOMException).name !== 'AbortError') saveMessage.value = '无法访问所选目录'
  }
}
function fallbackDownload(canvases: { t1: HTMLCanvasElement; t2: HTMLCanvasElement; mask: HTMLCanvasElement }, name: string) {
  const paths = trainingPaths(split.value, name)
  downloadCanvas(canvases.t1, paths.t1.replaceAll('/', '__'))
  downloadCanvas(canvases.t2, paths.t2.replaceAll('/', '__'))
  downloadCanvas(canvases.mask, paths.mask.replaceAll('/', '__'))
}
async function saveTrainingCrop() {
  const output = canvas.value?.exportCrop()
  if (!output || !selected.value) { saveMessage.value = '请先分别上传完整的 T1 和 T2 图像'; return }
  const name = cropOutputName(selected.value.name, output.crop.x, output.crop.y, output.outputSize)
  if (!outputDirectory.value) {
    const picker = (window as typeof window & { showDirectoryPicker?: () => Promise<DirectoryHandleLike> }).showDirectoryPicker
    if (picker) await chooseOutputDirectory()
  }
  if (outputDirectory.value) {
    const paths = await saveTrainingTriplet(outputDirectory.value, split.value, name, output)
    saveMessage.value = `已保存：${outputDirectory.value.name}/${paths.t1}、${paths.t2}、${paths.mask}`
  } else {
    fallbackDownload(output, name)
    saveMessage.value = `已下载训练样本：${split.value}/{t1,t2,masks}`
  }
}
function clearMask() { if (window.confirm('清空当前样本的全部标注？该操作可以撤销。')) canvas.value?.clearMask() }
function keydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveTrainingCrop(); return }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); canvas.value?.undo(); return }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); canvas.value?.redo(); return }
  if ((event.target as HTMLElement)?.matches('input, textarea')) return
  const shortcuts: Record<string, ToolMode> = { b: 'brush', e: 'eraser', p: 'polygon', c: 'crop', h: 'pan' }
  if (shortcuts[event.key.toLowerCase()]) mode.value = shortcuts[event.key.toLowerCase()]
  if (event.key === '[') brushSize.value = Math.max(2, brushSize.value - 2)
  if (event.key === ']') brushSize.value = Math.min(160, brushSize.value + 2)
  if (event.key === 'ArrowLeft') navigate(-1)
  if (event.key === 'ArrowRight') navigate(1)
}
onMounted(() => window.addEventListener('keydown', keydown))
onBeforeUnmount(() => window.removeEventListener('keydown', keydown))
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand__signal" /><div><strong>变化标注台</strong><small>TRASH CHANGE LABELER</small></div></div>
      <div class="topbar__actions">
        <input ref="t1Input" class="file-input" type="file" accept="image/*" multiple @change="ingestTemporal('t1', $event)" />
        <input ref="t2Input" class="file-input" type="file" accept="image/*" multiple @change="ingestTemporal('t2', $event)" />
        <button class="button button--t1" :disabled="!selected" @click="t1Input?.click()"><UploadSimple :size="16" />上传 T1</button>
        <button class="button button--t2" :disabled="!selected" @click="t2Input?.click()"><UploadSimple :size="16" />上传 T2</button>
        <button class="button button--quiet" @click="chooseOutputDirectory"><FolderOpen :size="16" />选择结果目录</button>
        <button class="button button--accent" :disabled="!selected?.t1 || !selected?.t2 || !!dimensionError" @click="saveTrainingCrop"><FloppyDisk :size="16" />保存训练裁片</button>
      </div>
    </header>
    <section class="workspace">
      <aside class="dataset-panel">
        <div class="panel-title"><span>样本队列</span><strong>{{ completed }}/{{ samples.length }}</strong></div>
        <div class="sample-actions"><button title="新建样本" @click="newSample"><Plus :size="14" />新建样本</button><button title="删除当前样本" :disabled="!selected" @click="deleteCurrentSample"><Trash :size="14" />删除</button></div>
        <div class="progress"><span :style="{ width: `${progress * 100}%` }" /></div>
        <SampleList :samples="samples" :selected-id="selectedId" @select="selectSample" />
        <div class="dataset-nav"><button :disabled="selectedIndex <= 0" @click="navigate(-1)"><SkipBack :size="15" />上一个</button><button :disabled="selectedIndex < 0 || selectedIndex >= samples.length - 1" @click="navigate(1)">下一个<SkipForward :size="15" /></button></div>
      </aside>
      <ToolRail :mode="mode" @mode="mode = $event" @undo="canvas?.undo()" @redo="canvas?.redo()" @clear="clearMask" />
      <section class="editor">
        <div class="editor-toolbar">
          <div class="segmented" aria-label="影像视图"><button v-for="item in [{ id: 't1', label: 'T1' }, { id: 'blend', label: '叠加' }, { id: 't2', label: 'T2' }]" :key="item.id" :class="{ active: viewMode === item.id }" @click="viewMode = item.id as typeof viewMode">{{ item.label }}</button></div>
          <label v-if="viewMode === 'blend'" class="range-control"><span>时相混合</span><input v-model.number="blend" type="range" min="0" max="1" step="0.05" /></label>
          <label v-if="mode === 'brush' || mode === 'eraser'" class="range-control"><span>笔刷 {{ brushSize }} px</span><input v-model.number="brushSize" type="range" min="2" max="160" step="2" /></label>
          <label class="range-control"><span>标注透明度</span><input v-model.number="opacity" type="range" min="0.1" max="0.9" step="0.05" /></label>
          <label class="select-control"><span>裁切尺寸</span><select v-model.number="cropSize"><option v-for="size in [224, 256, 384, 512, 768, 1024]" :key="size" :value="size">{{ size }} × {{ size }}</option></select></label>
          <label class="select-control"><span>数据集</span><select v-model="split" @change="saveMessage = outputDirectory ? `结果目录：${outputDirectory.name}/${split}/{t1,t2,masks}` : saveMessage"><option value="train">train</option><option value="val">val</option><option value="test">test</option></select></label>
          <button class="fit-button" @click="canvas?.resetView()">适应窗口</button>
        </div>
        <div class="canvas-frame" :class="{ 'canvas-frame--invalid': dimensionError }">
          <AnnotationCanvas ref="canvas" :primary="selected?.t1" :secondary="selected?.t2" :initial-mask="selected?.mask" :draft="selected?.draft" :mode="mode" :brush-size="brushSize" :opacity="opacity" :view-mode="viewMode" :blend="blend" :crop-size="cropSize" @changed="maskChanged" @crop-changed="cropRegion = $event" />
        </div>
        <div class="statusbar"><span>{{ saveMessage }}</span><span v-if="selected?.t1">裁切：x={{ cropRegion.x }}, y={{ cropRegion.y }} · 输出 {{ cropSize }} × {{ cropSize }}</span><span>{{ mode === 'crop' ? '拖动裁切框 · C 裁切模式' : '滚轮缩放 · H 平移 · [ ] 调整笔刷' }}</span></div>
      </section>
      <InspectorPanel :sample="selected" :error="error" :changed-pixels="stats.changed" :coverage="stats.coverage" :dimension-error="dimensionError" />
    </section>
  </main>
</template>

<style scoped>
.app-shell { display: grid; grid-template-rows: 58px minmax(0, 1fr); min-height: 100dvh; background: #0b0f15; color: #dce3eb; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 14px 0 18px; border-bottom: 1px solid #29323d; background: #121821; }
.brand { display: flex; align-items: center; gap: 10px; }.brand__signal { width: 5px; height: 30px; background: #42e8c7; box-shadow: 0 0 18px rgb(66 232 199 / .45); }.brand div { display: grid; gap: 3px; }.brand strong { font: 650 15px/1 "IBM Plex Sans", sans-serif; letter-spacing: .04em; }.brand small { color: #687587; font: 8px/1 "IBM Plex Mono", monospace; letter-spacing: .18em; }
.topbar__actions { display: flex; gap: 7px; }.file-input { display: none; }.button { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 12px; border: 1px solid; font: 600 11px/1 "IBM Plex Sans", sans-serif; cursor: pointer; }.button--quiet { border-color: #35404d; background: #19212b; color: #b8c2ce; }.button--quiet:hover { border-color: #536174; color: #fff; }.button--t1 { border-color: #54759f; background: #1d2b3c; color: #a9cdf7; }.button--t2 { border-color: #6e7350; background: #292c1d; color: #dce29f; }.button--accent { border-color: #42e8c7; background: #42e8c7; color: #071410; }.button:disabled { opacity: .35; cursor: not-allowed; }
.workspace { display: grid; grid-template-columns: 220px 52px minmax(420px, 1fr) 230px; min-height: 0; }.dataset-panel { display: grid; grid-template-rows: auto auto 3px minmax(0, 1fr) auto; min-height: 0; border-right: 1px solid #27303b; background: #10161e; }.panel-title { display: flex; justify-content: space-between; padding: 14px 13px 11px; color: #7d899a; font: 700 10px/1 "IBM Plex Mono", monospace; letter-spacing: .1em; }.panel-title strong { color: #42e8c7; }.progress { background: #222b36; }.progress span { display: block; height: 100%; background: #42e8c7; transition: width .2s; }.dataset-nav { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #27303b; }.dataset-nav button { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 40px; border: 0; background: transparent; color: #8793a3; font-size: 10px; cursor: pointer; }.dataset-nav button + button { border-left: 1px solid #27303b; }.dataset-nav button:hover:not(:disabled) { background: #19212b; color: #fff; }.dataset-nav button:disabled { opacity: .25; }
.sample-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0 8px 8px; }.sample-actions button { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 29px; border: 1px solid #35404d; background: #19212b; color: #aeb9c6; font-size: 10px; cursor: pointer; }.sample-actions button:hover:not(:disabled) { border-color: #42e8c7; color: #42e8c7; }.sample-actions button:disabled { opacity: .3; cursor: not-allowed; }
.editor { display: grid; grid-template-rows: 49px minmax(0, 1fr) 28px; min-width: 0; min-height: 0; }.editor-toolbar { display: flex; align-items: center; gap: 14px; padding: 7px 12px; border-bottom: 1px solid #27303b; background: #111720; overflow-x: auto; }.segmented { display: flex; border: 1px solid #35404c; }.segmented button { min-width: 48px; height: 29px; border: 0; border-right: 1px solid #35404c; background: #151c25; color: #758193; font: 600 10px/1 "IBM Plex Mono", monospace; cursor: pointer; }.segmented button:last-child { border-right: 0; }.segmented button.active { background: #26323f; color: #fff; }.range-control,.select-control { display: flex; align-items: center; gap: 8px; white-space: nowrap; }.range-control span,.select-control span { color: #8290a1; font-size: 10px; }.range-control input { width: 78px; accent-color: #42e8c7; }.select-control select { height: 29px; border: 1px solid #35404c; background: #151c25; color: #b7c2ce; font: 10px/1 "IBM Plex Mono", monospace; }.fit-button { margin-left: auto; min-width: 64px; height: 29px; border: 1px solid #35404c; background: transparent; color: #8996a6; font-size: 10px; cursor: pointer; }.canvas-frame { min-height: 0; overflow: hidden; }.canvas-frame--invalid { outline: 2px solid #d99e3f; outline-offset: -2px; }.statusbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 11px; border-top: 1px solid #27303b; background: #111720; color: #657183; font: 9px/1 "IBM Plex Mono", monospace; }
@media (max-width: 1100px) { .workspace { grid-template-columns: 190px 52px minmax(400px, 1fr); } .workspace > :last-child { display: none; } } @media (max-width: 760px) { .workspace { grid-template-columns: 48px minmax(320px, 1fr); } .dataset-panel { display: none; } .topbar__actions .button--quiet:first-of-type { display: none; } .button { padding: 0 9px; } }
</style>
