// app/lib/embedding.ts
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Embedding model + dimension.
 * Defaults to text-embedding-3-large (3072 dims) — same as your current setup.
 * You can override via env:
 *   OPENAI_EMBED_MODEL = text-embedding-3-small | text-embedding-3-large
 *   EMBED_DIM = 1536 (small) | 3072 (large)
 */
export const EMBED_MODEL =
  process.env.OPENAI_EMBED_MODEL || "text-embedding-3-large";

export const EMBED_DIM =
  Number(process.env.EMBED_DIM) ||
  (EMBED_MODEL.includes("large") ? 3072 : 1536);

export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: EMBED_MODEL,
  dimensions: EMBED_DIM,
});