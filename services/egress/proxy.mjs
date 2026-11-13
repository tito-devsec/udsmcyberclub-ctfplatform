// The way to the web for the attack box's Firefox (preview/attack-browser), and its only one.
// Firefox reaches websites through this proxy: http and https on their usual ports, at
// addresses on the internet. Private and reserved addresses are refused, so this server, the
// platform and every student's machines stay out of reach, whatever a page or a student tries.
// The proxy looks each name up itself and connects to the address it checked, so a name whose
// answer changes in between gets nowhere. Each request is noted with the name of the browser
// that made it, which names the student.

import { lookup, reverse } from 'node:dns/promises'
import { createServer, request } from 'node:http'
import { BlockList, connect, isIP } from 'node:net'

const PORT = Number(process.env.PORT ?? 3128)
// the ports websites use; anything else is refused
const PORTS = new Set((process.env.EGRESS_PORTS ?? '80,443').split(',').map((port) => Number(port.trim())))
const LOG = (process.env.EGRESS_LOG ?? 'on') !== 'off'

// Addresses that are not the internet, and any the server's admins add (its public address).
const refused = new BlockList()
const RESERVED = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
]
const added = (process.env.EGRESS_DENY ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
for (const range of [...RESERVED, ...added]) {
  const [address, bits] = range.split('/')
  if (isIP(address) !== 4) throw new Error(`EGRESS_DENY takes IPv4 addresses and ranges, not "${range}"`)
  refused.addSubnet(address, bits === undefined ? 32 : Number(bits), 'ipv4')
}

// Where to connect for a host: its first address on the internet, or null. IPv4 only, the
// only kind this network routes.
async function addressOf(host) {
  const name = String(host ?? '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
  if (!name || isIP(name) === 6) return null
  const found = isIP(name) === 4 ? [{ address: name }] : await lookup(name, { all: true, family: 4 }).catch(() => [])
  return found.find((entry) => !refused.check(entry.address, 'ipv4'))?.address ?? null
}

// Which browser asked: Docker answers with its container's name, and that names the student.
const names = new Map()
async function who(socket) {
  const ip = String(socket.remoteAddress ?? '?').replace(/^::ffff:/, '')
  const known = names.get(ip)
  if (known && known.until > Date.now()) return known.name
  const name = await reverse(ip).then(
    (found) => found[0]?.split('.')[0] || ip,
    () => ip
  )
  names.set(ip, { name, until: Date.now() + 60_000 })
  return name
}
function note(socket, what) {
  if (!LOG) return
  who(socket)
    .then((name) => console.log(`${new Date().toISOString()} ${name} ${what}`))
    .catch(() => {})
}
setInterval(() => {
  for (const [ip, known] of names) if (known.until < Date.now()) names.delete(ip)
}, 300_000).unref()

// headers that belong to one connection, not to the request
const HOP = ['connection', 'keep-alive', 'proxy-connection', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']
const passed = (headers) => Object.fromEntries(Object.entries(headers).filter(([name]) => !HOP.includes(name)))
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function refuse(res, host) {
  res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
  res.end(
    `<!doctype html><meta charset="utf-8"><title>Not reachable</title>` +
      `<body style="margin:0;padding:48px;font:16px/1.6 sans-serif;background:#1f232b;color:#eef1f5">` +
      `<h1 style="font-size:1.4rem">${escape(host)} is out of the attack box's reach</h1>` +
      `<p>Its Firefox opens websites on the internet, over http and https. This server, private ` +
      `addresses and other students' machines are out of its reach. Your lab machine opens as ` +
      `<b>http://target</b>.</p></body>`
  )
}

const server = createServer(async (req, res) => {
  // plain http: the request carries the whole address
  let url = null
  try {
    url = new URL(req.url ?? '')
  } catch {
    // not an address
  }
  if (!url || url.protocol !== 'http:') {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end("This is the attack box browser's proxy.\n")
    return
  }
  const port = Number(url.port || 80)
  const address = PORTS.has(port) ? await addressOf(url.hostname) : null
  note(req.socket, `${req.method} http://${url.host}${address ? '' : ' refused'}`)
  if (!address) return refuse(res, url.host)

  const upstream = request(
    {
      host: address,
      port,
      method: req.method,
      path: `${url.pathname}${url.search}`,
      headers: { ...passed(req.headers), host: url.host },
      setHost: false,
    },
    (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.statusMessage, passed(reply.headers))
      reply.pipe(res)
    }
  )
  upstream.setTimeout(60_000, () => upstream.destroy(new Error('the site did not answer in time')))
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' }).end('The site could not be reached.\n')
    else res.destroy()
  })
  req.pipe(upstream)
})

// https, and anything else in a tunnel: "CONNECT host:port"
server.on('connect', async (req, client, head) => {
  client.on('error', () => {})
  const target = /^(\[[^\]]+\]|[^:]+):(\d{1,5})$/.exec(req.url ?? '')
  const port = Number(target?.[2])
  const address = target && PORTS.has(port) ? await addressOf(target[1]) : null
  note(client, `CONNECT ${req.url}${address ? '' : ' refused'}`)
  if (!address) return void client.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')

  const upstream = connect(port, address)
  let open = false
  const slow = setTimeout(() => upstream.destroy(new Error('no answer')), 20_000)
  upstream.on('connect', () => {
    clearTimeout(slow)
    open = true
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head?.length) upstream.write(head)
    upstream.pipe(client)
    client.pipe(upstream)
  })
  upstream.on('error', () => {
    clearTimeout(slow)
    if (open) client.destroy()
    else client.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
  })
  upstream.setTimeout(10 * 60_000, () => upstream.destroy())
  client.on('close', () => upstream.destroy())
  upstream.on('close', () => {
    if (open) client.destroy()
  })
})

// a WebSocket over plain http comes as a tunnel (CONNECT) from Firefox; anything else is refused
server.on('upgrade', (_req, socket) => socket.end('HTTP/1.1 501 Not Implemented\r\nContent-Length: 0\r\n\r\n'))
server.on('clientError', (_error, socket) => socket.destroy())
server.requestTimeout = 0

server.listen(PORT, () => console.log(`egress: listening on port ${PORT}`))
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => process.exit(0))
