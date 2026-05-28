'use client'

import { AlertTriangle } from 'lucide-react'

export default function CircuitBreakPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
      <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-2">⚠️ 风险警告 ⚠️</h1>
      <p className="text-muted-foreground text-center">
        当前聊天内容有风险，已触发熔断保护
      </p>
      <p className="text-muted-foreground text-center mt-2">
        管理员正在处理中...
      </p>
    </div>
  )
}
