// apps/ingest-worker/src/loaders/fromUrl.js
import { Document } from '@langchain/core/documents'
import { request } from 'undici'
import * as cheerio from 'cheerio'

const MAX_BYTES = 8 * 1024 * 1024; // 8MB per response
const FETCH_TIMEOUT_MS = 20000;    // 20s
const ALLOWED_TYPES = [
  'text/html',
  'text/plain',
  'application/json',
  'application/pdf',
]

async function fetchWithTimeout(url, opts = {}) {
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    return await request(url, {
      maxRedirections: 3,
      headers: {
        'user-agent': 'DocChat-Ingest/1.0 (+https://example.app)',
        'accept': ALLOWED_TYPES.join(', ') + ', */*;q=0.2',
      },
      signal: ac.signal,
      ...opts,
    })
  } finally {
    clearTimeout(to)
  }
}

async function streamToLimitedBuffer(stream) {
  const chunks = []
  let size = 0
  for await (const chunk of stream) {
    size += chunk.length
    if (size > MAX_BYTES) throw new Error(`Remote content too large (> ${MAX_BYTES} bytes)`)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function htmlToText(html, baseUrl) {
  const $ = cheerio.load(html)
  
  $('script, style, noscript, iframe, nav, header, footer').remove()
  // Try to prefer main content if present
  const root = $('main').length ? $('main') : $('body')
  const text = root.text() || ''
  const title = ($('title').text() || '').trim()
  const cleaned = text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return { title, text: cleaned, baseUrl }
}

/** Fetch a single URL → [Document] */
export async function fromUrl(url, docId) {
  const res = await fetchWithTimeout(url)
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Fetch failed (${res.statusCode})`)
  }
  const ctype = String(res.headers['content-type'] || '').toLowerCase()
  const mime = ctype.split(';')[0].trim()

  if (!ALLOWED_TYPES.some(t => mime.startsWith(t))) {
    if (!mime.startsWith('text/')) {
      throw new Error(`Unsupported content-type: ${mime || 'unknown'}`)
    }
  }

  const buf = await streamToLimitedBuffer(res.body)

  if (mime.startsWith('text/html')) {
    const { title, text } = htmlToText(buf.toString('utf8'), url)
    const pageContent = [title && `# ${title}`, text].filter(Boolean).join('\n\n')
    return [
      new Document({
        pageContent,
        metadata: { source: url, docId, kind: 'url', contentType: mime },
      })
    ]
  }

  if (mime.startsWith('application/json')) {
    const json = JSON.parse(buf.toString('utf8'))
    return [
      new Document({
        pageContent: JSON.stringify(json, null, 2),
        metadata: { source: url, docId, kind: 'url', contentType: mime },
      })
    ]
  }

  if (mime.startsWith('text/plain')) {
    return [
      new Document({
        pageContent: buf.toString('utf8'),
        metadata: { source: url, docId, kind: 'url', contentType: mime },
      })
    ]
  }

  if (mime === 'application/pdf') {
    // Minimal fallback (upload PDFs as files for best results)
    return [
      new Document({
        pageContent: '[PDF detected] Please use the file upload for best results.',
        metadata: { source: url, docId, kind: 'url', contentType: mime },
      })
    ]
  }

  if (mime.startsWith('text/')) {
    return [
      new Document({
        pageContent: buf.toString('utf8'),
        metadata: { source: url, docId, kind: 'url', contentType: mime },
      })
    ]
  }

  throw new Error(`Unsupported content-type: ${mime}`)
}

/**
 * Crawl a site breadth-first with sensible limits.
 * opts: {
 *   maxPages=200, maxDepth=3, sameHostOnly=true, samePathRoot=true,
 *   politenessMs=400
 * }
 */
export async function crawlSite(startUrl, docId, opts = {}) {
  const {
    maxPages = 200,
    maxDepth = 3,
    sameHostOnly = true,
    samePathRoot = true,
    politenessMs = 400,
  } = opts

  const start = new URL(startUrl)
  const rootPath = start.pathname || '/'

  const seen = new Set()
  const queue = [{ url: start.href, depth: 0 }]
  const allDocs = []

  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  while (queue.length && allDocs.length < maxPages) {
    const { url, depth } = queue.shift()
    if (seen.has(url)) continue
    seen.add(url)

    try {
      const docs = await fromUrl(url, docId)
      allDocs.push(...docs)
    } catch (e) {
      // Soft-fail per page
      // console.warn(`[crawl] skip ${url}: ${e?.message || e}`)
    }

    if (depth >= maxDepth) continue

    // Only extract links from HTML docs we just fetched (best-effort fast parse)
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' })
      const ctype = String(res.headers['content-type'] || '').toLowerCase()
      if (!ctype.startsWith('text/html')) {
        continue
      }
      const html = (await streamToLimitedBuffer(res.body)).toString('utf8')
      const $ = cheerio.load(html)

      $('a[href]').each((_i, a) => {
        const href = ($(a).attr('href') || '').trim()
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return

        let next
        try { next = new URL(href, url) } catch { return }

        // Protocol guard
        if (!/^https?:$/.test(next.protocol)) return

        // Host/path constraints
        if (sameHostOnly && next.host !== start.host) return
        if (samePathRoot) {
          const baseRoot = rootPath.endsWith('/') ? rootPath : (rootPath + '/')
          if (!next.pathname.startsWith(baseRoot) && baseRoot !== '/' ) return
        }

        // Normalize: drop hash
        next.hash = ''

        if (!seen.has(next.href)) {
          queue.push({ url: next.href, depth: depth + 1 })
        }
      })
    } catch {
      /* ignore link extraction errors */
    }

    if (queue.length) await sleep(politenessMs)
  }

  return allDocs
}