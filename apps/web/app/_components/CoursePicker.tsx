"use client"
import React, { useEffect, useRef, useState } from "react"
import { COURSES, courseLabel } from "../lib/courses"

export default function CoursePicker({
  value,
  onChange,
  dark,
  size = "md",
}: {
  value: string
  onChange: (id: string) => void
  dark: boolean
  size?: "md" | "lg"
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  const base = `
    inline-flex items-center gap-2 rounded-xl border transition
    ${size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm"}
    ${dark ? "border-white/20 bg-black/40 hover:bg-black/60 text-neutral-100" : "border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800"}
  `

  return (
    <div className="relative" ref={ref}>
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        className={base}
        onClick={() => setOpen((s) => !s)}
        title="Choose course"
      >
        <span className={`grid place-items-center rounded-md ${size === "lg" ? "h-6 w-6" : "h-5 w-5"} ${dark ? "bg-white text-black" : "bg-neutral-900 text-white"} text-[10px] font-bold`}>
          📚
        </span>
        <span className="font-medium">Course:</span>
        <span className="font-semibold">{courseLabel(value)}</span>
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border shadow-lg ${
            dark ? "border-white/10 bg-black/90 text-neutral-100" : "border-neutral-200 bg-white text-neutral-800"
          }`}
        >
          <div className="px-3 py-2 text-[11px] opacity-70">Select a course context</div>
          <ul className="max-h-72 overflow-auto py-1">
            {COURSES.map((c) => {
              const active = c.id === value
              return (
                <li key={c.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(c.id)
                      setOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                      active
                        ? dark
                          ? "bg-white/10"
                          : "bg-neutral-100"
                        : dark
                          ? "hover:bg-white/5"
                          : "hover:bg-neutral-50"
                    }`}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-neutral-300"}`} />
                    <span className="font-medium">{c.label}</span>
                    <span className="ml-auto text-[11px] opacity-60">id: {c.id}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className={`px-3 py-2 text-[11px] ${dark ? "border-t border-white/10" : "border-t border-neutral-200"} opacity-70`}>
            Tip: picking a course improves answer relevance & timestamps.
          </div>
        </div>
      )}
    </div>
  )
}