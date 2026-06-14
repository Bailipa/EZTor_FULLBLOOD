import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type CascadeFields = {
  word: string
  phonetic?: string | null
  pos?: string | null
  translation: string
  example?: string | null
  exampleTranslation?: string | null
}

function normalizeWord(word: string): string {
  return word.toLowerCase().trim()
}

export async function cascadePublicWordToPrivate(fields: CascadeFields): Promise<void> {
  const word = normalizeWord(fields.word)
  const publicWord = await prisma.publicWord.findUnique({
    where: { word },
  })

  if (!publicWord) return

  // Mirror mode:
  // - Link Word.publicWordId so reads can join PublicWord.
  // - Always NULL out content fields — they are resolved at read time via JOIN.
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "Word"
      SET
        "publicWordId" = ${publicWord.id},
        phonetic = NULL,
        pos = NULL,
        translation = NULL,
        example = NULL,
        "exampleTranslation" = NULL
      WHERE lower(word) = ${word}
    `,
  )
}
