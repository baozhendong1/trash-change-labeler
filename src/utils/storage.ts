import type { DatasetSplit } from './crop'
import { canvasBlob, trainingPaths } from './crop'

export interface DirectoryHandleLike {
  name: string
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<DirectoryHandleLike>
  getFileHandle(name: string, options: { create: boolean }): Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>
}

async function directory(root: DirectoryHandleLike, names: string[]): Promise<DirectoryHandleLike> {
  let current = root
  for (const name of names) current = await current.getDirectoryHandle(name, { create: true })
  return current
}

async function writeCanvas(root: DirectoryHandleLike, relativePath: string, canvas: HTMLCanvasElement) {
  const parts = relativePath.split('/')
  const filename = parts.pop()!
  const folder = await directory(root, parts)
  const file = await folder.getFileHandle(filename, { create: true })
  const writable = await file.createWritable()
  await writable.write(await canvasBlob(canvas))
  await writable.close()
}

export async function saveTrainingTriplet(
  root: DirectoryHandleLike,
  split: DatasetSplit,
  imageName: string,
  canvases: { t1: HTMLCanvasElement; t2: HTMLCanvasElement; mask: HTMLCanvasElement },
) {
  const paths = trainingPaths(split, imageName)
  await Promise.all([
    writeCanvas(root, paths.t1, canvases.t1),
    writeCanvas(root, paths.t2, canvases.t2),
    writeCanvas(root, paths.mask, canvases.mask),
  ])
  return paths
}
