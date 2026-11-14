// The attack box's Firefox: a container of its own for each student who opens it, next to their
// box (image: preview/attack-browser). It joins the box's private network, where the lab machine
// answers as "target" and the box as "box", and the network it shares with the egress proxy,
// its only way to the web (services/egress). Its downloads go to the box's ~/Downloads.
//
// Its screen is a VNC server inside the container that nothing can reach over a network. The
// box's Firefox window gets it over a WebSocket, which this service carries to a socat that
// Docker starts in the container, the way terminals reach the box.
//
// Burp Suite runs in the same container, on a second screen, from the moment the student opens
// its window: the container then gets Burp's share of memory and CPU on top of Firefox's, and
// what Firefox opens on "target" and "box" passes through Burp (see preview/attack-browser).

import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { type WebSocket, WebSocketServer } from 'ws'
import { currentUser, type User } from './auth.js'
import { boxName, downloadsVolume, runningBox, sameSite, whenBoxStops } from './boxes.js'
import { config } from './config.js'
import { docker, dockerExec, dockerStream } from './docker.js'
import { HttpError, route } from './http.js'
import { exclusive, userHash } from './machines.js'
import { allow } from './ratelimit.js'
import { tarOf } from './tar.js'

const BASE = '/api/range'
const LABEL = 'udsm.range.browser'
const MB = 1024 * 1024

// The screens of a student's browser container: Firefox's, and Burp Suite's once it is opened.
export type Screen = 'firefox' | 'burp'
const SCREENS: Record<Screen, { name: string; port: number }> = {
  firefox: { name: 'Firefox', port: 5900 },
  burp: { name: 'Burp Suite', port: 5901 },
}

interface Found {
  Id: string
  State?: string
  Created: number
  Labels?: Record<string, string>
}

const listed = async (filter: string, all = true) => {
  const filters = encodeURIComponent(JSON.stringify({ label: [filter] }))
  const res = await docker<Found[]>('GET', `/containers/json?all=${all}&filters=${filters}`)
  return Array.isArray(res.data) ? res.data : []
}
const browsersOf = (userId: string) => listed(`${LABEL}=${userId}`)

// The club's logo as set on the platform, for Firefox's start page; looked up again every ten
// minutes, in case staff change it.
let logo: { bytes: Buffer | null; until: number } = { bytes: null, until: 0 }
async function clubLogo() {
  if (logo.until > Date.now()) return logo.bytes
  let bytes: Buffer | null = null
  try {
    const settings = await fetch(`${config.gzctfUrl}/api/config`, { signal: AbortSignal.timeout(5000) })
    const path = ((await settings.json()) as { logoUrl?: string | null }).logoUrl
    if (path?.startsWith('/')) {
      const res = await fetch(`${config.gzctfUrl}${path}`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) bytes = Buffer.from(await res.arrayBuffer())
    }
  } catch {
    // the start page shows the club's name alone
  }
  if (bytes && bytes.length > 2 * MB) bytes = null
  logo = { bytes, until: Date.now() + 10 * 60_000 }
  return bytes
}

// a name Docker accepts, from the student's: the proxy's notes then say whose browser it was
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'player'

// ---- starting and stopping ----

// when each student's Firefox was last on screen, to stop the ones nobody looks at
const watched = new Map<string, number>()
const viewers = new Map<string, Set<WebSocket>>()

export function startBrowser(user: User) {
  return exclusive(user.id, async () => {
    await ensureBrowser(user, 'firefox')
    return { running: true }
  })
}

// Burp Suite: started on its own screen in the student's browser container, which starts too if
// it is not running. The container gets Burp's memory and CPU on top of Firefox's first. Burp
// itself takes some 10 seconds more to show its window: see burpReady.
export function startBurp(user: User) {
  return exclusive(user.id, async () => {
    const id = await ensureBrowser(user, 'burp')
    const raised = await docker<{ message?: string }>('POST', `/containers/${id}/update`, {
      Memory: (config.browserMemory + config.burpMemory) * MB,
      MemorySwap: (config.browserMemory + config.burpMemory) * MB,
      NanoCpus: Math.round((config.browserCpus + config.burpCpus) * 1e9),
    })
    if (raised.status !== 200) {
      throw new Error(`Docker could not give Burp Suite its memory: ${raised.status} ${raised.data?.message ?? ''}`)
    }
    // Java's share of what Burp adds; the rest is Java's own
    const heap = Math.max(256, Math.floor(config.burpMemory * 0.75))
    const started = await dockerExec(id, ['env', `BURP_HEAP_MB=${heap}`, '/usr/local/bin/cyberrange-burp'])
    if (started.code === 126 || started.code === 127) {
      throw new HttpError(503, 'Burp Suite is not installed on this server yet.')
    }
    if (started.code !== 0) throw new Error(`Burp Suite's screen did not start: ${started.out.trim()}`)
    return { running: true, ready: await burpReady(id) }
  })
}

// whether Burp's window is on its screen yet; not while its container is going away
async function burpReady(container: string) {
  try {
    return (await dockerExec(container, ['/usr/local/bin/cyberrange-burp', 'ready'])).code === 0
  } catch {
    return false
  }
}

// The student's browser container, started if it is not running; gives its id. Runs inside the
// student's turn (exclusive) already.
async function ensureBrowser(user: User, which: Screen): Promise<string> {
  const { name } = SCREENS[which]
  if (!config.browserEnabled) throw new HttpError(404, `${name} is turned off on this server.`)
  if (!(await runningBox(user.id))) throw new HttpError(404, 'Your attack box is not running.')
  const mine = await browsersOf(user.id)
  const running = mine.find((found) => found.State === 'running')
  if (running) {
    watched.set(user.id, Date.now())
    return running.Id
  }
  for (const found of mine) await docker('DELETE', `/containers/${found.Id}?force=true`)

  const busy = await listed(LABEL, false)
  if (busy.length >= config.boxSeats) {
    throw new HttpError(
      503,
      which === 'firefox'
        ? 'Every Firefox on this server is in use right now. Try again in a few minutes.'
        : 'Burp Suite runs next to Firefox, and every Firefox on this server is in use right now. Try again in a few minutes.'
    )
  }

  const container = `range-browser-${slug(user.name)}-${userHash(user.id, 'browser').slice(0, 8)}`
  await docker('DELETE', `/containers/${container}?force=true`)
  const network = boxName(user.id)
  const fileSize = config.boxDisk * MB
  const created = await docker<{ Id?: string; message?: string }>('POST', `/containers/create?name=${container}`, {
    Image: config.browserImage,
    Hostname: 'firefox',
    Labels: { [LABEL]: user.id },
    HostConfig: {
      Init: true,
      NetworkMode: network,
      Memory: config.browserMemory * MB,
      MemorySwap: config.browserMemory * MB,
      NanoCpus: Math.round(config.browserCpus * 1e9),
      CpuShares: 128,
      PidsLimit: 512,
      // Firefox's tabs share memory through /dev/shm, which Docker makes 64 MB by default
      ShmSize: 512 * MB,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges'],
      Ulimits: [{ Name: 'fsize', Soft: fileSize, Hard: fileSize }],
      Binds: [`${downloadsVolume(user.id)}:/home/student/Downloads`],
    },
    NetworkingConfig: { EndpointsConfig: { [network]: { Aliases: ['firefox'] } } },
  })
  if (created.status === 404) throw new HttpError(503, `${name} is not installed on this server yet.`)
  if (created.status !== 201 || !created.data.Id) {
    throw new Error(`Docker could not create the browser: ${created.status} ${created.data?.message ?? ''}`)
  }
  const id = created.data.Id
  try {
    const joined = await docker<{ message?: string }>('POST', `/networks/${config.browserNetwork}/connect`, { Container: id })
    if (joined.status !== 200) {
      throw new HttpError(
        503,
        which === 'firefox'
          ? "Firefox cannot reach the web on this server yet: its network is missing. Ask your club's admins."
          : "Burp Suite cannot start on this server yet: Firefox's network is missing. Ask your club's admins."
      )
    }
    const bytes = await clubLogo()
    if (bytes) {
      const put = encodeURIComponent('/usr/local/share/cyberrange/start')
      await docker('PUT', `/containers/${id}/archive?path=${put}`, tarOf('logo', bytes))
    }
    const started = await docker('POST', `/containers/${id}/start`)
    if (started.status !== 204) throw new Error(`the browser did not start (${started.status})`)
  } catch (error) {
    await docker('DELETE', `/containers/${id}?force=true`).catch(() => {})
    throw error
  }
  watched.set(user.id, Date.now())
  return id
}

// Stops a student's Firefox. Runs inside the student's turn (exclusive) already.
async function removeBrowser(userId: string, why = 'Your attack box was stopped.') {
  for (const ws of viewers.get(userId) ?? []) ws.close(1000, why)
  for (const found of await browsersOf(userId)) await docker('DELETE', `/containers/${found.Id}?force=true`)
  watched.delete(userId)
}
whenBoxStops((userId) => removeBrowser(userId))

// Stops browsers whose box is gone, that nobody has looked at for a while, or that filled
// their disk.
let rounds = 0
export async function reapBrowsers() {
  const measure = ++rounds % 4 === 0
  for (const found of await listed(LABEL)) {
    const userId = found.Labels?.[LABEL] ?? ''
    // a browser that is being started gets a moment
    if (Date.now() / 1000 - found.Created < 120) continue
    if (!watched.has(userId)) watched.set(userId, Date.now())
    const unwatched = !viewers.get(userId)?.size && Date.now() - watched.get(userId)! > config.browserIdleMinutes * 60_000
    let full = false
    if (measure && !unwatched) {
      const size = await docker<{ SizeRw?: number }>('GET', `/containers/${found.Id}/json?size=true`)
      full = (size.data?.SizeRw ?? 0) > config.boxDisk * MB
    }
    if (!userId || unwatched || full || !(await runningBox(userId))) {
      await exclusive(userId, () => removeBrowser(userId, full ? 'Firefox was stopped because it filled its disk.' : undefined))
    }
  }
}

route('POST', `${BASE}/box/browser`, async (ctx) => {
  const user = await ctx.signedIn()
  if (!allow(`browser:${user.id}`, 6, 60_000)) {
    throw new HttpError(429, 'You are opening Firefox too quickly. Wait a minute, then try again.')
  }
  return startBrowser(user)
})

route('DELETE', `${BASE}/box/browser`, async (ctx) => {
  const user = await ctx.signedIn()
  await exclusive(user.id, () => removeBrowser(user.id, 'Firefox was closed.'))
  return { running: false }
})

route('POST', `${BASE}/box/burp`, async (ctx) => {
  const user = await ctx.signedIn()
  if (!allow(`burp:${user.id}`, 6, 60_000)) {
    throw new HttpError(429, 'You are opening Burp Suite too quickly. Wait a minute, then try again.')
  }
  return startBurp(user)
})

// asked every few seconds by Burp's window while Burp starts
route('GET', `${BASE}/box/burp`, async (ctx) => {
  const user = await ctx.signedIn()
  if (!allow(`burp-ready:${user.id}`, 90, 60_000)) throw new HttpError(429, 'Too many questions about Burp Suite. Wait a minute.')
  const browser = (await browsersOf(user.id)).find((found) => found.State === 'running')
  return { ready: browser ? await burpReady(browser.Id) : false }
})

// ---- the screen ----

// windows that may show each screen at once
const MAX_VIEWERS = 3
// which screen each window shows
const shows = new WeakMap<WebSocket, Screen>()
const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * MB })

export function browserUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, which: Screen = 'firefox') {
  if (!sameSite(req)) return void socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
  wss.handleUpgrade(req, socket, head, (ws) => {
    screen(ws, req, which).catch((error) => {
      console.error(`cyberrange: a ${which} screen failed:`, error instanceof Error ? error.message : error)
      ws.close(1011, `${SCREENS[which].name} could not be shown. Try again in a moment.`)
    })
  })
}

async function screen(ws: WebSocket, req: IncomingMessage, which: Screen) {
  const { name, port } = SCREENS[which]
  // what the window sends before Firefox's screen is reached waits here
  const early: Buffer[] = []
  let deliver = (data: Buffer) => void early.push(data)
  ws.on('message', (data) => deliver(data as Buffer))
  ws.on('error', () => {})

  const user = await currentUser(req)
  if (!user) return ws.close(1008, 'Please sign in.')
  if (!(await runningBox(user.id))) return ws.close(1000, 'Your attack box is not running.')
  const browser = (await browsersOf(user.id)).find((found) => found.State === 'running')
  if (!browser) return ws.close(1000, `${name} is not running.`)
  // every window on either screen keeps the container from being stopped as unwatched
  const mine = viewers.get(user.id) ?? new Set<WebSocket>()
  if ([...mine].filter((other) => shows.get(other) === which).length >= MAX_VIEWERS) {
    return ws.close(1000, `${name} is open in too many windows. Close one first.`)
  }
  viewers.set(user.id, mine)
  mine.add(ws)
  shows.set(ws, which)
  watched.set(user.id, Date.now())
  ws.on('close', () => {
    mine.delete(ws)
    if (!mine.size) viewers.delete(user.id)
    watched.set(user.id, Date.now())
  })

  const created = await docker<{ Id?: string }>('POST', `/containers/${browser.Id}/exec`, {
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: false,
    Tty: false,
    Cmd: ['socat', 'STDIO', `TCP:127.0.0.1:${port}`],
  })
  if (created.status !== 201 || !created.data.Id) return ws.close(1011, `${name} did not answer. Try again.`)
  const stream = await dockerStream(`/exec/${created.data.Id}/start`, { Detach: false, Tty: false })
  if (ws.readyState !== ws.OPEN) return void stream.destroy()

  // Docker frames what socat prints: a byte for the stream, three empty bytes, four for the
  // length, then the bytes themselves, which are the screen's.
  let pending: Buffer = Buffer.alloc(0)
  stream.on('data', (chunk: Buffer) => {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk
    while (pending.length >= 8) {
      const size = pending.readUInt32BE(4)
      if (pending.length < 8 + size) break
      if (pending[0] === 1 && size) ws.send(pending.subarray(8, 8 + size), { binary: true })
      pending = pending.subarray(8 + size)
    }
    // a screen that changes faster than the student's connection waits for it
    if (ws.bufferedAmount > 4 * MB) {
      stream.pause()
      const wait = setInterval(() => {
        if (ws.bufferedAmount > MB && ws.readyState === ws.OPEN) return
        clearInterval(wait)
        stream.resume()
      }, 50)
    }
  })
  stream.on('error', () => {})
  stream.on('close', () => ws.close(1000, `${name} closed.`))

  deliver = (data) => void stream.write(data)
  for (const data of early) deliver(data)

  // a window that vanished without saying so is noticed by its silence
  let heard = Date.now()
  ws.on('pong', () => (heard = Date.now()))
  const alive = setInterval(() => {
    if (Date.now() - heard > 70_000) return ws.terminate()
    if (ws.readyState === ws.OPEN) ws.ping()
  }, 25_000)
  ws.on('close', () => {
    clearInterval(alive)
    stream.destroy()
  })
}
