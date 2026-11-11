// What a student has done, and which sections that opens up.

import type { Module, Path, Section } from './content.js'
import { db } from './db.js'

export interface Progress {
  // module -> section -> ids of the questions answered
  solved: Map<string, Map<string, Set<string>>>
  // module -> the sections finished
  completed: Map<string, Set<string>>
}

export type SectionStatus = 'completed' | 'available' | 'locked'

export interface SectionState {
  status: SectionStatus
  solved: number
  total: number
  // the section to finish first, when this one is locked
  requires?: Section
}

export type ModuleStatus = 'new' | 'started' | 'completed'

export interface ModuleState {
  status: ModuleStatus
  sections: Map<string, SectionState>
  done: number
  total: number
  // the first section that is not finished yet
  next?: Section
}

export async function progressOf(userId: string | undefined): Promise<Progress> {
  const progress: Progress = { solved: new Map(), completed: new Map() }
  if (!userId) return progress

  const [solves, completions] = await Promise.all([
    db.query<{ module: string; section: string; question: string }>(
      'SELECT module, section, question FROM solves WHERE user_id = $1',
      [userId]
    ),
    db.query<{ module: string; section: string }>('SELECT module, section FROM completions WHERE user_id = $1', [userId]),
  ])
  for (const { module, section, question } of solves.rows) {
    if (!progress.solved.has(module)) progress.solved.set(module, new Map())
    const sections = progress.solved.get(module)!
    if (!sections.has(section)) sections.set(section, new Set())
    sections.get(section)!.add(question)
  }
  for (const { module, section } of completions.rows) {
    if (!progress.completed.has(module)) progress.completed.set(module, new Set())
    progress.completed.get(module)!.add(section)
  }
  return progress
}

export const solvedIn = (progress: Progress, module: Module, section: Section) =>
  progress.solved.get(module.slug)?.get(section.slug) ?? new Set<string>()

// Every question answered. Only questions that still exist count, in case a section was edited.
export const allAnswered = (progress: Progress, module: Module, section: Section) => {
  const solved = solvedIn(progress, module, section)
  return section.questions.length > 0 && section.questions.every((q) => solved.has(q.id))
}

// `unlocked` is for tutors and admins, who can open any section to check it.
export function moduleState(module: Module, progress: Progress, unlocked = false): ModuleState {
  const completed = progress.completed.get(module.slug) ?? new Set<string>()
  const sections = new Map<string, SectionState>()
  let previous: Section | undefined
  let next: Section | undefined
  let done = 0
  let touched = false

  for (const section of module.sections) {
    const solved = solvedIn(progress, module, section)
    const answered = section.questions.filter((q) => solved.has(q.id)).length
    // a finished section stays finished, even if questions are added to it later
    const finished = completed.has(section.slug) || allAnswered(progress, module, section)
    const previousDone = !previous || sections.get(previous.slug)?.status === 'completed'

    let status: SectionStatus = 'available'
    if (finished) status = 'completed'
    else if (module.sequential && !previousDone && !unlocked) status = 'locked'

    sections.set(section.slug, {
      status,
      solved: answered,
      total: section.questions.length,
      requires: status === 'locked' ? previous : undefined,
    })
    if (finished) done++
    else next ??= section
    if (finished || answered > 0) touched = true
    previous = section
  }

  const total = module.sections.length
  return { status: done === total ? 'completed' : touched ? 'started' : 'new', sections, done, total, next }
}

export interface PathState {
  modules: Map<string, ModuleState>
  // sections finished, out of all the sections in the path
  done: number
  total: number
  completedModules: number
  // where to carry on: the first unfinished section of the first unfinished module
  next?: { module: Module; section: Section }
}

export function pathState(path: Path, progress: Progress, unlocked = false): PathState {
  const state: PathState = { modules: new Map(), done: 0, total: 0, completedModules: 0 }
  for (const module of path.modules) {
    const m = moduleState(module, progress, unlocked)
    state.modules.set(module.slug, m)
    state.done += m.done
    state.total += m.total
    if (m.status === 'completed') state.completedModules++
    else if (m.next) state.next ??= { module, section: m.next }
  }
  return state
}
