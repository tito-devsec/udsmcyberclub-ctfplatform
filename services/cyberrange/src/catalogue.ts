// The Docker images staff may choose as machines: those already on the server whose name
// matches MACHINE_IMAGES (the club's own, "club/...", unless set otherwise). Nothing is ever
// pulled from the internet for a lesson, a lab or a proposed game.

import { config } from './config.js'
import { docker } from './docker.js'

const allowed = (tag: string) =>
  config.machineImages.some((pattern) =>
    pattern.endsWith('*') ? tag.startsWith(pattern.slice(0, -1)) : tag === pattern || tag === `${pattern}:latest`
  )

export async function machineImages(): Promise<string[]> {
  try {
    const { status, data } = await docker<{ RepoTags?: string[] | null }[]>('GET', '/images/json')
    if (status !== 200 || !Array.isArray(data)) return []
    return [...new Set(data.flatMap((image) => image.RepoTags ?? []).filter(allowed))].sort()
  } catch {
    return []
  }
}
