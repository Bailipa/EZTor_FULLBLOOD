import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import prisma from '@/lib/prisma'

export const alt = 'EZTor 学习成果报告'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// 字体文件放 public/fonts/（deploy 时整个 public 拷进 standalone/public，无需依赖 tracing）
let fontBold: Buffer | null = null
let fontRegular: Buffer | null = null

async function loadFonts() {
  if (!fontBold || !fontRegular) {
    const base = join(process.cwd(), 'public', 'fonts')
    const fallbackBase = join(process.cwd(), '.next', 'standalone', 'public', 'fonts')
    try {
      fontBold = await readFile(join(base, 'noto-sans-sc-700.woff'))
      fontRegular = await readFile(join(base, 'noto-sans-sc-400.woff'))
    } catch {
      fontBold = await readFile(join(fallbackBase, 'noto-sans-sc-700.woff'))
      fontRegular = await readFile(join(fallbackBase, 'noto-sans-sc-400.woff'))
    }
  }
  return { fontBold, fontRegular }
}

interface ShareProfile {
  nickname: string
  combatPower: number
  zoneRank: number
  streak: number
  totalWords: number
}

async function getShareProfile(userId: string): Promise<ShareProfile | null> {
  const profile = await prisma.userGameProfile.findUnique({
    where: { userId },
    select: { nickname: true, combatPower: true, monthlyPower: true, currentStreak: true, zoneId: true },
  })
  if (!profile) return null

  let zoneRank = 0
  if (profile.zoneId) {
    const higherCount = await prisma.userGameProfile.count({
      where: {
        zoneId: profile.zoneId,
        OR: [
          { monthlyPower: { gt: profile.monthlyPower } },
          { monthlyPower: profile.monthlyPower, combatPower: { gt: profile.combatPower } },
          { monthlyPower: profile.monthlyPower, combatPower: profile.combatPower, userId: { lt: userId } },
        ],
      },
    })
    zoneRank = higherCount + 1
  }

  const totalWords = await prisma.word.count({ where: { userId } })

  return {
    nickname: profile.nickname ?? '未设置昵称',
    combatPower: profile.combatPower,
    zoneRank,
    streak: profile.currentStreak,
    totalWords,
  }
}

// 弹幕式流光渐变（纯 CSS，ImageResponse/satori 支持 linear-gradient）
const RAINBOW =
  'linear-gradient(90deg,#ff004c,#ff8800,#ffdd00,#00e676,#00b0ff,#7c4dff,#ff004c)'

export default async function Image({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const { fontBold: fb, fontRegular: fr } = await loadFonts()
  const profile = await getShareProfile(userId)

  const nickname = profile?.nickname ?? '未设置昵称'
  const totalWords = profile?.totalWords ?? 0
  const combatPower = profile?.combatPower ?? 0
  const zoneRank = profile?.zoneRank ?? 0
  const streak = profile?.streak ?? 0

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg,#0a0a0a 0%,#1a0a2e 30%,#0a1a2e 70%,#0a0a0a 100%)',
          fontFamily: 'NotoSansSC',
          padding: '60px 80px',
          position: 'relative',
        }}
      >
        {/* 顶部标题 */}
        <div style={{ display: 'flex', fontSize: 34, letterSpacing: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 28 }}>
          EZTor 学习成果报告
        </div>

        {/* 昵称 */}
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            color: '#ffffff',
            textShadow: '0 0 24px rgba(255,0,255,0.6), 0 0 60px rgba(0,255,255,0.35)',
            marginBottom: 44,
            maxWidth: '100%',
          }}
        >
          {nickname} 的学习成就
        </div>

        {/* 4 宫格数据 */}
        <div style={{ display: 'flex', gap: 28, marginBottom: 40 }}>
          {[
            { label: '总学力', value: String(combatPower), bold: true },
            { label: '本月学区排名', value: `第${zoneRank}名`, bold: true },
            { label: '连续打卡', value: `${streak}天`, bold: true },
            { label: '已入库单词', value: `${totalWords}+`, bold: true },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 240,
                height: 150,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 44,
                  fontWeight: 700,
                  backgroundImage: RAINBOW,
                  backgroundClip: 'text',
                  color: 'transparent',
                  marginBottom: 10,
                }}
              >
                {item.value}
              </div>
              <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* 底部网址 */}
        <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.35)', letterSpacing: 2 }}>
          eztor.dogeggcode.cyou · 分享自 EZTor
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'NotoSansSC', data: fb, style: 'normal', weight: 700 },
        { name: 'NotoSansSC', data: fr, style: 'normal', weight: 400 },
      ],
    },
  )
}
