import type { ReadingMark, ExamSessionView } from './examTypes'
export type ReadingMarkItem = ReadingMark & {
  attemptId: string
  paperTitle: string
  paperLevel: string
  source: string
}
export type ReadingMarkPage = { items: ReadingMarkItem[]; nextCursor: string | null }
export type ReadingMarkSource = ReadingMarkItem & {
  session: ExamSessionView
  readingContent: NonNullable<ExamSessionView['stageContent']>
  questionId: string | null
}
