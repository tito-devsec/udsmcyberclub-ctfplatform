// A minimal client for the Docker Engine API, over the Docker socket.

import { request } from 'node:http'
import { config } from './config.js'

// Docker is not there or not answering: the lab machines are down, not the request at fault.
export class DockerUnavailable extends Error {}

export interface DockerResponse<T> {
  status: number
  data: T
}

export function docker<T = unknown>(method: string, path: string, body?: unknown): Promise<DockerResponse<T>> {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath: config.dockerSocket,
        path,
        method,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {},
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString()
          let data: unknown = text
          try {
            data = text ? JSON.parse(text) : null
          } catch {
            // not JSON; keep the text
          }
          resolve({ status: res.statusCode ?? 0, data: data as T })
        })
      }
    )
    req.on('error', (error) =>
      reject(error instanceof DockerUnavailable ? error : new DockerUnavailable(`Docker is not reachable: ${error.message}`))
    )
    req.setTimeout(30_000, () => req.destroy(new DockerUnavailable('Docker did not answer in time')))
    if (payload) req.write(payload)
    req.end()
  })
}
