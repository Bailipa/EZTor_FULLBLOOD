'use client'

import { lazy, Suspense } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ExamSessionView } from './examTypes'
import type { SessionView } from './types'
import styles from './study.module.css'

const ExamHistory = lazy(() => import('./ExamHistory'))
const StudyArchive = lazy(() => import('./StudyArchive'))

export default function LearningHistory({ accountId, purpose, onClose, onPickExam, onPickReading }: {
  accountId: string
  purpose: 'records' | 'analysis'
  onClose: () => void
  onPickExam: (session: ExamSessionView) => void
  onPickReading: (session: SessionView) => void
}) {
  const analysis = purpose === 'analysis'
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent className={`${styles.workspace} max-h-[85dvh] overflow-y-auto sm:max-w-xl`}>
      <DialogTitle>{analysis ? '试卷分析' : '学习记录'}</DialogTitle>
      <DialogDescription>{analysis ? '从已完成的试卷练习中查看学习分析。' : '查看试卷练习和历史阅读，继续学习或回看结果。'}</DialogDescription>
      <Suspense fallback={<p role="status">正在读取学习记录…</p>}>
        {analysis ? <ExamHistory accountId={accountId} purpose="analysis" onPick={onPickExam} /> : <Tabs defaultValue="exams">
          <TabsList className="w-full" aria-label="学习记录类型">
            <TabsTrigger value="exams">试卷练习</TabsTrigger>
            <TabsTrigger value="reading">历史阅读</TabsTrigger>
          </TabsList>
          <TabsContent value="exams"><ExamHistory accountId={accountId} onPick={onPickExam} /></TabsContent>
          <TabsContent value="reading"><StudyArchive accountId={accountId} onPick={onPickReading} /></TabsContent>
        </Tabs>}
      </Suspense>
    </DialogContent>
  </Dialog>
}
