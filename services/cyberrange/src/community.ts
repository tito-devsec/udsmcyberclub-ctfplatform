// Profiles, the ranking with its weekly Hall of Fame, and certificates. Profiles and the
// ranking are public, like a scoreboard; only a student can change their own profile.

import { roleOf } from './auth.js'
import { CATEGORIES, type Category } from './content.js'
import { db } from './db.js'
import { HttpError, route } from './http.js'
import { moduleState, pathState, progressOf } from './progress.js'
import { allow } from './ratelimit.js'
import { content } from './state.js'
import { badgesOf, positionOf, rankingPage, type Scope, streakOf, syncCertificates, weeks } from './stats.js'
import { moduleSummary, pathSummary } from './views.js'
import { standing, xpOf } from './xp.js'

const BASE = '/api/range'

interface UserRow {
  id: string
  name: string
  avatar: string | null
  admin: boolean
  role: string
  verified: boolean
  bio: string | null
  country: string | null
  links: Record<string, unknown>
  skill_level: string | null
  enrolled_path: string | null
  created_at: Date
  last_active_at: Date
}

// what each link may hold: a user name on the site, or the address of a website
const LINKS: Record<string, RegExp> = {
  github: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/,
  linkedin: /^[A-Za-z0-9-]{3,100}$/,
  x: /^[A-Za-z0-9_]{1,15}$/,
  website: /^https:\/\/[^\s<>"'`]{3,200}$/,
}

const linksOf = (raw: Record<string, unknown>): Record<string, string> => {
  const links: Record<string, string> = {}
  for (const [key, pattern] of Object.entries(LINKS)) {
    const value = raw[key]
    if (typeof value === 'string' && pattern.test(value)) links[key] = value
  }
  return links
}

async function userByName(name: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(
    'SELECT * FROM users WHERE lower(name) = lower($1) ORDER BY last_active_at DESC LIMIT 1',
    [name]
  )
  return rows[0]
}

async function userById(id: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id])
  return rows[0]
}

// Everything on someone's profile page.
async function profileOf(row: UserRow, viewerId: string | undefined) {
  await syncCertificates(row.id)
  const [progress, xp, position, streak, certificates, counts, earned] = await Promise.all([
    progressOf(row.id),
    xpOf(row.id),
    positionOf(row.id),
    streakOf(row.id),
    db.query<{ id: string; kind: string; ref: string; title: string; issued_at: Date }>(
      'SELECT id, kind, ref, title, issued_at FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC',
      [row.id]
    ),
    db.query<{ questions: number; flags: number }>(
      'SELECT count(*)::int AS questions, (count(*) FILTER (WHERE flag))::int AS flags FROM solves WHERE user_id = $1',
      [row.id]
    ),
    // XP by module or lab, to add up by category
    db.query<{ module: string; xp: number }>(
      `SELECT module, sum(xp)::int AS xp FROM (
         SELECT module, xp FROM solves WHERE user_id = $1
         UNION ALL SELECT module, xp FROM completions WHERE user_id = $1
       ) t GROUP BY module`,
      [row.id]
    ),
  ])
  const badges = await badgesOf(row.id, streak.fourthWeek)

  const { rows: labRows } = await db.query<{ module: string; at: Date }>(
    "SELECT module, completed_at AS at FROM completions WHERE user_id = $1 AND module LIKE 'lab:%' ORDER BY completed_at DESC",
    [row.id]
  )
  const solvedLabs = labRows.flatMap((r) => {
    const lab = content.labByKey.get(r.module)
    return lab
      ? [
          {
            slug: lab.slug,
            title: lab.title,
            category: lab.category,
            difficulty: lab.difficulty,
            icon: lab.icon ?? null,
            xp: lab.xp,
            kind: lab.section.machine ? 'machine' : 'challenge',
            solvedAt: r.at.toISOString(),
          },
        ]
      : []
  })

  const issued = new Map(certificates.rows.map((c) => [`${c.kind}:${c.ref}`, c.issued_at.toISOString()]))
  const completedModules = content.modules.flatMap((module) => {
    const state = moduleState(module, progress)
    return state.status === 'completed'
      ? [{ ...moduleSummary(module, state), completedAt: issued.get(`module:${module.slug}`) ?? null }]
      : []
  })
  const owner = { enrolledPath: row.enrolled_path }
  const paths = content.paths.flatMap((path) => {
    const state = pathState(path, progress)
    return path.slug === row.enrolled_path || state.done > 0
      ? [{ ...pathSummary(path, state, owner), completedAt: issued.get(`path:${path.slug}`) ?? null }]
      : []
  })

  // XP earned out of the XP there is, by category
  const available = new Map<Category, number>()
  for (const unit of [...content.modules, ...content.labs.map((lab) => lab.module)]) {
    available.set(unit.category, (available.get(unit.category) ?? 0) + unit.xp)
  }
  const gained = new Map<Category, number>()
  for (const { module, xp: points } of earned.rows) {
    const unit = content.unitByKey.get(module)
    if (unit) gained.set(unit.category, (gained.get(unit.category) ?? 0) + points)
  }

  const self = viewerId === row.id
  return {
    name: row.name,
    avatar: row.avatar,
    role: roleOf(row.id, row.name, row.admin, row.role),
    verified: row.verified || row.admin,
    bio: row.bio ?? '',
    country: row.country,
    links: linksOf(row.links ?? {}),
    // chosen at registration, shown to its owner only
    skillLevel: self ? row.skill_level : null,
    memberSince: row.created_at.toISOString(),
    lastActive: row.last_active_at.toISOString(),
    self,
    ...standing(xp.total),
    weekXp: xp.week,
    ...position,
    stats: {
      modulesCompleted: certificates.rows.filter((c) => c.kind === 'module').length,
      pathsCompleted: certificates.rows.filter((c) => c.kind === 'path').length,
      labsSolved: solvedLabs.length,
      questions: counts.rows[0]?.questions ?? 0,
      flags: counts.rows[0]?.flags ?? 0,
      certificates: certificates.rows.length,
    },
    streak: { current: streak.current, best: streak.best, goal: streak.goal, weekXp: streak.weekXp },
    badges,
    certificates: certificates.rows.map((c) => ({
      id: c.id,
      kind: c.kind,
      ref: c.ref,
      title: c.title,
      issuedAt: c.issued_at.toISOString(),
    })),
    completedModules,
    paths,
    labs: solvedLabs,
    categories: CATEGORIES.filter((category) => available.has(category)).map((category) => ({
      category,
      xp: gained.get(category) ?? 0,
      total: available.get(category) ?? 0,
    })),
  }
}

route('GET', `${BASE}/profiles/@name`, async (ctx) => {
  const viewer = await ctx.user()
  const row = await userByName(ctx.params.name!)
  if (!row) throw new HttpError(404, 'There is no such student.')
  return profileOf(row, viewer?.id)
})

route('GET', `${BASE}/me/profile`, async (ctx) => {
  const user = await ctx.signedIn()
  return profileOf((await userById(user.id))!, user.id)
})

route('PUT', `${BASE}/me/profile`, async (ctx) => {
  const user = await ctx.signedIn()
  if (!allow(`profile:${user.id}`, 10, 30_000)) throw new HttpError(429, 'Slow down a little, then try again.')
  const body = await ctx.body<{ bio?: unknown; country?: unknown; links?: unknown }>()
  const row = (await userById(user.id))!

  let bio = row.bio
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string' || body.bio.length > 300) throw new HttpError(400, 'Keep the bio under 300 characters.')
    bio = body.bio.trim() || null
  }
  let country = row.country
  if (body.country !== undefined) {
    if (body.country !== null && (typeof body.country !== 'string' || !/^[A-Z]{2}$/.test(body.country))) {
      throw new HttpError(400, 'Choose a country from the list.')
    }
    country = body.country
  }
  let links = linksOf(row.links ?? {})
  if (body.links !== undefined) {
    if (typeof body.links !== 'object' || body.links === null || Array.isArray(body.links)) {
      throw new HttpError(400, 'The links are not valid.')
    }
    const given = body.links as Record<string, unknown>
    for (const [key, value] of Object.entries(given)) {
      if (!LINKS[key]) throw new HttpError(400, `There is no "${key}" link.`)
      if (value !== '' && value !== null && (typeof value !== 'string' || !LINKS[key]!.test(value))) {
        throw new HttpError(400, key === 'website' ? 'The website must start with https://' : `The ${key} name is not valid.`)
      }
    }
    links = linksOf(given)
  }

  await db.query('UPDATE users SET bio = $2, country = $3, links = $4 WHERE id = $1', [user.id, bio, country, links])
  return profileOf({ ...row, bio, country, links }, user.id)
})

const SCOPES: Scope[] = ['all', 'week', 'hall']

route('GET', `${BASE}/ranking`, async (ctx) => {
  const viewer = await ctx.user()
  const scope = SCOPES.find((s) => s === ctx.query.get('scope')) ?? 'all'
  const hall = scope === 'hall'
  const size = Math.min(100, Math.max(10, Math.floor(Number(ctx.query.get('size')) || 10)))
  const page = Math.max(1, Math.floor(Number(ctx.query.get('page')) || 1))
  const search = (ctx.query.get('q') ?? '').trim().slice(0, 40)

  const [list, week] = await Promise.all([rankingPage(scope, page, size, search, viewer?.id), weeks()])
  return {
    scope,
    page,
    size,
    ...list,
    // the week shown, and when the Hall of Fame changes next
    period:
      scope === 'all'
        ? null
        : hall
          ? { start: week.last_week, end: week.last_week_end }
          : { start: week.this_week, end: week.this_week_end },
    nextUpdate: week.next_at.toISOString(),
  }
})

// A certificate, for anyone who wants to check it.
route('GET', `${BASE}/certificates/:id`, async (ctx) => {
  const { rows } = await db.query<{
    id: string
    kind: string
    ref: string
    title: string
    issued_at: Date
    name: string
    real_name: string | null
  }>(
    `SELECT c.id, c.kind, c.ref, c.title, c.issued_at, u.name, u.real_name
     FROM certificates c JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
    [ctx.params.id]
  )
  const certificate = rows[0]
  if (!certificate) throw new HttpError(404, 'There is no certificate with this number.')

  const path = certificate.kind === 'path' ? content.pathBySlug.get(certificate.ref) : undefined
  const module = certificate.kind === 'module' ? content.moduleBySlug.get(certificate.ref) : undefined
  return {
    id: certificate.id,
    kind: certificate.kind,
    ref: certificate.ref,
    title: certificate.title,
    // the real name from the platform profile when there is one, otherwise the user name
    name: certificate.real_name || certificate.name,
    userName: certificate.name,
    issuedAt: certificate.issued_at.toISOString(),
    // what it covered, while that module or path still exists
    category: module?.category ?? null,
    difficulty: module?.difficulty ?? path?.difficulty ?? null,
    minutes: module?.minutes ?? path?.modules.reduce((sum, m) => sum + m.minutes, 0) ?? null,
    modules: path?.modules.map((m) => m.title) ?? null,
  }
})
