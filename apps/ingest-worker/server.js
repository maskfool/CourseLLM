// apps/ingest-worker/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

import { indexFile, indexText, indexUrl } from './src/indexing.js'
import { getTypeFromPath } from './src/utils/filetype.js'
import { deleteByDocId /*, countByDocId */ } from './src/services/vectorstore.js'

const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*' }))
app.use(express.json({ limit: '8mb' })) // ↑ more headroom

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, 'uploads')

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 1,
    fields: 10,
  },
}).single('file')

const newDocId = (p='doc') => `${p}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/ingest/file', (req, res) => {
  upload(req, res, async (err) => {
    try {
      if (err) throw err
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file provided' })
      }

      const original = req.file.originalname || ''
      const base = path.basename(original)
      const lowerBase = base.toLowerCase()

      // Skip hidden/system junk early with 409
      const isHiddenOrJunk =
        base.startsWith('.') ||
        lowerBase === 'thumbs.db' ||
        lowerBase === 'desktop.ini' ||
        lowerBase === '.ds_store' ||
        lowerBase.includes('ds_store')

      if (isHiddenOrJunk) {
        console.warn(`[ingest] Skipped hidden/system file: ${base}`)
        return res.status(409).json({ success: false, error: 'Skipped hidden/system file', file: base })
      }

      // Normalize extension (e.g. .VTT → .vtt) for type detection
      const displayName = base.replace(/\.[^.]+$/, (ext) => ext.toLowerCase())
      const explicitType = getTypeFromPath(displayName)
      if (!explicitType) {
        return res.status(415).json({ success: false, error: `Unsupported file type for: ${displayName}` })
      }

      const docId = newDocId('file')

      // Pick up browser-provided relative path (for folder uploads)
      const relpath =
        (req.body && (req.body.relpath || req.body.relativePath)) ||
        (req.file && (req.file.relativePath || req.file.webkitRelativePath)) ||
        undefined

      const result = await indexFile(
        req.file.path,
        explicitType,
        docId,
        displayName,
        relpath // for course/section inference
      )

      res.json({ success: true, docId, result })
    } catch (e) {
      console.error('[ingest] file upload failed:', e)
      res.status(500).json({ success: false, error: e?.message || 'Internal Server Error' })
    }
  })
})

app.post('/api/ingest/text', async (req, res) => {
  try {
    const { text } = req.body || {}
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text required' })
    }
    const docId = newDocId('text')
    const result = await indexText(text, docId)
    res.json({ success: true, docId, result })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: e?.message || 'Internal Server Error' })
  }
})

app.post('/api/ingest/url', async (req, res) => {
  try {
    const { url } = req.body || {}
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'url required' })
    }

    const docId = newDocId('url')
    console.log(`[index] Crawling URL → ${url} (docId=${docId})`)
    const result = await indexUrl(url, docId)

    res.json({ success: true, docId, result })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: e?.message || 'Internal Server Error' })
  }
})

app.delete('/api/docs/:docId', async (req, res) => {
  try {
    const { docId } = req.params
    if (!docId) return res.status(400).json({ success: false, error: 'docId required' })
    await deleteByDocId(docId)
    res.json({ success: true, docId })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: e?.message || 'Internal Server Error' })
  }
})

const PORT = process.env.PORT || 5001
const server = app.listen(PORT, () => {
  console.log(`🚀 Ingest worker running on :${PORT}`)
})

// Tune HTTP timeouts (stability behind Render proxy)
server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000
server.requestTimeout = 0