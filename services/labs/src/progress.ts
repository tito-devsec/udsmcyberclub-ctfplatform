// What a student has done, and which labs that opens up.

import type { Lab, Path } from './content.js'
import { db } from './db.js'

export type LabStatus = 'completed' | 'available' | 'locked'

export interface LabProgress {
  status: LabStatus
  solved: number
  total: number
  // the lab to finish first, when this one is locked
  requires?: Lab
}

// lab -> ids of the questions this student has answered
export type Solves = Map<string, Set<string>>

export async function solvesOf(userId: string | undefined): Promise<Solves> {
  const solves: Solves = new Map()
  if (!userId) return solves
  const { rows } = await db.query<{ lab: string; question: string }>('SELECT lab, question FROM solves WHERE user_id = $1', [
    userId,
  ])
  for (const { lab, question } of rows) {
    if (!solves.has(lab)) solves.set(lab, new Set())
    solves.get(lab)!.add(question)
  }
  return solves
}

export function pathProgress(path: Path, solves: Solves): Map<string, LabProgress> {
  const progress = new Map<string, LabProgress>()
  let previous: Lab | undefined
  for (const lab of path.labs) {
    const done = solves.get(lab.slug) ?? new Set()
    // only questions that still exist count, in case a lab was edited
    const solved = lab.questions.filter((q) => done.has(q.id)).length
    const total = lab.questions.length
    const previousDone = !previous || progress.get(previous.slug)?.status === 'completed'
    let status: LabStatus = 'available'
    if (solved === total) status = 'completed'
    else if (path.sequential && !previousDone) status = 'locked'
    progress.set(lab.slug, { status, solved, total, requires: status === 'locked' ? previous : undefined })
    previous = lab
  }
  return progress
}

// the first lab the student has not finished yet
export function nextLab(path: Path, progress: Map<string, LabProgress>): Lab | undefined {
  return path.labs.find((lab) => progress.get(lab.slug)?.status !== 'completed')
}
