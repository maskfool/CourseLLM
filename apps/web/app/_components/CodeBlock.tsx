"use client"
import React, { useState } from "react"

export default function CodeBlock({ code = "", lang = "" }:{ code?:string; lang?:string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <div className="group relative my-3">
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={copy}
          className="rounded-md border px-2 py-1 text-xs bg-white/80 hover:bg-white shadow-sm"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto overflow-y-auto max-h-[60vh] rounded-xl border bg-neutral-950 text-neutral-50 text-sm p-4">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-400">{lang || "code"}</div>
        <code className="whitespace-pre break-words">{code}</code>
      </pre>
    </div>
  )
}