import 'dotenv/config'
import { QdrantClient } from '@qdrant/js-client-rest'

const url = process.env.QDRANT_URL || 'http://localhost:6333'
const apiKey = process.env.QDRANT_API_KEY || undefined
export const qdrant = new QdrantClient({ url, apiKey,checkCompatibility: false, })

export async function ensureCollection() {
  const collectionName = process.env.QDRANT_COLLECTION || 'chaicode-collection'
  try {
    await qdrant.getCollections()
    await qdrant.getCollection(collectionName)
  } catch {
    await qdrant.createCollection(collectionName, {
      vectors: { size: 1536, distance: 'Cosine' }, // text-embedding-3-small = 1536
    })
  }
  return collectionName
}