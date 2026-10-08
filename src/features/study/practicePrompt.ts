import type { SessionView } from './types'

// The existing AI question endpoint accepts at most 2,000 characters.
export function practicePrompt(session: SessionView, kind: 'translation' | 'writing'): string {
  if (!session.practice) throw new Error('阅读题尚未完成')
  const work = session.works[kind === 'translation' ? 'TRANSLATION' : 'WRITING']
  const task = kind === 'translation' ? session.practice.translation.source : session.practice.writing.prompt
  const text = work?.text || '我还没有完成，请先引导我分析题目。'
  const clipped = task.length > 500 || text.length > 1200
  return `请按大学英语${session.passage.level === 'CET4' ? '四' : '六'}级备考要求分析我的${kind === 'translation' ? '译文' : '短文'}，指出具体问题并解释修改理由；不要把练习评分当作官方成绩。${clipped ? '以下为题目或作品节选，仅分析可见内容。' : ''}\n题目：${task.slice(0, 500)}\n我的内容：${text.slice(0, 1200)}`
}
