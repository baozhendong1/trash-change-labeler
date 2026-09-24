export function normalizeMaskPixel(value: number): 0 | 1 {
  return value > 0 ? 1 : 0
}

export function validateMaskDimensions(
  mask: { width: number; height: number },
  image: { width: number; height: number },
): string | null {
  if (mask.width !== image.width || mask.height !== image.height) {
    return `掩膜尺寸 ${mask.width}×${mask.height} 与图像尺寸 ${image.width}×${image.height} 不一致`
  }
  return null
}

export function maskFilename(sampleName: string): string {
  const stem = sampleName.replace(/\.[^.]+$/, '') || 'sample'
  return `${stem}_change_mask.png`
}

export function maskStats(data: Uint8ClampedArray): { changed: number; total: number; coverage: number } {
  const total = Math.floor(data.length / 4)
  let changed = 0
  for (let index = 0; index < total * 4; index += 4) {
    const active = data[index + 3] > 0 && (data[index] > 0 || data[index + 1] > 0 || data[index + 2] > 0)
    if (active) changed += 1
  }
  return { changed, total, coverage: total === 0 ? 0 : changed / total }
}
