// apps/web/app/lib/embedding.ts
import { OpenAIEmbeddings } from "@langchain/openai"

export const EMBED_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small"
export const EMBED_DIM = Number(process.env.EMBEDDING_DIM || 1536)

export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: EMBED_MODEL,
})