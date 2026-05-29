# 部署报告 — 2026-05-29

## 概述

本次部署包含新手引导优化、暗色模式适配、文档更新，以及数据库迁移。

---

## 一、更新内容

### 1.1 新手引导优化

**提交**: `ca5b350`

| 功能 | 修改前 | 修改后 |
|------|--------|--------|
| 引导方式 | 点击"下一步"按钮推进 | 交互式指引，箭头指向目标按钮 |
| 步骤1→2跳转 | 无自动跳转 | 点击"认识"/"不认识"后自动跳转到默写页 |
| 步骤2默写 | 显示全屏遮罩，需点击"开始默写" | Tooltip覆盖"开始测试"按钮，点击"知道了"后自动开始1个单词默写 |
| 步骤5→6跳转 | 无自动跳转 | 点击"知道了"后跳转到/chat页面，自动推进步骤 |
| 页面导航 | `window.location.href`（硬导航，状态丢失） | `router.push()`（客户端导航，状态保持） |
| 桌面端 | 显示所有步骤 | 自动跳过步骤5（反馈聊天介绍） |
| 统计重复计数 | 闪卡和默写都更新correctCount/incorrectCount | 闪卡只更新totalAttempts，不影响正确/错误统计 |

**修改文件**:
- `src/components/onboarding/OnboardingTooltip.tsx` — 添加箭头指引、center定位
- `src/components/onboarding/OnboardingProvider.tsx` — localStorage保存步骤、桌面端跳过步骤5
- `src/components/flashcard/FullscreenFlashcard.tsx` — 步骤1完成后自动跳转
- `src/app/dictation/page.tsx` — 步骤2 Tooltip覆盖、自动开始默写
- `src/app/history/page.tsx` — 步骤4使用router.push
- `src/components/layout/MobileNavBar.tsx` — 步骤5使用router.push
- `src/components/home/HomeContent.tsx` — 步骤6底部卡片+Tooltip
- `src/app/chat/page.tsx` — 到达后自动推进步骤
- `src/app/api/flashcard/save-and-categorize/route.ts` — 不更新correctCount/incorrectCount

### 1.2 暗色模式适配

**提交**: `b3d6866`

| 文件 | 修改内容 |
|------|---------|
| `src/app/auth/signin/page.tsx` | 小应登录按钮暗色模式样式（背景、边框、文字、图标） |
| `src/components/vocabulary/WordCard.tsx` | 5处硬编码灰色颜色添加dark:变体 |
| `src/app/public-words/page.tsx` | 39处硬编码灰色颜色添加dark:变体 |

### 1.3 文档更新

**提交**: `3e154b4`

更新 `docs/GROWTH_OPTIMIZATION.md`：
- 步骤2.2~2.7的描述与实际实现同步
- 验证清单Phase 2添加新验证项

---

## 二、部署过程

### 2.1 数据库迁移

**发现的问题**: 本地schema与线上数据库不一致

| 差异 | 说明 |
|------|------|
| `User.onboardingCompleted` 字段 | 本地有，线上无 |
| `ReviewGroup.isSystem` 字段 | 本地有，线上无 |
| `ChatMessage` 表 | 本地有，线上无 |
| `ChatBan` 表 | 本地有，线上无 |
| `ChatConfig` 表 | 本地有，线上无 |
| `AdminTodo` 表 | 本地有，线上无 |
| `CustomProfanity` 表 | 本地有，线上无 |

**迁移文件**:
1. `20260529000001_add_chat_tables_and_onboarding` — 添加chat相关表和onboardingCompleted字段
2. `20260529000002_add_is_system_to_review_group` — 添加isSystem字段

### 2.2 部署步骤

1. 本地构建 `npm run build`
2. 复制静态文件 `cp -r .next/static .next/standalone/.next/static`
3. 复制public目录 `cp -r public .next/standalone/public`
4. 复制.env文件 `cp .env .next/standalone/.env`
5. 打包上传 `tar -czf` + `scp`
6. 服务器备份旧版本
7. 解压新版本
8. 运行数据库迁移 `prisma migrate deploy`
9. 重启PM2 `pm2 restart cet4-web`

---

## 三、Bug出现与修复

### Bug 1: 小应登录按钮黑暗模式文字不可见

**现象**: 小应快速登录按钮在黑暗模式下文字不可见

**原因**: 按钮使用硬编码的 `bg-white text-neutral-900`，没有dark:变体

**修复**: 按照小应按钮设计规范添加暗色模式样式
```
dark:border-neutral-200 dark:bg-[#171722] dark:text-neutral-50 dark:hover:bg-[#20202c]
图标: dark:brightness-0 dark:invert
```

### Bug 2: 新手引导步骤间跳转后状态丢失

**现象**: 步骤1完成后跳转到默写页，步骤被重置为1

**原因**: 使用 `window.location.href` 进行硬导航，导致页面重新加载，`OnboardingProvider`状态丢失

**修复**: 
1. 使用 `router.push()` 替代 `window.location.href`
2. `OnboardingProvider` 将步骤保存到 localStorage，页面跳转后恢复

### Bug 3: 新手引导步骤2自动开始默写不生效

**现象**: 添加了useEffect自动开始默写，但实际进入页面后仍显示配置页面

**原因**: `setTestCount(1)` 是异步的，`startTest()` 调用时 `testCount` 还是旧值

**修复**: 修改 `startTest()` 和 `fetchWords()` 函数，接受可选的 `overrideCount` 参数

### Bug 4: 步骤5点击"知道了"后跳转到首页而非/chat

**现象**: 点击"知道了"后页面跳转到首页

**原因**: `nextStep()` 改变状态导致组件重新渲染，干扰了 `router.push('/chat')` 的执行

**修复**: 步骤5的"知道了"只调用 `router.push('/chat')`，不调用 `nextStep()`。在chat页面的useEffect中检测步骤5并自动推进

### Bug 5: 部署后静态文件404

**现象**: `xiaoying-icon.svg`、`site-config.json`、`sounds/correct.mp3` 等返回404

**原因**: standalone目录中缺少 `public` 目录

**修复**: 构建后手动复制 `cp -r public .next/standalone/public`

### Bug 6: api/review-groups 返回500

**现象**: 登录后 `api/review-groups` 接口返回500错误

**原因**: `ReviewGroup` 表缺少 `isSystem` 字段，Prisma查询报错

**修复**: 创建迁移文件添加 `isSystem` 字段，运行 `prisma migrate deploy`

---

## 四、经验教训

1. **standalone模式必须手动复制public目录** — Next.js standalone不会自动包含public目录
2. **页面跳转使用router.push而非window.location.href** — 硬导航会导致React状态丢失
3. **部署前检查数据库schema一致性** — 本地开发可能使用 `prisma db push` 跳过迁移文件
4. **setState是异步的** — 在setState后立即读取状态可能得到旧值
5. **跨组件导航时注意状态竞争** — `nextStep()` 触发的re-render可能干扰 `router.push()`

---

## 五、回退方案

如果需要回退到旧版本：

```bash
sshpass -p 'Linux666' ssh root@114.55.58.90
cd /www/wwwroot/114.55.58.90/.next
ls -la standalone.bak.*  # 查看备份列表
mv standalone standalone.failed
mv standalone.bak.20260529_xxxxxx standalone
pm2 restart cet4-web
```

数据库迁移是增量的（只添加新表/新列），回退代码不会影响数据库。
