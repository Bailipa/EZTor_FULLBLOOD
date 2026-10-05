import type { Metadata, Viewport } from 'next'
import './globals.css'

import { ThemeProvider } from '@/components/theme-provider'
import { NextAuthProvider } from '@/components/providers/session-provider'
import { OnlineLimitBanner } from '@/components/OnlineLimitBanner'
import { InterfaceStyleProvider } from '@/components/interface-style-provider'
import { BrandThemeProvider } from '@/components/brand-theme-provider'
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider'
import { DanmakuHost } from '@/components/layout/DanmakuHost'
import { AppUpdatePrompt } from '@/components/layout/AppUpdatePrompt'
import SharedNavigation from '@/components/layout/SharedNavigation'
import { NativeKeyboardLayoutProvider } from '@/components/layout/NativeKeyboardLayoutProvider'
import { GlobalFeedbackSounds } from '@/components/layout/GlobalFeedbackSounds'
import { FeedbackToaster } from '@/components/layout/FeedbackToaster'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
}

export const metadata: Metadata = {
  // 绝对基准 URL：OG/社交分享图若不设，会解析成 http://localhost:3000 导致预览图失效
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://eztor.dogeggcode.cyou'),
  title: {
    default: 'EZTor - 智能英语翻译与词汇记忆工具',
    template: '%s | EZTor',
  },
  description:
    'EZTor 是一款简洁强大的英语翻译与词汇记忆工具，支持 AI 批量翻译、生词本管理、默写复习等功能。',
  keywords: ['英语翻译', '词汇记忆', '单词本', 'AI翻译', '英语学习', 'EZTor'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'EZTor - 智能英语翻译与词汇记忆工具',
    description:
      'EZTor 是一款简洁强大的英语翻译与词汇记忆工具，支持 AI 批量翻译、生词本管理、默写复习等功能。',
    type: 'website',
    images: '/icons/icon-512.png',
  },
  manifest: '/manifest.webmanifest',
}

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full antialiased font-sans dark" data-build-id={BUILD_ID} data-brand-theme="gold" data-ui-style="reading">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('eztor-black-gold-default-v1')!=='applied'){localStorage.setItem('brand-theme','gold');localStorage.setItem('theme','dark');localStorage.setItem('eztor-black-gold-default-v1','applied')}var d=localStorage.getItem('theme')||'dark';var dark=d==='dark'||(d==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';var u=localStorage.getItem('eztor-interface-style');if(u==='reading'||u==='studio'||u==='vivid'||u==='minimal')document.documentElement.setAttribute('data-ui-style',u);var t=localStorage.getItem('brand-theme');if(t==='neutral')document.documentElement.removeAttribute('data-brand-theme');else if(t==='purple'||t==='gold'||t==='indigo')document.documentElement.setAttribute('data-brand-theme',t);var g=localStorage.getItem('eztor-experience-preferences-v1');var p=g?JSON.parse(g):{};var m=p.motion||localStorage.getItem('eztor-motion');if(m==='reduce'||m==='full')document.documentElement.setAttribute('data-motion',m);else document.documentElement.removeAttribute('data-motion');if(p.glow==='subdued')document.documentElement.setAttribute('data-glow','subdued');else document.documentElement.removeAttribute('data-glow')}catch(_){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <OnlineLimitBanner />
        <NextAuthProvider>
          <GlobalFeedbackSounds />
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <BrandThemeProvider>
              <InterfaceStyleProvider>
              <OnboardingProvider>
                <NativeKeyboardLayoutProvider>
                <DanmakuHost />
                <SharedNavigation />
                {children}
                </NativeKeyboardLayoutProvider>
              </OnboardingProvider>
              <AppUpdatePrompt />
              <FeedbackToaster />
                          </InterfaceStyleProvider>
            </BrandThemeProvider>
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  )
}
