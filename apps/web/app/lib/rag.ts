// app/lib/rag.ts
import 'server-only'
import { ChatOpenAI } from '@langchain/openai'
import { similaritySearchFiltered } from './vectorstore'
import { PERSONA } from './personas'
import { COURSES } from './courses'

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

function secToClock(s?: number | string) {
  if (s == null) return undefined
  const n = typeof s === 'string' ? Number(s) : s
  if (!isFinite(n)) return undefined
  const hh = Math.floor(n / 3600).toString().padStart(2, '0')
  const mm = Math.floor((n % 3600) / 60).toString().padStart(2, '0')
  const ss = Math.floor(n % 60).toString().padStart(2, '0')
  return hh === '00' ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`
}

function isHelpIntent(q: string) {
  const s = q.toLowerCase()
  return (
    /(^|\b)(help|how to use|what can i ask|courses|list courses|available)(\b|$)/.test(s) ||
    (/udemy/.test(s) && /help|course|courses|list/.test(s))
  )
}

// ── HYDE: generate 2 short synthetic queries to improve recall ───────────────
async function generateHydeQueries(userQuery: string) {
  const chat = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: CHAT_MODEL })
  const sys = `
You generate 2 alternative, short search queries that help retrieve relevant passages for a question.
Keep them concise (<= 12 words). Do NOT answer the question. Return each on a new line.
`.trim()
  const res = await chat.invoke([
    { role: 'system', content: sys },
    { role: 'user', content: `Question: ${userQuery}\n\nGive 2 alternative search queries:` }
  ])
  const text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content)
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
  return lines.slice(0, 2)
}

export async function answerFromDocs(
  query: string,
  { topK = Number(process.env.RAG_TOP_K || 5), courseId = 'all' } : { topK?: number; courseId?: string } = {}
) {
  // 0) Special-case: help / courses intent
  if (isHelpIntent(query)) {
    const list = COURSES.map(c => `- **${c.label}** (id: \`${c.id}\`)`).join('\n')
    const answer = [
      `**Available courses**`,
      ``,
      list,
      ``,
      `Tip: Select a course from the dropdown (top-right) or ask directly, e.g. “What is a DNS server?”`,
    ].join('\n')
    return { answer, references: [], context: [] }
  }

  // 1) HYDE expansion
  let queries = [query]
  try {
    const hyde = await generateHydeQueries(query)
    if (hyde.length) queries = [...queries, ...hyde]
  } catch { /* ignore HYDE failure */ }

  // 2) Retrieve per query (optionally filtered by courseId), merge, dedupe
  const seen = new Set<string>()
  const mergedDocs: any[] = []
  for (const q of queries) {
    const docs = await similaritySearchFiltered(q, {
      topK,
      minSimilarity: 0.70,
      oversample: Math.max(12, topK * 4),
      courseId, // your vectorstore should respect this to filter by metadata.course_id
    })
    for (const d of docs) {
      const meta: any = d.metadata || {}
      const key = `${meta.sourceName || meta.source || 'src'}|${meta.start ?? ''}|${(d.pageContent || '').slice(0, 80)}`
      if (!seen.has(key)) {
        seen.add(key)
        mergedDocs.push(d)
      }
    }
  }

  if (mergedDocs.length === 0) {
    return {
      answer: "Honestly, mujhe context me iska direct jawab nahi मिला. Thoda aur detail do ya course sahi select karo. 🙂",
      references: [],
      context: [],
    }
  }

  // keep top-K
  const finalDocs = mergedDocs.slice(0, topK)

  // 3) Build context with Section + Lesson + timestamps (so headings render bold/black in UI)
  const contextBlocks: string[] = []
  const references: Array<{
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
  }> = []

  finalDocs.forEach((d) => {
    const meta: any = d.metadata || {}
    const sourceName = meta.sourceName ?? meta.source ?? 'unknown'
    const page = meta.loc?.pageNumber ?? meta.page
    const start = meta.start
    const end = meta.end

    const sectionName = meta.section_name || meta.section_id
    const lessonId = meta.lesson_id || meta.lesson_slug

    const bits: string[] = []
    if (sectionName) bits.push(`Section: ${sectionName}`)
    if (lessonId)   bits.push(`Lesson: ${lessonId}`)
    if (page != null) bits.push(`p.${page}`)
    const sc = secToClock(start)
    const ec = secToClock(end)
    if (sc || ec) bits.push(`[${sc ?? start ?? ''}${ec ? `–${ec}` : ''}]`)

    // Heading (H1) so it renders big & black via MessageBubble
    contextBlocks.push(`# ${bits.join(' • ')} — ${sourceName}\n${d.pageContent}`)

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
      url: meta.url ?? (typeof sourceName === 'string' && sourceName.startsWith('http') ? sourceName : undefined),
      section_name: sectionName,
      lesson_id: lessonId,
    })
  })

  // 4) Prompt
  const system = `
${PERSONA.style}

Use ONLY the provided context to answer.
Always include section and lesson in your reasoning if they help; keep the final answer clean and concise.
If the answer isn't present, reply exactly: "I don't know".
Cite briefly (section/lesson + timestamps) when helpful.
`.trim()

  const user = `
Question:
${query}

Context:
${contextBlocks.join('\n\n---\n\n')}
`.trim()

  const chat = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: CHAT_MODEL })
  const aiMsg = await chat.invoke([{ role: 'system', content: system }, { role: 'user', content: user }])
  const answer = typeof aiMsg.content === 'string' ? aiMsg.content : JSON.stringify(aiMsg.content)

  return {
    answer,
    references,
    context: finalDocs.map(d => ({ text: d.pageContent, metadata: d.metadata })),
  }
}