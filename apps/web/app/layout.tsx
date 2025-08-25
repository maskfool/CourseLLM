// app/layout.tsx
import "./globals.css"
import type { ReactNode } from "react"

export const metadata = {
  title: "DocChat",
  description: "Chat with your documents",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}