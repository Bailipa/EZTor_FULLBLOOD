# 1.22.0 发布目标与核验记录

## 目标与新增范围

当前活动 goal 保持进行中。用户追加的范围一并纳入本次验收：

- 正式加入极简风格：黑白灰浅/深色、按账号选择显示的主入口、翻译与词库栏目，隐藏后可从设置恢复。
- 品牌 Logo 与安装应用图标使用折页/词卡意象；同时重设计主题切换图标。现有路由、API、分享码及 URL 保持。
- 重设计分享功能、公开分享页与飞轮展示页。成果卡按点击生成，原生分享/文字/链接降级保留；词库分享与导入预览、失败重试清楚。
- 整合已授权的 CSV/共享词库数据完整性、TTS、翻译交付与周期统计保护。
- 集中整合子智能体产出，冻结源码后复核性能；记录工作报告，提交并 push；按 AGENTS.md 备份、bump、白名单打包、暂存验证、部署和线上核验。

用户流程：设置选择极简→选择所需入口→词库/翻译只挂载当前启用栏目→全部隐藏时跳转设置恢复；排行榜分享成果→生成卡片→第二次点击系统分享或复制链接→好友打开公开页→学习/下载；词库分享码→预览→导入→失败恢复；飞轮展示→实际学习入口。

## 已实现与核验（2026-10-05，CST）

| 项目 | 已实现 | 已验证 | 已部署 | 线上已验收 |
| --- | --- | --- | --- | --- |
| 极简主题及功能显隐 | 是 | 本地桌面浅/深、保存与刷新、全隐藏恢复；手机待复核 | 否 | 否 |
| 品牌及主题图标 | 是 | ICO 各尺寸 RGBA/解码、tray 透明、maskable安全区、网页图标可访问 | 否 | 否 |
| 分享/公开分享/飞轮 | 是 | 静态检查及本地实际生成成果图；公开页/适配继续核验 | 否 | 否 |
| 导入完整性 | 是 | 本机隔离真实 PostgreSQL 正常/并发/失败/恢复流程 | 否 | 否 |
| TTS/翻译交付 | 是 | 真实TTS直调、翻译交付及保存mock；生产运行待核验 | 否 | 否 |
| 发布与性能 | 进行中 | 类型/ESLint/备份实际恢复；生产构建和冻结后测量继续 | 否 | 否 |

### 数据验证

- CSV 原7/2/9计数及SRS保持，新词3/4/7；8并发自定义词库创建仅3成功。
- 52词共享导入在第51词定向故障：已提交50词，FAILED receipt/processed50，使用预约退回；重试完成52且usedCount1/importedCount52，重复导入不增加次数。
- 同账号双并发只有一次成功；过期预约可恢复；目标删除释放预约、源词库级联删除共享和receipt。
- 去重真实事务：7/1与2/8取MAX→7/8/15；最新SRS与membership并集保留。所有独立fixture按精确ID清理，残留0。
- 认证身份及第51词故障为mock，SQL锁与事务是真实执行；不是浏览器完整E2E。旧分享单元测试首次13通过/26失败，原因是旧Prisma mock不支持新receipt与锁；已补足mock并保留旧业务期望，增加2项恢复测试，目前分享41/41通过，周期时区3项也通过，最终定向44/44通过。新mock的PrismaPromise类型错误已修正，最终类型检查通过。

### 发音与翻译

- 真实上游TTS直调hello首次2694.87ms/22464bytes，同进程缓存0.59ms且无新增连接；recall双并发2283.04ms只1上游连接、独立完整Response；取消一方另一方仍完整读取。
- 翻译6项mock验证：final先于持久化gate/receipt、保存失败保留final、读final后cancel上游、旧协议兼容、parse失败cancel/release、cached retry正确目标组。4项保存不变量mock通过，没有收费模型或业务DB写入。
- ipa-dict1.0.3的legacy exports造成旧导入实际失效。修为运行时createRequire懒加载en_US.js，Map125928条；hello/apple/us命中，US保持输入音标，未知词回退。字典只在服务端使用，发布只带English及metadata/license。
- 上述TTS耗时不含Next编译、HTTP、播放；未宣称模型输出质量改善。

### 集成中发现并修正

- ICO embedded PNG原为RGB，Next报PNG is not in RGBA format、全站本地编译500；生成脚本ensureAlpha，所有尺寸colorType6/8-bit校验通过，之后/ai HTTP200。
- JSONB返回对象键重排导致功能开关PUT200但界面误报保存失败；按三个分组逐数组值确认，倒序key/非法值检查通过，实际开关恢复/保存通过。
- Minimal默认隐藏弹幕入口，但首页顶部仍显示；两个首页入口改用同一功能显隐判断，不改变用户已开启状态。
- 新静态相对引入4.48MB字典后，dev出现CPU约324%、physical footprint4.7GiB/peak4.8GiB和内存阈值自动重启。改为运行时加载后配置触发重启，冻结后三次/ai HTTP204/61/49ms，后续空闲CPU0%、RSS76448KiB。多个变量变化，不能断言巨型字典是唯一根因，也不是INP/FPS验证。
- 本轮IAB viewport override调用后实际innerWidth仍1280，不能将截图或未生效的390请求记为手机验收。

## 数据库与备份

- 本地迁移共25项已完成。新receipt与minimal迁移已应用；此前本地20260617000001三个字段类型/nullable/default与SQL一致，补记ledger已应用，没有重复DDL。
- 本地迁移前dump5,115,655bytes，SHA256 a1771d1af2461d1eeb19dd99e78e45e691245b8459627c8c12d0cf4a75f8365c，目录local-pre-import-receipts-20261005。
- 发布前生产只读：User457、Word248470、PublicWord17904、SharedVocabularyImport65、迁移23；同用户lower(word)重复组0。外观CHECK原仅reading/studio/vivid。
- 生产备份保存在服务器磁盘之外：`/Users/elee987/Library/Application Support/EZTor/Backups/predeploy-1.22.0-20261005_133615/eztor-predeploy.dump`，29,692,495bytes，SHA256 a826fbdd1d3d4c5fe34f5f172805256e4bfcfc87ad18399062f70dfcd78e3999。
- pg_restore目录242行（实际TOC227项）；本机独立eztor_restore_verify_20261005数据库实际restore4.01s成功，上述聚合计数完全一致，临时库已drop并确认不存在，业务库与生产未被恢复覆盖。

## 发布前条件与限制

- 服务器40GiB根分区19GiB可用、inode使用15%；当前1.21.0与三个回滚目录全部保留。本次不按时间盲删旧版或下载资源。
- 安装包/更新文件有约2.62GiB重复副本，当前URL和回滚引用未改；新Web归档明确排除downloads/updates，后续发布复用现有资源。
- 新增两迁移：20261005090000_share_import_receipts、20261005090000_minimal_features。迁移前需要再次核对待执行清单与备份，保留可回退旧代码。
- Android原签名文件android/build/apk/debug.keystore缺失；电脑默认key证书与线上1.13.4 APK不匹配，已向用户询问路径。禁止自动生成新key发布成兼容更新。图标源码已完成，安装包图标须正确签名重建后才能在已安装APP生效。
- Desktop builder依赖未安装；本轮尚未构建任何原生安装包，不把Web部署等同原生包更新。
- 尚未覆盖真实手机IME、Web Share系统面板、浏览器IDB/自动播放和真实付费模型流；核验方式及剩余限制须在最终报告保留。

### 周期结算发布阻断与修正

- 真实本机PostgreSQL验证发现：session TimeZone=Asia/Shanghai时，Prisma Date绑定与timestamp列比较会使当前月标记误判过期。所有9处日期绑定显式转为UTC timestamp；并发仅重置一次、当月110保留、新赚7保留、总学力不变，fixture清理0。
- 新逻辑尚未进入生产。先前两次1.22.0构建均早于此修正，不用于发布。
- 本机13:48试运行18条无周期标记的历史月余额合计1157清零；旧dump与当前逐ID核对确认，周余额/总学力未变。无周期标记不能证明余额过期：改为保留旧余额、初始化当期标记；恢复限可信快照已知值，未知时间段的新增不猜测。恢复前完整本地dump5,116,713bytes，SHA256 fadbce8db4e4a227ee61eb0e57e584c1b95548b1162e733797edf44c8f75601d；事务精确锁18IDs并核对全部原状态后恢复月余额1157，月总1237/周10/总1217；另1条80未动。批次local-power-repair-8b2c1482-7477-410d-9bdb-90024914b6e2，私有前后审计与备份同目录。

- 最终分享性能收尾：html-to-image只在首次生成卡片时加载；导入进度改为真实服务器事件驱动，移除50ms虚假进度interval；校验请求换码/关闭/卸载取消。分享和复制共用同步会话防重锁，旧请求不清新会话状态。ESLint/全项目类型检查通过。
- 既有服务端SHARE先查后upsert/addPower仍有跨设备并发重复授奖窗口，本前端防重不等同服务端幂等保护；不是本轮已证实事故。

## 发布实况

- 部署载荷对应源码提交 `24fd1e29a1b22b246e24110123b2eb2cb0c90b4b`；部署核验报告随后以提交 `45d08c7` 推送至 `origin/fix/xiaoying-start-500`。版本 `1.22.0`，Android versionCode `54`；原生 APK 因缺少线上匹配签名密钥未重建，Web 发布不改变已安装 APK 签名。
- 最终生产构建使用 `NEXT_PUBLIC_APP_URL=https://eztor.dogeggcode.cyou`、BUILD 标记 `20261005_144200`，Next BUILD_ID `4B4j8Et5fVDVpAi-IxJ21`。白名单归档 3,101 个文件、40,209,785 bytes，SHA256 `780221d46b1df9d887c7576887bc96efd7451ba80db74c464ce26cff743b2aef`；136/136 manifest 路由、86 个静态资源、25 项迁移、Linux Prisma engine、English IPA 与 metadata/license 均在包内；无环境文件、数据库、密钥、AppleDouble、缓存或 downloads/updates。归档上传后远端哈希一致。
- 切换前服务器根分区 40 GiB、可用 19 GiB、inode 使用 15%；数据库备份在服务器外：`/Users/elee987/Library/Application Support/EZTor/Backups/predeploy-1.22.0-final-20261005_1500/eztor.dump`，29,695,536 bytes，SHA256 `8f11dfbf35136863cc2b8b873dd773ed5f2c7b2f4bf1bbc24832096c9a1a7fdd`，目录242行。旧线上 `1.21.0` 保留为 `.next/standalone.bak.20261005_1505`，公共 downloads/updates 逐文件校验后复用。
- 先在 3101 暂存实例通过偏好保存/恢复与400/409校验、CSV已有7/2/9和新词3/4/7、分享创建/校验/导入/重复导入拒绝、公开分享页/API；临时两个账号及所有关联数据清理，前后聚合完全一致。重复导入接口现有协议为 HTTP200 + `success:false,error:ALREADY_IMPORTED`，未改变。
- 生产迁移 `20261005090000_minimal_features` 与 `20261005090000_share_import_receipts` 成功应用；应用前 User457/Word248473/PublicWord17905/receipt65/重复组0，应用后 User457/Word248475/PublicWord17905/receipt65/重复组0（线上期间已有正常用户新增2条私有词，非发布脚本写入）。约束已包含 minimal；无发布脚本业务写入。
- PM2 `cet4-web` online，路径 `/www/wwwroot/114.55.58.90/.next/standalone/server.js`，线上 BUILD_ID `4B4j8Et5fVDVpAi-IxJ21`。本机线上回环 `/` `/ai` `/me` `/download` `/public-vocabulary` `/api/health` `/api/version` `/api/flashcard/public?limit=5` 全200；匿名 `/history` `/dictation` `/contributions` `/leaderboard` 全307，私有 API 401；公网 HTTPS 同样通过，分享公开页与导入页200、公开分享校验接口匿名401。关键页面SSR资源均逐项200，CSP允许头像文件域名。生产流程已验证暂存认证/数据链路，未读取或修改真实用户私有数据。
- 状态：已实现 / 已验证 / Web 已部署 / 公网匿名和公开分享流程已验收。真实手机触控、系统 Web Share 面板、浏览器 IDB/自动播放和真实付费模型流仍未实测；这些限制不影响本次已验证的 Web 路由和数据库发布。
