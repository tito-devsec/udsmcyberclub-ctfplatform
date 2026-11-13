// The attack box: a Kali Linux container of the student's own, opened in the browser as a
// desktop with a terminal, the box's files, CyberChef and a picture viewer for hidden data.
import { RANGE_API, rangeCall, useRange } from '@Utils/Range'

const BASE = `${RANGE_API}/box`

export const ATTACK_BOX_URL = '/attackbox'
// the browser tab the attack box opens in, so that opening it again comes back to it
export const ATTACK_BOX_TAB = 'udsm-attack-box'

export interface BoxInfo {
  startedAt: string
  expiresAt: string
  canExtend: boolean
}

export interface BoxView {
  box: BoxInfo | null
  // the lab machine the box reaches as "target", while one runs
  target: { title: string; port: number; expiresAt: string; lab: string | null; entry: string } | null
  // the name in the terminal's prompt: udsmcyberrange@<player>
  player: string
  // where CyberChef is served, when the server has it
  cyberchef: string | null
  // the largest file sent into or fetched from the box, in MB
  fileLimit: number
}

// the home folder in the box: the student is root there
export const BOX_HOME = '/root'

export interface BoxEntry {
  name: string
  type: 'folder' | 'file' | 'link'
  size: number
  changedAt: string
  executable: boolean
}

// One folder of the box, for the Files window.
export interface BoxFolder {
  path: string
  parent: string | null
  entries: BoxEntry[]
  // room left on the box's disk, in bytes
  free: number | null
}

export interface BoxFile {
  // under the box's home folder, ~
  path: string
  size: number
  changedAt: string
}

export const useBox = () => useRange<BoxView>(BASE, { refreshInterval: 30_000, revalidateOnFocus: true })

export const boxApi = {
  start: () => rangeCall<BoxView>('POST', BASE),
  extend: () => rangeCall<BoxView>('POST', `${BASE}/extend`),
  stop: () => rangeCall<BoxView>('DELETE', BASE),
  files: () => rangeCall<BoxFile[]>('GET', `${BASE}/files`),
  folder: (path: string) => rangeCall<BoxFolder>('GET', `${BASE}/folder?path=${encodeURIComponent(path)}`),
  makeFolder: (folder: string, name: string) => rangeCall<BoxFolder>('POST', `${BASE}/folder`, { folder, name }),
  rename: (path: string, name: string) => rangeCall<BoxFolder>('POST', `${BASE}/rename`, { path, name }),
  upload: (folder: string, name: string, data: string) =>
    rangeCall<BoxFolder>('PUT', `${BASE}/file`, { folder, name, data }),
  remove: (path: string) => rangeCall<BoxFolder>('DELETE', `${BASE}/file?path=${encodeURIComponent(path)}`),
}

// "/root/Documents" + "notes.txt"
export const joinPath = (folder: string, name: string) => `${folder === '/' ? '' : folder}/${name}`

// The address that downloads a file from the box: an absolute path, or one under the home folder.
export const boxFileUrl = (path: string) => `${BASE}/file?path=${encodeURIComponent(path)}`

// The address of a terminal in the box, for a WebSocket.
export const terminalUrl = (cols: number, rows: number) =>
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${BASE}/terminal?cols=${cols}&rows=${rows}`

export const isPicture = (path: string) => /\.(png|jpe?g|gif|bmp|webp)$/i.test(path)

// 1536 -> "1.5 KB"
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// A file from the student's computer as base64, for sending to the box.
export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
