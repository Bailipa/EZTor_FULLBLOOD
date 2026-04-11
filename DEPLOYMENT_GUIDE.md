# 部署指南

## 服务器信息
- 服务器IP: 114.55.58.90
- 部署路径: /www/wwwroot/114.55.58.90
- 管理工具: 宝塔面板

## 部署步骤

### 第一步：在服务器上安装 Node.js 和 PM2

1. **登录宝塔面板**
   - 使用你的账号登录宝塔面板

2. **安装 Node.js**
   - 在宝塔面板中，进入"软件商店"
   - 搜索"Node.js"
   - 选择并安装 Node.js 18.x 或 20.x 版本（推荐 20.x）
   - 安装完成后，记录安装路径（通常是 /www/server/nodejs/v20.x.x/）

3. **安装 PM2**
   - 在宝塔面板的"终端"中执行以下命令：
   ```bash
   npm install -g pm2
   ```
   或者使用宝塔面板的"PM2管理器"插件安装

4. **验证安装**
   ```bash
   node -v
   npm -v
   pm2 -v
   ```

### 第二步：上传文件到服务器

1. **压缩本地 deploy 目录**
   - 在本地 Windows 上，右键点击 `d:\TTTT\四级\web\deploy` 文件夹
   - 选择"发送到" -> "压缩(zipped)文件夹"
   - 或者使用以下 PowerShell 命令：
   ```powershell
   Compress-Archive -Path "d:\TTTT\四级\web\deploy\*" -DestinationPath "d:\TTTT\四级\web\deploy.zip"
   ```

2. **上传到服务器**
   - 在宝塔面板中，进入"文件"管理
   - 导航到 /www/wwwroot/114.55.58.90
   - 上传 deploy.zip 文件
   - 解压文件到当前目录

3. **验证文件结构**
   确保服务器上的目录结构如下：
   ```
   /www/wwwroot/114.55.58.90/
   ├── .next/
   ├── public/
   ├── prisma/
   ├── package.json
   ├── server.js
   ├── ecosystem.config.js
   └── start.sh
   ```

### 第三步：在服务器上安装项目依赖

1. **进入项目目录**
   ```bash
   cd /www/wwwroot/114.55.58.90
   ```

2. **安装依赖**
   ```bash
   npm install --production
   ```

3. **验证安装**
   - 检查 node_modules 目录是否创建成功

### 第四步：配置环境变量和数据库

1. **创建 .env 文件**
   ```bash
   nano .env
   ```
   或者在宝塔面板的文件管理中创建 .env 文件

2. **添加以下内容**（根据你的实际情况修改）：
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL="file:./prisma/dev.db"
   NEXTAUTH_URL="http://114.55.58.90"
   NEXTAUTH_SECRET="your-secret-key-here"
   ```

   **重要提示**：
   - 生成 NEXTAUTH_SECRET：在终端执行 `openssl rand -base64 32` 获取随机密钥
   - 如果使用 HTTPS，将 NEXTAUTH_URL 改为 https://114.55.58.90
   - `prisma/dev.db` 是你的生产数据库文件（用户词库都在这里）：部署更新时务必避免被本地文件覆盖，建议定期备份

3. **设置文件权限**
   ```bash
   chmod -R 755 /www/wwwroot/114.55.58.90
   chmod 644 .env
   ```

4. **初始化数据库**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### 第五步：使用 PM2 启动应用

1. **使用 PM2 启动应用**
   ```bash
   cd /www/wwwroot/114.55.58.90
   pm2 start ecosystem.config.js
   ```

2. **查看应用状态**
   ```bash
   pm2 status
   pm2 logs cet4-web
   ```

3. **设置 PM2 开机自启**
   ```bash
   pm2 startup
   pm2 save
   ```

### 第六步：在宝塔面板配置反向代理

1. **添加站点**
   - 在宝塔面板中，进入"网站"
   - 点击"添加站点"
   - 域名填写：114.55.58.90（或你的域名）
   - 根目录选择：/www/wwwroot/114.55.58.90
   - PHP版本选择：纯静态
   - 点击提交

2. **配置反向代理**
   - 在网站列表中，找到刚创建的站点
   - 点击"设置"
   - 选择"反向代理"
   - 点击"添加反向代理"
   - 代理名称：nextjs
   - 目标URL：http://127.0.0.1:3000
   - 发送域名：$host
   - 点击提交
   - **重要：由于 Next.js 自带缓存机制，请不要在宝塔面板的"反向代理"设置中开启"缓存"功能，否则会导致页面内容不更新（复活Bug）。**
   - **进入反向代理的配置文件，确保没有任何针对 html 的强制缓存规则。**

3. **配置 SSL（可选但推荐）**
   - 在站点设置中，选择"SSL"
   - 选择 Let's Encrypt 免费证书
   - 填写你的邮箱
   - 点击申请
   - 申请成功后，开启"强制HTTPS"

### 第七步：验证部署

1. **检查 PM2 状态**
   ```bash
   pm2 status
   pm2 logs cet4-web --lines 50
   ```

2. **访问网站**
   - 在浏览器中访问：http://114.55.58.90
   - 如果配置了 SSL，访问：https://114.55.58.90

3. **检查日志**
   - 如果有问题，查看 PM2 日志：
   ```bash
   pm2 logs cet4-web
   ```

## 常见问题排查

### 1. 应用无法启动
- 检查端口 3000 是否被占用：`netstat -tlnp | grep 3000`
- 检查 .env 文件是否正确配置
- 查看 PM2 日志：`pm2 logs cet4-web`

### 2. 数据库错误
- 确保 prisma 目录存在且有正确的权限
- 重新运行：`npx prisma generate` 和 `npx prisma db push`

### 3. 502 Bad Gateway
- 检查 PM2 应用是否正在运行：`pm2 status`
- 检查反向代理配置是否正确
- 检查防火墙是否开放了 3000 端口

### 4. 静态资源加载失败
- 检查 public 目录是否存在
- 检查文件权限是否正确

## 更新部署

当需要更新应用时：

1. **停止应用**
   ```bash
   pm2 stop cet4-web
   ```

2. **上传新文件**
   - 在宝塔面板中，进入"文件"管理
   - 导航到 /www/wwwroot/114.55.58.90
   - **重要：为了避免"幽灵复活"bug（旧UI缓存或新旧文件冲突），请先删除服务器上的 `.next` 文件夹**
   - **重要：不要用本地的 `prisma/dev.db` 覆盖服务器上的数据库文件**（否则用户词库会“消失”）
   - 上传新的 deploy.zip 文件
   - 解压文件到当前目录并覆盖原有文件

3. **安装新依赖（如果有变化）**
   ```bash
   npm install --production
   ```

4. **重启应用**
   ```bash
   pm2 restart cet4-web
   ```

## 监控和维护

### 查看 PM2 监控
```bash
pm2 monit
```

### 查看应用日志
```bash
pm2 logs cet4-web
```

### 重启应用
```bash
pm2 restart cet4-web
```

### 停止应用
```bash
pm2 stop cet4-web
```

### 删除应用
```bash
pm2 delete cet4-web
```

## 安全建议

1. **定期更新依赖**
   ```bash
   npm update
   ```

2. **配置防火墙**
   - 只开放必要的端口（80, 443, 22）
   - 关闭不必要的端口

3. **定期备份数据库**
   ```bash
   cp /www/wwwroot/114.55.58.90/prisma/dev.db /backup/dev.db.$(date +%Y%m%d)
   ```

4. **设置强密码**
   - 为服务器和宝塔面板设置强密码
   - 定期更换密码

## 联系支持

如果遇到问题，请提供以下信息：
- PM2 日志：`pm2 logs cet4-web --lines 100`
- Nginx 错误日志：/www/server/panel/vhost/nginx/114.55.58.90.error.log
- 系统日志：`journalctl -xe`

---

## 管理员工具

### 查看所有用户

```bash
npx tsx scripts/list-users.ts
```

输出示例：
```
用户列表:
────────────────────────────────────────────────────────────
1. creator [管理员]
   ID: cmnjzc3r80016geadf2vaczm4
   创建时间: 2026/4/4 14:56:52
────────────────────────────────────────────────────────────

共 1 个用户
```

### 设置管理员

```bash
npx tsx scripts/set-admin.ts <用户名>
```

示例：
```bash
npx tsx scripts/set-admin.ts creator
```

输出：
```
✅ 用户 "creator" 已设置为管理员
   ID: cmnjzc3r80016geadf2vaczm4
   isAdmin: true
```

### 管理员功能

管理员可以访问以下功能：

| 路径 | 功能 |
|------|------|
| `/analytics` | 数据分析看板（用户统计、翻译次数、活动趋势） |
| `/api/config` | API 配置管理 |

### 数据分析看板

访问 `/analytics` 可查看：

- **用户指标**：总用户数、日活用户、新增用户
- **功能使用**：翻译次数、默写次数
- **活动趋势**：每日事件数量变化图
- **事件分布**：各类型事件统计
- **时间范围**：支持 24小时 / 7天 / 30天 切换
