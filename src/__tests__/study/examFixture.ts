import type { ExamContent, ExamQuestion, ExamSection } from '@/features/study/examTypes'
export function originalExamFixture(level: 'CET4' | 'CET6' = 'CET4') {
  const blank = (): ExamSection => ({
    instructions: 'ORIGINAL isolated test instructions.',
    questions: [],
    audio: [],
    passages: [],
  })
  const listening = blank()
  listening.audio = [
    {
      id: 'audio-original',
      url: 'https://example.org/original.mp3',
      sourceUrl: 'https://example.org/recording-license',
      identity: 'ORIGINAL human recording test identity, not TTS',
      durationSeconds: 120,
      transcript: 'ORIGINAL transcript withheld until completion.',
    },
  ]
  const specs: [ExamQuestion['type'], number, number][] =
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
  for (const [type, count, weight] of specs)
    for (let i = 0; i < count; i++)
      listening.questions.push({
        id: `${type}-${i}`,
        type,
        prompt: `ORIGINAL ${type} item ${i}`,
        choices: ['A', 'B', 'C', 'D'],
        answerIndex: 0,
        explanation: 'ORIGINAL answer explanation.',
        weight,
        audioId: 'audio-original',
      })
  const reading = blank()
  reading.passages = ['bank', 'matching', 'detail-1', 'detail-2'].map((id) => ({
    id,
    text: `ORIGINAL ${id} paragraph content.`,
  }))
  for (const [type, count, weight] of [
    ['WORD_BANK', 10, 0.5],
    ['MATCHING', 10, 1],
    ['DETAIL', 10, 2],
  ] as [ExamQuestion['type'], number, number][])
    for (let i = 0; i < count; i++)
      reading.questions.push({
        id: `${type}-${i}`,
        type,
        prompt: `ORIGINAL ${type} item ${i}`,
        choices: Array.from(
          { length: type === 'WORD_BANK' ? 15 : type === 'MATCHING' ? 10 : 4 },
          (_, i) => `Option ${i}`,
        ),
        answerIndex: 0,
        explanation: 'ORIGINAL answer explanation.',
        weight,
        passageId:
          type === 'WORD_BANK'
            ? 'bank'
            : type === 'MATCHING'
              ? 'matching'
              : i < 5
                ? 'detail-1'
                : 'detail-2',
      })
  const writing = {
    ...blank(),
    prompt: 'ORIGINAL discuss university libraries.',
    reference: 'ORIGINAL reference essay.',
    minimumWords: level === 'CET4' ? 120 : 150,
    maximumWords: level === 'CET4' ? 180 : 200,
  }
  const translation = {
    ...blank(),
    prompt: '原创翻译题：图书馆促进知识共享。',
    reference: 'ORIGINAL Libraries promote knowledge sharing.',
  }
  const content: ExamContent = {
    WRITING: writing,
    LISTENING: listening,
    READING: reading,
    TRANSLATION: translation,
  }
  return {
    slug: 'original-isolated-exam',
    version: 1,
    title: 'ORIGINAL isolated test paper (not a past exam)',
    level,
    kind: 'FULL',
    originType: 'ORIGINAL',
    sourceName: 'ORIGINAL test fixture',
    sourceUrl: 'https://example.org/original-license',
    rightsHolder: 'ORIGINAL test author',
    rightsEvidence: 'ORIGINAL isolated test material, never serve as a real exam or recording.',
    content,
  }
}
