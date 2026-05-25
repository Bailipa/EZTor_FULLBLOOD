import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

import { ThemeProvider } from '@/components/theme-provider'
import { NextAuthProvider } from '@/components/providers/session-provider'
import { OnlineLimitBanner } from '@/components/OnlineLimitBanner'
import { BrandThemeProvider } from '@/components/brand-theme-provider'

export const metadata: Metadata = {
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
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
}

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full antialiased font-sans" data-build-id={BUILD_ID} data-brand-theme="purple">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(localStorage.getItem('brand-theme')==='neutral')document.documentElement.removeAttribute('data-brand-theme')})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <OnlineLimitBanner />
        <NextAuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <BrandThemeProvider>
              {children}
              <Toaster />
            </BrandThemeProvider>
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  )
}
