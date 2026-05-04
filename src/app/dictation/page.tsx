'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ListChecks,
} from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { diffChars } from 'diff'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { useAnalytics } from '@/lib/analytics'
import { usePageView } from '@/lib/analytics'
import { speakText } from '@/lib/ttsBrowser'

type QuizMode = 'dictation' | 'sentence_blank'

export default function DictationPage() {
  usePageView('Dictation')
  const { trackDictationStart, trackDictationComplete } = useAnalytics()
  const [words, setWords] = useState<
    {
      word: string
      translation: string
      phonetic?: string
      example?: string
      correctCount?: number
      incorrectCount?: number
      [key: string]: unknown
    }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [mode, setMode] = useState<QuizMode>('dictation')

  // Quiz State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [isChecked, setIsChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [isFinished, setIsFinished] = useState(false)
  const [isStarted, setIsStarted] = useState(false) // 新增状态：是否已经开始测试
  const [testCount, setTestCount] = useState<number | 'custom'>(10) // 默认测试数量，增加 'custom' 选项
  const [mistakes, setMistakes] = useState<
    {
      word: string
      translation: string
      phonetic?: string
      example?: string
      correctCount?: number
      incorrectCount?: number
      [key: string]: unknown
    }[]
  >([]) // 收集本次测试中做错的单词
  const [_isRetesting, setIsRetesting] = useState(false) // 是否处于错题重测模式
  const [answers, setAnswers] = useState<Record<number, { userInput: string; isCorrect: boolean }>>(
    {},
  ) // 记录每道题的答题状态

  // Settings State
  const [isMuted, setIsMuted] = useState(false)
  const [hideChinese, setHideChinese] = useState(false)
  const [reviewMode, setReviewMode] = useState<'random' | 'smart'>('smart') // 新增：复习模式
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')
  const [groups, setGroups] = useState<
    { id: string; name: string; _count?: { ReviewGroupWord: number }; [key: string]: unknown }[]
  >([])

  // Fetch groups
  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/review-groups')
      const data = await res.json()
      if (data.success && data.data) {
        setGroups(data.data)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch groups', error)
    }
  }

  // Audio refs for sound effects
  const correctAudioRef = useRef<HTMLAudioElement | null>(null)
  const incorrectAudioRef = useRef<HTMLAudioElement | null>(null)

  // 自定义模式状态
  const [allHistoryWords, setAllHistoryWords] = useState<
    {
      word: string
      translation: string
      phonetic?: string
      example?: string
      correctCount?: number
      incorrectCount?: number
      [key: string]: unknown
    }[]
  >([])
  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)
  const [customSearchQuery, setCustomSearchQuery] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch a random batch of words for dictation
  const fetchWords = async () => {
    setIsLoading(true)
    try {
      if (testCount === 'custom') {
        // 如果是自定义模式，直接过滤出选中的单词作为题库
        const customWords = allHistoryWords.filter((w) => selectedWords.includes(w.word))
        // 打乱顺序
        const shuffled = [...customWords].sort(() => 0.5 - Math.random())
        setWords(shuffled)
      } else {
        // 根据用户选择的数量和模式获取词汇
        const endpoint = reviewMode === 'smart' ? '/api/dictation/smart' : '/api/danmaku'
        const url = `${endpoint}?limit=${testCount}&groupId=${selectedGroupId}&t=${Date.now()}`
        const res = await fetch(url)
        const data = await res.json()
        if (data.success && data.data) {
          setWords(data.data)
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development')
        console.error('Failed to fetch dictation words', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch all words for custom selection modal
  const fetchAllHistoryWords = async () => {
    try {
      const res = await fetch(`/api/history?limit=200`)
      const data = await res.json()
      if (data.success) {
        setAllHistoryWords(data.data)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development')
        console.error('Failed to fetch history words for custom dictation', error)
    }
  }

  useEffect(() => {
    fetchAllHistoryWords()
    fetchGroups()

    // 初始化 Audio 对象
    if (typeof window !== 'undefined') {
      correctAudioRef.current = new Audio('/sounds/correct.mp3')
      incorrectAudioRef.current = new Audio('/sounds/incorrect.mp3')
    }

    return () => {
      if (correctAudioRef.current) {
        correctAudioRef.current.pause()
        correctAudioRef.current.src = ''
        correctAudioRef.current = null
      }
      if (incorrectAudioRef.current) {
        incorrectAudioRef.current.pause()
        incorrectAudioRef.current.src = ''
        incorrectAudioRef.current = null
      }
    }
  }, [])

  // 播放音效的辅助函数
  const playSoundEffect = (type: 'correct' | 'incorrect') => {
    try {
      if (type === 'correct' && correctAudioRef.current) {
        correctAudioRef.current.currentTime = 0
        correctAudioRef.current.play().catch((e) => {
          if (process.env.NODE_ENV === 'development') console.error('Audio play failed:', e)
        })
      } else if (type === 'incorrect' && incorrectAudioRef.current) {
        incorrectAudioRef.current.currentTime = 0
        incorrectAudioRef.current.play().catch((e) => {
          if (process.env.NODE_ENV === 'development') console.error('Audio play failed:', e)
        })
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Audio system error:', e)
    }
  }

  const startTest = () => {
    if (testCount === 'custom' && selectedWords.length === 0) {
      toast.error('请至少选择一个单词！')
      return
    }
    setIsStarted(true)
    fetchWords()
    const count = testCount === 'custom' ? selectedWords.length : testCount
    trackDictationStart(count, mode)
  }

  const playAudio = (text: string) => {
    if (isMuted) return
    speakText(text)
  }

  // 自动播放当前单词发音
  useEffect(() => {
    if (mode === 'dictation' && words.length > 0 && !isChecked && !isFinished && !isMuted) {
      playAudio(words[currentIndex].word)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, mode, words, isChecked, isFinished, isMuted])

  const currentWord = words[currentIndex]

  const handleCheck = async () => {
    if (!userInput.trim()) return
    if (answers[currentIndex]) return // 如果已经答过了，不再重复判断

    const targetWord = currentWord.word.toLowerCase().trim()
    const userWord = userInput.toLowerCase().trim()

    const correct = targetWord === userWord
    setIsCorrect(correct)
    setIsChecked(true)

    // 记录这道题的答案状态
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: { userInput: userWord, isCorrect: correct },
    }))

    // 播放音效
    playSoundEffect(correct ? 'correct' : 'incorrect')

    if (correct) {
      setScore((prev) => ({ ...prev, correct: prev.correct + 1 }))
    } else {
      // 如果答错，且当前单词还不在错题本中，则加入错题本
      if (!mistakes.some((m) => m.word === currentWord.word)) {
        setMistakes((prev) => [...prev, currentWord])
      }
    }
    setScore((prev) => ({ ...prev, total: prev.total + 1 }))

    try {
      await fetch('/api/dictation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: currentWord.word, isCorrect: correct }),
      })
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to update stats', e)
    }
  }

  const loadQuestionState = React.useCallback(
    (index: number) => {
      const savedAnswer = answers[index]
      if (savedAnswer) {
        setUserInput(savedAnswer.userInput)
        setIsChecked(true)
        setIsCorrect(savedAnswer.isCorrect)
        setShowHint(false)
      } else {
        resetTurn()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [answers],
  )

  const handleNext = React.useCallback(() => {
    if (currentIndex < words.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      loadQuestionState(nextIndex)
    } else {
      setIsFinished(true)
      trackDictationComplete(score.correct, score.total)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, words.length, loadQuestionState, score])

  const handlePrev = React.useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      loadQuestionState(prevIndex)
    }
  }, [currentIndex, loadQuestionState])

  const resetTurn = React.useCallback(() => {
    setUserInput('')
    setIsChecked(false)
    setIsCorrect(false)
    setShowHint(false)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [])

  const restartQuiz = () => {
    setScore({ correct: 0, total: 0 })
    setCurrentIndex(0)
    setIsFinished(false)
    setMistakes([])
    setIsRetesting(false)
    setAnswers({})
    resetTurn()
    fetchWords() // 重新拉取一批新词
  }

  const startRetest = () => {
    if (mistakes.length === 0) return
    setWords([...mistakes]) // 将错题作为新的测试题库
    setScore({ correct: 0, total: 0 })
    setCurrentIndex(0)
    setIsFinished(false)
    setMistakes([]) // 清空错题本，准备在重测中重新收集
    setIsRetesting(true)
    setAnswers({})
    resetTurn()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // 如果还没检查，执行检查
      if (!isChecked) {
        handleCheck()
      }
      // 注意这里不要在 input 的 keydown 里执行 handleNext 了，
      // 因为全局的 window listener 已经在处理 isChecked 状态下的回车事件了。
      // 如果在这里也处理，会导致冲突或一键双连。
    }
  }

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 必须确保是已经检查过的状态，且当前没有弹窗打开，才允许回车进入下一题
      if (e.key === 'Enter' && isChecked && !isFinished) {
        e.preventDefault()
        handleNext()
      }
    }

    // 我们给全局监听加一点微小的延迟，防止与输入框的提交事件产生冲突（事件冒泡/同步执行导致的一键双连）
    let timer: NodeJS.Timeout
    if (isChecked) {
      timer = setTimeout(() => {
        window.addEventListener('keydown', handleGlobalKeyDown)
      }, 100)
    }

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [isChecked, handleNext, isFinished])

  // 生成挖空例句 (强大的正则词形匹配)
  const getBlankedSentence = (sentence: string, word: string) => {
    if (!sentence || !word) return sentence || '此单词没有例句，请切换其他模式'

    // 如果原词长度太短，不进行模糊匹配，防止误杀（比如 a, an, in）
    if (word.length <= 2) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      return sentence.replace(regex, '________')
    }

    // 智能词形匹配：获取单词词干（去除常见的后缀 s, es, ed, ing, d, y）
    let stem = word.toLowerCase()

    // 简单的词干提取规则，按照从长到短的顺序匹配
    if (stem.endsWith('ing')) {
      stem = stem.slice(0, -3)
    } else if (stem.endsWith('ies')) {
      stem = stem.slice(0, -3) + 'y'
    } else if (stem.endsWith('ed')) {
      stem = stem.slice(0, -2)
    } else if (stem.endsWith('es')) {
      stem = stem.slice(0, -2)
    } else if (stem.endsWith('s') && !stem.endsWith('ss') && !stem.endsWith('is')) {
      stem = stem.slice(0, -1)
    }

    // 如果提取词干后太短（比如只剩1个字母），退回到使用原词匹配
    if (stem.length < 2) {
      stem = word.toLowerCase()
    }

    // 构建正则表达式，匹配以词干开头的整个单词
    const regex = new RegExp(`\\b${stem}[a-z]*\\b`, 'gi')

    const blankLength = word.length > 4 ? 6 : 4
    const blankStr = '_'.repeat(blankLength)

    // 自定义替换逻辑
    const replaced = sentence.replace(regex, (match) => {
      // 目标是让用户填入完整的 word（比如 "dance"）
      // match 是例句中实际出现的单词（比如 "danced" 或 "dancing"）

      const lowerMatch = match.toLowerCase()
      const lowerWord = word.toLowerCase()

      // 情况 1: 例句里的词和要考的词一模一样 (dance == dance)
      if (lowerMatch === lowerWord) {
        return blankStr
      }

      // 情况 2: 例句里的词包含要考的词，只是多了后缀 (danced 包含 dance)
      // 提取出多出来的后缀 (danced 扣掉 dance，剩下 d)
      if (lowerMatch.startsWith(lowerWord)) {
        const suffix = match.slice(word.length)
        return `${blankStr}${suffix}`
      }

      // 情况 3: 发生了去 e 加 ing 等词干变形 (dancing 不直接包含 dance)
      // 此时我们只能隐藏整个 match，因为没办法完美切分。
      // 为了不让用户填成 danceing，我们只能在后面用括号提示原词的变形后缀，或者直接全挖空。
      // 这里为了严谨，对于复杂的变形，直接把整个变形后的词挖空，用户填变形后的词。
      return blankStr
    })

    if (replaced === sentence) {
      // 如果基于词干的正则没匹配到任何东西，退回到绝对精确匹配
      const strictRegex = new RegExp(`\\b${word}\\b`, 'gi')
      return sentence.replace(strictRegex, '________')
    }

    return replaced
  }

  const toggleWordSelection = (word: string) => {
    setSelectedWords((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word],
    )
  }

  const filteredHistoryWords = allHistoryWords.filter(
    (w) =>
      w.word.toLowerCase().includes(customSearchQuery.toLowerCase()) ||
      w.translation.includes(customSearchQuery),
  )

  // 生成带高亮的错误对比
  const renderDiff = (target: string, user: string) => {
    const diff = diffChars(user, target)
    return (
      <div className="flex flex-col items-start justify-center space-y-4 font-mono text-lg md:text-xl tracking-wide break-all w-full text-left">
        {/* 用户输入行（展示错在哪里） */}
        <div className="w-full">
          <div className="text-xs tracking-normal text-muted-foreground mb-1">你的输入:</div>
          <div className="leading-relaxed opacity-80 bg-muted/20 p-3 rounded-md border border-border/50 break-all w-full">
            {diff.map((part, index) => {
              if (part.added) {
                // 目标有，用户没写（漏写），用下划线占位表示这里缺东西
                return (
                  <span
                    key={index}
                    className="text-transparent border-b-2 border-primary w-[1ch] inline-block align-bottom"
                  >
                    _
                  </span>
                )
              }
              if (part.removed) {
                // 用户多写/写错的，标红
                return (
                  <span
                    key={index}
                    className="text-red-500 dark:text-red-400 font-bold bg-red-500/10 rounded-sm px-0.5 inline-block"
                  >
                    {part.value}
                  </span>
                )
              }
              // 写对的
              return (
                <span key={index} className="text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                  {part.value}
                </span>
              )
            })}
          </div>
        </div>

        {/* 正确答案行（展示应该怎么写） */}
        <div className="w-full">
          <div className="text-xs tracking-normal text-muted-foreground mb-1">正确答案:</div>
          <div className="leading-relaxed p-3 rounded-md border border-green-500/20 bg-green-500/5 break-all w-full">
            {diff.map((part, index) => {
              if (part.added) {
                // 目标有，用户没写，绿字提示应该写这个
                return (
                  <span
                    key={index}
                    className="text-green-600 dark:text-green-400 font-bold bg-green-500/10 rounded-sm px-0.5 inline-block"
                  >
                    {part.value}
                  </span>
                )
              }
              if (part.removed) {
                // 用户多写的，在正确答案里不存在，不显示
                return null
              }
              // 正确的
              return (
                <span
                  key={index}
                  className="text-gray-900 dark:text-gray-100 font-bold whitespace-pre-wrap"
                >
                  {part.value}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (isStarted && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isStarted && words.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background p-6 flex flex-col items-center justify-center">
        <p className="text-gray-500 dark:text-muted-foreground text-lg mb-4">
          生词本数量不足，无法开启默写！
        </p>
        <Link href="/">
          <Button>去添加单词</Button>
        </Link>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12 transition-colors duration-300">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border transition-colors duration-300">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" className="rounded-full">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div style={{ minWidth: 'max-content' }}>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground" style={{ whiteSpace: 'nowrap' }}>多维默写本</h1>
              <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">
                检测你的真实记忆水平
              </p>
            </div>
          </div>
          <ModeToggle />
        </div>

        {!isStarted ? (
          /* 设置与启动页面 */
          <Card className="border-2 shadow-sm">
            <CardContent className="p-8 md:p-12 flex flex-col items-center text-center space-y-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <RefreshCw className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2" style={{ minWidth: 'max-content' }}>
                <h2 className="text-2xl font-bold" style={{ whiteSpace: 'nowrap' }}>配置本次默写</h2>
                <p className="text-muted-foreground">
                  根据你的时间安排，选择本次要复习的单词数量。
                </p>
              </div>

              <div className="w-full max-w-xs space-y-4">
                <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
                  <span className="font-medium">复习范围</span>
                  <select
                    className="bg-background border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary max-w-[150px] sm:max-w-[180px]"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    disabled={testCount === 'custom'}
                  >
                    <option value="all">全部生词本</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g._count?.ReviewGroupWord || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
                  <span className="font-medium">复习模式</span>
                  <select
                    className="bg-background border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    value={reviewMode}
                    onChange={(e) => setReviewMode(e.target.value as 'random' | 'smart')}
                    disabled={testCount === 'custom'}
                  >
                    <option value="smart">智能排序 (推荐)</option>
                    <option value="random">随机抽取</option>
                  </select>
                </div>

                <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
                  <span className="font-medium">单词数量</span>
                  <select
                    className="bg-background border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    value={testCount}
                    onChange={(e) => {
                      const val = e.target.value
                      setTestCount(val === 'custom' ? 'custom' : Number(val))
                    }}
                  >
                    <option value={10}>10 个 (约 2 分钟)</option>
                    <option value={20}>20 个 (约 5 分钟)</option>
                    <option value={30}>30 个 (约 8 分钟)</option>
                    <option value={50}>50 个 (极限挑战)</option>
                    <option value="custom">自定义默写本</option>
                  </select>
                </div>

                {testCount === 'custom' && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                    <Dialog open={isCustomModalOpen} onOpenChange={setIsCustomModalOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full flex justify-between items-center bg-muted/30"
                        >
                          <span className="flex items-center gap-2">
                            <ListChecks className="w-4 h-4" />
                            已选 {selectedWords.length} 个单词
                          </span>
                          <span className="text-primary text-sm">去选择</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
                        <DialogHeader>
                          <DialogTitle>自定义默写单词</DialogTitle>
                          <DialogDescription>
                            从生词本中勾选你需要重点复习的单词。
                          </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                          <Input
                            placeholder="搜索单词或中文释义..."
                            value={customSearchQuery}
                            onChange={(e) => setCustomSearchQuery(e.target.value)}
                            className="mb-4"
                          />
                          <ScrollArea className="h-[40vh] border rounded-md p-4">
                            {filteredHistoryWords.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                没有找到相关单词
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {filteredHistoryWords.map((wordObj) => (
                                  <div key={wordObj.word} className="flex items-start space-x-3">
                                    <Checkbox
                                      id={`word-${wordObj.word}`}
                                      checked={selectedWords.includes(wordObj.word)}
                                      onCheckedChange={() => toggleWordSelection(wordObj.word)}
                                    />
                                    <label
                                      htmlFor={`word-${wordObj.word}`}
                                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 flex flex-col gap-1.5"
                                    >
                                      <div className="flex items-center">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">
                                          {wordObj.word}
                                        </span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-2 line-clamp-1">
                                          {wordObj.translation}
                                        </span>
                                      </div>

                                      {/* 显示历史统计数据 */}
                                      {wordObj.correctCount! > 0 || wordObj.incorrectCount! > 0 ? (
                                        <div className="flex items-center gap-3 text-xs opacity-80">
                                          <span className="text-green-600 dark:text-green-500">
                                            对: {wordObj.correctCount!}
                                          </span>
                                          <span className="text-red-600 dark:text-red-500">
                                            错: {wordObj.incorrectCount!}
                                          </span>
                                          <span className="text-muted-foreground ml-auto bg-muted/50 px-1.5 rounded">
                                            正确率:{' '}
                                            {Math.round(
                                              (wordObj.correctCount! /
                                                (wordObj.correctCount! + wordObj.incorrectCount!)) *
                                                100,
                                            )}
                                            %
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-muted-foreground opacity-50">
                                          暂无默写记录
                                        </div>
                                      )}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>

                        <DialogFooter className="sm:justify-between items-center">
                          <div className="text-sm text-muted-foreground">
                            已选择{' '}
                            <span className="font-bold text-primary">{selectedWords.length}</span>{' '}
                            个
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => setSelectedWords([])}
                              disabled={selectedWords.length === 0}
                            >
                              清空
                            </Button>
                            <Button onClick={() => setIsCustomModalOpen(false)}>确定</Button>
                          </div>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}

                <Button className="w-full h-12 text-lg font-bold mt-4" onClick={startTest}>
                  开始测试
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !isFinished ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <Tabs
                defaultValue="dictation"
                value={mode}
                onValueChange={(v) => {
                  setMode(v as QuizMode)
                  // 切换模式时，不是强制 resetTurn，而是重新加载当前题目的状态
                  loadQuestionState(currentIndex)
                }}
                className="w-full max-w-sm"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="dictation">综合默写</TabsTrigger>
                  <TabsTrigger value="sentence_blank">语境填空</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? '取消静音' : '静音'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setHideChinese(!hideChinese)}
                  title={hideChinese ? '显示中文' : '隐藏中文'}
                >
                  {hideChinese ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Card className="border-2 shadow-sm relative overflow-hidden">
              {/* 顶部进度条 */}
              <div className="absolute top-0 left-0 right-0">
                <Progress
                  value={(currentIndex / words.length) * 100}
                  className="h-1 rounded-none"
                />
              </div>

              <CardContent className="p-8 md:p-12 space-y-8">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    第 {currentIndex + 1} / {words.length} 题
                  </span>
                  <span>得分: {score.correct}</span>
                </div>

                {/* 题目区域 */}
                <div className="min-h-[140px] flex flex-col items-center justify-center text-center space-y-6">
                  {mode === 'dictation' && (
                    <div className="space-y-6 flex flex-col items-center">
                      {!hideChinese && (
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 break-words px-4">
                          {currentWord.translation}
                        </h2>
                      )}
                      <Button
                        size="lg"
                        variant="secondary"
                        className={`rounded-full w-20 h-20 shadow-inner hover:scale-105 transition-transform ${isMuted ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !isMuted && playAudio(currentWord.word)}
                        disabled={isMuted}
                      >
                        <Volume2 className="w-10 h-10 text-primary" />
                      </Button>
                    </div>
                  )}

                  {mode === 'sentence_blank' && (
                    <div className="space-y-4 w-full text-left bg-muted/30 p-6 rounded-xl border border-border/50">
                      {currentWord.example ? (
                        <>
                          <p className="text-xl font-medium leading-relaxed text-gray-800 dark:text-gray-200 break-words">
                            {getBlankedSentence(currentWord.example, currentWord.word)}
                          </p>
                          <p className="text-sm text-muted-foreground italic break-words">
                            {currentWord.translation}
                          </p>
                        </>
                      ) : (
                        <p className="text-amber-500 flex items-center gap-2 break-words">
                          ⚠️ 该单词没有保存例句，无法进行填空测试。
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 交互区域 */}
                <div className="space-y-6 max-w-md mx-auto">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Type the English word here..."
                      className={`text-center text-2xl h-14 tracking-wide font-mono ${
                        isChecked
                          ? isCorrect
                            ? 'border-green-500 focus-visible:ring-green-500 text-green-600 bg-green-50 dark:bg-green-950/20'
                            : 'border-red-500 focus-visible:ring-red-500 text-red-600 bg-red-50 dark:bg-red-950/20'
                          : ''
                      }`}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isChecked}
                      autoFocus
                    />
                    {/* 状态图标 */}
                    {isChecked && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {isCorrect ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* 结果反馈与操作按钮 */}
                  <div className="flex flex-col gap-4">
                    {!isChecked ? (
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="w-1/3 h-12"
                          onClick={() => setShowHint(true)}
                          disabled={showHint}
                        >
                          <Eye className="w-4 h-4 mr-2" /> 提示
                        </Button>
                        <Button
                          className="w-2/3 h-12 text-lg font-bold"
                          onClick={handleCheck}
                          disabled={!userInput.trim()}
                        >
                          提交答案 (Enter)
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {!isCorrect && (
                          <div className="p-6 bg-red-50/50 dark:bg-red-950/20 rounded-xl text-center border border-red-100 dark:border-red-900/30">
                            {renderDiff(
                              currentWord.word.toLowerCase().trim(),
                              userInput.toLowerCase().trim(),
                            )}
                            {currentWord.phonetic && (
                              <p className="text-sm mt-4 text-muted-foreground">
                                [{currentWord.phonetic}]
                              </p>
                            )}
                          </div>
                        )}

                        {/* 导航按钮组 */}
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            className="flex-1 h-12"
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" /> 上一题
                          </Button>
                          <Button
                            className="flex-1 h-12 text-lg"
                            onClick={handleNext}
                            variant={isCorrect ? 'default' : 'secondary'}
                          >
                            {currentIndex < words.length - 1 ? '下一题 (Enter)' : '查看成绩'}{' '}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* 提示信息 */}
                    {showHint && !isChecked && (
                      <div className="text-center text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                        首字母是{' '}
                        <strong className="text-primary text-lg">
                          {currentWord.word.charAt(0).toUpperCase()}
                        </strong>{' '}
                        ， 共有 <strong>{currentWord.word.length}</strong> 个字母。
                        {currentWord.phonetic && <span> 音标: [{currentWord.phonetic}]</span>}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* 成绩结算页面 */
          <Card className="border-2 border-primary/20 shadow-md">
            <CardContent className="p-12 flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-foreground" style={{ minWidth: 'max-content', whiteSpace: 'nowrap' }}>默写完成！</h2>
              <div className="space-y-2">
                <p className="text-3xl sm:text-4xl md:text-5xl font-black text-primary">
                  {Math.round((score.correct / words.length) * 100)}{' '}
                  <span className="text-2xl text-muted-foreground font-medium">分</span>
                </p>
                <p className="text-gray-500 dark:text-muted-foreground">
                  共测试 {words.length} 个单词，答对 {score.correct} 个。
                </p>
              </div>

              <div className="flex gap-4 pt-8 w-full max-w-md">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => (window.location.href = '/')}
                >
                  返回首页
                </Button>
                {mistakes.length > 0 && (
                  <Button variant="destructive" className="flex-1 h-12 gap-2" onClick={startRetest}>
                    <RefreshCw className="w-4 h-4" /> 重测错题 ({mistakes.length})
                  </Button>
                )}
                <Button className="flex-1 h-12 gap-2" onClick={restartQuiz}>
                  <RefreshCw className="w-4 h-4" /> 新的一组
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
