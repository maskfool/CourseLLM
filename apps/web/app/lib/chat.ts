// app/lib/chat.ts
import axios from "axios"

export async function askQuestion(query: string, opts?: { topK?: number; courseId?: string }) {
  const res = await axios.post("/api/chat", { query, ...opts })
  return res.data   // { success, answer, references }
}