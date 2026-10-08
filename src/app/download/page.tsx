'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { BookOpen, Highlighter, RotateCcw, Compass, ArrowRight } from 'lucide-react'

const instructions = [
  { icon: BookOpen, title: '选择今天的练习', text: '在四六级备考中选择试卷与练习模式，支持搜索和年份筛选。切换试卷时保存作答，再回来继续。', href: '/study', label: '去选卷' },
  { icon: Highlighter, title: '点词查义，划线标记', text: '阅读时点单词查释义，荧光标记与语句划线可以同时保留。词库的标记查询会带你回到原试卷段落。', href: '/history', label: '查看词库与标记' },
  { icon: RotateCcw, title: '练习并回看', text: '想练拼写时使用默写与错词本。文章标记用于回看，不会自动加入默写。', href: '/dictation', label: '去复习' },
]
export default function UsageGuidePage() {
  const { status } = useSession()
  const { startOnboarding } = useOnboarding()
  return <AppLayout><main data-workspace-page className="min-h-screen bg-background px-4 py-6 pb-28 md:p-8"><div className="mx-auto max-w-2xl space-y-6">
    <header className="space-y-3"><span className="text-xs text-primary">EZTor · 使用指南</span><h1 className="text-2xl font-semibold">打开，就能开始学习</h1><p className="text-sm leading-7 text-muted-foreground">现在直接使用网页版。微信小程序正在筹备，尚未上线；这里暂不提供小程序码或安装包。</p></header>
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3"><h2 className="flex items-center gap-2 font-semibold"><Compass className="size-5 text-primary" />第一次使用？</h2><p className="text-sm leading-6 text-muted-foreground">四步了解选卷、查词、标记和复习。可以随时跳过，并在这里重新查看。</p>{status === 'authenticated' ? <Button className="min-h-11" onClick={startOnboarding}>重新查看使用引导</Button> : <Button asChild className="min-h-11"><Link href="/auth/signin?callbackUrl=%2Fdownload">登录并查看引导</Link></Button>}</section>
    {instructions.map(({ icon: Icon, title, text, href, label }, index) => <section key={href} className="rounded-2xl border border-border bg-card p-5 space-y-3"><div className="flex items-center gap-3"><Icon className="size-5 shrink-0 text-primary" /><h2 className="font-semibold">{index + 1}. {title}</h2></div><p className="text-sm leading-7 text-muted-foreground">{text}</p><Button asChild variant="outline" className="min-h-11"><Link href={href}>{label}<ArrowRight className="size-4" /></Link></Button></section>)}
    <section className="space-y-2 text-sm leading-7 text-muted-foreground"><h2 className="font-medium text-foreground">在手机上使用</h2><p>点击底部导航切换功能，使用页面内的返回或继续按钮。登录后，学习记录随账号保存。</p><p>AI 补充的释义与回答请结合上下文判断。微信内暂时无法使用的能力会以页面实际提示为准。</p><Link className="inline-flex min-h-11 items-center text-primary underline" href="/flywheel-preview.html">了解学习闭环</Link></section>
  </div></main></AppLayout>
}
