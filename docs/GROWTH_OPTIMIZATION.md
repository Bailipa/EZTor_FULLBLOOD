# EZTor 用户增长优化指南

> 基于 2026-05-27 用户行为数据分析。本文档供 AI agent 逐项执行，每条包含 Problem、Files、Actions、Verification。

---

## 数据基线（2026-05-27）

| 指标 | 数值 |
|------|------|
| 总注册用户 | 79 |
| 有单词的用户 | 31 (39%) |
| 僵尸用户（注册但从未使用） | 45 (57%) |
| 总单词量 | 87,499 |
| 7 日页面浏览 | 1,038 |
| 7 日游客查词 | 152 |
| 7 日默写开始 | 44 |
| 7 日默写完成 | 24 (55%) |
| 游客 → 注册转化率 | 50% (158 游客会话 → 76 新用户) |
| 注册 → 添加单词转化率 | 41% (76 新用户 → 31 活跃) |
| 单次访问用户占比 | 72% (314/436) |
| 页面浏览分布 | Home 784, Dictation 128, Sign In 101 |

### 流量漏斗

```
游客访问 1038 → 游客查词 152 (15%) → 注册 76 (7.3%) → 添加单词 31 (3.0%) → 默写 24 (2.3%)
```

### 最常查的词（全是示例词）

```
apple 36, inevitable 23, take for granted 14, hello 7
```

---

## 核心问题诊断

### 产品逻辑问题

**当前逻辑**：翻译驱动（翻译 → 保存 → 复习）
- 首页是翻译输入框
- 用户需要先查词，才能保存和复习
- 适合"有词要查"的用户

**用户画像**：从小应生活来的用户，想"背单词"
- 不是有词要查，而是想尝试背单词功能
- 进来发现是翻译工具，不知道怎么背单词
- 造成"阻尼感"，直接离开

**目标逻辑**：学习驱动（背单词 → 遇到不会的 → 查词）
- 首页直接是背单词（闪卡）
- 翻译功能做成次级入口
- 用户进来就能开始学习

---

## 完成状态总览

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 0 | 数据库改动（onboardingCompleted, isSystem） | ✅ 已完成 |
| Phase 1 | 移动端首页改造（全屏闪卡、自动存入） | ✅ 已完成 |
| Phase 2 | 新用户引导系统（5步引导） | ❌ 未实现 |
| Phase 3 | 翻译功能入口调整 | ✅ 已完成 |
| Phase 4 | 默写体验优化 | ✅ 已完成 |
| Phase 6 | 实时聊天反馈系统 | ✅ 已完成 |
| Phase 7 | UI 优化 | ✅ 已完成 |

---

## Phase 0: 数据库改动（基础设施）

### Step 0.1 — User 表添加引导状态字段

**Problem**: 需要记录用户是否完成过新用户引导，避免换设备或清空词库后重复引导。

**Files**:
- `prisma/schema.prisma`

**Actions**:

1. 在 `User` 模型中添加 `onboardingCompleted` 字段：
   ```prisma
   model User {
     // ... 现有字段
     onboardingCompleted Boolean @default(false)
   }
   ```

2. 创建数据库迁移

**Verification**:
- 迁移成功执行
- 新用户默认 `onboardingCompleted = false`
- 现有用户默认 `onboardingCompleted = false`

---

### Step 0.2 — ReviewGroup 表添加系统分组标记

**Problem**: 需要区分系统默认分组（"知道的单词"、"不知道的单词"）和用户自定义分组，系统分组不计入 3 个分组限制。

**Files**:
- `prisma/schema.prisma`

**Actions**:

1. 在 `ReviewGroup` 模型中添加 `isSystem` 字段：
   ```prisma
   model ReviewGroup {
     // ... 现有字段
     isSystem Boolean @default(false)
   }
   ```

2. 创建数据库迁移

**Verification**:
- 迁移成功执行
- 新建分组默认 `isSystem = false`
- 系统分组可设置为 `isSystem = true`

---

### Step 0.3 — 为现有用户创建系统默认分组

**Problem**: 现有用户没有"知道的单词"和"不知道的单词"分组。

**Files**:
- 新增 `scripts/create-system-groups.ts`

**Actions**:

1. 创建脚本，为所有现有用户创建两个系统分组：
   - `_known_words`（知道的单词）
   - `_unknown_words`（不知道的单词）
2. 设置 `isSystem = true`
3. 运行脚本

**Verification**:
- 所有现有用户都有这两个系统分组
- 新注册用户在首次登录时自动创建（在 API 中处理）

---

## Phase 1: 移动端首页改造（核心体验转变）

### Step 1.1 — 创建全屏闪卡组件

**Problem**: 现有"当然"功能是 Dialog 弹窗，不适合移动端首页全屏展示。

**Files**:
- 新增 `src/components/flashcard/FullscreenFlashcard.tsx`

**Actions**:

1. 基于现有 `FlashcardWidget` 改造，创建全屏版本
2. 布局：
   ```
   ┌─────────────────────┐
   │      Header          │  ← 保留现有 Header
   ├─────────────────────┤
   │                     │
   │   ┌─────────────┐   │
   │   │   apple     │   │  ← 闪卡（居中）
   │   │   /ˈæp.əl/  │   │
   │   │   [显示释义] │   │
   │   └─────────────┘   │
   │                     │
   │  [不认识]   [认识]  │  ← 底部按钮
   │                     │
   │   [翻译]  ← 次级入口 │  ← 右上角图标
   └─────────────────────┘
   ├─────────────────────┤
   │  [首页][默写][生词本] │  ← MobileNavBar
   └─────────────────────┘
   ```
3. 高度：`min-h-[calc(100vh-120px)]`（减去 Header 和 NavBar）
4. 单词来源：复用现有 `/api/flashcard/public` 接口
5. 右上角添加翻译图标按钮（`Search` 或 `Globe2`），点击跳转 `/translate`

**Verification**:
- 移动端访问首页，显示全屏闪卡
- 闪卡可正常翻转显示释义
- 右上角翻译按钮可点击跳转

---

### Step 1.2 — 闪卡按钮自动存入系统分组

**Problem**: 现有"当然"功能点击"认识/不认识"只更新统计，不会自动存入生词本。

**Files**:
- `src/components/flashcard/FullscreenFlashcard.tsx`
- 新增 `src/app/api/flashcard/save-and-categorize/route.ts`

**Actions**:

1. 新建 API `/api/flashcard/save-and-categorize`：
   ```typescript
   // 参数
   {
     word: string
     category: 'known' | 'unknown'
     isCorrect?: boolean
   }
   
   // 逻辑
   1. 调用 /api/dictation/update 的逻辑，创建/更新 Word 记录
   2. 查找用户的系统分组（isSystem = true 且名称匹配）
   3. 如果分组不存在，自动创建
   4. 将 Word 添加到对应分组（ReviewGroupWord）
   ```

2. 在 `FullscreenFlashcard` 中：
   - 点击"认识"调用 `/api/flashcard/save-and-categorize`，`category: 'known'`
   - 点击"不认识"调用 `/api/flashcard/save-and-categorize`，`category: 'unknown'`
   - 保存成功后自动切换到下一个单词

**Verification**:
- 点击"认识"后，单词出现在"知道的单词"分组
- 点击"不认识"后，单词出现在"不知道的单词"分组
- Word 表的 `correctCount`/`incorrectCount` 正确更新

---

### Step 1.3 — 修改分组限制逻辑

**Problem**: 现有逻辑限制每个用户最多 3 个分组，系统分组应不计入限制。

**Files**:
- `src/app/api/review-groups/route.ts`

**Actions**:

1. 修改 `GET` 查询，返回分组时标记是否为系统分组
2. 修改 `POST` 创建分组逻辑：
   ```typescript
   // 查询用户非系统分组数量
   const count = await prisma.reviewGroup.count({
     where: { 
       userId: session.user.id,
       isSystem: false  // 排除系统分组
     }
   })
   
   if (count >= 3) {
     return createErrorResponse('最多只能创建 3 个复习分组', 400)
   }
   ```

**Verification**:
- 系统分组不显示在普通分组列表中（或显示但有特殊标记）
- 用户可以创建最多 3 个自定义分组，不受系统分组影响

---

### Step 1.4 — 修改移动端首页布局

**Problem**: 移动端首页当前显示翻译输入框，需要改为显示全屏闪卡。

**Files**:
- `src/components/home/HomeContent.tsx`
- `src/components/home/guest/GuestHomepage.tsx`

**Actions**:

1. 在 `HomeContent.tsx` 中：
   - 移动端（`xl:hidden`）：显示 `FullscreenFlashcard` 组件
   - 桌面端（`xl:block`）：保持现有布局（翻译输入框 + 结果列表）

2. 游客移动端：
   - 显示 `FullscreenFlashcard`（限制词数，比如 10 个）
   - 底部显示登录提示："登录后可保存学习进度 →"

**Verification**:
- 移动端访问首页，显示全屏闪卡（不是翻译输入框）
- 桌面端访问首页，显示原有布局
- 游客可以体验闪卡，但有登录提示

---

## Phase 2: 新用户引导系统

### Step 2.1 — 创建引导状态管理

**Problem**: 需要管理引导流程的状态（当前步骤、是否完成）。

**Files**:
- 新增 `src/components/onboarding/OnboardingProvider.tsx`
- 新增 `src/app/api/onboarding/status/route.ts`
- 新增 `src/app/api/onboarding/complete/route.ts`

**Actions**:

1. 创建 `OnboardingProvider` 组件：
   ```typescript
   interface OnboardingState {
     currentStep: number  // 0 = 未开始, 1-5 = 引导步骤, 6 = 完成
     isActive: boolean
     needsOnboarding: boolean
   }
   ```

2. 创建 `/api/onboarding/status` API：
   ```typescript
   // 判断逻辑
   async function shouldShowOnboarding(userId: string): Promise<boolean> {
     const user = await prisma.user.findUnique({
       where: { id: userId },
       select: {
         onboardingCompleted: true,
         createdAt: true,
         _count: { select: { Word: true } }
       }
     })
     
     // 情况1：用户明确标记完成过引导
     if (user.onboardingCompleted) return false
     
     // 情况2：用户有单词（不管是新是旧）
     if (user._count.Word > 0) {
       // 标记为已完成，下次不再显示
       await prisma.user.update({
         where: { id: userId },
         data: { onboardingCompleted: true }
       })
       return false
     }
     
     // 情况3：用户没有单词，且创建时间超过 24 小时
     // 说明用户注册后从未使用，应该引导
     const hoursSinceCreation = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60)
     if (hoursSinceCreation > 24) return true
     
     // 情况4：新注册用户（< 24 小时），没有单词
     return true
   }
   ```

3. 创建 `/api/onboarding/complete` API：
   - 标记 `User.onboardingCompleted = true`

**Verification**:
- 新用户登录后，`/api/onboarding/status` 返回 `needsOnboarding: true`
- 用户有单词后，返回 `false` 并自动标记完成
- 用户清空词库后，不再重复引导（因为 `onboardingCompleted` 已为 `true`）

---

### Step 2.2 — 引导步骤 1：闪卡使用提示

**Problem**: 新用户不知道"认识/不认识"按钮的用法。

**Files**:
- `src/components/flashcard/FullscreenFlashcard.tsx`
- `src/components/onboarding/OnboardingProvider.tsx`

**Actions**:

1. 在 `FullscreenFlashcard` 中，当引导步骤为 1 时：
   - 显示 Tooltip 气泡，指向"认识"按钮
   - 文案："点击'认识'表示你知道这个词"
   - 指向"不认识"按钮
   - 文案："点击'不认识'表示你不知道这个词"

2. 用户点击任意按钮后，进入下一步引导

**Verification**:
- 新用户首次看到闪卡时，显示引导 Tooltip
- 点击按钮后 Tooltip 消失，进入下一步

---

### Step 2.3 — 引导步骤 2：初次默写体验

**Problem**: 用户不知道默写功能怎么用。

**Files**:
- `src/app/dictation/page.tsx`
- `src/components/onboarding/OnboardingProvider.tsx`

**Actions**:

1. 在默写页面，当引导步骤为 2 时：
   - 显示全屏遮罩引导
   - 文案："来试试默写吧！这次只默写 1 个单词"
   - 自动选择 1 个单词进行默写
   - 默写完成后，显示结果，进入下一步

2. 默写单词来源：
   - 优先使用用户刚在闪卡看过的词
   - 如果没有，从公共词库随机 1 个

**Verification**:
- 引导步骤 2 时，默写页面显示引导遮罩
- 只默写 1 个单词
- 完成后进入下一步

---

### Step 2.4 — 引导步骤 3：生词本展示

**Problem**: 用户不知道生词本在哪里，有什么用。

**Files**:
- `src/app/history/page.tsx`
- `src/components/onboarding/OnboardingProvider.tsx`

**Actions**:

1. 在生词本页面，当引导步骤为 3 时：
   - 显示底部弹出卡片
   - 文案："看看你刚才默写的单词，答对/答错次数都记录在这里"
   - 高亮显示刚默写的单词

2. 自动跳转到生词本页面（`/history`）

**Verification**:
- 引导步骤 3 时，自动跳转到生词本
- 显示引导卡片，高亮刚默写的单词

---

### Step 2.5 — 引导步骤 4：词库导入介绍

**Problem**: 用户不知道可以导入四六级词库。

**Files**:
- `src/app/history/page.tsx`
- `src/components/onboarding/OnboardingProvider.tsx`

**Actions**:

1. 在生词本页面，当引导步骤为 4 时：
   - 显示 Tooltip，指向"四六级词"按钮
   - 文案："点击这里可以导入四六级词库，快速开始学习"

2. 用户点击按钮或关闭 Tooltip 后，进入下一步

**Verification**:
- 引导步骤 4 时，显示指向"四六级词"按钮的 Tooltip
- 点击后 Tooltip 消失

---

### Step 2.6 — 引导步骤 5：功能探索提示

**Problem**: 用户不知道还有其他功能。

**Files**:
- `src/components/onboarding/OnboardingProvider.tsx`

**Actions**:

1. 在任意页面，当引导步骤为 5 时：
   - 显示底部弹出卡片
   - 文案："还有更多功能等你探索，开始你的学习之旅吧！"
   - "完成"按钮

2. 点击"完成"按钮后：
   - 调用 `/api/onboarding/complete`
   - 标记引导完成
   - 关闭引导

**Verification**:
- 引导步骤 5 时，显示完成卡片
- 点击"完成"后，引导结束
- 下次登录不再显示引导

---

## Phase 3: 翻译功能入口调整

### Step 3.1 — 创建独立翻译页面

**Problem**: 翻译功能从首页移除后，需要一个独立的入口。

**Files**:
- 新增 `src/app/translate/page.tsx`

**Actions**:

1. 创建独立翻译页面，复用现有 `WordInputCard` 和 `ResultsList` 组件
2. 布局：
   ```
   ┌─────────────────────┐
   │      Header          │
   ├─────────────────────┤
   │   WordInputCard      │  ← 翻译输入框
   ├─────────────────────┤
   │   ResultsList        │  ← 结果列表
   ├─────────────────────┤
   │  [首页][默写][生词本] │
   └─────────────────────┘
   ```

**Verification**:
- 访问 `/translate` 显示翻译页面
- 功能与原有首页翻译一致

---

### Step 3.2 — 调整移动端导航栏

**Problem**: 移动端导航栏需要反映新的页面结构。

**Files**:
- `src/components/layout/MobileNavBar.tsx`

**Actions**:

1. 修改导航项：
   ```typescript
   const navItems = [
     { href: '/', label: '首页', icon: Home },  // 闪卡
     { href: '/dictation', label: '默写', icon: PenTool },
     { href: '/history', label: '生词本', icon: BookOpen },
     { href: '/translate', label: '查词', icon: Search },  // 新增
   ]
   ```

2. 或者保持 3 个 Tab，翻译入口通过闪卡页面右上角访问

**Verification**:
- 移动端导航栏显示正确的 Tab
- 点击"查词"跳转到翻译页面

---

## Phase 4: 默写体验优化（保留原有方案）

### Step 4.1 — 默写中途退出保存进度

**Problem**: 45% 的默写中途放弃，进度丢失。

**Files**:
- `src/app/dictation/page.tsx`

**Actions**:

1. 在 `answers` 状态变化时，用 `localStorage` 保存当前进度：`{ answers, currentIndex, words, score, mode, timestamp }`
2. 进入默写页时检查 localStorage 是否有未完成的进度（timestamp 在 24h 内）
3. 如果有，弹窗提示："上次默写未完成，是否继续？"
4. 用户选择"继续"则恢复进度，选择"重新开始"则清除 localStorage
5. 默写完成（`isFinished = true`）后清除 localStorage

**Verification**:
- 默写中途关闭页面，重新进入后提示继续
- 恢复后答题状态正确
- 完成后 localStorage 清除

---

### Step 4.2 — 默写完成正向反馈

**Problem**: 完成后没有成就感，用户不会想再来。

**Files**:
- `src/app/dictation/page.tsx`

**Actions**:

1. 在 `isFinished` 为 true 时，根据正确率显示不同文案：
   - 90%+: "🎉 太棒了！你已经掌握了这些单词"
   - 70-89%: "👍 不错！再巩固一下就完美了"
   - 50-69%: "💪 继续加油！多复习几次就能掌握"
   - <50%: "📖 没关系，学习就是不断重复的过程"
2. 在完成页面显示本次数据：正确 X/Y，用时 X 分钟
3. 添加"再来一轮"和"查看错题"按钮

**Verification**:
- 完成默写后看到正向反馈文案
- 数据显示正确
- 按钮功能正常

---

## Phase 6: 实时聊天反馈系统（已完成）

### Step 6.1 — 数据库设计

**Problem**: 需要存储聊天消息、禁言记录、聊天配置、Todolist、自定义敏感词。

**Files**:
- `prisma/schema.prisma`

**Actions**:

1. 添加 `ChatMessage` 表：
   ```prisma
   model ChatMessage {
     id        String   @id @default(cuid())
     userId    String
     content   String
     isHidden  Boolean  @default(false)  // 影子禁言标记
     isDeleted Boolean  @default(false)
     createdAt DateTime @default(now())
     User      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   ```

2. 添加 `ChatBan` 表（影子禁言）：
   ```prisma
   model ChatBan {
     id       String   @id @default(cuid())
     userId   String   @unique
     reason   String?
     bannedAt DateTime @default(now())
     bannedBy String
     User     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   ```

3. 添加 `ChatConfig` 表（聊天配置）：
   ```prisma
   model ChatConfig {
     id                String   @id @default("global")
     isEnabled         Boolean  @default(true)
     isCircuitBroken   Boolean  @default(false)
     circuitBreakReason String?
     circuitBreakAt    DateTime?
     updatedAt         DateTime @updatedAt
   }
   ```

4. 添加 `AdminTodo` 表（管理员 Todolist）：
   ```prisma
   model AdminTodo {
     id          String   @id @default(cuid())
     title       String
     isCompleted Boolean  @default(false)
     sortOrder   Int      @default(0)
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   }
   ```

5. 添加 `CustomProfanity` 表（自定义敏感词）：
   ```prisma
   model CustomProfanity {
     id        String   @id @default(cuid())
     word      String   @unique
     createdAt DateTime @default(now())
   }
   ```

6. User 表添加关系：
   ```prisma
   model User {
     // ... 现有字段
     chatMessages ChatMessage[]
     chatBan      ChatBan?
   }
   ```

**Verification**:
- 数据库迁移成功
- 所有表正确创建

---

### Step 6.2 — 工具函数

**Problem**: 需要敏感词过滤、AI 风险审查、用户标识、SSE 管理等工具。

**Files**:
- `src/lib/profanityFilter.ts`
- `src/lib/riskDetection.ts`
- `src/lib/chatUser.ts`
- `src/lib/chatSSE.ts`
- `src/lib/chatCleanup.ts`

**Actions**:

1. 敏感词过滤（`profanityFilter.ts`）：
   - 使用 `@2toad/profanity` 库（支持中文）
   - 支持自定义敏感词加载
   - 提供 `containsProfanity`、`filterProfanity`、`addProfanityWord`、`removeProfanityWord` 函数

2. AI 风险审查（`riskDetection.ts`）：
   - 使用翻译的大模型 API
   - 检测诈骗、伤害、暗号谐音等风险
   - 返回 `{ isRisky: boolean; reason?: string }`

3. 用户标识（`chatUser.ts`）：
   - `isDeveloper(user)`：判断是否为管理员（用户名 `lhy`）
   - `getDisplayName(user)`：获取显示名称（管理员显示"EZTor开发者"，普通用户显示"EZTor用户" + 随机 emoji）
   - `getAvatar(user)`：获取头像（管理员显示"E"，普通用户无头像）

4. SSE 管理（`chatSSE.ts`）：
   - 订阅/广播消息、Todolist、配置更新
   - 在线用户数统计

5. 定时清理（`chatCleanup.ts`）：
   - 清理 24 小时前的消息

**Verification**:
- 敏感词过滤正常工作
- AI 风险审查正常工作
- 用户标识正确显示
- SSE 实时推送正常
- 定时清理正常执行

---

### Step 6.3 — API 设计

**Problem**: 需要消息 CRUD、SSE 流、聊天配置、禁言管理、Todolist、自定义敏感词等 API。

**Files**:
- `src/app/api/chat/messages/route.ts`
- `src/app/api/chat/messages/[id]/route.ts`
- `src/app/api/chat/messages/clear/route.ts`
- `src/app/api/chat/stream/route.ts`
- `src/app/api/chat/online/route.ts`
- `src/app/api/chat/config/route.ts`
- `src/app/api/chat/ban/route.ts`
- `src/app/api/chat/ban/[userId]/route.ts`
- `src/app/api/admin/todos/route.ts`
- `src/app/api/admin/todos/[id]/route.ts`
- `src/app/api/admin/profanity/route.ts`
- `src/app/api/admin/profanity/[id]/route.ts`

**Actions**:

1. 消息 CRUD：
   - GET：获取消息（支持分页，管理员可见所有消息，普通用户只可见未隐藏消息）
   - POST：发送消息（敏感词过滤 + AI 风险审查 + 频率限制 + 影子禁言）
   - DELETE：删除消息（管理员）

2. SSE 流：
   - 实时推送新消息、Todolist 更新、配置更新

3. 聊天配置：
   - GET：获取配置（是否开启、是否熔断）
   - PUT：更新配置（管理员）

4. 禁言管理：
   - GET：禁言列表（管理员）
   - POST：禁言用户（管理员）
   - DELETE：解除禁言（管理员）

5. Todolist：
   - GET：获取 todos（所有用户）
   - POST：创建 todo（管理员）
   - PUT：更新 todo（管理员）
   - DELETE：删除 todo（管理员）

6. 自定义敏感词：
   - GET：获取敏感词列表（管理员）
   - POST：添加敏感词（管理员）
   - DELETE：删除敏感词（管理员）

**Verification**:
- 所有 API 正常工作
- 权限控制正确
- 敏感词过滤正常
- AI 风险审查正常
- 影子禁言正常

---

### Step 6.4 — 前端组件

**Problem**: 需要聊天页面、Todolist 组件、维护页面、熔断页面。

**Files**:
- `src/app/chat/page.tsx`
- `src/app/chat/maintenance/page.tsx`
- `src/app/chat/circuit-break/page.tsx`
- `src/components/chat/ChatRoom.tsx`
- `src/components/chat/TodoList.tsx`

**Actions**:

1. 聊天页面（`chat/page.tsx`）：
   - 检查聊天配置（是否开启、是否熔断）
   - 显示 Todolist 和 ChatRoom
   - 游客重定向到登录页

2. ChatRoom 组件：
   - 消息列表（自己的消息在右边，其他人的消息在左边）
   - 管理员消息显示"E"头像和"EZTor开发者"名称
   - 普通用户无头像，名称显示"EZTor用户" + 随机 emoji
   - 管理员可删除消息、禁言用户
   - 被禁言用户提示"你的消息仅管理员可见"
   - 发送框（多行，支持 Shift+Enter 换行）
   - 频率限制提示（每5秒只能发一条）
   - 消息长度限制（300字符）
   - 加载更多历史消息

3. TodoList 组件：
   - 显示所有 todos（所有用户可见）
   - 实时同步更新

4. 维护页面（`chat/maintenance/page.tsx`）：
   - 聊天关闭时显示"管理员正在维护中"

5. 熔断页面（`chat/circuit-break/page.tsx`）：
   - AI 检测到风险时显示"当前聊天内容有风险，已熔断"

**Verification**:
- 聊天页面正常显示
- 消息发送正常
- 管理员功能正常
- 影子禁言提示正常
- Todolist 实时同步
- 维护页面和熔断页面正常显示

---

### Step 6.5 — 导航栏入口

**Problem**: 需要在移动端导航栏添加聊天入口。

**Files**:
- `src/components/layout/MobileNavBar.tsx`

**Actions**:

1. 添加"反馈"入口：
   ```typescript
   const navItems = [
     { href: '/', label: '首页', icon: Home },
     { href: '/dictation', label: '默写', icon: PenTool },
     { href: '/history', label: '生词本', icon: BookOpen },
     { href: '/translate', label: '查词', icon: Search },
     { href: '/chat', label: '反馈', icon: MessageSquare },  // 新增
   ]
   ```

**Verification**:
- 导航栏显示"反馈"入口
- 点击跳转到聊天页面

---

### Step 6.6 — 风险审查增强

**Problem**: 需要保存风险消息、AI 思考过程、日志记录。

**Files**:
- `src/lib/riskDetection.ts`
- `src/app/api/chat/messages/route.ts`

**Actions**:

1. 优化 AI Prompt：
   - 添加详细的风险类型定义
   - 添加判断原则
   - 添加输出格式说明
   - 添加示例

2. 保存风险消息：
   - 在 `ChatMessage` 表添加 `isRisky`、`riskAnalysis` 字段
   - 触发熔断的消息保存到数据库

3. 保存 AI 思考过程：
   - `reason`：风险原因
   - `riskType`：风险类型
   - `confidence`：置信度
   - `rawResponse`：原始响应

4. 日志记录：
   - 使用 `logger` 记录风险审查日志
   - 记录消息内容（脱敏）、AI 响应、是否触发熔断

**Verification**:
- 风险消息正确保存
- AI 思考过程正确保存
- 日志记录正常

---

### Step 6.7 — 功能开关

**Problem**: 需要动态开启/关闭聊天功能。

**Files**:
- `prisma/schema.prisma`
- `src/app/api/chat/config/route.ts`
- `src/app/chat/page.tsx`
- `src/app/chat/disabled/page.tsx`

**Actions**:

1. 数据库：`ChatConfig` 添加 `featureEnabled` 字段

2. API：检查功能开关
   - 如果 `featureEnabled = false`，返回 404

3. 前端：
   - 检查功能开关，如果关闭则重定向到 `/chat/disabled`
   - 管理员可跳过检查

4. 新增 `/chat/disabled` 页面：
   - 显示"功能已关闭"

**Verification**:
- 功能开关正常工作
- 关闭后普通用户无法访问
- 管理员可正常访问

---

### Step 6.8 — API 失败熔断

**Problem**: LLM API 调用失败时需要提醒管理员。

**Files**:
- `src/lib/riskDetection.ts`
- `src/app/api/chat/messages/route.ts`
- `src/app/chat/api-failure/page.tsx`

**Actions**:

1. 检测 API 失败：
   - 如果 API 返回非 200 状态码
   - 如果网络请求失败

2. 连续失败计数：
   - `ChatConfig` 添加 `apiFailureCount` 字段
   - 每次失败计数 +1
   - 成功后重置为 0

3. 触发熔断：
   - 连续失败 3 次后触发熔断
   - 熔断类型：`api_failure`
   - 熔断原因：`LLM API 调用失败，请检查 API 额度`

4. 新增 `/chat/api-failure` 页面：
   - 显示"服务器资源不足，暂停该服务"

**Verification**:
- API 失败正确检测
- 连续失败计数正确
- 熔断正确触发
- 管理员可查看熔断原因

---

### Step 6.9 — 管理员面板

**Problem**: 管理员需要在 Analytics 页面管理聊天功能。

**Files**:
- `src/components/admin/ChatManagement.tsx`
- `src/app/analytics/page.tsx`
- `src/app/api/admin/todos/reorder/route.ts`

**Actions**:

1. 创建 `ChatManagement` 组件：
   - 聊天功能开关
   - 聊天入口开关
   - 熔断状态显示
   - 解除熔断按钮
   - 清除历史消息按钮（带确认弹窗）
   - 禁言列表（内联表格）
   - 自定义敏感词管理（批量添加、删除确认）
   - Todolist 管理（添加、编辑弹窗、删除确认、上下移动排序）

2. 在 Analytics 页面引入 `ChatManagement` 组件

3. 新增 `/api/admin/todos/reorder` API：
   - 批量更新排序

4. 管理员判定逻辑：
   - 使用 `session.user.isAdmin` 字段
   - 不硬编码用户名

**Verification**:
- 管理员面板正常显示
- 所有管理功能正常工作
- 权限控制正确

---

## Phase 7: UI 优化（已完成）

### Step 7.1 — HomeHeader 与侧边栏对齐

**Problem**: 桌面端 HomeHeader 与左侧边栏顶部样式不一致。

**Files**:
- `src/components/home/HomeHeader.tsx`

**Actions**:

1. 修改 HomeHeader 桌面端样式：
   - 背景色：`xl:bg-transparent` → `xl:bg-sidebar`
   - 边框颜色：`xl:border-border` → `xl:border-sidebar-border`
   - 布局方向：添加 `xl:flex-row xl:items-center`
   - 溢出处理：添加 `xl:overflow-hidden`
   - 压缩处理：添加 `xl:shrink-0`

2. 修改 nav 换行处理：
   - 添加 `xl:flex-nowrap`（防止按钮换行）

**Verification**:
- HomeHeader 与侧边栏顶部样式一致
- 边框颜色一致
- 背景色一致

---

### Step 7.2 — 闪卡布局优化

**Problem**: 移动端闪卡"显示答案"按钮需要滚动才能看到。

**Files**:
- `src/components/flashcard/FullscreenFlashcard.tsx`
- `src/components/home/HomeContent.tsx`

**Actions**:

1. FullscreenFlashcard 布局调整：
   - 容器：`h-full`（填充父容器）
   - 顶部工具栏：`shrink-0`（不收缩）
   - 闪卡内容：`flex-1 overflow-y-auto`（可滚动）
   - 底部按钮：`shrink-0`（不收缩，始终可见）

2. HomeContent 布局调整：
   - 外层容器：`h-screen flex flex-col`
   - 移动端闪卡区域：`flex-1 min-h-0`

**Verification**:
- 闪卡按钮始终可见，无需滚动
- 长释义可滚动查看

---

### Step 7.3 — 默写页面优化

**Problem**: 默写页面顶部标题无用，"开始测试"按钮需要滚动，长词条需要滚动。

**Files**:
- `src/app/dictation/page.tsx`

**Actions**:

1. 去掉顶部"多维默写本"标题
2. 修改布局：`h-screen flex flex-col`
3. "开始测试"按钮：`mt-auto shrink-0`（始终在底部）
4. 长词条：添加 `line-clamp-3` + 点击展开功能
5. 禁用自动滚动（注释掉 `scrollIntoView`）

**Verification**:
- 顶部标题已去掉
- "开始测试"按钮始终可见
- 长词条可点击展开
- 自动滚动已禁用

---

### Step 7.4 — 游客页面优化

**Problem**: 游客页面没有底栏，"查词"按钮跳转有问题。

**Files**:
- `src/components/home/HomeContent.tsx`
- `src/components/home/guest/GuestHomepage.tsx`
- `src/components/home/guest/GuestHomeHeader.tsx`
- `src/app/translate/page.tsx`
- `src/middleware.ts`

**Actions**:

1. 游客页面添加 MobileNavBar
2. 游客"查词"按钮跳转到 `/translate`
3. `/translate` 页面支持游客模式（使用 GuestWordInputCard）
4. 将 `/translate` 添加到 middleware 白名单
5. 移除游客页面"进群"按钮

**Verification**:
- 游客页面有底栏
- "查词"功能正常
- 游客可访问查词页面

---

## Execution Order

| Phase | Step | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| 0 | 0.1 User 表字段 | 🔴 高 | 无 | ✅ 已完成 |
| 0 | 0.2 ReviewGroup 表字段 | 🔴 高 | 无 | ✅ 已完成 |
| 0 | 0.3 创建系统分组脚本 | 🔴 高 | 0.1, 0.2 | ✅ 已完成 |
| 1 | 1.1 全屏闪卡组件 | 🔴 高 | 无 | ✅ 已完成 |
| 1 | 1.2 自动存入 API | 🔴 高 | 0.2 | ✅ 已完成 |
| 1 | 1.3 分组限制逻辑 | 🟡 中 | 0.2 | ✅ 已完成 |
| 1 | 1.4 移动端首页布局 | 🔴 高 | 1.1 | ✅ 已完成 |
| 2 | 2.1 引导状态管理 | 🔴 高 | 0.1 | ❌ 未实现 |
| 2 | 2.2 闪卡使用提示 | 🟡 中 | 1.1, 2.1 | ❌ 未实现 |
| 2 | 2.3 初次默写体验 | 🟡 中 | 2.1 | ❌ 未实现 |
| 2 | 2.4 生词本展示 | 🟡 中 | 2.1 | ❌ 未实现 |
| 2 | 2.5 词库导入介绍 | 🟢 低 | 2.1 | ❌ 未实现 |
| 2 | 2.6 功能探索提示 | 🟢 低 | 2.1 | ❌ 未实现 |
| 3 | 3.1 独立翻译页面 | 🟡 中 | 无 | ✅ 已完成 |
| 3 | 3.2 导航栏调整 | 🟡 中 | 3.1 | ✅ 已完成 |
| 4 | 4.1 保存进度 | 🟡 中 | 无 | ✅ 已完成 |
| 4 | 4.2 正向反馈 | 🟢 低 | 无 | ✅ 已完成 |
| 6 | 6.1 数据库设计 | 🔴 高 | 无 | ✅ 已完成 |
| 6 | 6.2 工具函数 | 🔴 高 | 6.1 | ✅ 已完成 |
| 6 | 6.3 API 设计 | 🔴 高 | 6.2 | ✅ 已完成 |
| 6 | 6.4 前端组件 | 🔴 高 | 6.3 | ✅ 已完成 |
| 6 | 6.5 导航栏入口 | 🟡 中 | 6.4 | ✅ 已完成 |
| 6 | 6.6 风险审查增强 | 🔴 高 | 6.3 | ✅ 已完成 |
| 6 | 6.7 功能开关 | 🟡 中 | 6.1 | ✅ 已完成 |
| 6 | 6.8 API失败熔断 | 🟡 中 | 6.1 | ✅ 已完成 |
| 6 | 6.9 管理员面板 | 🔴 高 | 6.3 | ✅ 已完成 |
| 7 | 7.1 HomeHeader 对齐 | 🟡 中 | 无 | ✅ 已完成 |
| 7 | 7.2 闪卡布局优化 | 🔴 高 | 无 | ✅ 已完成 |
| 7 | 7.3 默写页面优化 | 🟡 中 | 无 | ✅ 已完成 |
| 7 | 7.4 游客页面优化 | 🟡 中 | 无 | ✅ 已完成 |

建议按 Phase 执行，每完成一个 Phase 验证数据变化。

---

## 技术实现细节

### 数据库改动汇总

```prisma
// User 表新增
model User {
  // ... 现有字段
  onboardingCompleted Boolean @default(false)
}

// ReviewGroup 表新增
model ReviewGroup {
  // ... 现有字段
  isSystem Boolean @default(false)
}
```

### API 改动汇总

| API | 方法 | 功能 | 文件 |
|-----|------|------|------|
| `/api/flashcard/save-and-categorize` | POST | 保存单词到系统分组 | 新建 |
| `/api/onboarding/status` | GET | 检查是否需要引导 | 新建 |
| `/api/onboarding/complete` | POST | 标记引导完成 | 新建 |
| `/api/review-groups` | GET/POST | 修改分组限制逻辑 | 修改 |

### 前端改动汇总

| 组件/页面 | 改动类型 | 功能 |
|-----------|----------|------|
| `FullscreenFlashcard` | 新建 | 移动端全屏闪卡 |
| `OnboardingProvider` | 新建 | 引导状态管理 |
| `HomeContent.tsx` | 修改 | 移动端显示闪卡 |
| `GuestHomepage.tsx` | 修改 | 游客移动端显示闪卡 |
| `MobileNavBar.tsx` | 修改 | 导航栏调整 |
| `translate/page.tsx` | 新建 | 独立翻译页面 |
| `dictation/page.tsx` | 修改 | 保存进度 + 正向反馈 |

---

## 边界情况处理

### 1. 用户清空词库后 count === 0

**解决方案**：使用 `User.onboardingCompleted` 字段
- 一旦标记为 `true`，不再显示引导
- 即使用户清空词库，也不会重复引导

### 2. 用户换设备

**解决方案**：`onboardingCompleted` 存储在数据库
- 状态与账号绑定，不与设备绑定
- 换设备后状态同步

### 3. 用户删除账号重建

**解决方案**：新账号，重新引导
- 新用户的 `onboardingCompleted` 默认为 `false`
- 可以正常走引导流程

### 4. 游客（未登录用户）

**解决方案**：
- 游客移动端显示闪卡体验（限制词数，比如 10 个）
- 底部显示登录提示："登录后可保存学习进度 →"
- 不显示引导流程

### 5. 系统分组与自定义分组的显示

**解决方案**：
- 系统分组在分组列表中显示，但有特殊标记（如图标或颜色）
- 不计入 3 个分组限制
- 用户可以查看系统分组中的单词，但不能删除系统分组

---

## 验证清单

### Phase 0 验证
- [x] User 表有 `onboardingCompleted` 字段
- [x] ReviewGroup 表有 `isSystem` 字段
- [x] 所有现有用户都有两个系统分组

### Phase 1 验证
- [x] 移动端首页显示全屏闪卡
- [x] 点击"认识"存入"知道的单词"分组
- [x] 点击"不认识"存入"不知道的单词"分组
- [x] 系统分组不计入 3 个限制
- [x] 桌面端首页保持不变

### Phase 2 验证
- [ ] 新用户登录后显示引导
- [ ] 引导步骤 1：闪卡使用提示
- [ ] 引导步骤 2：初次默写 1 个单词
- [ ] 引导步骤 3：生词本展示
- [ ] 引导步骤 4：词库导入介绍
- [ ] 引导步骤 5：功能探索提示
- [ ] 引导完成后不再显示

### Phase 3 验证
- [x] 独立翻译页面可访问
- [x] 移动端导航栏有"查词"入口
- [x] 游客可访问查词功能

### Phase 4 验证
- [x] 默写中途退出可恢复进度
- [x] 默写完成有正向反馈
- [x] 去掉默写页面顶部标题
- [x] 禁用默写自动滚动
- [x] 长词条点击展开

### Phase 6 验证（实时聊天反馈系统）
- [x] 实时聊天（SSE）
- [x] 敏感词过滤（@2toad/profanity，支持中文）
- [x] AI 风险审查（每条消息）
- [x] 影子禁言（被禁言用户提示"你的消息仅管理员可见"）
- [x] Todolist（管理员维护，所有用户可见，实时同步）
- [x] 聊天配置（管理员可开启/关闭聊天入口）
- [x] 自定义敏感词（管理员可在面板中管理）
- [x] 历史消息（24小时后停止渲染，管理员可手动清除）
- [x] 频率限制（每5秒只能发一条消息）
- [x] 消息长度限制（300字符）
- [x] 加载更多历史消息
- [x] 熔断机制（AI 检测到风险自动关闭聊天）
- [x] 功能开关（数据库配置，动态切换）
- [x] API 失败熔断（连续 3 次失败触发）
- [x] 风险消息保存（管理员可查看触发熔断的消息）
- [x] AI 思考过程保存（reason, riskType, confidence, rawResponse）
- [x] 日志记录
- [x] 定时清理（风险消息 7 天后自动删除）
- [x] 批量添加敏感词
- [x] Todolist 上下移动排序
- [x] 删除确认框
- [x] 新增 /chat/disabled 功能关闭页面
- [x] 新增 /chat/api-failure API故障页面
- [x] Analytics 页面添加聊天管理、敏感词管理、Todolist 管理
- [x] 管理员判定逻辑打通 isAdmin 字段
- [x] emoji 列表扩展到 50 个，支持双 emoji 组合

### UI 优化验证
- [x] HomeHeader 与侧边栏对齐
- [x] 闪卡按钮始终可见（无需滚动）
- [x] 游客页面底栏显示
- [x] 游客闪卡功能正常
