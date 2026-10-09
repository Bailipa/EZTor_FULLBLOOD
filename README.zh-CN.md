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

**🌐 在线演示: [EZTor](https://eztor.dogeggcode.cyou) · [公共词库](https://eztor.dogeggcode.cyou/public-vocabulary)**

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
- **听写 / 复习** — 智能复习系统，支持分组、评分和错词重测
- **错词本** — 长期汇总答错的单词，按错误次数排序并直接开始错词专练
- **公共词库** — 浏览、搜索公共词条，并下载全部词条或搜索结果 CSV
- **TTS** — 文本转语音（Edge TTS）
- **弹幕** — 浮动单词展示，被动学习
- **井字棋** — 无限模式休闲小游戏
- **管理后台** — 数据分析、公共词库、翻译记录、用户管理、LLM 供应商池
- **安全** — CSRF 防护、提示词注入检测、限流、封禁升级、设备指纹

## CET 真题阅读内容核对

本地内容包收录了 2025 年 12 月 CET6 第 1 套两篇仔细阅读：Passage One 讨论友谊与个人成功，46–49 答案为 **DADB**；第50题依据印刷解析PDF暂录 **B**。Passage Two 讨论种族公平与 Martin Luther King Jr. 的遗志，51–55 暂录 **CACDB**。题文和选项按逐句内容核对，包内答案解析为项目自编简析。

交叉核对来源：[新东方真题及答案汇总](https://mtoutiao.xdf.cn/cet4-6/202512/15047810.html)、[懒笔记第一篇逐题页](https://english-exam.lazynote.cn/cet6/sections/2025-12-1/part3-section-c/)和[第二篇逐题页](https://english-exam.lazynote.cn/cet6/sections/2025-12-1/part3-section-c-2/)、[过级鸭第二篇原题页](https://www.guojiya.cn/exam/cet6_2025_12_1/reading-passage-2)，以及[考研记印刷解析PDF的公开预览/OCR文本](https://www.yeyulingfeng.com/wendang/586891.html)（18页PDF，文档署名“公众号考研记”）。第50题，新东方汇总页给 C；考研记印刷解析逐项说明 B “No one can afford to neglect close friends” 符合全文，而 C “Collectivism is superior to individualism” 推论过度；懒笔记逐题页目前也给 B。因此内容包暂录 B，并保留新东方分歧，不把它表述为官方答案。第53题，新东方汇总页给 A；考研记印刷解析、懒笔记和过级鸭均给 C。C“继续追求 Martin Luther King Jr. 的事业”与原文 “by honoring King's legacy” 对应，因此内容包暂录 C，同时保留新东方分歧。这两份包仍是本地候选，尚未作为已核对的官方标准答案导入数据库。真题权利归属和再分发许可未核验，不代表官方背书或已获授权。

## 项目结构

```
src/
├── app/            # Next.js App Router（页面 + API 路由）
│   ├── api/        # REST API 端点
│   ├── analytics/  # 管理后台数据分析
│   ├── dictation/  # 听写 / 复习
│   ├── mistakes/   # 错词本
│   ├── public-vocabulary/ # 可浏览的公共词库
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

## 可复用开源模块

主平台拆出的独立模块：

- [EZTor SRS Core](https://github.com/Bailipa/eztor-srs-core) —— 间隔重复学习算法
- [EZTor Translation Quality](https://github.com/Bailipa/eztor-translation-quality) —— 可解释的词汇翻译质量评分
- [EZTor CET4 Original Content](https://github.com/Bailipa/eztor-cet-content) —— 结构化原创四级练习内容
- [EZTor English Forms](https://github.com/Bailipa/eztor-english-forms) —— 英语不规则词形和练习答案判断
- [EZTor Prompt Guard](https://github.com/Bailipa/eztor-prompt-guard) —— Prompt Injection 检测和 LLM 输入输出安全

## 许可证

GNU General Public License v3.0。详见 [LICENSE](LICENSE)。

## 本地四六级全量接入（2026-10-08）

用户提供的“四级”“六级”资料中，2020–2025 年四级 43 套、六级 43 套已导入本地题库，接入 `/study` 现有整卷、分项练习及试卷切换。2020 年前的资料不进入新作答列表，历史作答保留。原卷缺项、共用题序和未确认答案在页面提示；未确认答案不计分。资源、重建命令及核对范围见 [本地题库说明](content/cet-local/README.md)。本轮未部署生产，登录后的完整用户流程尚未验收。
