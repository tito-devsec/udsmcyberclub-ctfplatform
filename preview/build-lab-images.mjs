// Builds the Docker images that the labs in ../content/labs use as machines, from the
// folders in examples/. The CyberRange only starts images that are already on this
// computer, so run this once after cloning, and again after adding a lab:
//
//   node build-lab-images.mjs           builds the images that are missing
//   node build-lab-images.mjs --all     builds every one again, after changing a machine
//
// A lab's image club/<name>:latest is built from examples/<name>.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const labs = join(here, '..', 'content', 'labs')
// images whose folder has another name
const FOLDERS = { 'club/staff-portal:latest': 'web-container' }
const all = process.argv.includes('--all')

const present = (image) => {
  try {
    execFileSync('docker', ['image', 'inspect', image], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const images = new Set()
for (const lab of readdirSync(labs)) {
  const file = join(labs, lab, 'lab.yml')
  if (!existsSync(file)) continue
  const image = /^\s+image:\s*["']?([^\s"']+)/m.exec(readFileSync(file, 'utf8'))?.[1]
  if (image) images.add(image)
}

let built = 0
const missing = []
for (const image of [...images].sort()) {
  const name = image.replace(/^club\//, '').replace(/:.*$/, '')
  const folder = join(here, 'examples', FOLDERS[image] ?? name)
  if (!existsSync(join(folder, 'Dockerfile'))) {
    missing.push(image)
    continue
  }
  if (!all && present(image)) continue
  console.log(`Building ${image} from examples/${FOLDERS[image] ?? name} ...`)
  execFileSync('docker', ['build', '-q', '-t', image, folder], { stdio: 'inherit' })
  built++
}

console.log(`${images.size} lab images, ${built} built now.`)
if (missing.length) console.log(`No folder in examples/ for: ${missing.join(', ')}`)
