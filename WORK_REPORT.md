# 工作报告 — 2026-05-04 会话（含上一会话记录）

---

## 上一会话 (05-03 → 05-04 接手) 改动

### 1. 全局 CSS 修复 (globals.css:130-132)
```css
h1, h2, h3, h4, h5, h6 {
  word-break: keep-all;
  overflow-wrap: break-word;   /* ← 后来发现是元凶之一 */
}
```

### 2. 内联 style 防御 (15 处)
所有含 CJK 文字的 flex 容器添加了 `style={{ minWidth: ... }}`，部分加了 `whiteSpace:'nowrap'`

### 3. CSS Containment 移除
- WordCard.tsx CardContent 移除 `contain:'layout'`（但 Card 本身 line 74 仍保留了 `contain:'layout style paint'`）
- history/page.tsx GridItem 移除 `contain:'layout style paint'`

### 4. 部署管道修复
- server.js `process.chdir(__dirname)` 导致静态资源路径错位
- 打包前 `cp -r .next/static .next/standalone/.next/static`
- deploy.sh 已创建，排除 `.env*`

---

## 本会话 (05-04) 根因分析与修复

### 根因 1: CSS 属性冲突导致 CJK 竖排

**`overflow-wrap: break-word` 是元凶**。当容器宽度不足时，`break-word` 强制在任何字符间换行，即使有 `white-space: nowrap` 也会在某些边缘情况下介入，导致 CJK 文本逐字竖排。`keep-all` 本身是正确的（阻止 CJK 自动断字），但不应该配 `break-word`。

**修复** (globals.css:130-132):
```css
h1, h2, h3, h4, h5, h6 {
  word-break: keep-all;
  /* 已移除 overflow-wrap: break-word */
}
```

### 根因 2: `min-width: fit-content` 塌缩

`fit-content` = `min(max-content, max(min-content, available))`。在移动端窄视口下 `available` 很小，`fit-content` 塌缩成 `available`，容器宽度不足以容纳 CJK 文本。

**修复**：全部 15 处 `fit-content` → `max-content`

### 根因 3: 缺失 `whiteSpace: 'nowrap'`

上一会话只给 3 个页面加了 `nowrap`，其余 8 个文件（analytics, translation-records, public-words, llm-config, ResultsList, WordInputCard, TranslateOnlyCard, GuestWordInputCard, HomeHeader）只加了 `fit-content` 没有 `nowrap`。

**修复**：6 处 CJK 标题补充了 `style={{ whiteSpace: 'nowrap' }}`

### 根因 4: 宝塔反向代理缓存 + 路径覆盖

宝塔面板的 proxy 配置 `location ^~ /` 使用 `^~` 前缀，优先级高于手动添加的 `location /_next/`（无 `^~`）。而且 proxy 配置里对 CSS/JS 加了 `expires 1m`，导致 nginx 缓存旧 CSS/JS 返回给浏览器。

**修复** (nginx 配置):
1. `location /_next/` 改为 `location ^~ /_next/` 提升优先级
2. 移到 proxy include 之前
3. 添加 `Cache-Control: no-cache, no-store, must-revalidate` + `expires -1`

### 根因 5: env validator crash loop

`src/instrumentation.ts` 调用 `logEnvStatus()` → `envValidator.ts:179` `process.exit(1)` 导致 PM2 重启 47 次。根因是每次解压 tarball 后 `.env` 未复制到 `.next/standalone/.env`，Next.js 的 CWD 在 standalone 目录中找不到 `.env`。

**修复**：服务器上 `cp .env .next/standalone/.env` 后重启

---

## 当前已修复的文件清单 (15 files, 已 commit + push)

| 文件 | 改动 |
|------|------|
| `src/app/globals.css` | 移除 h1-h6 的 `overflow-wrap: break-word` |
| `src/app/history/page.tsx` | 已有 `max-content` + `nowrap`（上会话，确认无误） |
| `src/app/users/page.tsx` | 同上 |
| `src/app/dictation/page.tsx` | 同上（3 处） |
| `src/app/analytics/page.tsx` | `fit-content` → `max-content` + h1 `nowrap` |
| `src/app/translation-records/page.tsx` | 2 处：`fit-content` → `max-content` + `nowrap` |
| `src/app/public-words/page.tsx` | h1 `fit-content` → `max-content` + `nowrap` |
| `src/app/llm-config/page.tsx` | `fit-content` → `max-content` + h1 `nowrap` |
| `src/components/home/HomeHeader.tsx` | `fit-content` → `max-content` |
| `src/components/home/WordInputCard.tsx` | `fit-content` → `max-content` + CardTitle `nowrap` |
| `src/components/home/TranslateOnlyCard.tsx` | `fit-content` → `max-content` |
| `src/components/home/GuestWordInputCard.tsx` | `fit-content` → `max-content` + CardTitle `nowrap` |
| `src/components/home/ResultsList.tsx` | `fit-content` → `max-content` + h3 `nowrap` |
| `deploy.sh` | 新增部署脚本 |

---

## 待修复：剩余移动端布局问题

以下问题已排查确认，待下一会话修复。

### HIGH: 统计卡片长标签溢出 (analytics/page.tsx:432-503)

`grid grid-cols-2` 在 320px 手机屏上每列仅 ~150px，标签 "排除管理员和测试账号数据"（14 字）明显溢出或被截断。用户统计(432) 和访客统计(523) 两处。

```tsx
// 当前
<p className="text-sm text-muted-foreground">排除管理员和测试账号数据</p>

// 建议：加 break-words + mobile-first font size
<p className="text-xs sm:text-sm text-muted-foreground break-words">排除管理员和测试账号数据</p>
```

同样的问题存在于同文件的多处统计标签（"排除管理和测试账号数据"出现在 line 437, 464, 537, 564）。

### MEDIUM: 弹窗表单 grid-cols-2 在移动端太窄

文件 | 位置 | 问题
---|---|---
`public-words/page.tsx:576` | 编辑单词弹窗 | `grid grid-cols-2` → 输入框各约 140px
`public-words/page.tsx:700` | 新增单词弹窗 | 同上
`llm-config/page.tsx:252` | API 配置弹窗 | `grid grid-cols-2 gap-3` → 输入框约 130px
`llm-config/page.tsx:277` | API 配置弹窗 | 同上
`llm-config/page.tsx:294` | API 配置弹窗 | 同上

```tsx
// 修复示例
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

### LOW: 其他次要问题

| 文件 | 行 | 问题 | 建议 |
|------|--|------|------|
| `dictation/page.tsx` | 984 | `text-5xl` 分数在手机上过大 | `text-3xl sm:text-4xl md:text-5xl` |
| `dictation/page.tsx` | 609 | 原生 `<select>` `max-w-[150px]` 可能截断分组名 | 用 shadcn Select 组件替代，或放宽到 `sm:max-w-[180px]` |
| `translation-records/page.tsx` | 250 | 搜索框 `w-48` 固定宽度 | `w-full sm:w-48 max-w-[200px]` |
| `WordCard.tsx:150-157` | 150 | translation 无 `break-words` | 添加 `break-words` 类 |
| `ResultsList.tsx:122-136` | 122 | 词条行无 `flex-wrap` | 父层加 `flex-wrap` |
| `GameWidget.tsx:239` | 239 | `text-4xl` 无防护 | 添加 `break-all` |
| `public-words/page.tsx:331` | 331 | `min-w-[200px]` 在手机上强制最小宽度 | `min-w-0 sm:min-w-[200px]` |

### NOTE: `nowrap` + `max-content` 不构成溢出（无需修改）

当前所有标题（"我的生词本"/"多维默写本"/"数据分析看板"等）均为 3-6 个中文字符，在 24px 字号下宽度约 72-144px，远小于 320px 手机宽度。`nowrap` + `max-content` 组合在这里不会导致水平溢出，无需回退。

---

## 部署/运维备忘

### 部署流程
```bash
# 本地
npm run build
bash deploy.sh
# 上传 deploy_*.tar.gz 到服务器

# 服务器
cd /www/wwwroot/114.55.58.90
tar -xzf deploy_*.tar.gz
cp .env .next/standalone/.env   # ⚠️ 每次必做
pm2 restart cet4-web
```

### Nginx 关键配置 (114.55.58.90.conf)
```nginx
# ⚠️ _next 必须用 ^~ 前缀且放 proxy include 之前
location ^~ /_next/ {
    proxy_pass http://127.0.0.1:3000;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    expires -1;
    ...
}
```

### 宝塔面板反向代理
- Baota 的 proxy 配置 `^~ /` 会覆盖 `/_next/` 的匹配
- 如需修改 Baota 面板代理设置，确保不重新引入 CSS/JS 缓存
- 当前配置已通过 Baota 面板开启缓存后解决

### 排查部署是否生效
```bash
# 1. 检查进程
pm2 status                    # status 应为 online，↺ 应为 0

# 2. 检查新 CSS 是否存在
ls .next/standalone/.next/static/chunks/*.css

# 3. 检查 SSR HTML
curl -s http://localhost:3000/history | grep -c "nowrap"

# 4. 检查 nginx 返回
curl -I https://dogeggcode.cyou/_next/static/chunks/XXX.css | grep cache
```

---

## 关键文件索引

| 用途 | 路径 |
|------|------|
| 历史/生词本 | `src/app/history/page.tsx` |
| 用户管理 | `src/app/users/page.tsx` |
| 默写 | `src/app/dictation/page.tsx` |
| 分析看板 | `src/app/analytics/page.tsx` |
| 翻译记录 | `src/app/translation-records/page.tsx` |
| 公共词库管理 | `src/app/public-words/page.tsx` |
| LLM 配置 | `src/app/llm-config/page.tsx` |
| 首页 Header | `src/components/home/HomeHeader.tsx` |
| 单词查词卡片 | `src/components/home/WordInputCard.tsx` |
| 翻译卡片 | `src/components/home/TranslateOnlyCard.tsx` |
| 访客查词卡片 | `src/components/home/GuestWordInputCard.tsx` |
| 结果列表 | `src/components/home/ResultsList.tsx` |
| 单词卡片 | `src/components/vocabulary/WordCard.tsx` |
| 游戏组件 | `src/components/ui/game/GameWidget.tsx` |
| 全局 CSS | `src/app/globals.css` |
| 环境校验 | `src/lib/envValidator.ts` |
| 启动校验 | `src/instrumentation.ts` |
| Next 配置 | `next.config.ts` |
| 部署脚本 | `deploy.sh` |
| PM2 配置 | `ecosystem.config.js` |
