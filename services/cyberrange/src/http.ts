// A small router: routes return JSON, errors become { title, status } like the platform's.

import { createReadStream } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { currentUser, isStaff, PlatformUnavailable, type User } from './auth.js'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

// A file to send as it is, instead of JSON.
export class FileReply {
  constructor(
    readonly path: string,
    readonly name: string,
    readonly size: number
  ) {}
}

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
  '.pcap': 'application/vnd.tcpdump.pcap',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
}

export interface Context {
  req: IncomingMessage
  params: Record<string, string>
  query: URLSearchParams
  user(): Promise<User | null>
  signedIn(): Promise<User>
  // tutors, admins and superadmins
  staff(): Promise<User>
  admin(): Promise<User>
  superadmin(): Promise<User>
  body<T>(): Promise<T>
}

type Handler = (ctx: Context) => Promise<unknown>

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = []

// ":name" matches a slug (a-z, 0-9 and dashes); "@name" anything up to the next slash.
export function route(method: string, path: string, handler: Handler) {
  const keys: string[] = []
  const pattern = new RegExp(
    `^${path.replace(/([:@])(\w+)/g, (_, kind: string, key: string) => {
      keys.push(key)
      return kind === ':' ? '([a-z0-9-]+)' : '([^/]+)'
    })}$`
  )
  routes.push({ method, pattern, keys, handler })
}

const MAX_BODY = 16 * 1024

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new HttpError(413, 'The request is too large.')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString()
}

function sendFile(res: ServerResponse, file: FileReply) {
  const dot = file.name.lastIndexOf('.')
  res.writeHead(200, {
    'Content-Type': TYPES[dot < 0 ? '' : file.name.slice(dot).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': file.size,
    'Content-Disposition': `attachment; filename="${file.name}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(file.path).pipe(res)
}

function send(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload ?? null)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

export async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://range')
  const found = routes.filter((r) => r.pattern.test(url.pathname)).find((r) => r.method === req.method)

  try {
    if (!found) {
      const exists = routes.some((r) => r.pattern.test(url.pathname))
      throw new HttpError(exists ? 405 : 404, exists ? 'Method not allowed.' : 'Not found.')
    }
    // Requests that change something must be JSON. A browser cannot send JSON to another
    // site without asking it first, so other sites cannot act on a student's behalf.
    if (req.method !== 'GET' && !String(req.headers['content-type'] ?? '').startsWith('application/json')) {
      throw new HttpError(415, 'Send JSON.')
    }

    const match = found.pattern.exec(url.pathname)!
    let params: Record<string, string>
    try {
      params = Object.fromEntries(found.keys.map((key, i) => [key, decodeURIComponent(match[i + 1]!)]))
    } catch {
      throw new HttpError(400, 'The address is not valid.')
    }
    let user: Promise<User | null> | undefined
    const only = async (allowed: (user: User) => boolean, message: string) => {
      const u = await ctx.signedIn()
      if (!allowed(u)) throw new HttpError(403, message)
      return u
    }
    const ctx: Context = {
      req,
      params,
      query: url.searchParams,
      user: () => (user ??= currentUser(req)),
      signedIn: async () => {
        const u = await ctx.user()
        if (!u) throw new HttpError(401, 'Please sign in.')
        return u
      },
      staff: () => only(isStaff, 'Only tutors and admins can do this.'),
      admin: () => only((u) => u.role === 'admin' || u.role === 'superadmin', 'Only admins can do this.'),
      superadmin: () => only((u) => u.role === 'superadmin', 'Only the superadmin can do this.'),
      body: async <T>() => {
        const text = await readBody(req)
        try {
          return (text ? JSON.parse(text) : {}) as T
        } catch {
          throw new HttpError(400, 'The request is not valid JSON.')
        }
      },
    }
    const result = await found.handler(ctx)
    if (result instanceof FileReply) return sendFile(res, result)
    send(res, 200, result)
  } catch (error) {
    if (error instanceof HttpError) return send(res, error.status, { title: error.message, status: error.status })
    if (error instanceof PlatformUnavailable) {
      return send(res, 503, { title: 'The platform is not answering. Try again in a moment.', status: 503 })
    }
    console.error(`${req.method} ${url.pathname}:`, error)
    send(res, 500, { title: 'Something went wrong.', status: 500 })
  }
}
