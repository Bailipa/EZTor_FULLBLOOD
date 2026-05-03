# 工作报告 — 2026-05-03 会话

## 一、已完成的项目

### 1. GitHub 按钮（已部署，已验证）

**文件**: `src/components/home/HomeHeader.tsx:142-158`

- 在导航栏 ModeToggle 和 DonationButton 之间添加 GitHub 图标按钮
- 内置网络连通性检测：`fetch('https://github.com', { mode: 'no-cors' })` + 3 秒超时
- 可访问 → `window.open` 跳转 `https://github.com/Bailipa/EZTor_FULLBLOOD`
- 不可访问 → 弹出喵系友善提示弹窗，5 秒倒计时自动返回首页

**已提交**: `7d024f9 feat: add GitHub button with network detection and friendly fallback`

---

### 2. 数据文件提交

**文件**: `data/word_groups.json`, `data/words-export.json`, `data/words-export.json.gz`

**已提交**: `43d30cd data: add word groups and words export seed data`

---

### 3. 移动端排版修复（部分完成，核心问题未解决）

#### A. 已修复的页面结构

以下文件已从**多层嵌套 flex** 重构为**平坦 `flex-wrap` + `flex-1`** 布局：

| 文件 | 改动 | 是否已验证 |
|------|------|-----------|
| `src/app/history/page.tsx` | 完整重构 Header：平坦 flex-wrap + grid 按钮网格 + 分割线 | 未验证（生产无效） |
| `src/app/users/page.tsx` | 同 pattern：平坦 flex-wrap 替代嵌套 flex | 未验证 |
| `src/app/llm-config/page.tsx` | 标题 div 加 `shrink-0` | 服务器无此文件 |

#### B. WordCard 释义排版

**文件**: `src/components/vocabulary/WordCard.tsx:150-158`

- `flex items-center` → `inline` 布局，`Badge` 加 `align-middle` 与释义文字真正同行

#### C. 已推送但未生效的补丁

**已提交**: `5902c90 fix: mobile header layout — prevent text from stacking vertically`

共创建了 5 个补丁包（v1-v5），均部署到生产服务器但**核心竖排问题未解决**。

---

## 二、当前状况

### 生产服务器信息

- **IP**: 114.55.58.90（阿里云 Ubuntu）
- **部署路径**: `/www/wwwroot/114.55.58.90`
- **进程管理**: PM2（`cet4-web`，配置文件 `ecosystem.config.js`）
- **入口**: `.next/standalone/server.js`
- **Next.js 配置**: `output: 'standalone'`
- **服务器无 Git**：源码通过宝塔面板手动上传

### 部署方式

由于服务器无 `src/` 目录且无 git：
1. 本地 `npm run build` 编译
2. `tar -czf` 打包 `.next/standalone` + `.next/static` + chunks
3. 宝塔面板上传 → `tar -xzf` 解压 → `pm2` 重启

### 已知部署注意事项

- **CSS 文件位置**: 服务器从 `.next/standalone/.next/static/` 加载 CSS，但编译产物中 CSS 仅在根级别 `.next/static/`（standalone 目录内无 CSS 文件）
- **chunks 是关键**: 页面 JS 代码存储在 `.next/standalone/.next/server/chunks/ssr/`，`page.js` 仅为加载器
- **macOS tar 兼容**: macOS 创建的 `tar.gz` 包含 `LIBARCHIVE.xattr` 扩展属性，Linux 服务器会输出大量 "Ignoring unknown extended header keyword" 警告，但文件解压正常

---

## 三、核心未解决问题：中文竖排

### 根本原因（已定位）

在 CSS Flexbox 中：
1. **Flex 子元素的默认行为**: `min-width: auto` + `flex-shrink: 1`
2. **CJK 文字的 min-content**: 中文字符的 `min-content` = 单个字的宽度（因为每个字都可以是换行点）
3. **结果**: 当 flex 容器空间不足时，中文标题 div 被缩小到只有 1-2 个字的宽度，文字逐字换行，表现为"竖排"

### 尝试过的方案（均未生效）

| 尝试 | 思路 | 结果 |
|------|------|------|
| `flex-col sm:flex-row` | 移动端堆叠 | 未生效 |
| `shrink-0` | 禁止缩小 | 仅影响主轴，不限制交叉轴宽度 |
| `w-full sm:w-auto` | 强制满宽 | 未生效 |
| `lg:flex-row` | 推迟并排断点到 1024px | 未生效 |
| 平坦 `flex-wrap` + `flex-1 min-w-[120px]` | 完全替换嵌套结构 | 未生效 |
| `whitespace-nowrap` | 禁止换行 | 未生效 |

**所有方案在本地编译产物中 class 正确生成**，部署后服务器 JS chunks 和 CSS 均包含新 class，但浏览器渲染结果不变。

### 疑点

1. **CSS 未被真正加载**: 生产服务器的 CSS 文件可能来自旧版本（`.next/standalone/.next/static/` 目录为空，但页面引用的 CSS hash 来自新 build）
2. **Next.js 16 静态资源服务机制**: 新版本 standalone 模式可能以不同于预期的方式提供 CSS（内联、JS chunks 附带等）
3. **浏览器缓存**: 用户可能看到的是浏览器缓存的旧 CSS
4. **不同构建环境的差异**: 本地 macOS vs 服务器 Linux 可能导致 CSS 生成方式不同
5. **`contain: layout` 副作用**: `WordCard` 组件和 `virtuoso-grid-list` 使用的 CSS containment 可能在页面级产生布局隔离副作用

---

## 四、当前未提交的本地改动

以下文件有未提交修改（v5 版本）：

- `src/app/history/page.tsx` — Header 完全重构
- `src/app/users/page.tsx` — Header 平坦化
- `src/app/llm-config/page.tsx` — 标题 `shrink-0`
- `src/components/vocabulary/WordCard.tsx` — pos+translation inline 布局

---

## 五、接手须知

### 建议的排查方向

1. **用浏览器 DevTools 检查实际渲染的 CSS**
   - 打开手机浏览器远程调试（Chrome DevTools → Remote Devices）
   - 检查 h1 元素的 Computed Styles
   - 查看 CSS 文件是否真的被加载（Network 面板）

2. **直接在服务器上编辑源文件后 rebuild**
   - 通过宝塔面板将完整的 `src/` 目录上传到服务器
   - 在服务器上执行 `npm run build`
   - 消除本地/远程构建差异

3. **配置 Git 部署**
   - 在服务器上安装 git，配置 SSH key
   - `git clone` → `git pull` → `npm run build` → `pm2 reload`
   - 从根本上解决手动上传带来的各种问题

4. **验证 CSS 是否命中的快速方法**
   ```bash
   # 在服务器上检查页面引用的 CSS hash 文件是否存在
   grep -o '/_next/static/chunks/[^"]*\.css' .next/standalone/.next/server/app/history.html
   ls -la .next/standalone/.next/static/chunks/<hash>.css
   ls -la .next/static/chunks/<hash>.css
   ```

5. **排查 `contain: layout`**
   - 暂时移除 `.next/standalone/.next/server/chunks/` 中所有页面的 `contain: layout` 样式
   - 验证是否是 CSS containment 导致的布局隔离

### 关键文件索引

| 用途 | 路径 |
|------|------|
| 历史/生词本页面 | `src/app/history/page.tsx` |
| 单词卡片 | `src/components/vocabulary/WordCard.tsx` |
| 用户管理 | `src/app/users/page.tsx` |
| LLM 配置 | `src/app/llm-config/page.tsx` |
| Home 导航 | `src/components/home/HomeHeader.tsx` |
| 全局 CSS | `src/app/globals.css` |
| PM2 配置 | `ecosystem.config.js` |
| Next 配置 | `next.config.ts` |
