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
        className={`group rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ease-out
          ${dark
            ? "border-white/20 hover:bg-black/40 hover:shadow-lg hover:scale-[1.02]"
            : "border-neutral-300 hover:bg-neutral-100 hover:shadow-md hover:scale-[1.02]"
          }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        aria-label="Upload files"
      >
        <div
          className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-200
            ${dark ? "bg-white/10 text-2xl" : "bg-neutral-100 text-2xl"} group-hover:scale-110`}
          aria-hidden
        >
          ⬆️
        </div>
        <div className="font-medium">Drop files here or click to browse</div>
        <div className={`${dark ? "text-neutral-400" : "text-neutral-500"} mt-1 text-xs`}>
          Supports PDF, TXT, SRT, VTT, and more ✨
        </div>
        <input
          ref={fileRef}
          className="hidden"
          type="file"
          multiple
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Folder Uploader Card */}
      <div
        className={`group rounded-2xl border p-4 shadow-sm transition-all duration-200 ease-out
          ${dark
            ? "bg-black/30 border-white/10 hover:bg-black/50 hover:shadow-lg hover:scale-[1.02]"
            : "bg-white border-neutral-200 hover:bg-neutral-50 hover:shadow-md hover:scale-[1.02]"
          }`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform duration-200
              ${dark ? "bg-white/10" : "bg-neutral-100"} group-hover:scale-110`}
            aria-hidden
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 7.5h5.2c.4 0 .8-.17 1.06-.47l1.08-1.23c.2-.23.48-.36.78-.36H21c.55 0 1 .45 1 1v11.5A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5V9c0-.83.67-1.5 1.5-1.5Z"
                className={dark ? "stroke-white/80" : "stroke-neutral-700"}
                strokeWidth="1.2"
              />
            </svg>
          </div>

          <div className="flex-1">
            <div className="text-sm font-semibold">
              Upload a whole course folder
            </div>

            <p className="mt-1 text-xs opacity-80 leading-relaxed">
              Pick a top-level folder like <span className="font-medium">nodejs</span> or{" "}
              <span className="font-medium">python</span>. We’ll preserve the directory
              structure to infer <em>course → section → lesson</em>.
            </p>

            {/* Dropzone-ish area */}
            <div
              className={`mt-3 rounded-xl border-2 border-dashed p-3 text-center transition-colors duration-200
                ${dark ? "border-white/15 bg-black/20 group-hover:bg-black/30" : "border-neutral-300 bg-neutral-50 group-hover:bg-neutral-100"}`}
            >
              <input
                id="dir-input"
                type="file"
                // @ts-ignore non-standard but supported in Chromium/Safari/Edge
                webkitdirectory="true"
                // @ts-ignore
                directory=""
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />

              <label
                htmlFor="dir-input"
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition
                  ${dark ? "bg-white text-black hover:bg-white/90" : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
              >
                Browse folder
              </label>

              <div className="mt-2 text-[11px] opacity-70">
                Or drag &amp; drop a folder here (on supported browsers)
              </div>
            </div>

            {/* Tiny tips row */}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-70">
              <span>Accepted: .vtt, .srt, .pdf, .csv, .json, .txt</span>
              <span>•</span>
              <span>Hidden files are skipped automatically</span>
            </div>
          </div>
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

      {/* (Optional) URL ingest – still commented out per your note */}
      {/*
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
      */}

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
                  className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs transition-colors
                    ${dark ? "border-white/20 hover:bg-black/60" : "border-neutral-300 hover:bg-neutral-100"}`}
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