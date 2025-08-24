// apps/web/lib/uploads.ts
import axios from "axios"

/** Send one file; supports folder uploads via `relpath` */
export async function uploadFile(file: File, relpath?: string, displayName?: string) {
  const formData = new FormData()
  formData.append("file", file)
  if (relpath) formData.append("relpath", relpath)
  if (displayName) formData.append("displayName", displayName)

  const res = await axios.post("/api/ingest/file", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data // { success, docId, result }
}

export async function uploadText(text: string) {
  const res = await axios.post("/api/ingest/text", { text })
  return res.data
}

export async function uploadUrl(url: string) {
  const res = await axios.post("/api/ingest/url", { url })
  return res.data
}

export async function deleteDoc(docId: string) {
  const res = await axios.delete(`/api/docs/${docId}`)
  return res.data
}