# 剩余待办实现的平台验证记录

日期：2026-10-02（Asia/Shanghai）

## 本地检查

- `npm run typecheck -- --pretty false`：通过。
- `git diff --check`：通过。
- `npm run build`：通过，Next.js 16.2.3 生成了贡献榜、翻译、公共词库、错词本和相应 API 路由。
- computer-use 本地浏览器检查：首页可以直接输入待查单词；`/ai` 可切换到独立文本翻译页，显示每日额度、可选润色和“结果不会加入单词库”；`/leaderboard/contributions` 显示默认仅本人可见及尚未启用的提示。
- “我的”页偏好控件可见；自动保存和学习提示音开关均显示为默认开启。白金日间和黑金夜间都做了视觉查看，辉光选项显示为浓郁；查看后恢复原有暗色外观。
- 本地 PostgreSQL 开发库已应用两条新增 Prisma 迁移。历史公共词仅标为 `LEGACY_UNKNOWN`；此本地环境未设置 `CONTRIBUTION_T0`，贡献统计保持关闭。

## 平台边界

- 浏览器目测覆盖了本地 Web 页面；没有在真实 iOS/Android 设备、不同系统键盘、已安装 PWA 或 Android WebView 上完成设备验证。
- 本轮没有验证安装、断网、离线缓存或离线学习，也没有声称 Web manifest 已提供离线能力。
- App 方向按决策先完善响应式 Web 与现有壳的反馈桥接，未重写原生 App。PWA 和设备差异仍需按设计文档的步骤验证。
- 未在本轮部署或改生产数据库；不要在可信起始日确定前启用线上贡献榜。

## 构建提示

构建成功，仍输出现存提示：Next.js middleware 文件约定已弃用；`ipa-dict/lib/en_US` 动态模块路径无法在构建期解析；构建环境未提供 `LLM_API_KEY`。这些提示没有阻止本次构建。
