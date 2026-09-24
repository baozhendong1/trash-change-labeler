import { describe, expect, it } from 'vitest'
import { clampCrop, cropOutputName, trainingPaths } from '../src/utils/crop'

describe('training crop utilities', () => {
  it('keeps a fixed crop inside image bounds', () => {
    expect(clampCrop({ x: -20, y: 900, size: 512 }, 1024, 1024)).toEqual({ x: 0, y: 512, size: 512 })
  })

  it('reduces crop size when an image is smaller than requested', () => {
    expect(clampCrop({ x: 0, y: 0, size: 512 }, 320, 240)).toEqual({ x: 0, y: 0, size: 240 })
  })

  it('creates aligned training filenames and directories', () => {
    expect(cropOutputName('scene.001.jpg', 120, 64, 512)).toBe('scene.001_x0120_y0064_s512.png')
    expect(trainingPaths('val', 'sample.png')).toEqual({
      t1: 'val/t1/sample.png',
      t2: 'val/t2/sample.png',
      mask: 'val/masks/sample_change_mask.png',
    })
  })
})
