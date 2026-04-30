# Key Import（密钥导入）故障排查与修复建议

> **状态**：⚠️ 已知问题 — `shareUrl` 指向 `/share/import?code=...` 页面仍不存在（截至 2026-04-29），弹窗导入 (`ShareImportModal`) 可正常工作。  
> **最后更新**：2026-04-29

本文档描述当前项目中“密钥导入 / Key Import”（分享词库导入）功能**最常见的失效点**、如何复现、以及推荐的修复方向。

---

## 1. 功能范围与相关入口

“密钥导入”对应的是**通过分享密钥（形如 `ABC-234-XYZ`）把他人分享的复习分组词库导入到自己账号**。

相关后端接口：

- 创建分享：`/Users/elee987/Downloads/web_compressed/src/app/api/share/create/route.ts`
  - 返回字段里包含 `code`、以及一个 `shareUrl`
- 校验密钥：`/Users/elee987/Downloads/web_compressed/src/app/api/share/validate/[code]/route.ts`
- 执行导入：`/Users/elee987/Downloads/web_compressed/src/app/api/share/import/route.ts`

相关前端（当前项目实际使用的是“弹窗导入”而不是单独页面）：

- 导入弹窗：`/Users/elee987/Downloads/web_compressed/src/components/vocabulary/ShareImportModal.tsx`

---

## 2. 当前最关键的问题：`shareUrl` 指向了不存在的页面

### 2.1 现象（用户视角）

当用户创建分享后，拿到一个导入链接（`shareUrl`），点击/打开链接会出现：

- 404 Not Found（页面不存在）
- 或无法进入导入流程（因为根本没有对应页面承接该 URL）

这通常会被用户表述为：“密钥导入功能不工作 / 链接打不开 / 点链接没反应”。

### 2.2 复现步骤

1. 调用创建分享接口 `POST /api/share/create`
2. 从响应中取出 `shareUrl`，其格式当前为：
   - `https://<host>/share/import?code=<CODE>`
3. 在浏览器打开该链接
4. 结果：项目路由中不存在 `/share/import` 页面，因此会 404

### 2.3 根因定位

- `shareUrl` 在 `src/app/api/share/create/route.ts` 中被拼为 `/share/import?code=...`
- 但项目 `src/app` 下**没有** `share/import` 对应的页面路由（例如 `src/app/share/import/page.tsx` 不存在）

因此，**“链接导入”必然不可用**。

---

## 3. 次要但常见的兼容性问题：导入接口是“流式 NDJSON”，不是标准 JSON

`/api/share/import` 的响应默认是：

- `Content-Type: text/plain`
- body 为多行 JSON（每行一个 JSON），用于实时汇报 `progress/step`，最后一行才是最终 `{ success: true/false, ... }`

也就是说它更接近 **NDJSON**（Newline-Delimited JSON）/流式文本，而不是单次 JSON。

### 3.1 影响

- `ShareImportModal.tsx` 里使用 `response.body.getReader()` 按行解析，因此**弹窗导入**可正常工作。
- 但如果任何调用方（包括未来的移动端、脚本、或第三方）按“常规 JSON API”写法调用：
  - `await fetch(...).then(r => r.json())`
  - 会直接解析失败，从而被认为“导入坏了”。

### 3.2 修复方向（任选其一）

- 方向 A：明确协议（推荐）
  - 把接口声明为 NDJSON，并在响应头使用更明确的类型（如 `application/x-ndjson`），同时在文档/调用方中按行解析。
- 方向 B：提供双模式
  - 增加参数（如 `?stream=0`），当关闭 stream 时返回一次性 JSON（`application/json`），方便非前端流式调用。

---

## 4. 可能的运行时问题：使用了 Node.js Stream，需确认路由运行在 Node runtime

`/api/share/import` 使用了 Node 的 `stream.Readable` 并通过 `Readable.toWeb()` 转 Web Stream。

如果该 Route Handler 在某些部署环境被配置为 Edge runtime，则可能出现：

- Node Stream 不可用
- 直接抛错导致导入失败

### 建议

- 参考项目中 `src/app/api/tts/route.ts` 的做法，导入路由如果依赖 Node 能力，应该显式指定 Node runtime（例如 `export const runtime = 'nodejs'`）。
- 具体是否需要，取决于你们实际部署目标与 Next 运行时策略。

---

## 5. 推荐的“最小修复方案”（代码层面建议，本文档不执行）

根据你们希望的用户体验，二选一即可：

### 方案 1：补齐 `/share/import` 页面（最符合 `shareUrl` 的语义）

目标：让 `https://<host>/share/import?code=...` 能打开一个页面，并自动进入导入 UI。

实现方向：

- 新增页面路由：`src/app/share/import/page.tsx`
- 页面读取 query 参数 `code`，并渲染/触发 `ShareImportModal` 或一个独立导入页面

### 方案 2：修改 `shareUrl` 指向现有页面（不新增页面）

目标：不引入新路由，让 `shareUrl` 直接跳到当前实际存在的页面（例如词库页/历史页），并通过 query 参数唤起导入弹窗。

实现方向：

- 统一选一个现有页面（例如词库管理页）
- `shareUrl` 改成：`/<existing-page>?importCode=<CODE>`
- 在该页面检测 `importCode` 并打开导入弹窗，自动填入密钥并触发校验

---

## 6. 快速自检清单（排障顺序）

1. 打开 `shareUrl` 是否 404？
   - 是：优先修复第 2 节（缺少 `/share/import` 页面或链接指向错误）
2. 使用弹窗导入是否正常，但脚本/第三方调用失败？
   - 是：优先修复第 3 节（NDJSON vs JSON 协议问题）
3. 部署环境是否为 Edge runtime 或限制 Node API？
   - 是：检查第 4 节（Node stream runtime）

