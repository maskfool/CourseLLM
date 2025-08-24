// apps/web/app/_components/Sidebar.tsx
"use client"
import React, { useRef, useState } from "react"

export default function Sidebar({
  uploads,
  addFiles,
  addText,
  addUrl,
  dark,
  onDelete,
}: {
  uploads: Array<{ localId: string; kind: "file" | "text" | "url"; name: string; size?: number; pending?: boolean; docId?: string }>
  addFiles: (fl: FileList | File[]) => void
  addText: (t: string) => void
  addUrl: (u: string) => void
  dark: boolean
  onDelete: (item: any) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [snippet, setSnippet] = useState("")
  const [url, setUrl] = useState("")

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    if ((e.dataTransfer.files?.length || 0) > 0) addFiles(e.dataTransfer.files as unknown as FileList)
  }

  const card = `rounded-2xl border p-4 shadow-sm ${dark ? "border-white/20 bg-black/50" : "border-neutral-200 bg-white"}`
  const inputBox = `rounded-xl border px-3 py-2 text-sm ${
    dark ? "border-white/20 bg-black/40 text-neutral-100" : "border-neutral-300 bg-white text-neutral-800"
  }`
  const btn = `rounded-xl border px-3 py-2 text-sm ${
    dark ? "border-white/20 bg-black/40 hover:bg-black/60" : "border-neutral-300 bg-white hover:bg-neutral-50"
  }`

  return (
    <div className="space-y-6">
      {/* Drag & Drop / Click to select files */}
      <div
        className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer ${
          dark ? "border-white/20 hover:bg-black/40" : "border-neutral-300 hover:bg-neutral-100"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${dark ? "bg-white/10 text-2xl" : "bg-neutral-100 text-2xl"}`}>⬆️</div>
        <div className="font-medium">Drop files here or click to browse</div>
        <div className={`${dark ? "text-neutral-400" : "text-neutral-500"} mt-1 text-xs`}>Supports PDF, TXT, SRT, VTT, and more ✨</div>
        <input ref={fileRef} className="hidden" type="file" multiple onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>

      {/* NEW: Folder picker (uploads entire directory; preserves relative paths) */}
      <div className={card}>
        <div className="mb-2 text-sm font-semibold">Upload a whole course folder</div>
        <div className="text-xs mb-2 opacity-80">
          Select a directory like <code>nodejs/01-basic-node-js/…</code>. We’ll keep the folder structure (for course/section/lesson).
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            // @ts-ignore non-standard but supported in Chromium/Safari/Edge
            webkitdirectory="true"
            // @ts-ignore
            directory=""
            className="block w-full text-xs"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Paste text */}
      <div className={card}>
        <div className="mb-2 text-sm font-semibold">Paste your text</div>
        <textarea
          className={`h-28 w-full resize-none ${inputBox}`}
          placeholder="Paste notes, articles, research…"
          value={snippet}
          onChange={(e) => setSnippet(e.target.value)}
        />
        <button
          onClick={() => {
            if (snippet.trim()) {
              addText(snippet)
              setSnippet("")
            }
          }}
          className={`${btn} mt-3 w-full`}
        >
          Add Text Content
        </button>
      </div>

      {/* URL ingest */}
      <div className={card}>
        <div className="mb-2 text-sm font-semibold">Share a website</div>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/docs"
            className={`flex-1 ${inputBox}`}
          />
          <button
            className={btn}
            onClick={() => {
              if (url.trim()) {
                addUrl(url.trim())
                setUrl("")
              }
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Uploaded list */}
      {uploads.length > 0 && (
        <div className={card}>
          <div className="mb-2 text-sm font-semibold">Added items</div>
          <ul className="space-y-2 text-sm">
            {uploads.map((u) => (
              <li
                key={u.localId}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  dark ? "border-white/20" : "border-neutral-200"
                }`}
              >
                <span className="truncate pr-2 flex items-center gap-2">
                  <span>
                    {u.kind === "file" && "📄"}
                    {u.kind === "text" && "📝"}
                    {u.kind === "url" && "🔗"}
                  </span>
                <span className="truncate">{u.name}</span>
                {u.pending && <span className="text-xs opacity-70">(processing…)</span>}
                </span>
                <button
                  onClick={() => onDelete(u)}
                  className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs ${
                    dark ? "border-white/20 hover:bg-black/60" : "border-neutral-300 hover:bg-neutral-100"
                  }`}
                  title="Delete"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}