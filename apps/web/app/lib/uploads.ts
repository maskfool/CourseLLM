import axios from "axios"

const BASE =
  (typeof window !== "undefined" && (window as any).__NEXT_PUBLIC_INGEST_BASE) ||
  process.env.NEXT_PUBLIC_INGEST_BASE

function apiBase() {
  // Fallback to relative only in local dev where you proxy or run worker locally
  return BASE || "/api"
}

/** Send one file; supports folder uploads via `relpath` */
export async function uploadFile(file: File, relpath?: string, displayName?: string) {
  const formData = new FormData()
  formData.append("file", file)
  if (relpath) formData.append("relpath", relpath)
  if (displayName) formData.append("displayName", displayName)

  const res = await axios.post(`${apiBase()}/ingest/file`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 45_000,
  })
  return res.data
}

export async function uploadText(text: string) {
  const res = await axios.post(`${apiBase()}/ingest/text`, { text }, { timeout: 30_000 })
  return res.data
}

export async function uploadUrl(url: string) {
  const res = await axios.post(`${apiBase()}/ingest/url`, { url }, { timeout: 45_000 })
  return res.data
}

export async function deleteDoc(docId: string) {
  const res = await axios.delete(`${apiBase()}/docs/${docId}`, { timeout: 20_000 })
  return res.data
}