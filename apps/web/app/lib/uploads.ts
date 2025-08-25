// apps/web/lib/uploads.ts

// If NEXT_PUBLIC_INGEST_ORIGIN is set (e.g. https://your-ingest.onrender.com),
// the browser talks to ingest directly. Otherwise, fall back to Next proxy (/api/...).
const ORIGIN = (process.env.NEXT_PUBLIC_INGEST_ORIGIN || "").replace(/\/$/, "")
const BASE = ORIGIN ? `${ORIGIN}/api` : "/api"

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function retryFetch(url: string, init: RequestInit, tries = 3) {
  let lastErr: any
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json?.error || res.statusText
        // Treat 409/415/4xx as final (don’t retry)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(msg)
        }
        throw new Error(msg)
      }
      return json
    } catch (e: any) {
      lastErr = e
      const msg = String(e?.message || e)
      // Retry only on likely transient errors
      if (/ECONNRESET|socket hang up|network|timeout|fetch failed|502|503|504/i.test(msg)) {
        await sleep(1000 * (i + 1))
        continue
      }
      throw e
    }
  }
  throw lastErr
}

export async function warmUpIngest() {
  try {
    await fetch(`${BASE}/health`, { cache: "no-store" })
  } catch {
    // ignore warm-up failures
  }
}

/** Send one file; supports folder uploads via `relpath` */
export async function uploadFile(file: File, relpath?: string, displayName?: string) {
  const fd = new FormData()
  fd.append("file", file, file.name)
  if (relpath) fd.append("relpath", relpath)
  if (displayName) fd.append("displayName", displayName)

  return retryFetch(`${BASE}/ingest/file`, {
    method: "POST",
    body: fd,
  })
}

export async function uploadText(text: string) {
  return retryFetch(`${BASE}/ingest/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
}

export async function uploadUrl(url: string) {
  return retryFetch(`${BASE}/ingest/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
}

export async function deleteDoc(docId: string) {
  const res = await fetch(`${BASE}/docs/${encodeURIComponent(docId)}`, { method: "DELETE" })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || "delete failed")
  return json
}