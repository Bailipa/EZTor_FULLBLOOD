import { NextRequest, NextResponse } from 'next/server'
import { getProviderCandidates, withLlmFailover } from '@/lib/llmPool'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, temperature, max_tokens } = body

    const candidates = await getProviderCandidates()
    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No available providers' }, { status: 503 })
    }

    const result = await withLlmFailover(
      candidates,
      async (client, model, _sel) => {
        const completion = await client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens,
        })
        return completion
      },
      1, // Quota consumption
    )

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        error: 'LLM request failed',
        ...(process.env.NODE_ENV !== 'production' ? { details: message } : {}),
      },
      { status: 500 },
    )
  }
}
