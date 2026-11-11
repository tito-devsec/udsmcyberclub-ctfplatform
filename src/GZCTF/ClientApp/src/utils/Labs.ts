// Client for the Labs service (services/labs), which the proxy serves under /api/labs.
// It uses the same sign-in as the rest of the platform: the browser's GZCTF cookie.
import useSWR, { SWRConfiguration } from 'swr'

export type LabStatus = 'completed' | 'available' | 'locked'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface LabLink {
  slug: string
  title: string
}

export interface PathSummary {
  slug: string
  title: string
  summary: string
  level: string
  modules: number
  labs: number
  minutes: number
  completedLabs: number
}

export interface LabSummary {
  slug: string
  title: string
  summary: string
  difficulty: Difficulty
  minutes: number
  machine: boolean
  status: LabStatus
  solved: number
  total: number
  requires: LabLink | null
}

export interface PathDetail {
  slug: string
  title: string
  summary: string
  description: string
  level: string
  sequential: boolean
  signedIn: boolean
  labs: number
  minutes: number
  completedLabs: number
  next: LabLink | null
  modules: { title: string; summary: string; labs: LabSummary[] }[]
}

export interface LabQuestion {
  id: string
  question: string
  format: string | null
  hint: string | null
  flag: boolean
  solved: boolean
}

export interface LabDetail {
  slug: string
  title: string
  summary: string
  difficulty: Difficulty
  minutes: number
  path: LabLink
  module: string
  status: LabStatus
  solved: number
  total: number
  requires: LabLink | null
  previous: LabLink | null
  next: LabLink | null
  machine: { port: number } | null
  tasks: { title: string; content: string; questions: LabQuestion[] }[]
}

export interface MachineInfo {
  path: string
  lab: string
  title: string
  entry: string
  startedAt: string
  expiresAt: string
  canExtend: boolean
}

export interface AnswerResult {
  correct: boolean
  solved: number
  total: number
  labCompleted: boolean
  next: LabLink | null
}

export class LabsError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

const BASE = '/api/labs'

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    // the service only accepts changes sent as JSON
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new LabsError(res.status, data?.title ?? res.statusText)
  return data as T
}

const fetcher = <T>(url: string) => call<T>('GET', url)

const content: SWRConfiguration = { refreshInterval: 0, revalidateOnFocus: false, shouldRetryOnError: false }

export const usePaths = () => useSWR<PathSummary[], LabsError>(`${BASE}/paths`, fetcher, content)

export const usePath = (path?: string) =>
  useSWR<PathDetail, LabsError>(path ? `${BASE}/paths/${path}` : null, fetcher, content)

export const useLab = (path?: string, lab?: string) =>
  useSWR<LabDetail, LabsError>(path && lab ? `${BASE}/paths/${path}/labs/${lab}` : null, fetcher, content)

export const useMachine = (signedIn: boolean) =>
  useSWR<MachineInfo | null, LabsError>(signedIn ? `${BASE}/machine` : null, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })

export const labsApi = {
  answer: (path: string, lab: string, question: string, answer: string) =>
    call<AnswerResult>('POST', `${BASE}/paths/${path}/labs/${lab}/questions/${question}`, { answer }),
  startMachine: (path: string, lab: string) => call<MachineInfo>('POST', `${BASE}/paths/${path}/labs/${lab}/machine`),
  extendMachine: () => call<MachineInfo>('POST', `${BASE}/machine/extend`),
  stopMachine: () => call<null>('DELETE', `${BASE}/machine`),
}

export const pathUrl = (path: string) => `/labs/${path}`
export const labUrl = (path: string, lab: string) => `/labs/${path}/${lab}`

export const DifficultyColor: Record<Difficulty, string> = { easy: 'teal', medium: 'yellow', hard: 'red' }
