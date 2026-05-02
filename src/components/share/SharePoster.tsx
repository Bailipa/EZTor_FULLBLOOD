'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toPng } from 'html-to-image'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { useTheme } from '@wrksz/themes/client'

interface ShareStats {
  username: string
  totalWords: number
  todayWords: number
  accuracy: number
  studyDays: number
  baseUrl: string
  quotes: string[]
}

interface SharePosterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SharePoster({ open, onOpenChange }: SharePosterProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<ShareStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [customQuote, setCustomQuote] = useState('')
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/share-stats')
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
        setSelectedQuoteIndex(Math.floor(Math.random() * data.data.quotes.length))
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch stats:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !stats) {
      fetchStats()
    }
  }, [open, stats, fetchStats])

  const getCurrentQuote = () => {
    if (customQuote.trim()) return customQuote.trim()
    return stats?.quotes[selectedQuoteIndex] || '坚持学习，每天进步一点点'
  }

  const shuffleQuote = () => {
    if (!stats) return
    let newIndex
    do {
      newIndex = Math.floor(Math.random() * stats.quotes.length)
    } while (newIndex === selectedQuoteIndex && stats.quotes.length > 1)
    setSelectedQuoteIndex(newIndex)
    setCustomQuote('')
  }

  const generatePoster = useCallback(async () => {
    if (!cardRef.current || !stats) return

    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
      })
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = objectUrl
      setPreviewUrl(objectUrl)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to generate poster:', e)
    }
  }, [stats, isDark])

  useEffect(() => {
    if (stats && open && mounted) {
      timeoutRef.current = setTimeout(generatePoster, 100)
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [stats, open, customQuote, selectedQuoteIndex, generatePoster, mounted])

  useEffect(() => {
    if (!open) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setPreviewUrl(null)
    }
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [open])

  const downloadPoster = () => {
    if (!previewUrl) return
    const link = document.createElement('a')
    link.download = `eztor-${new Date().toISOString().split('T')[0]}.png`
    link.href = previewUrl
    link.click()
  }

  if (!mounted) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">分享学习成果</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : stats ? (
          <div className="space-y-3 flex flex-col items-center">
            <Button variant="ghost" size="sm" onClick={shuffleQuote} className="h-8 px-3">
              <RefreshCw className="w-3 h-3 mr-1" />
              换一句
            </Button>

            <Input
              placeholder={stats.quotes[selectedQuoteIndex]}
              value={customQuote}
              onChange={(e) => setCustomQuote(e.target.value)}
              className="text-sm h-8 text-center w-full"
            />

            <div
              ref={cardRef}
              className="p-8 rounded-2xl"
              style={{
                width: '90vw',
                maxWidth: 360,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
              }}
            >
              <div className="text-center mb-8">
                <div
                  className="text-xs tracking-widest mb-2"
                  style={{ color: isDark ? '#737373' : '#a3a3a3' }}
                >
                  EZTor
                </div>
                <div
                  className="text-2xl font-semibold"
                  style={{ color: isDark ? '#fafafa' : '#171717' }}
                >
                  学习成果
                </div>
              </div>

              <div className="text-center mb-8">
                <div className="text-sm" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                  @{stats.username}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div
                  className="text-center p-4 rounded-xl"
                  style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
                >
                  <div
                    className="text-3xl font-bold"
                    style={{ color: isDark ? '#fafafa' : '#171717' }}
                  >
                    {stats.totalWords}
                  </div>
                  <div className="text-xs mt-1" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                    已学单词
                  </div>
                </div>
                <div
                  className="text-center p-4 rounded-xl"
                  style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
                >
                  <div
                    className="text-3xl font-bold"
                    style={{ color: isDark ? '#fafafa' : '#171717' }}
                  >
                    {stats.studyDays}
                  </div>
                  <div className="text-xs mt-1" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                    学习天数
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div
                  className="text-center p-4 rounded-xl"
                  style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
                >
                  <div
                    className="text-3xl font-bold"
                    style={{ color: isDark ? '#fafafa' : '#171717' }}
                  >
                    {stats.accuracy}%
                  </div>
                  <div className="text-xs mt-1" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                    默写正确率
                  </div>
                </div>
                <div
                  className="text-center p-4 rounded-xl"
                  style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
                >
                  <div
                    className="text-3xl font-bold"
                    style={{ color: isDark ? '#fafafa' : '#171717' }}
                  >
                    {stats.todayWords}
                  </div>
                  <div className="text-xs mt-1" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                    今日学习
                  </div>
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="text-sm italic" style={{ color: isDark ? '#d4d4d4' : '#525252' }}>
                  "{getCurrentQuote()}"
                </div>
              </div>

              <div className="text-center">
                <div className="text-xs" style={{ color: isDark ? '#525252' : '#a3a3a3' }}>
                  {stats.baseUrl}
                </div>
                <div className="text-xs mt-1" style={{ color: isDark ? '#404040' : '#d4d4d4' }}>
                  {new Date().toLocaleDateString('zh-CN')}
                </div>
              </div>
            </div>

            <Button
              onClick={downloadPoster}
              variant="outline"
              className="w-full h-8 self-stretch"
              disabled={!previewUrl}
            >
              <Download className="w-3 h-3 mr-2" />
              保存图片
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">加载失败</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
