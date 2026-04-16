# 🔍 项目稳定性与安全评估报告

**评估日期**：2026-04-15  
**项目版本**：0.3.0  
**评估范围**：构建、类型安全、运行时安全、错误处理、内存管理、功能完整性、测试覆盖

---

## 项目概况

| 项目 | 信息 |
|------|------|
| **名称** | EZTor (web) |
| **版本** | 0.3.0 |
| **技术栈** | Next.js 16.2.3 + React 19.2.4 + Prisma (SQLite) + NextAuth v4 + OpenAI API |
| **功能** | 英语词汇翻译与记忆工具，支持 LLM 翻译、闪卡复习、弹幕、词库分享 |
| **部署模式** | standalone (PM2) |

---

## 🚨 一、构建状态：❌ 构建失败

**项目当前无法成功构建**，存在阻塞性语法错误：

### 阻塞性问题：`src/services/StreamHandler.ts:25`

```typescript
// 错误代码
async start: async (controller) => {
```

`ReadableStream` 构造器的 `start` 属性不能使用 `async` 修饰符。Turbopack 解析器在此处报错，导致整个翻译 API 不可用。正确写法应为 `start(controller) { ... }`，内部使用 async 函数调用。

**影响范围**：翻译核心功能完全不可用，所有依赖翻译的页面和 API 均受影响。

---

## 📊 二、TypeScript 类型检查：83 个错误

`tsc --noEmit` 检测到 **83 个类型错误**，分布如下：

| 文件区域 | 错误数 | 主要问题 |
|---------|--------|---------|
| `src/app/api/share/__tests__/import.test.ts` | ~30 | 测试 mock 对象缺少必需字段 |
| `scripts/*.ts` | ~20 | Prisma 模型字段缺失（id, updatedAt） |
| `src/app/api/config/route.ts` | 1 | ApiConfig 缺少 updatedAt |
| `src/app/api/dictation/update/route.ts` | 1 | Word 缺少 id, updatedAt |
| `src/app/api/import-csv/route.ts` | 1 | Word 缺少 id, updatedAt |

**根因**：Prisma schema 中多个模型使用 `@id` 和 `@default` 自动生成，但代码中手动创建记录时遗漏了 `id` 和 `updatedAt` 字段。`skipLibCheck: true` 掩盖了部分问题，但运行时可能出错。

---

## 📝 三、Lint 检查：1 个错误 + 93 个警告

| 级别 | 数量 | 关键问题 |
|------|------|---------|
| **Error** | 1 | `src/services/StreamHandler.ts:25` — `async` 修饰符位置错误 |
| **Warning** | 93 | 未使用变量/导入 (30+)、缺少 useEffect 依赖 (1)、其他 |

---

## ✅ 四、单元测试：55/55 通过

3 个测试文件、55 个用例全部通过。但测试覆盖率有限，核心翻译流程缺少集成测试。

---

## 🔴 五、高危运行时问题（5 项）

### 5.1 全局禁用 TLS 证书验证

**文件**：`src/lib/connectionPool.ts:3-5`

```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

**影响**：整个 Node.js 进程的所有 HTTPS 请求（包括 NextAuth、OpenAI API、数据库连接）都跳过 TLS 验证，极易遭受中间人攻击。这是**最严重的安全隐患**。

### 5.2 SQL 注入风险

**文件**：`src/app/api/llm-providers/route.ts:115-118`

```typescript
const setClause = keys.map((k) => `${k} = ?`).join(', ');
await prisma.$executeRawUnsafe(`UPDATE LlmApiProvider SET ${setClause} WHERE id = ?`, ...values, id);
```

`$executeRawUnsafe` 用于处理用户输入的 API 路由。虽然当前字段名被白名单过滤，但架构脆弱，一旦过滤逻辑被意外修改，列名注入将成为现实。

### 5.3 数据库故障时封禁检查被绕过

**文件**：`src/lib/banManager.ts:91`

```typescript
} catch {
  return { isBanned: false };  // 数据库错误时，被封禁用户绕过检查
}
```

当数据库不可用时，所有 IP 封禁检查默认放行，构成安全漏洞。

### 5.4 LlmApiProvider 表脱离 Prisma 管理

**文件**：`src/lib/llmPool.ts:109-132`

`LlmApiProvider` 表通过 `$executeRawUnsafe` 动态创建，不在 `schema.prisma` 中定义，导致：
- 迁移工具无法管理
- 类型安全完全依赖手动维护
- 与 Prisma schema 不同步

### 5.5 NextAuth middleware 已废弃

**文件**：`src/middleware.ts`

Next.js 16 构建时已发出警告：

> ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.

这意味着当前认证中间件在未来版本可能完全失效。

---

## 🟡 六、中危运行时问题（8 项）

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| 1 | 模块级 `setInterval` 无清理 | `src/lib/requestDeduplication.ts:34`、`src/lib/rateLimit.ts:164` | 开发环境热重载时定时器泄漏 |
| 2 | `MonitoringService.metrics` Map 无界增长 | `src/lib/monitoring.ts:2` | 长期运行内存缓慢增长 |
| 3 | 连接池无过期/失效机制 | `src/lib/connectionPool.ts:8` | API key 变更后仍使用旧客户端 |
| 4 | 限流器非原子递增 | `src/lib/rateLimit.ts:139` | 并发时可能多放行 1-2 个请求 |
| 5 | `Promise.all` + `.catch(() => null)` 吞没错误 | `src/services/CacheService.ts:129` | 数据库错误被忽略，后续操作可能使用 null |
| 6 | 大量 `as any` 绕过类型系统 | banManager.ts, llmPool.ts, analytics/route.ts | Schema 变更时编译器无法捕获 |
| 7 | `getServerSession` 已废弃 | 多个 API 路由 | 升级 NextAuth 后认证可能失效 |
| 8 | `SELECT *` 原始查询 | `src/services/CacheService.ts:30` | Schema 变更时返回列不可控 |

---

## 🟢 七、架构与安全亮点

项目在以下方面做得较好：

1. **安全头配置完善**：`next.config.ts` 中配置了 CSP、X-Frame-Options、X-Content-Type-Options 等安全头
2. **CSRF 保护**：`src/lib/csrf.ts` 实现了基于 Origin/Referer 的 CSRF 验证
3. **输入验证与清洗**：`src/lib/security.ts` 实现了 Prompt 注入检测和输入清洗
4. **环境变量验证**：`src/lib/envValidator.ts` 检查必需变量和不安全默认值
5. **LLM 故障转移**：`src/lib/llmPool.ts` 实现了多 Provider 故障转移和配额管理
6. **请求去重**：`src/lib/requestDeduplication.ts` 避免重复翻译请求
7. **LRU 缓存**：`src/lib/translationCache.ts` 实现了带 TTL 和淘汰策略的缓存
8. **验证码保护**：登录时使用 HMAC 验证码，防止暴力破解
9. **渐进式封禁**：违规次数递增触发 1h → 24h → 永久封禁

---

## 📋 八、综合稳定性评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **构建稳定性** | ❌ 0/10 | 构建失败，核心功能不可用 |
| **类型安全** | ⚠️ 3/10 | 83 个类型错误，大量 `as any` 绕过 |
| **运行时安全** | ⚠️ 4/10 | TLS 验证全局禁用，SQL 注入风险 |
| **错误处理** | ⚠️ 5/10 | 多处空 catch 块吞没关键错误 |
| **内存管理** | ⚠️ 6/10 | 存在缓慢泄漏风险，短期运行可接受 |
| **功能完整性** | ✅ 7/10 | 功能丰富，缓存/限流/故障转移齐全 |
| **测试覆盖** | ⚠️ 4/10 | 单元测试通过但覆盖率低 |
| **综合评分** | ⚠️ **4.1/10** | **项目当前不可部署，需修复构建阻塞问题和高危安全漏洞** |

---

## 🎯 九、优先修复建议（按紧急程度排序）

1. **🔴 P0 — 修复构建阻塞**：修改 `src/services/StreamHandler.ts:25` 的 `async start` 语法错误
2. **🔴 P0 — 移除全局 TLS 禁用**：删除 `src/lib/connectionPool.ts:4` 的 `NODE_TLS_REJECT_UNAUTHORIZED='0'`
3. **🔴 P1 — 修复封禁绕过漏洞**：`src/lib/banManager.ts:91` 的 catch 块应默认拒绝而非放行
4. **🟡 P1 — 消除 SQL 注入风险**：将 `$executeRawUnsafe` 替换为 Prisma ORM 操作或 `$executeRaw` + `Prisma.sql`
5. **🟡 P2 — 将 LlmApiProvider 纳入 Prisma schema**：统一数据模型管理
6. **🟡 P2 — 修复 83 个 TypeScript 类型错误**：确保编译时类型安全
7. **🟢 P3 — 为 MonitoringService 添加大小限制**：防止长期运行内存泄漏
8. **🟢 P3 — 迁移 middleware → proxy**：适配 Next.js 16 新规范
