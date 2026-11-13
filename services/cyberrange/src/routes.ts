// The CyberRange API, under /api/range: skill paths, modules, labs and machines. The proxy
// in front sends these requests here and everything else to the platform. Profiles, the
// ranking and certificates are in community.ts.

import { timingSafeEqual } from 'node:crypto'
import { join } from 'node:path'
import { clientIp, forgetUser, isStaff, isSuperadmin, roleOf, SKILL_LEVELS, type User } from './auth.js'
import { stopBox } from './boxes.js'
import {
  ContentError,
  type Lab,
  type Module,
  normalise,
  type Path,
  type Question,
  type Section,
  sectionXp,
  sha256,
} from './content.js'
import { db } from './db.js'
import { type Context, FileReply, HttpError, route } from './http.js'
import { currentMachine, extendMachine, machineFlag, type MachineInfo, startMachine, stopMachine } from './machines.js'
import { platform } from './platform.js'
import { allAnswered, type ModuleState, moduleState, pathState, type Progress, progressOf, solvedIn } from './progress.js'
import { allow } from './ratelimit.js'
import { content, contentSize } from './state.js'
import { positionOf, syncCertificates } from './stats.js'
import { documentFile, reloadContent } from './studio.js'
import { labSummary, link, moduleSummary, pathsOf, pathSummary } from './views.js'
import { standing, xpOf } from './xp.js'

const BASE = '/api/range'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

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

function findLab(slug: string): Lab {
  const lab = content.labBySlug.get(slug)
  if (!lab) throw new HttpError(404, 'There is no such lab.')
  return lab
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

// how many students solved each lab
async function solversOf(): Promise<Map<string, number>> {
  const { rows } = await db.query<{ module: string; n: number }>(
    "SELECT module, count(DISTINCT user_id)::int AS n FROM completions WHERE module LIKE 'lab:%' GROUP BY module"
  )
  return new Map(rows.map((row) => [row.module, row.n]))
}

// Records a right answer (or, without a question, a section read to the end) and says what
// it earned: the XP, and whether it finished the section or the module (for a lab: the
// lab), or raised the student's level or rank.
async function award(user: User, module: Module, section: Section, before: Progress, question?: Question) {
  const wasCompleted = moduleState(module, before).status === 'completed'
  const standingBefore = standing((await xpOf(user.id)).total)

  let gained = 0
  if (question) {
    const solve = await db.query(
      `INSERT INTO solves (user_id, module, section, question, xp, flag) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [user.id, module.slug, section.slug, question.id, question.xp, question.flag]
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
  const moduleCompleted = state.status === 'completed' && !wasCompleted
  // finishing a module, and with it perhaps a path, earns a certificate
  if (moduleCompleted) await syncCertificates(user.id)
  const standingAfter = standing((await xpOf(user.id)).total)
  return {
    xp: gained,
    sectionCompleted,
    moduleCompleted,
    next: link(state.next),
    standing: standingAfter,
    levelUp: standingAfter.level > standingBefore.level,
    rankUp: standingAfter.rankIndex > standingBefore.rankIndex,
  }
}

const WRONG = {
  correct: false,
  xp: 0,
  sectionCompleted: false,
  moduleCompleted: false,
  next: null,
  standing: null,
  levelUp: false,
  rankUp: false,
}

// Checks an answer to a question of a section, or to a task of a lab, and records it.
async function answerQuestion(ctx: Context, user: User, module: Module, section: Section) {
  const question = section.questions.find((q) => q.id === ctx.params.question)
  if (!question) throw new HttpError(404, 'There is no such question here.')

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
  if (!correct) return WRONG
  return { correct, ...(await award(user, module, section, progress, question)) }
}

// the machine with the names of what it belongs to, for "your machine for <section> is running"
function titled(info: MachineInfo | null) {
  if (!info) return null
  const module = content.unitByKey.get(info.module)
  const section = module?.sections.find((s) => s.slug === info.section)
  const lab = content.labByKey.get(info.module)
  return {
    ...info,
    title: section?.title ?? info.section,
    moduleTitle: module?.title ?? info.module,
    // where the machine is used: a lab, or a section of a module
    lab: lab?.slug ?? null,
  }
}

async function launch(user: User, module: Module, section: Section) {
  if (!allow(`machine:${user.id}`, 3, 60_000)) {
    throw new HttpError(429, 'You are starting machines too quickly. Wait a minute, then try again.')
  }
  return titled(await startMachine(user, module, section))
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
    ...(await positionOf(user.id)),
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
  return answerQuestion(ctx, user, module, findSection(module, ctx.params.section!))
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
  if (!allow(`complete:${user.id}`, 20, 3_000)) {
    throw new HttpError(429, 'Slow down a little, then try again.')
  }
  return award(user, module, section, progress)
})

route('POST', `${BASE}/modules/:module/sections/:section/machine`, async (ctx) => {
  const user = await ctx.signedIn()
  const module = findModule(ctx.params.module!)
  const section = findSection(module, ctx.params.section!)
  mustBeOpen(moduleState(module, await progressOf(user.id), isStaff(user)), section)
  return launch(user, module, section)
})

// ---- labs ----

route('GET', `${BASE}/labs`, async (ctx) => {
  const user = await ctx.user()
  const [progress, solvers] = await Promise.all([progressOf(user?.id), solversOf()])
  return content.labs.map((lab) => labSummary(lab, progress, solvers))
})

route('GET', `${BASE}/labs/:lab`, async (ctx) => {
  const lab = findLab(ctx.params.lab!)
  const user = await ctx.user()
  const [progress, solvers] = await Promise.all([progressOf(user?.id), solversOf()])
  const solved = solvedIn(progress, lab.module, lab.section)
  const { rows: first } = await db.query<{ name: string; completed_at: Date }>(
    `SELECT u.name, c.completed_at FROM completions c JOIN users u ON u.id = c.user_id
     WHERE c.module = $1 ORDER BY c.completed_at LIMIT 1`,
    [lab.key]
  )
  return {
    ...labSummary(lab, progress, solvers),
    scenario: lab.scenario,
    bonus: lab.section.xp,
    signedIn: Boolean(user),
    machine: lab.section.machine ? { port: lab.section.machine.port } : null,
    // the names the machine is kept under, to tell whether a running one is this lab's
    machineKey: { module: lab.key, section: lab.section.slug },
    files: lab.files.map((file) => ({
      name: file.name,
      size: file.size,
      url: `${BASE}/labs/${lab.slug}/files/${encodeURIComponent(file.name)}`,
    })),
    // whoever solved it first
    firstSolve: first[0] ? { name: first[0].name, at: first[0].completed_at.toISOString() } : null,
    tasks: lab.section.questions.map((q) => ({
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

route('POST', `${BASE}/labs/:lab/tasks/:question`, async (ctx) => {
  const user = await ctx.signedIn()
  const lab = findLab(ctx.params.lab!)
  return answerQuestion(ctx, user, lab.module, lab.section)
})

route('POST', `${BASE}/labs/:lab/machine`, async (ctx) => {
  const user = await ctx.signedIn()
  const lab = findLab(ctx.params.lab!)
  if (!lab.section.machine) throw new HttpError(400, 'This lab has no machine.')
  return launch(user, lab.module, lab.section)
})

route('GET', `${BASE}/labs/:lab/files/@file`, async (ctx) => {
  const lab = findLab(ctx.params.lab!)
  const file = lab.files.find((f) => f.name === ctx.params.file)
  if (!file) throw new HttpError(404, 'There is no such file in this lab.')
  if (lab.document) return documentFile(lab.document, file.name)
  return new FileReply(join(lab.dir, 'files', file.name), file.name, file.size)
})

// ---- machines ----

route('GET', `${BASE}/machine`, async (ctx) => titled(await currentMachine((await ctx.signedIn()).id)))

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
    await reloadContent()
  } catch (error) {
    if (error instanceof ContentError) throw new HttpError(400, error.message)
    throw error
  }
  return contentSize()
})

// Everyone who has signed in, with their role and verified mark.
route('GET', `${BASE}/admin/users`, async (ctx) => {
  await ctx.superadmin()
  const { rows } = await db.query<{
    id: string
    name: string
    avatar: string | null
    role: string
    admin: boolean
    verified: boolean
    skill_level: string | null
    last_active_at: Date
    xp: number
  }>(
    `SELECT u.id, u.name, u.avatar, u.role, u.admin, u.verified, u.skill_level, u.last_active_at,
            coalesce(x.xp, 0)::int AS xp
     FROM users u
     LEFT JOIN (SELECT user_id, sum(xp) AS xp FROM xp_events GROUP BY user_id) x ON x.user_id = u.id
     ORDER BY lower(u.name)`
  )
  return rows.map((row) => {
    const { rank, rankIndex, level } = standing(row.xp)
    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      // student or tutor as kept here; admin or superadmin from the platform account
      role: roleOf(row.id, row.name, row.admin, row.role),
      admin: row.admin,
      verified: row.verified,
      skillLevel: row.skill_level,
      xp: row.xp,
      rank,
      rankIndex,
      level,
      lastActiveAt: row.last_active_at.toISOString(),
    }
  })
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

// The tick next to a name on profiles and in the ranking.
route('PUT', `${BASE}/admin/users/:id/verified`, async (ctx) => {
  await ctx.superadmin()
  const { verified } = await ctx.body<{ verified?: unknown }>()
  if (typeof verified !== 'boolean') throw new HttpError(400, 'Send { "verified": true } or false.')
  const id = ctx.params.id!
  const { rows } = UUID.test(id)
    ? await db.query<{ id: string; name: string; verified: boolean }>(
        'UPDATE users SET verified = $2 WHERE id = $1 RETURNING id, name, verified',
        [id, verified]
      )
    : { rows: [] }
  if (!rows[0]) throw new HttpError(404, 'There is no such user here. People appear after their first visit.')
  return rows[0]
})

// Makes someone a platform admin, or an ordinary member again, with the superadmin's own
// sign-in on the platform.
route('PUT', `${BASE}/admin/users/:id/admin`, async (ctx) => {
  const me = await ctx.superadmin()
  const { admin } = await ctx.body<{ admin?: unknown }>()
  if (typeof admin !== 'boolean') throw new HttpError(400, 'Send { "admin": true } or false.')
  const id = ctx.params.id!
  const { rows } = UUID.test(id) ? await db.query<{ name: string }>('SELECT name FROM users WHERE id = $1', [id]) : { rows: [] }
  if (!rows[0]) throw new HttpError(404, 'There is no such user here. People appear after their first visit.')
  if (id === me.id) throw new HttpError(400, 'You cannot change your own role.')
  if (isSuperadmin(id, rows[0].name)) throw new HttpError(400, "Superadmins are named in the server's settings.")

  await platform(ctx.req, 'PUT', `/api/admin/users/${id}`, { role: admin ? 'Admin' : 'User' })
  await db.query('UPDATE users SET admin = $2 WHERE id = $1', [id, admin])
  forgetUser(id)
  return { id, name: rows[0].name, admin }
})

// Removes everything kept here about someone.
async function forget(id: string) {
  await stopMachine(id)
  await stopBox(id)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const table of ['solves', 'completions', 'attempts', 'certificates']) {
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
}

// For accounts that were deleted on the platform some other way.
route('DELETE', `${BASE}/admin/users/:id`, async (ctx) => {
  await ctx.superadmin()
  const id = ctx.params.id!
  if (!UUID.test(id)) throw new HttpError(404, 'There is no such user here.')
  await forget(id)
  return null
})

// ---- the gate ----
// The proxy sends the platform's own requests that change or remove an account here first.
// Any admin may look after members: edit them, ban them, reset a password, delete them. Only
// the superadmin gives or takes a role, or touches the account of an admin, so that no admin
// can take another's place, for instance by resetting the superadmin's password.

// the roles an admin may move a member between
const MEMBER_ROLES = ['User', 'Banned']

async function gate(ctx: Context, role?: unknown): Promise<string> {
  const user = await ctx.admin()
  const id = ctx.params.id!.toLowerCase()
  if (!UUID.test(id)) throw new HttpError(404, 'There is no such user.')
  if (user.role === 'superadmin') return id

  const current = (await platform<{ role?: string }>(ctx.req, 'GET', `/api/admin/users/${id}`)).role
  if (current === 'Admin') throw new HttpError(403, "Only the superadmin can change an admin's account.")
  const changing = role !== undefined && role !== null && role !== current
  if (changing && !(MEMBER_ROLES.includes(String(current)) && MEMBER_ROLES.includes(String(role)))) {
    throw new HttpError(403, 'Only the superadmin can give or take a role.')
  }
  return id
}

route('PUT', `${BASE}/gate/api/admin/users/@id`, async (ctx) => {
  await ctx.admin()
  const body = await ctx.body<Record<string, unknown>>(64 * 1024)
  const id = await gate(ctx, body.role)
  const reply = await platform(ctx.req, 'PUT', `/api/admin/users/${id}`, body)
  if (body.role !== undefined) forgetUser(id)
  return reply
})

route('DELETE', `${BASE}/gate/api/admin/users/@id`, async (ctx) => {
  const id = await gate(ctx)
  const reply = await platform(ctx.req, 'DELETE', `/api/admin/users/${id}`)
  // what they did here goes with the account
  await forget(id)
  return reply
})

// answers with the new password, as the platform does
route('DELETE', `${BASE}/gate/api/admin/users/@id/password`, async (ctx) => {
  const id = await gate(ctx)
  return platform(ctx.req, 'DELETE', `/api/admin/users/${id}/password`)
})
