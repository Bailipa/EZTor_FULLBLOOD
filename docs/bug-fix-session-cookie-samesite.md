# 幽灵 BUG 排查记：登录后点击按钮却被踢回登录页

## 问题现象

已登录用户在新手引导流程中，点击"认识"按钮后，页面突然跳转到登录页面。

**复现步骤：**
1. 新用户注册并登录
2. 进入首页，触发新手引导
3. 点击"显示答案"
4. 点击"认识"按钮
5. 页面跳转到 `/auth/signin?callbackUrl=%2Fdictation`

**诡异之处：**
- 用户明明已登录（`useSession()` 返回 `status === 'authenticated'`）
- POST 请求 `/api/flashcard/save-and-categorize` 返回 200 成功
- 但紧接着的页面导航却被中间件重定向到登录页
- 问题只在特定流程中出现，普通浏览不受影响

---

## 调试过程

### 第一阶段：怀疑环境变量问题

**假设：** 服务器的 `NEXTAUTH_SECRET` 与签发 token 时的 secret 不一致，导致 JWT 解密失败。

**验证：**
```bash
# 检查 PM2 进程的环境变量
pm2 env 8 | grep NEXTAUTH_SECRET
# 输出：NEXTAUTH_SECRET: gInBBSXuw+wrP93eYO61Xu2I/YjdsWeIK4zFubCdU0k=
```

**结论：** 环境变量正确，排除。

---

### 第二阶段：怀疑 PM2 多实例问题

**假设：** PM2 使用了 2 个 cluster 实例，session 状态在实例间不一致。

**验证：**
```bash
pm2 list
# 显示 cet4-web 有 2 个实例
```

**修复：** 将 `ecosystem.config.js` 中的 `instances: 2` 改为 `instances: 1`。

**结果：** 问题依然存在。

---

### 第三阶段：添加调试日志

在中间件中添加详细的调试日志：

```typescript
// middleware.ts
if (pathname.includes('/api/flashcard/save-and-categorize') || pathname === '/dictation') {
  const cookieHeader = request.headers.get('cookie') || ''
  const hasSessionCookie = cookieHeader.includes('next-auth.session-token')
  console.log('[DEBUG-AUTH]', JSON.stringify({
    pathname,
    hasSessionCookie,
    cookieSnippet: cookieHeader.substring(0, 300),
  }))
}
```

**关键发现：**

```
# POST 请求 - 有 session cookie ✅
[DEBUG-AUTH] {"pathname":"/api/flashcard/save-and-categorize","hasSessionCookie":true}

# GET /dictation 请求 - 没有 session cookie ❌
[DEBUG-AUTH] {"pathname":"/dictation","hasSessionCookie":false}
```

**结论：** 同一个用户的请求，POST 有 cookie，GET 却没有！

---

### 第四阶段：分析 cookie 属性

查看 nginx 日志，发现关键线索：

```
POST /api/flashcard/save-and-categorize → 200 (成功)
GET /auth/signin?callbackUrl=%2Fdictation → (被重定向)
```

检查 NextAuth 的 cookie 配置：

```typescript
// node_modules/next-auth/src/core/lib/cookie.ts
sessionToken: {
  name: `__Secure-next-auth.session-token`,
  options: {
    httpOnly: true,
    sameSite: "lax",  // ← 关键！
    path: "/",
    secure: true,
  },
}
```

---

## 根本原因

### `SameSite: lax` 的行为

NextAuth 默认将 session cookie 设置为 `SameSite: lax`。这意味着：

| 场景 | cookie 是否发送 |
|------|----------------|
| 用户点击链接（顶级导航） | ✅ 发送 |
| GET 请求（顶级导航） | ✅ 发送 |
| `window.location.href = '...'` | ✅ 发送 |
| `router.push()` 触发的客户端路由 | ❌ **不发送** |
| POST 表单提交（跨站） | ❌ 不发送 |

### 问题流程

```
1. 用户点击"认识"按钮
   ↓
2. POST /api/flashcard/save-and-categorize
   → 这是 fetch() 发起的请求，会携带 cookie
   → 中间件验证 token 成功，返回 200
   ↓
3. router.push('/dictation')
   → Next.js 客户端路由，向服务器发起 RSC 请求
   → 浏览器认为这不是"顶级导航"
   → SameSite: lax 的 cookie 不被发送！
   ↓
4. 中间件处理 GET /dictation
   → getToken() 返回 null（没有 cookie）
   → 重定向到 /auth/signin?callbackUrl=/dictation
```

---

## 解决方案

在 NextAuth 配置中自定义 cookie 的 `SameSite` 属性：

```typescript
// src/app/api/auth/[...nextauth]/route.ts
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',  // 允许跨站请求携带 cookie
        path: '/',
        secure: true,      // HTTPS 环境下必须为 true
      },
    },
  },
  // ... 其他配置
}
```

### `SameSite` 属性对比

| 值 | 行为 | 适用场景 |
|----|------|----------|
| `strict` | 只有同站请求才发送 cookie | 最安全，但用户体验差 |
| `lax` | GET 请求和顶级导航发送 cookie | NextAuth 默认值 |
| `none` | 所有请求都发送 cookie | SPA 应用、客户端路由 |

---

## 经验总结

### 1. 同一站点 ≠ 同一请求

`SameSite: lax` 对"顶级导航"的定义很严格：
- `window.location.href` = 顶级导航 ✅
- `router.push()` = 客户端路由 ❌

在 SPA 应用中，`router.push()` 不会触发浏览器的顶级导航，因此 `SameSite: lax` 的 cookie 不会被发送。

### 2. POST 和 GET 可能有不同的 cookie 行为

`fetch()` 发起的 POST 请求和 `router.push()` 触发的 GET 请求，在 cookie 策略上可能有不同行为。调试时需要分别检查。

### 3. 调试日志要打印 cookie

在中间件中添加日志时，打印 cookie 的存在与否是关键：

```typescript
console.log({
  hasCookie: !!request.headers.get('cookie'),
  hasSessionToken: cookie.includes('session-token'),
})
```

### 4. nginx 日志是金矿

nginx 的 access log 能看到完整的请求链路：
```
POST /api/xxx → 200
GET /auth/signin?callbackUrl=... → (重定向)
```

这种模式（成功后紧接重定向）通常意味着中间件或认证层的问题。

### 5. 环境变量没问题 ≠ 认证没问题

`NEXTAUTH_SECRET` 正确、PM2 配置正确、nginx 配置正确，但 cookie 的 `SameSite` 属性仍然可能导致认证失败。问题可能藏在 cookie 策略里。

---

## 相关代码位置

- 中间件：`src/middleware.ts`
- NextAuth 配置：`src/app/api/auth/[...nextauth]/route.ts`
- cookie 定义：`node_modules/next-auth/src/core/lib/cookie.ts`
- JWT 解密：`node_modules/next-auth/src/jwt/index.ts`

---

## 调试工具

```bash
# 检查 PM2 环境变量
pm2 env <id> | grep NEXTAUTH

# 实时监控中间件日志
pm2 logs cet4-web | grep DEBUG-AUTH

# 检查 nginx 访问日志
tail -f /var/log/nginx/access.log | grep -E 'dictation|flashcard'

# 检查 cookie 是否正确设置
curl -v https://your-domain.com/api/auth/session 2>&1 | grep -i 'set-cookie'
```

---

*调试日期：2026-05-29*
*耗时：约 2 小时*
*教训：SameSite 属性是 SPA 应用的隐形杀手*
