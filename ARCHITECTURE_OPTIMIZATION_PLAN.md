# 架构优化方案

> 基于当前分支 `feature/architecture-improvements`  
> 创建日期: 2026-05-01

---

## 一、现状评估

当前项目是一个功能完善的词汇学习平台，但存在以下架构层面可优化的点：

| 领域 | 现状 | 问题 |
|------|------|------|
| 数据库 | SQLite (单文件) | 写锁竞争，高并发瓶颈 |
| 测试 | 仅 share 模块 55 个用例 | 核心翻译链路无覆盖 |
| 日志 | `console.error` 散落各处 | 无结构化、无可观测性 |
| 部署 | `node server.js` + PM2 | 无容器化，无健康检查 |
| 配置 | `.env` 明文 | 无密钥轮换，无配置校验 |

---

## 二、数据库迁移：SQLite → PostgreSQL

### 2.1 为什么选 PostgreSQL

- 行级锁代替 SQLite 的库级锁，支持真正并发写入
- Prisma 原生支持，迁移成本低
- 免费托管方案多（Supabase、Neon、Railway 均有免费额度）

### 2.2 迁移步骤

**第一步：安装依赖**
```bash
npm uninstall @libsql/client @prisma/adapter-libsql better-sqlite3
npm install pg
```

**第二步：修改 `prisma/schema.prisma`**
```prisma
// 修改前
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// 修改后
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

去除 SQLite 特有的 `binaryTargets`，去除 `@db.*` 注解。

**第三步：数据迁移**
```bash
# 方式一：Prisma 自动迁移（推荐先建新库）
prisma migrate dev --name init_postgres

# 方式二：如果要从 SQLite 迁移数据
npx tsx scripts/migrate-sqlite-to-postgres.ts
```

**第四步：连接池管理**
```prisma
// 在 schema 中不需要额外配置，Prisma 默认连接池即可
// 生产环境建议在 DATABASE_URL 中添加 ?connection_limit=20
```

### 2.3 风险点
- `randomUUID()` → 统一改为 `@default(cuid())` 或 `@default(uuid())`
- `updatedAt` 需要使用 `@updatedAt` 而非手动赋值
- 部分 SQLite 原生查询（如 `COALESCE`）需确认 PostgreSQL 兼容性

---

## 三、测试体系增强

### 3.1 当前覆盖
```
Test Files  3 passed (3)
     Tests  55 passed (55)
```
仅覆盖 `share/validate`、`share/import` 以及 `share/codeGenerator` 工具。

### 3.2 新增测试计划

| 优先级 | 测试对象 | 用例数 | 说明 |
|--------|---------|--------|------|
| P0 | `TranslationService.translate()` | 10+ | 核心翻译链路，mock LLM 响应 |
| P0 | `api/translate/route.ts` | 5+ | 翻译 API 端到端 |
| P1 | `CacheService` | 8+ | 缓存查询逻辑 |
| P1 | `api/tts/route.ts` | 5+ | TTS 音频生成 |
| P1 | `api/dictation/update` | 5+ | 默写更新统计 |
| P2 | `rateLimit.ts` | 6+ | 频率限制逻辑 |
| P2 | `banManager.ts` | 6+ | 封禁升级链 |
| P2 | `DonationModal.tsx` | 3+ | 打赏组件渲染 |

### 3.3 测试架构

```
src/__tests__/
├── unit/           # 纯函数单元测试
│   ├── lib/
│   │   ├── rateLimit.test.ts
│   │   ├── banManager.test.ts
│   │   └── deviceId.test.ts
│   └── services/
│       └── TranslationService.test.ts
├── integration/    # API 端到端测试
│   └── api/
│       ├── translate.test.ts
│       ├── tts.test.ts
│       └── dictation.test.ts
├── e2e/            # 浏览器端到端 (Playwright)
│   ├── homepage.spec.ts
│   └── dictation-flow.spec.ts
└── setup.ts        # 全局 mock 和 fixture
```

---

## 四、日志体系升级

### 4.1 当前问题

```ts
// 散落的 console.log/error
console.log(`[Concurrent] Found in completed cache: ${word}`);
console.error('[TTS] Failed:', error);
console.error("Failed to update stats", e);
```

无日志级别、无结构化字段、无上下文追踪（requestId、userId）。

### 4.2 方案：Pino

```bash
npm install pino
```

```ts
// src/lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  // 生产环境输出 JSON，开发环境友好可读
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})

// 带上下文的子 logger
export function createRequestLogger(req: Request, userId?: string) {
  return logger.child({
    requestId: crypto.randomUUID(),
    userId,
    path: req.url,
  })
}
```

### 4.3 使用示例

```ts
// 替换前
console.error('[TTS] Failed:', error);

// 替换后
logger.error({ err: error, input: input.slice(0, 50) }, 'TTS synthesis failed');
```

### 4.4 日志规范

| 级别 | 使用场景 |
|------|---------|
| `fatal` | 进程即将退出（数据库连接失败等） |
| `error` | 需要人工介入的错误（LLM 调用失败、DB 写入失败） |
| `warn` | 可恢复的异常（频率触发、CSRF 拦截） |
| `info` | 关键业务事件（用户登录、翻译完成） |
| `debug` | 开发调试信息（LLM 响应内容、缓存命中） |

---

## 五、容器化部署

### 5.1 Dockerfile

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --production

FROM base AS build
COPY . .
RUN npm ci && npm run build

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

### 5.2 健康检查端点

```ts
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }
}
```

---

## 六、实施顺序建议

```
Phase 1 (第 1-2 天)：日志升级
  ├── 安装 pino
  ├── 统一 logger 入口
  └── 逐步替换 console.error

Phase 2 (第 3-5 天)：测试补全
  ├── 补充 unit test（rateLimit, banManager）
  ├── 补充 integration test（translate, tts API）
  └── CI 中集成 vitest

Phase 3 (第 6-7 天)：容器化
  ├── 编写 Dockerfile
  ├── 添加健康检查
  └── docker-compose.yml（app + PostgreSQL）

Phase 4 (第 8-10 天)：数据库迁移
  ├── 创建 PostgreSQL 实例
  ├── 修改 schema 并生成 migration
  ├── 运行数据迁移脚本
  └── 上线验证
```

---

## 七、风险与回滚

| 阶段 | 风险 | 回滚方案 |
|------|------|---------|
| 日志 | 无破坏性 | 直接切换回 console |
| 测试 | 无破坏性 | 不影响生产 |
| 容器化 | 构建失败 | 回退到 PM2 脚本启动 |
| 数据库 | 数据丢失 | 保留 SQLite 备份文件逐表迁移 |
