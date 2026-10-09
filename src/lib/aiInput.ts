export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export function parseChatMessages(value: unknown, maxLength = 2000): ChatMessage[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 20) return null
  let length = 0
  for (const item of value) {
    if (!item || typeof item !== 'object' || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim() || item.content.length > maxLength) return null
    length += item.content.length
    if (length > 20_000) return null
  }
  if (value[value.length - 1].role !== 'user') return null
  return value.map(({ role, content }) => ({ role, content })) as ChatMessage[]
}
