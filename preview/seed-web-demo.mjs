// Sets up "UDSM Web Basics" in the local preview: an individual game of beginner web
// challenges, each built around one classic mistake. Every player gets their own
// instance of each challenge and their own flag in the club format udsm{...}.
// Run it after `docker compose up -d`:
//
//   node seed-web-demo.mjs
//
// It also sets the platform's instance lifetime (60 minutes; in the last 10 a player can
// add 30 more) and builds the challenge images from examples/ when they are missing.
// Re-running is safe: if the game exists, it only adds the challenges it is missing.

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
// The platform shows all hints at once, so they nudge rather than give the answer.
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
    title: 'Hidden Pages',
    image: 'club/hidden-pages:latest',
    folder: 'examples/hidden-pages',
    score: 100,
    flagTemplate: 'udsm{robots_txt_is_public_[TEAM_HASH]}',
    content: [
      'The club website says it has nothing secret, and that search engines were asked to stay away from its private pages.',
      '',
      'How does a website ask search engines to stay away, and can anyone else read that request?',
    ].join('\n'),
    hints: ['Websites keep their instructions for search engines in a plain text file with a standard name. Look it up.'],
  },
  {
    title: 'Secret Agent',
    image: 'club/secret-agent:latest',
    folder: 'examples/secret-agent',
    score: 150,
    flagTemplate: 'udsm{headers_are_user_input_[TEAM_HASH]}',
    content: [
      'This page only opens in the official **UDSM-Club-Browser**, which nobody has ever seen.',
      '',
      'How does a website know which browser you use, and who decides what your browser tells it?',
    ].join('\n'),
    hints: [
      'Every request carries a header that names the browser. The page shows you what yours says.',
      'curl and the browser developer tools can send requests with any headers you like.',
    ],
  },
  {
    title: 'Members Only',
    image: 'club/members-only:latest',
    folder: 'examples/members-only',
    score: 150,
    flagTemplate: 'udsm{cookies_can_be_edited_[TEAM_HASH]}',
    content: [
      'The members area is for admins only, and you are a guest.',
      '',
      'The site remembers who you are between visits. Where does it keep that, and who can change it?',
    ].join('\n'),
    hints: ['Open the developer tools (F12) and find this site under Application (Chrome) or Storage (Firefox).'],
  },
  {
    title: 'Club Shop',
    image: 'club/club-shop:latest',
    folder: 'examples/club-shop',
    score: 150,
    flagTemplate: 'udsm{hidden_fields_are_not_hidden_[TEAM_HASH]}',
    content: [
      'You have 10 coins. The club shop sells stickers for 5 coins and the flag for 1000.',
      '',
      'You cannot afford the flag... or can you?',
    ].join('\n'),
    hints: ['Right-click a Buy button and choose Inspect. What does the form send besides the item?'],
  },
  {
    title: 'Member Profiles',
    image: 'club/member-profiles:latest',
    folder: 'examples/member-profiles',
    score: 200,
    flagTemplate: 'udsm{check_who_owns_the_object_[TEAM_HASH]}',
    content: [
      "Every club member has a profile page, and the club president keeps a private note on theirs.",
      '',
      "You are logged in as a guest. Can you read the president's note?",
    ].join('\n'),
    hints: ['Look at the address bar when your profile opens.', 'Members are numbered. Who might be number 1?'],
  },
  {
    title: 'Club Library',
    image: 'club/club-library:latest',
    folder: 'examples/club-library',
    score: 200,
    flagTemplate: 'udsm{dot_dot_slash_[TEAM_HASH]}',
    content: [
      "The club library lets you read members' notes in the browser.",
      '',
      "The flag is in `/flag.txt` on the server, outside the library's folder.",
    ].join('\n'),
    hints: ['Open a book and look at the address bar: the page opens files by name.', 'In a file path, `../` means "the folder above".'],
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
  {
    title: 'Admin Login',
    image: 'club/admin-login:latest',
    folder: 'examples/admin-login',
    score: 250,
    flagTemplate: 'udsm{sql_injection_bypass_[TEAM_HASH]}',
    content: [
      'Only the admin can see the flag, and the admin password is long and random. Visitors can log in as guest / guest.',
      '',
      'The login page builds an SQL query from what you type. Can you make the database agree that you are the admin?',
    ].join('\n'),
    hints: ["Type a single quote ' as the username and read what comes back.", 'In SQL, `--` starts a comment: the rest of the line is ignored.'],
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

const description = {
  summary: 'Beginner web challenges. Every player gets their own instance and their own flag.',
  content: [
    `A practice game for new club members: ${challenges.length} short web challenges, each built around one classic mistake. Start with the 100-point ones.`,
    '',
    '- **Individual:** you play on your own, no team needed. Click **Join** to start.',
    '- **Instances:** each challenge starts a private copy just for you. It runs for 60 minutes, and in the last 10 minutes you can extend it by 30 more.',
    "- **Flags:** look like `udsm{...}`. Your flag is different from everyone else's, so a shared flag will not work and is reported to the organisers.",
    '- **Attempts:** 5 flag submissions per challenge. When they are used up, that challenge is locked for you, so check your flag before you submit.',
    '- **Rules:** attack only your own instance. Never the platform or other players.',
  ].join('\n'),
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
const existing = games.data.find((game) => game.title === GAME_TITLE)
if (existing) {
  const have = new Set((await admin.call('GET', `/api/edit/games/${existing.id}/challenges`)).map((c) => c.title))
  const missing = challenges.filter((spec) => !have.has(spec.title))
  for (const spec of missing) {
    ensureImage(spec.image, spec.folder)
    await createChallenge(existing.id, spec)
  }
  // keep the description in step with the challenge list; everything else stays as it is
  const current = await admin.call('GET', `/api/edit/games/${existing.id}`)
  await admin.call('PUT', `/api/edit/games/${existing.id}`, { ...current, ...description })
  console.log(
    missing.length > 0
      ? `Added ${missing.map((c) => c.title).join(', ')} to "${GAME_TITLE}" (game ${existing.id})`
      : `"${GAME_TITLE}" already has every challenge`
  )
  process.exit(0)
}

for (const spec of challenges) ensureImage(spec.image, spec.folder)

// Created with a future start so enabling challenges does not post "new challenge" notices.
const now = Date.now()
const gameInfo = {
  title: GAME_TITLE,
  ...description,
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
console.log(`Game ${game.id} created with ${challenges.length} challenges`)

await admin.call('POST', `/api/edit/games/${game.id}/notices`, {
  content: 'Welcome! Flags look like `udsm{...}` and you have 5 attempts per challenge. Attack only your own instance.',
})

await admin.call('PUT', `/api/edit/games/${game.id}`, { ...game, ...gameInfo, start: now - MINUTE })

console.log(`Done. Open ${BASE}/games/${game.id}`)
