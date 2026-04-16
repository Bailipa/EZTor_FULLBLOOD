# Vocabulary Sharing System - AI Development Specification

**Document Type**: Technical Development Specification for AI Models  
**Version**: 2.0  
**Date**: 2026-04-12  
**Status**: Development Planning  
**Technology Stack**: Next.js 15+ | Prisma ORM | SQLite | NextAuth.js | TypeScript  

---

## 1. System Overview

### 1.1 Purpose
Implement a vocabulary library sharing system enabling users to share vocabulary groups via cryptographic keys, with default vocabulary keys for standardized exam preparation (CET-4/6, IELTS, Postgraduate Entrance Exam).

### 1.2 Core Requirements
- **Key-based Sharing**: Users share ReviewGroup collections via unique cryptographic keys
- **Default Vocabulary**: Pre-configured keys for standardized exam vocabulary
- **Data Isolation**: Imported data belongs to importing user, completely separated from original sharer
- **Architecture Compatibility**: Zero modifications to existing Word, ReviewGroup, ReviewGroupWord models

### 1.3 Technical Constraints
- Database: SQLite with Prisma ORM
- Authentication: NextAuth.js session-based
- API Pattern: Next.js App Router API routes
- Frontend: React with TypeScript, shadcn/ui components

---

## 2. Data Structure Definitions

### 2.1 New Database Models (Prisma Schema)

#### 2.1.1 SharedVocabulary Model
**Purpose**: Store vocabulary sharing records with cryptographic keys

```prisma
model SharedVocabulary {
  id              String   @id @default(cuid())
  code            String   @unique
  name            String
  description     String?
  
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  shareType       String   @default("REVIEW_GROUP")
  reviewGroupId   String
  reviewGroup     ReviewGroup @relation(fields: [reviewGroupId], references: [id], onDelete: Cascade)
  
  maxUses         Int?
  usedCount       Int      @default(0)
  expiresAt       DateTime?
  isActive        Boolean  @default(true)
  
  importedCount   Int      @default(0)
  viewCount       Int      @default(0)
  
  wordCount       Int
  version         Int      @default(1)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  
  @@index([code])
  @@index([userId])
  @@index([reviewGroupId])
  @@index([expiresAt])
  @@index([isActive])
}
```

**Field Specifications**:
- `code`: 11-character segmented format (ABC-123-XYZ), uppercase letters + digits, excluding ambiguous characters (0/O, 1/I/l)
- `shareType`: Fixed value "REVIEW_GROUP" (only supported type)
- `maxUses`: NULL = unlimited, integer = maximum usage count
- `expiresAt`: NULL = no expiration, DateTime = expiration timestamp
- `isActive`: FALSE = revoked/invalidated share

#### 2.1.2 SharedVocabularyImport Model
**Purpose**: Track import history to prevent duplicate imports

```prisma
model SharedVocabularyImport {
  id              String   @id @default(cuid())
  sharedId        String
  shared          SharedVocabulary @relation(fields: [sharedId], references: [id], onDelete: Cascade)
  
  importerId      String
  importer        User     @relation(fields: [importerId], references: [id], onDelete: Cascade)
  
  wordsImported   Int
  wordsSkipped    Int      @default(0)
  targetGroupId   String
  
  skipExisting    Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  
  @@unique([sharedId, importerId])
  @@index([importerId])
  @@index([sharedId])
}
```

**Constraints**:
- Unique constraint on `[sharedId, importerId]`: Each user can import the same share only once

#### 2.1.3 DefaultVocabulary Model (Optional)
**Purpose**: Configure default vocabulary keys for exam preparation

```prisma
model DefaultVocabulary {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  description String?
  groupId     String
  reviewGroup ReviewGroup @relation(fields: [groupId], references: [id])
  wordCount   Int
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([isActive])
}
```

### 2.2 Data Relationships

```
User (1) ──< SharedVocabulary (>N)
                     │
                     │ (N:1)
                     ↓
             ReviewGroup (1)
                     │
                     │ (1:N)
                     ↓
             ReviewGroupWord (>N)
                     │
                     │ (N:1)
                     ↓
               Word (>N)

SharedVocabulary (1) ──< SharedVocabularyImport (>N)
                                      │
                                      │ (N:1)
                                      ↓
                                   User (1)
```

---

## 3. API Specification

### 3.1 Import-Related Endpoints

#### 3.1.1 GET `/api/share/validate/:code`
**Purpose**: Validate share key legitimacy before import

**Authentication**: Required (NextAuth session)

**Path Parameters**:
- `code`: string (required) - Share key to validate

**Business Logic**:
1. Verify session exists
2. Check key format (regex: `/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/`)
3. Query SharedVocabulary by code
4. Validate:
   - Key exists
   - `isActive === true`
   - `expiresAt === null OR expiresAt > now`
   - `maxUses === null OR usedCount < maxUses`
   - No existing SharedVocabularyImport for this user+share
5. Increment `viewCount`

**Response Schema**:
```typescript
interface ValidateResponse {
  valid: boolean;
  data?: {
    code: string;
    name: string;
    description: string | null;
    wordCount: number;
    shareType: string;
    expiresAt: string | null;  // ISO 8601
    maxUses: number | null;
    usedCount: number;
    creator: string;  // username
  };
  error?: ShareErrorCode;
  message?: string;
}
```

**Error Codes**:
- `INVALID_CODE`: Key doesn't exist
- `EXPIRED_CODE`: Key expired
- `MAX_USES_REACHED`: Usage limit exceeded
- `ALREADY_IMPORTED`: User already imported this share
- `INACTIVE_SHARE`: Share has been revoked

#### 3.1.2 GET `/api/share/preview/:code`
**Purpose**: Retrieve share metadata without full word data

**Authentication**: Required

**Response Schema**:
```typescript
interface PreviewResponse {
  success: boolean;
  data: {
    code: string;
    name: string;
    description: string | null;
    wordCount: number;
    shareType: string;
    creator: string;
    categories?: string[];  // Word categories distribution
  };
}
```

#### 3.1.3 GET `/api/share/data/:code`
**Purpose**: Fetch complete word list for import

**Authentication**: Required

**Business Logic**:
1. Validate key (same as 3.1.1)
2. Query SharedVocabulary by code
3. Extract `reviewGroupId`
4. Query ReviewGroupWord where `reviewGroupId = X`
5. Join with Word table to get full word data
6. Return array of word objects

**Response Schema**:
```typescript
interface ShareDataResponse {
  success: boolean;
  data: {
    shareInfo: {
      code: string;
      name: string;
      reviewGroupId: string;
    };
    words: Array<{
      word: string;
      phonetic: string | null;
      pos: string | null;
      translation: string;
      example: string | null;
      exampleTranslation: string | null;
    }>;
  };
}
```

#### 3.1.4 POST `/api/share/import`
**Purpose**: Execute vocabulary import operation

**Authentication**: Required

**Request Body Schema**:
```typescript
interface ImportRequest {
  code: string;              // Share key
  customName: string;        // User-defined name for imported vocabulary
  targetGroupId?: string;    // Existing group ID (optional)
  createNewGroup?: boolean;  // Create new group (default: true)
  skipExisting?: boolean;    // Skip existing words (default: true)
}
```

**Business Logic** (Sequential):
```
1. Validate key → return error if invalid
2. Check SharedVocabularyImport for duplicate → return ALREADY_IMPORTED
3. Fetch share data (words array)
4. Begin database transaction
5. Handle group logic:
   IF targetGroupId provided:
     - Verify ReviewGroup exists and belongs to current user
     - Use existing group
   ELSE IF createNewGroup === true:
     - Create new ReviewGroup with customName
     - Get new group ID
   ELSE:
     - Return error (no valid target)
6. Batch import words:
   FOR each word in words array (batch size: 100):
     - IF skipExisting === true:
       - Check Word exists for (word, userId)
       - IF exists: increment skipped count, continue
     - INSERT into Word table with userId = current user
     - INSERT into ReviewGroupWord (groupId, wordId)
7. Update SharedVocabulary:
   - usedCount += 1
   - importedCount += 1
8. Create SharedVocabularyImport record
9. Commit transaction
10. Return statistics
```

**Response Schema**:
```typescript
interface ImportResponse {
  success: boolean;
  data: {
    wordsImported: number;
    wordsSkipped: number;
    groupId: string;
    groupName: string;
    shareName: string;
  };
}
```

**Error Handling**:
- All errors rollback transaction
- Log errors to console with context
- Return appropriate ShareErrorCode

### 3.2 Share Creation Endpoints

#### 3.2.1 POST `/api/share/create`
**Purpose**: Generate new share key for user's ReviewGroup

**Authentication**: Required

**Request Body Schema**:
```typescript
interface CreateShareRequest {
  reviewGroupId: string;   // Required: Group to share
  name: string;            // Share name (default: groupName + "的词库")
  description?: string;    // Optional description
  expiresAt?: string;      // ISO 8601 format, optional
  maxUses?: number;        // Usage limit, optional (null = unlimited)
}
```

**Business Logic**:
1. Verify session
2. Validate ReviewGroup exists AND belongs to current user
3. Count words in group (via ReviewGroupWord)
4. Generate unique share code (see Algorithm 4.1)
5. Create SharedVocabulary record
6. Return share info

**Response Schema**:
```typescript
interface CreateShareResponse {
  success: boolean;
  data: {
    code: string;
    name: string;
    description: string | null;
    expiresAt: string | null;
    maxUses: number | null;
    shareUrl: string;  // Optional: deep link
  };
}
```

#### 3.2.2 GET `/api/share/list`
**Purpose**: Retrieve all shares created by current user

**Authentication**: Required

**Response Schema**:
```typescript
interface ShareListResponse {
  success: boolean;
  shares: Array<{
    id: string;
    code: string;
    name: string;
    reviewGroupName: string;
    wordCount: number;
    usedCount: number;
    importedCount: number;
    expiresAt: string | null;
    maxUses: number | null;
    isActive: boolean;
    createdAt: string;
  }>;
}
```

#### 3.2.3 DELETE `/api/share/:id`
**Purpose**: Revoke/soft-delete a share

**Authentication**: Required (owner or admin)

**Business Logic**:
1. Verify ownership (or admin)
2. Soft delete: set `deletedAt = now()` AND `isActive = false`
3. Return confirmation

#### 3.2.4 POST `/api/share/:id/regenerate`
**Purpose**: Generate new key, invalidate old key

**Authentication**: Required (owner only)

**Business Logic**:
1. Verify ownership
2. Generate new code (Algorithm 4.1)
3. Update record:
   - `code = newCode`
   - `version += 1`
   - `updatedAt = now()`
4. Return new code

#### 3.2.5 GET `/api/share/stats/:id`
**Purpose**: Retrieve share statistics

**Authentication**: Required (owner only)

**Response Schema**:
```typescript
interface ShareStatsResponse {
  success: boolean;
  data: {
    viewCount: number;
    importCount: number;
    imports: Array<{
      importerName: string;
      importedAt: string;
      wordsImported: number;
      wordsSkipped: number;
      targetGroupName: string;
    }>;
  };
}
```

### 3.3 Default Vocabulary Endpoints

#### 3.3.1 GET `/api/share/defaults`
**Purpose**: Fetch pre-configured default vocabulary keys

**Authentication**: Required

**Response Schema**:
```typescript
interface DefaultVocabularyResponse {
  success: boolean;
  data: Array<{
    id: string;
    name: string;
    description: string | null;
    code: string;
    wordCount: number;
    sortOrder: number;
  }>;
}
```

**Default Data** (Seed Script):
```typescript
const defaultVocabularies = [
  {
    name: "大学英语四六级核心词汇",
    description: "包含 CET-4 和 CET-6 核心词汇，约 8000 词",
    code: "CET4-6-2026-VOCAB",  // Generated, not hardcoded
    wordCount: 8000,
    sortOrder: 1
  },
  {
    name: "雅思核心词汇",
    description: "雅思考试高频词汇，约 4000 词",
    code: "IELTS-2026-CORE-WORDS",
    wordCount: 4000,
    sortOrder: 2
  },
  {
    name: "考研核心词汇",
    description: "硕士研究生入学考试核心词汇，约 5500 词",
    code: "KAOYAN-2026-MAIN-VOCAB",
    wordCount: 5500,
    sortOrder: 3
  }
];
```

---

## 4. Core Algorithms

### 4.1 Share Code Generation Algorithm

**Requirements**:
- Format: `ABC-123-XYZ` (11 characters, 3 segments)
- Character set: Uppercase letters (A-Z) + digits (0-9)
- Excluded characters: 0, O, 1, I, l (ambiguous)
- Entropy: Minimum 62^9 combinations
- Uniqueness: Database-level unique constraint on `code` field

**Implementation**:
```typescript
/**
 * Generates a cryptographically secure share code
 * Format: ABC-123-XYZ (3 segments of 3 characters)
 */
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 26 letters - 2 + 10 digits - 2 = 32 chars
  const segmentLength = 3;
  const segments = 3;
  
  const randomBytes = crypto.randomBytes(segmentLength * segments);
  
  const code = Array(segments)
    .fill(null)
    .map((_, segmentIndex) => {
      return Array(segmentLength)
        .fill(null)
        .map((_, charIndex) => {
          const byteIndex = segmentIndex * segmentLength + charIndex;
          const charCode = randomBytes[byteIndex] % chars.length;
          return chars.charAt(charCode);
        })
        .join('');
    })
    .join('-');
  
  return code;
}

/**
 * Validates share code format
 */
function isValidShareCode(code: string): boolean {
  const regex = /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/;
  return regex.test(code);
}
```

**Collision Handling**:
```typescript
async function generateUniqueCode(): Promise<string> {
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    const code = generateShareCode();
    
    const existing = await prisma.sharedVocabulary.findUnique({
      where: { code }
    });
    
    if (!existing) {
      return code;
    }
    
    retries++;
  }
  
  throw new Error('Failed to generate unique code after multiple attempts');
}
```

### 4.2 Batch Import Optimization Algorithm

**Objective**: Import large vocabulary lists efficiently without timeout

**Strategy**:
1. **Batching**: Process 100 words per batch
2. **Transaction**: Wrap entire import in database transaction
3. **Upsert**: Use upsert to handle duplicates
4. **SQLite Optimization**: Temporarily disable synchronous writes

**Implementation**:
```typescript
async function batchImportWords(
  userId: string,
  groupId: string,
  words: Array<WordData>,
  skipExisting: boolean
): Promise<{ imported: number; skipped: number }> {
  const batchSize = 100;
  let imported = 0;
  let skipped = 0;
  
  // Optimize SQLite for bulk writes
  await prisma.$executeRaw`PRAGMA synchronous = OFF`;
  await prisma.$executeRaw`PRAGMA journal_mode = MEMORY`;
  
  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);
        
        for (const wordData of batch) {
          const normalizedWord = wordData.word.toLowerCase().trim();
          
          // Check for existing word
          if (skipExisting) {
            const existing = await tx.word.findUnique({
              where: {
                word_userId: {
                  word: normalizedWord,
                  userId
                }
              }
            });
            
            if (existing) {
              skipped++;
              continue;
            }
          }
          
          // Insert word
          const word = await tx.word.create({
            data: {
              word: normalizedWord,
              phonetic: wordData.phonetic,
              pos: wordData.pos,
              translation: wordData.translation,
              example: wordData.example,
              exampleTranslation: wordData.exampleTranslation,
              userId
            }
          });
          
          // Create ReviewGroupWord association
          await tx.reviewGroupWord.create({
            data: {
              reviewGroupId: groupId,
              wordId: word.id
            }
          });
          
          imported++;
        }
      }
    });
  } finally {
    // Restore SQLite settings
    await prisma.$executeRaw`PRAGMA synchronous = FULL`;
    await prisma.$executeRaw`PRAGMA journal_mode = DELETE`;
  }
  
  return { imported, skipped };
}
```

---

## 5. Error Handling Mechanism

### 5.1 Error Code Enumeration

```typescript
enum ShareErrorCode {
  INVALID_CODE = 'INVALID_CODE',
  EXPIRED_CODE = 'EXPIRED_CODE',
  MAX_USES_REACHED = 'MAX_USES_REACHED',
  ALREADY_IMPORTED = 'ALREADY_IMPORTED',
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INACTIVE_SHARE = 'INACTIVE_SHARE',
  INVALID_FORMAT = 'INVALID_FORMAT'
}
```

### 5.2 Error Response Schema

```typescript
interface ErrorResponse {
  success: false;
  error: ShareErrorCode;
  message: string;  // User-friendly message
  details?: any;    // Optional debug info (development only)
}
```

### 5.3 Error Mapping Table

| Error Code | HTTP Status | User Message | Action Required |
|------------|-------------|--------------|-----------------|
| `INVALID_CODE` | 404 | "密钥无效，请检查后重试" | User re-enters code |
| `EXPIRED_CODE` | 410 | "该密钥已过期，无法使用" | Request new key from sharer |
| `MAX_USES_REACHED` | 429 | "该密钥使用次数已达上限" | Request new key from sharer |
| `ALREADY_IMPORTED` | 409 | "您已导入过该词库，无需重复导入" | None (already imported) |
| `UNAUTHORIZED` | 401 | "请先登录后再使用此功能" | User logs in |
| `DATABASE_ERROR` | 500 | "导入失败，请稍后重试" | Retry operation |
| `RATE_LIMIT_EXCEEDED` | 429 | "操作过于频繁，请稍后再试" | Wait and retry |

### 5.4 Error Handling Pattern

```typescript
// API route error handling template
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse(ShareErrorCode.UNAUTHORIZED, 401);
    }
    
    const body = await req.json();
    // ... business logic
    
    return NextResponse.json({ success: true, data: result });
    
  } catch (error) {
    console.error('[Share API] Error:', error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return createErrorResponse(ShareErrorCode.GROUP_NOT_FOUND, 404);
      }
      if (error.code === 'P2002') {
        return createErrorResponse(ShareErrorCode.ALREADY_IMPORTED, 409);
      }
    }
    
    return createErrorResponse(ShareErrorCode.DATABASE_ERROR, 500);
  }
}

function createErrorResponse(code: ShareErrorCode, status: number) {
  const messages: Record<ShareErrorCode, string> = {
    [ShareErrorCode.INVALID_CODE]: '密钥无效，请检查后重试',
    [ShareErrorCode.EXPIRED_CODE]: '该密钥已过期，无法使用',
    // ... other messages
  };
  
  return NextResponse.json(
    {
      success: false,
      error: code,
      message: messages[code]
    },
    { status }
  );
}
```

---

## 6. Security Constraints

### 6.1 Authentication Requirements

**All share-related endpoints require authentication**:
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json(
    { success: false, error: 'UNAUTHORIZED' },
    { status: 401 }
  );
}
```

### 6.2 Authorization Rules

| Operation | Permission |
|-----------|------------|
| Create share | Owner of ReviewGroup |
| Import vocabulary | Any authenticated user |
| Revoke share | Share owner or admin |
| View stats | Share owner only |
| Regenerate key | Share owner only |

### 6.3 Rate Limiting

**Implementation**:
```typescript
// Rate limit: 10 validations per minute per IP
const ip = req.headers.get('x-forwarded-for') || 'unknown';
const limitKey = `share:validate:${ip}`;

const remaining = await rateLimiter.decrement(limitKey, 60); // 60s window
if (remaining < 0) {
  return createErrorResponse(ShareErrorCode.RATE_LIMIT_EXCEEDED, 429);
}
```

**Limits**:
- Key validation: 10 requests/minute/IP
- Import operation: 20 requests/hour/user
- Share creation: 10 requests/day/user

### 6.4 Data Validation Rules

```typescript
// Input validation schema
const ImportRequestSchema = z.object({
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/),
  customName: z.string().min(1).max(100),
  targetGroupId: z.string().cuid().optional(),
  createNewGroup: z.boolean().default(true),
  skipExisting: z.boolean().default(true)
});

// Validate request body
const parsed = ImportRequestSchema.safeParse(await req.json());
if (!parsed.success) {
  return createErrorResponse(ShareErrorCode.INVALID_FORMAT, 400);
}
```

### 6.5 Audit Logging

**Log all critical operations**:
```typescript
await prisma.auditLog.create({
  data: {
    userId: session.user.id,
    action: 'SHARE_IMPORT',
    entityType: 'SharedVocabulary',
    entityId: share.id,
    metadata: JSON.stringify({
      code: share.code,
      wordsImported: result.wordsImported,
      targetGroupId: result.groupId
    }),
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent')
  }
});
```

**Logged Actions**:
- `SHARE_CREATE`: Create new share
- `SHARE_IMPORT`: Import vocabulary via share
- `SHARE_REVOKE`: Revoke/ delete share
- `SHARE_REGENERATE`: Regenerate share key

---

## 7. Usage Examples

### 7.1 Example: Import Vocabulary via Share Key

**Frontend Component Call**:
```typescript
async function handleImport(shareCode: string, customName: string) {
  try {
    // Step 1: Validate key
    const validateRes = await fetch(`/api/share/validate/${shareCode}`);
    const validateData = await validateRes.json();
    
    if (!validateData.valid) {
      toast.error(validateData.message);
      return;
    }
    
    // Step 2: Execute import
    const importRes = await fetch('/api/share/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: shareCode,
        customName: customName,
        createNewGroup: true,
        skipExisting: true
      })
    });
    
    const importData = await importRes.json();
    
    if (importData.success) {
      toast.success(
        `导入成功！共导入 ${importData.data.wordsImported} 个单词，跳过 ${importData.data.wordsSkipped} 个`
      );
      refreshGroupList();
    } else {
      toast.error(importData.message);
    }
  } catch (error) {
    console.error('Import failed:', error);
    toast.error('导入失败，请重试');
  }
}
```

### 7.2 Example: Create Share for ReviewGroup

**API Call**:
```typescript
async function createGroupShare(groupId: string, groupName: string) {
  const response = await fetch('/api/share/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reviewGroupId: groupId,
      name: `${groupName}的词库`,
      description: `分享自 ${groupName}`,
      expiresAt: null,  // No expiration
      maxUses: null     // Unlimited uses
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Copy to clipboard
    await navigator.clipboard.writeText(data.data.code);
    toast.success(`分享密钥已生成并复制：${data.data.code}`);
  }
  
  return data;
}
```

### 7.3 Example: Prisma Query for Share Data

**Backend Implementation**:
```typescript
// Fetch words from shared ReviewGroup
const share = await prisma.sharedVocabulary.findUnique({
  where: { code },
  include: {
    reviewGroup: {
      include: {
        words: {
          include: {
            word: true
          }
        }
      }
    }
  }
});

const words = share.reviewGroup.words.map(rgw => ({
  word: rgw.word.word,
  phonetic: rgw.word.phonetic,
  pos: rgw.word.pos,
  translation: rgw.word.translation,
  example: rgw.word.example,
  exampleTranslation: rgw.word.exampleTranslation
}));
```

---

## 8. Development Tasks Checklist

### Phase 1: Database & API Foundation (3-4 days)
- [ ] Create Prisma migration: `add_shared_vocabulary_feature`
- [ ] Implement `generateShareCode()` function with collision handling
- [ ] Implement `POST /api/share/create` endpoint
- [ ] Implement `GET /api/share/validate/:code` endpoint
- [ ] Implement `POST /api/share/import` endpoint with transaction support
- [ ] Write unit tests for code generation algorithm
- [ ] Write integration tests for import flow

### Phase 2: Frontend Import Components (3-4 days)
- [ ] Create `ShareImportModal` component (src/components/vocabulary/)
- [ ] Create `ShareCodeInput` component with real-time validation
- [ ] Create `DefaultVocabularyList` component
- [ ] Create `GroupSelector` component with "create new" option
- [ ] Integrate components into existing vocabulary panel
- [ ] Implement error toast notifications
- [ ] Add loading states and progress indicators

### Phase 3: Frontend Share Components (3-4 days)
- [ ] Create `GroupShareModal` component (src/components/review-group/)
- [ ] Create `ShareCodeDisplay` component with copy button
- [ ] Implement clipboard copy functionality
- [ ] Integrate share button into ReviewGroup list items
- [ ] Create share statistics display
- [ ] Add share management UI (revoke, regenerate)

### Phase 4: Default Vocabulary Configuration (2-3 days)
- [ ] Create default ReviewGroups via seed script
- [ ] Import CET-4/6 vocabulary (8000 words)
- [ ] Import IELTS vocabulary (4000 words)
- [ ] Import Postgraduate vocabulary (5500 words)
- [ ] Generate default share keys
- [ ] Implement `GET /api/share/defaults` endpoint
- [ ] Test default vocabulary import flow

### Phase 5: Testing & Optimization (3-4 days)
- [ ] Integration testing (all API endpoints)
- [ ] Performance testing (bulk import 1000+ words)
- [ ] Security testing (brute force, SQL injection, XSS)
- [ ] User experience testing (error messages, loading states)
- [ ] Fix identified bugs
- [ ] Optimize database queries (add indexes)

### Phase 6: Documentation & Deployment (1-2 days)
- [ ] Update user documentation (Chinese)
- [ ] Update API documentation (OpenAPI/Swagger)
- [ ] Deploy to production environment
- [ ] Monitor error logs and performance metrics
- [ ] Create rollback plan

---

## 9. Performance Optimization Guidelines

### 9.1 Database Optimization

**Indexing Strategy**:
```prisma
@@index([code])              // Fast key lookup
@@index([userId])            // User's shares
@@index([reviewGroupId])     // Group's shares
@@index([expiresAt])         // Expiration cleanup
@@index([isActive])          // Active share filtering
```

**Query Optimization**:
```typescript
// BAD: N+1 query problem
const shares = await prisma.sharedVocabulary.findMany({
  where: { userId }
});
for (const share of shares) {
  const group = await prisma.reviewGroup.findUnique({
    where: { id: share.reviewGroupId }
  });
}

// GOOD: Use include
const shares = await prisma.sharedVocabulary.findMany({
  where: { userId },
  include: {
    reviewGroup: true
  }
});
```

### 9.2 Caching Strategy

**Cache Default Vocabulary List**:
```typescript
// In-memory cache (Next.js server)
const defaultVocabCache = new Map<string, any>();
const CACHE_TTL = 3600000; // 1 hour

async function getDefaultVocabularies() {
  const cached = defaultVocabCache.get('defaults');
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await prisma.defaultVocabulary.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  });
  
  defaultVocabCache.set('defaults', {
    data,
    timestamp: Date.now()
  });
  
  return data;
}
```

### 9.3 Frontend Optimization

**Debounced Validation**:
```typescript
// React hook with debounce
function useShareCodeValidation(code: string) {
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!code || code.length < 11) {
        setValidation(null);
        return;
      }
      
      setLoading(true);
      const res = await fetch(`/api/share/validate/${code}`);
      const data = await res.json();
      setValidation(data);
      setLoading(false);
    }, 500); // 500ms debounce
    
    return () => clearTimeout(handler);
  }, [code]);
  
  return { validation, loading };
}
```

---

## 10. Constraints & Assumptions

### 10.1 Technical Constraints
1. **Database**: SQLite only (no PostgreSQL/MySQL support)
2. **File Size**: Excel import limited to 10MB
3. **Timeout**: API timeout set to 60 seconds
4. **Batch Size**: Maximum 100 words per batch
5. **Rate Limits**: Enforced at API route level

### 10.2 Business Constraints
1. **Share Type**: Only ReviewGroup sharing supported (no individual word sharing)
2. **Import Limit**: Each user can import same share only once
3. **Default Vocabularies**: Only 3 pre-configured (CET-4/6, IELTS, Postgraduate)
4. **Key Format**: Fixed 11-character segmented format

### 10.3 Assumptions
1. User authentication handled by NextAuth.js
2. ReviewGroup functionality already implemented
3. Word model supports all required fields
4. Admin users can manage all shares

---

## 11. Appendix

### 11.1 Glossary

| Term | Definition |
|------|------------|
| Share Key | 11-character cryptographic code for vocabulary sharing |
| ReviewGroup | User-created vocabulary grouping |
| Import | Process of copying shared vocabulary to user's account |
| Share | Act of making ReviewGroup accessible via key |

### 11.2 Reference Links
- Prisma Documentation: https://www.prisma.io/docs
- NextAuth.js Documentation: https://next-auth.js.org/
- Next.js App Router: https://nextjs.org/docs/app
- shadcn/ui Components: https://ui.shadcn.com/

### 11.3 File Structure

```
src/
├── app/
│   └── api/
│       └── share/
│           ├── create/route.ts
│           ├── import/route.ts
│           ├── validate/[code]/route.ts
│           ├── preview/[code]/route.ts
│           ├── data/[code]/route.ts
│           ├── list/route.ts
│           ├── defaults/route.ts
│           ├── stats/[id]/route.ts
│           └── [id]/
│               ├── route.ts
│               └── regenerate/route.ts
├── components/
│   ├── vocabulary/
│   │   ├── ShareImportModal.tsx
│   │   ├── ShareCodeInput.tsx
│   │   ├── DefaultVocabularyList.tsx
│   │   └── GroupSelector.tsx
│   └── review-group/
│       ├── GroupShareModal.tsx
│       └── ShareCodeDisplay.tsx
└── lib/
    └── share/
        ├── codeGenerator.ts
        ├── validator.ts
        └── importer.ts
```

---

**Document End**
