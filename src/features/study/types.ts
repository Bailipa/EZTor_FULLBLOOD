import type { ReadingSkill, StudyLevel } from './domain'
import type { scoreEvidence } from './scoreEvidence'

export type GoalView = { level: StudyLevel; examDate: string; targetScore: number; revision: number }
export type QuestionFeedback = {
  questionIndex: number; prompt: string; choices: string[]; choice: number; answerIndex: number
  correct: boolean; skill: ReadingSkill; explanation: string; evidence: { index: number; text: string }[]; reason: string
}
export type LookupView = { word: string; lemma: string; meaning: string; source: 'CURATED' | 'PUBLIC' | 'AI'; wordId: string; groupId: string; sentenceIndex: number; tokenIndex: number }
export type StudyWork = { kind: 'TRANSLATION' | 'WRITING'; text: string; revision: string; submitted: boolean; wordCount: number; savedAt: string }
export type SessionView = {
  id: string; status: 'READING' | 'QUESTIONS' | 'COMPLETE'; sentenceIndex: number; questionIndex: number
  activeMs: number; assisted: boolean; startedAt: string; completedAt: string | null; goal: GoalView
  passage: { title: string; level: StudyLevel; kind: string; sourceName: string; sourceUrl: string | null; version: number; sentenceCount: number }
  sentences: { text: string; paragraph: number }[]
  question: { index: number; prompt: string; choices: string[] } | null
  feedback: QuestionFeedback[]; lookups: LookupView[]; bookmarks: number[]
  practice: { translation: { source: string; reference: string; notes: string }; writing: { prompt: string; minimumWords: number; maximumWords: number; rubric: string } } | null
  works: { TRANSLATION?: StudyWork; WRITING?: StudyWork }
}
export type StudyHomeData = {
  goal: GoalView | null; session: SessionView | null; todayCompleted: number; daysLeft: number | null
  contentReady: boolean; reading: { completed: number; answered: number; correct: number; assistedSessions: number }
  assessment: ReturnType<typeof scoreEvidence> | null
}
export type StudyArchivePage = {
  items: { id: string; status: string; startedAt: string; completedAt: string | null; activeMs: number; assisted: boolean; sentenceIndex: number; goal: GoalView; answered: number; correct: number; passage: { title: string; level: string; kind: string } }[]
  nextCursor: string | null
}
