export type ChatAvatar =
  | { kind: 'image'; url: string }
  | { kind: 'letter'; value: string }
  | null

const EMOJIS = ['🌟', '🎯', '🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐮',
                '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦',
                '🦋', '🐝', '🐞', '🐢', '🐍', '🦎', '🐙', '🦀', '🐬', '🐳',
                '🌸', '🌺', '🌻', '🌹', '🍀', '🌴', '🌵', '🍄', '⭐', '🌈',
                '🔥', '💧', '❄️', '⚡', '🌙', '☀️', '💎', '🎪', '🎭', '🎨']

export function isDeveloper(user: { username: string; isAdmin?: boolean }): boolean {
  return user.isAdmin === true
}

export function getDisplayName(
  user: { id: string; username: string; isAdmin?: boolean },
  nickname?: string | null,
): string {
  if (isDeveloper(user)) return 'EZTor开发者'
  if (nickname && nickname.trim()) return nickname
  return `EZTor用户 ${getRandomEmoji(user.id)}`
}

export function getAvatar(
  user: { username: string; isAdmin?: boolean },
  picture?: string | null,
): ChatAvatar {
  if (isDeveloper(user)) return { kind: 'letter', value: 'E' }
  if (picture && picture.trim()) return { kind: 'image', url: picture }
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