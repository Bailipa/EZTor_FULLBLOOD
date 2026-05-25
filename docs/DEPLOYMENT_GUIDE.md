# 宝塔 Linux 服务器部署指南

## 适用环境

- 服务器：阿里云 ECS（2核/3.5GB 内存/40GB 磁盘）
- 面板：宝塔 Linux 面板
- 项目：EZTor（Next.js 16 + PostgreSQL + Docker）

---

## 一、环境准备

### 1.1 安装 Docker
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

### 1.2 安装 Node.js
宝塔软件商店 → Node.js 版本管理器 → 安装 v20.x

---

## 二、项目部署

### 2.1 获取代码
由于国内服务器无法直连 GitHub，用本地打包上传：
```bash
# 本地 Mac 打包（排除不必要文件）
tar czf eztor-deploy.tar.gz \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  --exclude='vendor' --exclude='coverage' --exclude='logs' web_compressed

# 宝塔面板 → 文件 → 上传到 /www/wwwroot/
# 服务器解压
cd /www/wwwroot && tar xzf eztor-deploy.tar.gz
mv web_compressed 114.55.58.90 && cd 114.55.58.90
```

### 2.2 安装依赖
```bash
# ⚠️ 删除 Mac 专属包，否则 Linux 报错
sed -i '/@next\/swc-darwin-arm64/d' package.json

# ⚠️ 如遇 npmmirror 镜像错误，切回官方源
npm config set registry https://registry.npmjs.org/
npm install
```

### 2.3 构建
```bash
npx prisma generate
NEXT_PUBLIC_APP_URL=https://eztor.dogeggcode.cyou npm run build
```

### 2.4 创建 .env
```bash
cat > .env << EOF
DB_PASSWORD=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | fold -w 24 | head -n 1)
NEXTAUTH_SECRET=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | fold -w 44 | head -n 1)
NEXTAUTH_URL=https://eztor.dogeggcode.cyou
LLM_API_KEY=你的API密钥
LLM_API_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
LLM_MODEL=deepseek-v3-250324
EOF
```

### 2.5 启动 PostgreSQL（Docker）
```bash
DB_PASS=$(grep DB_PASSWORD .env | cut -d= -f2)
docker run -d --name eztor-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=$DB_PASS \
  -e POSTGRES_DB=eztor \
  -p 127.0.0.1:5432:5432 \
  -v eztor-pgdata:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:16-alpine
```

### 2.6 执行数据库迁移
```bash
echo "DATABASE_URL=postgresql://postgres:$(grep DB_PASSWORD .env | cut -d= -f2)@localhost:5432/eztor" >> .env
npx prisma migrate deploy
```

### 2.7 启动应用
```bash
# ⚠️ standalone 模式用这个，不是 npm start
cp .env .next/standalone/.env
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

pm2 start .next/standalone/server.js --name cet4-web
pm2 save && pm2 startup
```

### 2.8 初始化种子数据

生产数据库在 `prisma migrate deploy` 后仅有表结构，无默认数据。需要手动初始化：

```bash
# 创建系统用户 + 默认词库（四六级/雅思/考研）
npx tsx scripts/seed-default-vocabularies.ts

# 创建打赏配置
docker exec eztor-db psql -U postgres -d eztor -c "INSERT INTO \"DonationConfig\" (id, title, \"isActive\", \"updatedAt\") VALUES ('global', '支持 EZTor', true, NOW()) ON CONFLICT DO NOTHING;"
docker exec eztor-db psql -U postgres -d eztor -c "UPDATE \"DonationConfig\" SET \"imageUrl\" = '/giveme.jpg', \"updatedAt\" = NOW() WHERE id = 'global' AND \"imageUrl\" IS NULL;"
```

> **关键记忆**：`DonationConfig` 表的 `updatedAt` 列没有默认值，INSERT 时必须显式指定，否则静默失败返回 0 rows。

---

## 三、Nginx 反向代理

### 3.1 宝塔面板配置
- 网站 → 添加站点 `eztor.dogeggcode.cyou`
- SSL → Let's Encrypt 证书
- 反向代理 → 目标 `http://127.0.0.1:3000`，代理目录 `/`
- WebSocket 支持头：
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

### 3.2 CSP 修复
反向代理配置文件（宝塔 → `/www/server/panel/vhost/nginx/proxy/IP/*.conf`）添加：
```nginx
proxy_hide_header Content-Security-Policy;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
```

---

## 四、常见问题速查

| 问题 | 原因 | 解决 |
|---|---|---|
| GitHub clone 超时 | 国内网络墙 | 本地打包上传 |
| `npm ci` 失败 | lockfileVersion 不兼容 | 改用 `npm install` |
| `@next/swc-darwin-arm64` 安装失败 | Mac 包装到 Linux | 从 `dependencies` 移除 |
| 样式丢失/空白页 | 静态文件没拷到 standalone | `cp -r .next/static .next/standalone/.next/` |
| CSP 阻止内联样式 | 生产 CSP 缺 `unsafe-inline` | Nginx 覆盖 CSP 或改 `next.config.ts` |
| `npm start` 不工作 | standalone 模式需不同命令 | `node .next/standalone/server.js` |
| `.env` 修改不生效 | standalone 缓存了旧 .env | 覆盖 `.next/standalone/.env` |
| 宝塔 Nginx 配置冲突 | 已有同名 location | 删除旧的代理规则后重建 |
| Git push 无代理 | 系统代理不传递给终端 | `networksetup -getwebproxy Wi-Fi` 查端口 |
| 词库为空（暂无默认词库） | 未运行种子脚本 | `npx tsx scripts/seed-default-vocabularies.ts` |
| 打赏按钮不显示 | `DonationConfig` 表为空 | Docker exec SQL 插入记录 |
| 打赏二维码不显示 | `imageUrl` 字段为 null | UPDATE 设置 `/giveme.jpg` |
| DonationConfig INSERT 返回 0 rows | `updatedAt` 列无默认值 | INSERT 时显式指定 `NOW()` |
| Nginx CSP 修改后不生效 | 未 `nginx -s reload` | 每次修改代理配置后需重载 Nginx |
| 浏览器仍显示旧 CSP | Next.js 响应头优先于 Nginx | `proxy_hide_header` + `add_header ... always` |
