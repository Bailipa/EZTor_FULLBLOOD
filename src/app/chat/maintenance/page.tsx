'use client'

import { Construction } from 'lucide-react'

export default function MaintenancePage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
      <Construction className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-2">🚧 维护中 🚧</h1>
      <p className="text-muted-foreground text-center">
        管理员正在维护中，该功能暂不可用
      </p>
      <p className="text-muted-foreground text-center mt-2">
        请稍后再试
      </p>
    </div>
  )
}
