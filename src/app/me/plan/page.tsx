'use client'

import { useSession } from 'next-auth/react'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BackButton } from '@/components/layout/BackButton'
import { Loader2 } from 'lucide-react'
import { AuthorPlanList } from '@/components/me/AuthorPlanList'

export default function PlanPage() {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-4 md:p-8 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] xl:pb-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="xl:hidden">
            <BackButton />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>作者的计划</CardTitle>
              <CardDescription>
                作者对应用功能的开发计划与进度同步
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuthorPlanList />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
