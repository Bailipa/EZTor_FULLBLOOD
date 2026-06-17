'use client'

import AdminLayout from '@/components/layout/AdminLayout'
import { ChatManagement } from '@/components/admin/ChatManagement'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AdminChatPage() {
  const { isLoading, isAdmin, isAuthenticated } = useAdminCheck()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">无权访问</p>
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background p-6 md:p-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">聊天管理</h1>
            <p className="text-muted-foreground">管理聊天室配置、封禁列表和敏感词</p>
          </div>
          <ChatManagement />
        </div>
      </div>
    </AdminLayout>
  )
}
