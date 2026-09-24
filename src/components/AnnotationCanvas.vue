<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import type { ImageAsset, ToolMode } from '../types'
import { maskStats } from '../utils/mask'
import { clampCrop, cropCanvas, type CropRegion } from '../utils/crop'

const props = defineProps<{
  primary?: ImageAsset
  secondary?: ImageAsset
  initialMask?: ImageAsset
  draft?: string
  mode: ToolMode
  brushSize: number
  opacity: number
  viewMode: 't1' | 't2' | 'blend'
  blend: number
  cropSize: number
}>()
const emit = defineEmits<{
  changed: [payload: { dataUrl: string; changed: number; coverage: number }]
  ready: [value: { width: number; height: number }]
  cropChanged: [value: CropRegion]
}>()

const baseCanvas = useTemplateRef<HTMLCanvasElement>('baseCanvas')
const overlayCanvas = useTemplateRef<HTMLCanvasElement>('overlayCanvas')
const maskCanvas = document.createElement('canvas')
const zoom = shallowRef(1)
const panX = shallowRef(0)
const panY = shallowRef(0)
const drawing = shallowRef(false)
const panning = shallowRef(false)
const lastPoint = shallowRef<{ x: number; y: number } | null>(null)
const lastClient = shallowRef<{ x: number; y: number } | null>(null)
const polygon = shallowRef<{ x: number; y: number }[]>([])
const crop = shallowRef<CropRegion>({ x: 0, y: 0, size: 512 })
const movingCrop = shallowRef(false)
const cropOffset = shallowRef({ x: 0, y: 0 })
const history: ImageData[] = []
const future: ImageData[] = []
let primaryImage: HTMLImageElement | null = null
let secondaryImage: HTMLImageElement | null = null
let loadToken = 0

const transformStyle = computed(() => ({ transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})` }))
const cursor = computed(() => props.mode === 'pan' ? (panning.value ? 'grabbing' : 'grab') : 'crosshair')

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

function renderBase() {
  const canvas = baseCanvas.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (props.viewMode === 't1' && primaryImage) context.drawImage(primaryImage, 0, 0, canvas.width, canvas.height)
  if (props.viewMode === 't2' && secondaryImage) context.drawImage(secondaryImage, 0, 0, canvas.width, canvas.height)
  if (props.viewMode === 'blend') {
    if (primaryImage) context.drawImage(primaryImage, 0, 0, canvas.width, canvas.height)
    if (secondaryImage) {
      context.save()
      context.globalAlpha = props.blend
      context.drawImage(secondaryImage, 0, 0, canvas.width, canvas.height)
      context.restore()
    }
  }
}

function renderOverlay() {
  const overlay = overlayCanvas.value
  const context = overlay?.getContext('2d')
  const source = maskCanvas.getContext('2d')?.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
  if (!overlay || !context || !source) return
  const output = context.createImageData(overlay.width, overlay.height)
  for (let i = 0; i < source.data.length; i += 4) {
    const active = source.data[i] > 0 || source.data[i + 1] > 0 || source.data[i + 2] > 0
    output.data[i] = 255
    output.data[i + 1] = 78
    output.data[i + 2] = 90
    output.data[i + 3] = active ? Math.round(props.opacity * 255) : 0
  }
  context.putImageData(output, 0, 0)
  const region = crop.value
  context.save()
  context.fillStyle = 'rgba(0, 0, 0, .48)'
  context.fillRect(0, 0, overlay.width, region.y)
  context.fillRect(0, region.y + region.size, overlay.width, overlay.height - region.y - region.size)
  context.fillRect(0, region.y, region.x, region.size)
  context.fillRect(region.x + region.size, region.y, overlay.width - region.x - region.size, region.size)
  context.strokeStyle = props.mode === 'crop' ? '#42e8c7' : 'rgba(255,255,255,.74)'
  context.lineWidth = 2 / zoom.value
  context.setLineDash([9 / zoom.value, 6 / zoom.value])
  context.strokeRect(region.x, region.y, region.size, region.size)
  context.setLineDash([])
  context.fillStyle = '#42e8c7'
  context.font = `${12 / zoom.value}px IBM Plex Mono, monospace`
  const cropLabel = region.size === props.cropSize ? `${region.size} × ${region.size}` : `${region.size} → ${props.cropSize}`
  context.fillText(cropLabel, region.x + 8 / zoom.value, region.y + 20 / zoom.value)
  context.restore()
  if (!polygon.value.length) return
  context.save()
  context.strokeStyle = '#42e8c7'
  context.fillStyle = '#42e8c7'
  context.lineWidth = 2 / zoom.value
  context.beginPath()
  polygon.value.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))
  context.stroke()
  polygon.value.forEach((point) => {
    context.beginPath()
    context.arc(point.x, point.y, 4 / zoom.value, 0, Math.PI * 2)
    context.fill()
  })
  context.restore()
}

function snapshot(target: ImageData[] = history) {
  const context = maskCanvas.getContext('2d')
  if (context && maskCanvas.width) target.push(context.getImageData(0, 0, maskCanvas.width, maskCanvas.height))
  if (target === history && history.length > 30) history.shift()
}

function notify() {
  const context = maskCanvas.getContext('2d')
  if (!context || !maskCanvas.width) return
  const pixels = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
  const stats = maskStats(pixels.data)
  emit('changed', { dataUrl: maskCanvas.toDataURL('image/png'), changed: stats.changed, coverage: stats.coverage })
}

async function loadMask(url?: string) {
  const context = maskCanvas.getContext('2d')
  if (!context) return
  context.fillStyle = '#000'
  context.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
  if (url) {
    const image = await loadImage(url)
    const buffer = document.createElement('canvas')
    buffer.width = maskCanvas.width
    buffer.height = maskCanvas.height
    const bufferContext = buffer.getContext('2d')!
    bufferContext.drawImage(image, 0, 0, buffer.width, buffer.height)
    const source = bufferContext.getImageData(0, 0, buffer.width, buffer.height)
    const binary = context.createImageData(buffer.width, buffer.height)
    for (let i = 0; i < source.data.length; i += 4) {
      const active = source.data[i] > 0 || source.data[i + 1] > 0 || source.data[i + 2] > 0
      binary.data[i] = active ? 255 : 0
      binary.data[i + 1] = active ? 255 : 0
      binary.data[i + 2] = active ? 255 : 0
      binary.data[i + 3] = 255
    }
    context.putImageData(binary, 0, 0)
  }
  history.length = 0
  future.length = 0
  renderOverlay()
  notify()
}

async function initialize() {
  const token = ++loadToken
  const image = props.primary ?? props.secondary
  if (!image) return
  const [first, second] = await Promise.all([
    props.primary ? loadImage(props.primary.url) : Promise.resolve(null),
    props.secondary ? loadImage(props.secondary.url) : Promise.resolve(null),
  ])
  if (token !== loadToken) return
  primaryImage = first
  secondaryImage = second
  await nextTick()
  if (!baseCanvas.value || !overlayCanvas.value) return
  for (const canvas of [baseCanvas.value, overlayCanvas.value, maskCanvas]) {
    canvas.width = image.width
    canvas.height = image.height
  }
  crop.value = clampCrop({ x: (image.width - props.cropSize) / 2, y: (image.height - props.cropSize) / 2, size: props.cropSize }, image.width, image.height)
  emit('cropChanged', crop.value)
  resetView()
  renderBase()
  await loadMask(props.draft || props.initialMask?.url)
  emit('ready', { width: image.width, height: image.height })
}

function canvasPoint(event: PointerEvent) {
  const canvas = overlayCanvas.value!
  const rect = canvas.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height)),
  }
}

function paintLine(from: { x: number; y: number }, to: { x: number; y: number }) {
  const context = maskCanvas.getContext('2d')!
  context.save()
  context.strokeStyle = props.mode === 'eraser' ? '#000' : '#fff'
  context.fillStyle = context.strokeStyle
  context.lineWidth = props.brushSize
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  context.stroke()
  context.beginPath()
  context.arc(to.x, to.y, props.brushSize / 2, 0, Math.PI * 2)
  context.fill()
  context.restore()
  renderOverlay()
}

function pointerDown(event: PointerEvent) {
  if (!overlayCanvas.value) return
  if (props.mode === 'pan' || event.button === 1) {
    panning.value = true
    lastClient.value = { x: event.clientX, y: event.clientY }
    overlayCanvas.value.setPointerCapture(event.pointerId)
    return
  }
  const point = canvasPoint(event)
  if (props.mode === 'crop') {
    const region = crop.value
    if (point.x >= region.x && point.x <= region.x + region.size && point.y >= region.y && point.y <= region.y + region.size) {
      movingCrop.value = true
      cropOffset.value = { x: point.x - region.x, y: point.y - region.y }
      overlayCanvas.value.setPointerCapture(event.pointerId)
    }
    return
  }
  if (props.mode === 'polygon') {
    polygon.value = [...polygon.value, point]
    renderOverlay()
    return
  }
  snapshot()
  future.length = 0
  drawing.value = true
  lastPoint.value = point
  overlayCanvas.value.setPointerCapture(event.pointerId)
  paintLine(point, point)
}

function pointerMove(event: PointerEvent) {
  if (movingCrop.value) {
    const point = canvasPoint(event)
    crop.value = clampCrop({ x: point.x - cropOffset.value.x, y: point.y - cropOffset.value.y, size: crop.value.size }, maskCanvas.width, maskCanvas.height)
    emit('cropChanged', crop.value)
    renderOverlay()
    return
  }
  if (panning.value && lastClient.value) {
    panX.value += event.clientX - lastClient.value.x
    panY.value += event.clientY - lastClient.value.y
    lastClient.value = { x: event.clientX, y: event.clientY }
    return
  }
  if (!drawing.value || !lastPoint.value) return
  const next = canvasPoint(event)
  paintLine(lastPoint.value, next)
  lastPoint.value = next
}

function pointerUp() {
  if (drawing.value) notify()
  drawing.value = false
  panning.value = false
  movingCrop.value = false
  lastPoint.value = null
  lastClient.value = null
}

function finishPolygon() {
  if (polygon.value.length < 3) return
  snapshot()
  future.length = 0
  const context = maskCanvas.getContext('2d')!
  context.fillStyle = '#fff'
  context.beginPath()
  polygon.value.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))
  context.closePath()
  context.fill()
  polygon.value = []
  renderOverlay()
  notify()
}

function wheel(event: WheelEvent) {
  event.preventDefault()
  zoom.value = Math.max(0.5, Math.min(6, zoom.value * (event.deltaY > 0 ? 0.9 : 1.1)))
}

function undo() {
  const previous = history.pop()
  const context = maskCanvas.getContext('2d')
  if (!previous || !context) return
  snapshot(future)
  context.putImageData(previous, 0, 0)
  renderOverlay()
  notify()
}

function redo() {
  const next = future.pop()
  const context = maskCanvas.getContext('2d')
  if (!next || !context) return
  snapshot(history)
  context.putImageData(next, 0, 0)
  renderOverlay()
  notify()
}

function clearMask() {
  if (!maskCanvas.width) return
  snapshot()
  future.length = 0
  const context = maskCanvas.getContext('2d')!
  context.fillStyle = '#000'
  context.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
  polygon.value = []
  renderOverlay()
  notify()
}

function resetView() { zoom.value = 1; panX.value = 0; panY.value = 0 }
function exportMask() { return maskCanvas }
function exportCrop() {
  if (!primaryImage || !secondaryImage) return null
  return {
    t1: cropCanvas(primaryImage, crop.value, props.cropSize),
    t2: cropCanvas(secondaryImage, crop.value, props.cropSize),
    mask: cropCanvas(maskCanvas, crop.value, props.cropSize, false),
    crop: crop.value,
    outputSize: props.cropSize,
  }
}
defineExpose({ undo, redo, clearMask, resetView, finishPolygon, exportMask, exportCrop })

watch(() => [props.primary?.url, props.secondary?.url, props.initialMask?.url], initialize, { immediate: true })
watch(() => [props.viewMode, props.blend], renderBase)
watch(() => props.opacity, renderOverlay)
watch(() => props.cropSize, (size) => {
  if (!maskCanvas.width) return
  const centerX = crop.value.x + crop.value.size / 2
  const centerY = crop.value.y + crop.value.size / 2
  crop.value = clampCrop({ x: centerX - size / 2, y: centerY - size / 2, size }, maskCanvas.width, maskCanvas.height)
  emit('cropChanged', crop.value)
  renderOverlay()
})
watch(() => props.mode, () => { if (props.mode !== 'polygon' && polygon.value.length) { polygon.value = []; renderOverlay() } })
onBeforeUnmount(() => { loadToken += 1 })
</script>

<template>
  <div class="canvas-host" @wheel="wheel">
    <div v-if="primary || secondary" class="canvas-stage" :style="transformStyle">
      <canvas ref="baseCanvas" class="canvas-layer" />
      <canvas ref="overlayCanvas" class="canvas-layer canvas-layer--overlay" :style="{ cursor }"
        @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp"
        @pointercancel="pointerUp" @dblclick="finishPolygon" />
    </div>
    <div v-else class="empty-state">
      <span class="empty-state__mark">T1 / T2</span>
      <strong>导入双时相影像开始标注</strong>
      <small>支持目录批量导入，也可选择多张图像</small>
    </div>
    <div v-if="primary || secondary" class="zoom-indicator">{{ Math.round(zoom * 100) }}%</div>
  </div>
</template>

<style scoped>
.canvas-host { position: relative; display: grid; place-items: center; min-height: 0; height: 100%; overflow: hidden; background-color: #080b10; background-image: linear-gradient(45deg, #0d1219 25%, transparent 25%), linear-gradient(-45deg, #0d1219 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0d1219 75%), linear-gradient(-45deg, transparent 75%, #0d1219 75%); background-size: 24px 24px; background-position: 0 0, 0 12px, 12px -12px, -12px 0; }
.canvas-stage { position: relative; transform-origin: center; box-shadow: 0 18px 80px rgb(0 0 0 / .52); }
.canvas-layer { display: block; max-width: min(100%, 1200px); max-height: calc(100vh - 260px); object-fit: contain; user-select: none; }
.canvas-layer--overlay { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.empty-state { display: grid; justify-items: center; gap: 8px; color: #9ba7b6; text-align: center; }
.empty-state__mark { padding: 14px 18px; border: 1px solid #394453; color: #42e8c7; font: 700 13px/1 "IBM Plex Mono", monospace; letter-spacing: .18em; }
.empty-state strong { margin-top: 8px; color: #e8edf3; font-size: 15px; }
.empty-state small { color: #697484; }
.zoom-indicator { position: absolute; right: 14px; bottom: 12px; padding: 5px 8px; border: 1px solid #303946; background: rgb(9 13 19 / .88); color: #aab5c3; font: 11px/1 "IBM Plex Mono", monospace; }
</style>
