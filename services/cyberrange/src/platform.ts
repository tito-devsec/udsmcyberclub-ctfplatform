// Calls to the platform (GZCTF) made for whoever sent the request, with their own sign-in
// cookie. The service has no account of its own there: it can only do what that person can.

import type { IncomingMessage } from 'node:http'
import { clientIp, tokenOf } from './auth.js'
import { config } from './config.js'
import { HttpError } from './http.js'

export async function platform<T = unknown>(
  req: IncomingMessage,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = tokenOf(req)
  if (!token) throw new HttpError(401, 'Please sign in.')

  let res: Response
  try {
    res = await fetch(`${config.gzctfUrl}${path}`, {
      method,
      headers: {
        Cookie: `GZCTF_Token=${token}`,
        'X-Forwarded-For': clientIp(req),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new HttpError(503, 'The platform is not answering. Try again in a moment.')
  }

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // not JSON: nothing to read from it
  }
  if (!res.ok) {
    const said = (data as { title?: unknown } | null)?.title
    const reason = typeof said === 'string' && said ? said : `error ${res.status}`
    throw new HttpError(res.status === 401 || res.status === 403 ? 403 : 502, `The platform refused: ${reason}`)
  }
  return data as T
}
