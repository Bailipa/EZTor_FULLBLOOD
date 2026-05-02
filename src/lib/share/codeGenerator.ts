import { randomBytes } from 'crypto'
import prisma from '../prisma'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SEGMENT_LENGTH = 3
const SEGMENTS = 3

export function generateShareCode(): string {
  const randomBytesBuffer = randomBytes(SEGMENT_LENGTH * SEGMENTS)

  const code = Array(SEGMENTS)
    .fill(null)
    .map((_, segmentIndex) => {
      return Array(SEGMENT_LENGTH)
        .fill(null)
        .map((_, charIndex) => {
          const byteIndex = segmentIndex * SEGMENT_LENGTH + charIndex
          const charCode = randomBytesBuffer[byteIndex] % CHARS.length
          return CHARS.charAt(charCode)
        })
        .join('')
    })
    .join('-')

  return code
}

export function isValidShareCode(code: string): boolean {
  const regex = /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/
  return regex.test(code)
}

export async function generateUniqueCode(): Promise<string> {
  let retries = 0
  const maxRetries = 3

  while (retries < maxRetries) {
    const code = generateShareCode()

    const existing = await prisma.sharedVocabulary.findUnique({
      where: { code },
    })

    if (!existing) {
      return code
    }

    retries++
  }

  throw new Error('Failed to generate unique code after multiple attempts')
}
