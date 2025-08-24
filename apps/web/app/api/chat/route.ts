import { NextRequest, NextResponse } from 'next/server'
import { answerFromDocs } from '@/app/lib/rag'

export async function POST(req: NextRequest) {
  try {
    const { query, topK, courseId } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ success: false, error: 'query is required (string)' }, { status: 400 })
    }
    const result = await answerFromDocs(query, { topK, courseId })
    return NextResponse.json({
      success: true,
      answer: result.answer,
      references: result.references,
    })
  } catch (e: any) {
    console.error('Chat route error:', e)
    return NextResponse.json(
      { success: false, error: e?.message || 'failed' },
      { status: 500 }
    )
  }
}