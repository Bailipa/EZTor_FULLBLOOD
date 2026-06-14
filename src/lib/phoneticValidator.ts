import { logger } from '@/lib/logger'

let dict: Map<string, string[]> | null = null

function getDict(): Map<string, string[]> {
  if (dict) return dict
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('ipa-dict/lib/en_US')
    dict = mod.default || mod
    logger.info('[PhoneticValidator] IPA dictionary loaded')
    return dict!
  } catch (err) {
    logger.warn({ err }, '[PhoneticValidator] Failed to load IPA dictionary')
    dict = new Map()
    return dict
  }
}

/**
 * Validate and correct LLM-generated phonetic using IPA dictionary.
 * Returns the dictionary pronunciation if the word is found,
 * otherwise returns the original LLM phonetic.
 */
export function validatePhonetic(word: string, llmPhonetic: string): string {
  if (!llmPhonetic) return llmPhonetic

  const normalized = word.toLowerCase().trim()
  const d = getDict()
  const entries = d.get(normalized)

  if (!entries || entries.length === 0) {
    return llmPhonetic
  }

  // Dictionary entry found — use the first pronunciation
  const dictPhonetic = entries[0].trim()

  // If dictionary phonetic is empty for some reason, fall back to LLM
  if (!dictPhonetic) return llmPhonetic

  return dictPhonetic
}

/**
 * Look up IPA pronunciation for a word from the dictionary.
 * Returns the IPA string (e.g., "/ˌædvɝˈtaɪzmənt/") or null if not found.
 */
export function getIPA(word: string): string | null {
  const normalized = word.toLowerCase().trim()
  const d = getDict()
  const entries = d.get(normalized)
  if (!entries || entries.length === 0) return null
  const ipa = entries[0].trim()
  return ipa || null
}
