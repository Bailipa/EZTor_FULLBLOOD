#!/usr/bin/env node
/**
 * Publish a post to Lee's Blog (blog.dogeggcode.cyou).
 *
 * Usage (run ON the server, from the blog app dir):
 *   cd /www/wwwroot/blog.dogeggcode.cyou/lb-blog
 *   set -a && . ./.env.production && set +a
 *   node /tmp/insert-post.mjs --payload /tmp/post-payload.json
 *
 * Payload JSON shape:
 * {
 *   "title": "…",              // required
 *   "slug": "…",               // required (url-safe, [a-z0-9-])
 *   "contentPath": "/tmp/post.md", // required — path to markdown file
 *   "excerpt": "…",            // optional
 *   "category": "deployment",  // optional — category slug, must already exist
 *   "tags": ["backend", "deploy"], // optional — tag slugs, must already exist
 *   "readingMinutes": 6,       // optional, default 1
 *   "featured": false,         // optional
 *   "accessTier": "free"       // optional, default "free"
 * }
 *
 * Idempotent: if a post with the same slug exists, it skips and reports.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire('/www/wwwroot/blog.dogeggcode.cyou/lb-blog/')
const { PrismaClient } = require('./src/generated/prisma/client.js')

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const payloadPath = arg('--payload')
if (!payloadPath) {
  console.error('missing --payload <path>')
  process.exit(1)
}

const p = JSON.parse(readFileSync(payloadPath, 'utf8'))
if (!p.title || !p.slug || !p.contentPath) {
  console.error('payload needs title, slug, contentPath')
  process.exit(1)
}

const content = readFileSync(p.contentPath, 'utf8')
const prisma = new PrismaClient()

try {
  const existing = await prisma.post.findUnique({ where: { slug: p.slug } })
  if (existing) {
    console.log(`skip: post ${p.slug} already exists (${existing.id})`)
    process.exit(0)
  }

  const category = p.category
    ? await prisma.category.findUnique({ where: { slug: p.category } })
    : null
  const tags = p.tags?.length
    ? await prisma.tag.findMany({ where: { slug: { in: p.tags } } })
    : []

  const post = await prisma.post.create({
    data: {
      title: p.title,
      slug: p.slug,
      content,
      excerpt: p.excerpt ?? null,
      coverImage: p.coverImage ?? null,
      status: 'PUBLISHED',
      featured: p.featured ?? false,
      viewCount: 0,
      publishedAt: new Date(),
      readingMinutes: p.readingMinutes ?? 1,
      accessTier: p.accessTier ?? 'free',
      categoryId: category?.id ?? null,
      tags: { create: tags.map((t) => ({ tagId: t.id })) },
    },
  })

  const catName = category?.name ?? 'none'
  const tagSlugs = tags.map((t) => t.slug).join(',') || 'none'
  console.log(`created: ${post.id} ${post.slug} | category=${catName} | tags=${tagSlugs}`)
} finally {
  await prisma.$disconnect()
}
