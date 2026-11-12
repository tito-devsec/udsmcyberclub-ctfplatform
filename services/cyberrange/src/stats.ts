// The ranking, streaks, badges and certificates: all worked out from what students did.

import { createHmac } from 'node:crypto'
import { config } from './config.js'
import { db } from './db.js'
import { moduleState, pathState, progressOf } from './progress.js'
import { content } from './state.js'
import { RANKS, standing } from './xp.js'

export type Scope = 'all' | 'week' | 'hall'

// Which XP counts: all of it, this week's, or last week's (the Hall of Fame). A week starts
// on Monday at midnight in the configured time zone ($1).
const PERIOD: Record<Scope, string> = {
  all: '$1::text IS NOT NULL',
  week: "e.at >= date_trunc('week', now() AT TIME ZONE $1) AT TIME ZONE $1",
  hall:
    "e.at >= (date_trunc('week', now() AT TIME ZONE $1) - interval '7 days') AT TIME ZONE $1 " +
    "AND e.at < date_trunc('week', now() AT TIME ZONE $1) AT TIME ZONE $1",
}

// Everyone with their XP for the period and their place, best first. Of two people with the
// same XP, whoever got there first is ahead. Weekly lists leave out people who earned nothing.
const ranked = (scope: Scope) => `
  WITH totals AS (
    SELECT u.id, u.name, u.avatar, u.country, u.verified, u.admin, u.role, u.last_active_at,
           coalesce(sum(e.xp), 0)::int AS total,
           coalesce(sum(e.xp) FILTER (WHERE ${PERIOD[scope]}), 0)::int AS xp,
           (count(e.user_id) FILTER (WHERE e.kind = 'answer' AND ${PERIOD[scope]}))::int AS tasks,
           max(e.at) FILTER (WHERE ${PERIOD[scope]}) AS reached
    FROM users u LEFT JOIN xp_events e ON e.user_id = u.id
    GROUP BY u.id
  ), ranked AS (
    SELECT *, (row_number() OVER (ORDER BY xp DESC, reached ASC NULLS LAST, lower(name), id))::int AS position
    FROM totals ${scope === 'all' ? '' : 'WHERE xp > 0'}
  )`

interface RankedRow {
  id: string
  name: string
  avatar: string | null
  country: string | null
  verified: boolean
  admin: boolean
  role: string
  last_active_at: Date
  total: number
  xp: number
  tasks: number
  position: number
}

function entry(row: RankedRow, viewerId: string | undefined) {
  const s = standing(row.total)
  return {
    position: row.position,
    name: row.name,
    avatar: row.avatar,
    country: row.country,
    verified: row.verified || row.admin,
    rank: s.rank,
    rankIndex: s.rankIndex,
    level: s.level,
    // XP in the period shown, and in all
    xp: row.xp,
    total: row.total,
    tasks: row.tasks,
    lastActive: row.last_active_at.toISOString(),
    me: row.id === viewerId,
  }
}

export type RankingEntry = ReturnType<typeof entry>

// The weeks around now, as dates in the configured time zone.
export async function weeks() {
  const { rows } = await db.query<{
    this_week: string
    this_week_end: string
    last_week: string
    last_week_end: string
    next_at: Date
  }>(
    `SELECT to_char(w, 'YYYY-MM-DD') AS this_week,
            to_char(w + interval '6 days', 'YYYY-MM-DD') AS this_week_end,
            to_char(w - interval '7 days', 'YYYY-MM-DD') AS last_week,
            to_char(w - interval '1 day', 'YYYY-MM-DD') AS last_week_end,
            (w + interval '7 days') AT TIME ZONE $1 AS next_at
     FROM (SELECT date_trunc('week', now() AT TIME ZONE $1) AS w) t`,
    [config.timezone]
  )
  return rows[0]!
}

// The Hall of Fame is the top 50 of last week; the other lists have no end.
const HALL_SIZE = 50

// One page of a ranking. The top three stand on the podium and the list starts under them,
// unless someone is looked for by name: then everyone who matches is listed.
export async function rankingPage(scope: Scope, page: number, size: number, search: string, viewerId?: string) {
  const last = scope === 'hall' ? HALL_SIZE : 2147483647
  const listed = `position <= $3 AND (($2 = '' AND position > 3) OR ($2 <> '' AND position(lower($2) IN lower(name)) > 0))`

  const [podium, list, counts, mine] = await Promise.all([
    db.query<RankedRow>(`${ranked(scope)} SELECT * FROM ranked WHERE position <= 3 ORDER BY position`, [
      config.timezone,
    ]),
    db.query<RankedRow>(
      `${ranked(scope)} SELECT * FROM ranked WHERE ${listed} ORDER BY position LIMIT $4 OFFSET $5`,
      [config.timezone, search, last, size, (page - 1) * size]
    ),
    db.query<{ everyone: number; matched: number }>(
      `${ranked(scope)}
       SELECT (count(*) FILTER (WHERE position <= $3))::int AS everyone,
              (count(*) FILTER (WHERE ${listed}))::int AS matched
       FROM ranked`,
      [config.timezone, search, last]
    ),
    viewerId
      ? db.query<RankedRow>(`${ranked(scope)} SELECT * FROM ranked WHERE id = $2 AND position <= $3`, [
          config.timezone,
          viewerId,
          last,
        ])
      : Promise.resolve({ rows: [] as RankedRow[] }),
  ])
  return {
    total: counts.rows[0]?.everyone ?? 0,
    matched: counts.rows[0]?.matched ?? 0,
    podium: podium.rows.map((row) => entry(row, viewerId)),
    entries: list.rows.map((row) => entry(row, viewerId)),
    me: mine.rows[0] ? entry(mine.rows[0], viewerId) : null,
  }
}

// Someone's place in the all-time ranking, out of how many people.
export async function positionOf(userId: string): Promise<{ position: number | null; of: number }> {
  const { rows } = await db.query<{ position: number | null; of: number }>(
    `${ranked('all')}
     SELECT (SELECT position FROM ranked WHERE id = $2) AS position, (SELECT count(*) FROM ranked)::int AS of`,
    [config.timezone, userId]
  )
  return rows[0] ?? { position: null, of: 0 }
}

// ---- certificates ----

// A certificate's number: the same for the same student and the same module or path.
export const certificateId = (userId: string, kind: string, ref: string) =>
  createHmac('sha256', config.secret).update(`certificate:${userId}:${kind}:${ref}`).digest('hex').slice(0, 16)

// Issues the certificates someone has earned and does not have yet: one for each module
// they finished, and one for each skill path whose modules they all finished.
export async function syncCertificates(userId: string) {
  const progress = await progressOf(userId)
  const { rows } = await db.query<{ module: string; at: Date }>(
    'SELECT module, max(completed_at) AS at FROM completions WHERE user_id = $1 GROUP BY module',
    [userId]
  )
  const finishedAt = new Map(rows.map((row) => [row.module, row.at]))

  const issue: { kind: string; ref: string; title: string; at: Date }[] = []
  for (const module of content.modules) {
    const at = finishedAt.get(module.slug)
    if (at && moduleState(module, progress).status === 'completed') {
      issue.push({ kind: 'module', ref: module.slug, title: module.title, at })
    }
  }
  for (const path of content.paths) {
    if (pathState(path, progress).completedModules !== path.modules.length) continue
    const last = Math.max(...path.modules.map((module) => finishedAt.get(module.slug)?.getTime() ?? 0))
    issue.push({ kind: 'path', ref: path.slug, title: path.title, at: new Date(last) })
  }

  for (const c of issue) {
    await db.query(
      `INSERT INTO certificates (id, user_id, kind, ref, title, issued_at) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [certificateId(userId, c.kind, c.ref), userId, c.kind, c.ref, c.title, c.at]
    )
  }
}

// ---- streaks ----

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

// A streak is a run of weeks in which someone earned at least the weekly goal. This week
// counts once its goal is reached; until then the streak runs up to last week.
export async function streakOf(userId: string) {
  const [{ rows }, { this_week }] = await Promise.all([
    db.query<{ week: string; xp: number }>(
      `SELECT to_char(date_trunc('week', at AT TIME ZONE $2), 'YYYY-MM-DD') AS week, sum(xp)::int AS xp
       FROM xp_events WHERE user_id = $1 GROUP BY 1 ORDER BY 1`,
      [userId, config.timezone]
    ),
    weeks(),
  ])
  const met = rows.filter((row) => row.xp >= config.weeklyGoal).map((row) => row.week)
  const metSet = new Set(met)

  let cursor = metSet.has(this_week) ? this_week : addDays(this_week, -7)
  let current = 0
  while (metSet.has(cursor)) {
    current++
    cursor = addDays(cursor, -7)
  }

  let best = 0
  let run = 0
  let previous = ''
  // the first week in which a streak reached four weeks
  let fourthWeek: string | null = null
  for (const week of met) {
    run = previous && addDays(previous, 7) === week ? run + 1 : 1
    if (run >= 4 && !fourthWeek) fourthWeek = week
    best = Math.max(best, run)
    previous = week
  }

  return {
    current,
    best,
    goal: config.weeklyGoal,
    weekXp: rows.find((row) => row.week === this_week)?.xp ?? 0,
    fourthWeek,
  }
}

// ---- badges ----

// In the order they are shown. The web interface has their names, descriptions and icons.
export const BADGES = [
  'first-answer',
  'first-flag',
  'first-module',
  'first-path',
  'first-lab',
  'five-labs',
  'web',
  'crypto',
  'forensics',
  'osint',
  'all-rounder',
  'streak',
  'hacker',
  'pro-hacker',
  'elite-hacker',
  'guru',
  'omniscient',
  'hall-of-fame',
] as const

// the badges for reaching each rank after the first, in the order of RANKS
const RANK_BADGES = ['hacker', 'pro-hacker', 'elite-hacker', 'guru', 'omniscient']

// labs to solve in one category for its badge
const CATEGORY_LABS = 3

export async function badgesOf(userId: string, fourthWeek: string | null) {
  const [solves, completions, certificates, fame] = await Promise.all([
    db.query<{ module: string; xp: number; flag: boolean; at: Date }>(
      'SELECT module, xp, flag, solved_at AS at FROM solves WHERE user_id = $1 ORDER BY solved_at',
      [userId]
    ),
    db.query<{ module: string; xp: number; at: Date }>(
      'SELECT module, xp, completed_at AS at FROM completions WHERE user_id = $1 ORDER BY completed_at',
      [userId]
    ),
    db.query<{ kind: string; at: Date }>(
      'SELECT kind, issued_at AS at FROM certificates WHERE user_id = $1 ORDER BY issued_at',
      [userId]
    ),
    // the first week this person finished in the top 3, among weeks that are over
    db.query<{ week: string | null }>(
      `WITH w AS (
         SELECT e.user_id, date_trunc('week', e.at AT TIME ZONE $2) AS week, sum(e.xp) AS xp, max(e.at) AS reached
         FROM xp_events e GROUP BY 1, 2
       ), r AS (
         SELECT w.user_id, w.week,
                row_number() OVER (PARTITION BY w.week ORDER BY w.xp DESC, w.reached, lower(u.name), w.user_id) AS place
         FROM w JOIN users u ON u.id = w.user_id WHERE w.xp > 0
       )
       SELECT to_char(min(week), 'YYYY-MM-DD') AS week FROM r
       WHERE user_id = $1 AND place <= 3 AND week < date_trunc('week', now() AT TIME ZONE $2)`,
      [userId, config.timezone]
    ),
  ])

  const earned = new Map<string, Date>()
  const award = (id: string, at: Date | undefined) => {
    if (at && !earned.has(id)) earned.set(id, at)
  }

  award('first-answer', solves.rows[0]?.at)
  award('first-flag', solves.rows.find((s) => s.flag)?.at)
  award('first-module', certificates.rows.find((c) => c.kind === 'module')?.at)
  award('first-path', certificates.rows.find((c) => c.kind === 'path')?.at)

  // labs, in the order they were solved
  const labs = completions.rows.filter((c) => content.labByKey.has(c.module))
  award('first-lab', labs[0]?.at)
  award('five-labs', labs[4]?.at)
  for (const category of ['web', 'crypto', 'forensics', 'osint']) {
    award(category, labs.filter((c) => content.labByKey.get(c.module)?.category === category)[CATEGORY_LABS - 1]?.at)
  }
  const categories = new Set<string>()
  for (const lab of labs) {
    categories.add(content.labByKey.get(lab.module)!.category)
    if (categories.size === 4) award('all-rounder', lab.at)
  }

  if (fourthWeek) award('streak', new Date(`${fourthWeek}T00:00:00Z`))

  // when the running total of XP first reached each rank
  const events = [...solves.rows, ...completions.rows].sort((a, b) => a.at.getTime() - b.at.getTime())
  let total = 0
  for (const event of events) {
    total += event.xp
    RANKS.forEach((rank, i) => {
      if (i > 0 && total >= rank.xp) award(RANK_BADGES[i - 1]!, event.at)
    })
  }

  // announced when that week ended
  const week = fame.rows[0]?.week
  if (week) award('hall-of-fame', new Date(`${addDays(week, 7)}T00:00:00Z`))

  return BADGES.map((id) => ({ id, earnedAt: earned.get(id)?.toISOString() ?? null }))
}
