// Levels and ranks, both worked out from a student's total XP.

import { config } from './config.js'
import { db } from './db.js'

// The XP at which each rank begins.
export const RANKS = [
  { name: 'Script Kiddie', xp: 0 },
  { name: 'Hacker', xp: 500 },
  { name: 'Pro Hacker', xp: 1_500 },
  { name: 'Elite Hacker', xp: 4_000 },
  { name: 'Guru', xp: 8_000 },
  { name: 'Omniscient', xp: 15_000 },
] as const

// The XP at which a level begins: 0, 100, 300, 600, 1000... Each level takes 100 XP more
// than the one before it.
export const levelStart = (level: number) => 50 * level * (level - 1)

export interface Standing {
  xp: number
  level: number
  levelStart: number
  nextLevel: number
  rank: string
  // 0 for the first rank; the web interface picks the emblem by it
  rankIndex: number
  nextRank: { name: string; xp: number } | null
}

export function standing(xp: number): Standing {
  let level = 1
  while (levelStart(level + 1) <= xp) level++
  let rankIndex = 0
  while (rankIndex + 1 < RANKS.length && RANKS[rankIndex + 1]!.xp <= xp) rankIndex++
  const next = RANKS[rankIndex + 1]
  return {
    xp,
    level,
    levelStart: levelStart(level),
    nextLevel: levelStart(level + 1),
    rank: RANKS[rankIndex]!.name,
    rankIndex,
    nextRank: next ? { name: next.name, xp: next.xp } : null,
  }
}

// A student's XP: everything so far, and what was earned since Monday.
export async function xpOf(userId: string): Promise<{ total: number; week: number }> {
  const { rows } = await db.query<{ total: number; week: number }>(
    `SELECT coalesce(sum(xp), 0)::int AS total,
            coalesce(sum(xp) FILTER (WHERE at >= date_trunc('week', now() AT TIME ZONE $2) AT TIME ZONE $2), 0)::int AS week
     FROM xp_events WHERE user_id = $1`,
    [userId, config.timezone]
  )
  return rows[0] ?? { total: 0, week: 0 }
}
