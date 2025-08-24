// app/lib/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest";
import { EMBED_DIM } from "./embedding";

export const COLLECTION =
  process.env.QDRANT_COLLECTION ?? "chaicode-collection";

const QDRANT_URL = process.env.QDRANT_URL!;       // e.g. https://xxx.cloud.qdrant.io
const QDRANT_API_KEY = process.env.QDRANT_API_KEY // undefined for local

export const qdrant = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

/**
 * Ensure the collection exists and matches the embedding dimension.
 * Safe to call multiple times.
 */
export async function ensureCollection(dim: number = EMBED_DIM) {
  // If collection exists, verify size; else create
  let exists = false;
  try {
    const list = await qdrant.getCollections();
    exists = !!list?.collections?.some((c: any) => c.name === COLLECTION);
  } catch {
    // ignore; we'll try to create
  }

  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: dim, distance: "Cosine" },
    });
    return;
  }

  // Verify vector size matches expected dim
  const info = await qdrant.getCollection(COLLECTION);
  const currSize =
    // depending on Qdrant version the shape differs:
    (info as any)?.result?.config?.params?.vectors?.size ??
    (info as any)?.result?.vectors?.size;

  if (currSize && Number(currSize) !== dim) {
    throw new Error(
      `Qdrant collection "${COLLECTION}" has vector size ${currSize}, but EMBED_DIM is ${dim}. ` +
      `Create a new collection name (QDRANT_COLLECTION) for the new dim, or recreate the existing collection and re-index.`
    );
  }
}