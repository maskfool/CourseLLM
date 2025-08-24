import 'dotenv/config'
import { OpenAIEmbeddings } from '@langchain/openai'

export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  batchSize: 64,        // tune 64–128; keeps requests smaller
  maxConcurrency: 4,    // parallelize safely
})