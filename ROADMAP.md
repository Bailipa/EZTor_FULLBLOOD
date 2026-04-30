# EZTor 开发路线图

> 本文档记录项目未来开发规划、功能设计和技术方案  
> **最后更新**：2026-04-29

***

## 目录

1. [小游戏开发](#1-小游戏开发)
2. [社交分享功能](#2-社交分享功能) ✅ 已完成
3. [开源评估](#3-开源评估)
4. [桌面弹幕插件](#4-桌面弹幕插件)
5. [并发查询冲突处理](#5-并发查询冲突处理) ✅ 已完成
6. [流量数据收集](#6-流量数据收集) ✅ 已完成
7. [版本检测机制](#7-版本检测机制) ✅ 已完成
8. [优先级与时间规划](#8-优先级与时间规划)

***

## 1. 小游戏开发

### 1.1 游戏概念

**名称：** 无限井字棋 (Infinite Tic-Tac-Toe)

**定位：** 非教育类休闲小游戏，用于碎片时间消遣

### 1.2 核心玩法

| 传统井字棋    | 魔改版           |
| -------- | ------------- |
| 3x3 固定网格 | 无限扩展网格        |
| 落子不可覆盖   | 可覆盖对方棋子（消耗能量） |
| 先三连获胜    | 三连获胜，或棋子数领先   |

### 1.3 详细规则

```
基础规则：
- 双方轮流落子，三连获胜
- 棋盘无边界，可向任意方向延伸

扩展规则：
- 每人有 3 点"能量"
- 覆盖对方棋子消耗 1 点能量
- 每 5 回合恢复 1 点能量

胜利条件：
- 三子连线（横/竖/斜）
- 或 50 回合后棋子数多者胜
```

### 1.4 技术方案

```typescript
// 技术栈
- 前端：React + Canvas/SVG
- 存储：localStorage（本地记录）
- 可选：WebSocket 实现双人对战

// 核心数据结构
interface GameState {
  board: Map<string, 'X' | 'O'>;  // key: "x,y" 坐标
  currentPlayer: 'X' | 'O';
  energy: { X: number; O: number };
  moveHistory: Move[];
  winner: 'X' | 'O' | null;
}

interface Move {
  position: { x: number; y: number };
  player: 'X' | 'O';
  isOverwrite: boolean;
  timestamp: number;
}
```

### 1.5 实现步骤

```
Phase 1: 基础框架 (1天)
├── 棋盘渲染组件
├── 落子交互逻辑
└── 基础胜负判断

Phase 2: 核心玩法 (1天)
├── 无限网格实现
├── 能量系统
└── 覆盖机制

Phase 3: 优化完善 (1天)
├── 动画效果
├── 音效反馈
├── 本地存档
└── 悔棋功能
```

### 1.6 潜在挑战

| 挑战       | 解决方案             |
| -------- | ---------------- |
| 无限网格渲染性能 | 视口裁剪 + 虚拟滚动      |
| 覆盖逻辑边界情况 | 单元测试覆盖           |
| 双人同步延迟   | WebSocket + 状态同步 |

***

## 2. 社交分享功能

### 2.1 分享场景设计

| 场景   | 分享内容            | 触发时机   |
| ---- | --------------- | ------ |
| 学习成果 | "我今天学习了50个单词！"  | 完成每日目标 |
| 默写成绩 | "默写得分95分，来挑战我！" | 默写结束   |
| 排行榜  | "我在EZTor排名第23名" | 查看排行榜  |
| 邀请注册 | "推荐一个好用的背词工具"   | 分享按钮   |

### 2.2 接口设计

```typescript
// 分享内容结构
interface ShareContent {
  title: string;
  description: string;
  image?: string;
  url: string;
}

// 支持的平台
const SHARE_PLATFORMS = {
  wechat: '微信好友/朋友圈',
  weibo: '微博',
  qq: 'QQ',
  copy: '复制链接',
  screenshot: '生成海报'
} as const;

// 分享服务
class ShareService {
  async share(platform: string, content: ShareContent): Promise<boolean> {
    // 平台特定分享逻辑
  }
  
  generatePoster(content: ShareContent): Promise<Blob> {
    // Canvas 生成分享海报
  }
  
  trackShare(event: ShareEvent): void {
    // 记录分享行为
  }
}
```

### 2.3 分享追踪

```typescript
// 分享事件记录
interface ShareEvent {
  id: string;
  userId: string;
  platform: string;
  contentType: 'achievement' | 'score' | 'invite' | 'leaderboard';
  timestamp: Date;
  referrerCode?: string;
  success: boolean;
}

// API 端点
// POST /api/share
// GET /api/share/stats
```

### 2.4 激励机制

| 行为       | 奖励        | 说明     |
| -------- | --------- | ------ |
| 首次分享     | 解锁皮肤      | 鼓励尝试分享 |
| 邀请好友注册   | 分组数量 +1   | 实质性奖励  |
| 好友完成首次学习 | 双方各得7天VIP | 双向激励   |

### 2.5 实现步骤

```
Phase 1: 基础分享 (1天)
├── 分享按钮组件
├── 复制链接功能
└── 分享计数

Phase 2: 平台集成 (1天)
├── 微信 JS-SDK 集成
├── 微博分享接口
└── QQ 分享接口

Phase 3: 海报生成 (0.5天)
├── Canvas 海报模板
├── 用户数据渲染
└── 下载/分享功能

Phase 4: 激励系统 (0.5天)
├── 邀请码生成
├── 奖励发放逻辑
└── 统计看板
```

***

## 3. 开源评估

### 3.1 当前状态评估

| 维度    | 评分   | 说明                 |
| ----- | ---- | ------------------ |
| 代码质量  | ⭐⭐⭐⭐ | TypeScript 完善，结构清晰 |
| 文档完整度 | ⭐⭐⭐  | 有架构文档，缺贡献指南        |
| 安全性   | ⭐⭐⭐⭐ | 多层防护，但需移除敏感配置      |
| 可部署性  | ⭐⭐⭐  | 需要完善部署文档           |
| 测试覆盖  | ⭐⭐   | 缺少自动化测试            |

### 3.2 开源前检查清单

#### 🔴 必须移除

```
├── dev.db              # 数据库文件
├── deploy/             # 构建产物
├── .env.local          # 本地环境变量
├── .env.production     # 生产环境变量
└── 任何 API Key 或密钥
```

#### 🟡 必须添加

```
├── LICENSE             # 许可证文件
├── CONTRIBUTING.md     # 贡献指南
├── .env.example        # 环境变量模板
├── CODE_OF_CONDUCT.md  # 行为准则
└── SECURITY.md         # 安全政策
```

#### 🟢 建议添加

```
├── .github/
│   ├── workflows/      # GitHub Actions
│   ├── ISSUE_TEMPLATE/ # Issue 模板
│   └── PULL_REQUEST_TEMPLATE.md
├── Dockerfile          # Docker 支持
├── docker-compose.yml  # 一键部署
└── docs/               # 详细文档
```

### 3.3 许可证选择

| 许可证        | 特点           | 适用场景   |
| ---------- | ------------ | ------ |
| **MIT** ✅  | 最宽松，仅需保留版权声明 | 个人项目推荐 |
| Apache 2.0 | 包含专利授权条款     | 商业友好   |
| GPL 3.0    | 衍生作品必须开源     | 保护开源生态 |

### 3.4 风险与收益分析

| 收益              | 风险            |
| --------------- | ------------- |
| ✅ 简历加分，展示技术能力   | ⚠️ 代码被抄袭      |
| ✅ 获得社区贡献和反馈     | ⚠️ Issue 维护压力 |
| ✅ 建立技术影响力       | ⚠️ 安全漏洞暴露     |
| ✅ 可能获得 Star 和关注 | ⚠️ 需要持续维护     |

### 3.5 开源时机建议

**当前建议：暂缓开源**

理由：

1. 项目还在快速迭代期
2. 缺少完善的文档和测试
3. 可能包含商业敏感信息

**开源时机：**

- [ ] 用户量稳定（>100 DAU）
- [ ] 功能基本完善
- [ ] 文档齐全
- [ ] 测试覆盖率 > 60%
- [ ] 无敏感信息残留

***

## 4. 桌面弹幕插件

### 4.1 技术选型

| 方案        | 体积      | 性能 | 开发难度 | 推荐度   |
| --------- | ------- | -- | ---- | ----- |
| Electron  | \~150MB | 中  | 低    | ⭐⭐⭐   |
| **Tauri** | \~10MB  | 高  | 中    | ⭐⭐⭐⭐⭐ |
| Flutter   | \~20MB  | 高  | 中    | ⭐⭐⭐   |

**推荐：Tauri**（Rust + WebView，体积小，性能好）

### 4.2 系统架构

```
┌─────────────────────────────────────┐
│           桌面弹幕插件               │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  │
│  │  弹幕窗口   │  │  设置面板   │  │
│  │  (透明置顶) │  │  (系统托盘) │  │
│  └──────┬──────┘  └──────┬──────┘  │
│         │                │         │
│         └───────┬────────┘         │
│                 ▼                  │
│  ┌─────────────────────┐          │
│  │   本地 SQLite       │          │
│  │   (离线词库缓存)     │          │
│  └──────────┬──────────┘          │
│             │                      │
│             ▼                      │
│  ┌─────────────────────┐          │
│  │   Web 服务 API      │          │
│  │   (同步用户词库)     │          │
│  └─────────────────────┘          │
└─────────────────────────────────────┘
```

### 4.3 核心功能模块

```typescript
// 弹幕配置
interface DanmakuConfig {
  speed: number;           // 速度 1-5
  opacity: number;         // 透明度 0.3-1.0
  fontSize: number;        // 字号 12-24
  position: 'top' | 'middle' | 'bottom';
  interval: number;        // 弹出间隔（秒）
  showTranslation: boolean;
  autoPause: boolean;      // 全屏时暂停
}

// 同步配置
interface SyncConfig {
  serverUrl: string;
  userId: string;
  authToken: string;
  syncInterval: number;    // 同步间隔（分钟）
}

// 弹幕数据
interface DanmakuWord {
  word: string;
  translation: string;
  phonetic?: string;
  lastShown?: Date;
  correctCount: number;
  incorrectCount: number;
}
```

### 4.4 安全设计

```typescript
// 认证流程
// 1. 用户在 Web 端生成 Token
// 2. 桌面端扫码/输入 Token
// 3. 本地加密存储 Token

// Token 存储
import { safeStorage } from 'electron';

async function saveToken(token: string) {
  const encrypted = safeStorage.encryptString(token);
  await store.set('auth_token', encrypted);
}

// API 请求
async function fetchWords() {
  const token = await decryptToken();
  return fetch(`${serverUrl}/api/danmaku`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

### 4.5 实现步骤

```
Phase 1: 基础框架 (3天)
├── Tauri 项目初始化
├── 透明窗口实现
├── 系统托盘集成
└── 基础设置界面

Phase 2: 弹幕渲染 (2天)
├── 弹幕动画引擎
├── 多弹幕并发控制
├── 碰撞检测
└── 性能优化

Phase 3: 数据同步 (2天)
├── 本地数据库设计
├── API 对接
├── 增量同步
└── 离线支持

Phase 4: 打包分发 (1天)
├── Windows 安装包
├── macOS DMG
├── 自动更新
└── 错误上报

Phase 5: 管理后台 (1天)
├── 管理员审核界面
├── 内容过滤
└── 用户管理
```

### 4.6 技术挑战

| 挑战             | 解决方案       |
| -------------- | ---------- |
| Windows 透明窗口权限 | 使用 DWM API |
| 不同 DPI 缩放适配    | 动态计算缩放比    |
| 游戏模式性能影响       | 检测全屏自动暂停   |
| macOS 权限限制     | 使用 NSPanel |

***

## 5. 并发查询冲突处理

### 5.1 问题场景

```
时间线：
T0: 用户A 查询 "apple" → AI 返回 "苹果"
T0: 用户B 查询 "apple" → AI 返回 "苹果（水果）"
T1: 公共词库应该存哪个？
```

### 5.2 解决方案对比

| 方案       | 优点   | 缺点        | 推荐度   |
| -------- | ---- | --------- | ----- |
| 先到先得     | 简单高效 | 可能存入低质量翻译 | ⭐⭐⭐   |
| **质量评分** | 保证质量 | 需要评分逻辑    | ⭐⭐⭐⭐⭐ |
| 用户投票     | 民主决策 | 需要用户参与    | ⭐⭐⭐   |
| 保留多版本    | 完整性  | 存储成本高     | ⭐⭐    |

### 5.3 推荐方案：质量评分

```typescript
// 质量评分模型
interface WordQuality {
  hasPhonetic: boolean;      // 有音标 +10
  hasExample: boolean;       // 有例句 +10
  hasExampleTranslation: boolean; // 例句翻译 +5
  translationLength: number; // 翻译长度适中 +5
  posCount: number;          // 词性数量 +5/个
}

function calculateQualityScore(word: WordData): number {
  let score = 0;
  
  if (word.phonetic) score += 10;
  if (word.example) score += 10;
  if (word.exampleTranslation) score += 5;
  if (word.translation.length > 5 && word.translation.length < 100) score += 5;
  if (word.pos) {
    score += (word.pos.split('/').length * 5);
  }
  
  return score;
}

// 保存逻辑
async function saveWithQualityCheck(wordData: WordData) {
  const existing = await prisma.publicWord.findUnique({
    where: { word: wordData.word }
  });
  
  if (!existing) {
    return prisma.publicWord.create({ data: wordData });
  }
  
  const existingScore = calculateQualityScore(existing);
  const newScore = calculateQualityScore(wordData);
  
  if (newScore > existingScore) {
    console.log(`Updating "${wordData.word}" with better quality (${existingScore} → ${newScore})`);
    return prisma.publicWord.update({
      where: { word: wordData.word },
      data: {
        ...wordData,
        version: { increment: 1 }
      }
    });
  }
}
```

### 5.4 数据模型扩展

```prisma
model PublicWord {
  id                 String   @id @default(cuid())
  word               String   @unique
  phonetic           String?
  pos                String?
  translation        String
  example            String?
  exampleTranslation String?
  qualityScore       Int      @default(0)
  version            Int      @default(1)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([qualityScore])
}
```

### 5.5 用户通知机制

```typescript
// 当用户查询的词有更新版本时
interface WordWithNotice extends WordResult {
  notice?: {
    type: 'update_available';
    message: string;
    newVersion: number;
  };
}

async function getWordWithNotice(word: string, userId: string): Promise<WordWithNotice> {
  const userWord = await prisma.word.findFirst({
    where: { word, userId }
  });
  
  const publicWord = await prisma.publicWord.findUnique({
    where: { word }
  });
  
  if (userWord && publicWord && publicWord.version > (userWord.version || 1)) {
    return {
      ...userWord,
      notice: {
        type: 'update_available',
        message: '该词有更新版本的翻译',
        newVersion: publicWord.version
      }
    };
  }
  
  return userWord || publicWord;
}
```

***

## 6. 流量数据收集

### 6.1 核心指标 (KPI)

#### 用户指标

| 指标   | 定义     | 计算方式        |
| ---- | ------ | ----------- |
| DAU  | 日活跃用户数 | 当日登录用户数     |
| MAU  | 月活跃用户数 | 30天内登录用户数   |
| 新增用户 | 新注册用户数 | 当日注册用户数     |
| 留存率  | 用户回访比例 | 次日/7日/30日留存 |

#### 功能指标

| 指标     | 定义       | 目标值  |
| ------ | -------- | ---- |
| 翻译次数   | 每日翻译请求总数 | -    |
| 翻译成功率  | 成功/总请求   | >95% |
| 默写完成率  | 完成数/开始数  | >60% |
| 平均学习时长 | 每次会话时长   | >5分钟 |

#### 性能指标

| 指标       | 定义       | 目标值    |
| -------- | -------- | ------ |
| API 响应时间 | 平均响应时间   | <500ms |
| 错误率      | 错误请求/总请求 | <1%    |
| 可用性      | 服务正常运行时间 | >99.9% |

### 6.2 技术方案

#### 方案一：轻量级自建（推荐初期）

```typescript
// 数据模型
model AnalyticsEvent {
  id        String   @id @default(cuid())
  eventType String
  userId    String?
  sessionId String?
  metadata  String   // JSON
  createdAt DateTime @default(now())

  @@index([eventType])
  @@index([createdAt])
  @@index([userId])
}

// 事件类型枚举
enum EventType {
  PAGE_VIEW
  TRANSLATE
  DICTATION_START
  DICTATION_COMPLETE
  LOGIN
  LOGOUT
  SHARE
  ERROR
}

// 追踪服务
class AnalyticsService {
  async track(event: EventType, metadata?: object): Promise<void> {
    await prisma.analyticsEvent.create({
      data: {
        eventType: event,
        userId: getCurrentUserId(),
        sessionId: getSessionId(),
        metadata: JSON.stringify(metadata || {})
      }
    });
  }
  
  async getDailyStats(date: Date): Promise<DailyStats> {
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));
    
    return {
      dau: await this.getDAU(start, end),
      translations: await this.getEventCount('TRANSLATE', start, end),
      errors: await this.getEventCount('ERROR', start, end)
    };
  }
}
```

#### 方案二：第三方服务（推荐后期）

| 工具               | 特点      | 适用场景 |
| ---------------- | ------- | ---- |
| Google Analytics | 免费，功能全  | 通用   |
| Umami            | 开源，隐私友好 | 隐私敏感 |
| 百度统计             | 国内访问快   | 国内用户 |
| Mixpanel         | 事件分析强   | 产品分析 |

### 6.3 隐私合规

```typescript
// 数据脱敏
interface SafeAnalyticsEvent {
  eventType: string;
  userIdHash: string;  // 哈希后的用户ID
  sessionId: string;   // 匿名会话ID
  timestamp: Date;
  // 不收集：IP、设备指纹、精确位置
}

// 用户同意
const CONSENT_KEY = 'analytics_consent';

function requestConsent(): boolean {
  const consent = localStorage.getItem(CONSENT_KEY);
  if (consent === null) {
    // 显示同意弹窗
    showConsentDialog();
    return false;
  }
  return consent === 'true';
}

// GDPR 合规
function handleConsent(accepted: boolean) {
  localStorage.setItem(CONSENT_KEY, String(accepted));
  if (!accepted) {
    // 禁用追踪
    disableAnalytics();
  }
}
```

### 6.4 数据看板

```typescript
// 管理员看板 API
// GET /api/admin/analytics

interface DashboardData {
  overview: {
    dau: number;
    mau: number;
    newUsersToday: number;
    retention: {
      day1: number;
      day7: number;
      day30: number;
    };
  };
  trends: {
    date: string;
    dau: number;
    translations: number;
    errors: number;
  }[];
  topFeatures: {
    feature: string;
    usage: number;
  }[];
}
```

***

## 7. 版本检测机制

> **状态**：✅ 已完成 — 版本检测基础逻辑已集成，更新通知 UI 已通过客户端组件实现。

当前通过 `package.json` 中的 `version` 字段（0.3.0）标识版本，部署时更新即可。热更新（Vercel/PM2 自动部署）和数据库迁移回滚策略详见 [PROJECT_ASSESSMENT.md](./PROJECT_ASSESSMENT.md) 及 [prisma/BACKUP_RESTORE.md](./prisma/BACKUP_RESTORE.md)。

***

## 8. 优先级与时间规划

### 8.1 功能优先级矩阵

| 功能     | 优先级   | 开发时间 | 价值   | 紧急度 | 状态    |
| ------ | ----- | ---- | ---- | --- | ----- |
| 流量数据收集 | 🔴 P0 | 1天   | 运营基础 | 高   | ✅ 已完成 |
| 并发冲突处理 | 🔴 P0 | 0.5天 | 数据质量 | 高   | ✅ 已完成 |
| 版本检测   | 🟡 P1 | 0.5天 | 用户体验 | 中   | ✅ 已完成 |
| 社交分享   | 🟡 P1 | 2天   | 用户增长 | 中   | ✅ 已完成 |
| 数据库重构   | 🔴 P0 | 2天   | 数据质量 | 高   | ✅ 已完成 |
| 安全加固   | 🔴 P0 | 3天   | 安全基础 | 高   | ✅ 已完成 |
| 小游戏    | 🟢 P2 | 3天   | 用户留存 | 低   | 待开发   |
| 桌面弹幕   | 🟢 P3 | 9天   | 高级功能 | 低   | 待开发   |
| 开源准备   | ⏸️ 暂缓 | 3天   | 品牌建设 | 低   | 待开发   |

### 8.2 开发路线图

```
已完成 (截至 2026-04-29):
├── 流量数据收集系统 ✅
├── 并发冲突处理 + 质量评分 ✅
├── 版本检测 + 更新通知 ✅
├── 社交分享功能 (创建/导入/验证/默认词库) ✅
├── 数据库重构 (sourceType/publicWordId 引用模式) ✅
├── 安全加固 (CSRF/注入检测/频率限制/封禁管理/环境校验) ✅
├── 全站点骨架屏 + 错误边界 ✅
└── 首页 SSR + SEO 优化 ✅

规划中:
├── 小游戏开发 (无限井字棋)
├── CI/CD 自动化流水线
├── 测试覆盖率提升
└── 开源准备
```

### 8.3 里程碑

| 里程碑 | 目标          | 预计完成   | 状态    |
| --- | ----------- | ------ | ----- |
| M1  | 上线基础版       | -      | ✅ 已完成 |
| M2  | 数据收集 + 质量评分 | 2026-04 | ✅ 已完成 |
| M3  | 社交分享 + 安全加固 | 2026-04 | ✅ 已完成 |
| M4  | 小游戏上线       | 待定     | 待开发   |
| M5  | 用户量 100+    | 进行中   | 进行中   |
| M6  | CI/CD + 测试覆盖 | 待定     | 待开发   |

***

## 附录

### A. 相关文档

- [PROJECT_ASSESSMENT.md](./PROJECT_ASSESSMENT.md) - 项目健壮性与可部署性评估
- [architecture-diagrams.md](./architecture-diagrams.md) - 系统架构图
- [docs/ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) - 管理员手册
- [docs/SECRET_MANAGEMENT.md](./docs/SECRET_MANAGEMENT.md) - 密钥安全管理规范
- [prisma/BACKUP_RESTORE.md](./prisma/BACKUP_RESTORE.md) - 数据库备份恢复指南

### B. 更新日志

| 日期         | 更新内容                |
| ---------- | ------------------- |
| 2026-04-04 | 初始版本，规划七大功能模块       |
| 2026-04-05 | 完成流量数据收集系统 + 并发冲突处理 |
| 2026-04-29 | 更新功能状态、修复过期引用、精简已弃用章节 |

***

*本文档将随项目进展持续更新*
