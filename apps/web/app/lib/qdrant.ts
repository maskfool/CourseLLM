import { QdrantClient } from "@qdrant/js-client-rest"
import { EMBED_DIM } from "./embedding"

export const COLLECTION = process.env.QDRANT_COLLECTION ?? "chaicode-collection"

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,          // e.g. https://xxxx.cluster.qdrant.io or http://127.0.0.1:6333
  apiKey: process.env.QDRANT_API_KEY,    // leave undefined for local
})

export async function ensureCollection(dim: number = EMBED_DIM) {
  // if exists, no-op
  try {
    const { collections } = await qdrant.getCollections()
    if (collections?.some((c: any) => c.name === COLLECTION)) return
  } catch {
    /* ignore and try creating */
  }

  // create if missing
  await qdrant.createCollection(COLLECTION, {
    vectors: { size: dim, distance: "Cosine" },
  })
}