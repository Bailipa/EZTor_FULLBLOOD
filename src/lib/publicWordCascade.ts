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
  // - If the private row looks like an unmodified copy (blank or equal), NULL it out to save space.
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "Word"
      SET
        "publicWordId" = ${publicWord.id},
        phonetic = CASE
          WHEN phonetic IS NULL OR TRIM(phonetic) = '' OR phonetic = ${fields.phonetic ?? null} THEN NULL
          ELSE phonetic
        END,
        pos = CASE
          WHEN pos IS NULL OR TRIM(pos) = '' OR pos = ${fields.pos ?? null} THEN NULL
          ELSE pos
        END,
        translation = CASE
          WHEN translation IS NULL OR TRIM(translation) = '' OR translation = ${fields.translation} THEN NULL
          ELSE translation
        END,
        example = CASE
          WHEN example IS NULL OR TRIM(example) = '' OR example = ${fields.example ?? null} THEN NULL
          ELSE example
        END,
        "exampleTranslation" = CASE
          WHEN "exampleTranslation" IS NULL OR TRIM("exampleTranslation") = '' OR "exampleTranslation" = ${fields.exampleTranslation ?? null} THEN NULL
          ELSE "exampleTranslation"
        END
      WHERE lower(word) = ${word}
    `,
  )
}
