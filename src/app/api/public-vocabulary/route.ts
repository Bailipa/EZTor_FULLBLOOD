import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const publicWordSelect = {
  word: true,
  phonetic: true,
  pos: true,
  translation: true,
  example: true,
  exampleTranslation: true,
}

function csvCell(value: string | null): string {
  const text = value ?? ''
  const safeText = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = (searchParams.get('q') || '').trim().slice(0, 100)
  const where = query
    ? {
        OR: [
          { word: { contains: query, mode: 'insensitive' as const } },
          { translation: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  try {
    if (searchParams.get('format') === 'csv') {
      const words = await prisma.publicWord.findMany({
        where,
        select: publicWordSelect,
        orderBy: { word: 'asc' },
      })
      const rows = [
        ['单词', '音标', '词性', '释义', '例句', '例句翻译'].map(csvCell).join(','),
        ...words.map((word) =>
          [
            word.word,
            word.phonetic,
            word.pos,
            word.translation,
            word.example,
            word.exampleTranslation,
          ]
            .map(csvCell)
            .join(','),
        ),
      ]

      return new Response(`\uFEFF${rows.join('\r\n')}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="EZTor-public-vocabulary.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }

    const rawPage = Number.parseInt(searchParams.get('page') || '1', 10)
    const rawLimit = Number.parseInt(searchParams.get('limit') || '50', 10)
    const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50
    const [words, total] = await Promise.all([
      prisma.publicWord.findMany({
        where,
        select: publicWordSelect,
        orderBy: { word: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.publicWord.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: words,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    logger.error({ err: error }, 'Public vocabulary request failed')
    return NextResponse.json({ success: false, error: '公共词库暂时无法加载' }, { status: 500 })
  }
}
