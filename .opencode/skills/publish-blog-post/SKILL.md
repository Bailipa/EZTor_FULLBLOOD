---
name: publish-blog-post
description: Publish a markdown post to Lee's Blog (https://blog.dogeggcode.cyou). Use when the user asks to write a blog post / 写博客 / 发博客 / 发表文章 to the blog, publish a post documenting an incident, or add an article to blog.dogeggcode.cyou. Covers writing the markdown, choosing category/tags, inserting into the live SQLite DB via the blog's own Prisma client, and verifying it's live.
---

# Publish to Lee's Blog

Posts are stored as markdown in the blog's SQLite DB (`prisma/dev.db`) and rendered server-side. The app is deployed as a Next.js standalone build under `/www/wwwroot/blog.dogeggcode.cyou/lb-blog` on `114.55.58.90`; post pages are `force-dynamic`, so inserting into the DB is enough — **no rebuild / restart needed**.

## Server facts

| Item | Value |
|------|-------|
| Server | `root@114.55.58.90` (ssh key `~/.ssh/id_ed25519_hardened`) |
| App dir | `/www/wwwroot/blog.dogeggcode.cyou/lb-blog` |
| Live DB | `$APP_DIR/prisma/dev.db` (the `prisma-bundled/dev.db` is a stale seed — never touch it) |
| Prisma client | `$APP_DIR/src/generated/prisma/client.js` (CJS, `require` it) |
| Env | `$APP_DIR/.env.production` — must be sourced so Prisma finds `DATABASE_URL` |
| PM2 | `lb-blog`, port 3001 (nginx proxies `blog.dogeggcode.cyou` → it) |

## Workflow

### 1. Write the post

Create the markdown file. Match the blog's existing post style (see an example: `/blog/dictation-task-stuck-4-20`). Front matter is **not** used — title/slug/excerpt go in the payload JSON, content stays pure markdown (GFM supported, code highlighting + TOC auto-generated).

### 2. Build the payload JSON

```json
{
  "title": "…",
  "slug": "url-safe-slug",
  "contentPath": "/tmp/post.md",
  "excerpt": "一两句话摘要",
  "category": "deployment",
  "tags": ["backend", "deploy"],
  "readingMinutes": 6
}
```

- `slug`: `[a-z0-9-]`, unique — this becomes `/blog/<slug>`. Choose it and reuse for verification.
- `category`: **slug**, must already exist in DB. Current categories (slug → name):
  - `nextjs` Next.js, `typescript` TypeScript, `docker` Docker, `react` React
  - `moment` 朋友圈, `plan` 计划, `document` 文档
  - `deployment` 部署, `serverprotect` 服务器维护, `algo-study` 算法学习
- `tags`: **slugs**, must already exist. Available: `frontend` 前端, `backend` 后端, `architecture` 架构, `tutorial` 教程, `picture` 图片, `deploy` 部署, `server` 服务器维护, `algo-learning` 算法学习, `performance` 性能优化.
- `readingMinutes`: rough estimate; ~2600 chars ≈ 5–6 min.

### 3. Upload + run the insert script (on the server)

```bash
# copy content + payload + script to server
scp -i ~/.ssh/id_ed25519_hardened post.md post-payload.json \
    .opencode/skills/publish-blog-post/scripts/insert-post.mjs \
    root@114.55.58.90:/tmp/

# run from the app dir with env sourced
ssh -i ~/.ssh/id_ed25519_hardened root@114.55.58.90 \
  "cd /www/wwwroot/blog.dogeggcode.cyou/lb-blog \
   && set -a && . ./.env.production && set +a \
   && node /tmp/insert-post.mjs --payload /tmp/post-payload.json"
```

The script is idempotent (skips if slug exists) and prints `created: <id> <slug> | category=… | tags=…`.

### 4. Verify

```bash
# 200 + title
curl -s -o /dev/null -w '%{http_code}\n' https://blog.dogeggcode.cyou/blog/<slug>
curl -s https://blog.dogeggcode.cyou/blog/<slug> | grep -o '<title>[^<]*</title>' | head -1
# appears in the blog list
curl -s https://blog.dogeggcode.cyou/blog | grep -o '<slug>' | head -1
```

### 5. Cleanup

```bash
ssh -i ~/.ssh/id_ed25519_hardened root@114.55.58.90 "rm -f /tmp/post.md /tmp/post-payload.json /tmp/insert-post.mjs"
```

## Troubleshooting

- `Environment variable not found: DATABASE_URL` → you forgot to source `.env.production` (or ran outside the app dir).
- `Cannot find module .../src/generated/prisma/client.js` → run from `$APP_DIR` (script resolves paths relative to it).
- `skip: post <slug> already exists` → the post is already live; bump the slug or update instead.
- Need a new category/tag that doesn't exist → create it via the blog admin UI (`/admin/login`, user `huiyang`) or insert a `Category`/`Tag` row the same way, then reference it.
- To list current categories/tags quickly: `sqlite3 $APP_DIR/prisma/dev.db 'SELECT slug FROM Category; SELECT slug FROM Tag;'`.
