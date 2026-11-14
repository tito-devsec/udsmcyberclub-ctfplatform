// Labs, profiles, the ranking and certificates: the rest of the CyberRange service's API.
import { TFunction } from 'i18next'
import {
  AnswerResult,
  Category,
  coverIcon,
  Difficulty,
  MachineInfo,
  ModuleStatus,
  ModuleSummary,
  PathSummary,
  Question,
  RANGE_API,
  rangeCall,
  Role,
  SkillLevel,
  Standing,
  useRange,
} from '@Utils/Range'
import { UiconName } from '@Utils/Uicons'

// ---- labs ----

// a boot-to-root machine, another machine to attack, or a challenge with files or a puzzle
export type LabKind = 'b2r' | 'machine' | 'challenge'
// the system a boot-to-root machine runs
export type LabSystem = 'linux' | 'windows'

export const LabKindIcon: Record<LabKind, UiconName> = { b2r: 'skull', machine: 'computer', challenge: 'puzzle-alt' }
// Uicons has no Linux logo: a terminal stands for it
export const SystemIcon: Record<LabSystem, UiconName> = { linux: 'terminal', windows: 'windows-brands' }

export interface LabSummary {
  slug: string
  title: string
  summary: string
  category: Category
  difficulty: Difficulty
  minutes: number
  icon: string | null
  xp: number
  kind: LabKind
  os: LabSystem | null
  tasks: number
  solved: number
  status: ModuleStatus
  solvers: number
  updated: string | null
  // when it went online
  released: string | null
}

interface Person {
  name: string
  avatar: string | null
  verified: boolean
}

// the first student to take one of a boot-to-root machine's flags
export interface Blood extends Person {
  at: string
  // seconds after the lab went online
  after: number
}

export interface Creator extends Person {
  // whether they have a profile here
  member: boolean
  respects: number
  // whether whoever is looking has given them respect, or is them
  respected: boolean
  self: boolean
}

// A lab with everything on its page. `tasks` is a count in the summary and the list here.
export interface Lab extends Omit<LabSummary, 'tasks'> {
  scenario: string
  bonus: number
  signedIn: boolean
  machine: { port: number } | null
  // the names its machine is kept under, to tell whether a running machine is this lab's
  machineKey: { module: string; section: string }
  files: { name: string; size: number; url: string }[]
  firstSolve: { name: string; at: string } | null
  creator: Creator | null
  // for a boot-to-root machine: who took its user flag first, and its root flag
  bloods: { user: Blood | null; root: Blood | null } | null
  tasks: Question[]
}

export const useLabs = () => useRange<LabSummary[]>(`${RANGE_API}/labs`)
export const useLab = (lab?: string) => useRange<Lab>(lab ? `${RANGE_API}/labs/${lab}` : null)

export const labsApi = {
  answer: (lab: string, task: string, answer: string) =>
    rangeCall<AnswerResult>('POST', `${RANGE_API}/labs/${lab}/tasks/${task}`, { answer }),
  startMachine: (lab: string) => rangeCall<MachineInfo>('POST', `${RANGE_API}/labs/${lab}/machine`),
  // respect for a lab's creator, given or taken back
  respect: (name: string, give: boolean) =>
    rangeCall<{ respects: number; respected: boolean }>(
      give ? 'PUT' : 'DELETE',
      `${RANGE_API}/respect/${encodeURIComponent(name)}`
    ),
}

// "0H 4M 0S", or with days in front once it took that long, as the time a blood took
export function bloodTime(seconds: number) {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return `${days > 0 ? `${days}D ` : ''}${hours}H ${minutes}M ${rest}S`
}

// "6th June, 2026", as a lab's release is written
export function releaseDate(iso: string, language: string) {
  const date = new Date(iso)
  if (!language.startsWith('en')) return date.toLocaleDateString(language, { dateStyle: 'long' })
  const day = date.getDate()
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'
  return `${day}${suffix} ${date.toLocaleDateString('en-GB', { month: 'long' })}, ${date.getFullYear()}`
}

export const labUrl = (lab: string) => `/labs/${lab}`

// the categories labs come in: every one except "general"
export const LAB_CATEGORIES: Category[] = [
  'web',
  'crypto',
  'forensics',
  'osint',
  'reverse',
  'pwn',
  'stego',
  'misc',
  'hardware',
  'ics',
  'ai',
  'web3',
]

// ---- profiles ----

export interface Badge {
  id: string
  earnedAt: string | null
}

export interface Certificate {
  id: string
  // a finished module or skill path, or taking part in a game
  kind: 'module' | 'path' | 'game'
  ref: string
  title: string
  issuedAt: string
}

export interface ProfileLinks {
  github?: string
  linkedin?: string
  x?: string
  website?: string
}

export interface Profile extends Standing {
  name: string
  avatar: string | null
  role: Role
  verified: boolean
  bio: string
  country: string | null
  links: ProfileLinks
  skillLevel: SkillLevel | null
  memberSince: string
  lastActive: string
  // whether this is the profile of whoever is looking at it
  self: boolean
  weekXp: number
  position: number | null
  of: number
  stats: {
    modulesCompleted: number
    pathsCompleted: number
    labsSolved: number
    questions: number
    flags: number
    certificates: number
    // labs online that name them as their creator, and the respect members gave them for it
    labsCreated: number
    respects: number
  }
  streak: { current: number; best: number; goal: number; weekXp: number }
  badges: Badge[]
  certificates: Certificate[]
  completedModules: (ModuleSummary & { completedAt: string | null })[]
  paths: (PathSummary & { completedAt: string | null })[]
  labs: {
    slug: string
    title: string
    category: Category
    difficulty: Difficulty
    icon: string | null
    xp: number
    kind: LabKind
    solvedAt: string
  }[]
  categories: { category: Category; xp: number; total: number }[]
}

export const useProfile = (name?: string) =>
  useRange<Profile>(name ? `${RANGE_API}/profiles/${encodeURIComponent(name)}` : null)

export const profileApi = {
  update: (changes: { bio?: string; country?: string | null; links?: ProfileLinks }) =>
    rangeCall<Profile>('PUT', `${RANGE_API}/me/profile`, changes),
  // after changing the picture on the platform: shows it here at once
  sync: () => rangeCall<Profile>('POST', `${RANGE_API}/me/sync`),
}

export const profileUrl = (name: string) => `/profile/${encodeURIComponent(name)}`

export const linkUrl: Record<keyof ProfileLinks, (value: string) => string> = {
  github: (name) => `https://github.com/${name}`,
  linkedin: (name) => `https://www.linkedin.com/in/${name}`,
  x: (name) => `https://x.com/${name}`,
  website: (url) => url,
}

export const linkIcon: Record<keyof ProfileLinks, UiconName> = {
  github: 'github-brands',
  linkedin: 'linkedin-brands',
  x: 'twitter-alt-brands',
  website: 'link',
}

// ---- ranking ----

export type RankingScope = 'hall' | 'week' | 'all'

export interface RankingEntry {
  position: number
  name: string
  avatar: string | null
  country: string | null
  verified: boolean
  rank: string
  rankIndex: number
  level: number
  // XP in the period shown, and in all
  xp: number
  total: number
  tasks: number
  lastActive: string
  me: boolean
}

export interface Ranking {
  scope: RankingScope
  page: number
  size: number
  total: number
  matched: number
  // the top three, and the list under them: from fourth place, or whoever a search finds
  podium: RankingEntry[]
  entries: RankingEntry[]
  me: RankingEntry | null
  period: { start: string; end: string } | null
  nextUpdate: string
}

export const useRanking = (scope: RankingScope, page: number, size: number, search: string) =>
  useRange<Ranking>(
    `${RANGE_API}/ranking?scope=${scope}&page=${page}&size=${size}&q=${encodeURIComponent(search)}`,
    // the ranking moves while people play
    { refreshInterval: 60_000, revalidateOnFocus: true, shouldRetryOnError: false, keepPreviousData: true }
  )

// ---- certificates ----

// Someone who signs certificates: the club's president, and the college's principal.
export interface Signatory {
  slot: 'president' | 'principal'
  name: string
  title: string
  // where the picture of their signature is
  signature: string | null
}

export interface CertificateDetail extends Certificate {
  // the name on the certificate, and the user name behind it
  name: string
  userName: string
  // whether its holder has a profile here (players of a game may never have opened CyberRange)
  profile: boolean
  // who signed it: the signatories on the day it was issued
  signatories: Signatory[]
  summary: string | null
  // the symbol of the module or skill path
  icon: string | null
  // for a certificate of participation: when the game was, and the team they played in
  game: GameFacts | null
  category: Category | null
  difficulty: Difficulty | null
  minutes: number | null
  modules: string[] | null
}

export const useCertificate = (id?: string) =>
  useRange<CertificateDetail>(id ? `${RANGE_API}/certificates/${id}` : null)

export const certificateUrl = (id: string) => `/certificates/${id}`

export interface GameFacts {
  start: string | null
  end: string | null
  team: string | null
}

// The symbol in the middle of a certificate's seal: the module's or skill path's own, or a
// flag for a game.
export const certificateIcon = (certificate: {
  kind: Certificate['kind']
  icon: string | null
  category?: Category | null
}): UiconName =>
  certificate.kind === 'game' ? 'flag-alt' : coverIcon(certificate.icon, certificate.category ?? undefined)

// "12 Nov 2026 – 14 Nov 2026 · Team: Byte Bandits", for a certificate of participation
export const gameFacts = (game: GameFacts, t: TFunction, language: string) =>
  [
    game.start && game.end && `${shortDate(game.start, language)} – ${shortDate(game.end, language)}`,
    game.team ? t('range.certificate.team', { team: game.team }) : t('range.certificate.individual'),
  ]
    .filter(Boolean)
    .join(' · ')

// ---- games, for the superadmin: their certificates of participation ----

export interface CertificateGame {
  id: number
  title: string
  summary: string
  hidden: boolean
  start: string
  end: string
  individual: boolean
  stage: 'upcoming' | 'running' | 'ended'
  // certificates of participation issued so far
  issued: number
}

export const useCertificateGames = (enabled: boolean) =>
  useRange<CertificateGame[]>(enabled ? `${RANGE_API}/admin/games` : null)

export const gameCertificatesApi = {
  // to everyone who took part, once the game is over; again, to whoever has none yet
  issue: (game: number) =>
    rangeCall<{ participants: number; added: number; issued: number }>(
      'POST',
      `${RANGE_API}/admin/games/${game}/certificates`
    ),
}

export const useSignatories = (enabled = true) => useRange<Signatory[]>(enabled ? `${RANGE_API}/signatories` : null)

type SignatoryChanges = Partial<Record<Signatory['slot'], { name?: string; title?: string }>>

// for the superadmin
export const signatoriesApi = {
  save: (changes: SignatoryChanges) => rangeCall<Signatory[]>('PUT', `${RANGE_API}/admin/signatories`, changes),
  // `image` is the picture as a "data:" address
  upload: (slot: Signatory['slot'], image: string) =>
    rangeCall<Signatory[]>('PUT', `${RANGE_API}/admin/signatories/${slot}/signature`, { image }),
  remove: (slot: Signatory['slot']) =>
    rangeCall<Signatory[]>('DELETE', `${RANGE_API}/admin/signatories/${slot}/signature`),
  // puts today's signatories on every certificate issued so far
  apply: () => rangeCall<{ certificates: number }>('POST', `${RANGE_API}/admin/signatories/apply`),
}

// a certificate's number, in groups of four: A1B2-C3D4-E5F6-0718
export const certificateNumber = (id: string) => (id.toUpperCase().match(/.{1,4}/g) ?? []).join('-')

// ---- members, for the superadmin ----

export interface Member {
  id: string
  name: string
  avatar: string | null
  role: Role
  // a platform admin: their role and tick come with the account
  admin: boolean
  verified: boolean
  skillLevel: SkillLevel | null
  xp: number
  rank: string
  rankIndex: number
  level: number
  lastActiveAt: string
}

export const useMembers = (enabled: boolean) => useRange<Member[]>(enabled ? `${RANGE_API}/admin/users` : null)

export const membersApi = {
  setRole: (id: string, role: 'tutor' | 'student') =>
    rangeCall<{ id: string; name: string; role: string }>('PUT', `${RANGE_API}/admin/users/${id}/role`, { role }),
  // a platform admin, or an ordinary member again
  setAdmin: (id: string, admin: boolean) =>
    rangeCall<{ id: string; name: string; admin: boolean }>('PUT', `${RANGE_API}/admin/users/${id}/admin`, { admin }),
  setVerified: (id: string, verified: boolean) =>
    rangeCall<{ id: string; name: string; verified: boolean }>('PUT', `${RANGE_API}/admin/users/${id}/verified`, {
      verified,
    }),
}

// ---- countries and dates ----

// ISO 3166 country codes; their names come from the browser, in the reader's language
export const COUNTRY_CODES =
  'TZ KE UG RW BI CD ZM MW MZ ET SO SS SD ZA NG GH EG MA DZ TN SN CI CM AO ZW BW NA MG MU SC DJ ER LY ML NE TD BF BJ TG GN SL LR GM GW CV MR GA CG CF GQ ST KM LS SZ US CA MX BR AR CL CO PE VE EC BO PY UY CU DO HT JM TT GB IE FR DE ES PT IT NL BE LU CH AT DK SE NO FI IS PL CZ SK HU RO BG GR HR SI RS BA ME MK AL UA BY MD LT LV EE RU TR CY MT GE AM AZ KZ UZ KG TJ TM IL PS JO LB SY IQ IR SA AE QA KW BH OM YE AF PK IN BD LK NP BT MV CN JP KR KP MN TW HK MO SG MY ID TH VN PH KH LA MM BN TL AU NZ PG FJ'.split(
    ' '
  )

export function countryName(code: string | null, language: string): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

// "3 hours ago", in the reader's language
export function ago(iso: string, language: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
  }
  return format.format(0, 'minute')
}

export const shortDate = (iso: string, language: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(language, { dateStyle: 'medium' })
