import type { Metadata } from 'next'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getProfile(userId: string) {
  const profile = await prisma.userGameProfile.findUnique({
    where: { userId },
    select: { nickname: true, combatPower: true, currentStreak: true, zoneId: true },
  })
  if (!profile) return null

  const totalWords = await prisma.word.count({ where: { userId } })
  return {
    nickname: profile.nickname ?? '未设置昵称',
    combatPower: profile.combatPower,
    streak: profile.currentStreak,
    totalWords,
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>
}): Promise<Metadata> {
  const { userId } = await params
  const profile = await getProfile(userId)

  const title = profile ? `${profile.nickname} 的学习成就` : 'EZTor 学习成果报告'
  const description = profile
    ? `我在 EZTor 背了 ${profile.totalWords} 个单词，学力 ${profile.combatPower}，连续打卡 ${profile.streak} 天！你能超过我吗？`
    : 'EZTor 智能英语翻译与词汇记忆工具，AI 批量翻译、生词本、默写复习。'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      // og:image 由同目录 opengraph-image.tsx 文件约定自动注入，无需手动指定
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
