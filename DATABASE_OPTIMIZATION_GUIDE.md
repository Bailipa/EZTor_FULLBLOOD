# 数据库优化实施指南

本文档为 AI Agent 提供逐步实施数据库优化方案的具体指令。

## 目录

1. [当前架构分析](#1-当前架构分析)
2. [数据库 Schema 变更](#2-数据库-schema-变更)
3. [后端服务修改](#3-后端服务修改)
4. [API 逻辑调整](#4-api-逻辑调整)
5. [测试验证](#5-测试验证)

---

## 1. 当前架构分析

### 1.1 现有数据流

```
用户查询 → Word表(userId) → PublicWord表 → LLM查询
                ↓                    ↓           ↓
           返回私有词           复制到Word      保存到两者
```

### 1.2 核心问题

- `CacheService.copyPublicWordsToUserDb` (line 126-178) 将完整的公共单词数据复制到用户私有表
- `Word` 表存储了完整的翻译、音标、例句等数据，造成大量冗余
- `publicWordCascade.ts` 的 `cascadePublicWordToPrivate` 会覆盖用户数据

### 1.3 关键文件位置

| 文件 | 用途 |
|------|------|
| `prisma/schema.prisma` | 数据库模型定义 |
| `src/services/CacheService.ts` | 缓存服务，包含复制逻辑 |
| `src/lib/publicWordCascade.ts` | 公共词库级联更新 |
| `src/services/PublicWordService.ts` | 公共词库服务 |
| `src/app/api/translate/route.ts` | 翻译API入口 |

---

## 2. 数据库 Schema 变更

### 2.1 修改 Word 模型

**文件**: `prisma/schema.prisma`

**变更**: 在 `Word` 模型中添加以下字段：

```prisma
model Word {
  id                 String            @id
  word               String
  phonetic           String?
  pos                String?
  translation        String
  example            String?
  exampleTranslation String?
  correctCount       Int               @default(0)
  incorrectCount     Int               @default(0)
  createdAt          DateTime          @default(now())
  updatedAt          DateTime
  userId             String
  // 新增字段
  sourceType         String            @default("USER")  // 'USER' | 'PUBLIC' | 'LLM'
  publicWordId       String?                                    // 引用 PublicWord.id
  // 索引调整
  ReviewGroupWord    ReviewGroupWord[]
  User               User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([word, userId])
  @@index([userId, updatedAt(sort: Desc)])
  @@index([userId, word])  // 用于高效查找
}
```

### 2.2 添加规范化字段（可选第二阶段）

**文件**: `prisma/schema.prisma`

**在 Word 和 PublicWord 中添加**：

```prisma
model Word {
  // ... 现有字段
  wordNormalized     String?  // LOWER(TRIM(word))
  
  @@index([wordNormalized])
}

model PublicWord {
  // ... 现有字段
  wordNormalized    String?   @unique
  
  @@index([wordNormalized])
}
```

### 2.3 执行 Prisma 迁移

```bash
# 生成迁移
npx prisma migrate dev --name add_source_metadata

# 推送 schema 到数据库
npx prisma db push
```

---

## 3. 后端服务修改

### 3.1 修改 CacheService.copyPublicWordsToUserDb

**文件**: `src/services/CacheService.ts`

**当前逻辑** (line 126-178):
```typescript
// 完整复制所有字段到 Word
await prisma.word.upsert({
  where: { word_userId: { word, userId } },
  update: { word, translation, phonetic, pos, example, exampleTranslation },
  create: { id, word, translation, phonetic, pos, example, exampleTranslation, userId }
});
```

**修改为**:
```typescript
async copyPublicWordsToUserDb(
  publicCachedWords: any[], 
  targetGroupId?: string
): Promise<void> {
  if (publicCachedWords.length === 0) return;

  try {
    const results = await Promise.all(
      publicCachedWords.map(w =>
        prisma.word.upsert({
          where: {
            word_userId: {
              word: w.word,
              userId: this.session.user.id
            }
          },
          update: {
            // 仅更新元数据，不覆盖内容
            publicWordId: w.id,
            sourceType: 'PUBLIC',
            updatedAt: new Date()
          },
          create: {
            id: randomUUID(),
            word: w.word,
            // 轻量级记录：只存必要字段
            translation: '',  // 空值，从 PublicWord 引用
            phonetic: null,
            pos: null,
            example: null,
            exampleTranslation: null,
            userId: this.session.user.id,
            sourceType: 'PUBLIC',
            publicWordId: w.id,
            updatedAt: new Date()
          }
        }).catch(() => null)
      )
    );

    // 分组关联逻辑保持不变
    if (targetGroupId) {
      // ... 现有代码
    }
  } catch (e) {
    console.error("Failed to copy public words to user db", e);
  }
}
```

### 3.2 修改 formatCachedResults 方法

**文件**: `src/services/CacheService.ts`

需要修改查询逻辑，从 PublicWord JOIN 获取完整数据：

```typescript
async getWordWithPublicRef(wordRecords: any[]): Promise<any[]> {
  const publicWordIds = wordRecords
    .filter(w => w.publicWordId)
    .map(w => w.publicWordId);
  
  if (publicWordIds.length === 0) return wordRecords;
  
  const publicWords = await prisma.publicWord.findMany({
    where: { id: { in: publicWordIds } }
  });
  
  const publicWordMap = new Map(publicWords.map(pw => [pw.id, pw]));
  
  return wordRecords.map(w => {
    if (w.publicWordId && publicWordMap.has(w.publicWordId)) {
      const pw = publicWordMap.get(w.publicWordId);
      return { ...w, ...pw }; // 合并公共数据
    }
    return w;
  });
}
```

### 3.3 修改或移除 cascadePublicWordToPrivate

**文件**: `src/lib/publicWordCascade.ts`

**推荐方案**: 限制级联更新，仅更新没有用户修改的记录

```typescript
export async function cascadePublicWordToPrivate(
  fields: CascadeFields
): Promise<void> {
  const word = normalizeWord(fields.word);
  const updatedAt = new Date();

  // 只更新 sourceType = 'PUBLIC' 的记录（用户未修改的）
  // 保留用户自定义的内容
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE Word
      SET
        phonetic = COALESCE(Word.phonetic, ${fields.phonetic ?? null}),
        pos = COALESCE(Word.pos, ${fields.pos ?? null}),
        translation = COALESCE(Word.translation, ${fields.translation}),
        example = COALESCE(Word.example, ${fields.example ?? null}),
        exampleTranslation = COALESCE(Word.exampleTranslation, ${fields.exampleTranslation ?? null}),
        updatedAt = ${updatedAt}
      WHERE lower(word) = ${word}
        AND sourceType = 'PUBLIC'
        AND (phonetic IS NULL OR pos IS NULL OR translation = '' OR example IS NULL)
    `
  );
}
```

### 3.4 修改 PublicWordService 保存逻辑

**文件**: `src/services/PublicWordService.ts`

在创建新的 PublicWord 时，自动创建用户的轻量级引用记录：

```typescript
async saveWordToPublicLibrary(
  wordData: WordData, 
  userId: string
): Promise<void> {
  // ... 现有质量评分逻辑 ...

  if (!existingPublicWord) {
    // 创建公共词条
    const newPublicWord = await prisma.publicWord.create({
      data: { /* ... */ }
    });

    // 自动为查询用户创建轻量级引用
    await prisma.word.create({
      data: {
        id: randomUUID(),
        word: wordData.word,
        translation: '',  // 空，从 PublicWord 引用
        userId: userId,
        sourceType: 'LLM',
        publicWordId: newPublicWord.id,
        updatedAt: new Date()
      }
    }).catch(() => {}); // 忽略已存在错误
  }
  // ... 后续更新逻辑保持不变 ...
}
```

---

## 4. API 逻辑调整

### 4.1 修改 translate API 查询流程

**文件**: `src/app/api/translate/route.ts`

**核心变更**: 返回数据时需要 JOIN PublicWord 获取完整定义

```typescript
// 在 getCachedWords 之后，formatCachedResults 之前添加：
async function enrichWordWithPublicData(wordRecords: any[]): Promise<any[]> {
  const publicWordIds = wordRecords
    .filter(w => w.publicWordId)
    .map(w => w.publicWordId);
  
  if (publicWordIds.length === 0) return wordRecords;
  
  const publicWords = await prisma.publicWord.findMany({
    where: { id: { in: publicWordIds } }
  });
  
  const publicMap = new Map(publicWords.map(p => [p.id, p]));
  
  return wordRecords.map(w => {
    if (w.publicWordId && publicMap.has(w.publicWordId)) {
      const pw = publicMap.get(w.publicWordId);
      return {
        ...w,
        phonetic: w.phonetic || pw?.phonetic || '',
        pos: w.pos || pw?.pos || '',
        translation: w.translation || pw?.translation || '',
        example: w.example || pw?.example || '',
        exampleTranslation: w.exampleTranslation || pw?.exampleTranslation || ''
      };
    }
    return w;
  });
}

// 使用示例：
const enrichedCachedWords = await enrichWordWithPublicData(updatedCachedWords);
const enrichedPublicWords = await enrichWordWithPublicData(publicCachedWords);
const formattedCachedResults = cacheService.formatCachedResults(
  enrichedCachedWords, 
  enrichedPublicWords, 
  specialResults
);
```

### 4.3 处理用户删除操作

确保用户删除自己的 Word 记录时，不影响 PublicWord：

```typescript
// API: DELETE /api/words/[wordId]
// 只需删除 Word 记录，PublicWord 保持不变
await prisma.word.delete({
  where: { id: wordId, userId: session.user.id }
});
```

---

## 5. 测试验证

### 5.1 单元测试清单

| 测试场景 | 预期结果 |
|----------|----------|
| 用户查询新单词 | 创建轻量级 Word 记录，publicWordId 指向 PublicWord |
| 用户查询已有公共单词 | 返回引用数据，实际定义从 PublicWord 获取 |
| 公共词库更新 | 仅更新 sourceType='PUBLIC' 的记录 |
| 用户删除自己单词 | 仅删除 Word，PublicWord 保留 |
| 查询性能测试 | JOIN PublicWord 后响应时间 < 200ms |

### 5.2 数据验证 SQL

```sql
-- 检查数据分布
SELECT 
  sourceType,
  COUNT(*) as count,
  SUM(CASE WHEN publicWordId IS NOT NULL THEN 1 ELSE 0 END) as has_ref
FROM Word
GROUP BY sourceType;

-- 检查空翻译数量（应该是大量空值，因为只存引用）
SELECT COUNT(*) FROM Word WHERE translation = '' OR translation IS NULL;

-- 验证 JOIN 查询性能
EXPLAIN QUERY PLAN
SELECT w.*, pw.* 
FROM Word w 
LEFT JOIN PublicWord pw ON w.publicWordId = pw.id 
WHERE w.userId = 'user-123';
```

### 5.3 迁移验证

```bash
# 检查新字段是否存在
npx prisma studio

# 运行测试
npm test

# 检查是否有类型错误
npx tsc --noEmit
```

---

## 附录：字段映射参考

| Word.sourceType | 含义 | 用户能否修改 |
|-----------------|------|--------------|
| `USER` | 用户手动添加 | 是 |
| `PUBLIC` | 从公共词库引用 | 否 |
| `LLM` | LLM 生成并自动保存 | 否 |

---

## 实施顺序建议

1. **Phase 1**: 修改 Prisma schema，添加 sourceType 和 publicWordId 字段
2. **Phase 2**: 修改 CacheService.copyPublicWordsToUserDb 为轻量级引用
3. **Phase 3**: 修改 formatCachedResults 和 API 返回逻辑，JOIN 获取完整数据
4. **Phase 4**: 限制 cascadePublicWordToPrivate 的更新范围
5. **Phase 5**: 测试验证和性能优化
