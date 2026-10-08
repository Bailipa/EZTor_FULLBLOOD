import type { PassageInput } from '@/features/study/domain'

// Original test material. This fixture is neither a CET paper nor a production content seed.
export function studyFixture(slug = 'original-test'): PassageInput {
  return {
    slug, version: 1, level: 'CET4', kind: 'ORIGINAL', title: '原创测试材料：社区图书馆',
    sourceName: '项目回归测试原创', sourceUrl: null, rightsHolder: 'EZTor项目', rightsEvidence: '仅用于隔离测试数据库，非真题，不进入生产内容库。',
    content: {
      sentences: [
        { text: 'A library can share books with a community.', paragraph: 0, glossary: { library: { lemma: 'library', meaning: '图书馆' }, books: { lemma: 'book', meaning: '图书' } } },
        { text: 'Visitors also learn from one another.', paragraph: 0, glossary: { visitors: { lemma: 'visitor', meaning: '来访者' } } },
        { text: 'The building therefore supports more than reading.', paragraph: 1, translation: '因此，这座建筑的作用不止是阅读。', glossary: {} },
      ],
      questions: Array.from({ length: 5 }, (_, i) => ({ id: `q${i + 1}`, prompt: `Original regression question ${i + 1}`, choices: ['A community resource', 'A shopping centre', 'An empty building', 'A private club'], answerIndex: 0,
        skill: (['DETAIL', 'INFERENCE', 'MAIN_IDEA', 'VOCABULARY', 'PURPOSE'] as const)[i], explanation: '原文提到借阅图书和相互学习，说明图书馆服务社区。', evidence: [0, 1],
        distractorReasons: ['原文明确支持这个选项。', '原文未提到购物，属于无依据推断。', '有访客使用，不是空建筑。', '原文面向社区，不是私人俱乐部。'],
      })),
      translationTask: { source: '社区图书馆提供了学习的地方。', reference: 'Community libraries provide places to learn.', notes: '注意主谓一致和不定式表达。' },
      writingTask: { prompt: 'Write about how a shared space can help students learn.', minimumWords: 120, maximumWords: 180, rubric: '说明观点，提供具体例子，注意连贯性与语法。' },
    },
  }
}
