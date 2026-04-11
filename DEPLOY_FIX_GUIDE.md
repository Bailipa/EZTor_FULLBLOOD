# 🚀 Bug 修复部署指南

**修复日期**: 2026-04-08  
**修复内容**: 
- Bug 1: 多用户共用私有单词本（认证逻辑优化）
- Bug 2: 单词卡功能返回错误

---

## ✅ 本地修复已完成

以下文件已修复：
1. ✅ `src/lib/auth.ts` - **保留自动注册**，增加并发保护和错误处理
2. ✅ `src/components/ui/flashcard/flashcard-widget.tsx` - 改进错误处理和登录检查

---

## ⚠️ 重要说明：关于 Bug 1 的修复

**您的注册登录是一体化的设计，这个设计很好，我们保留了它！**

修复内容：
- ✅ **保留自动注册功能**：输入不存在的用户名会自动创建账户
- ✅ **增加并发保护**：防止多人同时注册相同用户名
- ✅ **改进错误提示**：用户名已被占用时会友好提示
- ✅ **确保数据隔离**：每个用户的数据完全独立

**影响**：
- 新用户：可以正常注册 ✅
- 老用户：可以正常登录 ✅
- 并发注册：更安全 ✅
- 数据隔离：完全独立 ✅

详细说明请查看：[`BUG_FIX_EXPLANATION.md`](file:///d:/TTTT/四级/web/BUG_FIX_EXPLANATION.md)

---

## 📦 部署到服务器的完整步骤

### 方案一：完整重新打包部署（推荐）

#### 第一步：在本地重新构建项目

```bash
# 1. 在项目根目录执行
d:\TTTT\四级\web> npm run build
```

**注意**: 构建成功后，`.next` 目录会被更新。

#### 第二步：准备部署文件

**方式 A: 使用 PowerShell 压缩**
```powershell
# 在项目根目录执行
Compress-Archive -Path ".next","node_modules","public","prisma","src","package.json","package-lock.json","ecosystem.config.js","start.sh" -DestinationPath "deploy-fix.zip" -Force
```

**方式 B: 手动压缩**
1. 创建一个新的 `deploy-fix` 文件夹
2. 复制以下文件和文件夹：
   - `.next/` (构建输出)
   - `node_modules/` (依赖)
   - `public/` (静态资源)
   - `prisma/` (数据库)
   - `src/` (源代码)
   - `package.json`
   - `package-lock.json`
   - `ecosystem.config.js`
   - `start.sh`
3. 压缩为 `deploy-fix.zip`

#### 第三步：上传到服务器

1. **登录宝塔面板**
   - 访问：http://114.55.58.90:8888（或其他端口）
   - 输入账号密码

2. **上传文件**
   - 进入"文件"管理
   - 导航到 `/www/wwwroot/114.55.58.90`
   - 上传 `deploy-fix.zip`

#### 第四步：在服务器上部署

1. **连接到服务器终端**（通过宝塔面板或 SSH）

2. **停止当前应用**
   ```bash
   cd /www/wwwroot/114.55.58.90
   pm2 stop cet4-web
   ```

3. **备份旧文件**（重要！）
   ```bash
   # 备份整个目录
   cp -r /www/wwwroot/114.55.58.90 /www/wwwroot/114.55.58.90.backup.$(date +%Y%m%d_%H%M%S)
   
   # 或者只备份关键文件
   cp prisma/dev.db /backup/dev.db.backup.$(date +%Y%m%d)
   ```

4. **删除旧的 .next 目录**（避免缓存冲突）
   ```bash
   rm -rf .next
   ```

5. **解压新文件**
   ```bash
   unzip -o deploy-fix.zip
   ```

6. **安装依赖**（如果有变化）
   ```bash
   npm install --production
   ```

7. **重新生成 Prisma 客户端**
   ```bash
   npx prisma generate
   ```

8. **重启应用**
   ```bash
   pm2 restart cet4-web
   ```

9. **查看日志**
   ```bash
   pm2 logs cet4-web --lines 50
   ```

#### 第五步：验证修复

1. **测试 Bug 1 修复（认证逻辑）**
   - **新用户注册测试**：
     - 访问：http://114.55.58.90/auth/signin
     - 输入一个不存在的用户名（如 "testuser20260408"）
     - 输入密码
     - ✅ 应该自动创建账户并登录成功
   
   - **并发注册测试**：
     - 用浏览器 A 注册 "testuser" + 密码 A
     - 同时用浏览器 B 注册 "testuser" + 密码 B
     - ✅ 只有一个会成功，另一个显示"用户名已被注册"
   
   - **正常登录测试**：
     - 用已存在的用户名登录
     - ✅ 应该正常登录
   
   - **密码错误测试**：
     - 用已存在的用户名 + 错误密码
     - ✅ 应该显示"用户名或密码错误"

2. **测试 Bug 2 修复（单词卡功能）**
   - 访问：http://114.55.58.90
   - 点击"单词卡"按钮
   - 点击"显示答案"
   - 点击"认识"或"不认识"按钮
   - ✅ 应该显示 loading 状态并跳过到下一个单词
   - ✅ 未登录用户也能正常浏览

---

### 方案二：只更新修复的文件（快速方案）

如果网络较慢，可以只上传修复的文件。

#### 第一步：上传修复的文件

上传以下两个文件到服务器：
1. `src/lib/auth.ts`
2. `src/components/ui/flashcard/flashcard-widget.tsx`

#### 第二步：在服务器上重新构建

```bash
cd /www/wwwroot/114.55.58.90

# 停止应用
pm2 stop cet4-web

# 删除旧的构建缓存
rm -rf .next

# 重新构建
npm run build

# 重启应用
pm2 restart cet4-web
```

---

## 🔍 验证清单

### Bug 1 验证（认证逻辑）
- [ ] 新用户可以用不存在的用户名注册（自动创建账户）✅
- [ ] 已存在的用户可以正常登录 ✅
- [ ] 密码错误时显示"用户名或密码错误" ✅
- [ ] 并发注册相同用户名时，只有一个成功 ✅
- [ ] 用户 A 的单词对用户 B 不可见 ✅
- [ ] 用户 A 删除单词不影响用户 B ✅

### Bug 2 验证
- [ ] 未登录用户可以浏览公共词库
- [ ] 点击"认识"/"不认识"按钮能正常跳过
- [ ] 已登录用户点击按钮显示 loading 状态
- [ ] API 失败时用户仍能继续浏览
- [ ] 控制台显示错误日志

---

## ⚠️ 注意事项

### 1. 数据库备份
**非常重要！** 在部署前务必备份数据库：
```bash
# 在服务器上执行
cp /www/wwwroot/114.55.58.90/prisma/dev.db /backup/dev.db.$(date +%Y%m%d_%H%M%S)
```

### 2. 环境变量
确保 `.env` 文件存在且配置正确：
```bash
# 检查 .env 文件
cat /www/wwwroot/114.55.58.90/.env
```

应该包含：
```env
NODE_ENV=production
PORT=3000
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://114.55.58.90"
NEXTAUTH_SECRET="your-secret-key"
```

### 3. 文件权限
确保文件权限正确：
```bash
chmod -R 755 /www/wwwroot/114.55.58.90
chmod 644 /www/wwwroot/114.55.58.90/.env
```

### 4. PM2 状态
检查 PM2 应用状态：
```bash
pm2 status
pm2 logs cet4-web
```

---

## 🐛 回滚方案

如果修复后出现问题，可以快速回滚：

### 方案一：使用备份回滚
```bash
# 停止应用
pm2 stop cet4-web

# 恢复备份
cp -r /www/wwwroot/114.55.58.90.backup.20260408_120000/* /www/wwwroot/114.55.58.90/

# 重启应用
pm2 restart cet4-web
```

### 方案二：使用 PM2 版本管理
```bash
# 如果使用了 PM2 版本管理
pm2 reload cet4-web --update-env
```

---

## 📊 预计时间

| 步骤 | 预计时间 |
|------|---------|
| 本地构建 | 2-5 分钟 |
| 上传文件 | 1-3 分钟（取决于网络） |
| 服务器部署 | 1-2 分钟 |
| 验证测试 | 2-3 分钟 |
| **总计** | **6-13 分钟** |

---

## 📞 问题排查

### 常见问题 1: 构建失败
```bash
# 清理缓存
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 常见问题 2: PM2 启动失败
```bash
# 查看详细日志
pm2 logs cet4-web --err

# 检查端口占用
netstat -tlnp | grep 3000

# 手动启动测试
node server.js
```

### 常见问题 3: 数据库错误
```bash
# 重新生成 Prisma 客户端
npx prisma generate

# 检查数据库文件权限
ls -la prisma/dev.db
chmod 644 prisma/dev.db
```

---

## ✅ 部署完成确认

部署完成后，请确认以下事项：

- [ ] 网站可以正常访问
- [ ] Bug 1 已修复（认证问题）
- [ ] Bug 2 已修复（单词卡功能）
- [ ] 数据库备份已完成
- [ ] PM2 日志无错误
- [ ] 已通知用户修复完成

---

**祝部署顺利！** 🎉
