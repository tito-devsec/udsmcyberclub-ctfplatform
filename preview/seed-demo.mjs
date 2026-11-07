// Seeds the local GZCTF preview with a test player, a few demo teams and a demo game,
// so there is something to look at. Run it once, after `docker compose up -d`:
//
//   node seed-demo.mjs
//
// Re-running is safe: it stops early when the demo game already exists.

import { execFileSync } from 'node:child_process'
import { createHmac, randomBytes, randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.GZCTF_URL ?? 'http://localhost:3000'
const GAME_TITLE = 'Cyber Club Demo CTF'
const HOUR = 3600_000
const DAY = 24 * HOUR

const here = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(here, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class Session {
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

  login(userName, password) {
    return this.call('POST', '/api/account/login', { userName, password })
  }

  async upload(fileName, bytes) {
    const form = new FormData()
    form.append('files', new Blob([bytes]), fileName)
    const [file] = await this.send('POST', '/api/assets', { body: form })
    return file.hash
  }
}

async function waitForServer() {
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

// ---------------------------------------------------------------- challenges

const rot13 = (text) =>
  text.replace(/[a-z]/gi, (c) =>
    String.fromCharCode((((c.charCodeAt(0) & 31) + 12) % 26) + 1 + (c.charCodeAt(0) & 96))
  )

const base64url = (value) => Buffer.from(value).toString('base64url')

function makeJwt(flag) {
  const head = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify({ sub: 'guest', role: 'member', note: flag }))
  const signature = createHmac('sha256', randomBytes(32)).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${signature}`
}

function makeFirmware(flag) {
  const blob = randomBytes(6144)
  // keep the noise unreadable so `strings` only finds what we plant
  for (let i = 0; i < blob.length; i++) if (blob[i] >= 0x20 && blob[i] < 0x7f) blob[i] |= 0x80
  const plant = (offset, text) => blob.write(text + '\0', offset, 'latin1')
  plant(0, 'CLUBFW\x01\x02')
  plant(512, 'bootloader v2.4.1 (build 2026-03-14)')
  plant(1500, 'Enter maintenance password: ')
  plant(2300, 'Access denied.')
  plant(3700, `debug_token=${flag}`)
  plant(5200, 'watchdog: reset reason %d')
  return blob
}

function makeCapture(flag) {
  const request =
    `POST /api/session HTTP/1.1\r\nHost: intranet.club.local\r\nUser-Agent: curl/8.5.0\r\n` +
    `Content-Type: application/x-www-form-urlencoded\r\n\r\nuser=treasurer&secret=${flag}`
  const bytes = Buffer.from(request)
  const lines = ['# tcp stream 7  10.0.0.23:51844 -> 10.0.0.5:80']
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const row = [...bytes.subarray(offset, offset + 16)].map((b) => b.toString(16).padStart(2, '0'))
    lines.push(`${offset.toString(16).padStart(4, '0')}  ${row.join(' ')}`)
  }
  return Buffer.from(lines.join('\n') + '\n')
}

const placeholderNote = '_Demo placeholder: a real version would give you a service to attack._'

const challenges = [
  {
    key: 'sanity',
    title: 'Sanity Check',
    category: 'Misc',
    score: 100,
    flag: 'flag{w3lc0me_t0_th3_club}',
    content: (flag) =>
      `Welcome aboard! Every CTF needs a free one.\n\nCopy this flag into the box below and submit it:\n\n\`\`\`\n${flag}\n\`\`\``,
  },
  {
    key: 'caesar',
    title: "Caesar's Secret",
    category: 'Crypto',
    score: 200,
    flag: 'flag{rot13_is_not_encryption}',
    hints: ['Julius liked shifting letters. Halfway round the alphabet is a popular choice.'],
    content: (flag) =>
      `We intercepted a note passed around during the last club meeting:\n\n\`\`\`\n${rot13(flag)}\n\`\`\`\n\nCan you read it?`,
  },
  {
    key: 'base64',
    title: 'Base Jumping',
    category: 'Crypto',
    score: 300,
    flag: 'flag{l4yers_0n_l4yers}',
    content: (flag) =>
      `Somebody thought encoding a secret twice makes it twice as safe:\n\n\`\`\`\n${Buffer.from(Buffer.from(flag).toString('base64')).toString('base64')}\n\`\`\``,
  },
  {
    key: 'jwt',
    title: 'Token Trouble',
    category: 'Web',
    score: 300,
    flag: 'flag{jwt_p4yl0ads_ar3_n0t_s3cret}',
    hints: ['A JWT is three base64url parts joined by dots.'],
    content: (flag) =>
      `The members portal hands every visitor a session token. Here is ours:\n\n\`\`\`\n${makeJwt(flag)}\n\`\`\`\n\nThe developers swear nothing sensitive is stored in it.`,
  },
  {
    key: 'strings',
    title: 'Strings Attached',
    category: 'Reverse',
    score: 400,
    flag: 'flag{str1ngs_4re_y0ur_fr1end}',
    file: { name: 'firmware.bin', make: makeFirmware },
    content: () =>
      'We pulled this firmware image off the door controller of the club room. The vendor left a debug token inside.\n\nDownload the attachment and dig it out.',
  },
  {
    key: 'packets',
    title: 'Lost Packets',
    category: 'Forensics',
    score: 400,
    flag: 'flag{pl41ntext_http_1s_4_g1ft}',
    file: { name: 'stream7.txt', make: makeCapture },
    content: () =>
      'Someone logged in to the intranet over plain HTTP while we were capturing traffic. The attachment is a hex dump of that TCP stream.\n\nWhat secret did they send?',
  },
  {
    key: 'stack',
    title: 'Stack Smasher',
    category: 'Pwn',
    score: 500,
    flag: 'flag{sm4sh_th3_st4ck_f0r_fun}',
    content: () =>
      `A tiny echo service reads your name into a 64-byte buffer with \`gets()\`. There is a \`win()\` function that prints the flag.\n\n${placeholderNote}`,
  },
  {
    key: 'geo',
    title: 'Where It All Began',
    category: 'OSINT',
    score: 300,
    flag: 'flag{las_vegas}',
    content: () =>
      'The very first DEF CON took place in 1993. In which city?\n\nFlag format: `flag{city_name}`, lowercase, with underscores instead of spaces.',
  },
]

// ------------------------------------------------------------------- players

const players = [
  { userName: env.TEST_USER_NAME, password: env.TEST_USER_PASSWORD, teamName: 'Test Team' },
  { userName: 'alice', teamName: 'Null Pointers' },
  { userName: 'bob', teamName: 'Null Pointers' },
  { userName: 'carol', teamName: 'Kernel Panic' },
  { userName: 'dave', teamName: 'Byte Me' },
  { userName: 'erin', teamName: 'Stack Smashers' },
].map((player) => ({
  password: env.DEMO_PLAYER_PASSWORD,
  ...player,
  email: `${player.userName}@example.invalid`,
}))

// Who submits what, in order. `false` marks a wrong attempt.
const storyline = [
  ['alice', 'sanity'],
  ['carol', 'sanity'],
  ['dave', 'sanity'],
  ['alice', 'caesar'],
  ['erin', 'sanity'],
  ['bob', 'base64'],
  ['carol', 'caesar', false],
  ['carol', 'caesar'],
  ['dave', 'base64'],
  ['bob', 'jwt'],
  ['carol', 'strings'],
  ['dave', 'caesar'],
  ['bob', 'strings', false],
  ['bob', 'strings'],
  ['carol', 'jwt'],
  ['alice', 'packets'],
  ['erin', 'caesar'],
  ['dave', 'geo', false],
  ['alice', 'stack'],
]

// ---------------------------------------------------------------------- seed

const admin = new Session('Admin')

async function createChallenge(gameId, spec) {
  const base = `/api/edit/games/${gameId}/challenges`
  const { id } = await admin.call('POST', base, {
    title: spec.title,
    category: spec.category,
    type: 'StaticAttachment',
  })
  await admin.call('POST', `${base}/${id}/flags`, [{ flag: spec.flag }])
  if (spec.file) {
    const fileHash = await admin.upload(spec.file.name, spec.file.make(spec.flag))
    await admin.call('POST', `${base}/${id}/attachment`, { attachmentType: 'Local', fileHash })
  }
  await admin.call('PUT', `${base}/${id}`, {
    content: spec.content(spec.flag),
    hints: spec.hints ?? [],
    originalScore: spec.score,
    isEnabled: true,
  })
  return id
}

async function submit(session, gameId, challengeId, flag) {
  const base = `/api/game/${gameId}/challenges/${challengeId}`
  const submissionId = await session.call('POST', base, { flag })
  for (let attempt = 0; attempt < 40; attempt++) {
    const status = await session.call('GET', `${base}/status/${submissionId}`)
    if (status !== 'FlagSubmitted') return status
    await sleep(250)
  }
  throw new Error(`submission ${submissionId} was never judged`)
}

// Everything above happens within a minute. Stretch it across the game so far,
// so the scoreboard chart and the event feed look like a competition in progress.
function spreadOverGame(gameId) {
  const id = Number(gameId)
  const stretch = (table, column) => `
    UPDATE "${table}" x
    SET "${column}" = w.s0 + (w.s1 - w.s0) *
        (extract(epoch FROM x."${column}" - w.t0) / extract(epoch FROM w.t1 - w.t0))
    FROM seed_window w
    WHERE x."GameId" = ${id} AND w.t1 > w.t0;`
  const sql = `
    CREATE TEMP TABLE seed_window ON COMMIT DROP AS
    SELECT min(s.t) AS t0, max(s.t) AS t1,
           g."StartTimeUtc" + interval '40 minutes' AS s0, now() - interval '25 minutes' AS s1
    FROM "Games" g, (
      SELECT "SubmitTimeUtc" AS t FROM "Submissions" WHERE "GameId" = ${id}
      UNION ALL SELECT "PublishTimeUtc" FROM "GameEvents" WHERE "GameId" = ${id}
      UNION ALL SELECT "PublishTimeUtc" FROM "GameNotices" WHERE "GameId" = ${id}
    ) s
    WHERE g."Id" = ${id}
    GROUP BY g."StartTimeUtc";
    ${stretch('Submissions', 'SubmitTimeUtc')}
    ${stretch('GameEvents', 'PublishTimeUtc')}
    ${stretch('GameNotices', 'PublishTimeUtc')}`
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'gzctf', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { cwd: here, stdio: ['ignore', 'ignore', 'inherit'] }
  )
}

console.log(`Waiting for GZCTF on ${BASE} ...`)
await waitForServer()
await admin.login('Admin', env.ADMIN_PASSWORD)

const games = await admin.call('GET', '/api/edit/games?count=100&skip=0')
if (games.data.some((game) => game.title === GAME_TITLE)) {
  console.log(`"${GAME_TITLE}" already exists, nothing to do.`)
  process.exit(0)
}

const known = new Set((await admin.call('GET', '/api/admin/users?count=500')).data.map((u) => u.userName))
const fresh = players.filter((player) => !known.has(player.userName))
if (fresh.length > 0) await admin.call('POST', '/api/admin/users', fresh)
console.log(`Players ready: ${players.map((p) => p.userName).join(', ')}`)

// Created with a future start so enabling challenges does not spam "new challenge" notices.
const now = Date.now()
const gameInfo = {
  title: GAME_TITLE,
  summary: 'A sample competition seeded for the local preview. Log in as a player and try it out.',
  content: [
    'This game exists only to show how the platform works.',
    '',
    '- **Format:** jeopardy, teams of up to four',
    '- **Scoring:** dynamic. A challenge is worth less the more teams solve it, and the first three solvers earn a bonus',
    '- **Flags:** look like `flag{...}`',
    '',
    'Most challenges here can really be solved. Give them a go!',
  ].join('\n'),
  hidden: false,
  acceptWithoutReview: true,
  practiceMode: true,
  writeupRequired: false,
  teamMemberCountLimit: 4,
  containerCountLimit: 3,
  start: now + DAY,
  end: now + 12 * DAY,
  writeupDeadline: now + 13 * DAY,
}
const game = await admin.call('POST', '/api/edit/games', gameInfo)

const challengeIds = {}
for (const spec of challenges) challengeIds[spec.key] = await createChallenge(game.id, spec)
console.log(`Game ${game.id} created with ${challenges.length} challenges`)

await admin.call('PUT', `/api/edit/games/${game.id}`, { ...game, ...gameInfo, start: now - 2 * DAY })

const sessions = {}
for (const player of players) {
  const session = new Session(player.userName)
  await session.login(player.userName, player.password)
  const [team] = await session.call('GET', '/api/team')
  await session.call('POST', `/api/game/${game.id}`, { teamId: team.id })
  await session.call('GET', `/api/game/${game.id}/details`)
  sessions[player.userName] = session
}
console.log('All teams joined the game')

await admin.call('POST', `/api/edit/games/${game.id}/notices`, {
  content: 'Welcome to the demo CTF! Flags look like `flag{...}`. Ask an organiser if something seems broken.',
})

const flags = Object.fromEntries(challenges.map((spec) => [spec.key, spec.flag]))
for (const [index, [userName, key, correct = true]] of storyline.entries()) {
  await sleep(randomInt(400, 2500))
  const flag = correct ? flags[key] : 'flag{n0t_qu1te_r1ght}'
  const status = await submit(sessions[userName], game.id, challengeIds[key], flag)
  console.log(`  ${userName.padEnd(6)} -> ${key.padEnd(8)} ${status}`)

  if (index === 12) {
    await admin.call('PUT', `/api/edit/games/${game.id}/challenges/${challengeIds.stack}`, {
      hints: ['How far is the saved return address from the start of the buffer?'],
    })
  }
}

try {
  spreadOverGame(game.id)
} catch (error) {
  console.warn(`Could not spread the demo activity over time (${error.message}); it all shows as "just now".`)
}
await admin.call('POST', `/api/edit/games/${game.id}/scoreboard/flush`)

// Pinning has to be its own request: the API ignores every other field when isPinned is set.
const postId = await admin.call('POST', '/api/edit/posts', {
  title: 'The demo CTF is live',
  summary: 'Eight sample challenges are waiting under Games. Grab a team and start hunting flags.',
  content:
    'Head over to **Games**, open *Cyber Club Demo CTF* and pick a challenge.\n\nThis post was created by the preview seed script; edit or delete it from the admin panel.',
  tags: ['announcement'],
})
await admin.call('PUT', `/api/edit/posts/${postId}`, { isPinned: true })

console.log(`Done. Open ${BASE}`)
