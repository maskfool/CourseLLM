"use client"
import React, { useState, useRef, useEffect } from "react"
import MessageBubble from "./MessageBubble"

type TimeRef = { startClock?: string; endClock?: string }

export default function ChatArea({
  messages,
  onSend,
  dark
}:{
  messages: Array<{ id:number; role:"user"|"assistant"|"system"; text:string; time?:string|null; refs?: TimeRef[] }>
  onSend: (text:string)=>void
  dark: boolean
}) {
  const [val, setVal] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })
    return () => cancelAnimationFrame(id)
  }, [messages])

  function handleSend() {
    if (!val.trim()) return
    onSend(val)
    setVal("")
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 max-h-full overflow-y-auto px-4 py-6 overscroll-contain">
        <div className="space-y-1">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} time={m.time || null} dark={dark} refs={m.refs}>
              {m.text}
            </MessageBubble>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className={`${dark ? "border-t border-white/20 bg-black/70" : "border-t border-neutral-200 bg-white/80"} backdrop-blur px-3 py-2`}>
        <div className="max-w-4xl mx-auto flex items-end gap-2">
          <textarea
            rows={1}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }}}
            placeholder="Ask me anything about your documents… ✨"
            className={`flex-1 resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              dark ? "border-white/20 bg-black/40 text-neutral-100 focus:ring-white/10"
                   : "border-neutral-300 bg-white text-neutral-800 focus:ring-neutral-200"
            }`}
          />
          <button
            onClick={handleSend}
            className={`shrink-0 rounded-xl border px-3 py-2 text-sm active:scale-[0.98] ${
              dark ? "border-white/20 bg-black/40 hover:bg-black/60"
                   : "border-neutral-300 bg-white hover:bg-neutral-50"
            }`}
          >
            Send ➤
          </button>
        </div>
      </div>
    </div>
  )
}