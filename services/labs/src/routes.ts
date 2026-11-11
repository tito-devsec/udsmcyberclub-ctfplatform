// The Labs API, under /api/labs. The proxy in front sends these requests here and
// everything else to the platform.

import { timingSafeEqual } from 'node:crypto'
import { clientIp } from './auth.js'
import { config } from './config.js'
import { type Content, ContentError, type Lab, loadContent, normalise, type Path, type Question, sha256 } from './content.js'
import { db } from './db.js'
import { HttpError, route } from './http.js'
import { currentMachine, extendMachine, machineFlag, type MachineInfo, startMachine, stopMachine } from './machines.js'
import { type LabProgress, nextLab, pathProgress, solvesOf } from './progress.js'
import { allow } from './ratelimit.js'

let content: Content

export function setContent(next: Content) {
  content = next
}

function findPath(slug: string): Path {
  const path = content.bySlug.get(slug)
  if (!path) throw new HttpError(404, 'There is no such learning path.')
  return path
}

function findLab(path: Path, slug: string): Lab {
  const lab = path.labs.find((l) => l.slug === slug)
  if (!lab) throw new HttpError(404, 'There is no such lab in this path.')
  return lab
}

const link = (lab: Lab | undefined) => (lab ? { slug: lab.slug, title: lab.title } : null)
const minutesOf = (path: Path) => path.labs.reduce((sum, lab) => sum + lab.minutes, 0)
const completed = (progress: Map<string, LabProgress>) => [...progress.values()].filter((p) => p.status === 'completed').length

function mustBeOpen(path: Path, lab: Lab, progress: Map<string, LabProgress>) {
  const state = progress.get(lab.slug)!
  if (state.status === 'locked') throw new HttpError(403, `Finish "${state.requires?.title}" first.`)
}

function check(question: Question, lab: Lab, userId: string, answer: string): boolean {
  if (question.flag) {
    const expected = Buffer.from(machineFlag(lab.machine!.flag!, userId, lab.slug))
    const given = Buffer.from(answer.trim())
    return expected.length === given.length && timingSafeEqual(expected, given)
  }
  return question.hashes.has(sha256(normalise(answer, question.caseSensitive)))
}

route('GET', '/api/labs/health', async () => ({ ok: true }))

route('GET', '/api/labs/paths', async (ctx) => {
  const solves = await solvesOf((await ctx.user())?.id)
  return content.paths.map((path) => ({
    slug: path.slug,
    title: path.title,
    summary: path.summary,
    level: path.level,
    modules: path.modules.length,
    labs: path.labs.length,
    minutes: minutesOf(path),
    completedLabs: completed(pathProgress(path, solves)),
  }))
})

route('GET', '/api/labs/paths/:path', async (ctx) => {
  const path = findPath(ctx.params.path!)
  const user = await ctx.user()
  const progress = pathProgress(path, await solvesOf(user?.id))
  return {
    slug: path.slug,
    title: path.title,
    summary: path.summary,
    description: path.description,
    level: path.level,
    sequential: path.sequential,
    signedIn: Boolean(user),
    labs: path.labs.length,
    minutes: minutesOf(path),
    completedLabs: completed(progress),
    next: link(nextLab(path, progress)),
    modules: path.modules.map((module) => ({
      title: module.title,
      summary: module.summary,
      labs: module.labs.map((lab) => {
        const state = progress.get(lab.slug)!
        return {
          slug: lab.slug,
          title: lab.title,
          summary: lab.summary,
          difficulty: lab.difficulty,
          minutes: lab.minutes,
          machine: Boolean(lab.machine),
          status: state.status,
          solved: state.solved,
          total: state.total,
          requires: link(state.requires),
        }
      }),
    })),
  }
})

route('GET', '/api/labs/paths/:path/labs/:lab', async (ctx) => {
  const user = await ctx.signedIn()
  const path = findPath(ctx.params.path!)
  const lab = findLab(path, ctx.params.lab!)
  const solves = await solvesOf(user.id)
  const progress = pathProgress(path, solves)
  const state = progress.get(lab.slug)!
  const index = path.labs.indexOf(lab)
  const done = solves.get(lab.slug) ?? new Set()

  return {
    slug: lab.slug,
    title: lab.title,
    summary: lab.summary,
    difficulty: lab.difficulty,
    minutes: lab.minutes,
    path: { slug: path.slug, title: path.title },
    module: path.modules.find((m) => m.labs.includes(lab))?.title ?? '',
    status: state.status,
    solved: state.solved,
    total: state.total,
    requires: link(state.requires),
    previous: link(path.labs[index - 1]),
    next: link(path.labs[index + 1]),
    machine: lab.machine ? { port: lab.machine.port } : null,
    // a locked lab shows only what to do first
    tasks:
      state.status === 'locked'
        ? []
        : lab.tasks.map((task) => ({
            title: task.title,
            content: task.content,
            questions: task.questions.map((q) => ({
              id: q.id,
              question: q.question,
              format: q.format ?? null,
              hint: q.hint ?? null,
              flag: q.flag,
              solved: done.has(q.id),
            })),
          })),
  }
})

route('POST', '/api/labs/paths/:path/labs/:lab/questions/:question', async (ctx) => {
  const user = await ctx.signedIn()
  const path = findPath(ctx.params.path!)
  const lab = findLab(path, ctx.params.lab!)
  const question = lab.questions.find((q) => q.id === ctx.params.question)
  if (!question) throw new HttpError(404, 'There is no such question in this lab.')

  const before = pathProgress(path, await solvesOf(user.id))
  mustBeOpen(path, lab, before)

  const { answer } = await ctx.body<{ answer?: unknown }>()
  if (typeof answer !== 'string' || !answer.trim()) throw new HttpError(400, 'Type an answer first.')
  if (answer.length > 200) throw new HttpError(400, 'That answer is too long.')
  // learning, not a race: no limit on attempts, but no guessing scripts either
  if (!allow(`answer:${user.id}`, 10, 6_000)) {
    throw new HttpError(429, 'That is a lot of answers in a short time. Wait a few seconds, then try again.')
  }

  const correct = check(question, lab, user.id, answer)
  await db.query('INSERT INTO attempts (user_id, lab, question, correct, ip) VALUES ($1, $2, $3, $4, $5)', [
    user.id,
    lab.slug,
    question.id,
    correct,
    clientIp(ctx.req),
  ])
  if (correct) {
    await db.query('INSERT INTO solves (user_id, lab, question) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
      user.id,
      lab.slug,
      question.id,
    ])
  }

  const after = pathProgress(path, await solvesOf(user.id))
  const state = after.get(lab.slug)!
  return {
    correct,
    solved: state.solved,
    total: state.total,
    labCompleted: state.status === 'completed',
    next: link(nextLab(path, after)),
  }
})

// the machine with the title of its lab, for "your machine for <lab> is running"
const titled = (info: MachineInfo | null) =>
  info && { ...info, title: content.bySlug.get(info.path)?.labs.find((l) => l.slug === info.lab)?.title ?? info.lab }

route('GET', '/api/labs/machine', async (ctx) => titled(await currentMachine((await ctx.signedIn()).id)))

route('POST', '/api/labs/paths/:path/labs/:lab/machine', async (ctx) => {
  const user = await ctx.signedIn()
  const path = findPath(ctx.params.path!)
  const lab = findLab(path, ctx.params.lab!)
  mustBeOpen(path, lab, pathProgress(path, await solvesOf(user.id)))
  if (!allow(`machine:${user.id}`, 3, 60_000)) {
    throw new HttpError(429, 'You are starting machines too quickly. Wait a minute, then try again.')
  }
  return titled(await startMachine(user, path, lab))
})

route('POST', '/api/labs/machine/extend', async (ctx) => titled(await extendMachine((await ctx.signedIn()).id)))

route('DELETE', '/api/labs/machine', async (ctx) => {
  await stopMachine((await ctx.signedIn()).id)
  return null
})

// Reads the labs folder again after an edit, without restarting the service.
route('POST', '/api/labs/admin/reload', async (ctx) => {
  await ctx.admin()
  try {
    content = loadContent(config.contentDir)
  } catch (error) {
    if (error instanceof ContentError) throw new HttpError(400, error.message)
    throw error
  }
  return { paths: content.paths.length, labs: content.paths.reduce((sum, path) => sum + path.labs.length, 0) }
})
