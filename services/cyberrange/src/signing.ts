// Who signs certificates: two people, each with a name, a title and a picture of their
// signature. The superadmin sets them, and a certificate keeps the ones it was issued with.

import { createHash } from 'node:crypto'
import { db } from './db.js'
import { BytesReply, HttpError, route } from './http.js'

const BASE = '/api/range'

export const SLOTS = ['president', 'principal'] as const
export type Slot = (typeof SLOTS)[number]

export interface Signatory {
  name: string
  title: string
  // the SHA-256 of the signature's picture, in the images table
  signature: string | null
}

export type Signatories = Record<Slot, Signatory>

const DEFAULTS: Signatories = {
  president: { name: '', title: 'President, UDSM Cyber Club', signature: null },
  principal: { name: '', title: 'Principal, CoICT', signature: null },
}

const fields = (value: unknown) => (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>

function clean(value: unknown, fallback: Signatory): Signatory {
  const raw = fields(value)
  return {
    name: typeof raw.name === 'string' ? raw.name : fallback.name,
    title: typeof raw.title === 'string' && raw.title ? raw.title : fallback.title,
    signature: typeof raw.signature === 'string' && /^[0-9a-f]{64}$/.test(raw.signature) ? raw.signature : null,
  }
}

const read = (value: unknown): Signatories => ({
  president: clean(fields(value).president, DEFAULTS.president),
  principal: clean(fields(value).principal, DEFAULTS.principal),
})

export async function currentSignatories(): Promise<Signatories> {
  const { rows } = await db.query<{ value: unknown }>("SELECT value FROM settings WHERE key = 'signatories'")
  return read(rows[0]?.value)
}

const save = (value: Signatories) =>
  db.query(
    `INSERT INTO settings (key, value) VALUES ('signatories', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [value]
  )

const complete = (value: Signatories) => SLOTS.every((slot) => value[slot].name && value[slot].signature)

// What a new certificate is issued with: today's signatories, once both have a name and a
// signature. Until then certificates are left unsigned and show whoever signs now.
export async function signatoriesToIssue(): Promise<Signatories | null> {
  const current = await currentSignatories()
  return complete(current) ? current : null
}

// For the certificate page: the signatories it was issued with, or today's when it has none.
export async function signatoriesOf(stored: unknown) {
  const value = stored ? read(stored) : await currentSignatories()
  return SLOTS.map((slot) => ({
    slot,
    name: value[slot].name,
    title: value[slot].title,
    signature: value[slot].signature ? `${BASE}/images/${value[slot].signature}` : null,
  }))
}

// ---- pictures ----

const KINDS: [string, (bytes: Buffer) => boolean][] = [
  ['image/png', (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/webp', (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'],
]

const MAX_IMAGE = 300 * 1024
const WRONG_KIND = 'Send the picture as a PNG, JPEG or WebP file.'

// Stores a picture sent as a "data:" address and returns its hash. What kind of picture it
// is comes from its first bytes, never from what the sender says.
export async function storeImage(address: unknown): Promise<string> {
  const match = typeof address === 'string' ? /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]+=*)$/.exec(address) : null
  if (!match) throw new HttpError(400, WRONG_KIND)
  const data = Buffer.from(match[1]!, 'base64')
  if (data.length === 0 || data.length > MAX_IMAGE) throw new HttpError(400, 'The picture must be smaller than 300 KB.')
  const type = KINDS.find(([, matches]) => matches(data))?.[0]
  if (!type) throw new HttpError(400, WRONG_KIND)
  const hash = createHash('sha256').update(data).digest('hex')
  await db.query('INSERT INTO images (hash, type, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [hash, type, data])
  return hash
}

route('GET', `${BASE}/images/:hash`, async (ctx) => {
  const { rows } = await db.query<{ type: string; data: Buffer }>('SELECT type, data FROM images WHERE hash = $1', [
    ctx.params.hash,
  ])
  if (!rows[0]) throw new HttpError(404, 'There is no such picture.')
  return new BytesReply(rows[0].data, rows[0].type, undefined, true)
})

// ---- the signatories ----

function slotOf(value: string | undefined): Slot {
  const slot = SLOTS.find((s) => s === value)
  if (!slot) throw new HttpError(404, 'There is no such signatory.')
  return slot
}

route('GET', `${BASE}/signatories`, async () => signatoriesOf(null))

route('PUT', `${BASE}/admin/signatories`, async (ctx) => {
  await ctx.superadmin()
  const body = await ctx.body<Record<string, unknown>>()
  const current = await currentSignatories()
  for (const slot of SLOTS) {
    if (body[slot] === undefined) continue
    const given = fields(body[slot])
    for (const field of ['name', 'title'] as const) {
      const value = given[field]
      if (value === undefined) continue
      if (typeof value !== 'string' || value.trim().length > 80) {
        throw new HttpError(400, `Keep the ${field} under 80 characters.`)
      }
      current[slot][field] = value.trim()
    }
    if (!current[slot].title) current[slot].title = DEFAULTS[slot].title
  }
  await save(current)
  return signatoriesOf(current)
})

route('PUT', `${BASE}/admin/signatories/:slot/signature`, async (ctx) => {
  await ctx.superadmin()
  const slot = slotOf(ctx.params.slot)
  const { image } = await ctx.body<{ image?: unknown }>(600 * 1024)
  const hash = await storeImage(image)
  const current = await currentSignatories()
  current[slot].signature = hash
  await save(current)
  return signatoriesOf(current)
})

route('DELETE', `${BASE}/admin/signatories/:slot/signature`, async (ctx) => {
  await ctx.superadmin()
  const slot = slotOf(ctx.params.slot)
  const current = await currentSignatories()
  current[slot].signature = null
  await save(current)
  return signatoriesOf(current)
})

// Puts today's signatories on every certificate issued so far: for the certificates from
// before the signatures were added, or after correcting a name.
route('POST', `${BASE}/admin/signatories/apply`, async (ctx) => {
  await ctx.superadmin()
  const current = await currentSignatories()
  if (!complete(current)) throw new HttpError(400, 'Give both signatories a name and a signature first.')
  const { rowCount } = await db.query('UPDATE certificates SET signatories = $1', [current])
  return { certificates: rowCount ?? 0 }
})
