# 当 AI 成为你的运维搭档：一次 TTS 语音系统的深度优化实学

> 从"读单词像便秘"到"每个音节都清晰"——记一次与 AI 协作的全栈优化之旅

## 背景

[EZTor](https://eztor.dogeggcode.cyou) 是一个基于 LLM 的英语词汇学习平台，核心功能之一是单词发音（TTS）。用户点击播放按钮，系统调用小米 MiMo TTS API 生成语音。

问题出在两个地方：

1. **发音错误**：某些单词的 TTS 发音与实际发音相差甚远，比如 "advertisement" 被读成 "advertisemations"
2. **音标错误**：AI 翻译生成的音标有时是错的，比如 "obsessing" 的音标 `/əˈbesɪŋ/` 应该是 `/əbˈsesɪŋ/`

这两个问题叠加在一起，用户体验极差——看到错误的音标，听到错误的发音，学习效果适得其反。

## 与 AI 的对话策略

这次优化全程通过与 AI 编程助手的对话完成。我的策略是：

### 第一步：让 AI 先摸清家底

不是一上来就改代码，而是先让 AI 阅读项目结构、理解现有实现。我告诉它：

> "了解一下项目情况，部署环境内容看 skill 里面的"

AI 自动读取了项目文件、部署脚本、PM2 配置、nginx 配置，甚至翻出了 `vendor/edgeTTS-openai-api/` 这个废弃的 Edge TTS 封装。这一步花了 2 分钟，但省去了后面 20 分钟的解释时间。

### 第二步：把需求清单喂给它

我给了它一份待办清单：

```
6.7 发现了AI生成的音标错误：obsessing[/əˈbesɪŋ/]❌,[əbˈsesɪŋ]✅
6.1 修复TTS发音奇怪的问题，例如scoff的发音
6.7 发现了缓存命中带来的不便
6.7 重构翻译系统
...
```

AI 自动分类、排序，问我从哪个开始。我选了 TTS 相关的三个问题。

### 第三步：让 AI 做方案，我做决策

AI 提出了多个方案，我通过选择题快速决策：

- **TTS 引擎**：它问我要不要换 Edge TTS，我告诉它"网络环境原因用不了，MiMo 就是从 Edge TTS 替换过来的"
- **音标验证**：它推荐本地 IPA 词典校验，我同意
- **客户端缓存**：它推荐 IndexedDB，我同意

关键决策点上，我给出明确的约束条件，AI 在约束内寻找最优解。

### 第四步：部署时保持警惕

AI 生成了代码、通过了 lint 和测试，但部署时我特意提醒：

> "先不要部署，上线上环境看一下，今天我在服务器上新部署了一个项目，资源可能有点吃紧"

果然，服务器内存紧张，SSH 连接不稳定。AI 先检查了资源状况，确认够用后才开始部署。

## 优化内容

### 1. MiMo TTS 升级：v2 → v2.5

小米的 MiMo TTS v2 将于 2026 年 6 月 30 日下线，v2.5 系列在发音质量上有明显提升。

**改动**：
```typescript
// 之前
const MIMO_MODEL = 'mimo-v2-tts'
const MIMO_VOICE = process.env.MIMO_VOICE || 'default_en'

// 之后
const MIMO_MODEL = 'mimo-v2.5-tts'
const MIMO_VOICE = process.env.MIMO_VOICE || 'Milo'
```

**音色选择**：通过写一个小脚本，让 4 个音色（Mia、Chloe、Milo、Dean）分别朗读 "advertisement"，逐一对比，最终选定 Milo。

### 2. IPA 词典音标校验

引入 `ipa-dict` 包（125,928 条美式英语 IPA 数据），在 LLM 返回翻译结果后自动校验音标。

**工作流程**：
```
LLM 返回 phonetic: /əˈbesɪŋ/  (错误)
        ↓
查 IPA 词典 obsessing → /əbˈsɛsɪŋ/  (正确)
        ↓
用词典值替换 LLM 值
        ↓
存入数据库的音标是正确的
```

**新建文件** `src/lib/phoneticValidator.ts`：
- `validatePhonetic(word, llmPhonetic)` — 校验并修正音标
- `getIPA(word)` — 查询词典获取 IPA（为后续 TTS 发音提示预留）

### 3. IndexedDB 客户端 TTS 缓存

之前每次点击发音按钮都会请求服务端。现在加入 IndexedDB 缓存层：

```
用户点击发音
    ↓
查 IndexedDB → 命中 → 直接播放（秒响应）
    ↓ 未命中
请求服务端 TTS API → 播放 + 写入缓存
```

**配置**：
- 缓存 key：`voice:text`（音色+文本）
- 过期时间：7 天
- 容量上限：500 条，LRU 淘汰

### 4. Prisma OpenSSL 兼容性修复

本地 macOS 构建 → Linux 服务器部署时，Prisma 客户端报错：

```
Prisma Client could not locate the Query Engine for runtime "debian-openssl-3.0.x"
```

**修复**：在 `prisma/schema.prisma` 添加多平台引擎支持：
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

## 踩过的坑

### 坑 1：服务器重启后 nginx 没起来

阿里云强制重启实例后，nginx 服务没有自动启动（systemd 状态是 `disabled`）。表现为：PM2 进程正常、端口 3000 在监听，但外部访问全部 502。

**教训**：服务器重启后要检查所有关键服务，不能只看 PM2。

### 坑 2：IPA 提示反而让发音更差

在 TTS 请求的 `user` message 中加入 IPA 音标（如 `Pronunciation: /ˌædvɝˈtaɪzmənt/`），本意是引导模型正确发音。结果模型把 IPA 当成要朗读的文本，发音变得像在念咒语。

**教训**：模型不一定理解 IPA 符号，自然语言提示（"Read the following word clearly and correctly"）反而更有效。

### 坑 3：服务端缓存导致改动不生效

改了代码重新部署，但发音还是老样子。原因是服务端有 LRU 内存缓存（24 小时 TTL），旧的音频还在。

**教训**：TTS 相关改动部署后，要重启 PM2 清空内存缓存。

## 最终效果

| 优化项 | 优化前 | 优化后 |
|--------|--------|--------|
| TTS 发音 | advertisement → advertisemations | ✅ 正确发音 |
| 音标准确性 | LLM 幻觉，无校验 | IPA 词典自动校验 |
| 发音响应速度 | 每次走网络请求 | 重复播放秒响应（IndexedDB） |
| 服务端缓存 | 无 | LRU 200 条 + IndexedDB 500 条 |
| 部署安全 | 无备份 | 自动备份 + 快速回滚 |

## 总结

这次优化涉及 8 个文件、342 行代码变更，从需求分析到部署上线，全程通过与 AI 对话完成。

AI 不是万能的——它不知道你的服务器重启后 nginx 不会自动起来，不知道 IPA 提示会让发音变差，不知道换哪个音色最好。但它能快速阅读代码、提出方案、执行修改、验证结果。

人机协作的关键在于：**人做决策，AI 做执行；人提供约束，AI 在约束内寻找最优解。**

---

*本文由作者与 AI 编程助手协作完成。文中涉及的代码改动已开源至 [GitHub](https://github.com/Bailipa/EZTor_FULLBLOOD)。*
