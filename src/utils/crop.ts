export interface CropRegion { x: number; y: number; size: number }
export type DatasetSplit = 'train' | 'val' | 'test'

export function clampCrop(crop: CropRegion, width: number, height: number): CropRegion {
  const size = Math.max(1, Math.min(Math.round(crop.size), width, height))
  return {
    x: Math.max(0, Math.min(Math.round(crop.x), width - size)),
    y: Math.max(0, Math.min(Math.round(crop.y), height - size)),
    size,
  }
}

export function cropOutputName(sampleName: string, x: number, y: number, size: number): string {
  const stem = sampleName.replace(/\.[^.]+$/, '') || 'sample'
  return `${stem}_x${Math.round(x).toString().padStart(4, '0')}_y${Math.round(y).toString().padStart(4, '0')}_s${size}.png`
}

export function trainingPaths(split: DatasetSplit, imageName: string) {
  const stem = imageName.replace(/\.[^.]+$/, '')
  return {
    t1: `${split}/t1/${imageName}`,
    t2: `${split}/t2/${imageName}`,
    mask: `${split}/masks/${stem}_change_mask.png`,
  }
}

export function cropCanvas(source: CanvasImageSource, crop: CropRegion, outputSize = crop.size, smoothing = true): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const context = canvas.getContext('2d')!
  context.imageSmoothingEnabled = smoothing
  context.drawImage(source, crop.x, crop.y, crop.size, crop.size, 0, 0, outputSize, outputSize)
  return canvas
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成 PNG 文件')), 'image/png'))
}
