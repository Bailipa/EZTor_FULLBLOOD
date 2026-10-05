import { logger } from '@/lib/logger'
import { createRequire } from 'node:module'
import { join } from 'node:path'

let dict: Map<string, string[]> | null = null

function getDict(): Map<string, string[]> {
  if (dict) return dict
  try {
    // ipa-dict 1.0.3's legacy exports hide this file. Load it in Node at runtime
    // so the 4.48 MB UMD dictionary stays outside the bundler's module graph.
    // next.config explicitly traces this file for the translation route.
    const runtimeRequire = createRequire(join(process.cwd(), 'package.json'))
    const mod = runtimeRequire(join(process.cwd(), 'node_modules', 'ipa-dict', 'lib', 'en_US.js'))
    dict = mod.default || mod
    logger.info('[PhoneticValidator] IPA dictionary loaded')
    return dict!
  } catch (err) {
    logger.warn({ err }, '[PhoneticValidator] Failed to load IPA dictionary')
    dict = new Map()
    return dict
  }
}

function getDictionaryKey(word: string): string {
  const trimmed = word.trim()
  // Lowercase entries can mean a different word (US versus us). Preserve
  // unknown all-caps abbreviations rather than guessing their pronunciation.
  return /^[A-Z]{2,}$/.test(trimmed) ? trimmed : trimmed.toLowerCase()
}

/**
 * Validate and correct LLM-generated phonetic using IPA dictionary.
 * Returns the dictionary pronunciation if the word is found,
 * otherwise returns the original LLM phonetic.
 */
export function validatePhonetic(word: string, llmPhonetic: string): string {
  if (!llmPhonetic) return llmPhonetic

  const normalized = getDictionaryKey(word)
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
  const normalized = getDictionaryKey(word)
  const d = getDict()
  const entries = d.get(normalized)
  if (!entries || entries.length === 0) return null
  const ipa = entries[0].trim()
  return ipa || null
}
