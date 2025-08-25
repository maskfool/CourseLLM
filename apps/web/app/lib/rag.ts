// apps/web/app/lib/rag.ts
import "server-only"
import { ChatOpenAI } from "@langchain/openai"
import { similaritySearchFiltered } from "./vectorstore"
import { PERSONA } from "./personas"
import { COURSES } from "./courses"

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini"

type RefRecord = {
  sourceName?: string
  source?: string
  start?: number | string
  end?: number | string
  startClock?: string
  endClock?: string
  docId?: string
  page?: number
  videoId?: string
  courseId?: string
  url?: string
  section_name?: string
  lesson_id?: string
}

const COURSE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  COURSES.map((c) => [c.id, c.label])
)

function secToClock(s?: number | string) {
  if (s == null) return undefined
  const n = typeof s === "string" ? Number(s) : s
  if (!isFinite(n)) return undefined
  const hh = Math.floor(n / 3600).toString().padStart(2, "0")
  const mm = Math.floor((n % 3600) / 60).toString().padStart(2, "0")
  const ss = Math.floor(n % 60).toString().padStart(2, "0")
  return hh === "00" ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`
}

function isHelpIntent(q: string) {
  const s = q.toLowerCase()
  return /(^|\b)(help|how to use|what can i ask|courses|list courses|available)(\b|$)/.test(s)
}

function isChitChatIntent(q: string) {
  const s = q.toLowerCase().trim()
  return /^(hi|hello|hey|yo|namaste|hola|sup|good (morning|evening|afternoon))\b/.test(s)
}

function humanizeSlug(s?: string, fallback = "—") {
  if (!s || typeof s !== "string") return fallback
  return s.replace(/[-_]+/g, " ").trim()
}

function saneCourseKey(key?: string) {
  if (!key) return undefined
  if (/^sections?$/i.test(key)) return undefined
  return key
}

function deriveCourseKey(r: RefRecord, selectedCourseId?: string) {
  // 1) explicit courseId on the chunk
  const fromMeta = saneCourseKey(r.courseId)
  if (fromMeta) return fromMeta

  // 2) derive from videoId like: "nodejs/basics/04-node-vs-browser"
  if (r.videoId && typeof r.videoId === "string") {
    const first = r.videoId.split("/")[0]?.trim()
    const clean = saneCourseKey(first)
    if (clean) return clean
  }

  // 3) use the currently selected course if not "all"
  if (selectedCourseId && selectedCourseId !== "all") {
    return selectedCourseId
  }

  return undefined
}

// ── HYDE: generate 2 short synthetic queries ─────────────────────────────────
async function generateHydeQueries(userQuery: string) {
  const chat = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: CHAT_MODEL })
  const sys = `
You generate 2 alternative, short search queries that help retrieve relevant passages for a question.
Keep them concise (<= 12 words). Do NOT answer the question. Return each on a new line.
`.trim()
  const res = await chat.invoke([
    { role: "system", content: sys },
    { role: "user", content: `Question: ${userQuery}\n\nGive 2 alternative search queries:` },
  ])
  const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content)
  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean)
  return lines.slice(0, 2)
}

export async function answerFromDocs(
  query: string,
  { topK = Number(process.env.RAG_TOP_K || 5), courseId = "all" }: { topK?: number; courseId?: string } = {}
) {
  // Small-talk
  if (isChitChatIntent(query)) {
    return {
      answer:
        "👋 Arre hello! Kaise ho? Kuch programming ya course se related sawaal poochho, main **timestamp** ke sath bataunga. 🚀",
      references: [],
      context: [],
    }
  }

  // Help / courses intent
  if (isHelpIntent(query)) {
    const list = COURSES.map((c) => `- **${c.label}** (id: \`${c.id}\`)`).join("\n")
    const answer = [
      `**Available courses**`,
      ``,
      list,
      ``,
      `Tip: Select a course from the dropdown (top-right) or ask directly, e.g. “What is a DNS server?”`,
    ].join("\n")
    return { answer, references: [], context: [] }
  }

  // HYDE expansion
  let queries = [query]
  try {
    const hyde = await generateHydeQueries(query)
    if (hyde.length) queries = [...queries, ...hyde]
  } catch {}

  // Retrieve & merge
  const seen = new Set<string>()
  const mergedDocs: Array<{ pageContent: string; metadata: Record<string, any> }> = []

  for (const q of queries) {
    const docs = await similaritySearchFiltered(q, {
      topK,
      minSimilarity: 0.7,
      oversample: Math.max(12, topK * 4),
      courseId,
    })

    for (const d of docs as Array<{ pageContent: string; metadata?: Record<string, unknown> }>) {
      const meta = (d.metadata || {}) as Record<string, any>
      const key = `${meta.sourceName || meta.source || "src"}|${meta.start ?? ""}|${(d.pageContent || "").slice(0, 80)}`
      if (!seen.has(key)) {
        seen.add(key)
        mergedDocs.push({ pageContent: d.pageContent, metadata: meta })
      }
    }
  }

  if (mergedDocs.length === 0) {
    return { answer: "I don't know", references: [], context: [] }
  }

  const finalDocs = mergedDocs.slice(0, topK)

  // Build context + refs
  const contextBlocks: string[] = []
  const references: RefRecord[] = []

  finalDocs.forEach((d) => {
    const meta = d.metadata || {}
    const sourceName: string = meta.sourceName ?? meta.source ?? "unknown"
    const page: number | undefined = meta.loc?.pageNumber ?? meta.page
    const start = meta.start
    const end = meta.end

    const sectionName: string | undefined = meta.section_name || meta.section_id
    const lessonId: string | undefined = meta.lesson_id || meta.lesson_slug

    const parts: string[] = []
    if (sectionName) parts.push(`Section: ${sectionName}`)
    if (lessonId) parts.push(`Lesson: ${lessonId}`)
    if (page != null) parts.push(`p.${page}`)
    const sc = secToClock(start)
    const ec = secToClock(end)
    if (sc || ec) parts.push(`[${sc ?? start ?? ""}${ec ? `–${ec}` : ""}]`)

    contextBlocks.push(`# ${parts.join(" • ")} — ${sourceName}\n${d.pageContent}`)

    references.push({
      sourceName,
      source: meta.source,
      start,
      end,
      startClock: sc,
      endClock: ec,
      docId: meta.docId,
      page,
      videoId: meta.video_id ?? meta.videoId,
      courseId: meta.course_id ?? meta.courseId,
      url:
        meta.url ??
        (typeof sourceName === "string" && sourceName.startsWith("http") ? sourceName : undefined),
      section_name: sectionName,
      lesson_id: lessonId,
    })
  })

  // Ask model (no inline citations)
  const system = `
${PERSONA.style}

Use ONLY the provided context to answer.
Keep the final answer clean and concise.
If the answer isn't present, reply exactly: "I don't know".
Do NOT add citations inline; they will be attached separately.
`.trim()

  const user = `
Question:
${query}

Context:
${contextBlocks.join("\n\n---\n\n")}
`.trim()

  const chat = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: CHAT_MODEL })
  const aiMsg = await chat.invoke([{ role: "system", content: system }, { role: "user", content: user }])
  const coreAnswer = typeof aiMsg.content === "string" ? aiMsg.content : JSON.stringify(aiMsg.content)
  const trimmed = coreAnswer.trim()
  const showAttributions = trimmed !== "I don't know"

  // Sources (top 3 unique), with strong Course derivation
  let sourcesPanel = ""
  let finalRefs: RefRecord[] = []

  if (showAttributions) {
    const uniq = new Set<string>()
    const lines: string[] = []

    for (const r of references) {
      const courseKey = deriveCourseKey(r, courseId)
      const courseLabel =
        (courseKey && (COURSE_LABEL_MAP[courseKey] || humanizeSlug(courseKey))) || undefined

      const section = r.section_name ? humanizeSlug(r.section_name) : undefined
      const lesson = r.lesson_id ? humanizeSlug(r.lesson_id) : undefined
      const ts =
        r.startClock || r.endClock
          ? `[${r.startClock ?? ""}${r.endClock ? `–${r.endClock}` : ""}]`
          : undefined

      const bits: string[] = []
      if (courseLabel) bits.push(`Course: ${courseLabel}`)
      if (section) bits.push(`Section: ${section}`)
      if (lesson) bits.push(`Lesson: ${lesson}`)
      const line = bits.length ? `${bits.join(" • ")}${ts ? ` · ${ts}` : ""}` : undefined

      if (line && !uniq.has(line)) {
        uniq.add(line)
        lines.push(`• ${line}`)
      }
      if (lines.length >= 3) break
    }

    if (lines.length) {
      sourcesPanel = `\n---\n**Sources**\n${lines.join("\n")}\n`
    }
    finalRefs = references
  } else {
    finalRefs = []
  }

  const finalAnswer = showAttributions ? `${coreAnswer}${sourcesPanel}` : trimmed

  return {
    answer: finalAnswer,
    references: finalRefs,
    context: finalDocs.map((d) => ({ text: d.pageContent, metadata: d.metadata })),
  }
}