# 数据库备份与恢复指南

## 备份位置

```
/Users/elee987/Downloads/web_compressed/prisma/
```

## 现有备份文件

| 文件                                | 大小   | 格式          |
| ----------------------------------- | ------ | ------------- |
| `dev.db.backup.20260427_183453`     | 438 KB | SQLite 二进制 |
| `dev.db.backup.20260427_183458.sql` | 120 KB | SQL 文本      |

---

## 手动备份

### 方法一：二进制备份（推荐）

```bash
cd /Users/elee987/Downloads/web_compressed/prisma
cp dev.db "dev.db.backup.$(date +%Y%m%d_%H%M%S)"
```

### 方法二：SQL 导出

```bash
cd /Users/elee987/Downloads/web_compressed/prisma
sqlite3 dev.db ".dump" > "dev.db.backup.$(date +%Y%m%d_%H%M%S).sql"
```

---

## 恢复数据

### 从二进制备份恢复

```bash
cd /Users/elee987/Downloads/web_compressed/prisma
cp dev.db.backup.20260427_183453 dev.db
```

### 从 SQL 备份恢复

```bash
cd /Users/elee987/Downloads/web_compressed/prisma
sqlite3 dev.db < dev.db.backup.20260427_183458.sql
```

---

## 验证恢复

```bash
sqlite3 dev.db "SELECT 'Word' as tbl, COUNT(*) as cnt FROM Word UNION ALL SELECT 'PublicWord', COUNT(*) FROM PublicWord;"
```

预期输出：

```
Word|60
PublicWord|63
```
