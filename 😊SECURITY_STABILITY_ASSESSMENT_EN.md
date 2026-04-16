# 🔍 Project Stability and Security Assessment Report

**Assessment Date**: 2026-04-15  
**Project Version**: 0.3.0  
**Assessment Scope**: Build, type safety, runtime security, error handling, memory management, feature completeness, test coverage

---

## Project Overview

| Item | Information |
|------|-------------|
| **Name** | EZTor (web) |
| **Version** | 0.3.0 |
| **Tech Stack** | Next.js 16.2.3 + React 19.2.4 + Prisma (SQLite) + NextAuth v4 + OpenAI API |
| **Features** | English vocabulary translation and memorization tool, supporting LLM translation, flashcard review, bullet comments, and word library sharing |
| **Deployment Mode** | standalone (PM2) |

---

## 🚨 I. Build Status: ❌ Build Failed

**The project currently cannot build successfully** due to a blocking syntax error:

### Blocking Issue: `src/services/StreamHandler.ts:25`

```typescript
// Error code
async start: async (controller) => {
```

The `start` property of the `ReadableStream` constructor cannot use the `async` modifier. Turbopack parser reports an error here, making the entire translation API unavailable. The correct syntax should be `start(controller) { ... }` with async function calls inside.

**Impact Scope**: Core translation functionality is completely unavailable, affecting all pages and APIs that depend on translation.

---

## 📊 II. TypeScript Type Check: 83 Errors

`tsc --noEmit` detected **83 type errors**, distributed as follows:

| File Area | Error Count | Main Issues |
|-----------|-------------|-------------|
| `src/app/api/share/__tests__/import.test.ts` | ~30 | Test mock objects missing required fields |
| `scripts/*.ts` | ~20 | Prisma model fields missing (id, updatedAt) |
| `src/app/api/config/route.ts` | 1 | ApiConfig missing updatedAt |
| `src/app/api/dictation/update/route.ts` | 1 | Word missing id, updatedAt |
| `src/app/api/import-csv/route.ts` | 1 | Word missing id, updatedAt |

**Root Cause**: Multiple models in Prisma schema use `@id` and `@default` for auto-generation, but `id` and `updatedAt` fields are omitted when manually creating records in code. `skipLibCheck: true` masks some issues, but runtime errors may occur.

---

## 📝 III. Lint Check: 1 Error + 93 Warnings

| Level | Count | Key Issues |
|-------|-------|------------|
| **Error** | 1 | `src/services/StreamHandler.ts:25` — `async` modifier position error |
| **Warning** | 93 | Unused variables/imports (30+), missing useEffect dependencies (1), others |

---

## ✅ IV. Unit Tests: 55/55 Passed

3 test files, 55 test cases all passed. However, test coverage is limited, and core translation flow lacks integration tests.

---

## 🔴 V. High-Risk Runtime Issues (5 items)

### 5.1 Global Disabling of TLS Certificate Verification

**File**: `src/lib/connectionPool.ts:3-5`

```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

**Impact**: All HTTPS requests in the entire Node.js process (including NextAuth, OpenAI API, database connections) skip TLS verification, making it extremely vulnerable to man-in-the-middle attacks. This is the **most severe security vulnerability**.

### 5.2 SQL Injection Risk

**File**: `src/app/api/llm-providers/route.ts:115-118`

```typescript
const setClause = keys.map((k) => `${k} = ?`).join(', ');
await prisma.$executeRawUnsafe(`UPDATE LlmApiProvider SET ${setClause} WHERE id = ?`, ...values, id);
```

`$executeRawUnsafe` is used in API routes that handle user input. Although field names are currently filtered by a whitelist, the architecture is fragile—if the filtering logic is accidentally modified, column name injection becomes a reality.

### 5.3 Ban Check Bypassed on Database Failure

**File**: `src/lib/banManager.ts:91`

```typescript
} catch {
  return { isBanned: false };  // On database error, banned users bypass check
}
```

When the database is unavailable, all IP ban checks default to allowing access, creating a security vulnerability.

### 5.4 LlmApiProvider Table Outside Prisma Management

**File**: `src/lib/llmPool.ts:109-132`

The `LlmApiProvider` table is dynamically created via `$executeRawUnsafe` and not defined in `schema.prisma`, leading to:
- Migration tools cannot manage it
- Type safety entirely depends on manual maintenance
- Desynchronization with Prisma schema

### 5.5 NextAuth Middleware Deprecated

**File**: `src/middleware.ts`

Next.js 16 build has issued a warning:

> ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.

This means the current authentication middleware may completely fail in future versions.

---

## 🟡 VI. Medium-Risk Runtime Issues (8 items)

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | Module-level `setInterval` without cleanup | `src/lib/requestDeduplication.ts:34`, `src/lib/rateLimit.ts:164` | Timer leaks during development hot reload |
| 2 | Unbounded growth of `MonitoringService.metrics` Map | `src/lib/monitoring.ts:2` | Slow memory growth during long-term operation |
| 3 | Connection pool without expiration/invalidation mechanism | `src/lib/connectionPool.ts:8` | Old clients still used after API key changes |
| 4 | Non-atomic increment in rate limiter | `src/lib/rateLimit.ts:139` | May allow 1-2 extra requests during concurrency |
| 5 | `Promise.all` + `.catch(() => null)` swallowing errors | `src/services/CacheService.ts:129` | Database errors ignored, subsequent operations may use null |
| 6 | Numerous `as any` bypassing type system | banManager.ts, llmPool.ts, analytics/route.ts | Compiler cannot catch schema changes |
| 7 | `getServerSession` deprecated | Multiple API routes | Authentication may fail after NextAuth upgrade |
| 8 | `SELECT *` raw queries | `src/services/CacheService.ts:30` | Returned columns uncontrolled on schema changes |

---

## 🟢 VII. Architecture and Security Highlights

The project performs well in the following aspects:

1. **Comprehensive security headers**: `next.config.ts` configures CSP, X-Frame-Options, X-Content-Type-Options, etc.
2. **CSRF protection**: `src/lib/csrf.ts` implements Origin/Referer-based CSRF validation
3. **Input validation and sanitization**: `src/lib/security.ts` implements prompt injection detection and input sanitization
4. **Environment variable validation**: `src/lib/envValidator.ts` checks required variables and unsafe defaults
5. **LLM failover**: `src/lib/llmPool.ts` implements multi-provider failover and quota management
6. **Request deduplication**: `src/lib/requestDeduplication.ts` avoids duplicate translation requests
7. **LRU cache**: `src/lib/translationCache.ts` implements cache with TTL and eviction strategy
8. **CAPTCHA protection**: Uses HMAC-based verification during login to prevent brute force attacks
9. **Progressive banning**: Violation count increments trigger 1h → 24h → permanent bans

---

## 📋 VIII. Comprehensive Stability Score

| Dimension | Score | Description |
|-----------|-------|-------------|
| **Build Stability** | ❌ 0/10 | Build failed, core functionality unavailable |
| **Type Safety** | ⚠️ 3/10 | 83 type errors, numerous `as any` bypasses |
| **Runtime Security** | ⚠️ 4/10 | Global TLS verification disabled, SQL injection risk |
| **Error Handling** | ⚠️ 5/10 | Multiple empty catch blocks swallowing critical errors |
| **Memory Management** | ⚠️ 6/10 | Slow leak risk, acceptable for short-term operation |
| **Feature Completeness** | ✅ 7/10 | Rich features, complete caching/rate limiting/failover |
| **Test Coverage** | ⚠️ 4/10 | Unit tests passed but coverage low |
| **Overall Score** | ⚠️ **4.1/10** | **Project currently not deployable, requires fixing build blocking issues and high-risk security vulnerabilities** |

---

## 🎯 IX. Priority Fix Recommendations (sorted by urgency)

1. **🔴 P0 — Fix Build Blocking**: Correct the `async start` syntax error in `src/services/StreamHandler.ts:25`
2. **🔴 P0 — Remove Global TLS Disabling**: Delete `NODE_TLS_REJECT_UNAUTHORIZED='0'` in `src/lib/connectionPool.ts:4`
3. **🔴 P1 — Fix Ban Bypass Vulnerability**: Change catch block in `src/lib/banManager.ts:91` to default to rejection instead of allowing access
4. **🟡 P1 — Eliminate SQL Injection Risk**: Replace `$executeRawUnsafe` with Prisma ORM operations or `$executeRaw` + `Prisma.sql`
5. **🟡 P2 — Bring LlmApiProvider into Prisma Schema**: Unify data model management
6. **🟡 P2 — Fix 83 TypeScript Type Errors**: Ensure compile-time type safety
7. **🟢 P3 — Add Size Limit to MonitoringService**: Prevent long-term memory leaks
8. **🟢 P3 — Migrate middleware → proxy**: Adapt to Next.js 16 new specification