'use client'

import { Construction } from 'lucide-react'

export default function DisabledPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
      <Construction className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-2">🚧 功能已关闭 🚧</h1>
      <p className="text-muted-foreground text-center">
        该功能暂未开放
      </p>
      <p className="text-muted-foreground text-center mt-2">
        请关注后续更新
      </p>
    </div>
  )
}
