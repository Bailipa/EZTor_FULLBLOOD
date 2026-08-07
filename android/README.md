# EZTor Android（浏览器套壳 APK）

纯 WebView 套壳应用：App 内直接加载 https://eztor.dogeggcode.cyou，
数据与网页/PWA 完全同步（同一账号）。

## 构建（需 Android Studio / Android SDK）

```bash
# 1. 用 Android Studio 打开本 android/ 目录（会自动生成 gradle wrapper）
#    或使用命令行（需已装 Android SDK，配置 ANDROID_HOME）：
cd android
# gradlew 由 Android Studio 首次同步时生成；也可手动:
gradle assembleDebug        # 调试包
gradle assembleRelease      # 发布包 → app/build/outputs/apk/release/
```

## 产物

- `app/build/outputs/apk/release/app-release.apk`（签名后即可分发）
- 将 APK 放到仓库 `public/downloads/`，`/download` 页面会自动出现下载入口。

## 说明

- 单 Activity + WebView，仅开 INTERNET 权限。
- 内置浏览器打开外部链接；网页内的登录/分享/下载等均由网页自身处理。
- 网页端已发布 PWA，安卓也推荐直接用 Chrome「安装应用」，体验等同且免 APK。
