// Sets up "UDSM Beginner CTF" in the local preview: an individual game of beginner
// challenges in web, crypto, forensics and OSINT, each built around one idea.
// Run it after `docker compose up -d`:
//
//   node seed-beginner-ctf.mjs
//
// Web, crypto and forensics challenges give every player their own instance and their
// own flag in the club format udsm{...}. OSINT answers are public facts, so those flags
// are the same for everyone.
//
// It also sets the platform's instance lifetime (60 minutes; in the last 10 a player can
// add 30 more) and builds the challenge images from examples/ when they are missing.
// Re-running is safe: if the game exists, it only adds the challenges it is missing.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE, readEnv, Session, waitForServer } from './gzctf-api.mjs'

const GAME_TITLE = 'UDSM Beginner CTF'
// earlier names of the same game, renamed when found
const FORMER_TITLES = ['UDSM Web Basics']
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

// Container challenges: [TEAM_HASH] is worked out from a secret the server keeps for each
// game, so every player's flag is different and cannot be guessed from someone else's.
// Static challenges (OSINT) list every accepted answer in `flags`.
// The platform shows all hints at once, so they nudge rather than give the answer.
const container = (title, category, folder, score, flagTemplate, content, hints, image = `club/${folder.split('/').pop()}:latest`) => ({
  title, category, image, folder, score, flagTemplate, content, hints,
})
const START = 'Start your instance to'

const challenges = [
  // ------------------------------------------------------------------ web
  container('Staff Portal', 'Web', 'examples/web-container', 100, 'udsm{always_check_the_source_[TEAM_HASH]}',
    'The club is building a members-only staff portal. It is "not finished yet", but it is already online.\n\nDevelopers sometimes leave notes in places visitors are not meant to look. Start your instance and have a look around.',
    ['A web page is more than what the browser draws. Try View Page Source (Ctrl+U).'], 'club/staff-portal:latest'),
  container('Hidden Pages', 'Web', 'examples/hidden-pages', 100, 'udsm{robots_txt_is_public_[TEAM_HASH]}',
    'The club website says it has nothing secret, and that search engines were asked to stay away from its private pages.\n\nHow does a website ask search engines to stay away, and can anyone else read that request?',
    ['Websites keep their instructions for search engines in a plain text file with a standard name. Look it up.']),
  container('Secret Agent', 'Web', 'examples/secret-agent', 150, 'udsm{headers_are_user_input_[TEAM_HASH]}',
    'This page only opens in the official **UDSM-Club-Browser**, which nobody has ever seen.\n\nHow does a website know which browser you use, and who decides what your browser tells it?',
    ['Every request carries a header that names the browser. The page shows you what yours says.',
      'curl and the browser developer tools can send requests with any headers you like.']),
  container('Members Only', 'Web', 'examples/members-only', 150, 'udsm{cookies_can_be_edited_[TEAM_HASH]}',
    'The members area is for admins only, and you are a guest.\n\nThe site remembers who you are between visits. Where does it keep that, and who can change it?',
    ['Open the developer tools (F12) and find this site under Application (Chrome) or Storage (Firefox).']),
  container('Club Shop', 'Web', 'examples/club-shop', 150, 'udsm{hidden_fields_are_not_hidden_[TEAM_HASH]}',
    'You have 10 coins. The club shop sells stickers for 5 coins and the flag for 1000.\n\nYou cannot afford the flag... or can you?',
    ['Right-click a Buy button and choose Inspect. What does the form send besides the item?']),
  container('Member Profiles', 'Web', 'examples/member-profiles', 200, 'udsm{check_who_owns_the_object_[TEAM_HASH]}',
    "Every club member has a profile page, and the club president keeps a private note on theirs.\n\nYou are logged in as a guest. Can you read the president's note?",
    ['Look at the address bar when your profile opens.', 'Members are numbered. Who might be number 1?']),
  container('Club Library', 'Web', 'examples/club-library', 200, 'udsm{dot_dot_slash_[TEAM_HASH]}',
    "The club library lets you read members' notes in the browser.\n\nThe flag is in `/flag.txt` on the server, outside the library's folder.",
    ['Open a book and look at the address bar: the page opens files by name.', 'In a file path, `../` means "the folder above".']),
  container('Ping Tool', 'Web', 'examples/ping-tool', 200, 'udsm{never_trust_user_input_[TEAM_HASH]}',
    'Someone wrote a quick page that checks whether a computer is online: you type an address and it runs `ping` on the server for you.\n\nCan you make it run something other than `ping`? The flag is in `/flag.txt` on the server.',
    ['Ping 127.0.0.1 first and look at the output. The page passes your input to a Linux shell.',
      'In a Linux shell, `;` ends one command and starts another.']),
  container('Admin Login', 'Web', 'examples/admin-login', 250, 'udsm{sql_injection_bypass_[TEAM_HASH]}',
    'Only the admin can see the flag, and the admin password is long and random. Visitors can log in as guest / guest.\n\nThe login page builds an SQL query from what you type. Can you make the database agree that you are the admin?',
    ["Type a single quote ' as the username and read what comes back.", 'In SQL, `--` starts a comment: the rest of the line is ignored.']),

  // --------------------------------------------------------------- crypto
  container('Shifty Notes', 'Crypto', 'examples/shifty-notes', 100, 'udsm{caesar_is_easy_to_break_[TEAM_HASH]}',
    `We found a note pinned to the club notice board. Every letter looks wrong, but the spaces and punctuation are where you would expect them.\n\n${START} read it.`,
    ['Julius Caesar hid his messages by moving every letter the same number of places along the alphabet.',
      'There are only 25 possible shifts. CyberChef or dcode.fr can try them all.']),
  container('Encoding Layers', 'Crypto', 'examples/encoding-layers', 100, 'udsm{encoding_is_not_encryption_[TEAM_HASH]}',
    `A member says they "encrypted" the flag three times, so it must be extra safe.\n\n${START} see what they sent.`,
    ['Encoding is not encryption: there is no key, so anyone can undo it. Recognise each layer by the characters it uses.',
      "CyberChef's From Hex, From Base64 and From Base32 operations each undo one layer. Its Magic operation can guess them."]),
  container('Single Byte', 'Crypto', 'examples/single-byte', 150, 'udsm{one_byte_keys_are_weak_[TEAM_HASH]}',
    `The club treasurer encrypted the flag with XOR and a key that is only one byte long.\n\n${START} see the result, written in hex.`,
    ['Every flag starts with `udsm{`. XOR a byte of the ciphertext with the plaintext byte you know, and you get the key.',
      'A one-byte key has only 256 possible values. CyberChef has an XOR Brute Force operation.']),
  container('Weak Hash', 'Crypto', 'examples/weak-hash', 150, 'udsm{weak_passwords_get_cracked_[TEAM_HASH]}',
    `The club vault is locked with a password, and all we have is its MD5 hash from an old backup.\n\n${START} find the password and open the vault.`,
    ['A hash cannot be decrypted, but the same password always gives the same hash, and common passwords have been hashed and listed long ago.',
      'Look the hash up on a site such as CrackStation, or try a wordlist like rockyou.txt with hashcat or John the Ripper.']),

  // ------------------------------------------------------------ forensics
  container('Not a PDF', 'Forensics', 'examples/not-a-pdf', 100, 'udsm{check_the_magic_bytes_[TEAM_HASH]}',
    `A member emailed their homework as a PDF, but no PDF reader will open it. They insist the file is fine.\n\n${START} download it.`,
    ['A file\'s name can lie, but its first few bytes (its "magic bytes") usually tell the truth. The `file` command reads them.',
      'Look up which kind of file starts with the letters PK.']),
  container('Strings Attached', 'Forensics', 'examples/strings-attached', 100, 'udsm{strings_finds_hidden_text_[TEAM_HASH]}',
    `We copied the firmware off the club room's electronic door lock. The vendor's support page says it contains a debug token.\n\n${START} download it.`,
    ['Most of the file is not text, but some of it is. The `strings` command prints the readable parts of any file.']),
  container('Hidden Metadata', 'Forensics', 'examples/hidden-metadata', 150, 'udsm{metadata_tells_stories_[TEAM_HASH]}',
    `Someone posted a photo of the club whiteboard and said the flag is "in the picture". It is, just not anywhere you can see it.\n\n${START} download it.`,
    ['Image files carry information about themselves, such as who made them and when.',
      'exiftool, or an online metadata viewer, shows all of it. `strings` will not, because this part is compressed.']),
  container('Lost Packets', 'Forensics', 'examples/lost-packets', 200, 'udsm{plaintext_http_leaks_[TEAM_HASH]}',
    `We recorded the traffic on the club Wi-Fi while a member logged in to the old club intranet, which never got HTTPS. What password did they use?\n\n${START} download the capture.`,
    ['Open the file in Wireshark and filter for `http`. Right-click a packet, then Follow > TCP Stream.',
      'Form data in a request is URL-encoded: `%7B` is `{` and `%7D` is `}`.']),

  // ----------------------------------------------------------------- OSINT
  {
    title: 'Campus History',
    category: 'OSINT',
    score: 100,
    flags: ['udsm{1970}'],
    content: "The University of Dar es Salaam opened in 1961 as a college of a British university. In which year did it become Tanzania's first national university?\n\nAnswer with the year: `udsm{yyyy}`.",
    hints: ["The university's own website and encyclopedia articles about it tell its history."],
  },
  {
    title: 'Who Runs .tz?',
    category: 'OSINT',
    score: 100,
    flags: ['udsm{tcra}', 'udsm{tanzania_communications_regulatory_authority}'],
    content: "Every country's internet domain, like .tz for Tanzania, has an organisation in charge of it. According to IANA, which coordinates the internet's names and numbers, which organisation manages .tz?\n\nAnswer with its short name in lowercase: `udsm{abbreviation}`.",
    hints: ['IANA publishes a Root Zone Database that lists every top-level domain and who manages it.'],
  },
  {
    title: 'Where Is This?',
    category: 'OSINT',
    score: 150,
    flags: ['udsm{kilimanjaro}', 'udsm{mount_kilimanjaro}', 'udsm{mt_kilimanjaro}', 'udsm{kibo}', 'udsm{uhuru_peak}'],
    file: 'examples/where-is-this/postcard.jpg',
    content: "A club member sent us this postcard from their holiday but will not say where they were. Which mountain is in the picture?\n\nAnswer with its name in lowercase, with underscores for spaces: `udsm{name}`.",
    hints: ['Photos taken with phones usually record where they were taken.', 'exiftool or an online EXIF viewer shows the GPS position. Paste it into a map.'],
  },
]

async function createChallenge(gameId, spec) {
  const base = `/api/edit/games/${gameId}/challenges`
  const type = spec.flags ? 'StaticAttachment' : 'DynamicContainer'
  const { id } = await admin.call('POST', base, { title: spec.title, category: spec.category, type })
  const common = {
    content: spec.content,
    hints: spec.hints,
    originalScore: spec.score,
    // 5 flag submissions per player; after that this challenge is locked for them
    submissionLimit: 5,
  }
  if (spec.flags) {
    await admin.call('POST', `${base}/${id}/flags`, spec.flags.map((flag) => ({ flag })))
    if (spec.file) {
      const fileHash = await admin.upload(spec.file.split('/').pop(), readFileSync(join(here, spec.file)))
      await admin.call('POST', `${base}/${id}/attachment`, { attachmentType: 'Local', fileHash })
    }
    await admin.call('PUT', `${base}/${id}`, { ...common, isEnabled: true })
  } else {
    await admin.call('PUT', `${base}/${id}`, {
      ...common,
      flagTemplate: spec.flagTemplate,
      containerImage: spec.image,
      exposePort: 80,
      memoryLimit: 64,
      cpuCount: 1,
      storageLimit: 256,
      // no internet access from the instance
      networkMode: 'Isolated',
      isEnabled: true,
    })
  }
  return id
}

const description = {
  summary: 'Beginner challenges in web, crypto, forensics and OSINT, one idea each.',
  content: [
    `A practice game for new club members: ${challenges.length} short challenges in web, crypto, forensics and OSINT, each built around one idea. Start with the 100-point ones.`,
    '',
    '- **Individual:** you play on your own, no team needed. Click **Join** to start.',
    '- **Instances:** web, crypto and forensics challenges start a private copy just for you. It runs for 60 minutes, and in the last 10 minutes you can extend it by 30 more. It takes a few seconds to start: if its page does not open, wait a moment and reload.',
    "- **Flags:** look like `udsm{...}`. Except in OSINT, your flag is different from everyone else's, so a shared flag will not work and is reported to the organisers.",
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
const existing =
  games.data.find((game) => game.title === GAME_TITLE) ?? games.data.find((game) => FORMER_TITLES.includes(game.title))
if (existing) {
  const have = new Set((await admin.call('GET', `/api/edit/games/${existing.id}/challenges`)).map((c) => c.title))
  const missing = challenges.filter((spec) => !have.has(spec.title))
  for (const spec of missing) {
    if (spec.image) ensureImage(spec.image, spec.folder)
    await createChallenge(existing.id, spec)
  }
  // keep the name and description in step with the challenge list; everything else stays as it is
  const current = await admin.call('GET', `/api/edit/games/${existing.id}`)
  await admin.call('PUT', `/api/edit/games/${existing.id}`, { ...current, title: GAME_TITLE, ...description })
  if (existing.title !== GAME_TITLE) console.log(`Renamed "${existing.title}" to "${GAME_TITLE}"`)
  console.log(
    missing.length > 0
      ? `Added ${missing.map((c) => c.title).join(', ')} to "${GAME_TITLE}" (game ${existing.id})`
      : `"${GAME_TITLE}" already has every challenge`
  )
  process.exit(0)
}

for (const spec of challenges) if (spec.image) ensureImage(spec.image, spec.folder)

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
