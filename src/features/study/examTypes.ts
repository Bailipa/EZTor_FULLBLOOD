import type { StudyLevel } from './domain'
export type ExamStage = 'WRITING' | 'LISTENING' | 'READING' | 'TRANSLATION'
export type ExamPaperKind = 'FULL' | 'LISTENING'
export type ExamMode = ExamPaperKind | 'READING' | 'TRANSLATION' | 'WRITING'
export const EXAM_MODE_LABELS: Record<ExamMode, string> = { FULL: '整卷模拟', LISTENING: '听力练习', READING: '阅读练习', TRANSLATION: '翻译练习', WRITING: '写作练习' }
export type ExamQuestionType =
  | 'NEWS'
  | 'CONVERSATION'
  | 'PASSAGE'
  | 'LECTURE'
  | 'WORD_BANK'
  | 'MATCHING'
  | 'DETAIL'
export type ExamQuestion = {
  id: string
  type: ExamQuestionType
  prompt: string
  choices: string[]
  answerIndex: number
  answerUnavailableReason?: string
  explanation: string
  weight: number
  passageId?: string
  audioId?: string
}
export type ExamAudio = {
  id: string
  url: string
  sourceUrl: string
  durationSeconds: number
  transcript: string
  identity: string
}
export type ExamSection = {
  instructions: string
  questions: ExamQuestion[]
  passages: { id: string; text: string }[]
  audio: ExamAudio[]
  prompt?: string
  promptImageUrl?: string
  reference?: string
  minimumWords?: number
  maximumWords?: number
  wordBankUnavailableReason?: string
  matchingUnavailableReason?: string
  unavailableReason?: string
  audioUnavailableReason?: string
  sourceFileUrl?: string
  sourceNotice?: string
}
export type ExamContent = {
  LISTENING: ExamSection
  WRITING?: ExamSection
  READING?: ExamSection
  TRANSLATION?: ExamSection
}
export type ExamDraft = { answers: Record<string, number>; text: string }
export type ReadingMark = { passageId: string; start: number; end: number; text: string }
export type ExamSubmission = ExamDraft & {
  submittedAt: string
  expired: boolean
  elapsedMs: number
}
export type ListeningReuseState = {
  sourcePaperId: string; sourcePaperTitle: string; sourceHash: string; section: ExamSection
  status: 'PENDING' | 'NEW' | 'REDO' | 'REUSE'; sourceAttemptId?: string; inheritedElapsedMs?: number; inheritedTimingSource?: 'MANUAL' | 'STAGE'
}
export type ExamState = {
  listeningReuse?: ListeningReuseState
  drafts: Partial<Record<ExamStage, ExamDraft>>
  submissions: Partial<Record<ExamStage, ExamSubmission>>
  firstAnswers: Record<string, { choice: number; at: string }>
  audioPlays: Record<string, number>
  readingMarks?: ReadingMark[]
  readingHighlights?: ReadingMark[]
}
export type ExamPaperMetadata = {
  id: string
  slug: string
  version: number
  title: string
  level: StudyLevel
  kind: ExamPaperKind
  originType: 'PAST_EXAM' | 'OFFICIAL_SAMPLE' | 'ORIGINAL'
  sourceName: string
  sourceUrl: string | null
  contentHash: string
}
export type ExamSubjectiveSubmission = {
  kind: 'WRITING' | 'TRANSLATION'
  text: string
  revision: string
  rubric: string
  prompt: string
  reference: string
  minimumWords?: number
  maximumWords?: number
  submittedAt: string
  expired: boolean
}
export type ExamPracticeTiming = { version: 1; modules: Record<ExamStage, number>; totalMs: number; tracked: boolean }
export type ExamSessionView = {
  listeningReuse?: Omit<ListeningReuseState, 'section' | 'sourceHash' | 'sourcePaperId'> & { notice: string }
  practiceTiming?: ExamPracticeTiming | null
  id: string
  revision: number
  mode: ExamMode
  status: ExamStage | 'COMPLETE'
  paper: ExamPaperMetadata
  stageStartedAt: string
  deadlineAt: string | null
  serverNow: string
  startedAt: string
  completedAt: string | null
  assisted: boolean
  replayCount: number
  drafts: ExamState['drafts']
  readingMarks?: ReadingMark[]
  readingHighlights?: ReadingMark[]
  readingContent?: NonNullable<ExamSessionView['stageContent']>
  stageContent:
    | (Omit<ExamSection, 'questions' | 'audio' | 'reference'> & {
        questions: Omit<ExamQuestion, 'answerIndex' | 'explanation'>[]
        audio: Omit<ExamAudio, 'transcript' | 'identity'>[]
      })
    | null
  result: {
    objective: {
      earnedWeight: number
      totalWeight: number
      correct: number
      total: number
      firstCorrect: number
      firstAnswered: number
      ungraded: number
      limitations?: string[]
    }
    subjectiveSubmissions: ExamSubjectiveSubmission[]
    feedback: {
      questionId: string
      choice: number | null
      answerIndex: number
      explanation: string
    }[]
    transcripts: { id: string; transcript: string }[]
    referenceTranslation: string | null
  } | null
}
export type ExamAction =
  | { clientId: string; revision: number; stage: 'LISTENING'; type: 'LISTENING_REUSE'; choice: 'REDO' | 'REUSE' }
  | {
      clientId: string
      revision: number
      stage: ExamStage
      type: 'DRAFT' | 'SUBMIT_STAGE'
      answers?: Record<string, number>
      text?: string
    }
  | { clientId: string; revision: number; stage: 'LISTENING'; type: 'AUDIO_PLAY'; audioId: string }
  | { clientId: string; revision: number; stage: 'READING'; type: 'READING_MARK'; mark: ReadingMark; marked: boolean }
  | { clientId: string; revision: number; stage: 'READING'; type: 'READING_HIGHLIGHT'; mark: ReadingMark; marked: boolean }
  | { clientId: string; revision: number; stage: 'READING'; type: 'READING_HELP'; mark: ReadingMark }
