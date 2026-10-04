import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '公共词库',
  description: '浏览、搜索并下载 EZTor 公共英语词汇，查看音标、词性、中文释义和例句。',
  alternates: {
    canonical: '/public-vocabulary',
  },
}

export default function PublicVocabularyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
