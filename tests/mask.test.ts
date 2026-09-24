import { describe, expect, it } from 'vitest'
import { maskFilename, maskStats, normalizeMaskPixel, validateMaskDimensions } from '../src/utils/mask'

describe('mask utilities', () => {
  it('normalizes any positive label to change class 1', () => {
    expect(normalizeMaskPixel(0)).toBe(0)
    expect(normalizeMaskPixel(17)).toBe(1)
  })

  it('reports mismatched mask dimensions', () => {
    expect(validateMaskDimensions({ width: 10, height: 8 }, { width: 10, height: 8 })).toBeNull()
    expect(validateMaskDimensions({ width: 10, height: 7 }, { width: 10, height: 8 })).toContain('不一致')
  })

  it('creates a stable training mask filename', () => {
    expect(maskFilename('scene_001.png')).toBe('scene_001_change_mask.png')
    expect(maskFilename('scene_001')).toBe('scene_001_change_mask.png')
  })

  it('counts changed pixels and coverage from RGBA mask data', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      0, 0, 0, 0,
      1, 0, 0, 255,
    ])
    expect(maskStats(pixels)).toEqual({ changed: 2, total: 4, coverage: 0.5 })
  })
})
