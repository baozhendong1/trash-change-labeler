export type AssetRole = 't1' | 't2' | 'mask' | 'unknown'

function segments(path: string): string[] {
  return path.replace(/\\/g, '/').split('/').filter(Boolean)
}

function filename(path: string): string {
  return segments(path).at(-1) ?? path
}

export function classifyImagePath(path: string): AssetRole {
  const parts = segments(path)
  const parent = (parts.at(-2) ?? '').toLowerCase()
  const name = filename(path).toLowerCase().replace(/\.[^.]+$/, '')
  if (/^(mask|masks|label|labels|change|changes)$/.test(parent) || /(?:^|[_-])(change[_-]?mask|mask|label)(?:[_-]|$)/.test(name)) return 'mask'
  if (/^(t1|time1|before|from|a)$/.test(parent) || /(?:^|[_-])(t1|time1|before|from)(?:[_-]|$)/.test(name)) return 't1'
  if (/^(t2|time2|after|to|b)$/.test(parent) || /(?:^|[_-])(t2|time2|after|to)(?:[_-]|$)/.test(name)) return 't2'
  return 'unknown'
}

export function sampleIdFromPath(path: string): string {
  return filename(path)
    .replace(/\.[^.]+$/, '')
    .replace(/(?:[_-](?:change[_-]?mask|mask|label|t1|time1|before|from|t2|time2|after|to))+$/i, '')
}
