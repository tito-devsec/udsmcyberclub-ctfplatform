// Client for the CyberRange service (services/cyberrange), which the proxy serves under
// /api/range. It uses the same sign-in as the rest of the platform: the browser's GZCTF cookie.
import { CSSProperties, useCallback } from 'react'
import useSWR, { SWRConfiguration, useSWRConfig } from 'swr'
import { UiconName, uicons } from '@Utils/Uicons'
import { useUser } from '@Hooks/useUser'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type ModuleStatus = 'new' | 'started' | 'completed'
export type SectionStatus = 'completed' | 'available' | 'locked'
export type Role = 'student' | 'tutor' | 'admin' | 'superadmin'
export type SkillLevel = 'beginner' | 'intermediate' | 'expert'

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
export const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'expert']

export const CATEGORIES = [
  'general',
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
] as const
export type Category = (typeof CATEGORIES)[number]

export interface Link {
  slug: string
  title: string
}

export interface Standing {
  xp: number
  level: number
  levelStart: number
  nextLevel: number
  rank: string
  rankIndex: number
  nextRank: { name: string; xp: number } | null
}

export interface RangeUser extends Standing {
  id: string
  name: string
  role: Role
  skillLevel: SkillLevel | null
  enrolledPath: string | null
  weekXp: number
  // place in the all-time ranking, out of how many people
  position: number | null
  of: number
}

export interface ModuleSummary {
  slug: string
  title: string
  summary: string
  category: Category
  difficulty: Difficulty
  minutes: number
  xp: number
  icon: string | null
  sections: number
  done: number
  status: ModuleStatus
  machines: number
  paths?: Link[]
}

export interface PathSummary {
  slug: string
  title: string
  summary: string
  difficulty: Difficulty
  icon: string | null
  // the category more of its modules belong to than any other, if there is one
  category: Category | null
  minutes: number
  xp: number
  moduleCount: number
  completedModules: number
  sections: number
  done: number
  enrolled: boolean
}

export interface PathDetail extends PathSummary {
  description: string
  signedIn: boolean
  next: { module: string; section: string; title: string } | null
  modules: ModuleSummary[]
}

export interface SectionSummary {
  slug: string
  title: string
  status: SectionStatus
  solved: number
  total: number
  machine: boolean
  xp: number
}

export interface ModuleDetail extends ModuleSummary {
  description: string
  updated: string | null
  sequential: boolean
  signedIn: boolean
  paths: Link[]
  next: Link | null
  chapters: { title: string; sections: SectionSummary[] }[]
}

// which of a machine's flags answers a question: its flag, or a boot-to-root machine's user or root flag
export type FlagKind = 'flag' | 'user' | 'root'

export interface Question {
  id: string
  question: string
  format: string | null
  hint: string | null
  flag: boolean
  flagKind: FlagKind | null
  xp: number
  solved: boolean
}

export interface SectionDetail {
  slug: string
  title: string
  module: { slug: string; title: string; category: Category; icon: string | null; sections: number; done: number }
  chapter: string
  number: number
  of: number
  status: SectionStatus
  requires: Link | null
  previous: Link | null
  next: Link | null
  xp: number
  machine: { port: number } | null
  content: string | null
  questions: Question[]
}

// What an answer, or a section read to the end, earned.
export interface Outcome {
  xp: number
  sectionCompleted: boolean
  moduleCompleted: boolean
  next: Link | null
  standing: Standing | null
  levelUp: boolean
  rankUp: boolean
}

export interface AnswerResult extends Outcome {
  correct: boolean
}

export interface MachineInfo {
  module: string
  section: string
  title: string
  moduleTitle: string
  // the lab the machine belongs to, when it is not a module's
  lab: string | null
  entry: string
  startedAt: string
  expiresAt: string
  canExtend: boolean
}

export class RangeApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export const RANGE_API = '/api/range'
const BASE = RANGE_API

export async function rangeCall<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    // the service only accepts changes sent as JSON
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new RangeApiError(res.status, data?.title ?? res.statusText)
  return data as T
}

// Answers differ from one student to the next, so what is remembered is kept per student.
type Key = readonly [url: string, userId: string]
const fetcher = <T>([url]: Key) => rangeCall<T>('GET', url)

const still: SWRConfiguration = { refreshInterval: 0, revalidateOnFocus: false, shouldRetryOnError: false }

export function useRange<T>(url: string | null, config: SWRConfiguration = still) {
  const { user } = useUser()
  const key: Key | null = url ? [url, user?.userId ?? ''] : null
  return useSWR<T, RangeApiError>(key, fetcher, config)
}

// The signed-in student: role, skill level, XP, level and rank.
export function useMe() {
  const { user, error } = useUser()
  const signedIn = Boolean(user && !error)
  const me = useRange<RangeUser>(signedIn ? `${BASE}/me` : null)
  // `known` is false for the moment before the platform has said whether anyone is signed in
  return { ...me, signedIn, known: Boolean(user || error) }
}

export const usePaths = () => useRange<PathSummary[]>(`${BASE}/paths`)
export const usePath = (path?: string) => useRange<PathDetail>(path ? `${BASE}/paths/${path}` : null)
export const useModules = () => useRange<ModuleSummary[]>(`${BASE}/modules`)
export const useModule = (module?: string) => useRange<ModuleDetail>(module ? `${BASE}/modules/${module}` : null)
export const useSection = (module?: string, section?: string) =>
  useRange<SectionDetail>(module && section ? `${BASE}/modules/${module}/sections/${section}` : null)

export const useMachine = (signedIn: boolean) =>
  useRange<MachineInfo | null>(signedIn ? `${BASE}/machine` : null, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })

// Reads everything again after something changed (an answer, an enrolment), so that
// progress and XP are right on every page.
export function useRangeRefresh() {
  const { mutate } = useSWRConfig()
  return useCallback(
    () => mutate((key) => Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith(`${BASE}/`)),
    [mutate]
  )
}

const sectionApi = (module: string, section: string) => `${BASE}/modules/${module}/sections/${section}`

export const rangeApi = {
  updateMe: (changes: { skillLevel?: SkillLevel; enrolledPath?: string | null }) =>
    rangeCall<RangeUser>('PUT', `${BASE}/me`, changes),
  answer: (module: string, section: string, question: string, answer: string) =>
    rangeCall<AnswerResult>('POST', `${sectionApi(module, section)}/questions/${question}`, { answer }),
  complete: (module: string, section: string) => rangeCall<Outcome>('POST', `${sectionApi(module, section)}/complete`),
  startMachine: (module: string, section: string) =>
    rangeCall<MachineInfo>('POST', `${sectionApi(module, section)}/machine`),
  extendMachine: () => rangeCall<MachineInfo>('POST', `${BASE}/machine/extend`),
  stopMachine: () => rangeCall<null>('DELETE', `${BASE}/machine`),
}

export const pathUrl = (path: string) => `/paths/${path}`
export const moduleUrl = (module: string) => `/modules/${module}`
export const sectionUrl = (module: string, section: string) => `/modules/${module}/${section}`

// Each category's flat colour and a deeper shade of it, the same as on the club's category logos.
// The general category takes the club's blue.
export const CategoryColour: Record<Category, [string, string]> = {
  general: ['#0864af', '#064579'],
  web: ['#3b82f6', '#1d4ed8'],
  crypto: ['#eab308', '#a16207'],
  forensics: ['#14b8a6', '#0f766e'],
  osint: ['#8b5cf6', '#6d28d9'],
  reverse: ['#f97316', '#c2410c'],
  pwn: ['#ef4444', '#b91c1c'],
  stego: ['#ec4899', '#be185d'],
  misc: ['#94a3b8', '#475569'],
  hardware: ['#22c55e', '#15803d'],
  ics: ['#84cc16', '#4d7c0f'],
  ai: ['#0ea5e9', '#0369a1'],
  web3: ['#d946ef', '#a21caf'],
}

// The colours of a cover, an emblem or a lab's banner, as the CSS variables --cat and --cat-deep.
export const categoryStyle = (category?: Category | null): CSSProperties => {
  const [colour, deep] = CategoryColour[category ?? 'general']
  return { '--cat': colour, '--cat-deep': deep } as CSSProperties
}

export const CategoryIcon: Record<Category, UiconName> = {
  general: 'book-open-cover',
  web: 'globe',
  crypto: 'key',
  forensics: 'fingerprint',
  osint: 'eye',
  reverse: 'binary',
  pwn: 'bug',
  stego: 'picture',
  misc: 'puzzle-alt',
  hardware: 'microchip',
  ics: 'industry-windows',
  ai: 'brain-circuit',
  web3: 'blockchain-3',
}

export const DifficultyIcon: Record<Difficulty, UiconName> = {
  easy: 'signal-alt-1',
  medium: 'signal-alt-2',
  hard: 'signal-alt',
}

export const SkillLevelIcon: Record<SkillLevel, UiconName> = {
  beginner: 'seedling',
  intermediate: 'stairs',
  expert: 'mountain',
}

// one for each rank, from Script Kiddie to Omniscient
export const RankIcons: UiconName[] = ['terminal', 'incognito', 'bolt', 'crown', 'hat-wizard', 'infinity']

// The cover art of a module or path: its own icon when there is one, otherwise its category's.
export const coverIcon = (icon: string | null, category?: Category): UiconName =>
  icon && icon in uicons ? (icon as UiconName) : category ? CategoryIcon[category] : 'route'

// 35 -> "35m", 60 -> "1h", 195 -> "3h 15m"
export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export const percentOf = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0)

// The skill level chosen while registering waits here until the student first signs in.
const PENDING_LEVEL = 'range-skill-level'

export function rememberSkillLevel(userName: string, level: SkillLevel) {
  try {
    localStorage.setItem(PENDING_LEVEL, JSON.stringify({ user: userName.toLowerCase(), level }))
  } catch {
    // no storage: the student is asked again after signing in
  }
}

export function pendingSkillLevel(userName: string): SkillLevel | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_LEVEL) ?? 'null') as { user?: string; level?: string } | null
    if (saved?.user !== userName.toLowerCase()) return null
    return SKILL_LEVELS.find((level) => level === saved.level) ?? null
  } catch {
    return null
  }
}

export function forgetPendingSkillLevel() {
  try {
    localStorage.removeItem(PENDING_LEVEL)
  } catch {
    // nothing to forget
  }
}
