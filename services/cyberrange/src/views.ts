// What the API sends about modules, paths and labs, shared by the route files.

import type { User } from './auth.js'
import { type Lab, type Module, type Path, pathCategory, type Section } from './content.js'
import { type ModuleState, moduleState, type PathState, type Progress } from './progress.js'
import { content } from './state.js'

export const link = (section: Section | undefined) => (section ? { slug: section.slug, title: section.title } : null)

export const pathsOf = (module: Module) =>
  content.paths.filter((path) => path.modules.includes(module)).map((path) => ({ slug: path.slug, title: path.title }))

export function moduleSummary(module: Module, state: ModuleState) {
  return {
    slug: module.slug,
    title: module.title,
    summary: module.summary,
    category: module.category,
    difficulty: module.difficulty,
    minutes: module.minutes,
    xp: module.xp,
    icon: module.icon ?? null,
    sections: state.total,
    done: state.done,
    status: state.status,
    // sections with a machine to practise on
    machines: module.sections.filter((section) => section.machine).length,
  }
}

export function pathSummary(path: Path, state: PathState, user: Pick<User, 'enrolledPath'> | null) {
  return {
    slug: path.slug,
    title: path.title,
    summary: path.summary,
    difficulty: path.difficulty,
    icon: path.icon ?? null,
    category: pathCategory(path),
    minutes: path.modules.reduce((sum, module) => sum + module.minutes, 0),
    xp: path.modules.reduce((sum, module) => sum + module.xp, 0),
    moduleCount: path.modules.length,
    completedModules: state.completedModules,
    sections: state.total,
    done: state.done,
    enrolled: user?.enrolledPath === path.slug,
  }
}

export function labSummary(lab: Lab, progress: Progress, solvers: Map<string, number>) {
  const state = moduleState(lab.module, progress)
  return {
    slug: lab.slug,
    title: lab.title,
    summary: lab.summary,
    category: lab.category,
    difficulty: lab.difficulty,
    minutes: lab.minutes,
    icon: lab.icon ?? null,
    xp: lab.xp,
    // a machine to attack, or a challenge with files or a puzzle
    kind: lab.section.machine ? 'machine' : 'challenge',
    tasks: lab.section.questions.length,
    solved: state.sections.get(lab.section.slug)?.solved ?? 0,
    status: state.status,
    solvers: solvers.get(lab.key) ?? 0,
    updated: lab.updated ?? null,
  }
}
