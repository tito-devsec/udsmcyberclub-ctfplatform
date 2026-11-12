// Certificates of participation for the platform's games. Once a game is over, the
// superadmin issues one to everyone who took part: the members of each accepted team who
// registered for the game. The service has no account on the platform, so it reads games
// and their participants with the superadmin's own sign-in.

import { db } from './db.js'
import { HttpError, route } from './http.js'
import { platform } from './platform.js'
import { signatoriesToIssue } from './signing.js'
import { certificateId } from './stats.js'

const BASE = '/api/range'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface GameInfo {
  id: number
  title: string
  summary?: string | null
  hidden?: boolean
  // in milliseconds
  start: number
  end: number
  teamMemberCountLimit?: number
}

interface Participation {
  status?: string
  registeredMembers?: string[] | null
  team?: {
    name?: string | null
    members?: { userId?: string; userName?: string | null; realName?: string | null }[] | null
  } | null
}

const stageOf = (game: GameInfo, now = Date.now()) => (now < game.start ? 'upcoming' : now < game.end ? 'running' : 'ended')

async function issuedCounts() {
  const { rows } = await db.query<{ ref: string; n: number }>(
    "SELECT ref, count(*)::int AS n FROM certificates WHERE kind = 'game' GROUP BY ref"
  )
  return new Map(rows.map((row) => [row.ref, row.n]))
}

// Every game on the platform, newest first, with how many certificates it has given.
route('GET', `${BASE}/admin/games`, async (ctx) => {
  await ctx.superadmin()
  const reply = await platform<{ data?: GameInfo[] } | GameInfo[]>(ctx.req, 'GET', '/api/edit/games?count=100&skip=0')
  const games = Array.isArray(reply) ? reply : (reply?.data ?? [])
  const issued = await issuedCounts()
  return games
    .map((game) => ({
      id: game.id,
      title: game.title,
      summary: game.summary ?? '',
      hidden: Boolean(game.hidden),
      start: new Date(game.start).toISOString(),
      end: new Date(game.end).toISOString(),
      // a team of one makes it an individual game
      individual: game.teamMemberCountLimit === 1,
      stage: stageOf(game),
      issued: issued.get(String(game.id)) ?? 0,
    }))
    .sort((a, b) => b.end.localeCompare(a.end))
})

// Issues a certificate of participation to everyone who took part in a game that is over.
// Issuing again only adds the people who do not have one yet.
route('POST', `${BASE}/admin/games/:game/certificates`, async (ctx) => {
  await ctx.superadmin()
  const id = Number(ctx.params.game)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'There is no such game.')
  const game = await platform<GameInfo>(ctx.req, 'GET', `/api/edit/games/${id}`)
  if (stageOf(game) !== 'ended') throw new HttpError(400, 'Certificates of participation are issued once the game is over.')

  const participations = await platform<Participation[]>(ctx.req, 'GET', `/api/game/${id}/participations`)
  const individual = game.teamMemberCountLimit === 1
  const people = new Map<string, { name: string; user: string; team: string | null }>()
  for (const participation of participations ?? []) {
    if (participation.status !== 'Accepted') continue
    const registered = new Set((participation.registeredMembers ?? []).map((member) => member.toLowerCase()))
    for (const member of participation.team?.members ?? []) {
      const userId = member.userId?.toLowerCase()
      if (!userId || !UUID.test(userId) || !registered.has(userId)) continue
      const user = member.userName ?? ''
      people.set(userId, {
        name: member.realName?.trim() || user,
        user,
        team: individual ? null : (participation.team?.name ?? null),
      })
    }
  }

  const signatories = await signatoriesToIssue()
  const start = new Date(game.start).toISOString()
  const end = new Date(game.end).toISOString()
  let added = 0
  for (const [userId, person] of people) {
    const { rowCount } = await db.query(
      `INSERT INTO certificates (id, user_id, kind, ref, title, issued_at, signatories, holder_name, holder_user, details)
       VALUES ($1, $2, 'game', $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
      [
        certificateId(userId, 'game', String(id)),
        userId,
        String(id),
        game.title,
        new Date(game.end),
        signatories,
        person.name,
        person.user,
        { start, end, team: person.team, summary: game.summary ?? '' },
      ]
    )
    added += rowCount ?? 0
  }
  return { participants: people.size, added, issued: (await issuedCounts()).get(String(id)) ?? 0 }
})
