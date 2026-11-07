// Sets up "UDSM Web Basics" in the local preview: an individual game with two beginner
// web challenges. Every player gets their own instance of each challenge and their own
// flag in the club format udsm{...}. Run it after `docker compose up -d`:
//
//   node seed-web-demo.mjs
//
// It also sets the platform's instance lifetime (60 minutes; in the last 10 a player can
// add 30 more) and builds the two challenge images from examples/ when they are missing.
// Re-running is safe: it stops early when the game already exists.

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE, readEnv, Session, waitForServer } from './gzctf-api.mjs'

const GAME_TITLE = 'UDSM Web Basics'
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const here = dirname(fileURLToPath(import.meta.url))
const env = readEnv(here)

function ensureImage(image, folder) {
  try {
    execFileSync('docker', ['image', 'inspect', image], { stdio: 'ignore' })
  } catch {
    console.log(`Building ${image} from ${folder} ...`)
    execFileSync('docker', ['build', '-t', image, join(here, folder)], { stdio: 'inherit' })
  }
}

// ---------------------------------------------------------------- challenges

// [TEAM_HASH] is worked out from a secret the server keeps for each game, so every
// player's flag is different and cannot be guessed from someone else's.
const challenges = [
  {
    title: 'Staff Portal',
    image: 'club/staff-portal:latest',
    folder: 'examples/web-container',
    score: 100,
    flagTemplate: 'udsm{always_check_the_source_[TEAM_HASH]}',
    content: [
      'The club is building a members-only staff portal. It is "not finished yet", but it is already online.',
      '',
      'Developers sometimes leave notes in places visitors are not meant to look. Start your instance and have a look around.',
    ].join('\n'),
    hints: ['A web page is more than what the browser draws. Try View Page Source (Ctrl+U).'],
  },
  {
    title: 'Ping Tool',
    image: 'club/ping-tool:latest',
    folder: 'examples/ping-tool',
    score: 200,
    flagTemplate: 'udsm{never_trust_user_input_[TEAM_HASH]}',
    content: [
      'Someone wrote a quick page that checks whether a computer is online: you type an address and it runs `ping` on the server for you.',
      '',
      'Can you make it run something other than `ping`? The flag is in `/flag.txt` on the server.',
    ].join('\n'),
    hints: [
      'Ping 127.0.0.1 first and look at the output. The page passes your input to a Linux shell.',
      'In a Linux shell, `;` ends one command and starts another.',
    ],
  },
]

async function createChallenge(gameId, spec) {
  const base = `/api/edit/games/${gameId}/challenges`
  const { id } = await admin.call('POST', base, { title: spec.title, category: 'Web', type: 'DynamicContainer' })
  await admin.call('PUT', `${base}/${id}`, {
    content: spec.content,
    hints: spec.hints,
    originalScore: spec.score,
    flagTemplate: spec.flagTemplate,
    containerImage: spec.image,
    exposePort: 80,
    memoryLimit: 64,
    cpuCount: 1,
    storageLimit: 256,
    // no internet access from the instance
    networkMode: 'Isolated',
    // 5 flag submissions per player; after that this challenge is locked for them
    submissionLimit: 5,
    isEnabled: true,
  })
  return id
}

// ---------------------------------------------------------------------- seed

const admin = new Session('Admin')

console.log(`Waiting for GZCTF on ${BASE} ...`)
await waitForServer()
await admin.login('Admin', env.ADMIN_PASSWORD)

// Applies to every game on the platform (Admin -> Settings -> Container)
const config = await admin.call('GET', '/api/admin/config')
await admin.call('PUT', '/api/admin/config', {
  containerPolicy: {
    ...config.containerPolicy,
    defaultLifetime: 60,
    extensionDuration: 30,
    renewalWindow: 10,
    // with the game's limit of 1, starting a new instance stops the player's old one
    autoDestroyOnLimitReached: true,
  },
})
console.log('Instances: 60 minutes, +30 in the last 10')

const games = await admin.call('GET', '/api/edit/games?count=100&skip=0')
if (games.data.some((game) => game.title === GAME_TITLE)) {
  console.log(`"${GAME_TITLE}" already exists, nothing more to do.`)
  process.exit(0)
}

for (const spec of challenges) ensureImage(spec.image, spec.folder)

// Created with a future start so enabling challenges does not post "new challenge" notices.
const now = Date.now()
const gameInfo = {
  title: GAME_TITLE,
  summary: 'Two beginner web challenges. Every player gets their own instance and their own flag.',
  content: [
    'A short practice game for new club members.',
    '',
    '- **Individual:** you play on your own, no team needed. Click **Join** to start.',
    '- **Instances:** each challenge starts a private copy just for you. It runs for 60 minutes, and in the last 10 minutes you can extend it by 30 more.',
    "- **Flags:** look like `udsm{...}`. Your flag is different from everyone else's, so a shared flag will not work and is reported to the organisers.",
    '- **Attempts:** 5 flag submissions per challenge. When they are used up, that challenge is locked for you, so check your flag before you submit.',
    '- **Rules:** attack only your own instance. Never the platform or other players.',
  ].join('\n'),
  hidden: false,
  acceptWithoutReview: true,
  practiceMode: true,
  writeupRequired: false,
  // team size 1 makes this an individual game
  teamMemberCountLimit: 1,
  // one running instance per player at a time
  containerCountLimit: 1,
  start: now + DAY,
  end: now + 30 * DAY,
  writeupDeadline: now + 31 * DAY,
}
const game = await admin.call('POST', '/api/edit/games', gameInfo)

for (const spec of challenges) await createChallenge(game.id, spec)
console.log(`Game ${game.id} created with ${challenges.map((c) => c.title).join(' and ')}`)

await admin.call('POST', `/api/edit/games/${game.id}/notices`, {
  content: 'Welcome! Flags look like `udsm{...}` and you have 5 attempts per challenge. Attack only your own instance.',
})

await admin.call('PUT', `/api/edit/games/${game.id}`, { ...game, ...gameInfo, start: now - MINUTE })

console.log(`Done. Open ${BASE}/games/${game.id}`)
