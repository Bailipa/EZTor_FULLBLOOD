import type { User } from '@prisma/client'

const EMOJIS = ['🌟', '🎯', '🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐮',
                '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦',
                '🦋', '🐝', '🐞', '🐢', '🐍', '🦎', '🐙', '🦀', '🐬', '🐳',
                '🌸', '🌺', '🌻', '🌹', '🍀', '🌴', '🌵', '🍄', '⭐', '🌈',
                '🔥', '💧', '❄️', '⚡', '🌙', '☀️', '💎', '🎪', '🎭', '🎨']

export function isDeveloper(user: { username: string; isAdmin?: boolean }): boolean {
  return user.isAdmin === true
}

export function getDisplayName(user: { id: string; username: string; isAdmin?: boolean }): string {
  if (isDeveloper(user)) return 'EZTor开发者'
  return `EZTor用户 ${getRandomEmoji(user.id)}`
}

export function getAvatar(user: { username: string; isAdmin?: boolean }): string | null {
  if (isDeveloper(user)) return 'E'
  return null
}

function getRandomEmoji(userId: string): string {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const index1 = hash % EMOJIS.length
  const index2 = Math.floor(hash / EMOJIS.length) % EMOJIS.length

  if (hash >= EMOJIS.length) {
    return EMOJIS[index1] + EMOJIS[index2]
  }
  return EMOJIS[index1]
}
