// Loads learning paths and labs from files (the labs/ folder of the repository):
//
//   paths/<path>.yml       a path: its modules and, in order, the labs in each
//   <lab>/lab.yml          a lab: its machine and its tasks with their questions
//   <lab>/<task>.md        the lesson text of one task
//
// Accepted answers are kept only as hashes, and nothing about them is ever sent to students.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export type Difficulty = 'easy' | 'medium' | 'hard'

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
}

export interface Task {
  title: string
  content: string
  questions: Question[]
}

export interface Machine {
  image: string
  port: number
  memory: number
  // template for the flag the machine gets in GZCTF_FLAG; [USER_HASH] differs per student
  flag?: string
}

export interface Lab {
  slug: string
  title: string
  summary: string
  difficulty: Difficulty
  minutes: number
  machine?: Machine
  tasks: Task[]
  questions: Question[]
}

export interface Module {
  title: string
  summary: string
  labs: Lab[]
}

export interface Path {
  slug: string
  title: string
  summary: string
  description: string
  level: string
  order: number
  // each lab opens only when the one before it is complete
  sequential: boolean
  modules: Module[]
  labs: Lab[]
}

export interface Content {
  paths: Path[]
  bySlug: Map<string, Path>
}

export const normalise = (text: string, caseSensitive: boolean) => {
  const tidy = text.trim().replace(/\s+/g, ' ')
  return caseSensitive ? tidy : tidy.toLowerCase()
}

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const IMAGE = /^[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+)?$/
const MARKDOWN_FILE = /^[\w.-]+\.md$/

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

function loadQuestion(raw: Raw, lab: string, machine: Machine | undefined, where: string): Question {
  const id = text(raw, 'id', where)
  if (!SLUG.test(id)) fail(where, `question id "${id}" may only use a-z, 0-9 and dashes`)
  const isFlag = raw.flag === true
  const caseSensitive = isFlag || raw.caseSensitive === true
  const hashes = new Set<string>()
  if (isFlag) {
    if (!machine?.flag) fail(where, `question "${id}" asks for the machine flag, but the lab's machine has no flag`)
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
  }
}

function loadLab(dir: string, slug: string): Lab {
  const where = `lab "${slug}"`
  if (!SLUG.test(slug) || slug === 'paths') fail(where, 'invalid lab name')
  const raw = readYaml(join(dir, slug, 'lab.yml'), where)

  const difficulty = text(raw, 'difficulty', where, 'easy') as Difficulty
  if (!['easy', 'medium', 'hard'].includes(difficulty)) fail(where, 'difficulty must be easy, medium or hard')

  let machine: Machine | undefined
  if (raw.machine !== undefined) {
    const m = object(raw.machine, `${where} machine`)
    const image = text(m, 'image', where)
    if (!IMAGE.test(image)) fail(where, `"${image}" is not a valid image name`)
    const port = Number(m.port ?? 80)
    const memory = Number(m.memory ?? 64)
    if (!Number.isInteger(port) || port < 1 || port > 65535) fail(where, 'machine port must be 1-65535')
    if (!Number.isInteger(memory) || memory < 16 || memory > 1024) fail(where, 'machine memory must be 16-1024 MB')
    const flag = m.flag === undefined ? undefined : text(m, 'flag', where)
    if (flag !== undefined && !flag.includes('[USER_HASH]')) {
      fail(where, 'the machine flag needs [USER_HASH] so that every student gets their own')
    }
    machine = { image, port, memory, flag }
  }

  const seen = new Set<string>()
  const tasks = list(raw, 'tasks', where).map((value, index) => {
    const t = object(value, `${where} task ${index + 1}`)
    const file = text(t, 'file', where)
    if (!MARKDOWN_FILE.test(file)) fail(where, `task file "${file}" must be a .md file in the lab's folder`)
    const questions = (t.questions === undefined ? [] : list(t, 'questions', where)).map((q) => {
      const question = loadQuestion(object(q, where), slug, machine, where)
      if (seen.has(question.id)) fail(where, `question id "${question.id}" is used twice`)
      seen.add(question.id)
      return question
    })
    return { title: text(t, 'title', where), content: readFileSync(join(dir, slug, file), 'utf8'), questions }
  })

  const questions = tasks.flatMap((task) => task.questions)
  if (questions.length === 0) fail(where, 'a lab needs at least one question')

  return {
    slug,
    title: text(raw, 'title', where),
    summary: text(raw, 'summary', where),
    difficulty,
    minutes: Number(raw.minutes ?? 20),
    machine,
    tasks,
    questions,
  }
}

export function loadContent(dir: string): Content {
  const pathsDir = join(dir, 'paths')
  if (!existsSync(pathsDir)) fail(dir, 'the paths folder is missing')
  const owner = new Map<string, string>()

  const paths = readdirSync(pathsDir)
    .filter((file) => file.endsWith('.yml'))
    .map((file): Path => {
      const slug = file.slice(0, -'.yml'.length)
      const where = `path "${slug}"`
      if (!SLUG.test(slug)) fail(where, 'invalid path name')
      const raw = readYaml(join(pathsDir, file), where)

      const modules = list(raw, 'modules', where).map((value, index): Module => {
        const m = object(value, `${where} module ${index + 1}`)
        const labs = list(m, 'labs', where).map((labSlug) => {
          if (typeof labSlug !== 'string') fail(where, 'labs are listed by folder name')
          if (owner.has(labSlug)) fail(where, `lab "${labSlug}" is already in path "${owner.get(labSlug)}"`)
          owner.set(labSlug, slug)
          return loadLab(dir, labSlug)
        })
        return { title: text(m, 'title', where), summary: text(m, 'summary', where, ''), labs }
      })

      return {
        slug,
        title: text(raw, 'title', where),
        summary: text(raw, 'summary', where),
        description: text(raw, 'description', where, ''),
        level: text(raw, 'level', where, 'beginner'),
        order: Number(raw.order ?? 100),
        sequential: raw.sequential !== false,
        modules,
        labs: modules.flatMap((m) => m.labs),
      }
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

  return { paths, bySlug: new Map(paths.map((path) => [path.slug, path])) }
}
