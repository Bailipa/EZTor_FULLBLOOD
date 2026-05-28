import { Profanity } from '@2toad/profanity'
import prisma from './prisma'

const profanity = new Profanity({
  languages: ['zh', 'en'],
  wholeWord: false,
})

let isLoaded = false

export async function loadCustomProfanity() {
  if (isLoaded) return
  
  try {
    const words = await prisma.customProfanity.findMany()
    const customWords = words.map(w => w.word)
    if (customWords.length > 0) {
      profanity.addWords(customWords)
    }
    isLoaded = true
  } catch (error) {
    console.error('Failed to load custom profanity words:', error)
  }
}

export function containsProfanity(text: string): boolean {
  return profanity.exists(text)
}

export function filterProfanity(text: string): string {
  return profanity.censor(text)
}

export function addProfanityWord(word: string) {
  profanity.addWords([word])
}

export function removeProfanityWord(word: string) {
  profanity.removeWords([word])
}
