// Small helpers for reading what the web interface sends: anything missing or of the wrong
// kind becomes a default, and anything too long is cut.

export type Raw = Record<string, unknown>

export const fields = (value: unknown): Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : {}

export const items = (value: unknown, count: number): unknown[] => (Array.isArray(value) ? value.slice(0, count) : [])

export const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

export function int(value: unknown, fallback: number, min: number, max: number) {
  const n = Math.round(Number(value))
  return value === undefined || value === null || value === '' || !Number.isFinite(n)
    ? fallback
    : Math.min(max, Math.max(min, n))
}

// the texts in a list, trimmed, without the empty ones
export const strings = (value: unknown, count: number, max: number) =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
    .map((item) => String(item).trim().slice(0, max))
    .filter(Boolean)
    .slice(0, count)

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// "What is XSS?" becomes "what-is-xss"
export function slugify(text: string, fallback: string) {
  const slug = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
  return slug || fallback
}

// `wanted`, or `wanted-2`, `wanted-3`... when it is taken
export function unique(wanted: string, taken: Set<string>) {
  let name = wanted
  for (let n = 2; taken.has(name); n++) name = `${wanted}-${n}`
  taken.add(name)
  return name
}
