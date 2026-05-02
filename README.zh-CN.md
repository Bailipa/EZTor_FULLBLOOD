<p align="center">
  <strong>中文</strong> · <a href="README.md">English</a>
</p>

# EZTor — 英语词汇学习平台

基于 Next.js 的全栈英语词汇学习应用，由大语言模型驱动。

## 技术栈

| 层        | 技术                                           |
| --------- | ---------------------------------------------- |
| 框架      | Next.js 16 (App Router)                        |
| 语言      | TypeScript                                     |
| 数据库    | PostgreSQL (Prisma ORM)                        |
| 认证      | NextAuth.js (JWT)                              |
| 界面      | React 19, Tailwind CSS 4, shadcn/ui, Radix UI  |
| 日志      | Pino                                           |
| 测试      | Vitest                                         |
| 部署      | Docker + docker-compose                        |

## 快速开始

```bash
cp .env.example .env
# 编辑 .env 填入你的配置

npm install
npx prisma generate
npx prisma migrate deploy
npm run dev        # → http://localhost:3000
```

## 核心功能

- **单词翻译** — 大模型驱动的英汉翻译，包含词性、音标、例句、可数性标注
- **仅翻译** — 快速翻译不保存，每天 30 次免费使用；支持自定义 API Key
- **词库** — 保存单词，创建复习组，导入 CET-4/CET-6 词汇
- **听写 / 复习** — 智能复习系统，支持分组、评分
- **TTS** — 文本转语音（Edge TTS）
- **弹幕** — 浮动单词展示，被动学习
- **井字棋** — 无限模式休闲小游戏
- **管理后台** — 数据分析、公共词库、翻译记录、用户管理、LLM 供应商池
- **安全** — CSRF 防护、提示词注入检测、限流、封禁升级、设备指纹

## 项目结构

```
src/
├── app/            # Next.js App Router（页面 + API 路由）
│   ├── api/        # REST API 端点
│   ├── analytics/  # 管理后台数据分析
│   ├── dictation/  # 听写 / 复习
│   ├── history/    # 翻译历史
│   ├── game/       # 井字棋游戏
│   └── ...
├── components/     # React 组件（UI、词库、分享、复习组）
├── lib/            # 工具库（日志、限流、封禁管理、LLM 池、缓存、安全）
├── services/       # 业务逻辑（TranslationService、CacheService、StreamHandler）
└── __tests__/      # 单元测试
```

## 文档

| 文档                                               | 说明                     |
| -------------------------------------------------- | ------------------------ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)       | 系统架构、设计模式、性能 |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)         | 管理员操作手册           |
| [docs/SECURITY.md](docs/SECURITY.md)               | 安全指南与密钥管理       |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)   | 数据库备份与恢复         |
| [prisma/schema.prisma](prisma/schema.prisma)       | 数据模型定义             |

## 许可证

GNU General Public License v3.0。详见 [LICENSE](LICENSE)。
