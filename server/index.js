import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'slots.json')
const PORT = Number(process.env.PORT || 8787)
const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

async function readRecords() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')) }
  catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}
async function writeRecords(records) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const temp = `${DATA_FILE}.tmp`
  await fs.writeFile(temp, JSON.stringify(records, null, 2))
  await fs.rename(temp, DATA_FILE)
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'clashwise-sync', time: new Date().toISOString() }))

app.get('/api/slots', async (_req, res, next) => {
  try { res.json((await readRecords()).filter(record => !record.deleted)) }
  catch (error) { next(error) }
})

app.post('/api/sync', async (req, res, next) => {
  try {
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : []
    let records = await readRecords()
    const byId = new Map(records.map(record => [record.id, record]))
    let accepted = 0
    for (const incoming of changes) {
      if (!incoming || typeof incoming.id !== 'string' || typeof incoming.updatedAt !== 'string') continue
      const current = byId.get(incoming.id)
      // Deterministic last-write-wins by ISO timestamp; equal timestamps favor existing server data.
      if (!current || incoming.updatedAt > current.updatedAt) {
        byId.set(incoming.id, incoming)
        accepted++
      }
    }
    records = [...byId.values()]
    await writeRecords(records)
    res.json({
      records,
      accepted,
      serverTime: new Date().toISOString(),
      policy: 'last-write-wins-by-updatedAt'
    })
  } catch (error) { next(error) }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Internal sync error' })
})

app.listen(PORT, () => console.log(`Clashwise sync API listening on http://localhost:${PORT}`))
