'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import MobileNavBar from '@/components/layout/MobileNavBar'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { TodoList } from '@/components/chat/TodoList'
import { Loader2 } from 'lucide-react'

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [config, setConfig] = useState<{ isEnabled: boolean; isCircuitBroken: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/chat/config')
        const data = await res.json()
        if (data.success) {
          setConfig(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch config:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConfig()
  }, [])

  useEffect(() => {
    if (!isLoading && config) {
      if (config.isCircuitBroken) {
        router.replace('/chat/circuit-break')
      } else if (!config.isEnabled) {
        const isAdmin = session?.user?.name === 'lhy'
        if (!isAdmin) {
          router.replace('/chat/maintenance')
        }
      }
    }
  }, [isLoading, config, session, router])

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    router.replace('/auth/signin')
    return null
  }

  if (!config?.isEnabled || config.isCircuitBroken) {
    return null
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-56px)] xl:h-screen">
        <TodoList />
        <div className="flex-1 min-h-0">
          <ChatRoom />
        </div>
      </div>
    </AppLayout>
  )
}
