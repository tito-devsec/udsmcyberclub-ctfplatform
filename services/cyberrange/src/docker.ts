// A minimal client for the Docker Engine API, over the Docker socket.

import { type IncomingHttpHeaders, request } from 'node:http'
import type { Duplex } from 'node:stream'
import { config } from './config.js'

// Docker is not there or not answering: the lab machines are down, not the request at fault.
export class DockerUnavailable extends Error {}

// Docker sent more than the caller wanted to hold.
export class DockerTooLarge extends Error {}

export interface DockerResponse<T> {
  status: number
  data: T
}

interface RawResponse {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
}

// One request. A Buffer is sent as a tar archive (what Docker takes for files), anything else
// as JSON. The answer's body is kept as bytes, up to `limit` of them.
function call(method: string, path: string, body?: unknown, limit = 64 * 1024 * 1024): Promise<RawResponse> {
  const payload = body === undefined ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))
  const type = Buffer.isBuffer(body) ? 'application/x-tar' : 'application/json'
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath: config.dockerSocket,
        path,
        method,
        headers: payload ? { 'Content-Type': type, 'Content-Length': payload.length } : {},
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > limit) return req.destroy(new DockerTooLarge('Docker sent more than was asked for'))
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }))
      }
    )
    req.on('error', (error) =>
      reject(
        error instanceof DockerUnavailable || error instanceof DockerTooLarge
          ? error
          : new DockerUnavailable(`Docker is not reachable: ${error.message}`)
      )
    )
    req.setTimeout(30_000, () => req.destroy(new DockerUnavailable('Docker did not answer in time')))
    if (payload) req.write(payload)
    req.end()
  })
}

export async function docker<T = unknown>(method: string, path: string, body?: unknown): Promise<DockerResponse<T>> {
  const res = await call(method, path, body)
  const text = res.body.toString()
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // not JSON; keep the text
  }
  return { status: res.status, data: data as T }
}

// The same, for answers that are not JSON: a file out of a container, or what a command printed.
export const dockerBytes = (method: string, path: string, body?: unknown, limit?: number) =>
  call(method, path, body, limit)

// Docker sends what a command prints in frames: a byte for the stream (1 is its output, 2 its
// errors), three empty bytes, the frame's length in four, then that many bytes.
function printed(raw: Buffer): Buffer {
  const out: Buffer[] = []
  for (let at = 0; at + 8 <= raw.length; ) {
    const size = raw.readUInt32BE(at + 4)
    if (raw[at] === 1) out.push(raw.subarray(at + 8, at + 8 + size))
    at += 8 + size
  }
  return Buffer.concat(out)
}

// Runs a command in a container and waits for it: what it printed, and how it ended.
export async function dockerExec(container: string, command: string[], limit = 1024 * 1024) {
  const created = await docker<{ Id?: string; message?: string }>('POST', `/containers/${container}/exec`, {
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    Cmd: command,
  })
  if (created.status !== 201 || !created.data.Id) {
    throw new Error(`Docker could not run a command: ${created.status} ${created.data?.message ?? ''}`)
  }
  const ran = await call('POST', `/exec/${created.data.Id}/start`, { Detach: false, Tty: false }, limit)
  const ended = await docker<{ ExitCode?: number | null }>('GET', `/exec/${created.data.Id}/json`)
  return { code: ended.data?.ExitCode ?? -1, out: printed(ran.body).toString() }
}

// Opens a two-way stream with Docker: what a terminal in a container types and shows.
export function dockerStream(path: string, body: unknown): Promise<Duplex> {
  const payload = Buffer.from(JSON.stringify(body))
  return new Promise((resolve, reject) => {
    const req = request({
      socketPath: config.dockerSocket,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        Connection: 'Upgrade',
        Upgrade: 'tcp',
      },
    })
    req.on('upgrade', (_res, socket, head) => {
      if (head.length) socket.unshift(head)
      resolve(socket)
    })
    // Docker answers with an ordinary reply when it will not open the stream
    req.on('response', (res) => {
      res.resume()
      reject(new Error(`Docker would not open a stream: ${res.statusCode}`))
    })
    req.on('error', (error) => reject(new DockerUnavailable(`Docker is not reachable: ${error.message}`)))
    req.setTimeout(30_000, () => req.destroy(new DockerUnavailable('Docker did not answer in time')))
    req.end(payload)
  })
}
