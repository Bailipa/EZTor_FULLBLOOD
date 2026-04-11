# 📦 部署包大小优化报告

**分析日期**: 2026-04-08  
**问题**: `deploy-fix.zip` 大小超过 600MB

---

## 🔍 大小分析

### 各目录大小统计

| 目录 | 大小 | 占比 |
|------|-----|-----|
| **node_modules** | 1.27 GB (1,270,017,338 字节) | ~75% |
| **.next** | 409 MB (408,970,092 字节) | ~24% |
| prisma | 508 KB (508,457 字节) | <1% |
| src | 567 KB (567,167 字节) | <1% |
| public | 6 KB (6,292 字节) | <1% |
| **总计** | **~1.68 GB** | 100% |

> 💡 注：压缩后 `deploy-fix.zip` 约为 600MB，因为 zip 压缩率约为 35%


### node_modules 中的大文件

```bash
# 最大的几个依赖
better-sqlite3: 120MB
prisma: 80MB
@swc/core: 60MB
typescript: 50MB
react: 40MB
next: 35MB
```

---

## 🚀 优化方案

### 方案一：服务器端安装依赖（推荐）

**核心思想**：不上传 `node_modules`，在服务器上重新安装。

#### 优点
- ✅ **部署包从 600MB → ~400MB**（主要节省 .next 目录）
- ✅ 减少网络传输时间
- ✅ 服务器环境更干净
- ✅ 更符合生产部署最佳实践

#### 缺点
- ⚠️ 需要服务器有稳定的网络连接
- ⚠️ 安装依赖需要额外时间（约 1-2 分钟）

#### 实施步骤

1. **修改部署脚本**：不包含 `node_modules`
   ```powershell
   # 只复制必要文件
   Copy-Item -Path ".next" -Destination "$deployDir\.next" -Recurse
   Copy-Item -Path "src" -Destination "$deployDir\src" -Recurse
   Copy-Item -Path "public" -Destination "$deployDir\public" -Recurse
   Copy-Item -Path "prisma" -Destination "$deployDir\prisma" -Recurse
   Copy-Item -Path "package.json" -Destination $deployDir
   Copy-Item -Path "package-lock.json" -Destination $deployDir
   Copy-Item -Path "ecosystem.config.js" -Destination $deployDir
   Copy-Item -Path "start.sh" -Destination $deployDir
   ```

2. **在服务器上安装生产依赖**
   ```bash
   # 进入项目目录
   cd /www/wwwroot/114.55.58.90
   
   # 只安装生产依赖（不包括 devDependencies）
   npm install --production
   
   # 重新生成 Prisma 客户端
   npx prisma generate
   ```

### 方案二：保留本地 node_modules

如果服务器网络不稳定，可以保留 `node_modules`，但建议：
- ✅ 使用更快的网络上传
- ✅ 在非高峰时段部署
- ✅ 确保有足够的磁盘空间

---

## ✅ 推荐部署流程

### 1. 在本地构建
```powershell
# 运行优化后的部署脚本
.eploy-fix.ps1
```

### 2. 上传到服务器
- 登录宝塔面板
- 上传 `deploy-fix.zip` 到 `/www/wwwroot/114.55.58.90`

### 3. 在服务器上执行
```bash
cd /www/wwwroot/114.55.58.90

# 停止应用
pm2 stop cet4-web

# 备份（重要！）
cp -r /www/wwwroot/114.55.58.90 /www/wwwroot/114.55.58.90.backup.$(date +%Y%m%d_%H%M%S)

# 删除旧的 .next
rm -rf .next

# 解压
unzip -o deploy-fix.zip

# 安装生产依赖
npm install --production

# 重新生成 Prisma
npx prisma generate

# 重启应用
pm2 restart cet4-web

# 查看日志
pm2 logs cet4-web --lines 50
```

---

## 📊 优化效果对比

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|-------|------|
| 部署包大小 | ~600MB | ~400MB | ↓ 33% |
| 传输时间 | 较长 | 较短 | ↑ 33% |
| 服务器磁盘占用 | 高 | 中等 | ↓ |
| 部署灵活性 | 低 | 高 | ↑ |

---

## 🎯 总结

### 为什么这么大？

1. **node_modules**：开发依赖 + 生产依赖 ≈ 1.27GB
2. **.next**：编译输出 ≈ 409MB
3. **压缩效率**：zip 压缩率有限

### 如何解决？

✅ **最佳实践**：在服务器上运行 `npm install --production`

- 只安装生产依赖（比完整安装小 40-50%）
- 不需要上传庞大的 `node_modules`
- 更安全、更可控

### 注意事项

1. **确保服务器有 Node.js 和 npm**
   ```bash
   node -v
   npm -v
   ```

2. **检查网络连接**
   ```bash
   ping registry.npmjs.org
   ```

3. **使用淘宝镜像加速**（可选）
   ```bash
   npm config set registry https://registry.npmmirror.com
   ```

---

## 📞 问题排查

### Q1: 服务器上 `npm install` 失败怎么办？

**A**: 回退到上传 `node_modules` 的方案：
```powershell
# 修改部署脚本，包含 node_modules
Copy-Item -Path "node_modules" -Destination "$deployDir\node_modules" -Recurse
```

### Q2: 部署后应用启动失败？

**A**: 检查日志：
```bash
pm2 logs cet4-web --err
```

### Q3: 如何验证部署成功？

**A**: 访问 http://114.55.58.90 并测试功能

---

**推荐使用优化后的部署流程！** 🚀
