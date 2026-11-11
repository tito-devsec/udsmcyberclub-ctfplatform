// Who is asking? The service has no accounts of its own: it passes the visitor's GZCTF
// sign-in cookie to GZCTF and uses the profile that comes back. What it adds is a role,
// the skill level chosen at registration and the path the student is enrolled in.

import type { IncomingMessage } from 'node:http'
import { config } from './config.js'
import { sha256 } from './content.js'
import { db } from './db.js'

// student: learns. tutor: also sees every section without finishing the ones before it.
// admin: a platform admin. superadmin: a platform admin named in SUPERADMINS, who hands out roles.
export type Role = 'student' | 'tutor' | 'admin' | 'superadmin'

export const SKILL_LEVELS = ['beginner', 'intermediate', 'expert'] as const
export type SkillLevel = (typeof SKILL_LEVELS)[number]

export interface User {
  id: string
  name: string
  role: Role
  skillLevel: SkillLevel | null
  enrolledPath: string | null
}

export const isStaff = (user: User | null) => Boolean(user && user.role !== 'student')

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

// The student's row here, created the first time they are seen.
async function account(id: string, name: string, platformAdmin: boolean): Promise<User> {
  const { rows } = await db.query<{ role: string; skill_level: string | null; enrolled_path: string | null }>(
    `INSERT INTO users (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, last_active_at = now()
     RETURNING role, skill_level, enrolled_path`,
    [id, name]
  )
  const row = rows[0]!
  const listed = config.superadmins.includes(id.toLowerCase()) || config.superadmins.includes(name.toLowerCase())
  const role: Role = platformAdmin ? (listed ? 'superadmin' : 'admin') : row.role === 'tutor' ? 'tutor' : 'student'
  const skillLevel = SKILL_LEVELS.find((level) => level === row.skill_level) ?? null
  return { id, name, role, skillLevel, enrolledPath: row.enrolled_path }
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
      user = await account(profile.userId, profile.userName ?? '', profile.role === 'Admin')
    }
  } else if (res.status !== 401 && res.status !== 403) {
    throw new PlatformUnavailable()
  }

  if (cache.size > 10_000) cache.clear()
  // remember a signed-in visitor for a minute, a signed-out one only briefly
  cache.set(key, { user, until: Date.now() + (user ? 60_000 : 5_000) })
  return user
}

// After a change to someone's role, skill level or path: read them afresh on their next request.
export function forgetUser(userId: string) {
  for (const [key, entry] of cache) if (entry.user?.id === userId) cache.delete(key)
}
