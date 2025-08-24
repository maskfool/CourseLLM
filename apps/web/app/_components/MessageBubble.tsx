"use client"
import React, { useState } from "react"

function formatTimeIso(iso?: string | null) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  } catch {
    return ""
  }
}

type TimeRef = {
  startClock?: string
  endClock?: string
  sectionName?: string
  lessonId?: string
}

/** inline formatter for `code`, **bold**, *italic* */
function renderInline(text: string) {
  const nodes: React.ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0, m: RegExpExecArray | null, key = 0

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={key++}>{text.slice(last, m.index)}</span>)
    const tok = m[0]

    if (tok.startsWith("`") && tok.endsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded-md border px-1 py-[2px] font-mono text-[0.85em]
                     bg-neutral-100 dark:bg-white/10
                     border-neutral-200 dark:border-white/10"
        >
          {tok.slice(1, -1)}
        </code>
      )
    } else if (tok.startsWith("**") && tok.endsWith("**")) {
      nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith("*") && tok.endsWith("*")) {
      nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    } else {
      nodes.push(<span key={key++}>{tok}</span>)
    }
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(<span key={key++}>{text.slice(last)}</span>)
  return nodes
}

/** fenced code block component */
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="relative my-3">
      <pre
        className="overflow-x-auto rounded-lg border bg-neutral-950 text-neutral-100 p-3 text-sm"
      >
        <code className={`language-${lang || "plaintext"}`}>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded-md border px-2 py-1 text-xs bg-neutral-800 text-white hover:bg-neutral-700"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  )
}

/** very small markdown renderer with fenced blocks + inline formatting */
function RenderSimpleMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  const nodes: React.ReactNode[] = []
  let i = 0, key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block start
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim() || undefined
      i++
      const codeLines: string[] = []
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      nodes.push(<CodeBlock key={`code-${key++}`} code={codeLines.join("\n")} lang={lang} />)
      continue
    }

    // Headings
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      const content = h[2]
      const sizes = ["text-2xl","text-xl","text-lg","text-base","text-sm","text-xs"]
      nodes.push(
        <div
          key={`h-${i}`}
          className={`mt-3 mb-2 font-semibold tracking-tight ${sizes[Math.min(level - 1, 5)]} text-black`}
        >
          {renderInline(content)}
        </div>
      )
      i++
      continue
    }

    // Lists
    if (/^(\*|-|\d+\.)\s+/.test(line)) {
      const items: string[] = []
      let ordered = false
      while (i < lines.length && /^(\*|-|\d+\.)\s+/.test(lines[i])) {
        const m = /^(\*|-|\d+\.)\s+(.*)$/.exec(lines[i])!
        ordered = ordered || /\d+\./.test(m[1])
        items.push(m[2])
        i++
      }
      nodes.push(
        ordered ? (
          <ol key={`ol-${i}`} className="my-2 ml-5 list-decimal space-y-1 text-sm">
            {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
          </ol>
        ) : (
          <ul key={`ul-${i}`} className="my-2 ml-5 list-disc space-y-1 text-sm">
            {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
          </ul>
        )
      )
      continue
    }

    // Blank line → spacing
    if (line.trim() === "") {
      nodes.push(<div key={`sp-${i}`} className="h-2" />)
      i++
      continue
    }

    // Paragraph
    nodes.push(
      <p key={`p-${i}`} className="my-2 leading-relaxed">
        {renderInline(line)}
      </p>
    )
    i++
  }

  return <div>{nodes}</div>
}

export default function MessageBubble({
  role,
  time,
  children,
  dark,
  refs,
}:{
  role: "user" | "assistant" | "system"
  time?: string | null
  children: React.ReactNode
  dark: boolean
  refs?: TimeRef[]
}) {
  const isUser = role === "user"
  const isSystem = role === "system"

  const container = `flex ${isUser ? "justify-end" : "justify-start"} mb-3`
  const bubbleBase = "max-w-[80%] rounded-2xl border px-4 py-3 text-sm shadow-sm"

  const bubble = isUser
    ? `${bubbleBase} ${dark ? "bg-white text-black border-white/10" : "bg-neutral-900 text-white border-neutral-800"}`
    : isSystem
      ? `${bubbleBase} ${dark ? "bg-black/30 text-neutral-300 border-white/10 italic" : "bg-neutral-100 text-neutral-700 border-neutral-200 italic"}`
      : `${bubbleBase} ${dark ? "bg-white text-black border-white/10" : "bg-white text-neutral-800 border-neutral-200"}`

  const timeColor = isUser
    ? (dark ? "text-black/60" : "text-white/70")
    : (dark ? "text-neutral-500" : "text-neutral-500")

  const timeText = formatTimeIso(time || undefined)

  const toLabel = (r: TimeRef) => {
    if (r.startClock && r.endClock) return `${r.startClock}–${r.endClock}`
    return r.startClock || r.endClock || ""
  }

  const content =
    typeof children === "string"
      ? <RenderSimpleMarkdown text={children} />
      : children

  const primary = (refs && refs.length > 0) ? refs[0] : undefined
  const hasMeta = !!(primary?.sectionName || primary?.lessonId || primary?.startClock || primary?.endClock)

  return (
    <div className={container}>
      <div className={bubble}>
        {content}

        {role === "assistant" && hasMeta ? (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-[12px] ${
              dark ? "border-black/20 bg-black/10 text-black" : "border-neutral-200 bg-neutral-50 text-black"
            }`}
          >
            <span className="font-semibold">Section:</span> {primary?.sectionName || "—"}
            <span className="font-semibold ml-3">Lesson:</span> {primary?.lessonId || "—"}
            <span className="font-semibold ml-3">timestamps:</span>{" "}
            {primary?.startClock || primary?.endClock
              ? `[${primary?.startClock || ""}${primary?.endClock ? `–${primary?.endClock}` : ""}]`
              : "—"}
          </div>
        ) : null}

        {role === "assistant" && refs && refs.length > 0 ? (
          <div className="mt-2">
            <div className={`mb-1 text-[11px] ${dark ? "text-neutral-500" : "text-neutral-500"}`}>
              ⏱ Jump to:
            </div>
            <div className="flex flex-wrap gap-2">
              {refs.map((r, i) => {
                const label = toLabel(r)
                if (!label) return null
                return (
                  <span
                    key={`${label}-${i}`}
                    className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] border ${
                      dark ? "border-black/20 bg-black/10" : "border-neutral-200 bg-neutral-100"
                    }`}
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        ) : null}

        {timeText ? (
          <div className={`mt-1 text-[10px] ${timeColor}`} suppressHydrationWarning>
            {timeText}
          </div>
        ) : null}
      </div>
    </div>
  )
}