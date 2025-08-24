// apps/ingest-worker/src/loaders/fromText.js
import fs from "node:fs/promises"
import { Document } from "@langchain/core/documents"

export async function fromText(filePathOrText, isRaw = false) {
  if (isRaw) {
    return [new Document({ pageContent: filePathOrText, metadata: { source: "inline" } })]
  }
  const raw = await fs.readFile(filePathOrText, "utf8")
  return [new Document({ pageContent: raw, metadata: { source: filePathOrText } })]
}