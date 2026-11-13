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
  target: { title: string; port: number; expiresAt: string; lab: string | null } | null
  // the name in the terminal's prompt: udsmcyberrange@<player>
  player: string
  // where CyberChef is served, when the server has it
  cyberchef: string | null
  // the largest file sent into or fetched from the box, in MB
  fileLimit: number
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
  upload: (name: string, data: string) => rangeCall<BoxFile[]>('PUT', `${BASE}/file`, { name, data }),
  remove: (path: string) => rangeCall<BoxFile[]>('DELETE', `${BASE}/file?path=${encodeURIComponent(path)}`),
}

// The address that downloads a file from the box.
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
