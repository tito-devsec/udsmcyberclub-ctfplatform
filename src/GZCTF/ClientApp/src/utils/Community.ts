// Labs, profiles, the ranking and certificates: the rest of the CyberRange service's API.
import {
  AnswerResult,
  Category,
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

export interface LabSummary {
  slug: string
  title: string
  summary: string
  category: Category
  difficulty: Difficulty
  minutes: number
  icon: string | null
  xp: number
  // a machine to attack, or a challenge with files or a puzzle
  kind: 'machine' | 'challenge'
  tasks: number
  solved: number
  status: ModuleStatus
  solvers: number
  updated: string | null
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
  tasks: Question[]
}

export const useLabs = () => useRange<LabSummary[]>(`${RANGE_API}/labs`)
export const useLab = (lab?: string) => useRange<Lab>(lab ? `${RANGE_API}/labs/${lab}` : null)

export const labsApi = {
  answer: (lab: string, task: string, answer: string) =>
    rangeCall<AnswerResult>('POST', `${RANGE_API}/labs/${lab}/tasks/${task}`, { answer }),
  startMachine: (lab: string) => rangeCall<MachineInfo>('POST', `${RANGE_API}/labs/${lab}/machine`),
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
  kind: 'module' | 'path'
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
    kind: 'machine' | 'challenge'
    solvedAt: string
  }[]
  categories: { category: Category; xp: number; total: number }[]
}

export const useProfile = (name?: string) =>
  useRange<Profile>(name ? `${RANGE_API}/profiles/${encodeURIComponent(name)}` : null)

export const profileApi = {
  update: (changes: { bio?: string; country?: string | null; links?: ProfileLinks }) =>
    rangeCall<Profile>('PUT', `${RANGE_API}/me/profile`, changes),
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

// What each badge looks like: its icon, and the two colours of its medal.
export const BadgeLook: Record<string, { icon: UiconName; colours: [string, string] }> = {
  'first-answer': { icon: 'seedling', colours: ['#6fdc8c', '#1f8a4c'] },
  'first-flag': { icon: 'flag-alt', colours: ['#5fb0f5', '#0864af'] },
  'first-module': { icon: 'book-open-cover', colours: ['#5fb0f5', '#0864af'] },
  'first-path': { icon: 'route', colours: ['#b497ff', '#5a3fd0'] },
  'first-lab': { icon: 'flask', colours: ['#45dccf', '#0c8a99'] },
  'five-labs': { icon: 'rocket', colours: ['#45dccf', '#0c8a99'] },
  web: { icon: 'globe', colours: ['#5fb0f5', '#0864af'] },
  crypto: { icon: 'key', colours: ['#ffcc66', '#d7811a'] },
  forensics: { icon: 'fingerprint', colours: ['#b497ff', '#5a3fd0'] },
  osint: { icon: 'eye', colours: ['#6fdc8c', '#1f8a4c'] },
  'all-rounder': { icon: 'puzzle-alt', colours: ['#ff9166', '#d02f6b'] },
  streak: { icon: 'flame', colours: ['#ffb057', '#e0531f'] },
  hacker: { icon: 'incognito', colours: ['#5fb0f5', '#0864af'] },
  'pro-hacker': { icon: 'bolt', colours: ['#45dccf', '#0c8a99'] },
  'elite-hacker': { icon: 'crown', colours: ['#b497ff', '#5a3fd0'] },
  guru: { icon: 'hat-wizard', colours: ['#ffcc66', '#d7811a'] },
  omniscient: { icon: 'infinity', colours: ['#ff9166', '#d02f6b'] },
  'hall-of-fame': { icon: 'trophy', colours: ['#ffcc66', '#d7811a'] },
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

export interface CertificateDetail extends Certificate {
  // the name on the certificate, and the user name behind it
  name: string
  userName: string
  category: Category | null
  difficulty: Difficulty | null
  minutes: number | null
  modules: string[] | null
}

export const useCertificate = (id?: string) =>
  useRange<CertificateDetail>(id ? `${RANGE_API}/certificates/${id}` : null)

export const certificateUrl = (id: string) => `/certificates/${id}`

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
