// apps/ingest-worker/src/services/vectorstore.js
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant'
import { embeddings } from './embedding.js'
import { qdrant, ensureCollection, COLLECTION } from './qdrant.js'

async function getStore() {
  await ensureCollection()
  return QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrant,
    collectionName: COLLECTION,
  })
}

// simple backoff
const wait = (ms) => new Promise(r => setTimeout(r, ms))

export async function addDocuments(docs) {
  await ensureCollection()
  const store = await getStore()

  const BATCH = Number(process.env.QDRANT_BATCH || 250)
  const MAX_RETRIES = 4

  let inserted = 0
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH)

    let attempt = 0
    // retry addDocuments (embedding+upsert) when OpenAI/Qdrant blip
    for (; attempt <= MAX_RETRIES; attempt++) {
      try {
        await store.addDocuments(slice)
        break
      } catch (err) {
        const isLast = attempt === MAX_RETRIES
        const backoff = 400 * Math.pow(2, attempt)
        console.warn(`[vectorstore] batch ${i} failed (attempt ${attempt + 1}): ${err?.message || err}`)
        if (isLast) throw err
        await wait(backoff)
      }
    }

    inserted += slice.length
    console.log(`[vectorstore] upserted ${inserted}/${docs.length}`)
  }
  console.log(`[vectorstore] added ${docs.length} chunks → ${COLLECTION}`)
}

export async function similaritySearchFiltered(
  query,
  { topK = Number(process.env.RAG_TOP_K || 5), minSimilarity = 0.75, oversample = Math.max(8, topK * 3), courseId } = {}
) {
  const store = await getStore()
  const filter = courseId && courseId !== 'all'
    ? { must: [{ key: 'metadata.course_id', match: { value: courseId } }] }
    : undefined

  const pairs = await store.similaritySearchWithScore(query, oversample, filter)
  const picked = []
  for (const [doc, distance] of pairs) {
    const sim = 1 - Math.min(Math.max(distance, 0), 1)
    if (sim >= minSimilarity) picked.push(doc)
    if (picked.length >= topK) break
  }
  if (picked.length === 0 && pairs.length) return pairs.slice(0, topK).map(([d]) => d)
  return picked
}

export async function deleteByDocId(docId) {
  await ensureCollection()
  const filter = { must: [{ key: 'metadata.docId', match: { value: docId } }] }
  const resp = await qdrant.delete(COLLECTION, { filter, wait: true })
  console.log(`[vectorstore] deleted metadata.docId=${docId} →`, resp?.status || 'ok')
  return { ok: true }
}