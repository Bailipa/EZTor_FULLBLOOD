import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type CascadeFields = {
  word: string;
  phonetic?: string | null;
  pos?: string | null;
  translation: string;
  example?: string | null;
  exampleTranslation?: string | null;
};

function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

export async function cascadePublicWordToPrivate(fields: CascadeFields): Promise<void> {
  const word = normalizeWord(fields.word);
  const updatedAt = new Date();

  // Use case-insensitive match to cover historical mixed-case private entries.
  // Only update definition fields; keep per-user stats intact.
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE Word
      SET
        phonetic = ${fields.phonetic ?? null},
        pos = ${fields.pos ?? null},
        translation = ${fields.translation},
        example = ${fields.example ?? null},
        exampleTranslation = ${fields.exampleTranslation ?? null},
        updatedAt = ${updatedAt}
      WHERE lower(word) = ${word}
    `
  );
}

