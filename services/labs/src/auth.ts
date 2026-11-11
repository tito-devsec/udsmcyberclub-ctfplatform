// Who is asking? The service has no accounts of its own: it passes the visitor's GZCTF
// sign-in cookie to GZCTF and uses the profile that comes back.

import type { IncomingMessage } from 'node:http'
import { config } from './config.js'
import { sha256 } from './content.js'

export interface User {
  id: string
  name: string
  admin: boolean
}

export class PlatformUnavailable extends Error {}

const cache = new Map<string, { user: User | null; until: number }>()

const tokenOf = (req: IncomingMessage) => /(?:^|;\s*)GZCTF_Token=([^;]+)/.exec(req.headers.cookie ?? '')?.[1]

// The proxy in front of this service (Caddy) adds the visitor's address as the last entry.
export function clientIp(req: IncomingMessage): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return forwarded.at(-1) ?? req.socket.remoteAddress ?? ''
}

export async function currentUser(req: IncomingMessage): Promise<User | null> {
  const token = tokenOf(req)
  if (!token) return null

  const key = sha256(token)
  const cached = cache.get(key)
  if (cached && cached.until > Date.now()) return cached.user

  let res: Response
  try {
    res = await fetch(`${config.gzctfUrl}/api/account/profile`, {
      headers: { Cookie: `GZCTF_Token=${token}`, 'X-Forwarded-For': clientIp(req) },
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new PlatformUnavailable()
  }

  let user: User | null = null
  if (res.ok) {
    const profile = (await res.json()) as { userId?: string; userName?: string; role?: string }
    if (profile.userId && profile.role !== 'Banned') {
      user = { id: profile.userId, name: profile.userName ?? '', admin: profile.role === 'Admin' }
    }
  } else if (res.status !== 401 && res.status !== 403) {
    throw new PlatformUnavailable()
  }

  if (cache.size > 10_000) cache.clear()
  // remember a signed-in visitor for a minute, a signed-out one only briefly
  cache.set(key, { user, until: Date.now() + (user ? 60_000 : 5_000) })
  return user
}
