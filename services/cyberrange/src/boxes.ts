// The attack box: a Kali Linux container of the student's own, with the tools the labs call
// for, used from the browser. It sits on a private network with nothing on it but the
// student's lab machine, which answers there as "target": no internet, no other student, not
// the server. A terminal is a shell that Docker starts in the box, carried over a WebSocket.

import { randomBytes } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { type WebSocket, WebSocketServer } from 'ws'
import { currentUser, type User } from './auth.js'
import { config } from './config.js'
import { db } from './db.js'
import { docker, dockerBytes, dockerExec, dockerStream, DockerTooLarge } from './docker.js'
import { BytesReply, HttpError, route } from './http.js'
import { afterMachineStart, currentMachine, exclusive, machineContainer, userHash } from './machines.js'
import { allow } from './ratelimit.js'
import { content } from './state.js'
import { firstFile, tarOf } from './tar.js'

const BASE = '/api/range'
const HOME = '/root'
const LABEL = 'udsm.range.box'

interface Row {
  user_id: string
  container_id: string
  network_id: string
  started_at: Date
  expires_at: Date
}

const toInfo = (row: Row) => ({
  startedAt: row.started_at.toISOString(),
  expiresAt: row.expires_at.toISOString(),
  canExtend: row.expires_at.getTime() - Date.now() <= config.renewalWindowMinutes * 60_000,
})

async function rowOf(userId: string): Promise<Row | undefined> {
  const { rows } = await db.query<Row>('SELECT * FROM boxes WHERE user_id = $1', [userId])
  return rows[0]
}

const running = (row: Row | undefined): row is Row => Boolean(row && row.expires_at.getTime() > Date.now())

// ---- private networks ----

// Docker's own ranges give about thirty networks. Boxes take theirs from a range set aside
// for them instead, sixteen addresses for each box.
const range = (() => {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(config.boxSubnets)
  const bits = Number(match?.[5])
  if (!match || bits < 8 || bits > 28) throw new Error('BOX_SUBNETS must be a range such as 10.213.0.0/16')
  const start = match.slice(1, 5).reduce((sum, part) => sum * 256 + Number(part), 0)
  return {
    count: 2 ** (28 - bits),
    at(index: number) {
      const n = start + index * 16
      return `${Math.floor(n / 2 ** 24)}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}/28`
    },
  }
})()

// Without an address of its own on the network, the server cannot be reached from a box.
// Docker has this from version 27.1; an older one gets the network without it.
let hidesServer = true

async function createNetwork(name: string, userId: string): Promise<string> {
  const filters = encodeURIComponent(JSON.stringify({ label: [LABEL] }))
  const listed = await docker<{ IPAM?: { Config?: { Subnet?: string }[] } }[]>('GET', `/networks?filters=${filters}`)
  const used = new Set((Array.isArray(listed.data) ? listed.data : []).flatMap((n) => n.IPAM?.Config ?? []).map((c) => c.Subnet))

  let clashes = 0
  for (let index = 0; index < range.count; index++) {
    const subnet = range.at(index)
    if (used.has(subnet)) continue
    const created = await docker<{ Id?: string; message?: string }>('POST', '/networks/create', {
      Name: name,
      Driver: 'bridge',
      // nothing on it reaches the internet or any other network
      Internal: true,
      IPAM: { Config: [{ Subnet: subnet }] },
      Options: hidesServer ? { 'com.docker.network.bridge.gateway_mode_ipv4': 'isolated' } : {},
      Labels: { [LABEL]: userId },
    })
    if (created.status === 201 && created.data.Id) return created.data.Id
    const message = created.data?.message ?? ''
    if (hidesServer && /gateway_mode|isolated|invalid option/i.test(message)) {
      console.warn('cyberrange: this Docker cannot hide the server from attack boxes (it needs 27.1 or newer)')
      hidesServer = false
      index--
    } else if (/overlap/i.test(message) && ++clashes < 20) {
      // taken a moment ago by another box, or in use by something else on this server
    } else {
      throw new Error(`Docker could not create a box network: ${created.status} ${message}`)
    }
  }
  throw new HttpError(503, 'Every attack box is in use right now. Try again in a few minutes.')
}

// Takes a network away: whatever is still on it (the lab machine) is taken off it first.
async function removeNetwork(idOrName: string) {
  const found = await docker<{ Containers?: Record<string, unknown> }>('GET', `/networks/${idOrName}`)
  if (found.status !== 200) return
  for (const container of Object.keys(found.data?.Containers ?? {})) {
    await docker('POST', `/networks/${idOrName}/disconnect`, { Container: container, Force: true })
  }
  await docker('DELETE', `/networks/${idOrName}`)
}

// The student's lab machine joins the box's network under the name "target".
async function attach(networkId: string, machineId: string) {
  const res = await docker<{ message?: string }>('POST', `/networks/${networkId}/connect`, {
    Container: machineId,
    EndpointConfig: { Aliases: ['target'] },
  })
  if (res.status !== 200 && !/already exists/i.test(res.data?.message ?? '')) {
    throw new Error(`Docker could not join the machine to the box: ${res.status} ${res.data?.message ?? ''}`)
  }
}

afterMachineStart(async (userId, machineId) => {
  const row = await rowOf(userId)
  if (running(row)) await attach(row.network_id, machineId)
})

// ---- starting and stopping ----

// The player's name as the box shows it in its prompt, and as the box's own name.
const playerName = (name: string) => name.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 32) || 'player'
const hostName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'player'

// Forgets a box and takes it down, with its network and its open terminals.
async function remove(row: Row, why?: string) {
  // forgotten first, so it shows as stopped at once; reapBoxes() clears up if Docker fails here
  await db.query('DELETE FROM boxes WHERE user_id = $1 AND container_id = $2', [row.user_id, row.container_id])
  hangUp(row.user_id, why)
  await docker('DELETE', `/containers/${row.container_id}?force=true`)
  await removeNetwork(row.network_id)
}

export function startBox(user: User) {
  return exclusive(user.id, async () => {
    const current = await rowOf(user.id)
    if (running(current)) {
      const found = await docker<{ State?: { Running?: boolean } }>('GET', `/containers/${current.container_id}/json`)
      if (found.status === 200 && found.data.State?.Running) return toInfo(current)
    }
    if (current) await remove(current)

    const taken = await db.query<{ count: string }>('SELECT count(*) FROM boxes WHERE expires_at > now()')
    if (Number(taken.rows[0]!.count) >= config.boxSeats) {
      throw new HttpError(503, 'Every attack box is in use right now. Try again in a few minutes.')
    }

    const name = `range-box-${userHash(user.id, 'box')}`
    // leftovers under this student's names, if any
    await docker('DELETE', `/containers/${name}?force=true`)
    await removeNetwork(name)

    const network = await createNetwork(name, user.id)
    try {
      const fileSize = config.boxDisk * 1024 * 1024
      const created = await docker<{ Id?: string; message?: string }>('POST', `/containers/create?name=${name}`, {
        Image: config.boxImage,
        Hostname: hostName(user.name),
        Env: [`CR_PLAYER=${playerName(user.name)}`],
        Labels: { [LABEL]: user.id },
        HostConfig: {
          Init: true,
          NetworkMode: name,
          Memory: config.boxMemory * 1024 * 1024,
          MemorySwap: config.boxMemory * 1024 * 1024,
          NanoCpus: Math.round(config.boxCpus * 1e9),
          CpuShares: 128,
          PidsLimit: config.boxPids,
          // root inside the box, but with little of root's power outside it: enough to
          // install the approved packages, bind low ports and send raw packets (ping, nmap)
          CapDrop: ['ALL'],
          CapAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'FSETID', 'SETUID', 'SETGID', 'KILL', 'NET_RAW', 'NET_BIND_SERVICE'],
          SecurityOpt: ['no-new-privileges'],
          Ulimits: [{ Name: 'fsize', Soft: fileSize, Hard: fileSize }],
          Binds: [`${config.boxMirror}:/opt/mirror:ro`],
          ...(config.boxRuntime && { Runtime: config.boxRuntime }),
        },
      })
      if (created.status === 404) throw new HttpError(503, 'The attack box is not installed on this server yet.')
      if (created.status !== 201 || !created.data.Id) {
        throw new Error(`Docker could not create the attack box: ${created.status} ${created.data?.message ?? ''}`)
      }
      const started = await docker('POST', `/containers/${created.data.Id}/start`)
      if (started.status !== 204) throw new Error(`the attack box did not start (${started.status})`)

      const now = new Date()
      const row: Row = {
        user_id: user.id,
        container_id: created.data.Id,
        network_id: network,
        started_at: now,
        expires_at: new Date(now.getTime() + config.boxMinutes * 60_000),
      }
      await db.query(
        'INSERT INTO boxes (user_id, container_id, network_id, started_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [row.user_id, row.container_id, row.network_id, row.started_at, row.expires_at]
      )
      // the lab machine that is already running becomes the target
      const machine = await machineContainer(user.id)
      if (machine) await attach(network, machine).catch((error) => console.error('cyberrange: joining the machine:', error))
      return toInfo(row)
    } catch (error) {
      // leave nothing half-made behind; reapBoxes() takes what cannot go now
      docker('DELETE', `/containers/${name}?force=true`)
        .then(() => removeNetwork(network))
        .catch(() => {})
      throw error
    }
  })
}

export function extendBox(userId: string) {
  return exclusive(userId, async () => {
    const row = await rowOf(userId)
    if (!running(row)) throw new HttpError(404, 'Your attack box is not running.')
    if (!toInfo(row).canExtend) {
      throw new HttpError(400, `An attack box can be extended in its last ${config.renewalWindowMinutes} minutes.`)
    }
    row.expires_at = new Date(row.expires_at.getTime() + config.extendMinutes * 60_000)
    await db.query('UPDATE boxes SET expires_at = $2 WHERE user_id = $1', [userId, row.expires_at])
    return toInfo(row)
  })
}

export function stopBox(userId: string) {
  return exclusive(userId, async () => {
    const row = await rowOf(userId)
    if (row) await remove(row)
  })
}

// Takes down boxes whose time is up, boxes that filled their disk, and containers and
// networks the database does not know (left behind if the service stopped mid-way).
let rounds = 0
export async function reapBoxes() {
  const expired = await db.query<Row>('SELECT * FROM boxes WHERE expires_at <= now()')
  for (const row of expired.rows) await exclusive(row.user_id, () => remove(row, 'Your attack box ran out of time.'))

  const { rows } = await db.query<Row>('SELECT * FROM boxes')
  const filters = encodeURIComponent(JSON.stringify({ label: [LABEL] }))
  const containers = await docker<{ Id: string; Created: number }[]>('GET', `/containers/json?all=true&filters=${filters}`)
  for (const found of Array.isArray(containers.data) ? containers.data : []) {
    // a box that is being started gets a moment to be written down
    if (!rows.some((row) => row.container_id === found.Id) && Date.now() / 1000 - found.Created > 120) {
      await docker('DELETE', `/containers/${found.Id}?force=true`)
    }
  }
  const networks = await docker<{ Id: string; Created: string }[]>('GET', `/networks?filters=${filters}`)
  for (const found of Array.isArray(networks.data) ? networks.data : []) {
    if (!rows.some((row) => row.network_id === found.Id) && Date.now() - Date.parse(found.Created) > 120_000) {
      await removeNetwork(found.Id)
    }
  }

  // measuring a container's disk is slow, so only every fourth round (two minutes)
  if (++rounds % 4) return
  for (const row of rows) {
    const found = await docker<{ SizeRw?: number }>('GET', `/containers/${row.container_id}/json?size=true`)
    if ((found.data?.SizeRw ?? 0) > config.boxDisk * 1024 * 1024) {
      await exclusive(row.user_id, () => remove(row, 'Your attack box was stopped because it filled its disk.'))
    }
  }
}

// ---- terminals ----

const MAX_TERMINALS = 6
const sockets = new Map<string, Set<WebSocket>>()
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 })

// Control messages are JSON text; what is typed and shown travels as bytes.
const say = (ws: WebSocket, message: object) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
}

function hangUp(userId: string, why = 'Your attack box was stopped.') {
  for (const ws of sockets.get(userId) ?? []) {
    say(ws, { closed: why })
    ws.close(1000)
  }
}

// A browser asks to turn its request into a WebSocket: a terminal in the visitor's box.
export function upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  const url = new URL(req.url ?? '/', 'http://range')
  const refuse = (status: number, reason: string) =>
    socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  if (url.pathname !== `${BASE}/box/terminal`) return refuse(404, 'Not Found')

  // A page on another site could open this address with the student's sign-in. Browsers say
  // which site is asking, and only this one may.
  let from = ''
  try {
    from = new URL(String(req.headers.origin)).host
  } catch {
    // no origin, or not an address
  }
  if (!from || from !== req.headers.host) return refuse(403, 'Forbidden')

  const size = (name: string, fallback: number, most: number) =>
    Math.min(most, Math.max(2, Math.floor(Number(url.searchParams.get(name))) || fallback))
  wss.handleUpgrade(req, socket, head, (ws) => {
    terminal(ws, req, size('cols', 100, 500), size('rows', 30, 300)).catch((error) => {
      console.error('cyberrange: a terminal failed:', error instanceof Error ? error.message : error)
      say(ws, { closed: 'The terminal could not be opened. Try again in a moment.' })
      ws.close(1011)
    })
  })
}

async function terminal(ws: WebSocket, req: IncomingMessage, cols: number, rows: number) {
  // what the browser sends before the shell is ready waits here
  const early: { data: Buffer; binary: boolean }[] = []
  let deliver = (data: Buffer, binary: boolean) => void early.push({ data, binary })
  ws.on('message', (data, binary) => deliver(data as Buffer, binary))
  ws.on('error', () => {})

  const end = (why: string, code = 1000) => {
    say(ws, { closed: why })
    ws.close(code)
  }
  const user = await currentUser(req)
  if (!user) return end('Please sign in.', 1008)
  const row = await rowOf(user.id)
  if (!running(row)) return end('Your attack box is not running.')
  const mine = sockets.get(user.id) ?? new Set<WebSocket>()
  if (mine.size >= MAX_TERMINALS) return end(`You have ${MAX_TERMINALS} terminals open already. Close one first.`)
  sockets.set(user.id, mine)
  mine.add(ws)
  ws.on('close', () => {
    mine.delete(ws)
    if (!mine.size) sockets.delete(user.id)
  })

  // The shell writes down its own number first, so that it and everything it started can be
  // ended when the browser goes away: Docker would leave them running.
  const mark = `/run/cyberrange-${randomBytes(6).toString('hex')}`
  const created = await docker<{ Id?: string; message?: string }>('POST', `/containers/${row.container_id}/exec`, {
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Cmd: ['bash', '-c', `echo $$ > ${mark}; exec bash -l`],
    Env: ['TERM=xterm-256color', 'COLORTERM=truecolor'],
    WorkingDir: HOME,
  })
  if (created.status !== 201 || !created.data.Id) return end('Your attack box did not answer. Start it again.')
  const exec = created.data.Id
  const stream = await dockerStream(`/exec/${exec}/start`, { Detach: false, Tty: true, ConsoleSize: [rows, cols] })
  const clear = () =>
    dockerExec(row.container_id, ['sh', '-c', `pkill -HUP -s "$(cat ${mark})"; rm -f ${mark}`]).catch(() => {})
  if (ws.readyState !== ws.OPEN) {
    stream.destroy()
    return void clear()
  }

  stream.on('error', () => {})
  stream.on('data', (chunk: Buffer) => {
    ws.send(chunk, { binary: true })
    // a command that prints faster than the browser reads waits for it
    if (ws.bufferedAmount > 1024 * 1024) {
      stream.pause()
      const wait = setInterval(() => {
        if (ws.bufferedAmount > 128 * 1024 && ws.readyState === ws.OPEN) return
        clearInterval(wait)
        stream.resume()
      }, 50)
    }
  })
  stream.on('close', () => end('The shell ended.'))

  deliver = (data, binary) => {
    if (binary) return void stream.write(data)
    try {
      const message = JSON.parse(data.toString()) as { resize?: unknown }
      const [w, h] = Array.isArray(message.resize) ? message.resize.map(Number) : []
      if (w! >= 2 && w! <= 500 && h! >= 2 && h! <= 300) {
        docker('POST', `/exec/${exec}/resize?w=${Math.floor(w!)}&h=${Math.floor(h!)}`).catch(() => {})
      }
    } catch {
      // not a message this understands
    }
  }
  for (const message of early) deliver(message.data, message.binary)

  // a browser that vanished without saying so is noticed by its silence
  let heard = Date.now()
  ws.on('pong', () => (heard = Date.now()))
  const alive = setInterval(() => {
    if (Date.now() - heard > 70_000) return ws.terminate()
    if (ws.readyState === ws.OPEN) ws.ping()
  }, 25_000)
  ws.on('close', () => {
    clearInterval(alive)
    stream.destroy()
    void clear()
  })
}

// ---- files in and out ----

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,99}$/
const fileLimit = config.boxFile * 1024 * 1024

async function boxOf(user: User): Promise<Row> {
  const row = await rowOf(user.id)
  if (!running(row)) throw new HttpError(404, 'Your attack box is not running.')
  return row
}

// A file in the box's home folder, as the browser named it.
function inHome(path: string | null): string {
  const parts = (path ?? '').split('/')
  if (!path || path.length > 400 || path.includes('\0') || parts.some((part) => !part || part === '.' || part === '..')) {
    throw new HttpError(400, 'That is not a file in your box.')
  }
  return `${HOME}/${path}`
}

// The files in the home folder, hidden ones left out: path, size and when they changed.
async function filesOf(row: Row) {
  const format = String.raw`%P\t%s\t%T@\n`
  const listed = await dockerExec(row.container_id, [
    'sh',
    '-c',
    `find ${HOME} -xdev -maxdepth 4 -type f -not -path '*/.*' -printf '${format}' | head -n 500`,
  ])
  return listed.out
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((fields) => fields.length === 3 && fields[0])
    .map(([path, size, changed]) => ({
      path: path!,
      size: Number(size),
      changedAt: new Date(Number(changed) * 1000).toISOString(),
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

// ---- the API ----

// What the box's page needs: the box, the lab machine it reaches as "target", and the tools.
async function view(user: User) {
  const row = await rowOf(user.id)
  const machine = await currentMachine(user.id)
  const unit = machine && content.unitByKey.get(machine.module)
  const section = unit?.sections.find((s) => s.slug === machine?.section)
  return {
    box: running(row) ? toInfo(row) : null,
    target: machine
      ? {
          title: content.labByKey.get(machine.module)?.title ?? section?.title ?? machine.section,
          port: section?.machine?.port ?? 80,
          expiresAt: machine.expiresAt,
          // the lab's page, or the module's section the machine belongs to
          lab: content.labByKey.get(machine.module)?.slug ?? null,
        }
      : null,
    player: playerName(user.name),
    cyberchef: config.toolsUrl ? `${config.toolsUrl}/cyberchef/` : null,
    fileLimit: config.boxFile,
  }
}

route('GET', `${BASE}/box`, async (ctx) => view(await ctx.signedIn()))

route('POST', `${BASE}/box`, async (ctx) => {
  const user = await ctx.signedIn()
  if (!allow(`box:${user.id}`, 4, 60_000)) {
    throw new HttpError(429, 'You are starting attack boxes too quickly. Wait a minute, then try again.')
  }
  await startBox(user)
  return view(user)
})

route('POST', `${BASE}/box/extend`, async (ctx) => {
  const user = await ctx.signedIn()
  await extendBox(user.id)
  return view(user)
})

route('DELETE', `${BASE}/box`, async (ctx) => {
  const user = await ctx.signedIn()
  await stopBox(user.id)
  return view(user)
})

route('GET', `${BASE}/box/files`, async (ctx) => filesOf(await boxOf(await ctx.signedIn())))

route('GET', `${BASE}/box/file`, async (ctx) => {
  const row = await boxOf(await ctx.signedIn())
  const full = inHome(ctx.query.get('path'))
  const where = `/containers/${row.container_id}/archive?path=${encodeURIComponent(full)}`
  const asked = await dockerBytes('HEAD', where)
  if (asked.status !== 200) throw new HttpError(404, 'There is no such file in your box.')
  let stat: { size?: number; mode?: number } = {}
  try {
    stat = JSON.parse(Buffer.from(String(asked.headers['x-docker-container-path-stat'] ?? ''), 'base64').toString())
  } catch {
    // an answer without the file's details: the size is checked while it is read
  }
  // Docker marks a folder with the highest bit of the mode
  if ((stat.mode ?? 0) >= 2 ** 31) throw new HttpError(400, 'That is a folder. Zip it in the terminal first.')
  const tooLarge = new HttpError(413, `Files up to ${config.boxFile} MB can be fetched from a box.`)
  if ((stat.size ?? 0) > fileLimit) throw tooLarge
  const fetched = await dockerBytes('GET', where, undefined, fileLimit + 8192).catch((error) => {
    throw error instanceof DockerTooLarge ? tooLarge : error
  })
  const data = firstFile(fetched.body)
  if (!data) throw new HttpError(400, 'Only files can be fetched, not folders or links.')
  // a name that is safe in the reply's header
  const name = full.slice(full.lastIndexOf('/') + 1).replace(/[^A-Za-z0-9._ -]/g, '_')
  return new BytesReply(data, 'application/octet-stream', name)
})

// A file from the student's computer, put in ~/uploads.
route('PUT', `${BASE}/box/file`, async (ctx) => {
  const row = await boxOf(await ctx.signedIn())
  const { name, data } = await ctx.body<{ name?: unknown; data?: unknown }>(fileLimit * 1.4 + 1024)
  if (typeof name !== 'string' || !FILE_NAME.test(name)) {
    throw new HttpError(400, 'A file name may use letters, digits, spaces, dots, dashes and _, up to 100 characters.')
  }
  const bytes = typeof data === 'string' && /^[A-Za-z0-9+/]*=*$/.test(data) ? Buffer.from(data, 'base64') : null
  if (!bytes) throw new HttpError(400, 'The file did not arrive whole. Try again.')
  if (bytes.length > fileLimit) throw new HttpError(413, `Files up to ${config.boxFile} MB can be sent to a box.`)
  const folder = encodeURIComponent(`${HOME}/uploads`)
  const put = () => dockerBytes('PUT', `/containers/${row.container_id}/archive?path=${folder}`, tarOf(name, bytes))
  let res = await put()
  if (res.status === 404) {
    // the folder was removed in the terminal: make it again
    await dockerExec(row.container_id, ['mkdir', '-p', `${HOME}/uploads`])
    res = await put()
  }
  if (res.status !== 200) {
    throw new Error(`Docker could not put the file in the box: ${res.status} ${res.body.toString().slice(0, 200)}`)
  }
  return filesOf(row)
})

route('DELETE', `${BASE}/box/file`, async (ctx) => {
  const row = await boxOf(await ctx.signedIn())
  await dockerExec(row.container_id, ['rm', '-f', '--', inHome(ctx.query.get('path'))])
  return filesOf(row)
})
