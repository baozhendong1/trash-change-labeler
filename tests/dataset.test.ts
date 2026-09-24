import { describe, expect, it } from 'vitest'
import { classifyImagePath, sampleIdFromPath } from '../src/utils/dataset'

describe('dataset path parsing', () => {
  it('pairs t1, t2 and mask files with the same sample id', () => {
    expect(sampleIdFromPath('dataset/t1/scene_001.png')).toBe('scene_001')
    expect(sampleIdFromPath('dataset/t2/scene_001.png')).toBe('scene_001')
    expect(sampleIdFromPath('dataset/masks/scene_001_change_mask.png')).toBe('scene_001')
  })

  it('recognizes common temporal and mask folders', () => {
    expect(classifyImagePath('dataset/before/scene.png')).toBe('t1')
    expect(classifyImagePath('dataset/after/scene.png')).toBe('t2')
    expect(classifyImagePath('dataset/labels/scene.png')).toBe('mask')
  })

  it('recognizes flat filename suffixes', () => {
    expect(classifyImagePath('site-a_t1.jpg')).toBe('t1')
    expect(classifyImagePath('site-a_after.jpg')).toBe('t2')
    expect(classifyImagePath('site-a_change_mask.png')).toBe('mask')
  })
})
