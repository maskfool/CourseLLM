import fs from "node:fs/promises"
import { Document } from "@langchain/core/documents"

export async function fromJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return [new Document({ pageContent: raw, metadata: { source: filePath } })]
}