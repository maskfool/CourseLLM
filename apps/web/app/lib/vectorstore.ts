// app/lib/vectorstore.ts
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant'
import { embeddings } from './embedding'
import { qdrant, ensureCollection } from './qdrant'

const COLLECTION = process.env.QDRANT_COLLECTION || 'chaicode-collection'

async function getVectorStore() {
  await ensureCollection()
  return QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrant,
    collectionName: COLLECTION,
  })
}

export async function addDocuments(docs: any[]) {
  await ensureCollection()
  await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client: qdrant,
    collectionName: COLLECTION,
  })
  console.log(`[vectorstore] added ${docs.length} chunks → ${COLLECTION}`)
}

/**
 * similaritySearchFiltered with optional courseId narrowing.
 * We oversample, then filter by similarity + (optional) course id.
 */
export async function similaritySearchFiltered(
  query: string,
  opts: {
    topK?: number
    minSimilarity?: number
    oversample?: number
    courseId?: string   // 'all' or specific course_id
  } = {}
) {
  const {
    topK = Number(process.env.RAG_TOP_K || 5),
    minSimilarity = 0.75,
    oversample = Math.max(8, topK * 3),
    courseId,
  } = opts

  await ensureCollection()
  const store = await getVectorStore()
  const pairs = await store.similaritySearchWithScore(query, oversample)

  const filtered: any[] = []
  for (const [doc, distance] of pairs) {
    const sim = 1 - Math.min(Math.max(distance, 0), 1)
    if (sim < minSimilarity) continue
    if (courseId && courseId !== 'all') {
      const meta: any = doc.metadata || {}
      if ((meta.course_id || meta.courseId) !== courseId) continue
    }
    filtered.push(doc)
    if (filtered.length >= topK) break
  }

  // if nothing passed the thresholds, fallback to topK (still honoring courseId if present)
  if (filtered.length === 0 && pairs.length) {
    const fallback: any[] = []
    for (const [doc] of pairs) {
      if (courseId && courseId !== 'all') {
        const meta: any = doc.metadata || {}
        if ((meta.course_id || meta.courseId) !== courseId) continue
      }
      fallback.push(doc)
      if (fallback.length >= topK) break
    }
    return fallback.length ? fallback : pairs.slice(0, topK).map(([d]) => d)
  }

  return filtered
}

/** Delete all chunks for a given docId */
export async function deleteByDocId(docId: string) {
  await ensureCollection()
  const filter = { must: [{ key: 'metadata.docId', match: { value: docId } }] }
  const resp = await qdrant.delete(COLLECTION, { filter, wait: true })
  console.log(`[vectorstore] deleted payload metadata.docId=${docId} →`, resp?.status || 'ok')
  return { ok: true }
}