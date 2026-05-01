# 内存占用分析报告

> 项目: CET4-Web 词汇学习平台  
> 分析日期: 2026-05-01（已同步至最新提交 `39ae723`）  
> 技术栈: Next.js 16 + React 19 + Prisma (SQLite) + TypeScript

---

## 一、项目概况

本项目是一个基于 Next.js 的全栈词汇学习应用，支持用户认证、词汇翻译（LLM驱动）、闪卡、听写、分享、弹幕、TTS语音合成等功能。使用 PM2 管理进程（`max_memory_restart: 1G`），部署为 standalone 模式单实例。

---

## 二、问题分级总览

共发现 **20 个内存相关风险点**（较上次新增 2 个），按严重程度分级：

| 等级 | 数量 | 较上次 | 说明 |
|------|------|--------|------|
| 🔴 高危 | 5 | - | 会导致持续内存增长或可触及系统OOM |
| 🟡 中危 | 8 | +1 | 特定场景下造成明显内存压力 |
| 🟢 低危 | 7 | +1 | 影响较小或仅限浏览器端 |

---

## 三、🔴 高危问题详情

### 1. `monitoring.ts` — LLM 错误日志 Map 无界增长

**位置**: `src/lib/monitoring.ts`

**问题描述**:  
`monitoringService` 维护一个 `Map<string, {errors: Map<string, number>}>` 用于记录每个 LLM 提供商的错误统计。每次 LLM 调用失败时，错误消息字符串作为 key 写入 `errors` Map。这些错误条目**永远不会被清除、没有 TTL、没有大小上限**。

**内存影响**:  
如果 LLM 提供商返回包含动态内容的错误消息（如 requestId、时间戳、详细参数），每个错误都会创建一个新 key，导致 Map 持续膨胀。对于 7×24 运行的进程，几周内可累积数千个条目。

**优化建议**:
- 为 `errors` Map 添加最大条目数限制（如 50），超出时删除最旧条目
- 添加 `clear()` 方法并在进程空闲时定期调用
- 考虑截断错误消息（保留前 200 字符）以减少唯一 key 数量
- 对错误消息进行分类聚合而非按原始字符串存储

---

### 2. `requestDeduplication.ts` — `completedRequests` 缓存清理不及时

**位置**: `src/lib/requestDeduplication.ts:13`

**问题描述**:  
`completedRequests` Map 以 `translate:word` 为 key 缓存已完成的翻译结果。TTL 设置为 10 秒，但清理定时器每 **30 秒**才运行一次。这意味着过期条目最多可额外占用内存 20 秒。在高并发翻译场景下（如大量用户同时翻译不同词汇），这个 Map 可能在同一时刻持有上万个包含完整翻译结果对象的条目。

**内存影响**:  
按每个条目 ~500 字节估算，10,000 个过期条目 ≈ 5 MB。虽然单次不算大，但与下述 TranslationService 的流缓存叠加后会造成显著压力。

**优化建议**:
- 将清理间隔从 30 秒减少到 **5 秒**，或在 TTL 相近时对齐
- 为 `completedRequests` 添加最大容量限制（如 5000 条），超出时拒绝或驱逐最旧条目
- 在 `getCompletedRequest` 中也执行就地过期清理（当前已有 TTL 检查但未 delete）

---

### 3. `lib/tts.ts` + `api/tts/route.ts` — TTS 音频全量缓冲 + WebSocket 生命周期

**位置**: `src/lib/tts.ts`, `src/app/api/tts/route.ts:32`

**问题描述**:  
此问题包含两个关联子问题：

**3a. 音频数据全量缓冲**: 在 `api/tts/route.ts` 中，`const buffer = Buffer.from(await ttsResponse.arrayBuffer())` 将完整的 MP3 音频读入内存再返回给客户端。对于长文本（500+ 单词），单个 MP3 可达 1-5 MB。若 20 个用户同时请求，仅音频缓冲区就可占用 100+ MB。

**3b. WebSocket 泄漏风险**: 每次调用 `synthesizeSpeech` 通过 `@lobehub/tts` 向 Microsoft TTS 服务打开一个 WebSocket 连接。以下场景存在泄漏：
- 客户端断开连接时，`req.signal` 未被传递给 `synthesizeSpeech`，WebSocket 继续接收数据
- 如果底层 `EdgeSpeechTTS` 没有正确关闭 WebSocket（依赖 `turn.end` 消息），连接会直到 TCP 超时才释放

**内存影响**:  
每请求核心内存开销包括：WebSocket 缓冲区 + 累积 ArrayBuffer（`createEdgeSpeech` 内部逐块拼接） + 最终 `Buffer.from()` 副本。并发 20 用户时可达 150-200 MB。

**优化建议**:
- 将音频流式传输给客户端，而非全量缓冲后发送（使用 `ReadableStream` pipe）
- 将从 `synthesizeSpeech` 获取的 `Response.body` (ReadableStream) 直接传递给 HTTP 响应
- 将 `req.signal` 传递给 `synthesizeSpeech`，在客户端断开时取消 WebSocket
- 为 `synthesizeSpeech` 添加超时机制（如 30s abort）
- 对单次 TTS 输入长度添加限制（如 500 字符）

---

### 4. `api/flashcard/import/route.ts` — Excel 文件全量加载无大小校验

**位置**: `src/app/api/flashcard/import/route.ts`

**问题描述**:  
`xlsx.readFile(filePath)` 将整个 Excel 文件读入内存并解析为对象树。随后 `sheet_to_json` 将数据物化为 `Array<Array<any>>`，之后 `.filter()` 和 `.map()` 各创建一份副本，三者同时存在于内存中。文件路径为硬编码的 `simple words.xlsx`，但**没有任何文件大小检查**。

**内存影响**:  
- 10,000 行 Excel → 约 6 MB 三重数组
- 500,000 行 Excel → 约 300 MB，可能导致 OOM
- 虽然目前路径是硬编码的（受部署者控制），但若将来改为用户上传则风险大增

**优化建议**:
- 在读取前通过 `fs.statSync` 检查文件大小，超过阈值（如 10 MB）直接拒绝
- 对 CSV 使用流式解析；对 Excel 可考虑分批读取 sheet 或使用 `xlsx.stream`
- 直接对 `rawData` 过滤和转换，避免通过 `.filter()` 和 `.map()` 创建额外副本（使用单次 `for` 循环或 `.reduce()`）
- 将 Prisma 写入改为批量操作（`createMany`）以减少 promise 链内存

---

### 5. `components/share/SharePoster.tsx` — 海报 Base64 数据 URL 进入 React State

**位置**: `src/components/share/SharePoster.tsx:88`

**问题描述**:  
使用 `html-to-image` 的 `toPng` 方法（2x 像素比）将 DOM 转换为 PNG 数据 URL（base64 编码）。对于 360×500 卡片，生成的 base64 字符串约 **3.7 MB**，存入 React state（`previewUrl`）。如果用户反复打开分享对话框而不进行完整页面导航，每次都会在内存中保留大型字符串，直到 GC 回收。

**内存影响**:  
存储 3.7 MB 的字符串在 React state 中，且 `setTimeout` 生成海报的回调未在组件卸载时清理。此问题在浏览器端表现为标签页内存持续升高。

**优化建议**:
- 将 `previewUrl` 转换为 `Blob` URL：`URL.createObjectURL(blob)`，并在组件卸载或新海报生成时调用 `URL.revokeObjectURL`
- 为 `setTimeout(generatePoster, 100)` 添加 cleanup 函数
- 考虑降低像素比（1x 对社交分享通常足够）或压缩图片

---

## 四、🟡 中危问题详情

### 6. `translationCache.ts` — 缺少定时清理且无单条目大小限制

**位置**: `src/lib/translationCache.ts`

**问题描述**:  
LRU 缓存设置了 `MAX_CACHE_ENTRIES = 10000`，但：
- **没有定时清理过期条目**：过期条目仅在 `set()` / `get()` / `has()` 时被移除。如果缓存填满后被长期闲置，过期条目会保留到下次 `set()` 触发 LRU 驱逐
- **没有单条目大小限制**：每个 `CacheEntry.data` 类型为 `unknown`，可能存储非常大的翻译结果。`totalSize` 仅被追踪但从未作为驱逐依据

**内存影响**:  
按平均每条 2 KB 估算，满载 10,000 条 ≈ 20 MB。如果某些条目异常大（如长文本翻译），几十条即可占据大量内存。

**优化建议**:
- 添加 `setInterval` 定时清理过期条目（如每 5 分钟）
- 添加单条目最大体积检查，超过阈值（如 100 KB）拒绝缓存或压缩
- 将 `totalSize` 作为辅助驱逐条件：当总内存占用超过阈值时，驱逐最旧条目

---

### 7. `TranslationService.ts` 流式累积文本 + 轮询等待问题

**位置**: `src/services/TranslationService.ts`

**问题描述（两个）**:

**7a. `accumulatedAiText` 累积**（约第 220 行）: `processTranslationStream` 方法通过 `+=` 拼接所有 LLM 流式 chunk 到 `accumulatedAiText` 字符串。对于大批量翻译（50+ 词），LLM 响应可达 20-50 KB+ 的 JSON。此字符串在 JSON 解析和 DB 写入完成前一直保存在内存中。

**7b. `waitForPendingRequests` 轮询**（约第 155 行）: 当事务已被另一个并发请求处理时，当前请求进入最高 5 秒的轮询循环（10 次 × 500ms）。在高并发场景下，许多请求可能同时处于轮询状态，每个维持独立的 async 上下文、结果数组和定时器 Promise 链。

**内存影响**:  
- 7a: 单请求 50 KB，100 并发 → 5 MB（可控但不优雅）
- 7b: 多个同时轮询的请求累积 async 上下文内存

**优化建议**:
- 对 `accumulatedAiText` 添加最大长度保护（如超过 500 KB 时中断并报错）
- 将 `waitForPendingRequests` 改为事件驱动模式：使用发布/订阅（pubsub）而非轮询
- 在流处理中检测 `controller.signal.aborted` 来提前终止断开客户端的流处理

---

### 8. `StreamHandler.ts` — 无客户端断开检测

**位置**: `src/services/StreamHandler.ts`

**问题描述**:  
`createStreamResponse` 创建的 `ReadableStream` 在客户端断开连接后，`processTranslationStream` 的异步回调仍会继续执行直到完成。这会浪费 CPU 和内存处理已经不需要的数据。

**优化建议**:
- 在 `start` 回调中监听 `controller.signal` 或读取 `request.signal`
- 检测到客户端断开后，提前 `controller.close()` 或 `controller.error()`

---

### 9. `connectionPool.ts` — 无连接超时清理

**位置**: `src/lib/connectionPool.ts`

**问题描述**:  
OpenAI 客户端连接池上限 10 个实例，但：
- 一旦 10 个不同的 `apiKey:baseUrl` 组合被缓存后，永不过期
- 使用 FIFO 驱逐策略（`Map.keys().next()`），未考虑使用频率
- 被驱逐的 `OpenAI` 实例未调用 `dispose`/`destroy`，可能存在 socket 泄漏

**内存影响**:  
10 个 `OpenAI` 实例各维护 HTTP 连接池（TLS 会话 + socket），约 1-3 MB。不算大但连接永远不会释放。

**优化建议**:
- 添加空闲超时机制（如 30 分钟未使用则移除）
- 改为真正的 LRU 驱逐（在每次 `getClient` 访问时移动 key 到末尾）
- 驱逐时尝试调用 `client.destroy()` 或让其实例被 GC 回收

---

### 10. `app/history/page.tsx` — 无限滚动状态数组无界增长

**位置**: `src/app/history/page.tsx:129`

**问题描述**（浏览器端）:  
`setWords(prev => [...prev, ...newWords])` 在每次 `loadMore` 时将新数据追加到已有数组。虽然使用 `VirtuosoGrid` 进行虚拟化渲染（只渲染可见项），但完整的 words 数据数组始终保留在内存中。如果用户持续滚动加载数千条记录，数组会持续增长。

**内存影响**:  
5,000 条词汇 × ~300 字节/条 ≈ 1.5 MB（纯浏览器端，对单个标签页有影响）

**优化建议**:
- 设置最大保留数量（如 1,000 条），超出时裁剪最旧条目
- 使用 `windowed` 数据源，仅保留视口附近的数据

---

### 11. `rateLimit.ts` — 内存存储无容量上限

**位置**: `src/lib/rateLimit.ts`

**问题描述**:  
`MemoryRateLimitStore.store` 是一个 `Map<string, RateLimitEntry>`，清理仅依赖 60 秒窗口过期。没有硬性容量上限。如果遭遇 DDoS 风格的大量唯一 IP 攻击，Map 可在 60 秒内积累数万条目。

**内存影响**:  
10,000 个尝试攻击的 IP × ~100 字节/条目 ≈ 1 MB。不算致命但可配合其他问题放大影响。

**优化建议**:
- 添加 `MAX_STORE_ENTRIES` 硬性限制（如 5000），超出时拒绝新请求或激进清理
- 将清理间隔缩短到 15 秒以更快回收内存

---

### 12. `components/ui/danmaku.tsx` — 弹幕项清理依赖类型断言

**位置**: `src/components/ui/danmaku.tsx:36-39`

**问题描述**（浏览器端）:  
弹幕清理逻辑使用 `(item as any).endTime` 进行过期判断。`DanmakuItem` 接口中未定义 `endTime` 字段。如果运行时确实有该字段则工作正常，否则所有弹幕项永久积累（3 条/12 秒 = 900 条/小时）。

**内存影响**:  
每个弹幕项附带 Framer Motion 动画对象。若清理失败，每小时可积累 ~1-2 MB（浏览器端）。

**优化建议**:
- 在 `DanmakuItem` 接口中添加 `endTime: number` 字段
- 添加上限保护：当 `items.length > 100` 时强制裁剪

---

### 13. `api/translate-only/route.ts` — 优化模式双重 LLM 调用 + 全量缓冲响应（🆕 新增问题）

**位置**: `src/app/api/translate-only/route.ts:127-164,226-258`

**问题描述**:  
此 API 路由在最近提交中新增了 **output optimization 模式**。开启后，每次翻译会先调用一次 LLM 进行文本优化（`systemPoolCompletion` + `OPTIMIZATION_PROMPT`），再调用一次 LLM 进行翻译。这意味着：
- **单次请求合并 2 轮 LLM 调用**，每轮都是全量缓冲响应（非流式）
- `OPTIMIZATION_PROMPT` 是一个约 1.5 KB 的大型 system prompt，每次作为消息体发送
- Custom API 路径使用 `fetch()` 全量读取 `.json()`，不进行流式处理，也无连接复用

**内存影响**:  
per-request 内存加倍。正常模式下每请求约 5-10 KB 的 LLM 响应数据，优化模式下为 10-20 KB。100 并发优化请求将产生额外 1-2 MB 内存占用。虽然单次不大但叠加其他问题后加重负担。

**优化建议**:
- 为优化模式考虑使用流式响应（当前 API 不是流式的，改为 SSE）
- 合并优化+翻译为单次 LLM 调用（一个 prompt 同时完成优化和翻译）
- 对 Custom API 路径添加连接池复用（当前每次 `fetch()` 都是新建连接）

---

## 五、🟢 低危问题详情

### 14. `WordInputCard.tsx` + `GuestWordInputCard.tsx` + `TranslateOnlyCard.tsx` — 每次按键写 localStorage（🔄 问题加剧）

**位置**: `src/components/home/WordInputCard.tsx:66-68`, `GuestWordInputCard.tsx:58-60`, `src/components/home/TranslateOnlyCard.tsx:186-191`, `src/lib/translateHistory.ts:25-39`

**问题描述**（浏览器端）:  
每次 `wordsInput` 和 `results` 变化都调用 `JSON.stringify` + `localStorage.setItem`。对流式翻译场景来说，这可能达到每秒数十次的频率。

**最近变化 （提交 46c46ad）**:  
新增的 `translateHistory.ts` 模块在每次翻译完成后调用 `addHistoryEntry()` → 内部执行 `loadHistory()` + `saveToStorage()`，进一步增加 localStorage 写入频率。翻译历史最多保留 50 条，每次写入都会序列化完整数组。

**优化建议**:
- 对 `saveToStorage` 添加防抖（debounce），如 500ms 延迟
- 仅在组件卸载或用户离开页面时保存关键状态
- 翻译历史可考虑合并写入，而非每次翻译后立即持久化

---

### 15. `HomeContent.tsx` + `TranslateOnlyCard.tsx` — 未清理的 setTimeout（⚠️ 文件已修改但问题未修复）

**位置**: `src/components/home/HomeContent.tsx:61`, `src/components/home/TranslateOnlyCard.tsx:96,230`

**问题描述**（浏览器端）:  
几处 `setTimeout` 回调在组件卸载时未通过 `clearTimeout` 清理。回调内容为安全操作（`?.scrollIntoView()`、`setProgress(0)`、`setIsCopied(false)`），在已卸载组件上 setState 会触发 React 警告但不会造成严重内存泄漏。

**最近变化 （提交 46c46ad、48ea067）**:  
`TranslateOnlyCard.tsx` 经过大量重构（新增 optimize 模式、历史记录），但 `finishProgress`（第 96 行）和 `handleCopy`（第 230 行）中的 `setTimeout` **仍然未添加 cleanup 逻辑**。

**优化建议**:
- 将 `setTimeout` 返回值存入 ref，在 `useEffect` 返回的 cleanup 函数中 `clearTimeout`

---

### 16. `app/dictation/page.tsx` — Audio 元素未清理

**位置**: `src/app/dictation/page.tsx:119-124`

**问题描述**（浏览器端）:  
`useEffect` 中创建了两个 `Audio` 实例但没有返回 cleanup 函数。在 SPA 导航模式下，多次进出页面会累积过期的 Audio 对象（浏览器最终会 GC，但非即时）。

**优化建议**:
- 在 `useEffect` 中返回 cleanup 函数，调用 `audio.pause()` 和 `audio.src = ''`

---

### 17. `wordSync.ts` — 全量载入用户词汇

**位置**: `src/lib/wordSync.ts:deduplicateUserWords`

**问题描述**:  
`deduplicateUserWords` 通过 `prisma.word.findMany({ where: { userId } })` 加载用户所有词汇到内存进行分组。对于拥有 10,000+ 词汇的活跃用户，这会一次性加载大量数据。

**内存影响**:  
10,000 条 × ~200 字节 ≈ 2 MB。此操作不频繁（手动触发），影响有限。

**优化建议**:
- 使用分页 + 游标方式处理，避免一次性全量加载
- 或使用数据库层面的去重（`GROUP BY` + `HAVING COUNT > 1`）

---

### 18. `prisma.ts` — 连接池未在关闭时释放

**位置**: `src/lib/prisma.ts`

**问题描述**:  
未调用 `prisma.$disconnect()` 的显式逻辑。在生产环境中（PM2 单实例长期运行），这不是大问题；但如果将来改为 serverless 部署，每次函数冷启动都会创建带连接池的新 PrismaClient 实例导致连接泄漏。

**优化建议**:
- 监听进程信号（`SIGTERM`、`SIGINT`），在关闭时调用 `await prisma.$disconnect()`
- 在 `instrumentation.ts` 中添加 graceful shutdown 逻辑

---

### 19. `prisma/schema.prisma` — 数据库表无界增长

**位置**: `prisma/schema.prisma`（非代码内存问题，但影响长期运行）

**问题描述**:  
以下表会随时间无限增长，虽然不在进程内存中，但数据库体积过大间接影响查询缓存和索引效率：
- `SecurityViolation`: 每次违规记录一条新记录
- `IpBan`: 每次封禁 IP 记录一条
- `AnalyticsEvent`: 每次事件记录一条

**优化建议**:
- 对 `AnalyticsEvent` 添加定期清理任务（如保留最近 90 天）
- 对 `SecurityViolation` 和 `IpBan` 添加过期自动清理

---

### 20. `translateHistory.ts` — 翻译历史每次操作全量读写 localStorage（🆕 新增文件）

**位置**: `src/lib/translateHistory.ts:25-39`

**问题描述**（浏览器端）:  
新增的 `translateHistory.ts` 模块提供客户端翻译历史记录功能，管理 `HistoryEntry` 数组（input + output + 元数据）。每次调用 `addHistoryEntry()` 时执行：`loadHistory()`（JSON.parse 完整数组）→ `unshift` 追加 → 裁剪到 50 条 → `saveToStorage()`（JSON.stringify 完整数组）。

**内存影响**:  
每次翻译操作会产生一次完整的 localStorage 读+写。50 条历史 × ~500 字节/条 ≈ 25 KB。虽然数据量小且已添加容量上限（MAX_ENTRIES=50），设计良好，但与上述 #14 的频繁 localStorage 操作叠加后进一步增加浏览器端 IO 压力。

**优化建议**:
- 历史记录写入可添加延迟合并（如 200ms debounce）
- 无需每次翻译后立即读回完整历史（`loadHistory` 已有时机数据），可直接基于当前 state 计算新数组

---

## 六、内存占用预估汇总

| 模块 | 正常状态 | 峰值/劣化状态 | 主要触发条件 |
|------|---------|--------------|------------|
| LLM 连接池 + 错误日志 | ~5 MB | ~50 MB+ | LLM 频繁报错，错误 Map 膨胀 |
| TTS 音频缓冲 | ~2 MB | ~200 MB | 多人同时 TTS 长文本 |
| 翻译缓存 | ~10 MB | ~30 MB | 高频不同词汇翻译 |
| 请求去重 | ~2 MB | ~20 MB | 高并发翻译 burst |
| Excel 导入 | 0 MB | ~300 MB | 导入大型 Excel 文件 |
| rateLimit 存储 | ~0.5 MB | ~10 MB | DDoS 攻击 |
| translate-only 优化模式 | ~5 KB | ~2 MB | 大量并发 optimize 请求 |
| **进程总计** | **~50 MB** | **~600 MB 以上** | 多个劣化条件叠加 |

> 注：正常状态指 ~20 个活跃用户的典型负载；峰值指触发所有劣化条件的极值。实际值因硬件和配置而异。PM2 的 `max_memory_restart: 1G` 提供了一个兜底保护。

---

## 七、优化的优先级与收益评估

| 优先级 | 问题编号 | 解决成本 | 内存节省预期 | 备注 |
|--------|---------|---------|-------------|------|
| 1 | #1 monitoring 错误 Map | 低（添加上限） | 可防止无限增长 | 长时间运行最确定的泄漏 |
| 2 | #3 TTS 音频流式化 | 中（重构流处理） | 峰值 -90% | 改善最明显的场景 |
| 3 | #2 请求去重清理间隔 | 低（改常量） | 峰值 -30% | 一行代码改动 |
| 4 | #4 Excel 大小校验 | 低（加检查） | 防止 OOM | 防御性保护 |
| 5 | #5 海报 Blob URL | 低（浏览器端） | ~3.7 MB/次 | 用户体验改善 |
| 6 | #13 translate-only 流式化 | 中（改为 SSE） | per-request -50% | 新增问题，优化模式链路加倍 |

---

## 八、本次变更影响总结

自上次报告（2026-04-30）以来，项目进行了以下与内存相关的变化：

### 新增文件分析
| 文件 | 内存风险 | 说明 |
|------|---------|------|
| `src/lib/translateHistory.ts` | 🟢 低 | 客户端 history，上限 50 条，设计合理 |
| `src/lib/translateOnlyUsage.ts` | 无 | 纯 DB 操作，无内存状态 |

### 已有问题的变化
| 编号 | 状态 | 说明 |
|------|------|------|
| #14 (原#13) | 🔄 加剧 | localStorage 写入频率因 translateHistory 进一步提高 |
| #15 (原#14) | ⚠️ 未修复 | TranslateOnlyCard 重构后 setTimeout 仍无 cleanup |
| 其他 #1-12 | 未变更 | 均未被近期修改触及 |

### 本次新增风险点
| 编号 | 严重度 | 描述 |
|------|--------|------|
| #13 | 🟡 中危 | translate-only 优化模式双重 LLM 调用 + 全量缓冲 |
| #20 | 🟢 低危 | translateHistory 每次操作全量读写 localStorage |

---

## 九、总结

该项目的内存占用问题集中在以下四个方面：

1. **缺少容量上限的无界数据结构**（monitoring 错误日志 #1、无限滚动数组 #10、弹幕清理失败时的累积 #12）：建议为所有 Map/Set/数组添加硬性容量上限和淘汰机制。

2. **大对象全量缓冲而非流式处理**（TTS 音频 #3、Excel 导入 #4、LLM 翻译响应 #7/8/13）：建议改为流式管道传输，减少内存中的完整拷贝。

3. **缺少清理机制**（翻译缓存 #6、连接池 #9、事件监听/timer #14/16）：建议遵循"谁创建谁清理"原则，系统补全 cleanup 逻辑。

4. **新增代码引入的叠加效应**（translate-only 优化模式 #13、translateHistory #20）：新功能普遍采用全量缓冲+频繁 localStorage 写入模式，加剧已有问题。建议新功能开发时优先考虑流式处理和延迟持久化。

通过以上优化，可将正常状态内存占用从 ~50 MB 降低到 ~30 MB，峰值从 ~600 MB 降低到 ~150 MB 以内。
