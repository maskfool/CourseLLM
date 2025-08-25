// apps/ingest-worker/src/loaders/fromVtt.js
import fs from 'node:fs/promises'
import { Document } from '@langchain/core/documents'

function tsToSec(ts) {
  // 00:00:11.680 or 00:00:11,680
  const m = /^(\d{2}):(\d{2}):(\d{2})([.,](\d{1,3}))?$/.exec(ts.trim())
  if (!m) return undefined
  const h = Number(m[1]), mi = Number(m[2]), s = Number(m[3])
  const ms = m[5] ? Number(m[5].padEnd(3, '0')) : 0
  return h * 3600 + mi * 60 + s + ms / 1000
}

export async function fromVtt(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)

  const docs = []
  let i = 0

  // header
  if ((lines[i] || '').toUpperCase().startsWith('WEBVTT')) {
    i++
    while (i < lines.length && lines[i].trim() !== '') i++
    i++ // past blank
  }

  // skip NOTE / STYLE / REGION blocks
  const isControl = (ln) => /^(NOTE|STYLE|REGION)\b/i.test(ln || '')

  while (i < lines.length) {
    // skip control blocks entirely
    if (isControl(lines[i])) {
      while (i < lines.length && lines[i].trim() !== '') i++
      i++
      continue
    }

    // optional numeric cue id
    if (/^\d+$/.test((lines[i] || '').trim())) i++

    const timeLine = lines[i] || ''
    const tm = /(\d{2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{1,3})/i.exec(timeLine)
    if (!tm) { i++; continue }

    const start = tsToSec(tm[1])
    const end   = tsToSec(tm[2])
    i++

    const buff = []
    while (i < lines.length && lines[i].trim() !== '') {
      // ignore stray NOTE lines inside cue text
      if (!/^NOTE\b/i.test(lines[i])) buff.push(lines[i])
      i++
    }
    i++ // skip blank

    const text = buff.join('\n').trim()
    if (!text) continue

    docs.push(new Document({
      pageContent: text,
      metadata: { source: filePath, start, end, type: 'vtt' }
    }))
  }
  return docs
}