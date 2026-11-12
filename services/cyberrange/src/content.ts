// Loads skill paths, modules and labs from files (the content/ folder of the repository):
//
//   paths/<path>.yml              a skill path: the modules in it, in order
//   modules/<module>/module.yml   a module: its chapters, their sections and the questions
//   modules/<module>/<file>.md    the text of one section
//   labs/<lab>/lab.yml            a lab: its scenario, its machine and its tasks
//   labs/<lab>/files/*            files students download for the lab
//
// Accepted answers are kept only as hashes, and nothing about them is ever sent to students.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

// the CTF categories, and "general" for groundwork that belongs to none of them
export const CATEGORIES = [
  'general',
  'web',
  'crypto',
  'forensics',
  'osint',
  'reverse',
  'pwn',
  'stego',
  'misc',
  'hardware',
  'ics',
  'ai',
  'web3',
] as const
export type Category = (typeof CATEGORIES)[number]

export interface Question {
  id: string
  question: string
  // the shape of the answer, shown to students, e.g. "***.***"
  format?: string
  hint?: string
  // answered with the flag from the student's own machine
  flag: boolean
  caseSensitive: boolean
  hashes: Set<string>
  // what a right answer earns, chosen by the author
  xp: number
}

export interface Machine {
  image: string
  port: number
  memory: number
  // template for the flag the machine gets in GZCTF_FLAG; [USER_HASH] differs per student
  flag?: string
}

export interface Section {
  slug: string
  title: string
  content: string
  // bonus for finishing the section
  xp: number
  machine?: Machine
  questions: Question[]
}

export interface Chapter {
  title: string
  sections: Section[]
}

export interface Module {
  slug: string
  title: string
  summary: string
  description: string
  category: Category
  difficulty: Difficulty
  minutes: number
  // picks the cover art in the web interface; without one, the category decides
  icon?: string
  updated?: string
  order: number
  // each section opens only when the one before it is finished
  sequential: boolean
  chapters: Chapter[]
  sections: Section[]
  // everything a student can earn in the module
  xp: number
}

export interface Path {
  slug: string
  title: string
  summary: string
  description: string
  difficulty: Difficulty
  icon?: string
  order: number
  modules: Module[]
}

// A problem to solve on its own: a machine, files or a puzzle, and tasks that end with the flag.
export interface Lab {
  slug: string
  // how the lab's answers and machine are kept: "lab:<slug>"
  key: string
  title: string
  summary: string
  scenario: string
  category: Category
  difficulty: Difficulty
  minutes: number
  icon?: string
  updated?: string
  order: number
  files: { name: string; size: number }[]
  dir: string
  // the lab as a module of one section, so that answers, XP and machines work as they do there
  module: Module
  section: Section
  xp: number
}

export interface Content {
  paths: Path[]
  modules: Module[]
  labs: Lab[]
  pathBySlug: Map<string, Path>
  moduleBySlug: Map<string, Module>
  labBySlug: Map<string, Lab>
  // modules and labs by the name their progress is kept under
  unitByKey: Map<string, Module>
  labByKey: Map<string, Lab>
}

export const normalise = (text: string, caseSensitive: boolean) => {
  const tidy = text.trim().replace(/\s+/g, ' ')
  return caseSensitive ? tidy : tidy.toLowerCase()
}

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

export const sectionXp = (section: Section) => section.xp + section.questions.reduce((sum, q) => sum + q.xp, 0)

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const IMAGE = /^[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+)?$/
// "03-robots-txt.md" is the section "robots-txt": the number only orders the files in the folder
const SECTION_FILE = /^(?:\d+-)?([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/

export class ContentError extends Error {}

type Raw = Record<string, unknown>

function fail(where: string, message: string): never {
  throw new ContentError(`${where}: ${message}`)
}

function text(raw: Raw, field: string, where: string, fallback?: string): string {
  const value = raw[field]
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback
    fail(where, `"${field}" is missing`)
  }
  if (typeof value !== 'string' && typeof value !== 'number') fail(where, `"${field}" must be text`)
  return String(value).trim()
}

function whole(raw: Raw, field: string, where: string, fallback: number, min: number, max: number): number {
  const value = raw[field] === undefined ? fallback : Number(raw[field])
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(where, `"${field}" must be a whole number from ${min} to ${max}`)
  }
  return value
}

function choice<T extends string>(raw: Raw, field: string, where: string, options: readonly T[], fallback: T): T {
  const value = text(raw, field, where, fallback)
  if (!options.includes(value as T)) fail(where, `"${field}" must be one of: ${options.join(', ')}`)
  return value as T
}

function list(raw: Raw, field: string, where: string): unknown[] {
  const value = raw[field]
  if (!Array.isArray(value) || value.length === 0) fail(where, `"${field}" must be a non-empty list`)
  return value
}

function object(value: unknown, where: string): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(where, 'expected a set of fields')
  return value as Raw
}

function readYaml(file: string, where: string): Raw {
  if (!existsSync(file)) fail(where, `${file} is missing`)
  return object(parse(readFileSync(file, 'utf8')), where)
}

function iconOf(raw: Raw, where: string): string | undefined {
  if (raw.icon === undefined) return undefined
  const value = text(raw, 'icon', where)
  if (!SLUG.test(value)) fail(where, `icon "${value}" may only use a-z, 0-9 and dashes`)
  return value
}

function loadMachine(value: unknown, where: string): Machine {
  const m = object(value, `${where} machine`)
  const image = text(m, 'image', where)
  if (!IMAGE.test(image)) fail(where, `"${image}" is not a valid image name`)
  const flag = m.flag === undefined ? undefined : text(m, 'flag', where)
  if (flag !== undefined && !flag.includes('[USER_HASH]')) {
    fail(where, 'the machine flag needs [USER_HASH] so that every student gets their own')
  }
  return {
    image,
    port: whole(m, 'port', `${where} machine`, 80, 1, 65535),
    memory: whole(m, 'memory', `${where} machine`, 64, 16, 1024),
    flag,
  }
}

function loadQuestion(raw: Raw, machine: Machine | undefined, where: string): Question {
  const id = text(raw, 'id', where)
  if (!SLUG.test(id)) fail(where, `question id "${id}" may only use a-z, 0-9 and dashes`)
  const isFlag = raw.flag === true
  const caseSensitive = isFlag || raw.caseSensitive === true
  const hashes = new Set<string>()
  if (isFlag) {
    if (!machine?.flag) fail(where, `question "${id}" asks for the machine flag, but this section's machine has no flag`)
  } else {
    const answers = Array.isArray(raw.answer) ? raw.answer : [raw.answer]
    for (const answer of answers) {
      if (typeof answer !== 'string' && typeof answer !== 'number') fail(where, `question "${id}" needs an answer`)
      hashes.add(sha256(normalise(String(answer), caseSensitive)))
    }
  }
  return {
    id,
    question: text(raw, 'question', where),
    format: raw.format === undefined ? undefined : text(raw, 'format', where),
    hint: raw.hint === undefined ? undefined : text(raw, 'hint', where),
    flag: isFlag,
    caseSensitive,
    hashes,
    xp: whole(raw, 'xp', `${where} question "${id}"`, isFlag ? 40 : 10, 0, 1000),
  }
}

function loadSection(dir: string, value: unknown, where: string): Section {
  const raw = object(value, where)
  const file = text(raw, 'file', where)
  const slug = SECTION_FILE.exec(file)?.[1]
  if (!slug) fail(where, `"${file}" must be a .md file named with a-z, 0-9 and dashes, such as 01-first-steps.md`)
  const at = `${where} "${slug}"`
  if (!existsSync(join(dir, file))) fail(at, `${file} is missing`)

  const machine = raw.machine === undefined ? undefined : loadMachine(raw.machine, at)
  const seen = new Set<string>()
  const questions = (raw.questions === undefined ? [] : list(raw, 'questions', at)).map((q) => {
    const question = loadQuestion(object(q, at), machine, at)
    if (seen.has(question.id)) fail(at, `question id "${question.id}" is used twice`)
    seen.add(question.id)
    return question
  })

  return {
    slug,
    title: text(raw, 'title', at),
    content: readFileSync(join(dir, file), 'utf8'),
    xp: whole(raw, 'xp', at, 10, 0, 1000),
    machine,
    questions,
  }
}

function loadModule(modulesDir: string, slug: string): Module {
  const where = `module "${slug}"`
  if (!SLUG.test(slug)) fail(where, 'a module folder may only use a-z, 0-9 and dashes')
  const dir = join(modulesDir, slug)
  const raw = readYaml(join(dir, 'module.yml'), where)

  const seen = new Set<string>()
  const chapters = list(raw, 'chapters', where).map((value, index): Chapter => {
    const at = `${where} chapter ${index + 1}`
    const chapter = object(value, at)
    const sections = list(chapter, 'sections', at).map((s) => {
      const section = loadSection(dir, s, `${where} section`)
      if (seen.has(section.slug)) fail(where, `section "${section.slug}" is used twice`)
      seen.add(section.slug)
      return section
    })
    return { title: text(chapter, 'title', at), sections }
  })

  const sections = chapters.flatMap((chapter) => chapter.sections)
  const updated = updatedOf(raw, where)

  return {
    slug,
    title: text(raw, 'title', where),
    summary: text(raw, 'summary', where),
    description: text(raw, 'description', where, ''),
    category: choice(raw, 'category', where, CATEGORIES, 'general'),
    difficulty: choice(raw, 'difficulty', where, DIFFICULTIES, 'easy'),
    minutes: whole(raw, 'minutes', where, 30, 1, 100_000),
    icon: iconOf(raw, where),
    updated,
    order: whole(raw, 'order', where, 100, 0, 100_000),
    sequential: raw.sequential !== false,
    chapters,
    sections,
    xp: sections.reduce((sum, section) => sum + sectionXp(section), 0),
  }
}

function updatedOf(raw: Raw, where: string): string | undefined {
  const updated = raw.updated === undefined ? undefined : text(raw, 'updated', where)
  if (updated !== undefined && !DATE.test(updated)) fail(where, '"updated" must be a date such as "2026-11-12", in quotes')
  return updated
}

function loadLab(labsDir: string, slug: string): Lab {
  const where = `lab "${slug}"`
  if (!SLUG.test(slug)) fail(where, 'a lab folder may only use a-z, 0-9 and dashes')
  const dir = join(labsDir, slug)
  const raw = readYaml(join(dir, 'lab.yml'), where)

  const machine = raw.machine === undefined ? undefined : loadMachine(raw.machine, where)
  const seen = new Set<string>()
  const questions = list(raw, 'tasks', where).map((value) => {
    const question = loadQuestion(object(value, where), machine, where)
    if (seen.has(question.id)) fail(where, `task id "${question.id}" is used twice`)
    seen.add(question.id)
    return question
  })

  const filesDir = join(dir, 'files')
  const files = (existsSync(filesDir) ? readdirSync(filesDir) : [])
    .filter((name) => statSync(join(filesDir, name)).isFile())
    .map((name) => {
      if (!FILE_NAME.test(name)) fail(where, `the file name "${name}" may only use letters, digits, dots, dashes and _`)
      return { name, size: statSync(join(filesDir, name)).size }
    })

  const title = text(raw, 'title', where)
  const summary = text(raw, 'summary', where)
  const category = choice(raw, 'category', where, CATEGORIES, 'misc')
  const difficulty = choice(raw, 'difficulty', where, DIFFICULTIES, 'easy')
  const minutes = whole(raw, 'minutes', where, 30, 1, 100_000)
  const icon = iconOf(raw, where)
  const updated = updatedOf(raw, where)
  const order = whole(raw, 'order', where, 100, 0, 100_000)
  const section: Section = {
    slug: 'tasks',
    title,
    content: text(raw, 'scenario', where, ''),
    // a bonus for solving the whole lab
    xp: whole(raw, 'bonus', where, 0, 0, 1000),
    machine,
    questions,
  }
  const key = `lab:${slug}`
  const module: Module = {
    slug: key,
    title,
    summary,
    description: '',
    category,
    difficulty,
    minutes,
    icon,
    updated,
    order,
    sequential: false,
    chapters: [{ title, sections: [section] }],
    sections: [section],
    xp: sectionXp(section),
  }

  return {
    slug,
    key,
    title,
    summary,
    scenario: section.content,
    category,
    difficulty,
    minutes,
    icon,
    updated,
    order,
    files,
    dir,
    module,
    section,
    xp: module.xp,
  }
}

export function loadContent(dir: string): Content {
  const modulesDir = join(dir, 'modules')
  if (!existsSync(modulesDir)) fail(dir, 'the modules folder is missing')

  const modules = readdirSync(modulesDir)
    .filter((name) => statSync(join(modulesDir, name)).isDirectory())
    .map((slug) => loadModule(modulesDir, slug))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  const moduleBySlug = new Map(modules.map((module) => [module.slug, module]))

  const pathsDir = join(dir, 'paths')
  const paths = (existsSync(pathsDir) ? readdirSync(pathsDir) : [])
    .filter((file) => file.endsWith('.yml'))
    .map((file): Path => {
      const slug = file.slice(0, -'.yml'.length)
      const where = `path "${slug}"`
      if (!SLUG.test(slug)) fail(where, 'a path file may only use a-z, 0-9 and dashes')
      const raw = readYaml(join(pathsDir, file), where)

      const listed = new Set<string>()
      const inPath = list(raw, 'modules', where).map((name) => {
        const module = typeof name === 'string' ? moduleBySlug.get(name) : undefined
        if (!module) fail(where, `there is no module "${String(name)}" in the modules folder`)
        if (listed.has(module.slug)) fail(where, `module "${module.slug}" is listed twice`)
        listed.add(module.slug)
        return module
      })

      return {
        slug,
        title: text(raw, 'title', where),
        summary: text(raw, 'summary', where),
        description: text(raw, 'description', where, ''),
        difficulty: choice(raw, 'difficulty', where, DIFFICULTIES, 'easy'),
        icon: iconOf(raw, where),
        order: whole(raw, 'order', where, 100, 0, 100_000),
        modules: inPath,
      }
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

  const labsDir = join(dir, 'labs')
  const labs = (existsSync(labsDir) ? readdirSync(labsDir) : [])
    .filter((name) => statSync(join(labsDir, name)).isDirectory())
    .map((slug) => loadLab(labsDir, slug))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

  const units: [string, Module][] = [
    ...modules.map((module): [string, Module] => [module.slug, module]),
    ...labs.map((lab): [string, Module] => [lab.key, lab.module]),
  ]

  return {
    paths,
    modules,
    labs,
    pathBySlug: new Map(paths.map((path) => [path.slug, path])),
    moduleBySlug,
    labBySlug: new Map(labs.map((lab) => [lab.slug, lab])),
    unitByKey: new Map(units),
    labByKey: new Map(labs.map((lab) => [lab.key, lab])),
  }
}
