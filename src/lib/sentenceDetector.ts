export function isSentence(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  const words = trimmed.split(/\s+/)
  const wordCount = words.length
  const hasPunctuation = /[.!?]/.test(trimmed)
  const isLong = trimmed.length > 50

  if (isLong) return true

  if (hasPunctuation && wordCount > 2) return true

  if (wordCount >= 5) return true

  if (wordCount >= 3) {
    const rawFirst = words[0].toLowerCase().replace(/[^a-z']/g, '')
    const firstWord = rawFirst.split("'")[0]

    const sentenceStarters = [
      'what',
      'how',
      'why',
      'when',
      'where',
      'who',
      'which',
      'is',
      'are',
      'was',
      'were',
      'do',
      'does',
      'did',
      'can',
      'could',
      'would',
      'should',
      'will',
      'shall',
      'have',
      'has',
      'had',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
    ]

    if (sentenceStarters.includes(firstWord)) {
      return true
    }
  }

  return false
}
