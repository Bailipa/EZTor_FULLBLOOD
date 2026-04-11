#!/bin/bash
# 一键部署脚本 - 在服务器上运行

PROJECT_DIR="/www/wwwroot/114.55.58.90"
APP_NAME="cet4-web"

echo "=== 开始一键部署 ==="

cd $PROJECT_DIR

echo "[1/6] 删除旧构建..."
rm -rf .next

echo "[2/6] 安装依赖..."
npm install --production

echo "[3/6] 生成 Prisma Client..."
npx prisma generate

echo "[4/6] 同步数据库..."
npx prisma db push

echo "[5/6] 重启 PM2 应用..."
pm2 stop $APP_NAME 2>/dev/null
pm2 start ecosystem.config.js

echo "[6/6] 保存 PM2 状态..."
pm2 save

echo ""
echo "=== 部署完成 ==="
echo "查看状态: pm2 status"
echo "查看日志: pm2 logs $APP_NAME"
echo "访问应用: http://114.55.58.90"