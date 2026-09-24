import { computed, ref } from 'vue'
import { readImage } from '../utils/image'
import { classifyImagePath, sampleIdFromPath } from '../utils/dataset'
import { appendAssetToSample, createSample, deleteSample } from '../utils/sample-store'
import type { ImageAsset, SamplePair } from '../types'

export function useDataset() {
  const samples = ref<SamplePair[]>([])
  const selectedId = ref('')
  const error = ref('')

  const selected = computed(() => samples.value.find((item) => item.id === selectedId.value) ?? null)

  async function addFiles(fileList: FileList | File[]) {
    error.value = ''
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    const groups = new Map<string, SamplePair>()
    for (const file of files) {
      const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      const key = sampleIdFromPath(relative)
      const item = groups.get(key) ?? { id: key, name: key }
      const asset = await readImage(file)
      const role = classifyImagePath(relative)
      if (role === 't1') item.t1 = asset
      else if (role === 't2') item.t2 = asset
      else if (role === 'mask') item.mask = asset
      else if (!item.t1) item.t1 = asset
      else if (!item.t2) item.t2 = asset
      groups.set(key, item)
    }
    samples.value = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
    selectedId.value = samples.value[0]?.id ?? ''
    if (!samples.value.length) error.value = '没有找到可读取的图像文件'
  }

  async function addTemporalFiles(role: 't1' | 't2', fileList: FileList | File[]) {
    error.value = ''
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (!files.length) {
      error.value = `没有找到可读取的 ${role.toUpperCase()} 图像`
      return
    }
    if (files.length > 1) error.value = `当前样本只接收一张 ${role.toUpperCase()} 图像，已使用第一个文件`
    let item = samples.value.find((sample) => sample.id === selectedId.value)
    if (!item) {
      error.value = '请先新建或选择一个样本，再上传时相图像'
      return
    }
    appendAssetToSample(item, role, await readImage(files[0]))
    if (!files.length) error.value = `没有找到可读取的 ${role.toUpperCase()} 图像`
  }

  function createNewSample(name?: string) {
    const requested = name?.trim()
    const base = createSample(samples.value.length, requested)
    let candidate = base
    let suffix = 2
    while (samples.value.some((sample) => sample.id === candidate.id)) {
      candidate = createSample(samples.value.length, `${base.id}_${suffix}`)
      suffix += 1
    }
    samples.value = [...samples.value, candidate]
    selectedId.value = candidate.id
    error.value = ''
    return candidate
  }

  function removeSample(id = selectedId.value) {
    if (!id) return
    const index = samples.value.findIndex((sample) => sample.id === id)
    samples.value = deleteSample(samples.value, id)
    if (samples.value.length === 0) selectedId.value = ''
    else selectedId.value = samples.value[Math.min(index, samples.value.length - 1)].id
  }

  function select(id: string) {
    selectedId.value = id
  }

  function updateSample(id: string, patch: Partial<SamplePair>) {
    const item = samples.value.find((sample) => sample.id === id)
    if (item) Object.assign(item, patch)
  }

  return { samples, selected, selectedId, error, addFiles, addTemporalFiles, createNewSample, removeSample, select, updateSample }
}
