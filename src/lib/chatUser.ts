import type { User } from '@prisma/client'

const EMOJIS = ['🌟', '🎯', '🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐮',
                '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦']

export function isDeveloper(user: { username: string }): boolean {
  return user.username === 'lhy'
}

export function getDisplayName(user: { id: string; username: string }): string {
  if (isDeveloper(user)) return 'EZTor开发者'
  return `EZTor用户 ${getRandomEmoji(user.id)}`
}

export function getAvatar(user: { username: string }): string | null {
  if (isDeveloper(user)) return 'E'
  return null
}

function getRandomEmoji(userId: string): string {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return EMOJIS[hash % EMOJIS.length]
}
