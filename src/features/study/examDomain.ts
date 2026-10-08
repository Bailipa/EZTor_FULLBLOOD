import { clientId, StudyInputError, type StudyLevel } from './domain'
import type {
  ExamAction,
  ExamContent,
  ExamMode,
  ExamPaperKind,
  ExamQuestion,
  ExamSection,
  ExamStage,
  ExamState,
} from './examTypes'
export const EXAM_STAGES: ExamStage[] = ['WRITING', 'LISTENING', 'READING', 'TRANSLATION']
const fail = (message: string): never => {
  throw new StudyInputError(message)
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail('试卷结构无效')
export const examText = (value: unknown, max = 30000) =>
  typeof value === 'string' && value.trim() && value.length <= max
    ? value.trim()
    : fail('试卷文字缺失或过长')
export const examUrl = (value: unknown) => {
  const text = examText(value, 2000)
  if (/^\/study\/resources\/[a-f0-9]{24}\.(?:pdf|doc|docx|rtf|mp3|m4a|ogg|wav)$/.test(text)) return text
  try {
    const url = new URL(text)
    if (url.protocol === 'https:' && !url.username && !url.password) return text
  } catch {}
  return fail('来源和音频须使用HTTPS地址')
}
export const examAudioUrl = (value: unknown) => {
  if (typeof value === 'string' && /^\/study\/(?:audio\/[a-z0-9][a-z0-9-]*|resources\/[a-f0-9]{24})\.(?:mp3|m4a|ogg|wav)$/.test(value)) return value
  return examUrl(value)
}
export const emptyExamState = (): ExamState => ({
  drafts: {},
  submissions: {},
  firstAnswers: {},
  audioPlays: {},
})
export function examMinutes(level: StudyLevel, stage: ExamStage, audioSeconds = 0) {
  if (stage === 'LISTENING') return Math.max(level === 'CET4' ? 25 : 30, Math.ceil(audioSeconds / 60))
  return stage === 'READING' ? 40 : 30
}
export function examNext(mode: ExamMode, stage: ExamStage): ExamStage | 'COMPLETE' {
  return mode !== 'FULL'
    ? 'COMPLETE'
    : (EXAM_STAGES[EXAM_STAGES.indexOf(stage) + 1] ?? 'COMPLETE')
}
function section(raw: unknown): ExamSection {
  const r = object(raw)
  if (!Array.isArray(r.questions) || !Array.isArray(r.passages) || !Array.isArray(r.audio))
    fail('试卷章节数组缺失')
  const questions = (r.questions as unknown[]).map((v): ExamQuestion => {
    const q = object(v)
    const choices = q.choices
    if (
      !Array.isArray(choices) ||
      choices.length < 4 ||
      choices.length > 26 ||
      (q.answerIndex === -1
        ? typeof q.answerUnavailableReason !== 'string' || !q.answerUnavailableReason.trim()
        : !Number.isInteger(q.answerIndex) || Number(q.answerIndex) < 0 || Number(q.answerIndex) >= choices.length) ||
      !Number.isFinite(q.weight) ||
      Number(q.weight) <= 0
    )
      fail('题目选项、答案或权重无效')
    return {
      id: examText(q.id, 80),
      type: q.type as ExamQuestion['type'],
      prompt: examText(q.prompt),
      choices: (choices as unknown[]).map((x) => examText(x, 3000)),
      answerIndex: Number(q.answerIndex),
      ...(q.answerIndex === -1 ? { answerUnavailableReason: examText(q.answerUnavailableReason, 2000) } : {}),
      explanation: examText(q.explanation),
      weight: Number(q.weight),
      ...(q.passageId ? { passageId: examText(q.passageId, 80) } : {}),
      ...(q.audioId ? { audioId: examText(q.audioId, 80) } : {}),
    }
  })
  if (questions.some((q) => new Set(q.choices).size !== q.choices.length)) fail('题目选项重复')
  const audio = (r.audio as unknown[]).map((v) => {
    const a = object(v)
    if (
      !Number.isFinite(a.durationSeconds) ||
      Number(a.durationSeconds) <= 0 ||
      Number(a.durationSeconds) > 3600
    )
      fail('音频时长无效')
    return {
      id: examText(a.id, 80),
      url: examAudioUrl(a.url),
      sourceUrl: examUrl(a.sourceUrl),
      durationSeconds: Number(a.durationSeconds),
      transcript: a.transcript === '' ? '' : examText(a.transcript, 60000),
      identity: examText(a.identity, 2000),
    }
  })
  const passages = (r.passages as unknown[]).map((v) => {
    const p = object(v)
    return { id: examText(p.id, 80), text: examText(p.text, 60000) }
  })
  for (const list of [questions, audio, passages])
    if (new Set(list.map((x) => x.id)).size !== list.length) fail('章节ID重复')
  for (const q of questions) {
    if (q.audioId && !audio.some((a) => a.id === q.audioId)) fail('题目音频关联缺失')
    if (q.passageId && !passages.some((p) => p.id === q.passageId)) fail('题目篇章关联缺失')
  }
  return {
    instructions: examText(r.instructions),
    questions,
    audio,
    passages,
    ...(r.prompt ? { prompt: examText(r.prompt) } : {}),
    ...(r.promptImageUrl ? { promptImageUrl: typeof r.promptImageUrl === 'string' && /^\/study\/resources\/[a-f0-9]{24}\.png$/.test(r.promptImageUrl) ? r.promptImageUrl : fail('题干图片地址无效') } : {}),
    ...(r.reference ? { reference: examText(r.reference) } : {}),
    ...(r.minimumWords !== undefined ? { minimumWords: Number(r.minimumWords) } : {}),
    ...(r.maximumWords !== undefined ? { maximumWords: Number(r.maximumWords) } : {}),
    ...(r.wordBankUnavailableReason ? { wordBankUnavailableReason: examText(r.wordBankUnavailableReason, 2000) } : {}),
    ...(r.matchingUnavailableReason ? { matchingUnavailableReason: examText(r.matchingUnavailableReason, 2000) } : {}),
    ...(r.unavailableReason ? { unavailableReason: examText(r.unavailableReason, 2000) } : {}),
    ...(r.audioUnavailableReason ? { audioUnavailableReason: examText(r.audioUnavailableReason, 2000) } : {}),
    ...(r.sourceNotice ? { sourceNotice: examText(r.sourceNotice, 2000) } : {}),
    ...(r.sourceFileUrl ? { sourceFileUrl: typeof r.sourceFileUrl === 'string' && /^\/study\/resources\/[a-f0-9]{24}\.(?:pdf|docx?|rtf)$/.test(r.sourceFileUrl) ? r.sourceFileUrl : fail('原卷文件地址无效') } : {}),
  }
}
export function parseExamContent(input: unknown, level: StudyLevel, kind: ExamPaperKind): ExamContent {
  const raw = object(input)
  const listening = section(raw.LISTENING)
  const groups: [ExamQuestion['type'], number, number][] =
    level === 'CET4'
      ? [
          ['NEWS', 7, 1],
          ['CONVERSATION', 8, 1],
          ['PASSAGE', 10, 2],
        ]
      : [
          ['CONVERSATION', 8, 1],
          ['PASSAGE', 7, 1],
          ['LECTURE', 10, 2],
        ]
  const validate = (s: ExamSection, specs: typeof groups) => {
    if (s.unavailableReason && !s.questions.length && !s.audio.length && !s.passages.length) return
    if (s.unavailableReason) fail('缺失章节不能混入题目')
    if (s.questions.length !== specs.reduce((sum, [, count]) => sum + count, 0))
      fail('试卷题数不符合CET结构')
    for (const [type, count, weight] of specs)
      if (
        s.questions.filter((q) => q.type === type).length !== count ||
        s.questions.filter((q) => q.type === type).some((q) => q.weight !== weight)
      )
        fail('题型数量或权重不符合CET结构')
  }
  validate(listening, groups)
  if (
    (!listening.audio.length && !listening.audioUnavailableReason && !listening.unavailableReason) ||
    listening.questions.some((q) => (listening.audio.length > 0 && !q.audioId) || q.choices.length !== 4) ||
    listening.passages.length
  )
    fail('听力须关联原始音频')
  if (
    listening.audio.reduce((sum, a) => sum + a.durationSeconds, 0) >
    examMinutes(level, 'LISTENING') * 60 + 120
  )
    fail('听力音频超过考试时长')
  if (kind === 'LISTENING') {
    if (Object.keys(raw).some((k) => k !== 'LISTENING')) fail('听力模块不能混入其他章节')
    return { LISTENING: listening }
  }
  const writing = section(raw.WRITING),
    reading = section(raw.READING),
    translation = section(raw.TRANSLATION)
  validate(reading, [
    ...(reading.wordBankUnavailableReason ? [] : [['WORD_BANK', 10, 0.5] as [ExamQuestion['type'], number, number]]),
    ...(reading.matchingUnavailableReason ? [] : [['MATCHING', 10, 1] as [ExamQuestion['type'], number, number]]),
    ['DETAIL', 10, 2],
  ])
  if (reading.questions.some((q) => !q.passageId) || reading.audio.length) fail('阅读须关联篇章')
  for (const q of reading.questions)
    if (
      (q.type === 'WORD_BANK' && q.choices.length !== 15) ||
      (q.type === 'DETAIL' && q.choices.length !== 4)
    )
      fail('阅读选项数量不符合题型')
  const groupPassages = (type: ExamQuestion['type']) =>
    new Set(reading.questions.filter((q) => q.type === type).map((q) => q.passageId)).size
  if (
    !reading.unavailableReason && (groupPassages('WORD_BANK') !== (reading.wordBankUnavailableReason ? 0 : 1) ||
    groupPassages('MATCHING') !== (reading.matchingUnavailableReason ? 0 : 1) ||
    groupPassages('DETAIL') !== 2)
  )
    fail('阅读须包含选词篇章、长篇匹配及两篇仔细阅读')
  for (const s of [writing, translation])
    if (!s.prompt || s.questions.length || s.audio.length || s.passages.length)
      fail('主观题须包含题干')
  const minimum = level === 'CET4' ? 120 : 150,
    maximum = level === 'CET4' ? 180 : 200
  if (writing.minimumWords !== minimum || writing.maximumWords !== maximum)
    fail('写作字数要求不符合CET级别')
  const ids = [...listening.questions, ...reading.questions].map((q) => q.id)
  if (new Set(ids).size !== ids.length) fail('整卷题目ID重复')
  return { WRITING: writing, LISTENING: listening, READING: reading, TRANSLATION: translation }
}
export function parseExamAction(raw: unknown): ExamAction {
  const r = object(raw)
  const id = clientId(r.clientId)
  if (!Number.isInteger(r.revision) || Number(r.revision) < 0) fail('考试版本无效，请刷新')
  const revision = Number(r.revision)
  if (!EXAM_STAGES.includes(r.stage as ExamStage)) fail('考试阶段无效')
  if ((r.type === 'READING_MARK' || r.type === 'READING_HIGHLIGHT' || r.type === 'READING_HELP') && r.stage === 'READING') {
    const mark = object(r.mark)
    if (!Number.isInteger(mark.start) || !Number.isInteger(mark.end) || Number(mark.start) < 0 || Number(mark.end) <= Number(mark.start) || Number(mark.end) > 60000)
      fail('阅读标记位置无效')
    const selection = { passageId: examText(mark.passageId, 80), start: Number(mark.start), end: Number(mark.end), text: examText(mark.text, 2000) }
    if (r.type === 'READING_HELP') return { clientId: id, revision, stage: 'READING', type: r.type, mark: selection }
    if (typeof r.marked !== 'boolean') fail('阅读标记状态无效')
    return { clientId: id, revision, stage: 'READING', type: r.type, mark: selection, marked: r.marked as boolean }
  }
  if (r.type === 'AUDIO_PLAY' && r.stage === 'LISTENING')
    return {
      clientId: id,
      revision,
      type: r.type,
      stage: r.stage,
      audioId: examText(r.audioId, 80),
    }
  if (r.type !== 'DRAFT' && r.type !== 'SUBMIT_STAGE') fail('考试操作无效')
  const result: Extract<ExamAction, { type: 'DRAFT' | 'SUBMIT_STAGE' }> = {
    clientId: id,
    revision,
    type: r.type as 'DRAFT' | 'SUBMIT_STAGE',
    stage: r.stage as ExamStage,
  }
  if (r.answers !== undefined) {
    const answers = object(r.answers)
    if (
      Object.keys(answers).length > 55 ||
      Object.values(answers).some((v) => !Number.isInteger(v) || Number(v) < 0 || Number(v) > 25)
    )
      fail('作答选项无效')
    result.answers = answers as Record<string, number>
  }
  if (r.text !== undefined) {
    if (typeof r.text !== 'string' || r.text.length > 20000) fail('作文过长')
    result.text = r.text as string
  }
  return result
}
