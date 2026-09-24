import { describe, expect, it } from 'vitest'
import { appendAssetToSample, createSample, deleteSample, type SampleStoreItem } from '../src/utils/sample-store'

const asset = (name: string) => ({ file: new File(['x'], name, { type: 'image/png' }), url: `blob:${name}`, width: 512, height: 512 })

describe('current sample workflow', () => {
  it('creates a named empty sample', () => {
    expect(createSample(3)).toMatchObject({ id: 'sample_004', name: 'sample_004' })
  })

  it('attaches uploaded assets to the selected sample regardless of filename', () => {
    const sample: SampleStoreItem = { id: 'sample_001', name: 'sample_001' }
    appendAssetToSample(sample, 't1', asset('random-camera-name.png'))
    appendAssetToSample(sample, 't2', asset('another-name.png'))
    expect(sample.t1?.file.name).toBe('random-camera-name.png')
    expect(sample.t2?.file.name).toBe('another-name.png')
  })

  it('deletes only the selected sample', () => {
    const samples = [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }]
    expect(deleteSample(samples, 'a')).toEqual([{ id: 'b', name: 'b' }])
  })
})
