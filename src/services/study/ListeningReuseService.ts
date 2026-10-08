import { createHash, randomInt } from 'node:crypto'
import type { Prisma, ExamPaper } from '@prisma/client'
import { examPaperKey } from './ExamAccessService'
import { parseExamContent } from '@/features/study/examDomain'
import type { StudyLevel } from '@/features/study/domain'
import type { ExamContent, ExamPaperKind, ExamState, ExamSection } from '@/features/study/examTypes'

export function effectiveExamContent(paper: Pick<ExamPaper, 'content' | 'level' | 'kind'>, state: ExamState): ExamContent {
  const content = parseExamContent(paper.content, paper.level as StudyLevel, paper.kind as ExamPaperKind)
  return state.listeningReuse ? { ...content, LISTENING: state.listeningReuse.section } : content
}
export const listeningHash = (section: ExamSection) => createHash('sha256').update(JSON.stringify(section)).digest('hex')
export function validListeningSubmission(state: ExamState, section: ExamSection) {
  const submission = state.submissions.LISTENING
  return !!submission && Number.isFinite(submission.elapsedMs) && submission.elapsedMs >= 0 && section.questions.length === 25 && section.questions.every(question => Number.isInteger(submission.answers[question.id]) && submission.answers[question.id] >= 0 && submission.answers[question.id] < question.choices.length)
}
export function shuffledListening(section: ExamSection): ExamSection {
  return { ...section, questions: section.questions.map(question => {
    const order = question.choices.map((_, index) => index)
    for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]] }
    // Always change the displayed order, even if the random permutation was the identity.
    if (order.every((value, index) => value === index)) order.push(order.shift()!)
    return { ...question, choices: order.map(index => question.choices[index]), answerIndex: order.indexOf(question.answerIndex) }
  }) }
}
export async function prepareListeningReuse(tx: Prisma.TransactionClient, userId: string, paper: ExamPaper, state: ExamState) {
  const content = effectiveExamContent(paper, state)
  const match = /^(cet[46]-\d{4}-\d{2})-set3$/.exec(examPaperKey(paper.slug))
  const explanation = content.LISTENING.unavailableReason ?? ''
  const sourceSet = /与第([一二])套真题的[听力\s]*.*一致/.exec(explanation)?.[1]
  if (!match || !sourceSet || content.LISTENING.questions.length) return
  const sourceKey = `${match[1]}-set${sourceSet === '一' ? 1 : 2}`
  const source = await tx.examPaper.findFirst({ where: { slug: { in: [sourceKey, `${sourceKey}-full`, `${sourceKey}-listening`] }, kind: 'FULL', level: paper.level, rightsStatus: 'APPROVED' }, orderBy: { version: 'desc' } })
  if (!source) return
  const section = effectiveExamContent(source, { drafts: {}, submissions: {}, firstAnswers: {}, audioPlays: {} }).LISTENING
  if (section.unavailableReason || section.audioUnavailableReason || section.questions.length !== 25 || !section.audio.length || section.questions.some(question => !question.audioId || !section.audio.some(audio => audio.id === question.audioId))) return
  const sourceHash = listeningHash(section)
  let priorId: string | undefined, cursor: string | undefined
  while (!priorId) {
    const attempts = await tx.examAttempt.findMany({ where: { userId, paper: { slug: { in: [source.slug, paper.slug] }, rightsStatus: 'APPROVED' }, mode: { in: ['LISTENING', 'FULL'] } }, include: { paper: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 25, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
    priorId = attempts.find(attempt => {
      const attemptState = attempt.state as unknown as ExamState
      const effective = effectiveExamContent(attempt.paper, attemptState).LISTENING
      return (attemptState.listeningReuse?.sourceHash ?? listeningHash(effective)) === sourceHash && validListeningSubmission(attemptState, effective)
    })?.id
    if (attempts.length < 25 || priorId) break
    cursor = attempts[attempts.length - 1].id
  }
  state.listeningReuse = { sourcePaperId: source.id, sourcePaperTitle: source.title, sourceHash, section, status: priorId ? 'PENDING' : 'NEW', ...(priorId ? { sourceAttemptId: priorId } : {}) }
}
