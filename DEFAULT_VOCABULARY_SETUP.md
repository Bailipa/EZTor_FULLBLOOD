# 默认词库配置 - 开发文档

## 概述

本功能实现了预配置默认词库（四六级、雅思、考研等），用户可以通过分享密钥直接导入这些标准词库。

## 已完成的任务

### 1. 数据库模型 ✅

**文件**: `prisma/schema.prisma`

添加了 `DefaultVocabulary` 模型：

```prisma
model DefaultVocabulary {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  description String?
  groupId     String
  reviewGroup ReviewGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  wordCount   Int
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([isActive])
}
```

**关联修改**:
- 在 `ReviewGroup` 模型中添加了反向关系：`defaultVocabularies DefaultVocabulary[]`

### 2. 数据库迁移 ✅

**命令**:
```bash
npx prisma migrate dev --name add_default_vocabulary_config
```

**生成的 SQL**:
```sql
CREATE TABLE "DefaultVocabulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DefaultVocabulary_groupId_fkey" FOREIGN KEY ("groupId") 
        REFERENCES "ReviewGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DefaultVocabulary_code_key" ON "DefaultVocabulary"("code");
CREATE INDEX "DefaultVocabulary_isActive_idx" ON "DefaultVocabulary"("isActive");
```

### 3. 种子脚本 ✅

#### 3.1 基础版种子脚本

**文件**: `scripts/seed-default-vocabularies.ts`

**功能**:
- 创建系统用户（username: `system`）
- 创建 3 个默认 ReviewGroup
- 导入示例词汇（每个词库 5 个示例单词）
- 生成分享密钥
- 创建 DefaultVocabulary 配置

**运行方式**:
```bash
npx tsx scripts/seed-default-vocabularies.ts
```

**输出示例**:
```
🌱 开始导入默认词库...
✅ 系统用户创建成功
📚 处理词库：大学英语四六级核心词汇
  ✅ 分组创建成功
  ✅ 词汇导入完成：导入 5 个
  ✅ 分享密钥生成成功：M5P-VPF-WQV
  ✅ 默认词库配置创建成功
...
```

#### 3.2 完整版种子脚本

**文件**: `scripts/seed-default-vocabularies-full.ts`

**功能**:
- 从 JSON 文件读取完整词汇数据
- 批量导入词汇（使用事务优化，每批 100 个）
- SQLite 性能优化（临时关闭 synchronous）
- 进度显示（每 500 个词显示一次进度）

**运行方式**:
```bash
npx tsx scripts/seed-default-vocabularies-full.ts [json-file-path]
```

**示例**:
```bash
npx tsx scripts/seed-default-vocabularies-full.ts data/default-vocabularies.full.json
```

### 4. 词库数据文件 ✅

#### 4.1 示例数据文件

**文件**: `data/default-vocabularies.sample.json`

**结构**:
```json
{
  "vocabularies": [
    {
      "name": "大学英语四六级核心词汇",
      "description": "包含 CET-4 和 CET-6 核心词汇，约 8000 词",
      "groupName": "四六级核心词汇",
      "sortOrder": 1,
      "words": [
        {
          "word": "abandon",
          "phonetic": "/əˈbændən/",
          "pos": "v.",
          "translation": "抛弃，舍弃，放弃",
          "example": "He abandoned his car in the snow.",
          "exampleTranslation": "他在雪地中抛弃了他的车。"
        }
      ]
    }
  ]
}
```

**注意**: 此文件仅包含示例数据（每个词库 10 个单词），用于演示数据格式。

#### 4.2 完整数据文件（需自行准备）

实际使用时，需要准备包含完整词汇的 JSON 文件：
- **四六级词库**: 约 8000 词
- **雅思词库**: 约 4000 词
- **考研词库**: 约 5500 词

### 5. API 端点 ✅

**文件**: `src/app/api/share/defaults/route.ts`

**端点**: `GET /api/share/defaults`

**功能**: 获取所有激活的默认词库列表

**请求**:
```http
GET /api/share/defaults
Authorization: Bearer <session_token>
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cmnwrxyz123",
      "name": "大学英语四六级核心词汇",
      "description": "包含 CET-4 和 CET-6 核心词汇，约 8000 词",
      "code": "M5P-VPF-WQV",
      "wordCount": 8000,
      "sortOrder": 1,
      "groupName": "四六级核心词汇"
    }
  ]
}
```

**业务逻辑**:
1. 验证用户登录
2. 查询所有 `isActive = true` 的 DefaultVocabulary
3. 按 `sortOrder` 升序排序
4. 包含关联的 ReviewGroup 信息
5. 转换数据格式返回

## 使用流程

### 方案一：使用基础种子脚本（快速测试）

```bash
# 1. 运行种子脚本
npx tsx scripts/seed-default-vocabularies.ts

# 2. 查看生成的密钥
# 脚本会输出 3 个词库的分享密钥

# 3. 在应用中使用密钥导入
# 访问 /history 页面 -> 点击"密钥导入" -> 输入密钥
```

### 方案二：导入完整词库（生产环境）

```bash
# 1. 准备完整词汇 JSON 文件
# 文件格式参考 data/default-vocabularies.sample.json

# 2. 运行完整版种子脚本
npx tsx scripts/seed-default-vocabularies-full.ts data/default-vocabularies.full.json

# 3. 验证导入结果
# 脚本会显示所有词库的详细信息
```

### 方案三：通过 API 获取默认词库

```typescript
// 前端调用示例
async function fetchDefaultVocabularies() {
  const res = await fetch('/api/share/defaults');
  const data = await res.json();
  
  if (data.success) {
    console.log('默认词库列表:', data.data);
    // 可以显示词库列表，提供"一键导入"按钮
  }
}
```

## 已生成的默认词库

运行种子脚本后，数据库中会创建以下词库：

| 序号 | 词库名称 | 分组名称 | 分享密钥 | 词汇数 |
|------|---------|---------|----------|--------|
| 1 | 大学英语四六级核心词汇 | 四六级核心词汇 | M5P-VPF-WQV | 5 (示例) |
| 2 | 雅思核心词汇 | 雅思核心词汇 | G24-9PL-FH3 | 0 (需导入) |
| 3 | 考研核心词汇 | 考研核心词汇 | RHC-NRA-6UR | 0 (需导入) |

**注意**: 当前词汇数为示例数据，实际使用时需导入完整词库。

## 技术细节

### 性能优化

1. **批量导入**: 每批 100 个单词，使用事务包裹
2. **SQLite 优化**: 
   - 导入时设置 `PRAGMA synchronous = OFF`
   - 设置 `PRAGMA journal_mode = MEMORY`
   - 导入完成后恢复为 `FULL` 和 `DELETE`
3. **去重机制**: 使用 `word_userId` 唯一索引避免重复

### 安全机制

1. **密钥生成**: 使用 `crypto.randomBytes()` 生成密码学安全的随机密钥
2. **唯一性检查**: 生成后检查数据库确保唯一性
3. **重试机制**: 最多重试 3 次生成唯一密钥

### 数据隔离

- 所有默认词库归属于 `system` 用户
- 用户导入后，词汇数据完全独立，与原词库无关
- 符合"数据隔离"核心要求

## 后续工作

### 待完成的任务

1. **准备完整词汇数据**
   - 从权威来源获取四六级、雅思、考研词汇表
   - 整理为 JSON 格式
   - 验证数据质量

2. **前端集成**
   - 在词汇面板添加"默认词库"按钮
   - 显示默认词库列表（调用 `/api/share/defaults`）
   - 提供"一键导入"功能

3. **测试验证**
   - 测试大规模词汇导入（8000+ 词）
   - 验证性能（应在 60 秒内完成）
   - 检查数据完整性

4. **文档更新**
   - 更新用户文档
   - 添加词库导入教程
   - 编写 API 文档

## 相关文件清单

### 核心文件
- `prisma/schema.prisma` - 数据库模型定义
- `scripts/seed-default-vocabularies.ts` - 基础种子脚本
- `scripts/seed-default-vocabularies-full.ts` - 完整版种子脚本
- `src/app/api/share/defaults/route.ts` - API 端点

### 数据文件
- `data/default-vocabularies.sample.json` - 示例数据

### 迁移文件
- `prisma/migrations/20260413052116_add_default_vocabulary_config/migration.sql`

## 总结

✅ **已完成**:
1. DefaultVocabulary 数据库模型及迁移
2. 基础版和完整版种子脚本
3. 示例数据文件
4. API 端点 `/api/share/defaults`
5. 系统用户和默认分组创建
6. 分享密钥生成机制

📋 **待完成**:
1. 准备完整词汇数据（8000+4000+5500 词）
2. 前端 UI 集成
3. 大规模导入测试
4. 用户文档编写

---

**文档版本**: 1.0  
**创建日期**: 2026-04-13  
**最后更新**: 2026-04-13
