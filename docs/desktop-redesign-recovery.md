# 桌面重设计恢复点

本地 Git 界面快照：`70c456f93d72f214295f9c5ef458fdb9dddbc2fe`

分支引用：`codex/ui-before-reading-redesign`。仅恢复以下文件，不用 reset --hard。该快照包含本轮开始前这些文件的未提交改动；不是整站可部署版本。

```sh
git restore --source=70c456f93d72f214295f9c5ef458fdb9dddbc2fe -- \
  src/components/home/HomeContent.tsx \
  src/components/home/HomeHeader.tsx \
  src/components/home/WordInputRow.tsx \
  src/components/home/WordTranslationPanel.tsx \
  src/components/ai/TranslationWorkspace.tsx \
  src/components/ai/translation-workspace.module.css \
  src/components/ai/ZhEnAssistant.tsx \
  src/components/layout/AppSidebar.tsx \
  src/components/layout/AppLayout.tsx \
  src/app/me/page.tsx \
  'src/app/api/preferences/route.ts' \
  'src/app/api/auth/[...nextauth]/route.ts' \
  'src/app/api/auth/xiaoying/callback/route.ts' \
  'src/app/layout.tsx'
```

恢复前先保存后续修改。工作记录与此说明保留，不随界面恢复。

## 数据兼容与新增文件

- 本轮本地新增迁移 `20261002160000_add_interface_style`，只为 `UserPreference` 添加 `interfaceStyle` 和合法值约束。旧账号值为 `reading`，新账号注册时随机分配一次。
- 上述恢复命令回退界面和注册/偏好接口代码，但**保留新列、schema 字段和迁移文件**。旧代码不读写该列，数据库可向后兼容；不要删列、删除迁移记录或用整库备份覆盖用户后续数据。
- 新增的 `src/components/interface-style-provider.tsx`、`src/lib/interfaceStyle.ts` 在恢复上述引用方后不再使用，可以保留归档。恢复后执行 `npm run db:generate` 并重启开发服务。
- 该快照是文件级恢复点，不是完整可部署分支，不应直接 checkout 后发布。原工作分支、暂存区、其他未提交业务开发成果均未改动。
- `工作记录.txt` 和本说明保留审计信息。恢复前再次保存当前文件；不要使用 `git reset --hard` 或 `git clean`。

## 本地数据库备份

- 路径：`/Users/elee987/Library/Application Support/EZTor/backups/interface-style-20261002-221720/eztor-local.dump`
- SHA-256：`311b75fedb13ebdd8ed15a6fe1ae2c11960b0e0c2a73bdc9c29f0a5bf2e98b35`
- 已核对 pg_restore 可读取目录；未进行整库恢复演练。没有访问或改动生产数据库。

## 第二轮截图修正前快照

`7526dff564480b1a7d107e3adce83e93c9770ce6`（`codex/ui-before-spacing-fixes`）。以下命令只恢复本轮布局相关文件，不改数据库或账号偏好逻辑：

```sh
git restore --source=7526dff564480b1a7d107e3adce83e93c9770ce6 -- \
  src/app/globals.css \
  src/app/me/page.tsx \
  src/components/ai/translation-workspace.module.css \
  src/components/ai/ZhEnAssistant.tsx \
  src/components/home/WordInputRow.tsx \
  src/components/home/WordTranslationPanel.tsx \
  src/components/home/HomeContent.tsx \
  src/components/home/HomeHeader.tsx \
  src/components/flashcard/FullscreenFlashcard.tsx
```

## Rare UI 动效前快照

`214ff2ab52ea5a2ca7fe8e6247cc0cf02cdf053f`（`codex/ui-before-rare-motion`）。只恢复以下文件后，新增的 rare 组件、hook 和许可证可保留归档，已经不被页面引用。

```sh
git restore --source=214ff2ab52ea5a2ca7fe8e6247cc0cf02cdf053f -- \
  src/components/ai/ZhEnAssistant.tsx \
  src/components/ai/TranslationWorkspace.tsx \
  src/components/home/WordTranslationPanel.tsx \
  src/components/home/WordInputRow.tsx \
  src/components/flashcard/FullscreenFlashcard.tsx \
  src/components/ai/translation-workspace.module.css \
  src/app/me/page.tsx
```

## 手机径向导航前快照

`f8bfd6590641db776936343de08e32db1ca51b9c`（`codex/ui-before-radial-nav`），仅用于文件级恢复。新增 CSS 和 vendor 文件恢复后可保留归档。

```sh
git restore --source=f8bfd6590641db776936343de08e32db1ca51b9c -- \
  src/components/layout/MobileNavBar.tsx \
  src/components/layout/AppLayout.tsx \
  src/app/ai/page.tsx \
  src/app/dictation/page.tsx \
  src/components/home/HomeContent.tsx \
  public/flywheel-preview.html \
  src/middleware.ts
```

## 星空磨砂辉金前快照

`2e0eaff61e099ff1764f23f3f81e330e494819f5`（`codex/ui-before-cosmic-gold`）。保留此前径向菜单、Rare UI 和三风格实现；仅文件级恢复：

```sh
git restore --source=2e0eaff61e099ff1764f23f3f81e330e494819f5 -- \
  src/app/globals.css \
  src/components/ai/translation-workspace.module.css \
  src/components/layout/mobile-navigation.module.css
```


## 侧栏对齐与径向拖动前快照

`6f1c7786ec0e4c428b6b705a848a61e49f7c7498`（`codex/ui-before-radial-drag`）。包含此前蓝金磨砂主题；仅文件级恢复：

```sh
git restore --source=6f1c7786ec0e4c428b6b705a848a61e49f7c7498 -- src/components/layout/MobileNavBar.tsx src/components/layout/mobile-navigation.module.css src/components/layout/AppSidebar.tsx src/components/ai/translation-workspace.module.css
```

## 菜单扩展、首页任务和手机我的页前快照

`9dc4d12e3171d35a5f54e6128ab36fbd61566a3c`（`codex/ui-before-mobile-tasks`）。保留进入本轮前的完整文件内容，含此前未跟踪的翻译/径向菜单 CSS；仅文件级恢复：

```sh
git restore --source=9dc4d12e3171d35a5f54e6128ab36fbd61566a3c -- \
  src/components/layout/MobileNavBar.tsx \
  src/components/layout/mobile-navigation.module.css \
  src/components/home/HomeContent.tsx \
  src/components/home/HomeHeader.tsx \
  src/components/ui/flashcard/flashcard-widget.tsx \
  src/features/gamification/components/DailyTaskCard.tsx \
  src/app/public-vocabulary/page.tsx \
  src/components/ai/translation-workspace.module.css \
  src/app/me/page.tsx
```

## 靛辉深灰主题前快照

`0145292fa8f10d7ee6e1b9b82f6850aea8c0c108`（`codex/ui-before-indigo-theme`），仅文件级恢复：

```sh
git restore --source=0145292fa8f10d7ee6e1b9b82f6850aea8c0c108 -- \
  src/app/globals.css \
  src/app/layout.tsx \
  src/components/brand-theme-provider.tsx \
  src/components/mode-toggle.tsx \
  src/components/home/ResultsList.tsx
```

本轮另将靛辉主题模块样式追加到 `src/components/ai/translation-workspace.module.css` 和 `src/components/layout/mobile-navigation.module.css`。这两个文件在 Git 主索引中原本未跟踪，需按本轮前的工作记录快照恢复；勿用当前分支 HEAD 覆盖。
