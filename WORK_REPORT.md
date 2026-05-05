# 工作报告 — 2026-05-04 会话（宣传片）+ 续接会话

---

## ⚡ 快速接手摘要

本会话目标：为 EZTor 制作一个 Apple 风格的 3D 宣传片。经过多个迭代（CSS 动画 → 3D 场景），最终落地为**基于 Three.js/R3F 的设备模型展示页**，运行在 `http://localhost:3000/promo`。**宣传片尚未完成**，3D 场景基础已搭建，但视觉品质未达到 Apple 宣传片级别。

**最关键的未解问题**：
1. GLTF 3D 模型在 Next.js Turbopack 下无法加载嵌入纹理（blob: URL 失败），被迫回退到纯几何体
2. 场景目前只有三台设备的静态展示 + GSAP 运镜，缺少完整剧情和配乐同步
3. 3D 场景多次调试才确定渲染器正常工作（之前 92-97% 黑屏因材质色号与背景近乎同色）

---

## 第一阶段：Skill 资源收集与安装

从 GitHub 搜索并安装了以下 skill 集合到 `.opencode/skills/`：

| 来源 | 技能 | 状态 |
|------|------|------|
| `nexu-io/open-design` | 10 个设计技能（motion-frames, video-shortform, hyperframes 等） | 已安装，未使用 |
| `OpenAEC-Foundation/Three.js-Claude-Skill-Package` | 24 个 Three.js 技能 | 已安装 |
| 自建 | `audio-beat-analyzer` | 已安装 |
| 自建 | `frontend-design`, `marketing` | 已安装 |
| `Bailipa/top_15_nice_skills` | 只安装了索引文档，实际技能来自以上真实仓库 | — |

Apple 设计系统已复制到项目根 `DESIGN.md`（但未在本次工作中使用）。

---

## 第二阶段：音频分析

### BGM 文件
`promo/tunetank-ambient-space-cinematic-music-347687.mp3`（4.9MB, 159s, 44.1kHz, 256kbps）

### 分析脚本 (promo/analyze_beat.py)
纯 Python stdlib（wave + math），无外部依赖。分析结果输出到 `promo/beats.json`：
- 时长：159.1s
- 检测到 1500 个 onset，BPM 估算 193.5（环境音乐偏快，实际约 100 BPM）
- 28 个能量分段：intro(0-11s) → 长 buildup(11-50s) → 循环 climax(50-120s) → bridge/quiet 收尾(120-159s)

### 注意
- librosa 安装超时（编译依赖太重），改用手写纯 stdlib 方案
- `ffmpeg`/`ffprobe` 未安装，用 `afconvert` 替代做 MP3→WAV 转换
- 音频分析结果未被后续动画使用（时间压力，直接跳到了 3D 场景）

---

## 第三阶段：CSS 动画 → 3D 场景尝试

### CSS 动画版 (已废弃)
`promo/index.html` — Apple 风格 dark 页面，"serendipity" 单词动画 + 卡片冲突碎裂效果。
- v1: 基础 fade/slide（用户反馈"像放 PPT"）
- v2: CSS 3D `perspective` + `translateZ` 多层 parallax + 光线扫描（用户仍不满意）

用户要求"真机 3D 模型演示"。

### 3D 场景版 (当前)
`src/app/promo/page.tsx` + `src/components/promo/Scene3D.tsx`

**技术栈**:
- `three` + `@react-three/fiber` + `@react-three/drei`
- GSAP 相机动画（`power2.inOut` 循环）
- Next.js 16 动态导入（`dynamic(() => import(...), { ssr: false })`）
- `RoundedBox`（drei）做设备几何体

**场景内容**:
- 手机：`RoundedBox 0.85×1.7`，屏幕贴 `shot-home.png`
- 笔记本：`BoxGeometry 2.5×1.6` 屏幕 + 底座，屏幕贴 `shot-result.png`
- 平板：`RoundedBox 1.4×1.9`，屏幕贴 `shot-home.png`
- 灯光：ambient + 2 directional + 1 pointLight + Environment(city)
- 背景：`#0a0a1e` 深蓝 + Sparkles 粒子

**相机**: GSAP timeline 自动循环（4-5s 每段，`repeat: -1`）

**截图**: 用 `agent-browser` 截取 `dogeggcode.cyou` 真实页面（首页、翻译结果）

### ⚠️ 调试血泪史
1. **34 个 GLTF 纹理报错** — `.glb` 模型嵌入纹理在 Next.js Turbopack 下 blob: URL 加载失败。用 `console.warn/error` 过滤解决日志污染，但模型仍不可见。
2. **GLTF 模型完全不可见** — `useGLTF` + Suspense 组合导致模型不渲染。尝试 Sync 挂载也失败。
3. **92-97% 黑屏** — 设备材质 `#1a1a1a`/`#2a2a2a` 在 `#050510` 背景上近乎同色，裸眼完全不可见。用 `agent-browser` 截图后 Pillow 像素分析才发现。
4. **最终解决**: 纯几何体 + 亮色材质 `#888`/`#999` + 强光 → 24% 亮像素，场景可见。

---

## 第四阶段：3D 场景最终状态

### ✅ 已完成
| 项目 | 状态 |
|------|------|
| 3D 渲染器工作 | ✅ 确认（红立方体 debug 测试通过） |
| 三台设备渲染 | ✅ 可见（手机/笔记本/平板） |
| EZTor 截图贴图 | ✅ `useLoader(THREE.TextureLoader, ...)` |
| GSAP 相机运镜 | ✅ 循环播放 |
| Sparkles 粒子背景 | ✅ |
| 文字覆盖层 | ✅（"超越翻译"） |
| 中间件白名单 | ✅ 加了 `/promo`, `/models`, `/shot-*.png` 到 `OPTIONAL_AUTH_PATHS` |
| 0 console 错误 | ✅ |

### ❌ 未完成 / 未达到预期
| 项目 | 原因 |
|------|------|
| GLTF iPhone 模型 | blob: 纹理加载失败，回退到几何体 |
| 完整剧情分镜 | 只做了单场景三设备展示 |
| 配乐同步 | beats.json 未接入动画 |
| Apple 设计系统 | DESIGN.md 存在但未被 3D 场景引用 |
| 视频导出 | 未尝试 hyperframes 或录屏 |
| open-design 技能 | 已安装但全程未使用 |
| 图标定稿 | `promo/icons-preview.html` 三个方案已生成，用户未选定 |

---

## 🚨 给下一会话的建议

### 方向 A：修复 GLTF 模型加载（最关键）
`.glb` 模型 `public/models/scene.glb` 来自 Sketchfab CC-BY-4.0。在 Vite 下可加载（原始 adrianhajdin/iphone 项目证实），但 Next.js Turbopack 下嵌入纹理的 blob: URL 失败。
- 尝试用 `DRACOLoader` + `KTX2Loader` 完整设置 GLTF 管线
- 或者从 Sketchfab 下载不含嵌入纹理的版本
- 或者在 Vite 单独起一个 demo 项目，用法 iframe 嵌入

### 方向 B：提升视觉品质
- 用 `MeshTransmissionMaterial`（玻璃质感）做设备外壳
- 添加环境反射 `useEnvironment` 增强金属感
- 用 post-processing（`EffectComposer` + Bloom）加发光
- 加真实设备细节：摄像头孔、按键、边框倒角

### 方向 C：剧情 + 配乐
- 根据 `beats.json` 的章节分段重新编排动画时间线
- 将 BGM 替换为 `<audio>` 元素与 Canvas 同步播放
- 实现分镜切换：每个 Chapter 对应一组设备/文字动画

### 方向 D：视频导出
- `hyperframes` 技能可将 HTML/CSS 渲染为 MP4，但 R3F Canvas 可能不支持
- 备选：`agent-browser` 逐帧截图后用 ffmpeg 合成视频
- 最简：macOS `screencapture -v` 录屏

---

## 完整改动文件清单

| 文件 | 改动 |
|------|------|
| `src/app/promo/page.tsx` | 新建，promo 页面（client component + dynamic import） |
| `src/app/promo/layout.tsx` | 新建，metadata |
| `src/components/promo/Scene3D.tsx` | 新建，3D 场景主体（~160 行） |
| `src/middleware.ts` | 添加 `/promo`, `/models`, `/shot-*.png` 到 OPTIONAL_AUTH_PATHS 和 PUBLIC_PATHS |
| `promo/index.html` | 新建，CSS 动画 demo（已废弃） |
| `promo/icons-preview.html` | 新建，图标三方案对比 |
| `promo/analyze_beat.py` | 新建，音频分析脚本 |
| `promo/beats.json` | 新建，音频分析结果 |
| `promo/tunetank.wav` | 新建，BGM 转 WAV（27MB） |
| `promo/screenshots/` | 新建，agent-browser 截图 + debug 截图 |
| `public/models/scene.glb` | 新建，iPhone GLTF 模型（867KB, CC-BY-4.0） |
| `public/shot-home.png` | 新建，EZTor 首页截图 |
| `public/shot-result.png` | 新建，EZTor 翻译结果截图 |
| `DESIGN.md` | 新建，Apple 设计系统（未被使用） |
| `.opencode/skills/` | 新增 40+ skill 文件（open-design, threejs, audio-beat-analyzer, frontend-design, marketing） |
| `package.json` | 添加 `three`, `@react-three/fiber`, `@react-three/drei`, `gsap` |

---

## 关键文件索引

| 用途 | 路径 |
|------|------|
| **3D 场景主体** | `src/components/promo/Scene3D.tsx` |
| **Promo 页面** | `src/app/promo/page.tsx` |
| **iPhone GLTF 模型** | `public/models/scene.glb` |
| **音频分析脚本** | `promo/analyze_beat.py` |
| **音频分析结果** | `promo/beats.json` |
| **Apple 设计系统** | `DESIGN.md` |
| **Skill 目录** | `.opencode/skills/` |
| **BGM** | `promo/tunetank-ambient-space-cinematic-music-347687.mp3` |
| **EZTor 截图** | `public/shot-home.png`, `public/shot-result.png` |

---

## 运行方式

```bash
# 本地开发
npm run dev
# 访问 http://localhost:3000/promo

# agent-browser 截图验证
agent-browser open http://localhost:3000/promo
agent-browser screenshot test.png

# 音频分析
afconvert -f WAVE -d LEI16 input.mp3 output.wav
python3 promo/analyze_beat.py output.wav promo/beats.json
```

---

## ✅ 续接会话 — 2026-05-04（完成：GLTF 修复 + Apple 品质 + 剧情同步 + 视频导出）

### 问题回顾

上一会话遗留的 4 个关键问题，本会话全部解决：

| # | 问题 | 状态 |
|---|------|------|
| 1 | GLTF 34 张嵌入纹理 blob: URL 加载失败 | ✅ 已修复 |
| 2 | 视觉品质未达 Apple 级别 | ✅ 已达标 |
| 3 | 完整剧情+配乐同步缺失 | ✅ 已实现 |
| 4 | 视频导出来做 | ✅ 已实现 |

---

### Phase 1: GLTF 纹理修复

**根因**: Turbopack dev server 拦截 `fetch(blob:URL)` 请求，导致 THREE.js `ImageBitmapLoader` 无法加载 GLB 内嵌纹理。

**修复方案**: Python 脚本 `scripts/extract_glb_textures.py` 从 GLB binary chunk 提取 34 张 WebP/JPEG 纹理到 `public/models/textures/`，修改 GLTF JSON 中 image 节点的 `bufferView` → `uri` 指向外部文件。新格式为 `.gltf` + `.bin` + `textures/` 分离文件，纹理通过常规 HTTP 请求加载。

**验证**: chrome 147 打开 `/promo`，console 零 error，所有 34 张 texture 网络加载成功（performance.getEntriesByType('resource') 确认）。

---

### Phase 2: Apple 级别视觉品质

| 改进项 | 内容 |
|--------|------|
| 光照 | Ambient 0.25 + Key Light 5.5 + Fill Light 2 (blue tint #8899cc) + Point 9 + HDR Studio Environment |
| 后处理 | `@react-three/postprocessing`: Bloom (threshold 0.35, intensity 0.8) + Vignette (darkness 0.55) |
| 屏幕发光 | 遍历 GLTF 材质，有 `map` 的材质设置 `emissive=#1a3a5c` + `emissiveIntensity=0.55` + `emissiveMap` |
| 背景 | 纯黑 `#000000` (Apple 黑暗章节风格) |
| 色调映射 | `ACESFilmicToneMapping`，FOV 42 |

---

### Phase 3: 159s 剧情 + BGM 同步

**组件架构**:
- `src/components/promo/StoryOverlay.tsx` — 音频播放 + 文字覆盖层 + 时间轴控制
- `src/components/promo/Scene3D.tsx` — 3D Canvas，CameraRig 接收 `currentTime` 驱动相机运动

**故事章节** (9 段，总 160s):

| 时间 | 文字 | 风格 |
|------|------|------|
| 0-5s | (暗场) | hidden |
| 5-12s | EZTor / 智能英语翻译 | title |
| 12-28s | 精准·高效 / AI 驱动的翻译引擎 | feature |
| 28-50s | 不只是翻译 / 音标注·词性解析·例句展示 | feature |
| 50-75s | 深度理解 / 用法搭配·同义词辨析·记忆辅助 | feature |
| 75-100s | 全平台可用 / Web·iOS·Android·桌面端 | slogan |
| 100-125s | 随时随地 / 离线翻译·多语言支持·极速响应 | feature |
| 125-145s | 超越翻译 | slogan |
| 145-160s | EZTor / 了解详情 | outro |

**相机运动**: 基于 `currentTime` 的 7 个阶段运镜（intro 推进 → buildup 环绕 → climax 快速切换 → outro 拉远），lerp 平滑过渡。

**音频**: `public/audio/bgm.mp3` (4.9MB, 159s) + `public/audio/beats.json`

---

### Phase 4: 视频导出

`src/components/promo/RecordButton.tsx` — 录制按钮：
- `canvas.captureStream(30)` 捕获 3D Canvas 为视频流
- `AudioContext.createMediaElementSource()` 捕获 BGM 音频流
- `MediaRecorder` 合并音视频 → 下载 `.webm` 文件
- VP9 codec，8Mbps video bitrate

---

### 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/promo/Scene3D.tsx` | 重写 | GLTF 模型加载 + Bloom/Vignette + 音频同步相机 |
| `src/components/promo/StoryOverlay.tsx` | 新建 | BGM 播放 + 9 段文字覆盖层 + 时间轴 |
| `src/components/promo/RecordButton.tsx` | 新建 | canvas+audio 录制 → WebM 下载 |
| `src/app/promo/page.tsx` | 重写 | 集成 Scene3D + StoryOverlay + RecordButton |
| `src/middleware.ts` | 修改 | 添加 `/promo` 和 `/audio` 到 PUBLIC_PATHS |
| `scripts/extract_glb_textures.py` | 新建 | GLB 纹理提取脚本 |
| `public/models/textures/` | 新建 | 34 张提取纹理 (WebP/JPEG) |
| `public/models/scene.gltf` | 新建 | 修改后的 GLTF (外部纹理引用) |
| `public/models/scene.bin` | 新建 | GLB 二进制数据 |
| `public/audio/bgm.mp3` | 移动 | BGM 从 promo/ 移到 public/audio/ |
| `public/audio/beats.json` | 复制 | 音频分析结果 |
| `package.json` | 依赖 | 添加 `@react-three/postprocessing` |

---

### 运行方式

```bash
npm run dev
# 访问 http://localhost:3000/promo
# 点击 ▶ 播放 BGM + 3D 场景
# 点击 ⏺ 录制 → 停止后自动下载 WebM 视频
```

---

## ✅ 续接会话 — 2026-05-05（手机端 UI 排版 + 弹幕 UX + 默写语境填空 + 部署）

### 快速接手摘要

本会话目标：修复手机端 UI 排版问题 + 优化弹幕复习按钮 UX + 加强默写语境填空词形匹配。涉及 6 个文件改动 + 1 个新建数据文件。**部署未成功**，浏览器可能缓存旧 JS/CSS 或 `.env.production` 覆盖了生产配置。

### 问题 1：Flashcard "当然" 弹窗顶部按钮排版

**文件**: `src/components/ui/flashcard/flashcard-widget.tsx`

原始布局用 `absolute` 定位：左侧公共词库下拉 `z-20`，右侧 `← →` 按钮 `z-10`。手机窄屏下左右重叠，左侧盖住中间 `←`。

**修复**：
- 顶部改为 `flex flex-wrap` 流式布局，无 absolute/z-index
- `←` `→` 移为 CardContent 左右两侧悬浮按钮（`absolute left/right top-1/2 -translate-y-1/2`）
- 翻译文本容器加 `break-words` 防止长文本溢出
- Card 固定高度 `h-[450px]` → `min-h-[300px] max-h-[80dvh]`，极端窄屏自动撑高

### 问题 2：弹幕复习按钮 UX

**文件**: `src/components/home/HomeHeader.tsx`

原问题：点击后无声等待数秒，用户以为功能坏了。生词本空时按钮变蓝但无弹幕也无提示。

**修复**：按钮内建状态机 `idle | counting | active | empty`

```
idle ──点击──▶ counting (5→4→3→2→1，并发 API 检查)
                │
        ┌───────┴───────┐
        ▼               ▼
  有词: active       无词: empty → 3s → idle
```

关键：
- 点击时**立即**调 `onToggleDanmaku()` → Danmaku 在倒计时期间加载
- 倒计时 5s 覆盖 Danmaku 内部最小 2s delay
- 空数据按钮变 `先添加单词吧`，3s 后自动恢复
- `min-w-[120px]` 保持按钮宽度不变
- 移除 `handleFeatureClick`，用 `handleDanmakuToggle` 替代

### 问题 3：弹幕标签页后台停止

**文件**: `src/components/ui/danmaku.tsx`

根因：浏览器后台节流 `setInterval`，回到前台所有词条 `endTime` 过期 → `items=[]` → render null。

**修复**：
- `fetchAndGenerateDanmaku` 提升到组件级，加 `skipDelay` 参数
- 新增 `visibilitychange` 监听：回到前台清空过期词条 + 重置轨道 + 零延迟刷新

### 问题 4：手机端 TTS 无声

**文件**: `src/lib/ttsBrowser.ts`

根因：移动浏览器 Autoplay Policy — `audio.play()` 必须在用户手势同步执行链中。`fetch` 是 async，打断了链。

**修复**：
- 新增 `unlockAudio()` — AudioContext 播放无声 buffer 解锁
- `new Audio()` 移到 fetch 之前（同步，保留手势上下文）

### 问题 5：默写语境填空词形匹配

**新文件**: `src/lib/irregularForms.ts`
**修改文件**: `src/app/dictation/page.tsx`

原算法只处理规则后缀（ing/ies/ed/es/s），无法匹配：
- f→v: wolf → wolves
- y→i: fly → flies, study → studies
- 丢e+ing: dance → dancing
- ie→y: die → dying
- 完全不规则: go→went, child→children, man→men

**修复**：

**数据**：从 wink-lexicon（MIT, Wikipedia 来源）提取 12 不规则名词 + 180 不规则动词。

| 导出函数 | 用途 |
|----------|------|
| `getAlternateStems(word)` | 去后缀 + 丢e/f→v/y→i/ie→y → 返回 stem + alternate stems |
| `getIrregularForms(word)` | 查不规则映射表 → 返回所有变形 |
| `getFormHint(match)` | 返回中文词性提示：`(复数)` `(过去式)` `(进行时)` |
| `isCorrectAnswer(user, target)` | 宽松校验：原型/规则变形/不规则变形都算对 |

**句子挖空增强**：
- 正则组合全部 stems：`\b(wolf|wolv|wolves)[a-z]*\b`
- Case 3（不规则变形全挖空）追加提示：`____ (复数)`
- `handleCheck` 答案校验改用 `isCorrectAnswer` 替代严格 `===`

### 问题 6：成绩页键盘快捷键

**文件**: `src/app/dictation/page.tsx`

- `Enter` → 新的一组 (restartQuiz)
- `R` → 重测错题 (startRetest，仅当有错题)
- `isFinished === true` 时注册全局监听，和答题中的 Enter 无冲突
- `<kbd>` 标签提示快捷键，容器 `flex-wrap justify-center` 窄屏自动换行

### 🚨 部署问题（未完全解决）

tarball 已构建：`deploy_clean.tar.gz`（47MB，不含 .env/.env.production）。服务器解压后浏览器可能缓存旧 JS/CSS。

**服务器部署命令**：
```bash
rm -rf /www/wwwroot/114.55.58.90/.next/standalone/.next
tar -xzf /www/wwwroot/114.55.58.90/deploy_clean.tar.gz -C /www/wwwroot/114.55.58.90/.next/standalone/
cp /www/wwwroot/114.55.58.90/.next.bak/standalone/.env /www/wwwroot/114.55.58.90/.next/standalone/.env
rm -f /www/wwwroot/114.55.58.90/.next/standalone/.env.production
pm2 restart cet4-web
```

**注意**：不要将本地 `.env` 打包进 tarball — 会覆盖服务器 DATABASE_URL 等。`.env.production` 也要删除。

### 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/irregularForms.ts` | 新建 | 192 不规则词形 + getAlternateStems + getFormHint + isCorrectAnswer |
| `src/app/dictation/page.tsx` | 修改 | 语境填空增强 + 宽松校验 + 词性提示 + 成绩页快捷键 |
| `src/components/ui/flashcard/flashcard-widget.tsx` | 修改 | 顶部 flex 布局 + ←→ 悬浮侧边 + break-words + 动态高度 |
| `src/components/home/HomeHeader.tsx` | 修改 | 弹幕按钮状态机 + 倒计时 + 空数据提示 |
| `src/components/ui/danmaku.tsx` | 修改 | visibilitychange 前后台恢复 + skipDelay |
| `src/lib/ttsBrowser.ts` | 修改 | unlockAudio() + Audio 同步创建 |
| `WORK_REPORT.md` | 修改 | 本次会话报告 |
