// The CyberRange API, under /api/range. The proxy in front sends these requests here and
// everything else to the platform.

import { timingSafeEqual } from 'node:crypto'
import { clientIp, forgetUser, isStaff, SKILL_LEVELS, type User } from './auth.js'
import { config } from './config.js'
import {
  type Content,
  ContentError,
  loadContent,
  type Module,
  normalise,
  type Path,
  type Question,
  type Section,
  sectionXp,
  sha256,
} from './content.js'
import { db } from './db.js'
import { HttpError, route } from './http.js'
import { currentMachine, extendMachine, machineFlag, type MachineInfo, startMachine, stopMachine } from './machines.js'
import {
  allAnswered,
  type ModuleState,
  moduleState,
  type PathState,
  pathState,
  type Progress,
  progressOf,
  solvedIn,
} from './progress.js'
import { allow } from './ratelimit.js'
import { standing, xpOf } from './xp.js'

const BASE = '/api/range'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

let content: Content

export function setContent(next: Content) {
  content = next
}

export const contentSize = () => ({
  paths: content.paths.length,
  modules: content.modules.length,
  sections: content.modules.reduce((sum, module) => sum + module.sections.length, 0),
})

function findPath(slug: string): Path {
  const path = content.pathBySlug.get(slug)
  if (!path) throw new HttpError(404, 'There is no such skill path.')
  return path
}

function findModule(slug: string): Module {
  const module = content.moduleBySlug.get(slug)
  if (!module) throw new HttpError(404, 'There is no such module.')
  return module
}

function findSection(module: Module, slug: string): Section {
  const section = module.sections.find((s) => s.slug === slug)
  if (!section) throw new HttpError(404, 'There is no such section in this module.')
  return section
}

const link = (section: Section | undefined) => (section ? { slug: section.slug, title: section.title } : null)

const pathsOf = (module: Module) =>
  content.paths.filter((path) => path.modules.includes(module)).map((path) => ({ slug: path.slug, title: path.title }))

function moduleSummary(module: Module, state: ModuleState) {
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

function pathSummary(path: Path, state: PathState, user: User | null) {
  return {
    slug: path.slug,
    title: path.title,
    summary: path.summary,
    difficulty: path.difficulty,
    icon: path.icon ?? null,
    minutes: path.modules.reduce((sum, module) => sum + module.minutes, 0),
    xp: path.modules.reduce((sum, module) => sum + module.xp, 0),
    moduleCount: path.modules.length,
    completedModules: state.completedModules,
    sections: state.total,
    done: state.done,
    enrolled: user?.enrolledPath === path.slug,
  }
}

function mustBeOpen(state: ModuleState, section: Section) {
  const mine = state.sections.get(section.slug)!
  if (mine.status === 'locked') throw new HttpError(403, `Finish "${mine.requires?.title}" first.`)
}

function check(question: Question, module: Module, section: Section, userId: string, answer: string): boolean {
  if (question.flag) {
    const expected = Buffer.from(machineFlag(section.machine!.flag!, userId, module, section))
    const given = Buffer.from(answer.trim())
    return expected.length === given.length && timingSafeEqual(expected, given)
  }
  return question.hashes.has(sha256(normalise(answer, question.caseSensitive)))
}

// Records a right answer (or, without a question, a section read to the end) and says what
// it earned: the XP, and whether it finished the section or the module, or raised the
// student's level or rank.
async function award(user: User, module: Module, section: Section, before: Progress, question?: Question) {
  const wasCompleted = moduleState(module, before).status === 'completed'
  const standingBefore = standing((await xpOf(user.id)).total)

  let gained = 0
  if (question) {
    const solve = await db.query(
      'INSERT INTO solves (user_id, module, section, question, xp) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [user.id, module.slug, section.slug, question.id, question.xp]
    )
    if (solve.rowCount) gained += question.xp
  }

  let progress = await progressOf(user.id)
  let sectionCompleted = false
  if (!question || allAnswered(progress, module, section)) {
    const completion = await db.query(
      'INSERT INTO completions (user_id, module, section, xp) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [user.id, module.slug, section.slug, section.xp]
    )
    if (completion.rowCount) {
      gained += section.xp
      sectionCompleted = true
      progress = await progressOf(user.id)
    }
  }

  const state = moduleState(module, progress, isStaff(user))
  const standingAfter = standing((await xpOf(user.id)).total)
  return {
    xp: gained,
    sectionCompleted,
    moduleCompleted: state.status === 'completed' && !wasCompleted,
    next: link(state.next),
    standing: standingAfter,
    levelUp: standingAfter.level > standingBefore.level,
    rankUp: standingAfter.rankIndex > standingBefore.rankIndex,
  }
}

route('GET', `${BASE}/health`, async () => ({ ok: true }))

// ---- the student ----

async function me(user: User) {
  const xp = await xpOf(user.id)
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    skillLevel: user.skillLevel,
    // a path that has since been removed no longer counts
    enrolledPath: user.enrolledPath && content.pathBySlug.has(user.enrolledPath) ? user.enrolledPath : null,
    ...standing(xp.total),
    weekXp: xp.week,
  }
}

route('GET', `${BASE}/me`, async (ctx) => me(await ctx.signedIn()))

route('PUT', `${BASE}/me`, async (ctx) => {
  const user = await ctx.signedIn()
  const body = await ctx.body<{ skillLevel?: unknown; enrolledPath?: unknown }>()
  let { skillLevel, enrolledPath } = user

  if (body.skillLevel !== undefined) {
    const level = SKILL_LEVELS.find((l) => l === body.skillLevel)
    if (!level) throw new HttpError(400, 'Choose beginner, intermediate or expert.')
    skillLevel = level
  }
  if (body.enrolledPath !== undefined) {
    if (body.enrolledPath === null) enrolledPath = null
    else if (typeof body.enrolledPath === 'string' && content.pathBySlug.has(body.enrolledPath)) {
      enrolledPath = body.enrolledPath
    } else throw new HttpError(404, 'There is no such skill path.')
  }

  await db.query('UPDATE users SET skill_level = $2, enrolled_path = $3 WHERE id = $1', [user.id, skillLevel, enrolledPath])
  forgetUser(user.id)
  return me({ ...user, skillLevel, enrolledPath })
})

// ---- skill paths ----

route('GET', `${BASE}/paths`, async (ctx) => {
  const user = await ctx.user()
  const progress = await progressOf(user?.id)
  return content.paths.map((path) => pathSummary(path, pathState(path, progress, isStaff(user)), user))
})

route('GET', `${BASE}/paths/:path`, async (ctx) => {
  const path = findPath(ctx.params.path!)
  const user = await ctx.user()
  const state = pathState(path, await progressOf(user?.id), isStaff(user))
  return {
    ...pathSummary(path, state, user),
    description: path.description,
    signedIn: Boolean(user),
    next: state.next && {
      module: state.next.module.slug,
      section: state.next.section.slug,
      title: state.next.section.title,
    },
    modules: path.modules.map((module) => moduleSummary(module, state.modules.get(module.slug)!)),
  }
})

// ---- modules ----

route('GET', `${BASE}/modules`, async (ctx) => {
  const user = await ctx.user()
  const progress = await progressOf(user?.id)
  return content.modules.map((module) => ({
    ...moduleSummary(module, moduleState(module, progress, isStaff(user))),
    paths: pathsOf(module),
  }))
})

route('GET', `${BASE}/modules/:module`, async (ctx) => {
  const module = findModule(ctx.params.module!)
  const user = await ctx.user()
  const state = moduleState(module, await progressOf(user?.id), isStaff(user))
  return {
    ...moduleSummary(module, state),
    description: module.description,
    updated: module.updated ?? null,
    sequential: module.sequential,
    signedIn: Boolean(user),
    paths: pathsOf(module),
    next: link(state.next),
    chapters: module.chapters.map((chapter) => ({
      title: chapter.title,
      sections: chapter.sections.map((section) => {
        const mine = state.sections.get(section.slug)!
        return {
          slug: section.slug,
          title: section.title,
          status: mine.status,
          solved: mine.solved,
          total: mine.total,
          machine: Boolean(section.machine),
          xp: sectionXp(section),
        }
      }),
    })),
  }
})

route('GET', `${BASE}/modules/:module/sections/:section`, async (ctx) => {
  const user = await ctx.signedIn()
  const module = findModule(ctx.params.module!)
  const section = findSection(module, ctx.params.section!)
  const progress = await progressOf(user.id)
  const state = moduleState(module, progress, isStaff(user))
  const mine = state.sections.get(section.slug)!
  const index = module.sections.indexOf(section)
  const solved = solvedIn(progress, module, section)
  const locked = mine.status === 'locked'

  return {
    slug: section.slug,
    title: section.title,
    module: {
      slug: module.slug,
      title: module.title,
      category: module.category,
      icon: module.icon ?? null,
      sections: state.total,
      done: state.done,
    },
    chapter: module.chapters.find((chapter) => chapter.sections.includes(section))?.title ?? '',
    number: index + 1,
    of: module.sections.length,
    status: mine.status,
    requires: link(mine.requires),
    previous: link(module.sections[index - 1]),
    next: link(module.sections[index + 1]),
    xp: section.xp,
    machine: section.machine ? { port: section.machine.port } : null,
    // a locked section shows only what to finish first
    content: locked ? null : section.content,
    questions: locked
      ? []
      : section.questions.map((q) => ({
          id: q.id,
          question: q.question,
          format: q.format ?? null,
          hint: q.hint ?? null,
          flag: q.flag,
          xp: q.xp,
          solved: solved.has(q.id),
        })),
  }
})

route('POST', `${BASE}/modules/:module/sections/:section/questions/:question`, async (ctx) => {
  const user = await ctx.signedIn()
  const module = findModule(ctx.params.module!)
  const section = findSection(module, ctx.params.section!)
  const question = section.questions.find((q) => q.id === ctx.params.question)
  if (!question) throw new HttpError(404, 'There is no such question in this section.')

  const progress = await progressOf(user.id)
  mustBeOpen(moduleState(module, progress, isStaff(user)), section)

  const { answer } = await ctx.body<{ answer?: unknown }>()
  if (typeof answer !== 'string' || !answer.trim()) throw new HttpError(400, 'Type an answer first.')
  if (answer.length > 200) throw new HttpError(400, 'That answer is too long.')
  // learning, not a race: no limit on attempts, but no guessing scripts either
  if (!allow(`answer:${user.id}`, 10, 6_000)) {
    throw new HttpError(429, 'That is a lot of answers in a short time. Wait a few seconds, then try again.')
  }

  const correct = check(question, module, section, user.id, answer)
  await db.query(
    'INSERT INTO attempts (user_id, module, section, question, correct, ip) VALUES ($1, $2, $3, $4, $5, $6)',
    [user.id, module.slug, section.slug, question.id, correct, clientIp(ctx.req)]
  )
  if (!correct) {
    return {
      correct,
      xp: 0,
      sectionCompleted: false,
      moduleCompleted: false,
      next: null,
      standing: null,
      levelUp: false,
      rankUp: false,
    }
  }
  return { correct, ...(await award(user, module, section, progress, question)) }
})

// For a section without questions: reading it to the end finishes it.
route('POST', `${BASE}/modules/:module/sections/:section/complete`, async (ctx) => {
  const user = await ctx.signedIn()
  const module = findModule(ctx.params.module!)
  const section = findSection(module, ctx.params.section!)
  const progress = await progressOf(user.id)
  mustBeOpen(moduleState(module, progress, isStaff(user)), section)
  if (section.questions.length > 0 && !allAnswered(progress, module, section)) {
    throw new HttpError(400, 'Answer the questions in this section to finish it.')
  }
  return award(user, module, section, progress)
})

// ---- machines ----

// the machine with the names of what it belongs to, for "your machine for <section> is running"
function titled(info: MachineInfo | null) {
  if (!info) return null
  const module = content.moduleBySlug.get(info.module)
  const section = module?.sections.find((s) => s.slug === info.section)
  return { ...info, title: section?.title ?? info.section, moduleTitle: module?.title ?? info.module }
}

route('GET', `${BASE}/machine`, async (ctx) => titled(await currentMachine((await ctx.signedIn()).id)))

route('POST', `${BASE}/modules/:module/sections/:section/machine`, async (ctx) => {
  const user = await ctx.signedIn()
  const module = findModule(ctx.params.module!)
  const section = findSection(module, ctx.params.section!)
  mustBeOpen(moduleState(module, await progressOf(user.id), isStaff(user)), section)
  if (!allow(`machine:${user.id}`, 3, 60_000)) {
    throw new HttpError(429, 'You are starting machines too quickly. Wait a minute, then try again.')
  }
  return titled(await startMachine(user, module, section))
})

route('POST', `${BASE}/machine/extend`, async (ctx) => titled(await extendMachine((await ctx.signedIn()).id)))

route('DELETE', `${BASE}/machine`, async (ctx) => {
  await stopMachine((await ctx.signedIn()).id)
  return null
})

// ---- admins ----

// Reads the content folder again after an edit, without restarting the service.
route('POST', `${BASE}/admin/reload`, async (ctx) => {
  await ctx.admin()
  try {
    content = loadContent(config.contentDir)
  } catch (error) {
    if (error instanceof ContentError) throw new HttpError(400, error.message)
    throw error
  }
  return contentSize()
})

// Everyone who has signed in, with the role kept here. Admins are not marked: whether
// someone is one is decided by their platform account, each time they sign in.
route('GET', `${BASE}/admin/users`, async (ctx) => {
  await ctx.superadmin()
  const { rows } = await db.query<{
    id: string
    name: string
    role: string
    skill_level: string | null
    last_active_at: Date
    xp: number
  }>(
    `SELECT u.id, u.name, u.role, u.skill_level, u.last_active_at, coalesce(x.xp, 0)::int AS xp
     FROM users u
     LEFT JOIN (SELECT user_id, sum(xp) AS xp FROM xp_events GROUP BY user_id) x ON x.user_id = u.id
     ORDER BY lower(u.name)`
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    skillLevel: row.skill_level,
    xp: row.xp,
    lastActiveAt: row.last_active_at.toISOString(),
  }))
})

route('PUT', `${BASE}/admin/users/:id/role`, async (ctx) => {
  await ctx.superadmin()
  const { role } = await ctx.body<{ role?: unknown }>()
  if (role !== 'tutor' && role !== 'student') {
    throw new HttpError(400, "The role must be tutor or student. Admins are made in the platform's own admin pages.")
  }
  const id = ctx.params.id!
  const { rows } = UUID.test(id)
    ? await db.query<{ id: string; name: string; role: string }>(
        'UPDATE users SET role = $2 WHERE id = $1 RETURNING id, name, role',
        [id, role]
      )
    : { rows: [] }
  if (!rows[0]) throw new HttpError(404, 'There is no such user here. People appear after their first visit.')
  forgetUser(rows[0].id)
  return rows[0]
})

// Removes everything kept here about someone: for accounts that were deleted on the platform.
route('DELETE', `${BASE}/admin/users/:id`, async (ctx) => {
  await ctx.superadmin()
  const id = ctx.params.id!
  if (!UUID.test(id)) throw new HttpError(404, 'There is no such user here.')
  await stopMachine(id)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const table of ['solves', 'completions', 'attempts']) {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [id])
    }
    await client.query('DELETE FROM users WHERE id = $1', [id])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  forgetUser(id)
  return null
})
