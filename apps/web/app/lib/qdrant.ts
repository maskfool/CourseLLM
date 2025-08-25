// apps/web/app/lib/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest"
import { EMBED_DIM } from "./embedding"

export const COLLECTION = process.env.QDRANT_COLLECTION ?? "chaicode-collection"

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,       // cloud URL
  apiKey: process.env.QDRANT_API_KEY, // undefined for local
})

export async function ensureCollection(dim: number = EMBED_DIM) {
  try {
    const { collections } = await qdrant.getCollections()
    if (collections?.some((c: any) => c.name === COLLECTION)) return
  } catch { /* try create */ }

  await qdrant.createCollection(COLLECTION, {
    vectors: { size: dim, distance: "Cosine" },
  })
}