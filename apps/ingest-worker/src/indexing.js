import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { getTypeFromPath } from './utils/filetype.js'
import { fromPdf } from './loaders/fromPdf.js'
import { fromCsv } from './loaders/fromCsv.js'
import { fromJson } from './loaders/fromJson.js'
import { fromText } from './loaders/fromText.js'
import { fromUrl } from './loaders/fromUrl.js'
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
 * Expect structures like:
 *   <courseId>/<sectionDir>/<lessonOrder>-<lessonSlug>.<lang>.<ext>
 * Example:
 *   nodejs/01-Basic Node js/02-node-vs-browser.en.vtt
 */
function inferCourseMeta(filePath, displayName) {
  const absOrRel = filePath // may be relative from browser
  const dir = path.dirname(absOrRel)
  const base = displayName || path.basename(absOrRel)

  const segments = dir.split(path.sep).filter(Boolean)
  const sectionDir = segments.at(-1) || ''
  const courseIdRaw = segments.at(-2) || segments.at(-1) || 'course'
  const courseId = slugify(courseIdRaw)

  // filename: 02-node-vs-browser.en.vtt → order=02, slug=node-vs-browser, lang=en
  const m = /^(\d{1,3})-([^.]+?)(?:\.([a-z]{2}))?\.[^.]+$/i.exec(base)
  const lessonOrder = m ? Number(m[1]) : undefined
  const lessonSlug = m ? slugify(m[2]) : slugify(base.replace(/\.[^.]+$/, ''))
  const language = m && m[3] ? m[3].toLowerCase() : undefined

  // section: "01-Basic Node js" → order=01, name="Basic Node js"
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
  // Double-safety: skip hidden/system files if they reach here
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

  // Prefer browser-provided relative path for course/section inference
  const metaPathForInference = originalRelPath || filePath
  const courseMeta = inferCourseMeta(metaPathForInference, displayName)

  // Handle empty/malformed parses without crashing
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

export async function indexText(text, docId) {
  const rawDocs = await fromText(text, true)
  const tagged = attachMeta(rawDocs, { docId, kind: 'text', sourceName: 'inline' })
  const chunks = await splitter.splitDocuments(tagged)
  await addDocuments(chunks)
  return { type: 'text', chunksIndexed: chunks.length, docId }
}

export async function indexUrl(url, docId) {
  const rawDocs = await fromUrl(url, docId)
  console.log(`[index] Loaded ${rawDocs.length} from URL (${url})`)
  const tagged = attachMeta(rawDocs, { docId, kind: 'url', sourceName: url, course_id: 'web' })
  const chunks = await splitter.splitDocuments(tagged)
  console.log(`[index] Split → ${chunks.length} chunks`)
  await addDocuments(chunks)
  return { type: 'url', chunksIndexed: chunks.length, docId }
}