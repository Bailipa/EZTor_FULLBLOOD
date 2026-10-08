'use client'

import { useSession } from 'next-auth/react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import StudyContentManagement from '@/components/admin/StudyContentManagement'
import StudyMaterialSubmissions from '@/components/admin/StudyMaterialSubmissions'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function AdminStudyPage() {
  const [view, setView] = useState<'catalogue' | 'submissions'>('catalogue')
  const { data: session, status } = useSession()
  const { isLoading, isAdmin } = useAdminCheck()

  if (isLoading || status === 'loading') return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (!isAdmin || !session?.user?.id) return <div className="min-h-screen flex items-center justify-center p-4"><Card><CardContent className="p-6">无权访问，请使用管理员账号登录。</CardContent></Card></div>

  return <AdminLayout><div className="mx-auto max-w-6xl px-4 pt-4"><div className="flex gap-2"><Button variant={view === 'catalogue' ? 'default' : 'outline'} onClick={() => setView('catalogue')}>资源目录</Button><Button variant={view === 'submissions' ? 'default' : 'outline'} onClick={() => setView('submissions')}>贡献审核</Button></div></div>{view === 'catalogue' ? <StudyContentManagement accountId={session.user.id} /> : <StudyMaterialSubmissions />}</AdminLayout>
}
