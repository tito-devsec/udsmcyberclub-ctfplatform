// A small client for the GZCTF API, shared by the seed scripts in this folder.
//
// When API encryption is on (Admin -> Settings), the platform only accepts passwords
// and flags that were encrypted with its public key. Session.login does that for
// passwords, and Session.encrypt for anything else, the same way the web interface does.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const BASE = process.env.GZCTF_URL ?? 'http://localhost:3000'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** The values in `dir`/.env */
export function readEnv(dir) {
  return Object.fromEntries(
    readFileSync(join(dir, '.env'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
  )
}

export async function waitForServer() {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      if ((await fetch(BASE + '/api/config')).ok) return
    } catch {
      // not listening yet
    }
    await sleep(2000)
  }
  throw new Error(`GZCTF did not answer on ${BASE}`)
}

/**
 * Encrypts `text` for the server, as src/GZCTF/ClientApp/src/utils/Crypto.ts does:
 * an X25519 key exchange with the server's public key, SHA-256 of the shared secret as
 * an AES-256-GCM key, and [one-time public key | nonce | ciphertext] in base64.
 * Returns `text` unchanged when there is no key (encryption off).
 */
export async function encryptApiData(text, publicKeyBase64) {
  if (!publicKeyBase64) return text
  const { subtle } = globalThis.crypto
  const serverKey = await subtle.importKey('raw', Buffer.from(publicKeyBase64, 'base64'), 'X25519', false, [])
  const oneTimeKey = await subtle.generateKey('X25519', true, ['deriveBits'])
  const shared = await subtle.deriveBits({ name: 'X25519', public: serverKey }, oneTimeKey.privateKey, 256)
  const aesKey = await subtle.importKey('raw', await subtle.digest('SHA-256', shared), 'AES-GCM', false, ['encrypt'])
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const sealed = await subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, new TextEncoder().encode(text))
  const oneTimePublicKey = new Uint8Array(await subtle.exportKey('raw', oneTimeKey.publicKey))
  return Buffer.concat([oneTimePublicKey, nonce, new Uint8Array(sealed)]).toString('base64')
}

// The server's public key (null when API encryption is off), fetched once
let serverKey
const getServerKey = () =>
  (serverKey ??= fetch(BASE + '/api/config')
    .then((res) => res.json())
    .then((config) => config.apiPublicKey ?? null))

export class Session {
  cookie = ''

  constructor(name) {
    this.name = name
  }

  async send(method, path, init) {
    const res = await fetch(BASE + path, {
      method,
      ...init,
      headers: { ...init?.headers, ...(this.cookie && { Cookie: this.cookie }) },
    })
    for (const cookie of res.headers.getSetCookie()) {
      if (cookie.startsWith('GZCTF_Token=')) this.cookie = cookie.split(';')[0]
    }
    const text = await res.text()
    if (!res.ok) throw new Error(`${method} ${path} as ${this.name}: ${res.status} ${text.slice(0, 300)}`)
    try {
      return text ? JSON.parse(text) : null
    } catch {
      return text
    }
  }

  call(method, path, body) {
    if (body === undefined) return this.send(method, path)
    return this.send(method, path, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  /** `text` encrypted for the server when API encryption is on, otherwise unchanged */
  async encrypt(text) {
    return encryptApiData(text, await getServerKey())
  }

  async login(userName, password) {
    return this.call('POST', '/api/account/login', { userName, password: await this.encrypt(password) })
  }

  async upload(fileName, bytes) {
    const form = new FormData()
    form.append('files', new Blob([bytes]), fileName)
    const [file] = await this.send('POST', '/api/assets', { body: form })
    return file.hash
  }
}
