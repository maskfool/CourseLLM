import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"

export async function fromPdf(filePath) {
  const loader = new PDFLoader(filePath, { splitPages: true })
  return loader.load()
}