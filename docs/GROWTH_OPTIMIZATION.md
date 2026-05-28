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

## Phase 5: 访问深度提升（保留原有方案）

### Step 5.1 — 浏览器通知复习提醒

**Problem**: 72% 的用户只访问一次就走了，不回来复习。

**Files**:
- 新增 `src/components/ReviewReminder.tsx`
- `src/app/layout.tsx`（引入组件）

**Actions**:

1. 创建 `ReviewReminder` 组件，在用户有单词且今天未访问时显示
2. 使用 `Notification API` 请求权限并发送复习提醒
3. 提醒频率：每天最多 1 次，在用户上次访问时间附近
4. 用 `localStorage` 记录上次提醒时间和用户是否授权
5. 只在用户已登录且有单词时触发

**Verification**:
- 用户授权通知后，次日收到复习提醒
- 点击通知打开默写页面
- 不重复提醒

---

### Step 5.2 — 学习数据可视化

**Problem**: 用户看不到自己的进步，缺乏持续学习的动力。

**Files**:
- 新增 `src/app/progress/page.tsx`
- `src/components/layout/MobileNavBar.tsx`（添加导航入口）

**Actions**:

1. 创建 `/progress` 页面，展示用户学习数据：
   - 本周学习天数
   - 总掌握单词数（正确率 > 80% 的词）
   - 默写正确率趋势（最近 7 天）
   - 每日新增单词数
2. 数据从 `Word` 表和 `AnalyticsEvent` 表查询
3. 在移动端导航栏添加"进度"入口

**Verification**:
- 访问 `/progress` 显示学习数据
- 数据与实际情况一致
- 移动端导航可访问

---

## Execution Order

| Phase | Step | 优先级 | 依赖 |
|-------|------|--------|------|
| 0 | 0.1 User 表字段 | 🔴 高 | 无 |
| 0 | 0.2 ReviewGroup 表字段 | 🔴 高 | 无 |
| 0 | 0.3 创建系统分组脚本 | 🔴 高 | 0.1, 0.2 |
| 1 | 1.1 全屏闪卡组件 | 🔴 高 | 无 |
| 1 | 1.2 自动存入 API | 🔴 高 | 0.2 |
| 1 | 1.3 分组限制逻辑 | 🟡 中 | 0.2 |
| 1 | 1.4 移动端首页布局 | 🔴 高 | 1.1 |
| 2 | 2.1 引导状态管理 | 🔴 高 | 0.1 |
| 2 | 2.2 闪卡使用提示 | 🟡 中 | 1.1, 2.1 |
| 2 | 2.3 初次默写体验 | 🟡 中 | 2.1 |
| 2 | 2.4 生词本展示 | 🟡 中 | 2.1 |
| 2 | 2.5 词库导入介绍 | 🟢 低 | 2.1 |
| 2 | 2.6 功能探索提示 | 🟢 低 | 2.1 |
| 3 | 3.1 独立翻译页面 | 🟡 中 | 无 |
| 3 | 3.2 导航栏调整 | 🟡 中 | 3.1 |
| 4 | 4.1 保存进度 | 🟡 中 | 无 |
| 4 | 4.2 正向反馈 | 🟢 低 | 无 |
| 5 | 5.1 复习提醒 | 🟡 中 | 无 |
| 5 | 5.2 学习数据 | 🟢 低 | 无 |

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
- [ ] User 表有 `onboardingCompleted` 字段
- [ ] ReviewGroup 表有 `isSystem` 字段
- [ ] 所有现有用户都有两个系统分组

### Phase 1 验证
- [ ] 移动端首页显示全屏闪卡
- [ ] 点击"认识"存入"知道的单词"分组
- [ ] 点击"不认识"存入"不知道的单词"分组
- [ ] 系统分组不计入 3 个限制
- [ ] 桌面端首页保持不变

### Phase 2 验证
- [ ] 新用户登录后显示引导
- [ ] 引导步骤 1：闪卡使用提示
- [ ] 引导步骤 2：初次默写 1 个单词
- [ ] 引导步骤 3：生词本展示
- [ ] 引导步骤 4：词库导入介绍
- [ ] 引导步骤 5：功能探索提示
- [ ] 引导完成后不再显示

### Phase 3 验证
- [ ] 独立翻译页面可访问
- [ ] 移动端导航栏有"查词"入口

### Phase 4 验证
- [ ] 默写中途退出可恢复进度
- [ ] 默写完成有正向反馈

### Phase 5 验证
- [ ] 浏览器通知复习提醒
- [ ] 学习数据可视化页面
