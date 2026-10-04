import type { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export type ContributionSource =
  | 'USER_AI'
  | 'USER_UPLOAD'
  | 'ADMIN_MANUAL'
  | 'SHARE_IMPORT'
  | 'MIGRATION'
  | 'SYSTEM_REPAIR'
  | 'LEGACY_UNKNOWN'

export function normalizeContributionWord(word: string): string {
  return word.normalize('NFKC').trim().toLowerCase()
}

export async function recordPublicWordCreation(
  tx: Prisma.TransactionClient,
  input: {
    word: string
    publicWordId: string
    contributorUserId?: string | null
    source: ContributionSource
  },
): Promise<boolean> {
  const normalizedWordKey = normalizeContributionWord(input.word)
  if (!normalizedWordKey) return false

  // The unique normalized key makes the winner atomic under concurrent inserts. Existing
  // legacy placeholders keep the key claimed when a public word is deleted/recreated.
  const inserted = await tx.contributionLedger.createMany({
    data: [{
      id: randomUUID(),
      normalizedWordKey,
      publicWordId: input.publicWordId,
      contributorUserId: input.contributorUserId || null,
      source: input.source,
      status: 'VALID',
      occurredAt: new Date(),
      updatedAt: new Date(),
    }],
    skipDuplicates: true,
  })
  return inserted.count > 0
}

export function getContributionT0(): Date | null {
  const configured = process.env.CONTRIBUTION_T0
  if (!configured) return null
  const date = new Date(configured)
  return Number.isNaN(date.getTime()) ? null : date
}
