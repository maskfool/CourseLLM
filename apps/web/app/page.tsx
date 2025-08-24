// apps/web/app/page.tsx
"use client"
import React, { useEffect, useState } from "react"
import Sidebar from "./_components/Sidebar"
import ChatArea from "./_components/ChatArea"
import { uploadFile, uploadText, uploadUrl, deleteDoc } from "./lib/uploads"
import { askQuestion } from "./lib/chat"
import { COURSES, courseLabel } from "./lib/courses"

type TimeRef = {
  startClock?: string
  endClock?: string
  sectionName?: string
  lessonId?: string
}

type UploadItem = {
  localId: string
  docId?: string
  kind: "file" | "text" | "url"
  name: string
  size?: number
  pending?: boolean
}

const nowIso = () => new Date().toISOString()

export default function Page() {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [messages, setMessages] = useState<
    Array<{ id:number; role:"user"|"assistant"|"system"; text:string; time:string|null; refs?:TimeRef[] }>
  >([
    { id: 1, role: "assistant", text: "Hanjiii, kya madat karni hai aapki? Upload docs ya text/URL bhejo, aur sawal pucho. 😃", time: null },
  ])
  const [dark, setDark] = useState(false)
  const [courseId, setCourseId] = useState<string>("all")

  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null
      const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      const next = saved ? saved === "dark" : !!prefersDark
      setDark(next)
      document.documentElement.classList.toggle("dark", next)
    } catch {}
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    try { localStorage.setItem("theme", dark ? "dark" : "light") } catch {}
  }, [dark])

  function addSystemMessage(text: string, customId = Date.now()) {
    const t = nowIso()
    setMessages((m) => [...m, { id: customId, role: "system", text, time: t }])
    return customId
  }
  function updateSystemMessage(id: number, newText: string) {
    const t = nowIso()
    setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, text: newText, time: t } : msg)))
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList || [])
    if (!files.length) return

    files.forEach(async (f) => {
      const localId = "local-" + Date.now() + "-" + Math.random()
      const rel = (f as any).webkitRelativePath || undefined
      setUploads((u) => [...u, { localId, kind: "file", name: rel || f.name, size: f.size, pending: true }])
      const pendingMsgId = Date.now() + Math.random()
      addSystemMessage(`⏳ Uploading & scanning ${rel ? `"${rel}"` : `"${f.name}"`}...`, pendingMsgId as number)
      try {
        const res = await uploadFile(f, rel, f.name)
        setUploads((u) => u.map((it) => it.localId === localId ? { ...it, docId: res.docId, pending: false } : it))
        updateSystemMessage(pendingMsgId as number, `✅ ${rel || f.name} uploaded & indexed successfully!`)
      } catch {
        setUploads((u) => u.filter((x) => x.localId !== localId))
        updateSystemMessage(pendingMsgId as number, `❌ ${rel || f.name} upload failed.`)
      }
    })
  }

  async function addText(text: string) {
    if (!text.trim()) return
    const localId = "local-" + Date.now() + "-" + Math.random()
    const label = text.slice(0, 40)
    setUploads((u) => [...u, { localId, kind: "text", name: label, pending: true }])
    const pendingMsgId = Date.now() + Math.random()
    addSystemMessage("⏳ Processing your text snippet...", pendingMsgId as number)
    try {
      const res = await uploadText(text)
      setUploads((u) => u.map((it) => it.localId === localId ? { ...it, docId: res.docId, pending: false } : it))
      updateSystemMessage(pendingMsgId as number, "✅ Text snippet added & processed successfully!")
    } catch {
      setUploads((u) => u.filter((x) => x.localId !== localId))
      updateSystemMessage(pendingMsgId as number, "❌ Failed to process text snippet.")
    }
  }

  async function addUrl(url: string) {
    if (!url.trim()) return
    const localId = "local-" + Date.now() + "-" + Math.random()
    setUploads((u) => [...u, { localId, kind: "url", name: url, pending: true }])
    const pendingMsgId = Date.now() + Math.random()
    addSystemMessage(`⏳ Crawling & scanning URL "${url}"...`, pendingMsgId as number)
    try {
      const res = await uploadUrl(url)
      setUploads((u) => u.map((it) => it.localId === localId ? { ...it, docId: res.docId, pending: false } : it))
      updateSystemMessage(pendingMsgId as number, `✅ URL "${url}" crawled & indexed successfully!`)
    } catch {
      setUploads((u) => u.filter((x) => x.localId !== localId))
      updateSystemMessage(pendingMsgId as number, `❌ Failed to process URL "${url}".`)
    }
  }

  async function removeUpload(item: UploadItem) {
    if (!item?.docId) {
      setUploads((u) => u.filter((x) => x.localId !== item.localId))
      addSystemMessage(`ℹ️ Removed "${item.name}" from list.`)
      return
    }
    const pendingId = Date.now() + Math.random()
    addSystemMessage(`🧹 Deleting "${item.name}"...`, pendingId as number)
    try {
      await deleteDoc(item.docId)
      setUploads((u) => u.filter((x) => x.localId !== item.localId))
      updateSystemMessage(pendingId as number, `✅ Deleted "${item.name}" and all its chunks.`)
    } catch {
      updateSystemMessage(pendingId as number, `❌ Failed to delete "${item.name}".`)
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return
    const userId = Date.now()
    const pendingId = userId + 1
    const t = nowIso()
    setMessages((m) => [
      ...m,
      { id: userId, role: "user", text, time: t },
      { id: pendingId, role: "assistant", text: "⏳ Thinking...", time: nowIso() },
    ])
    try {
      const res = await askQuestion(text, { courseId }) // { success, answer, references }
      const refsRaw = Array.isArray(res.references) ? res.references : []

      const seen = new Set<string>()
      const refs: TimeRef[] = refsRaw
        .map((r: any) => {
          const s = r?.startClock || null
          const e = r?.endClock || null
          const sectionName = r?.section_name || r?.sectionName || undefined
          const lessonId = r?.lesson_id || r?.lessonId || undefined
          if (!s && !e && !sectionName && !lessonId) return null
          const key = `${s || ""}-${e || ""}-${sectionName || ""}-${lessonId || ""}`
          if (seen.has(key)) return null
          seen.add(key)
          return {
            startClock: s || undefined,
            endClock: e || undefined,
            sectionName,
            lessonId,
          }
        })
        .filter(Boolean) as TimeRef[]

      // keep time chips ordered
      refs.sort((a, b) => (a.startClock || "").localeCompare(b.startClock || ""))

      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId ? { ...msg, text: res.answer, time: nowIso(), refs } : msg
        )
      )
    } catch {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId ? { ...msg, text: "❌ Chat request failed. Please try again.", time: nowIso() } : msg
        )
      )
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col paper-grid">
      <header className={`h-14 border-b flex items-center justify-between px-4 ${dark ? "bg-black/70 border-white/10 text-neutral-100" : "bg-white/70 border-neutral-200 text-neutral-800"}`}>
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 grid place-items-center rounded-md text-xs font-bold ${dark ? "bg-white text-black" : "bg-neutral-900 text-white"}`}>AI</div>
          <h1 className="font-semibold">Drop your knowledge here</h1>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={`rounded-lg px-2 py-1 text-sm border ${dark ? "border-white/20 bg-black/40" : "border-neutral-300 bg-white"}`}
            title="Choose course"
          >
            {COURSES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <button
            onClick={() => setDark((d) => !d)}
            className={`rounded-lg px-3 py-1 text-sm border ${dark ? "border-white/20 hover:bg-white/10" : "border-neutral-300 hover:bg-neutral-100"}`}
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className={`w-[340px] border-r p-4 overflow-y-auto ${dark ? "bg-black/40 border-white/10" : "bg-neutral-50/70 border-neutral-200"}`}>
          <Sidebar
            dark={dark}
            uploads={uploads}
            addFiles={addFiles}
            addText={addText}
            addUrl={addUrl}
            onDelete={removeUpload}
          />
        </aside>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className={`border-b px-4 py-3 ${dark ? "bg-black/50 border-white/10" : "bg-white/70 border-neutral-200"}`}>
            <div className="text-sm font-medium">Chat with your documents</div>
            <div className={`${dark ? "text-neutral-400" : "text-neutral-500"} text-xs`}>
              Context: <b>{courseLabel(courseId)}</b>
            </div>
          </div>
          <ChatArea dark={dark} messages={messages as any} onSend={sendMessage} />
        </section>
      </div>
    </div>
  )
}