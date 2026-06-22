'use client'

import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Languages,
  Database,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { useAdminCheck } from '@/hooks/useAdminCheck'

const items = [
  {
    href: '/admin/chat',
    label: '聊天管理',
    description: '聊天室配置、封禁列表、敏感词',
    icon: MessageSquare,
  },
  {
    href: '/translation-records',
    label: '翻译记录',
    description: '查看全站翻译历史',
    icon: Languages,
  },
  {
    href: '/llm-config',
    label: 'LLM 配置',
    description: '管理大模型提供商与密钥',
    icon: Database,
  },
]

export default function AdminMorePage() {
  const { isLoading, isAdmin, isAuthenticated } = useAdminCheck()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
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
      <div className="min-h-screen bg-background p-4 md:p-8 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] xl:pb-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold">更多</h1>
            <p className="text-sm text-muted-foreground">管理员辅助功能</p>
          </header>

          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {items.map(({ href, label, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="min-w-0">
                      <span className="font-medium block">{label}</span>
                      <span className="text-xs text-muted-foreground block truncate">
                        {description}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}