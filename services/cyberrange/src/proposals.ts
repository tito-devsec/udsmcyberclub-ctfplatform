// Games proposed by tutors. A tutor drafts a game with its challenges and submits it. The
// superadmin approves it, which creates the game on the platform and puts it online, or
// sends it back with a note. Until it is approved, nothing exists on the platform.

import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { User } from './auth.js'
import { machineImages } from './catalogue.js'
import { db } from './db.js'
import { HttpError, route } from './http.js'
import { platform } from './platform.js'
import { fields, int, items, str, strings } from './shape.js'

const BASE = '/api/range'
const BODY = 256 * 1024

// the platform's own challenge categories
export const GAME_CATEGORIES = [
  'Misc',
  'Crypto',
  'Pwn',
  'Web',
  'Reverse',
  'Blockchain',
  'Forensics',
  'Hardware',
  'Mobile',
  'PPC',
  'AI',
  'Pentest',
  'OSINT',
] as const

interface Challenge {
  title: string
  category: string
  // one flag for everyone, or a container and a flag of their own for every player
  kind: 'static' | 'container'
  description: string
  points: number
  // wrong answers allowed before the challenge locks for a player; 0 for no limit
  attempts: number
  hints: string[]
  flags: string[]
  image: string
  port: number
  flagTemplate: string
}

interface ProposalData {
  title: string
  summary: string
  description: string
  start: string | null
  end: string | null
  type: 'individual' | 'team'
  teamSize: number
  challenges: Challenge[]
}

function date(value: unknown) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

// Whatever was sent, as a proposal: missing parts get a default and long ones are cut, so
// a draft can always be saved.
function shape(value: unknown): ProposalData {
  const raw = fields(value)
  return {
    title: str(raw.title, 80).trim(),
    summary: str(raw.summary, 300).trim(),
    description: str(raw.description, 20_000),
    start: date(raw.start),
    end: date(raw.end),
    type: raw.type === 'team' ? 'team' : 'individual',
    teamSize: int(raw.teamSize, 3, 2, 20),
    challenges: items(raw.challenges, 50).map((item): Challenge => {
      const c = fields(item)
      return {
        title: str(c.title, 60).trim(),
        category: GAME_CATEGORIES.find((name) => name === c.category) ?? 'Misc',
        kind: c.kind === 'container' ? 'container' : 'static',
        description: str(c.description, 10_000),
        points: int(c.points, 100, 10, 5000),
        attempts: int(c.attempts, 5, 0, 50),
        hints: strings(c.hints, 5, 300),
        flags: strings(c.flags, 5, 120),
        image: str(c.image, 200).trim(),
        port: int(c.port, 80, 1, 65535),
        flagTemplate: str(c.flagTemplate, 120).trim(),
      }
    }),
  }
}

const FLAG = /^udsm\{[^\s{}]{1,100}\}$/
const TEMPLATE = /^udsm\{[^\s{}]*\[TEAM_HASH\][^\s{}]*\}$/

// Raw HTML in a game's texts would run in players' browsers: the platform shows those texts
// as Markdown, HTML included. Code in backticks is shown as text, so it is left out here.
const CODE = /```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`/g
const hasHtml = (text: string) => /<[a-zA-Z!/?]/.test(text.replace(CODE, ''))
const NO_HTML = 'put code in backticks, and write links as [text](address).'

// What still stands between a draft and a game that can go online.
function problemsOf(data: ProposalData, images: string[]): string[] {
  const problems: string[] = []
  if (data.title.length < 3) problems.push('Give the game a title.')
  if (!data.summary) problems.push('Add a one-line summary.')
  if (!data.start || !data.end) problems.push('Choose when the game starts and ends.')
  else if (Date.parse(data.end) <= Date.parse(data.start)) problems.push('The game must end after it starts.')
  else if (Date.parse(data.end) <= Date.now()) problems.push('The game would already be over: choose later dates.')
  if (data.challenges.length === 0) problems.push('Add at least one challenge.')
  if (hasHtml(data.summary) || hasHtml(data.description)) problems.push(`The game's text has raw HTML: ${NO_HTML}`)

  const titles = new Set<string>()
  data.challenges.forEach((challenge, index) => {
    const name = challenge.title || `Challenge ${index + 1}`
    if (!challenge.title) problems.push(`Challenge ${index + 1} needs a title.`)
    else if (titles.has(challenge.title.toLowerCase())) problems.push(`Two challenges are called "${challenge.title}".`)
    titles.add(challenge.title.toLowerCase())
    if (!challenge.description.trim()) problems.push(`"${name}" needs a description.`)
    if ([challenge.description, ...challenge.hints].some(hasHtml)) {
      problems.push(`"${name}" has raw HTML in its text or hints: ${NO_HTML}`)
    }
    if (challenge.kind === 'static') {
      if (challenge.flags.length === 0) problems.push(`"${name}" needs a flag.`)
      else if (!challenge.flags.every((flag) => FLAG.test(flag))) {
        problems.push(`The flags of "${name}" must look like udsm{...}, with no spaces.`)
      }
    } else {
      if (!images.includes(challenge.image)) problems.push(`"${name}" needs one of the machine images on the server.`)
      if (!TEMPLATE.test(challenge.flagTemplate)) {
        problems.push(`The flag of "${name}" must look like udsm{some_words_[TEAM_HASH]}, so every player gets their own.`)
      }
    }
  })
  return problems
}

// ---- creating the game on the platform ----

const DAY = 86_400_000

async function createChallenge(req: IncomingMessage, gameId: number, challenge: Challenge) {
  const base = `/api/edit/games/${gameId}/challenges`
  const { id } = await platform<{ id: number }>(req, 'POST', base, {
    title: challenge.title,
    category: challenge.category,
    type: challenge.kind === 'static' ? 'StaticAttachment' : 'DynamicContainer',
  })
  const common = {
    content: challenge.description,
    hints: challenge.hints,
    originalScore: challenge.points,
    submissionLimit: challenge.attempts,
    isEnabled: true,
  }
  if (challenge.kind === 'static') {
    await platform(req, 'POST', `${base}/${id}/flags`, challenge.flags.map((flag) => ({ flag })))
    await platform(req, 'PUT', `${base}/${id}`, common)
  } else {
    await platform(req, 'PUT', `${base}/${id}`, {
      ...common,
      flagTemplate: challenge.flagTemplate,
      containerImage: challenge.image,
      exposePort: challenge.port,
      memoryLimit: 64,
      cpuCount: 1,
      storageLimit: 256,
      // no internet access from a player's instance
      networkMode: 'Isolated',
    })
  }
}

// Creates the game with the approver's own sign-in, hidden until every challenge is in.
// If anything fails, what was created is removed again.
async function createGame(req: IncomingMessage, data: ProposalData): Promise<number> {
  const start = Date.parse(data.start!)
  const end = Date.parse(data.end!)
  const individual = data.type === 'individual'
  const info = {
    title: data.title,
    summary: data.summary,
    content: data.description,
    hidden: true,
    acceptWithoutReview: true,
    practiceMode: true,
    writeupRequired: false,
    // a team of one makes it an individual game
    teamMemberCountLimit: individual ? 1 : data.teamSize,
    containerCountLimit: individual ? 1 : 3,
  }
  // created with a start in the future, so that turning challenges on posts no notices
  const later = Math.max(start, Date.now() + DAY)
  const game = await platform<{ id: number }>(req, 'POST', '/api/edit/games', {
    ...info,
    start: later,
    end: later + (end - start),
    writeupDeadline: later + (end - start),
  })
  try {
    for (const challenge of data.challenges) await createChallenge(req, game.id, challenge)
    await platform(req, 'PUT', `/api/edit/games/${game.id}`, {
      ...game,
      ...info,
      hidden: false,
      start,
      end,
      writeupDeadline: end,
    })
  } catch (error) {
    await platform(req, 'DELETE', `/api/edit/games/${game.id}`).catch(() => {})
    throw error
  }
  return game.id
}

// ---- reading and showing proposals ----

interface Row {
  id: string
  author_id: string
  author: string | null
  reviewer: string | null
  data: unknown
  status: string
  note: string | null
  game_id: number | null
  updated_at: Date
  submitted_at: Date | null
  reviewed_at: Date | null
}

const SELECT = `SELECT p.*, a.name AS author, r.name AS reviewer FROM proposals p
  LEFT JOIN users a ON a.id = p.author_id LEFT JOIN users r ON r.id = p.reviewer_id`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const seesAll = (user: User) => user.role === 'admin' || user.role === 'superadmin'
const open = (row: Row) => row.status === 'draft' || row.status === 'rejected'

// A proposal the user may see: their own, or for admins any that has been submitted.
async function find(id: string, user: User): Promise<Row> {
  const { rows } = UUID.test(id) ? await db.query<Row>(`${SELECT} WHERE p.id = $1`, [id]) : { rows: [] }
  const row = rows[0]
  if (!row || (row.author_id !== user.id && (!seesAll(user) || row.status === 'draft'))) {
    throw new HttpError(404, 'There is no such proposal.')
  }
  return row
}

function summary(row: Row, user: User) {
  const data = shape(row.data)
  return {
    id: row.id,
    title: data.title,
    status: row.status,
    author: row.author ?? '',
    mine: row.author_id === user.id,
    challenges: data.challenges.length,
    start: data.start,
    end: data.end,
    gameId: row.game_id,
    note: row.note,
    updatedAt: row.updated_at.toISOString(),
    submittedAt: row.submitted_at?.toISOString() ?? null,
  }
}

async function detail(row: Row, user: User) {
  const data = shape(row.data)
  return {
    ...summary(row, user),
    reviewer: row.reviewer,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    data,
    problems: row.status === 'approved' ? [] : problemsOf(data, await machineImages()),
    canEdit: row.author_id === user.id && open(row),
    canReview: user.role === 'superadmin' && row.status === 'submitted',
  }
}

// ---- routes ----

route('GET', `${BASE}/proposals`, async (ctx) => {
  const user = await ctx.staff()
  const { rows } = await db.query<Row>(
    `${SELECT} WHERE p.author_id = $1 OR ($2 AND p.status <> 'draft') ORDER BY p.updated_at DESC`,
    [user.id, seesAll(user)]
  )
  return rows.map((row) => summary(row, user))
})

route('POST', `${BASE}/proposals`, async (ctx) => {
  const user = await ctx.staff()
  const { rows } = await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM proposals WHERE author_id = $1 AND status <> 'approved'",
    [user.id]
  )
  if ((rows[0]?.n ?? 0) >= 20) throw new HttpError(400, 'You have 20 proposals in progress. Finish or delete one first.')
  const id = randomUUID()
  await db.query('INSERT INTO proposals (id, author_id, data) VALUES ($1, $2, $3)', [
    id,
    user.id,
    shape(await ctx.body(BODY)),
  ])
  return detail(await find(id, user), user)
})

route('GET', `${BASE}/proposals/:id`, async (ctx) => {
  const user = await ctx.staff()
  return detail(await find(ctx.params.id!, user), user)
})

// Only its author changes a proposal, and only while it is a draft or was sent back.
async function own(id: string, user: User): Promise<Row> {
  const row = await find(id, user)
  if (row.author_id !== user.id) throw new HttpError(403, 'Only its author can change a proposal.')
  return row
}

route('PUT', `${BASE}/proposals/:id`, async (ctx) => {
  const user = await ctx.staff()
  const row = await own(ctx.params.id!, user)
  if (!open(row)) throw new HttpError(400, 'Take the proposal back before changing it.')
  await db.query('UPDATE proposals SET data = $2, updated_at = now() WHERE id = $1', [
    row.id,
    shape(await ctx.body(BODY)),
  ])
  return detail(await find(row.id, user), user)
})

route('POST', `${BASE}/proposals/:id/submit`, async (ctx) => {
  const user = await ctx.staff()
  const row = await own(ctx.params.id!, user)
  if (!open(row)) throw new HttpError(400, 'This proposal has already been submitted.')
  const problems = problemsOf(shape(row.data), await machineImages())
  if (problems[0]) throw new HttpError(400, problems[0])
  await db.query(
    "UPDATE proposals SET status = 'submitted', note = NULL, submitted_at = now(), updated_at = now() WHERE id = $1",
    [row.id]
  )
  return detail(await find(row.id, user), user)
})

route('POST', `${BASE}/proposals/:id/withdraw`, async (ctx) => {
  const user = await ctx.staff()
  const row = await own(ctx.params.id!, user)
  if (row.status !== 'submitted') throw new HttpError(400, 'Only a submitted proposal can be taken back.')
  await db.query("UPDATE proposals SET status = 'draft', updated_at = now() WHERE id = $1", [row.id])
  return detail(await find(row.id, user), user)
})

route('POST', `${BASE}/proposals/:id/reject`, async (ctx) => {
  const user = await ctx.superadmin()
  const row = await find(ctx.params.id!, user)
  if (row.status !== 'submitted') throw new HttpError(400, 'Only a submitted proposal can be sent back.')
  const { note } = await ctx.body<{ note?: unknown }>()
  if (typeof note !== 'string' || !note.trim() || note.length > 1000) {
    throw new HttpError(400, 'Say what should change, in up to 1000 characters.')
  }
  await db.query(
    `UPDATE proposals SET status = 'rejected', note = $2, reviewer_id = $3, reviewed_at = now(), updated_at = now()
     WHERE id = $1`,
    [row.id, note.trim(), user.id]
  )
  return detail(await find(row.id, user), user)
})

// proposals being turned into games right now, so that two clicks do not make two games
const approving = new Set<string>()

route('POST', `${BASE}/proposals/:id/approve`, async (ctx) => {
  const user = await ctx.superadmin()
  const id = ctx.params.id!
  if (approving.has(id)) throw new HttpError(409, 'This proposal is being approved right now.')
  approving.add(id)
  try {
    const row = await find(id, user)
    if (row.status !== 'submitted') throw new HttpError(400, 'Only a submitted proposal can be approved.')
    const data = shape(row.data)
    const problems = problemsOf(data, await machineImages())
    if (problems[0]) throw new HttpError(400, `It cannot go online as it is: ${problems[0]}`)
    const gameId = await createGame(ctx.req, data)
    await db.query(
      `UPDATE proposals SET status = 'approved', game_id = $2, note = NULL, reviewer_id = $3, reviewed_at = now(),
         updated_at = now() WHERE id = $1`,
      [id, gameId, user.id]
    )
    return detail(await find(id, user), user)
  } finally {
    approving.delete(id)
  }
})

route('DELETE', `${BASE}/proposals/:id`, async (ctx) => {
  const user = await ctx.staff()
  const row = await find(ctx.params.id!, user)
  const allowed = user.role === 'superadmin' || (row.author_id === user.id && open(row))
  if (!allowed) throw new HttpError(403, 'Take the proposal back first, then delete it.')
  await db.query('DELETE FROM proposals WHERE id = $1', [row.id])
  return null
})
