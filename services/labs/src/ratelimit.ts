// Token buckets: each key may do `capacity` things at once, then one every `everyMs`.

const buckets = new Map<string, { tokens: number; at: number }>()

export function allow(key: string, capacity: number, everyMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { tokens: capacity, at: now }
  bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.at) / everyMs)
  bucket.at = now
  const allowed = bucket.tokens >= 1
  if (allowed) bucket.tokens -= 1
  buckets.set(key, bucket)
  if (buckets.size > 50_000) buckets.clear()
  return allowed
}
