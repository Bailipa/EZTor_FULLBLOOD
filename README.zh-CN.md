<p align="center">
  <strong>中文</strong> · <a href="README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma" alt="Prisma">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/license-GPLv3-green" alt="License">
</p>

# EZTor — 英语词汇学习平台

**🌐 在线演示: [dogeggcode.cyou](https://eztor.dogeggcode.cyou)**

![EZTor Demo](https://raw.githubusercontent.com/Bailipa/EZTor_FULLBLOOD/main/yanshitupian.png)

基于 Next.js 的全栈英语词汇学习应用，由大语言模型驱动。

## 架构流程

```
用户输入 → 安全过滤（CSRF、注入检测、限流、封禁检查）
       → 缓存查询（LRU + DB）/ 请求去重
       → LLM Provider 池（故障转移、配额管理）
       → 翻译服务（Prompt 工程、质量评分）
       → 流式返回 → 同步词库
```

翻译流水线先经过多层安全过滤，然后查热缓存、选择 LLM 供应商（自动故障转移），对结果质量评分后流式返回给用户。高质量结果自动收录到公共词库，所有用户共享。

解决的核心痛点：

- **查词信息单薄** — LLM 给出完整上下文：音标、词性、例句、例句翻译
- **API 供应商锁定** — 可配置多供应商池，配额用尽（402）或限流（429）时自动切换
- **登录门槛** — 宽松的登录机制：无需手机号或邮箱验证
- **公网安全** — 5 层防御：CSRF、注入检测、限流、封禁升级、环境变量校验

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
