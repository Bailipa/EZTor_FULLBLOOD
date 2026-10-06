import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const iconVersion = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'
  return {
    name: 'EZTor - 智能英语翻译与词汇记忆工具',
    short_name: 'EZTor',
    description: 'AI 批量翻译、生词本、默写复习、弹幕背词。可安装为桌面/安卓应用。',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#3048e8',
    lang: 'zh-CN',
    categories: ['education', 'productivity'],
    icons: [
      { src: `/icons/icon-192.png?v=${iconVersion}`, sizes: '192x192', type: 'image/png' },
      { src: `/icons/icon-512.png?v=${iconVersion}`, sizes: '512x512', type: 'image/png' },
      {
        src: `/icons/icon-maskable.png?v=${iconVersion}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
