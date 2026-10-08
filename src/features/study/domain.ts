export type StudyLevel = 'CET4' | 'CET6'
export type ReadingSkill = 'DETAIL' | 'INFERENCE' | 'MAIN_IDEA' | 'VOCABULARY' | 'PURPOSE'
export const SKILL_LABELS: Record<ReadingSkill, string> = {
  DETAIL: '细节定位', INFERENCE: '推断判断', MAIN_IDEA: '主旨理解', VOCABULARY: '语境词义', PURPOSE: '作者意图',
}
export type GlossaryEntry = { lemma: string; meaning: string }
export type StudySentence = { text: string; paragraph: number; translation?: string; glossary: Record<string, GlossaryEntry> }
export type StudyQuestion = {
  id: string; prompt: string; choices: string[]; answerIndex: number; skill: ReadingSkill
  explanation: string; evidence: number[]; distractorReasons: string[]
}
export type StudyContent = {
  sentences: StudySentence[]; questions: StudyQuestion[]
  translationTask: { source: string; reference: string; notes: string }
  writingTask: { prompt: string; minimumWords: number; maximumWords: number; rubric: string }
}
export type PassageInput = {
  slug: string; version: number; level: StudyLevel; kind: 'PAST_EXAM' | 'OFFICIAL_SAMPLE' | 'ORIGINAL'; title: string
  sourceName: string; sourceUrl: string | null; rightsHolder: string; rightsEvidence: string; content: StudyContent
}
export type StudyAnswer = { questionId: string; choice: number; correct: boolean; skill: ReadingSkill; activeMs: number }
export class StudyInputError extends Error {
  constructor(message: string, public readonly status = 400) { super(message) }
}
function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StudyInputError(`${name}格式无效`)
  return value as Record<string, unknown>
}
function text(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new StudyInputError(`${name}内容无效`)
  return value.trim()
}
function integer(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new StudyInputError(`${name}范围无效`)
  return value
}
export function studyLevel(value: unknown): StudyLevel {
  if (value !== 'CET4' && value !== 'CET6') throw new StudyInputError('请选择四级或六级')
  return value
}
export function parseGoal(value: unknown, now = new Date()) {
  const body = object(value, '目标')
  const level = studyLevel(body.level)
  const targetScore = integer(body.targetScore, '目标分数', 220, 710)
  const day = text(body.examDate, '考试日期', 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new StudyInputError('考试日期无效')
  const examDate = new Date(`${day}T00:00:00Z`)
  if (!Number.isFinite(examDate.getTime()) || examDate.toISOString().slice(0, 10) !== day) throw new StudyInputError('考试日期无效')
  // The product's study day follows China time, independently of the server timezone.
  const today = new Date(`${chinaDay(now)}T00:00:00Z`)
  if (examDate < today || examDate.getTime() > today.getTime() + 3 * 366 * 86400000) throw new StudyInputError('请选择今天起三年内的考试日期')
  return { level, targetScore, examDate }
}
export function chinaDay(now = new Date()): string { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10) }
export function englishTokens(sentence: string): { text: string; word: string; start: number; end: number }[] {
  return [...sentence.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*/g)].map((match) => ({
    text: match[0], word: match[0].replace(/’/g, "'").toLowerCase(), start: match.index!, end: match.index! + match[0].length,
  }))
}

// These are deliberately conservative, high-frequency CET collocations. They are
// used for the reading lookup affordance only; writing word counts stay word-based.
const LOOKUP_PHRASES = [
  'on the other hand', 'in addition to', 'in order to', 'as a result', 'a number of',
  'play a role in', 'be responsible for', 'be likely to', 'take part in', 'according to',
  'as well as', 'for example', 'in terms of', 'in spite of', 'come up with', 'look forward to',
  'make sure', 'rather than', 'instead of', 'because of', 'due to', 'such as', 'at least',
  'more than', 'able to', 'likely to', 'responsible for', 'point out', 'lead to', 'result in',
  'deal with', 'focus on', 'depend on',
].map((phrase) => phrase.split(' '))

/**
 * Returns the same offset-preserving tokens as englishTokens, with only known
 * adjacent collocations merged into one lookup target. The server uses the
 * same deterministic list, so token indexes remain tamper-resistant.
 */
export function englishLookupTokens(sentence: string): { text: string; word: string; start: number; end: number }[] {
  const words = englishTokens(sentence)
  const result: typeof words = []
  for (let index = 0; index < words.length;) {
    const phrase = LOOKUP_PHRASES.find((candidate) => candidate.every((word, offset) => words[index + offset]?.word === word))
    if (phrase) {
      const last = words[index + phrase.length - 1]
      result.push({ text: sentence.slice(words[index].start, last.end), word: phrase.join(' '), start: words[index].start, end: last.end })
      index += phrase.length
      continue
    }
    result.push(words[index])
    index += 1
  }
  return result
}
export type ScoreRecordInput = { score: number; takenDateISO: string; level: StudyLevel; source: 'MOCK' | 'OFFICIAL'; assisted: boolean; paper: string }
export function parseScoreRecord(value: unknown, now = new Date()): ScoreRecordInput {
  const body = object(value, '整卷成绩')
  const day = text(body.takenDateISO, '考试日期', 10)
  const date = new Date(`${day}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day || day > chinaDay(now) || day < '2000-01-01') throw new StudyInputError('请填写有效的历史考试日期')
  if (body.source !== 'MOCK' && body.source !== 'OFFICIAL') throw new StudyInputError('成绩来源无效')
  if (typeof body.assisted !== 'boolean') throw new StudyInputError('请说明是否使用辅助')
  return { score: integer(body.score, '整卷总分', 0, 710), takenDateISO: day, level: studyLevel(body.level), source: body.source, assisted: body.assisted, paper: text(body.paper, '试卷名称', 120) }
}
export function parseContent(value: unknown): StudyContent {
  const body = object(value, '文章')
  if (!Array.isArray(body.sentences) || body.sentences.length < 1 || body.sentences.length > 200) throw new StudyInputError('文章需要1–200句')
  const rawSentences = body.sentences
  const sentences = rawSentences.map((raw, index) => {
    const item = object(raw, '句子')
    const sentence = text(item.text, '句子', 2000)
    if (!englishTokens(sentence).length) throw new StudyInputError('句子缺少英文内容')
    const paragraph = integer(item.paragraph, '段落序号', 0, 100)
    if (index > 0 && paragraph < Number(object(rawSentences[index - 1], '句子').paragraph)) throw new StudyInputError('段落顺序无效')
    const glossary: Record<string, GlossaryEntry> = {}
    const entries = object(item.glossary ?? {}, '语境词义')
    if (Object.keys(entries).length > 100) throw new StudyInputError('单句词义过多')
    const words = new Set([...englishTokens(sentence), ...englishLookupTokens(sentence)].map((token) => token.word))
    for (const [word, rawEntry] of Object.entries(entries)) {
      if (!words.has(word) || ['__proto__', 'constructor', 'prototype'].includes(word)) throw new StudyInputError('词义必须对应句中单词')
      const entry = object(rawEntry, '词义')
      const lemma = text(entry.lemma, '原形', 80).toLowerCase()
      if (!/^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*)*$/.test(lemma)) throw new StudyInputError('英文原形无效')
      glossary[word] = { lemma, meaning: text(entry.meaning, '语境释义', 500) }
    }
    return { text: sentence, paragraph, glossary, ...(item.translation ? { translation: text(item.translation, '句译', 2000) } : {}) }
  })
  if (!Array.isArray(body.questions) || body.questions.length !== 5) throw new StudyInputError('仔细阅读文章应包含5道题')
  const ids = new Set<string>()
  const questions = body.questions.map((raw) => {
    const item = object(raw, '阅读题')
    const id = text(item.id, '题目编号', 80)
    if (ids.has(id)) throw new StudyInputError('题目编号重复')
    ids.add(id)
    if (!Array.isArray(item.choices) || item.choices.length !== 4) throw new StudyInputError('阅读题应有4个选项')
    const choices = item.choices.map((choice) => text(choice, '选项', 1500))
    if (new Set(choices).size !== 4) throw new StudyInputError('选项不能重复')
    const answerIndex = integer(item.answerIndex, '答案', 0, 3)
    if (typeof item.skill !== 'string' || !Object.hasOwn(SKILL_LABELS, item.skill)) throw new StudyInputError('阅读能力标签无效')
    if (!Array.isArray(item.evidence) || item.evidence.length < 1 || item.evidence.length > sentences.length) throw new StudyInputError('缺少原文证据')
    const evidence = [...new Set(item.evidence.map((idx) => integer(idx, '证据句', 0, sentences.length - 1)))]
    if (!Array.isArray(item.distractorReasons) || item.distractorReasons.length !== 4) throw new StudyInputError('缺少各选项解释')
    return { id, prompt: text(item.prompt, '题干', 2000), choices, answerIndex, skill: item.skill as ReadingSkill,
      explanation: text(item.explanation, '解析', 4000), evidence,
      distractorReasons: item.distractorReasons.map((reason) => text(reason, '选项解释', 2000)),
    }
  })
  const translation = object(body.translationTask, '翻译任务')
  const writing = object(body.writingTask, '写作任务')
  const minimumWords = integer(writing.minimumWords, '最少词数', 80, 300)
  return { sentences, questions,
    translationTask: { source: text(translation.source, '汉译英原文', 4000), reference: text(translation.reference, '翻译参考', 8000), notes: text(translation.notes, '翻译要点', 4000) },
    writingTask: { prompt: text(writing.prompt, '写作题目', 4000), minimumWords, maximumWords: integer(writing.maximumWords, '最多词数', minimumWords, 600), rubric: text(writing.rubric, '写作要求', 4000) },
  }
}
export function parsePassage(value: unknown): PassageInput {
  const body = object(value, '内容包')
  if (JSON.stringify(body).length > 250000) throw new StudyInputError('内容包过大')
  const slug = text(body.slug, '内容标识', 100)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new StudyInputError('内容标识仅支持小写英文、数字和短横线')
  if (!['PAST_EXAM', 'OFFICIAL_SAMPLE', 'ORIGINAL'].includes(String(body.kind))) throw new StudyInputError('内容来源类型无效')
  let sourceUrl: string | null = null
  if (body.sourceUrl != null) {
    sourceUrl = text(body.sourceUrl, '来源链接', 2000)
    let url: URL
    try { url = new URL(sourceUrl) } catch { throw new StudyInputError('来源链接无效') }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new StudyInputError('来源链接无效')
  }
  if (body.kind !== 'ORIGINAL' && !sourceUrl) throw new StudyInputError('真题或官方样题必须记录来源链接')
  return { slug, version: integer(body.version, '内容版本', 1, 10000), level: studyLevel(body.level), kind: body.kind as PassageInput['kind'],
    title: text(body.title, '标题', 200), sourceName: text(body.sourceName, '来源名称', 300), sourceUrl,
    rightsHolder: text(body.rightsHolder, '权利人', 300), rightsEvidence: text(body.rightsEvidence, '许可或授权依据', 5000), content: parseContent(body.content),
  }
}
export type StudyAction =
  | { clientId: string; type: 'UNDERSTOOD'; sentenceIndex: number; activeMs: number }
  | { clientId: string; type: 'ANSWER'; questionIndex: number; choice: number; activeMs: number }
  | { clientId: string; type: 'LOOKUP'; sentenceIndex: number; tokenIndex: number; activeMs: number }
  | { clientId: string; type: 'BOOKMARK'; sentenceIndex: number; bookmarked?: boolean; activeMs: number }
  | { clientId: string; type: 'PAUSE'; activeMs: number }
  | { clientId: string; type: 'WORK_DRAFT' | 'WORK_SUBMIT'; kind: 'TRANSLATION' | 'WRITING'; text: string; revision: string | null; activeMs: number }
export function clientId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) throw new StudyInputError('操作标识无效，请刷新后重试')
  return value
}
export function parseAction(value: unknown): StudyAction {
  const body = object(value, '操作')
  const common = { clientId: clientId(body.clientId), activeMs: integer(body.activeMs, '有效用时', 0, 900000) }
  if (body.type === 'PAUSE') return { ...common, type: 'PAUSE' }
  if (body.type === 'WORK_DRAFT' || body.type === 'WORK_SUBMIT') {
    if (body.kind !== 'TRANSLATION' && body.kind !== 'WRITING') throw new StudyInputError('练习类型无效')
    if (typeof body.text !== 'string' || body.text.length > 12000 || (body.type === 'WORK_SUBMIT' && !body.text.trim())) throw new StudyInputError('请填写不超过12000字的练习内容')
    return { ...common, type: body.type, kind: body.kind, text: body.text, revision: body.revision == null ? null : clientId(body.revision) }
  }
  if (body.type === 'ANSWER') return { ...common, type: 'ANSWER', questionIndex: integer(body.questionIndex, '题目序号', 0, 4), choice: integer(body.choice, '选择答案', 0, 3) }
  const sentenceIndex = integer(body.sentenceIndex, '句子序号', 0, 199)
  if (body.type === 'UNDERSTOOD') return { ...common, type: body.type, sentenceIndex }
  if (body.type === 'BOOKMARK') {
    if (body.bookmarked !== undefined && typeof body.bookmarked !== 'boolean') throw new StudyInputError('收藏状态无效')
    return { ...common, type: body.type, sentenceIndex, ...(body.bookmarked === undefined ? {} : { bookmarked: body.bookmarked }) }
  }
  if (body.type === 'LOOKUP') return { ...common, type: 'LOOKUP', sentenceIndex, tokenIndex: integer(body.tokenIndex, '词语序号', 0, 1000) }
  throw new StudyInputError('未知学习操作')
}
export function nextProgress(state: { status: string; sentenceIndex: number; questionIndex: number }, content: StudyContent, action: StudyAction) {
  if (action.type === 'PAUSE') return {}
  if ('kind' in action) {
    if (state.status !== 'COMPLETE') throw new StudyInputError('请先完成阅读题，再进行拓展练习', 409)
    return {}
  }
  if (action.type === 'UNDERSTOOD') {
    if (state.status !== 'READING' || action.sentenceIndex !== state.sentenceIndex) throw new StudyInputError('阅读进度已变化，请刷新后继续', 409)
    return { sentenceIndex: state.sentenceIndex + 1, status: state.sentenceIndex + 1 === content.sentences.length ? 'QUESTIONS' : 'READING' }
  }
  if (action.type === 'ANSWER') {
    if (state.status !== 'QUESTIONS' || action.questionIndex !== state.questionIndex) throw new StudyInputError('答题进度已变化，请刷新后继续', 409)
    const question = content.questions[state.questionIndex]
    return { questionIndex: state.questionIndex + 1, status: state.questionIndex + 1 === content.questions.length ? 'COMPLETE' : 'QUESTIONS',
      answer: { questionId: question.id, choice: action.choice, correct: action.choice === question.answerIndex, skill: question.skill, activeMs: action.activeMs },
    }
  }
  if (action.sentenceIndex > Math.min(state.sentenceIndex, content.sentences.length - 1) || !content.sentences[action.sentenceIndex]) throw new StudyInputError('请先阅读对应句子')
  if (action.type === 'LOOKUP' && !englishLookupTokens(content.sentences[action.sentenceIndex].text)[action.tokenIndex]) throw new StudyInputError('词语位置无效')
  return {}
}
