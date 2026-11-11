// A small router: routes return JSON, errors become { title, status } like the platform's.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { currentUser, PlatformUnavailable, type User } from './auth.js'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export interface Context {
  req: IncomingMessage
  params: Record<string, string>
  user(): Promise<User | null>
  signedIn(): Promise<User>
  admin(): Promise<User>
  body<T>(): Promise<T>
}

type Handler = (ctx: Context) => Promise<unknown>

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = []

export function route(method: string, path: string, handler: Handler) {
  const keys: string[] = []
  const pattern = new RegExp(
    `^${path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key)
      return '([a-z0-9-]+)'
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
  const url = new URL(req.url ?? '/', 'http://labs')
  const found = routes
    .filter((r) => r.pattern.test(url.pathname))
    .find((r) => r.method === req.method)

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
    const params = Object.fromEntries(found.keys.map((key, i) => [key, match[i + 1]!]))
    let user: Promise<User | null> | undefined
    const ctx: Context = {
      req,
      params,
      user: () => (user ??= currentUser(req)),
      signedIn: async () => {
        const u = await ctx.user()
        if (!u) throw new HttpError(401, 'Please sign in.')
        return u
      },
      admin: async () => {
        const u = await ctx.signedIn()
        if (!u.admin) throw new HttpError(403, 'Only admins can do this.')
        return u
      },
      body: async <T>() => {
        const text = await readBody(req)
        try {
          return (text ? JSON.parse(text) : {}) as T
        } catch {
          throw new HttpError(400, 'The request is not valid JSON.')
        }
      },
    }
    send(res, 200, await found.handler(ctx))
  } catch (error) {
    if (error instanceof HttpError) return send(res, error.status, { title: error.message, status: error.status })
    if (error instanceof PlatformUnavailable) {
      return send(res, 503, { title: 'The platform is not answering. Try again in a moment.', status: 503 })
    }
    console.error(`${req.method} ${url.pathname}:`, error)
    send(res, 500, { title: 'Something went wrong.', status: 500 })
  }
}
