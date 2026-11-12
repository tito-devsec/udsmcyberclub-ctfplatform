// Skill paths, modules and labs written in the web interface by tutors and admins. An
// author works on a copy ("data"). Publishing checks it the way the content folder is
// checked and makes it what students see ("live").

import { randomUUID } from 'node:crypto'
import type { User } from './auth.js'
import { machineImages } from './catalogue.js'
import { config } from './config.js'
import {
  CATEGORIES,
  ContentError,
  DIFFICULTIES,
  labFrom,
  loadContent,
  type Machine,
  moduleFrom,
  pathFrom,
  type StudioDocument,
} from './content.js'
import { db } from './db.js'
import { BytesReply, HttpError, route } from './http.js'
import { fields, int, items, type Raw, SLUG, slugify, str, strings, unique } from './shape.js'
import { content, setContent } from './state.js'

const BASE = '/api/range'
const BODY = 2 * 1024 * 1024

const KINDS = ['module', 'lab', 'path'] as const
type Kind = (typeof KINDS)[number]

// Reads the content folder again, and everything published from the web interface.
export async function reloadContent() {
  const { rows } = await db.query<StudioDocument>(
    `SELECT d.id, d.kind, d.slug, d.live,
            coalesce((SELECT json_agg(json_build_object('name', f.name, 'size', f.size) ORDER BY f.name)
                      FROM document_files f WHERE f.document_id = d.id), '[]') AS files
     FROM documents d WHERE d.live IS NOT NULL ORDER BY d.created_at, d.id`
  )
  const next = loadContent(config.contentDir, rows)
  setContent(next)
  for (const problem of next.skipped) console.warn(`cyberrange: left out ${problem}`)
  return next
}

// ---- what a document may hold ----

const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.find((option) => option === value) ?? fallback

const iconOf = (value: unknown) => {
  const icon = str(value, 40)
  return SLUG.test(icon) ? { icon } : {}
}

function cleanMachine(value: unknown): Raw | undefined {
  const machine = fields(value)
  const image = str(machine.image, 200).trim()
  if (!image) return undefined
  const flag = str(machine.flag, 120).trim()
  return { image, port: int(machine.port, 80, 1, 65535), ...(flag && { flag }) }
}

// Questions keep the name they have; new ones are named q1, q2 and so on.
function cleanQuestions(value: unknown): Raw[] {
  const list = items(value, 30).map(fields)
  const taken = new Set<string>()
  const named = list.map((question) => {
    const id = typeof question.id === 'string' && SLUG.test(question.id) && !taken.has(question.id) ? question.id : ''
    if (id) taken.add(id)
    return id
  })
  let next = 1
  return list.map((question, index) => {
    let id = named[index]
    while (!id) {
      const candidate = `q${next++}`
      if (!taken.has(candidate)) taken.add((id = candidate))
    }
    const flag = question.flag === true
    const format = str(question.format, 100).trim()
    const hint = str(question.hint, 500).trim()
    return {
      id,
      question: str(question.question, 1000).trim(),
      ...(flag
        ? { flag: true }
        : { answer: strings(Array.isArray(question.answer) ? question.answer : [question.answer], 10, 200) }),
      ...(format && { format }),
      ...(hint && { hint }),
      xp: int(question.xp, flag ? 40 : 10, 0, 1000),
      ...(!flag && question.caseSensitive === true && { caseSensitive: true }),
    }
  })
}

function cleanSection(value: Raw, slug: string): Raw {
  const machine = cleanMachine(value.machine)
  const questions = cleanQuestions(value.questions)
  return {
    slug,
    title: str(value.title, 120).trim(),
    content: str(value.content, 100_000),
    xp: int(value.xp, 10, 0, 1000),
    ...(machine && { machine }),
    ...(questions.length > 0 && { questions }),
  }
}

// Sections keep the name they have, because students' progress is kept under it; new ones
// are named after their title.
function cleanModule(raw: Raw): Raw {
  const taken = new Set<string>()
  const chapters = items(raw.chapters, 20).map((value) => {
    const chapter = fields(value)
    const sections = items(chapter.sections, 40).map((item) => {
      const section = fields(item)
      const slug = typeof section.slug === 'string' && SLUG.test(section.slug) && !taken.has(section.slug) ? section.slug : ''
      if (slug) taken.add(slug)
      return { section, slug }
    })
    return { title: str(chapter.title, 120).trim(), sections }
  })
  return {
    title: str(raw.title, 120).trim(),
    summary: str(raw.summary, 300).trim(),
    description: str(raw.description, 5000),
    category: pick(raw.category, CATEGORIES, 'general'),
    difficulty: pick(raw.difficulty, DIFFICULTIES, 'easy'),
    minutes: int(raw.minutes, 30, 1, 100_000),
    ...iconOf(raw.icon),
    sequential: raw.sequential !== false,
    chapters: chapters.map((chapter) => ({
      title: chapter.title,
      sections: chapter.sections.map(({ section, slug }) =>
        cleanSection(section, slug || unique(slugify(str(section.title, 120), 'section'), taken))
      ),
    })),
  }
}

function cleanLab(raw: Raw): Raw {
  const machine = cleanMachine(raw.machine)
  const tasks = cleanQuestions(raw.tasks)
  return {
    title: str(raw.title, 120).trim(),
    summary: str(raw.summary, 300).trim(),
    scenario: str(raw.scenario, 20_000),
    category: pick(raw.category, CATEGORIES, 'misc'),
    difficulty: pick(raw.difficulty, DIFFICULTIES, 'easy'),
    minutes: int(raw.minutes, 30, 1, 100_000),
    ...iconOf(raw.icon),
    bonus: int(raw.bonus, 0, 0, 1000),
    ...(machine && { machine }),
    ...(tasks.length > 0 && { tasks }),
  }
}

const cleanPath = (raw: Raw): Raw => ({
  title: str(raw.title, 120).trim(),
  summary: str(raw.summary, 300).trim(),
  description: str(raw.description, 5000),
  difficulty: pick(raw.difficulty, DIFFICULTIES, 'easy'),
  ...iconOf(raw.icon),
  modules: [...new Set(strings(raw.modules, 30, 80))],
})

const clean = (kind: Kind, value: unknown): Raw =>
  kind === 'module' ? cleanModule(fields(value)) : kind === 'lab' ? cleanLab(fields(value)) : cleanPath(fields(value))

// ---- what still stands between a draft and publishing it ----

const MACHINE_FLAG = /^udsm\{[^\s{}]*\[USER_HASH\][^\s{}]*\}$/

function questionProblem(questions: unknown, what: string): string | null {
  for (const [index, value] of items(questions, 30).entries()) {
    const question = fields(value)
    if (!str(question.question, 10)) return `${what}: question ${index + 1} has no text.`
    if (question.flag !== true && strings(question.answer, 10, 200).length === 0) {
      return `${what}: question ${index + 1} needs an answer.`
    }
  }
  return null
}

async function problemOf(kind: Kind, slug: string, data: Raw, files: { name: string; size: number }[]) {
  if (!str(data.title, 10)) return 'Give it a title.'
  if (!str(data.summary, 10)) return 'Add a one-line summary.'

  const machines: (Machine | undefined)[] = []
  try {
    if (kind === 'module') {
      const chapters = items(data.chapters, 20).map(fields)
      if (chapters.length === 0) return 'Add a chapter.'
      for (const [index, chapter] of chapters.entries()) {
        if (!str(chapter.title, 10)) return `Chapter ${index + 1} needs a title.`
        const sections = items(chapter.sections, 40).map(fields)
        if (sections.length === 0) return `Chapter "${str(chapter.title, 80)}" needs a section.`
        for (const section of sections) {
          const title = str(section.title, 80)
          if (!title) return `A section in "${str(chapter.title, 80)}" needs a title.`
          if (!str(section.content, 100_000).trim()) return `Section "${title}" has no text yet.`
          const problem = questionProblem(section.questions, `Section "${title}"`)
          if (problem) return problem
        }
      }
      machines.push(...moduleFrom(data, slug, null).sections.map((section) => section.machine))
    } else if (kind === 'lab') {
      if (!str(data.scenario, 20_000).trim()) return 'Write the scenario.'
      if (items(data.tasks, 30).length === 0) return 'Add at least one task.'
      const problem = questionProblem(data.tasks, 'Tasks')
      if (problem) return problem
      machines.push(labFrom(data, slug, '', files).section.machine)
    } else {
      if (strings(data.modules, 30, 80).length === 0) return 'Choose at least one module.'
      pathFrom(data, slug, content.moduleBySlug)
    }
  } catch (error) {
    if (error instanceof ContentError) return error.message
    throw error
  }

  const images = await machineImages()
  for (const machine of machines) {
    if (!machine) continue
    if (!images.includes(machine.image)) return `"${machine.image}" is not one of the machine images on the server.`
    if (machine.flag && !MACHINE_FLAG.test(machine.flag)) {
      return 'A machine flag must look like udsm{some_words_[USER_HASH]}, so every student gets their own.'
    }
  }
  return null
}

// ---- reading and showing documents ----

interface Row {
  id: string
  kind: Kind
  slug: string
  author_id: string
  author: string | null
  data: Raw
  live: Raw | null
  updated_at: Date
  published_at: Date | null
}

const SELECT = 'SELECT d.*, u.name AS author FROM documents d LEFT JOIN users u ON u.id = d.author_id'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/

const seesAll = (user: User) => user.role === 'admin' || user.role === 'superadmin'

// A document the user may work on: their own, or any of them for admins.
async function find(id: string, user: User): Promise<Row> {
  const { rows } = UUID.test(id) ? await db.query<Row>(`${SELECT} WHERE d.id = $1`, [id]) : { rows: [] }
  const row = rows[0]
  if (!row || (row.author_id !== user.id && !seesAll(user))) throw new HttpError(404, 'There is no such document.')
  return row
}

const filesOf = async (id: string) =>
  (await db.query<{ name: string; size: number }>('SELECT name, size FROM document_files WHERE document_id = $1 ORDER BY name', [id]))
    .rows

// draft: never published. published: students see exactly this. changed: they see an older version.
const statusOf = (row: Row) =>
  row.live === null ? 'draft' : JSON.stringify(row.live) === JSON.stringify(row.data) ? 'published' : 'changed'

const addressOf = (row: Row) => `/${row.kind}s/${row.slug}`

const summary = (row: Row, user: User) => ({
  id: row.id,
  kind: row.kind,
  slug: row.slug,
  title: str(row.data.title, 120),
  status: statusOf(row),
  author: row.author ?? '',
  mine: row.author_id === user.id,
  address: row.live === null ? null : addressOf(row),
  updatedAt: row.updated_at.toISOString(),
  publishedAt: row.published_at?.toISOString() ?? null,
})

async function detail(row: Row, user: User) {
  const files = await filesOf(row.id)
  return {
    ...summary(row, user),
    data: row.data,
    files,
    problem: await problemOf(row.kind, row.slug, row.data, files),
  }
}

// ---- routes ----

route('GET', `${BASE}/studio/images`, async (ctx) => {
  await ctx.staff()
  return machineImages()
})

route('GET', `${BASE}/studio/documents`, async (ctx) => {
  const user = await ctx.staff()
  const { rows } = await db.query<Row>(`${SELECT} WHERE d.author_id = $1 OR $2 ORDER BY d.updated_at DESC`, [
    user.id,
    seesAll(user),
  ])
  return rows.map((row) => summary(row, user))
})

// the names taken by what is in the content folder and by every document of this kind
async function takenNames(kind: Kind) {
  const loaded = kind === 'module' ? content.moduleBySlug : kind === 'lab' ? content.labBySlug : content.pathBySlug
  const { rows } = await db.query<{ slug: string }>('SELECT slug FROM documents WHERE kind = $1', [kind])
  return new Set([...loaded.keys(), ...rows.map((row) => row.slug)])
}

route('POST', `${BASE}/studio/documents`, async (ctx) => {
  const user = await ctx.staff()
  const body = await ctx.body<{ kind?: unknown; title?: unknown }>()
  const kind = KINDS.find((k) => k === body.kind)
  const title = str(body.title, 120).trim()
  if (!kind) throw new HttpError(400, 'Choose a module, a lab or a skill path.')
  if (title.length < 3) throw new HttpError(400, 'Give it a title of at least 3 characters.')
  const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM documents WHERE author_id = $1', [user.id])
  if ((rows[0]?.n ?? 0) >= 200) throw new HttpError(400, 'You have 200 documents. Delete one first.')

  // its address, from the title: it never changes afterwards
  const slug = unique(slugify(title, kind), await takenNames(kind))
  const id = randomUUID()
  await db.query('INSERT INTO documents (id, kind, slug, author_id, data) VALUES ($1, $2, $3, $4, $5)', [
    id,
    kind,
    slug,
    user.id,
    clean(kind, { title }),
  ])
  return detail(await find(id, user), user)
})

route('GET', `${BASE}/studio/documents/:id`, async (ctx) => {
  const user = await ctx.staff()
  return detail(await find(ctx.params.id!, user), user)
})

route('PUT', `${BASE}/studio/documents/:id`, async (ctx) => {
  const user = await ctx.staff()
  const row = await find(ctx.params.id!, user)
  await db.query('UPDATE documents SET data = $2, updated_at = now() WHERE id = $1', [
    row.id,
    clean(row.kind, await ctx.body(BODY)),
  ])
  return detail(await find(row.id, user), user)
})

route('POST', `${BASE}/studio/documents/:id/publish`, async (ctx) => {
  const user = await ctx.staff()
  const row = await find(ctx.params.id!, user)
  const problem = await problemOf(row.kind, row.slug, row.data, await filesOf(row.id))
  if (problem) throw new HttpError(400, problem)
  await db.query('UPDATE documents SET live = data, published_at = now() WHERE id = $1', [row.id])
  await reloadContent()
  return detail(await find(row.id, user), user)
})

route('POST', `${BASE}/studio/documents/:id/unpublish`, async (ctx) => {
  const user = await ctx.staff()
  const row = await find(ctx.params.id!, user)
  await db.query('UPDATE documents SET live = NULL, published_at = NULL WHERE id = $1', [row.id])
  await reloadContent()
  return detail(await find(row.id, user), user)
})

route('DELETE', `${BASE}/studio/documents/:id`, async (ctx) => {
  const user = await ctx.staff()
  const row = await find(ctx.params.id!, user)
  if (row.live !== null) throw new HttpError(400, 'Take it offline first, then delete it.')
  await db.query('DELETE FROM document_files WHERE document_id = $1', [row.id])
  await db.query('DELETE FROM documents WHERE id = $1', [row.id])
  return null
})

// ---- a lab's files ----

const MAX_FILE = 8 * 1024 * 1024
const MAX_FILES = 5

async function labOf(id: string, user: User): Promise<Row> {
  const row = await find(id, user)
  if (row.kind !== 'lab') throw new HttpError(400, 'Only labs have files.')
  return row
}

route('PUT', `${BASE}/studio/documents/:id/files/@name`, async (ctx) => {
  const user = await ctx.staff()
  const row = await labOf(ctx.params.id!, user)
  const name = ctx.params.name!
  if (!FILE_NAME.test(name)) throw new HttpError(400, 'A file name may only use letters, digits, dots, dashes and _.')
  const { data } = await ctx.body<{ data?: unknown }>(MAX_FILE * 1.4)
  const bytes = typeof data === 'string' && /^[A-Za-z0-9+/]*=*$/.test(data) ? Buffer.from(data, 'base64') : null
  if (!bytes || bytes.length === 0) throw new HttpError(400, 'The file is empty.')
  if (bytes.length > MAX_FILE) throw new HttpError(400, 'A file can be up to 8 MB.')
  const files = await filesOf(row.id)
  if (files.length >= MAX_FILES && !files.some((file) => file.name === name)) {
    throw new HttpError(400, `A lab can have up to ${MAX_FILES} files.`)
  }
  await db.query(
    `INSERT INTO document_files (document_id, name, size, data) VALUES ($1, $2, $3, $4)
     ON CONFLICT (document_id, name) DO UPDATE SET size = EXCLUDED.size, data = EXCLUDED.data`,
    [row.id, name, bytes.length, bytes]
  )
  // files are not part of the draft: a published lab offers them straight away
  if (row.live !== null) await reloadContent()
  return detail(await find(row.id, user), user)
})

route('DELETE', `${BASE}/studio/documents/:id/files/@name`, async (ctx) => {
  const user = await ctx.staff()
  const row = await labOf(ctx.params.id!, user)
  await db.query('DELETE FROM document_files WHERE document_id = $1 AND name = $2', [row.id, ctx.params.name])
  if (row.live !== null) await reloadContent()
  return detail(await find(row.id, user), user)
})

// One of a lab's files, by the document it is kept with: for the lab's page.
export async function documentFile(documentId: string, name: string) {
  const { rows } = await db.query<{ data: Buffer }>(
    'SELECT data FROM document_files WHERE document_id = $1 AND name = $2',
    [documentId, name]
  )
  if (!rows[0]) throw new HttpError(404, 'There is no such file in this lab.')
  return new BytesReply(rows[0].data, 'application/octet-stream', name)
}
