import React from "react"

// returns [{ type: 'code', lang, content }] or [{ type: 'text', content }]
export function splitFencedCode(text: string) {
  const parts: Array<{type:"code"|"text"; lang?:string; content:string}> = []
  const fence = /```(\w+)?\n([\s\S]*?)```/g
  let last = 0, m: RegExpExecArray | null
  while ((m = fence.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) })
    parts.push({ type: "code", lang: (m[1] || "").trim(), content: m[2].replace(/\n$/, "") })
    last = fence.lastIndex
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) })
  return parts
}

// render inline `code` inside text -> JSX nodes
export function renderInlineCode(str: string) {
  const segs: React.ReactNode[] = []
  const re = /`([^`]+)`/g
  let last = 0, m: RegExpExecArray | null, key = 0
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) segs.push(<span key={key++}>{str.slice(last, m.index)}</span>)
    segs.push(
      <code
        key={key++}
        className="rounded-md bg-neutral-100 px-1 py-[2px] font-mono text-[0.85em] border"
      >
        {m[1]}
      </code>
    )
    last = re.lastIndex
  }
  if (last < str.length) segs.push(<span key={key++}>{str.slice(last)}</span>)
  return segs
}