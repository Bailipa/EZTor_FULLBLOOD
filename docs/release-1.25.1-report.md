# 1.25.1 发布报告（2026-10-06）

## 范围

- 原中性“默认”配色退出选择列表；新默认靛辉，旧中性存储迁移到靛辉；保留明确选择的辉金/紫色。
- APP/网页常规图标生成20%透明圆角，maskable图标仍保留完整底板供系统裁切。
- 翻译与词库三栏断点从1440统一为1280 CSS px，1100仍两栏，更窄为单栏；极简风格保持单栏目。
- 修复靛辉浅色桌面词库工具栏白字/浅底冲突。
- 四六级大版本goal仍暂停。本轮无数据库迁移、无业务批量写入。

## 根因与验证边界

已确认：旧三栏断点造成1280 CSS px下只显示两栏，JS和CSS有相同限制，无Windows专属分支。
推断：系统/浏览器缩放可能导致Windows的CSS视口比Mac小。未读取用户真实Windows缩放，不能断言是某个具体比例。

本地IAB1280工作台：翻译3栏4区域，词库3栏；1100词库2栏；390单栏无横溢；1366静阅翻译3栏。公共词库实际独立滚动top0→1700。1366靛辉浅色桌面首页无横溢，标题/内容可见。原极简风格核验后恢复。截图存于/tmp/eztor-1.25.1-desktop-1366.jpg和/tmp/eztor-1.25.1-home-1366.jpg。

公网IAB1280：通过真实登录态侧栏进入词库，3栏均可见；点击贡献榜后公共词库保留，独立滚动top0→900。翻译3栏/4区域，HTML构建标记20261006_123500，无横向溢出；本轮error/warn捕获为空。没有提交词条、答案、模型请求或聊天消息。截图/tmp/eztor-1.25.1-online-ai-1280.jpg及/tmp/eztor-1.25.1-online-vocabulary-1280.jpg。未在物理Windows、Android、iPhone安装/操作，不宣称全设备验收。

## 构建与发布

- 版本1.25.1，Android versionCode59；源码1dfabe3b9e44c43dbaded8de70fa0799df4dbd63，已push。
- typecheck、定向ESLint、git diff --check通过。Next16.2.3生产构建通过，既有middleware弃用/构建期LLM_API_KEY警告保留；本轮未新增依赖/轮询。
- Next BUILD_ID：XkyCyc1SJfoE0abmRejo2；NEXT_PUBLIC_BUILD_ID：20261006_123500。
- Web白名单归档39,978,113bytes，3758成员/86static项/25迁移SQL，sourceDirty=false；SHA256 d5f62249e9573b377831d5a641f0a822f253541b282f02d115cdb1c85dcdddac。
- 原生13文件白名单归档535,971,840bytes；SHA256 97c688af56f2b5cf9790c66355f57e641ed46ac3c579076bdab734c012c64b04，远端下载/更新两目录所有文件逐一核对哈希一致，保留旧安装包。
- APK SHA256 501fdd9bf0e453dd32aebac006e729b2958263de341a03abe80c4d4d3384c304；证书46fcd1b35ffd623f21063b71a9cb031e4c77e2ec05c2924507f38f7aa6b54378，与1.25.0相同；旧1.13.4之前仍需卸载。Windows安装器SHA256 1f6ba68162a075d37f69307c40a57ccbf5fba2cc110472e6345593aafe0cfff7；Mac arm64 zip 18d05370199717f62726f48aaadab3f143ab27e1bb3aff1c1fd72f81844e5950，三个代表安装包公网下载哈希一致。Mac/Windows仍无代码签名证书。
- 更新桥误用Node运行失败后，改用Electron运行时全部通过（UPDATE BRIDGE OK），未因此改动业务代码。

## 数据保护与运行状态

生产数据库备份服务器外位置：/Users/elee987/Library/Application Support/EZTor/Backups/predeploy-1.25.1-20261006_1230/eztor-predeploy.dump；29,710,678bytes，SHA256 4f7af7f3ad32b3f89a01ff94f7712b5c49e07dbeea63e636ba849434b903f389，远端一致，pg_restore目录242行；本轮没有另做恢复演练。迁移25条无变化。

12:34前后先在确认空闲的3104启动暂存包，健康检查包含实际数据库SELECT1、匿名/认证入口、公开词库数据均通过后切换。PM2 cet4-web online/PID1172984/版本1.25.1。回滚目标：/www/wwwroot/114.55.58.90/.next/standalone.bak.20261006_1238（目录标记1238，实际切换发生12:34，勿据目录名推断时刻）。env权限600，静态文件644/目录755。

回环与公网匿名路由、健康、版本、认证session/providers、manifest、图标、公开词库API均200；未登录/history、/dictation、/contributions、/leaderboard按预期307。AI首页实际引用22个JS/CSS静态资源全部公网200；圆角512PNG公网SHA256 144d0648a14c2e3457da624b6aaedecb0bb1cf6b876866c364bb5cc38b6591c7。/api/version与latest更新清单全平台1.25.1（Linux无新包）。

发布前磁盘12G，峰值剩8G；已仅清除本轮校验后的native.tar与其解压临时目录，回升9G，旧备份/下载包保留。实际新增开销约4G，比准备时约3.5G估算稍高，仍在安全预算内。本地3000开发服务保持运行，末次/ai200/61ms，这不是完整性能对照。

## 发布中意外与处理

- Git代理127.0.0.1:7897不可连接：仅对push临时清除代理，不改全局代理，重试成功。
- 归档检查误把编译/api/downloads目录当作持久下载目录：修改检查为精确public/downloads、public/updates后通过；没有删除编译路由。
- Linux tar对macOS provenance扩展属性有忽略警告，不产生系统侧车文件，后续所有实际文件/哈希与运行检查通过。
- 预启动/重启的第一次连接拒绝在启动等待内恢复，最终健康/路由检查通过；未拿旧3101/3102/3103预览服务结果作验收。

下载页线上实际操作：选择Windows显示1.25.1 exe；切换设备至Android显示1.25.1 APK并保留旧版卸载提示；未执行安装。

## 完成状态

配色/圆角图标/三栏修复：已实现、按所列范围验证、已部署、线上已验收。真实物理设备安装、Windows实际缩放场景和完整用户私有写入未覆盖。本轮主要更改布局和资源，不宣称翻译质量、通过率或学习能力改进。
