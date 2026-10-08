import { SKILL_LABELS, type StudyAction, type StudyAnswer } from './domain'
import type { LookupView, StudyWork } from './types'

export function studyEventDescription(event: { type: string; data: unknown }) {
  const { input, output } = event.data as {
    input: Partial<StudyAction>
    output?: { lookup?: LookupView; answer?: StudyAnswer; work?: StudyWork }
  }
  switch (event.type) {
    case 'START': return '开始或继续阅读'
    case 'PAUSE': return '暂停阅读，保存有效用时'
    case 'UNDERSTOOD': return 'sentenceIndex' in input ? `读懂第 ${Number(input.sentenceIndex) + 1} 句` : '读懂句子'
    case 'BOOKMARK': {
      const label = 'bookmarked' in input && input.bookmarked === false ? '取消收藏' : '收藏'
      return 'sentenceIndex' in input ? `${label}第 ${Number(input.sentenceIndex) + 1} 句` : `${label}句子`
    }
    case 'LOOKUP': return output?.lookup ? `查词 ${output.lookup.word} · ${output.lookup.meaning}` : '查阅语境词义'
    case 'ANSWER': {
      const answer = output?.answer
      return answer ? `选择 ${'ABCD'[answer.choice]} · ${answer.correct ? '答对' : '答错'} · ${SKILL_LABELS[answer.skill]}` : '提交阅读答案'
    }
    case 'WORK_DRAFT':
    case 'WORK_SUBMIT': {
      const work = output?.work
      return `${work?.kind === 'WRITING' ? '写作' : '翻译'}${event.type === 'WORK_SUBMIT' ? '提交' : '草稿保存'}${work ? ` · ${work.wordCount} 词` : ''}`
    }
    case 'AI_GRADE': return '请求 AI 学习评分'
    default: return event.type
  }
}
