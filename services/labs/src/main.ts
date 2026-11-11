import { createServer } from 'node:http'
import { config } from './config.js'
import { loadContent } from './content.js'
import { openDatabase } from './db.js'
import { handle } from './http.js'
import { reap } from './machines.js'
import { setContent } from './routes.js'

// Bad lab files stop the service here, with a message saying what is wrong.
const content = loadContent(config.contentDir)
setContent(content)
const labCount = content.paths.reduce((sum, path) => sum + path.labs.length, 0)
console.log(`labs: loaded ${content.paths.length} paths with ${labCount} labs from ${config.contentDir}`)

await openDatabase()

const server = createServer((req, res) => void handle(req, res))
server.listen(config.port, () => console.log(`labs: listening on port ${config.port}`))

// expired machines are removed every 30 seconds
const reaper = setInterval(() => {
  reap().catch((error) => console.error('labs: removing expired machines failed:', error))
}, 30_000)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    clearInterval(reaper)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
