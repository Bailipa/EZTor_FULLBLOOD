# 数据库备份与恢复指南

## 生产环境（PostgreSQL via Docker）

### 备份

```bash
# 在服务器上执行
docker exec eztor-db pg_dump -U postgres -d eztor > /www/wwwroot/114.55.58.90/backup_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复

```bash
# 在服务器上执行
docker exec -i eztor-db psql -U postgres -d eztor < /www/wwwroot/114.55.58.90/backup_YYYYMMDD_HHMMSS.sql
```

### 验证

```bash
docker exec eztor-db psql -U postgres -d eztor -c "SELECT 'User' as tbl, COUNT(*) FROM \"User\" UNION ALL SELECT 'Word', COUNT(*) FROM \"Word\" UNION ALL SELECT 'PublicWord', COUNT(*) FROM \"PublicWord\";"
```

### 自动备份（可选）

在服务器 crontab 中添加每日备份：

```bash
# 每天凌晨 3 点备份
0 3 * * * docker exec eztor-db pg_dump -U postgres -d eztor > /www/wwwroot/114.55.58.90/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql
# 保留最近 7 天
find /www/wwwroot/114.55.58.90/backup_*.sql -mtime +7 -delete
```

---

## 本地开发环境（SQLite）

### 备份位置

```
/Users/elee987/Downloads/web_compressed/prisma/
```

### 手动备份

```bash
cd /Users/elee987/Downloads/web_compressed/prisma
cp dev.db "dev.db.backup.$(date +%Y%m%d_%H%M%S)"
```

### 从备份恢复

```bash
cd /Users/elee987/Downloads/web_compressed/prisma
cp dev.db.backup.YYYYMMDD_HHMMSS dev.db
```

### 验证恢复

```bash
sqlite3 dev.db "SELECT 'Word' as tbl, COUNT(*) as cnt FROM Word UNION ALL SELECT 'PublicWord', COUNT(*) FROM PublicWord;"
```
