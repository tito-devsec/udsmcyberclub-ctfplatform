// Practice machines: one Docker container per student, started on request and removed when
// it expires. They run like the platform's challenge instances: on the isolated network (no
// traffic between machines, no internet), with memory, CPU and process limits.

import { createHmac } from 'node:crypto'
import type { User } from './auth.js'
import { config } from './config.js'
import type { Module, Section } from './content.js'
import { db } from './db.js'
import { docker } from './docker.js'
import { HttpError } from './http.js'

export interface MachineInfo {
  module: string
  section: string
  entry: string
  startedAt: string
  expiresAt: string
  canExtend: boolean
}

interface Row {
  user_id: string
  module: string
  section: string
  container_id: string
  entry: string
  started_at: Date
  expires_at: Date
}

// [USER_HASH] in a machine's flag is worked out from the server's secret, so every student
// gets a different flag and no flag has to be stored anywhere.
export const userHash = (userId: string, purpose: string) =>
  createHmac('sha256', config.secret).update(`${userId}:${purpose}`).digest('hex').slice(0, 12)

export const machineFlag = (template: string, userId: string, module: Module, section: Section) =>
  template.replaceAll('[USER_HASH]', userHash(userId, `${module.slug}/${section.slug}`))

const toInfo = (row: Row): MachineInfo => ({
  module: row.module,
  section: row.section,
  entry: row.entry,
  startedAt: row.started_at.toISOString(),
  expiresAt: row.expires_at.toISOString(),
  canExtend: row.expires_at.getTime() - Date.now() <= config.renewalWindowMinutes * 60_000,
})

// one machine or attack box operation at a time for each student
const queues = new Map<string, Promise<void>>()
export async function exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
  const before = queues.get(key) ?? Promise.resolve()
  let release!: () => void
  const mine = new Promise<void>((resolve) => (release = resolve))
  const chained = before.then(() => mine)
  queues.set(key, chained)
  await before
  try {
    return await work()
  } finally {
    release()
    if (queues.get(key) === chained) queues.delete(key)
  }
}

async function removeContainer(idOrName: string) {
  await docker('DELETE', `/containers/${encodeURIComponent(idOrName)}?force=true`)
}

async function rowOf(userId: string): Promise<Row | undefined> {
  const { rows } = await db.query<Row>('SELECT * FROM machines WHERE user_id = $1', [userId])
  return rows[0]
}

// The container of the student's machine, while it runs.
export async function machineContainer(userId: string): Promise<string | null> {
  const row = await rowOf(userId)
  return row && row.expires_at.getTime() > Date.now() ? row.container_id : null
}

// What else happens when a machine has started: the attack box takes it in as its target.
type Started = (userId: string, containerId: string) => Promise<void>
const started: Started[] = []
export const afterMachineStart = (listener: Started) => void started.push(listener)

export async function currentMachine(userId: string): Promise<MachineInfo | null> {
  const row = await rowOf(userId)
  return row && row.expires_at.getTime() > Date.now() ? toInfo(row) : null
}

export function startMachine(user: User, module: Module, section: Section): Promise<MachineInfo> {
  const machine = section.machine
  if (!machine) throw new HttpError(400, 'This section has no machine.')

  return exclusive(user.id, async () => {
    const current = await rowOf(user.id)
    if (current?.module === module.slug && current.section === section.slug && current.expires_at.getTime() > Date.now()) {
      const { status, data } = await docker<{ State?: { Running?: boolean } }>('GET', `/containers/${current.container_id}/json`)
      if (status === 200 && data.State?.Running) return toInfo(current)
    }
    // a student has one machine at a time: starting another one replaces it
    if (current) await removeContainer(current.container_id)
    await db.query('DELETE FROM machines WHERE user_id = $1', [user.id])

    const name = `range-${userHash(user.id, 'container')}`
    await removeContainer(name) // a leftover with the same name, if any

    const port = `${machine.port}/tcp`
    const created = await docker<{ Id: string; message?: string }>('POST', `/containers/create?name=${name}`, {
      Image: machine.image,
      Env: machine.flag ? [`GZCTF_FLAG=${machineFlag(machine.flag, user.id, module, section)}`] : [],
      Labels: {
        // also picked up by the instance-limits service, like the platform's own instances
        ChallengeId: `range:${module.slug}/${section.slug}`,
        'udsm.range.user': user.id,
        'udsm.range.module': module.slug,
        'udsm.range.section': section.slug,
      },
      ExposedPorts: { [port]: {} },
      HostConfig: {
        Memory: machine.memory * 1024 * 1024,
        NanoCpus: Math.round(config.machineCpus * 1e9),
        CpuShares: 128,
        PidsLimit: config.machinePids,
        NetworkMode: config.machineNetwork,
        PortBindings: { [port]: [{ HostIp: '', HostPort: '' }] },
        SecurityOpt: ['no-new-privileges'],
      },
    })
    if (created.status === 404) throw new HttpError(503, "This section's machine is not installed on the server yet.")
    if (created.status !== 201) throw new Error(`Docker could not create the machine: ${created.status} ${created.data?.message ?? ''}`)

    const id = created.data.Id
    let hostPort = ''
    try {
      const started = await docker('POST', `/containers/${id}/start`)
      const inspected = await docker<{ NetworkSettings?: { Ports?: Record<string, { HostPort: string }[] | null> } }>(
        'GET',
        `/containers/${id}/json`
      )
      hostPort = inspected.data?.NetworkSettings?.Ports?.[port]?.[0]?.HostPort ?? ''
      if ((started.status !== 204 && started.status !== 304) || !hostPort) {
        throw new Error(`the machine did not start (${started.status})`)
      }
    } catch (error) {
      // Leave no half-started container behind. Docker may still be busy with it, so the student
      // is not kept waiting while it goes; if it cannot go now, reap() takes it later.
      removeContainer(id).catch(() => {})
      throw error
    }

    const now = new Date()
    const row: Row = {
      user_id: user.id,
      module: module.slug,
      section: section.slug,
      container_id: id,
      entry: `${config.publicEntry}:${hostPort}`,
      started_at: now,
      expires_at: new Date(now.getTime() + config.machineMinutes * 60_000),
    }
    await db.query(
      'INSERT INTO machines (user_id, module, section, container_id, entry, started_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [row.user_id, row.module, row.section, row.container_id, row.entry, row.started_at, row.expires_at]
    )
    // the machine is up either way: a listener that fails must not undo that
    for (const listener of started) {
      await listener(user.id, id).catch((error) => console.error('cyberrange: after a machine started:', error))
    }
    return toInfo(row)
  })
}

export function extendMachine(userId: string): Promise<MachineInfo> {
  return exclusive(userId, async () => {
    const row = await rowOf(userId)
    if (!row || row.expires_at.getTime() <= Date.now()) throw new HttpError(404, 'You have no machine running.')
    if (!toInfo(row).canExtend) {
      throw new HttpError(400, `A machine can be extended in its last ${config.renewalWindowMinutes} minutes.`)
    }
    row.expires_at = new Date(row.expires_at.getTime() + config.extendMinutes * 60_000)
    await db.query('UPDATE machines SET expires_at = $2 WHERE user_id = $1', [userId, row.expires_at])
    return toInfo(row)
  })
}

export function stopMachine(userId: string): Promise<void> {
  return exclusive(userId, async () => {
    const row = await rowOf(userId)
    if (!row) return
    // Forget it first, so it shows as stopped at once: removing the container can take a few
    // seconds. If removing it fails, reap() removes the container later.
    await db.query('DELETE FROM machines WHERE user_id = $1', [userId])
    await removeContainer(row.container_id)
  })
}

// Removes expired machines, and machine containers the database does not know about
// (left behind if the service stopped in the middle of something).
export async function reap() {
  const { rows } = await db.query<Row>('SELECT * FROM machines WHERE expires_at <= now()')
  for (const row of rows) {
    await exclusive(row.user_id, async () => {
      await removeContainer(row.container_id)
      await db.query('DELETE FROM machines WHERE user_id = $1 AND container_id = $2', [row.user_id, row.container_id])
    })
  }

  const filters = encodeURIComponent(JSON.stringify({ label: ['udsm.range.user'] }))
  const { data } = await docker<{ Id: string; Created: number }[]>('GET', `/containers/json?all=true&filters=${filters}`)
  if (!Array.isArray(data)) return
  const known = new Set((await db.query<Row>('SELECT container_id FROM machines')).rows.map((r) => r.container_id))
  for (const container of data) {
    // give a machine that is being started a moment to be recorded
    if (!known.has(container.Id) && Date.now() / 1000 - container.Created > 120) await removeContainer(container.Id)
  }
}
