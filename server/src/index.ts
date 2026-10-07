import { createServer } from 'http'
import { createApp } from './app.js'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'
import { ensureSettings } from './models/Setting.js'
import { initIO } from './sockets/io.js'

const app = createApp()
const server = createServer(app)
initIO(server)

async function shutdown(signal: string) {
  console.info(`${signal} received, closing server`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

await connectDB()
await ensureSettings()
server.listen(env.PORT, '0.0.0.0', () => {
  console.info(`Apex Motors API listening on port ${env.PORT}`)
})
