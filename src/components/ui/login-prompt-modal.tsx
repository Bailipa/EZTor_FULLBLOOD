'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoginPromptModalProps {
  isOpen: boolean
  onClose: () => void
  featureName?: string
}

export function LoginPromptModal({ isOpen, onClose, featureName }: LoginPromptModalProps) {
  const router = useRouter()

  const handleLogin = () => {
    onClose()
    router.push('/auth/signin')
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            登录以使用完整功能
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {featureName ? (
              <span>
                <span className="font-medium text-foreground">{featureName}</span>{' '}
                需要登录后才能使用。
              </span>
            ) : (
              <span>当前页面功能有限，体验完整功能请登录。</span>
            )}
            <span className="block text-sm text-muted-foreground">
              💡 登录无需手机号，只需设置用户名和密码即可。
            </span>
            <a
              href="/flywheel-preview.html"
              className="inline-block text-sm text-primary hover:underline underline-offset-2"
            >
              先看看功能 →
            </a>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            稍后再说
          </Button>
          <AlertDialogAction onClick={handleLogin} className="w-full sm:w-auto">
            <LogIn className="h-4 w-4 mr-2" />
            立即登录
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function useLoginPrompt() {
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [pendingFeature, setPendingFeature] = useState<string | undefined>()

  const promptLogin = (featureName?: string) => {
    setPendingFeature(featureName)
    setShowLoginPrompt(true)
  }

  const closePrompt = () => {
    setShowLoginPrompt(false)
    setPendingFeature(undefined)
  }

  return {
    showLoginPrompt,
    pendingFeature,
    promptLogin,
    closePrompt,
    LoginPromptDialog: () => (
      <LoginPromptModal
        isOpen={showLoginPrompt}
        onClose={closePrompt}
        featureName={pendingFeature}
      />
    ),
  }
}

export function WelcomeBanner({ onDismiss }: { onDismiss: () => void }) {
  const router = useRouter()

  const _handleLogin = () => {
    router.push('/auth/signin')
  }

  return (
    <div className="bg-gradient-to-r from-accent to-surface-alt border border-border rounded-xl p-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">
            👋 欢迎使用 EZTor 英语词典
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            当前为访客模式，您可以使用公共词库查词。登录后可解锁 AI
            翻译、生词本、默写复习等完整功能。
          </p>
          <Button
            size="sm"
            onClick={() => router.push('/auth/signin')}
            className="bg-primary hover:brightness-90"
          >
            <LogIn className="h-4 w-4 mr-2" />
            立即登录（无需手机号）
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="text-primary hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
