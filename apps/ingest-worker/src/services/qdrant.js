// apps/ingest-worker/src/services/qdrant.js
import { QdrantClient } from '@qdrant/js-client-rest'
import { EMBED_DIM } from './embedding.js'

export const COLLECTION = process.env.QDRANT_COLLECTION || 'chaicode-collection'

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,          // e.g. https://...cloud.qdrant.io:6333
  apiKey: process.env.QDRANT_API_KEY,   // undefined for local
})

export async function ensureCollection(dim = EMBED_DIM) {
  try {
    const { collections } = await qdrant.getCollections()
    if (collections?.some(c => c.name === COLLECTION)) return
  } catch { /* fallthrough */ }

  await qdrant.createCollection(COLLECTION, {
    vectors: { size: dim, distance: 'Cosine' },
  })
}