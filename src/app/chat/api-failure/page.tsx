'use client'

import { AlertTriangle } from 'lucide-react'

export default function ApiFailurePage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
      <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-2">⚠️ 服务暂停 ⚠️</h1>
      <p className="text-muted-foreground text-center">
        服务器资源不足，暂停该服务
      </p>
      <p className="text-muted-foreground text-center mt-2">
        请耐心等待管理员处理与恢复
      </p>
    </div>
  )
}
