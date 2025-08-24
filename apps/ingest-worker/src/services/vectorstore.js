import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant'
import { embeddings } from './embedding.js'
import { qdrant, ensureCollection } from './qdrant.js'

const COLLECTION = process.env.QDRANT_COLLECTION || 'chaicode-collection'

// make a single store instance for reuse
async function getStore() {
  await ensureCollection()
  return QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrant,
    collectionName: COLLECTION,
  })
}

// ---------- UPDATED: batched upserts ----------
export async function addDocuments(docs) {
  await ensureCollection()
  const store = await getStore()

  // conservative batch size: ~250–400 points per request keeps payload << 32MB
  const BATCH = Number(process.env.QDRANT_BATCH || 300)

  let inserted = 0
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH)
    await store.addDocuments(slice)     // embeds (batched per embedding settings) + upserts
    inserted += slice.length
    console.log(`[vectorstore] upserted batch ${i}-${i + slice.length - 1} (${inserted}/${docs.length})`)
  }
  console.log(`[vectorstore] added ${docs.length} chunks → ${COLLECTION}`)
}

export async function similaritySearchFiltered(
  query,
  { topK = Number(process.env.RAG_TOP_K || 5), minSimilarity = 0.75, oversample = Math.max(8, topK * 3) } = {}
) {
  const store = await getStore()
  const pairs = await store.similaritySearchWithScore(query, oversample)
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