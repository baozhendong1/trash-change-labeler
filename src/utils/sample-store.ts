import type { ImageAsset, SamplePair } from '../types'

export type SampleStoreItem = SamplePair

export function createSample(existingCount: number, name?: string): SampleStoreItem {
  const fallback = `sample_${String(existingCount + 1).padStart(3, '0')}`
  const id = (name?.trim() || fallback).replace(/[^\w\-\u4e00-\u9fa5]+/g, '_')
  return { id, name: id }
}

export function appendAssetToSample(sample: SampleStoreItem, role: 't1' | 't2', asset: ImageAsset): SampleStoreItem {
  sample[role] = asset
  return sample
}

export function deleteSample<T extends { id: string }>(samples: T[], id: string): T[] {
  return samples.filter((sample) => sample.id !== id)
}
