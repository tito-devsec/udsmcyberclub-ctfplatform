import { createServer } from 'node:http'
import { config } from './config.js'
import { loadContent } from './content.js'
import { reapBoxes, upgrade } from './boxes.js'
import { browserUpgrade, reapBrowsers } from './browsers.js'
import { openDatabase } from './db.js'
import { DockerUnavailable } from './docker.js'
import { handle } from './http.js'
import { reap } from './machines.js'
import { contentSize, setContent } from './state.js'
// the API's routes
import './routes.js'
import './community.js'
import './signing.js'
import './proposals.js'
import './games.js'
import { reloadContent } from './studio.js'

// Mistakes in the content files stop the service here, with a message saying what is wrong.
setContent(loadContent(config.contentDir))

await openDatabase()
// what staff published from the web interface joins the files
await reloadContent()
const { paths, modules, sections, labs } = contentSize()
console.log(`cyberrange: loaded ${paths} paths, ${modules} modules with ${sections} sections, and ${labs} labs`)

const server = createServer((req, res) => void handle(req, res))
// terminals in attack boxes, and the screens of the box's Firefox and Burp Suite, are WebSockets
server.on('upgrade', (req, socket, head) => {
  const path = new URL(req.url ?? '/', 'http://range').pathname
  if (path === '/api/range/box/browser/screen') browserUpgrade(req, socket, head)
  else if (path === '/api/range/box/burp/screen') browserUpgrade(req, socket, head, 'burp')
  else upgrade(req, socket, head)
})
server.listen(config.port, () => console.log(`cyberrange: listening on port ${config.port}`))

// expired machines and attack boxes are removed every 30 seconds
const reaper = setInterval(() => {
  reap()
    .then(reapBoxes)
    .then(reapBrowsers)
    .catch((error) =>
      console.error('cyberrange: removing expired machines failed:', error instanceof DockerUnavailable ? error.message : error)
    )
}, 30_000)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    clearInterval(reaper)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
