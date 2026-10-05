'use client'

import { useEffect } from 'react'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { Toaster } from 'sonner'
import { playFeedbackSound } from '@/lib/feedbackSounds'

function ResultIcon({ result }: { result: 'success' | 'error' | 'warning' }) {
  useEffect(() => {
    playFeedbackSound(result === 'success' ? 'success' : 'error')
  }, [result])
  const Icon = result === 'success' ? CircleCheck : result === 'warning' ? TriangleAlert : CircleAlert
  return <Icon size={20} />
}

export function FeedbackToaster() {
  return <Toaster icons={{
    success: <ResultIcon result="success" />,
    error: <ResultIcon result="error" />,
    warning: <ResultIcon result="warning" />,
  }} />
}
