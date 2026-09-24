export interface ImageAsset {
  file: File
  url: string
  width: number
  height: number
}

export interface SamplePair {
  id: string
  name: string
  t1?: ImageAsset
  t2?: ImageAsset
  mask?: ImageAsset
  draft?: string
  annotated?: boolean
}

export type ToolMode = 'brush' | 'eraser' | 'polygon' | 'crop' | 'pan'
