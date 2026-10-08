'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Suspense, useRef, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ContributionForm = dynamic(() => import('@/components/contributions/ContributionForm'), {
  loading: () => <p className="text-sm text-muted-foreground">正在打开疑问表单…</p>,
})

type QuestionWord = { word: string; translation?: string }

export default function WordMeaningQuestionButton({
  word,
  translation,
  onUpdated,
}: QuestionWord & { onUpdated?: () => Promise<void> }) {
  const { status } = useSession()
  const [questionWord, setQuestionWord] = useState<QuestionWord | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const dialog = useRef<HTMLDivElement | null>(null)
  const updated = onUpdated ?? noop

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`对 ${word} 的释义有疑问`}
        aria-haspopup="dialog"
        title="对释义有疑问？"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setQuestionWord({ word, translation })
        }}
      >
        <CircleHelp className="size-4" aria-hidden="true" />
      </button>
      <Dialog
        open={Boolean(questionWord)}
        onOpenChange={(open) => {
          if (!open) setQuestionWord(null)
        }}
      >
        <DialogContent
          ref={dialog}
          className="z-[90] max-h-[85dvh] overflow-y-auto sm:max-w-lg"
          overlayClassName="z-[89]"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            dialog.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>说说你的疑问 · {questionWord?.word}</DialogTitle>
            <DialogDescription>提交后会进入公共词库审核，审核通过会记录贡献。</DialogDescription>
          </DialogHeader>
          {questionWord &&
            (status === 'authenticated' ? (
              <Suspense
                fallback={<p className="text-sm text-muted-foreground">正在打开疑问表单…</p>}
              >
                <ContributionForm
                  key={questionWord.word}
                  inDialog
                  correctionWord={questionWord.word}
                  onUpdated={updated}
                />
              </Suspense>
            ) : status === 'loading' ? (
              <p className="text-sm text-muted-foreground">正在加载…</p>
            ) : (
              <div className="space-y-4">
                {questionWord.translation && (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm">
                    当前释义：{questionWord.translation}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  登录后可以提交疑问，并查看审核结果。
                </p>
                <Button asChild>
                  <Link
                    href={`/auth/signin?callbackUrl=${encodeURIComponent(`/contributions?correct=${encodeURIComponent(questionWord.word)}`)}`}
                  >
                    登录后填写
                  </Link>
                </Button>
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </>
  )
}

async function noop() {}
