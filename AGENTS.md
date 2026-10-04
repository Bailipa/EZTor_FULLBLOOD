<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Behavioral Guidelines

These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan before starting.

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### 5. 版本号规则（每次部署必须 bump，发版前确认）

- **小更新**（bug 修复、图标/文案等零碎改动）→ 第三个小数位（`0.4.4` → `0.4.5`）
- **中等更新**（单个功能优化，如弹幕调节、自动更新）→ 第二个小数位（`0.4.4` → `0.5.0`）
- 用 `scripts/bump-version.sh <版本>` 统一同步 build.gradle / package.json / desktop/package.json
- 若用户明确说"这次算了/先不 bump"（还有待优化项），则**不 bump**，继续迭代待部署的东西。

### 6. 生产数据与故障诊断

- 处理生产数据事故前，先只读核对当前数据、相关写入入口、定时任务和审计记录。记录中明确区分**已证实的原因**与**待验证的假设**；不能只凭代码里存在某种行为，就断言它触发了本次事故。
- 改生产数据前，保存受影响数据快照；涉及数据库迁移或批量改数时，另做完整数据库备份并校验文件。重要生产备份应存放在目标服务器磁盘之外，并定期验证可恢复性。
- 找不到可信的历史数据来源时，不伪造原值。先说明无法恢复的范围；在用户授权的范围内执行事务性修复，写入批次号和可追溯的前后值，并核对数量、关联计数、唯一性和容量等业务约束。
- 修复数据丢失类问题时，检查造成数据变化的所有代码路径，包括定时任务、管理员操作、导入脚本和 API；为已确认的根因添加适当的回归保护，避免修复只覆盖表面症状。

### 7. 发布与回滚

- 部署前检查磁盘空间，按上传包、解压后的新版本、数据库 WAL/迁移临时开销及回滚版本共同估算需求；空间不足以安全完成部署时先停止发布并处理空间。
- 发布包采用明确的文件白名单。上传前检查归档清单，排除环境文件、密钥、本地数据库、系统侧车文件和无关缓存；上传后校验文件哈希，再进行解包或切换。
- 每次发布记录版本号、BUILD_ID、源码提交号或工作区状态、迁移清单、归档哈希、数据库备份位置和回滚目标；工作记录不得包含凭据或秘密值。
- 发布后同时核对进程状态、数据库连接、健康检查、关键匿名/登录路由和本次改动涉及的真实用户流程。HTTP 200、构建成功或单个页面打开不能单独作为功能验收依据。
- 执行回滚前确认代码版本、数据库迁移和数据兼容性；保留当前版本及可工作的回滚版本。共享资源被新旧版本引用时，清理旧版本前先检查引用关系。

### 8. 体验与完成标准

- 开始多页面或多步骤功能前，先画出目标用户流程、页面职责和主入口；实现时检查入口重复、主动作优先级、桌面与手机布局，以及返回、刷新和中断恢复。
- 对翻译、推荐等结果质量改动，准备有代表性的输入和期望结果，比较改动前后输出；只改了入口或交互时，不宣称模型结果质量已改善。
- 为每个待办分别记录“已实现、已验证、已部署、线上已验收”。完成标准必须覆盖该任务的端到端流程与失败/恢复路径；不能只依据代码已合并、构建成功或页面可打开就勾选完成。
- 按风险选择验证方式。涉及数据完整性、权限、定时任务和用户主流程的改动，优先验证对应不变量与完整流程；验证环境、未覆盖的平台和剩余限制要写进工作记录。
- 工作记录使用可复核的事实：时间、版本/构建号、备份与校验值、操作范围、前后计数、验证结果及未确认事项。发现记录中的版本、原因或完成状态写错时，及时更正并注明更正内容。
