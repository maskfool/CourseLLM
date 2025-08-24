import fs from "node:fs/promises"
import Papa from "papaparse"
import { Document } from "@langchain/core/documents"

export async function fromCsv(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  const parsed = Papa.parse(raw, { header: true })
  const text = JSON.stringify(parsed.data)
  return [new Document({ pageContent: text, metadata: { source: filePath } })]
}