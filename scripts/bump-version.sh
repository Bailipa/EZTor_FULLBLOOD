#!/bin/bash
# 发版前统一递增版本号（单一入口，同步所有平台/产物）
# 用法: scripts/bump-version.sh 0.4.0
set -euo pipefail

NEW="${1:-}"
if [[ ! "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "用法: scripts/bump-version.sh <x.y.z>  (如 0.4.0)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. android/app/build.gradle —— 安卓版本单一来源（build-apk.sh 与 BuildConfig 都从它读取）
GRADLE="$ROOT/android/app/build.gradle"
OLD_NAME=$(grep -m1 'versionName' "$GRADLE" | sed -E 's/.*versionName[[:space:]]+"([^"]+)".*/\1/')
OLD_CODE=$(grep -m1 'versionCode' "$GRADLE" | sed -E 's/.*versionCode[[:space:]]+([0-9]+).*/\1/')
NEW_CODE=$((OLD_CODE + 1))
sed -i.bak -E "s/versionCode[[:space:]]+[0-9]+/versionCode $NEW_CODE/" "$GRADLE"
sed -i.bak -E "s/versionName[[:space:]]+\"[^\"]*\"/versionName \"$NEW\"/" "$GRADLE"
rm -f "$GRADLE.bak"

# 2. package.json（web）
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW\"/" "$ROOT/package.json"
rm -f "$ROOT/package.json.bak"

# 3. desktop/package.json —— 决定 Windows 安装包文件名（electron-builder 读取）
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW\"/" "$ROOT/desktop/package.json"
rm -f "$ROOT/desktop/package.json.bak"

echo "✅ 版本已递增: $OLD_NAME (versionCode $OLD_CODE) -> $NEW (versionCode $NEW_CODE)"
echo "   已同步: android/app/build.gradle, package.json, desktop/package.json"
echo "   下一步: 重新构建 APK (android/build-apk.sh) 与 Windows 安装包 (electron-builder) 后部署"
echo "   注意: /api/version 按文件名识别版本，新安装包部署后应用内即可感知更新"
