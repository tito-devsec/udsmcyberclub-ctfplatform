// The studio: where tutors and admins write modules, labs and skill paths, and propose
// games. Another part of the CyberRange service's API.
import { Category, Difficulty, RANGE_API, rangeCall, useRange } from '@Utils/Range'

// ---- game proposals ----

export type ProposalStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

// the platform's own challenge categories
export const GAME_CATEGORIES = [
  'Misc',
  'Crypto',
  'Pwn',
  'Web',
  'Reverse',
  'Blockchain',
  'Forensics',
  'Hardware',
  'Mobile',
  'PPC',
  'AI',
  'Pentest',
  'OSINT',
]

export interface ProposedChallenge {
  title: string
  category: string
  // one flag for everyone, or a machine and a flag of their own for every player
  kind: 'static' | 'container'
  description: string
  points: number
  // wrong answers before the challenge locks for a player; 0 for no limit
  attempts: number
  hints: string[]
  flags: string[]
  image: string
  port: number
  flagTemplate: string
}

export interface ProposalData {
  title: string
  summary: string
  description: string
  start: string | null
  end: string | null
  type: 'individual' | 'team'
  teamSize: number
  challenges: ProposedChallenge[]
}

export interface ProposalSummary {
  id: string
  title: string
  status: ProposalStatus
  author: string
  mine: boolean
  challenges: number
  start: string | null
  end: string | null
  // the game on the platform, once approved
  gameId: number | null
  // what the superadmin said when sending it back
  note: string | null
  updatedAt: string
  submittedAt: string | null
}

export interface Proposal extends ProposalSummary {
  reviewer: string | null
  reviewedAt: string | null
  data: ProposalData
  // what still stands between this draft and a game that can go online
  problems: string[]
  canEdit: boolean
  canReview: boolean
}

export const newChallenge = (): ProposedChallenge => ({
  title: '',
  category: 'Misc',
  kind: 'static',
  description: '',
  points: 100,
  attempts: 5,
  hints: [],
  flags: [],
  image: '',
  port: 80,
  flagTemplate: 'udsm{change_these_words_[TEAM_HASH]}',
})

export const useProposals = (enabled: boolean) => useRange<ProposalSummary[]>(enabled ? `${RANGE_API}/proposals` : null)
export const useProposal = (id?: string) => useRange<Proposal>(id ? `${RANGE_API}/proposals/${id}` : null)

const proposal = (id: string) => `${RANGE_API}/proposals/${id}`

export const proposalsApi = {
  create: (data: Partial<ProposalData>) => rangeCall<Proposal>('POST', `${RANGE_API}/proposals`, data),
  save: (id: string, data: ProposalData) => rangeCall<Proposal>('PUT', proposal(id), data),
  submit: (id: string) => rangeCall<Proposal>('POST', `${proposal(id)}/submit`),
  withdraw: (id: string) => rangeCall<Proposal>('POST', `${proposal(id)}/withdraw`),
  approve: (id: string) => rangeCall<Proposal>('POST', `${proposal(id)}/approve`),
  reject: (id: string, note: string) => rangeCall<Proposal>('POST', `${proposal(id)}/reject`, { note }),
  remove: (id: string) => rangeCall<null>('DELETE', proposal(id)),
}

// ---- modules, labs and skill paths ----

export type DocumentKind = 'module' | 'lab' | 'path'
// draft: never published. published: students see exactly this. changed: they see an older version.
export type DocumentStatus = 'draft' | 'published' | 'changed'

export interface MachineDraft {
  image: string
  port: number
  flag?: string
}

export interface QuestionDraft {
  // given by the service when the question is first saved
  id?: string
  question: string
  // answered with the flag of the machine, or with one of `answer`
  flag?: boolean
  answer?: string[]
  format?: string
  hint?: string
  xp: number
  caseSensitive?: boolean
}

export interface SectionDraft {
  // given by the service when the section is first saved; it is the section's address
  slug?: string
  title: string
  content: string
  xp: number
  machine?: MachineDraft
  questions?: QuestionDraft[]
}

export interface ModuleDraft {
  title: string
  summary: string
  description: string
  category: Category
  difficulty: Difficulty
  minutes: number
  icon?: string
  sequential: boolean
  chapters: { title: string; sections: SectionDraft[] }[]
}

export interface LabDraft {
  title: string
  summary: string
  scenario: string
  category: Category
  difficulty: Difficulty
  minutes: number
  icon?: string
  bonus: number
  machine?: MachineDraft
  tasks?: QuestionDraft[]
}

export interface PathDraft {
  title: string
  summary: string
  description: string
  difficulty: Difficulty
  icon?: string
  modules: string[]
}

export interface DocumentSummary {
  id: string
  kind: DocumentKind
  slug: string
  title: string
  status: DocumentStatus
  author: string
  mine: boolean
  // where it is on the site, once published
  address: string | null
  updatedAt: string
  publishedAt: string | null
}

export interface StudioDocument<T = ModuleDraft | LabDraft | PathDraft> extends DocumentSummary {
  data: T
  files: { name: string; size: number }[]
  // why it cannot be published yet, if it cannot
  problem: string | null
}

export const useDocuments = (enabled: boolean) =>
  useRange<DocumentSummary[]>(enabled ? `${RANGE_API}/studio/documents` : null)
export const useDocument = (id?: string) => useRange<StudioDocument>(id ? `${RANGE_API}/studio/documents/${id}` : null)
// the Docker images on the server that may be used as machines
export const useMachineImages = (enabled: boolean) => useRange<string[]>(enabled ? `${RANGE_API}/studio/images` : null)

const document = (id: string) => `${RANGE_API}/studio/documents/${id}`

export const documentsApi = {
  create: (kind: DocumentKind, title: string) =>
    rangeCall<StudioDocument>('POST', `${RANGE_API}/studio/documents`, { kind, title }),
  save: (id: string, data: unknown) => rangeCall<StudioDocument>('PUT', document(id), data),
  publish: (id: string) => rangeCall<StudioDocument>('POST', `${document(id)}/publish`),
  unpublish: (id: string) => rangeCall<StudioDocument>('POST', `${document(id)}/unpublish`),
  remove: (id: string) => rangeCall<null>('DELETE', document(id)),
  // `data` is the file's content in base64
  addFile: (id: string, name: string, data: string) =>
    rangeCall<StudioDocument>('PUT', `${document(id)}/files/${encodeURIComponent(name)}`, { data }),
  removeFile: (id: string, name: string) =>
    rangeCall<StudioDocument>('DELETE', `${document(id)}/files/${encodeURIComponent(name)}`),
}

export const studioUrl = {
  home: '/studio',
  proposal: (id: string) => `/studio/proposals/${id}`,
  document: (id: string) => `/studio/documents/${id}`,
}

// A file as a "data:" address, for sending as JSON. What follows its comma is base64.
export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'))
    reader.readAsDataURL(file)
  })
