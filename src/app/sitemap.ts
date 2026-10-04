import type { MetadataRoute } from 'next'

const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://eztor.dogeggcode.cyou')

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL('/', siteUrl).toString(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: new URL('/public-vocabulary', siteUrl).toString(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]
}
