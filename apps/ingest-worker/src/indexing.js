// apps/ingest-worker/src/indexing.js
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { getTypeFromPath } from './utils/filetype.js'
import { fromPdf } from './loaders/fromPdf.js'
import { fromCsv } from './loaders/fromCsv.js'
import { fromJson } from './loaders/fromJson.js'
import { fromText } from './loaders/fromText.js'
import { fromUrl, crawlSite } from './loaders/fromUrl.js'
import { fromSrt } from './loaders/fromSrt.js'
import { fromVtt } from './loaders/fromVtt.js'
import { addDocuments } from './services/vectorstore.js'
import { Document } from '@langchain/core/documents'
import path from 'node:path'

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
})

function slugify(s = '') {
  return String(s)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

/**
 * Infer course/section/lesson metadata from path + filename.
 * Expect: <courseId>/<sectionDir>/<lessonOrder>-<lessonSlug>.<lang>.<ext>
 */
function inferCourseMeta(filePath, displayName) {
  const absOrRel = filePath
  const dir = path.dirname(absOrRel)
  const base = displayName || path.basename(absOrRel)

  const segments = dir.split(path.sep).filter(Boolean)
  const sectionDir = segments.at(-1) || ''
  const courseIdRaw = segments.at(-2) || segments.at(-1) || 'course'
  const courseId = slugify(courseIdRaw)

  const m = /^(\d{1,3})-([^.]+?)(?:\.([a-z]{2}))?\.[^.]+$/i.exec(base)
  const lessonOrder = m ? Number(m[1]) : undefined
  const lessonSlug = m ? slugify(m[2]) : slugify(base.replace(/\.[^.]+$/, ''))
  const language = m && m[3] ? m[3].toLowerCase() : undefined

  const sm = /^(\d{1,3})-?\s*(.+)$/i.exec(sectionDir)
  const sectionOrder = sm ? Number(sm[1]) : undefined
  const sectionName = sm ? sm[2].trim() : sectionDir
  const sectionId = slugify(sectionName || 'section')

  const lessonId = `${String(lessonOrder ?? '00').padStart(2, '0')}-${lessonSlug}`
  const videoId = `${courseId}/${sectionId}/${lessonId}`

  return {
    course_id: courseId,
    section_id: sectionId,
    section_name: sectionName || undefined,
    section_order: sectionOrder,
    lesson_id: lessonId,
    lesson_slug: lessonSlug,
    lesson_order: lessonOrder,
    language,
    video_id: videoId,
  }
}

function attachMeta(docs, extraMeta) {
  return docs.map(d =>
    new Document({
      pageContent: d.pageContent,
      metadata: { ...(d.metadata || {}), ...extraMeta },
    })
  )
}

export async function indexFile(filePath, explicitType, docId, displayName, originalRelPath /* optional */) {
  // Skip hidden/system files if they reach here
  const base = displayName || path.basename(filePath)
  const lowerBase = base.toLowerCase()
  if (base.startsWith('.') || lowerBase.includes('ds_store') || lowerBase === 'thumbs.db' || lowerBase === 'desktop.ini') {
    console.warn(`[index] Skipped hidden/system file (indexer): ${base}`)
    return { skipped: true, docId }
  }

  const type = explicitType || getTypeFromPath(displayName || filePath)
  if (!type) throw new Error(`Unsupported file type for: ${displayName || filePath}`)

  let rawDocs = []
  if (type === 'pdf')  rawDocs = await fromPdf(filePath)
  if (type === 'csv')  rawDocs = await fromCsv(filePath)
  if (type === 'json') rawDocs = await fromJson(filePath)
  if (type === 'txt')  rawDocs = await fromText(filePath)
  if (type === 'srt')  rawDocs = await fromSrt(filePath)
  if (type === 'vtt')  rawDocs = await fromVtt(filePath)

  const metaPathForInference = originalRelPath || filePath
  const courseMeta = inferCourseMeta(metaPathForInference, displayName)

  if (!rawDocs || rawDocs.length === 0) {
    console.warn(`[index] Parsed 0 cues from ${displayName} (${type}). Skipping embedding.`)
    return {
      type,
      chunksIndexed: 0,
      docId,
      course: courseMeta.course_id,
      note: 'No cues detected (empty or malformed); skipped.',
    }
  }

  const tagged = attachMeta(rawDocs, {
    docId,
    kind: 'file',
    sourceName: displayName || filePath,
    ...courseMeta,
  })

  console.log(`[index] Loaded ${tagged.length} from ${type.toUpperCase()} (${displayName || filePath})`)
  const chunks = await splitter.splitDocuments(tagged)
  console.log(`[index] Split → ${chunks.length} chunks`)

  if (!chunks || chunks.length === 0) {
    console.warn(`[index] No chunks after split for ${displayName}. Skipping embedding.`)
    return {
      type,
      chunksIndexed: 0,
      docId,
      course: courseMeta.course_id,
      note: 'No chunks after split; skipped.',
    }
  }

  await addDocuments(chunks)
  return { type, chunksIndexed: chunks.length, docId, course: courseMeta.course_id }
}

/** Inline text */
export async function indexText(text, docId) {
  const rawDocs = await fromText(text, true)
  const tagged = attachMeta(rawDocs, { docId, kind: 'text', sourceName: 'inline' })
  const chunks = await splitter.splitDocuments(tagged)
  await addDocuments(chunks)
  return { type: 'text', chunksIndexed: chunks.length, docId }
}

/** URL (single page or whole site crawl) */
export async function indexUrl(url, docId, opts = {}) {
  const u = new URL(url)
  const pathName = u.pathname || '/'

  const shouldCrawl =
    typeof opts.crawl === 'boolean' ? opts.crawl
    : (pathName === '/' || /\/$/.test(pathName)) // auto-crawl domain root or trailing slash
  
  const rawDocs = shouldCrawl
    ? await crawlSite(url, docId, {
        maxPages: opts.maxPages ?? 500,
        maxDepth: opts.maxDepth ?? 4,
        sameHostOnly: opts.sameHostOnly ?? true,
        samePathRoot: opts.samePathRoot ?? true,
        politenessMs: opts.politenessMs ?? 450,
      })
    : await fromUrl(url, docId)

  console.log(`[index] Loaded ${rawDocs.length} doc(s) from ${shouldCrawl ? 'crawl' : 'URL'} (${url})`)

  if (!rawDocs.length) {
    return { type: 'url', chunksIndexed: 0, docId, url, note: 'No documents extracted' }
  }

  const tagged = attachMeta(rawDocs, { docId, kind: 'url', sourceName: url, course_id: 'web' })
  const chunks = await splitter.splitDocuments(tagged)
  console.log(`[index] Split → ${chunks.length} chunks`)
  if (!chunks.length) {
    return { type: 'url', chunksIndexed: 0, docId, url, note: 'No chunks after split' }
  }

  await addDocuments(chunks)
  return { type: 'url', chunksIndexed: chunks.length, docId, url, crawled: shouldCrawl }
}