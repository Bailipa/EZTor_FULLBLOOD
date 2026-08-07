#!/bin/bash
# 使用本机 Android SDK 手工构建 EZTor APK（无需 gradle/AGP）
# 依赖：JDK + Android SDK (build-tools + platforms/android-36)
set -euo pipefail

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/36.1.0"
PLATFORM="$SDK/platforms/android-36/android.jar"
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/app/src/main"
OUT="$ROOT/build/apk"
REL="$ROOT/app/build/outputs/apk/release"
# 版本单一来源：android/app/build.gradle
APP_VERSION="$(grep -m1 'versionName' "$ROOT/app/build.gradle" | sed -E 's/.*versionName[[:space:]]+"([^"]+)".*/\1/')"
APP_VERSION_CODE="$(grep -m1 'versionCode' "$ROOT/app/build.gradle" | sed -E 's/.*versionCode[[:space:]]+([0-9]+).*/\1/')"
echo "版本: versionName=$APP_VERSION versionCode=$APP_VERSION_CODE"

mkdir -p "$OUT/compiled" "$OUT/gen" "$OUT/classes" "$SRC/assets" "$REL"
rm -rf "$OUT/compiled"/* "$OUT/gen"/* "$OUT/classes"/*

echo "[1/6] aapt2 compile resources"
"$BT/aapt2" compile --dir "$SRC/res" -o "$OUT/compiled/res.zip"

echo "[2/6] aapt2 link (manifest + resources)"
"$BT/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$SRC/AndroidManifest.xml" \
  -R "$OUT/compiled/res.zip" \
  --java "$OUT/gen" \
  -A "$SRC/assets" \
  --version-code "$APP_VERSION_CODE" \
  --version-name "$APP_VERSION" \
  --auto-add-overlay \
  --min-sdk-version 24 \
  --target-sdk-version 34

echo "[2.5/6] 生成 BuildConfig（手工构建无 AGP，手动写入版本常量）"
mkdir -p "$OUT/gen/com/eztor/app"
cat > "$OUT/gen/com/eztor/app/BuildConfig.java" <<EOF
package com.eztor.app;

public final class BuildConfig {
    public static final String VERSION_NAME = "$APP_VERSION";
}
EOF

echo "[3/6] javac"
find "$SRC/java" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -source 8 -target 8 -classpath "$PLATFORM" -d "$OUT/classes" @"$OUT/sources.txt"

echo "[4/6] d8 (java -> dex)"
"$BT/d8" --release --lib "$PLATFORM" --output "$OUT/classes" $(find "$OUT/classes" -name '*.class')
mv "$OUT/classes/classes.dex" "$OUT/classes.dex"

echo "[5/6] 打包 dex 进 apk"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
zip -j "$OUT/unsigned.apk" "$OUT/classes.dex" >/dev/null

echo "[6/6] zipalign + apksigner"
"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
KEYSTORE="$OUT/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias androiddebugkey \
    -storepass android -keypass android \
    -dname "CN=Android Debug,O=Android,C=US" \
    -keyalg RSA -keysize 2048 -validity 10000 >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out "$REL/eztor-$APP_VERSION.apk" "$OUT/aligned.apk"

echo ""
echo "✅ 构建完成: $REL/eztor-$APP_VERSION.apk"
ls -lh "$REL/eztor-$APP_VERSION.apk"
