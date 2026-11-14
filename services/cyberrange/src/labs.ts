// Boot-to-root machines and the people behind labs: when each lab went online, who took a
// machine's user flag and root flag first (its bloods), the creator an admin names for a lab,
// and the respect members give creators.

import type { User } from './auth.js'
import type { Lab } from './content.js'
import { db } from './db.js'
import { HttpError, route } from './http.js'
import { allow } from './ratelimit.js'
import { content } from './state.js'

const BASE = '/api/range'

// ---- when labs went online ----

const releases = new Map<string, Date>()

// Notes when each lab is first seen online, and reads them all again. A lab that students were
// answering before this was kept counts from its first answer.
export async function recordReleases(labs: Lab[]) {
  await db.query(
    `INSERT INTO lab_releases (lab, released_at)
     SELECT t.key, least(now(), (SELECT min(a.at) FROM attempts a WHERE a.module = t.key))
     FROM unnest($1::text[]) AS t(key)
     ON CONFLICT (lab) DO NOTHING`,
    [labs.map((lab) => lab.key)]
  )
  const { rows } = await db.query<{ lab: string; released_at: Date }>('SELECT lab, released_at FROM lab_releases')
  releases.clear()
  for (const row of rows) releases.set(row.lab, row.released_at)
}

export const releasedAt = (lab: Lab) => releases.get(lab.key) ?? null

// ---- bloods ----

interface Person {
  name: string
  avatar: string | null
  verified: boolean
}

export interface Blood extends Person {
  at: string
  // seconds from the lab going online
  after: number
}

// The first student to answer a boot-to-root lab's user flag, and the first to answer its root
// flag. Staff, who can open any machine's insides, and the lab's creator, who knows the way in,
// do not count.
export async function bloodsOf(lab: Lab): Promise<{ user: Blood | null; root: Blood | null } | null> {
  if (lab.type !== 'b2r') return null
  const taskOf = (kind: 'user' | 'root') => lab.section.questions.find((q) => q.flagKind === kind)?.id ?? ''
  const tasks = { user: taskOf('user'), root: taskOf('root') }
  const { rows } = await db.query<{
    question: string
    name: string
    avatar: string | null
    verified: boolean
    solved_at: Date
  }>(
    `SELECT DISTINCT ON (s.question) s.question, u.name, u.avatar, u.verified, s.solved_at
     FROM solves s JOIN users u ON u.id = s.user_id
     WHERE s.module = $1 AND s.section = $2 AND s.question = ANY($3::text[])
       AND u.role = 'student' AND NOT u.admin AND lower(u.name) <> lower($4)
     ORDER BY s.question, s.solved_at, s.user_id`,
    [lab.key, lab.section.slug, [tasks.user, tasks.root], lab.creator ?? '']
  )
  const released = releasedAt(lab)
  const blood = (task: string): Blood | null => {
    const row = rows.find((r) => r.question === task)
    return row
      ? {
          name: row.name,
          avatar: row.avatar,
          verified: row.verified,
          at: row.solved_at.toISOString(),
          after: released ? Math.max(0, Math.round((row.solved_at.getTime() - released.getTime()) / 1000)) : 0,
        }
      : null
  }
  return { user: blood(tasks.user), root: blood(tasks.root) }
}

// ---- creators and respect ----

export interface Creator extends Person {
  // whether they have a profile here, which comes with a first visit
  member: boolean
  respects: number
  // whether whoever is looking has given them respect, or is them
  respected: boolean
  self: boolean
}

interface MemberRow {
  id: string
  name: string
  avatar: string | null
  verified: boolean
  admin: boolean
}

async function memberByName(name: string): Promise<MemberRow | undefined> {
  const { rows } = await db.query<MemberRow>(
    'SELECT id, name, avatar, verified, admin FROM users WHERE lower(name) = lower($1) ORDER BY last_active_at DESC LIMIT 1',
    [name]
  )
  return rows[0]
}

// whether someone of this name has been here: a lab's creator must have, to be named for it
export const isMember = async (name: string) => Boolean(await memberByName(name))

async function respectsOf(creatorId: string, viewerId: string | null) {
  const { rows } = await db.query<{ respects: number; respected: boolean }>(
    `SELECT count(*)::int AS respects, coalesce(bool_or(user_id = $2), false) AS respected
     FROM respects WHERE creator_id = $1`,
    [creatorId, viewerId]
  )
  return { respects: rows[0]?.respects ?? 0, respected: rows[0]?.respected ?? false }
}

// how much respect someone has been given, for their profile
export const respectCount = async (userId: string) => (await respectsOf(userId, null)).respects

// The creator of a lab, as its page shows them. A name nobody here has is shown as it is.
export async function creatorOf(lab: Lab, viewer: User | null): Promise<Creator | null> {
  if (!lab.creator) return null
  const member = await memberByName(lab.creator)
  if (!member) {
    return { name: lab.creator, avatar: null, verified: false, member: false, respects: 0, respected: false, self: false }
  }
  return {
    name: member.name,
    avatar: member.avatar,
    verified: member.verified || member.admin,
    member: true,
    ...(await respectsOf(member.id, viewer?.id ?? null)),
    self: viewer?.id === member.id,
  }
}

// Respect for someone who made a lab that is online, given or taken back. Nobody gives it
// to themselves.
async function respect(name: string, user: User, give: boolean) {
  if (!allow(`respect:${user.id}`, 20, 60_000)) throw new HttpError(429, 'Slow down a little, then try again.')
  const member = await memberByName(name)
  const creator = member && content.labs.some((lab) => lab.creator?.toLowerCase() === member.name.toLowerCase())
  if (!member || !creator) throw new HttpError(404, 'Nobody of that name has made a lab here.')
  if (member.id === user.id) throw new HttpError(400, 'You cannot give yourself respect.')
  await (give
    ? db.query('INSERT INTO respects (user_id, creator_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, member.id])
    : db.query('DELETE FROM respects WHERE user_id = $1 AND creator_id = $2', [user.id, member.id]))
  return respectsOf(member.id, user.id)
}

route('PUT', `${BASE}/respect/@name`, async (ctx) => respect(ctx.params.name!, await ctx.signedIn(), true))
route('DELETE', `${BASE}/respect/@name`, async (ctx) => respect(ctx.params.name!, await ctx.signedIn(), false))
