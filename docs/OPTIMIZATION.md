# EZTor Project Optimization Guide

## How to Use

This document is organized into phases. Each phase contains independently verifiable steps. Execute them in order — verify each step immediately after completion.

Verification: each step ends with the verification command or check method.

---

## Phase 1: Security Fixes (Must Execute First)

### Step 1.1 — Remove Global TLS Disable

**Problem**: `src/lib/connectionPool.ts:4` sets `NODE_TLS_REJECT_UNAUTHORIZED = '0'`, globally disabling TLS certificate verification. All outbound HTTPS connections are vulnerable to MITM attacks.

**Actions**:
1. Delete the line `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` from `src/lib/connectionPool.ts`
2. If a self-signed certificate is required for a specific LLM provider, create a custom HTTPS Agent targeting only that host

**Verification**: `npm run typecheck` passes, `npm run build` passes

---

### Step 1.2 — ~~Upgrade xlsx to Fix Known CVEs~~ (SKIPPED)

**Problem**: `xlsx@0.18.5` has CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (arbitrary code execution).

**Why skipped**: The `xlsx` package on the npm public registry maxes out at `0.18.5` — versions `0.19.x`/`0.20.x` do not exist there. SheetJS moved distribution to their own CDN (`https://cdn.sheetjs.com/`) after `0.18.5`. To upgrade, `xlsx` must be vendored from the CDN or replaced with a maintained fork.

---

### Step 1.3 — Add HSTS Security Header

**Problem**: Missing `Strict-Transport-Security` header, unable to prevent SSL stripping attacks.

**Actions**:
1. In `next.config.ts`, add a new header rule inside the `headers()` function matching all paths
2. Add header:
   ```
   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   ```

**Verification**: `npm run build && npm run start` then `curl -I http://localhost:3000` confirms the header is present (Next.js applies headers to all routes in production mode)

---

### Step 1.4 — Fix Database Port Exposure

**Problem**: `docker-compose.yml` exposes PostgreSQL port `5432:5432` to the host network.

**Actions**:
1. In `docker-compose.yml`, change the db service ports to `"127.0.0.1:5432:5432"` (listen on localhost only)
2. Or completely remove the `ports` mapping to keep database communication internal to the Docker network

**Verification**: `docker-compose config` output confirms correct port binding

---

### Step 1.5 — Fix Empty catch Blocks

**Problem**: 8 empty `catch {}` blocks silently swallow errors across these files:

| File | Line |
|------|------|
| `src/app/api/config/route.ts` | 24 |
| `src/app/api/translate-only/route.ts` | 152 |
| `src/app/api/translate-only/test-connection/route.ts` | 51 |
| `src/app/api/analytics/route.ts` | 37, 50 |
| `src/app/api/health/route.ts` | 8 |
| `src/app/users/page.tsx` | 44 |
| `src/app/llm-config/page.tsx` | 83 |

**Actions**:
1. For each empty catch block, add `logger.error({ err: error }, '...')` with a descriptive message
2. For catch blocks with `{ /* ignore */ }` comments, keep the silent behavior but add appropriate debug-level logging

**Verification**: `npm run lint` 0 errors, manually verify each catch block has a log statement

---

### Step 1.6 — Limit Error Message Exposure

**Problem**: Translation API (`src/app/api/translate/route.ts`) and LLM API (`src/app/api/llm/route.ts`) directly return raw error messages to the client. Production should return generic errors.

**Actions**:
1. At `src/app/api/translate/route.ts:234` and `:241`, only include raw `details` when `process.env.NODE_ENV !== 'production'`
2. In production, set `details` to `"Translation service error"`
3. Apply the same treatment at `src/app/api/llm/route.ts:30`

**Verification**: `npm run build` passes

---

### Step 1.7 — Regenerate NEXTAUTH_SECRET for Production

**Problem**: `.env` contains a hardcoded `NEXTAUTH_SECRET` committed to the repo. Production should use a unique generated secret.

**Actions**:
1. Run `openssl rand -base64 32` to generate a new secret
2. Replace `NEXTAUTH_SECRET` in `.env.production` with the new value
3. Do NOT commit the new secret to git — set it via environment variables in deployment

**Verification**: `grep NEXTAUTH_SECRET .env.production` shows non-empty, non-default value

---

## Phase 2: Dead Code Cleanup

### Step 2.1 — Remove Unused Dependencies

**Problem**: `franc` (language detection, ~300KB+) and `csv-parse` (CSV parsing) have no imports found in the codebase.

**Actions**:
1. Run `npm uninstall franc csv-parse`
2. If later confirmed needed, reinstall — currently dead weight

**Verification**: `npm run typecheck && npm run build && npm test`

---

### Step 2.2 — Remove Unused Demo Component

**Problem**: `src/components/ui/progress-bar-demo.tsx` (147 lines) is never imported by any file.

**Actions**:
1. Delete the file

**Verification**: `npm run typecheck` no errors

---

### Step 2.3 — Remove Unused Props and State

**Problem**:
- `GuestWordInputCard.tsx` accepts `_showPos`, `_showExample`, `_onFeatureClick`, `_results` props but never uses them
- `WordInputCard.tsx` and `GuestWordInputCard.tsx` both have `_mounted`/`_isDark` state that is set but never read

**Actions**:
1. Remove unused props from `GuestWordInputCard.tsx` Props interface
2. Update parent component `HomeContent.tsx` to stop passing those props
3. Remove unused state declarations and their set calls from both components

**Verification**: `npm run typecheck && npm run lint`

---

### Step 2.4 — Remove Debug console.log from Production

**Problem**: 140+ `console.log`/`console.error` calls. Translation flow leaks raw stream data, full word data, and sync request/response bodies to console.

Key locations in `src/components/home/WordInputCard.tsx`:
- Lines 313-350: raw stream text, parsed data, final results
- Lines 466-479: final merged data, sync request/response body

**Actions**:
1. Remove the streaming debug logs from `WordInputCard.tsx` (lines 313-350)
2. Remove the sync debug logs from `WordInputCard.tsx` (lines 466-479)
3. For server-side files, replace critical `console.error` with structured `logger` from `@/lib/logger`
4. For client components, wrap remaining console calls behind `process.env.NODE_ENV === 'development'` guard

**Verification**: Run a translation flow and check browser console — no user word data leaked

---

## Phase 3: Performance — N+1 Queries

### Step 3.1 — Batch reviewGroupWord Creation

**Problem**: `TranslationService.saveWordsToDatabase`, `CacheService.updateCacheTimestamps`, and `CacheService.copyPublicWordsToUserDb` call `prisma.reviewGroupWord.create()` individually per word.

**Files involved**:
- `src/services/TranslationService.ts:379-387`
- `src/services/CacheService.ts:114-124`
- `src/services/CacheService.ts:143-162`

**Actions**:
1. Replace the `for` loop of single `create()` calls with a single `prisma.reviewGroupWord.createMany()` call — collect data into an array first, then batch insert
2. For scenarios requiring `findUnique` first (like `updateCacheTimestamps`), do a batch `findMany` query, then `createMany` only for new records

**Verification**: `npm run typecheck && npm test`, verify translation flow and cache update still work correctly

---

### Step 3.2 — Batch Word Sync Updates

**Problem**: `src/lib/wordSync.ts:86-87` calls `syncUserWordWithPublic` per word. `:128-131` calls `prisma.word.update()` per word.

**Actions**:
1. Refactor `syncAllUserWordsWithPublic`: first batch-fetch all user words and public words (2 queries), then construct one bulk UPDATE
2. For words needing sync, use `prisma.word.updateMany` instead of looping individual `update()`

**Verification**: `npm run typecheck && npm test`

---

### Step 3.3 — Push Analytics Aggregation to Database

**Problem**: `src/app/api/analytics/route.ts:309` loads all `translationRecord` rows into memory for aggregation — no pagination, no LIMIT.

**Actions**:
1. Use Prisma `groupBy` or `$queryRaw` to push word frequency aggregation to the database
2. Add `take: 100` to `translationRecord.findMany()`
3. Refactor sub-queries to use `GROUP BY ... ORDER BY COUNT(*) DESC LIMIT 20` pattern

**Verification**: Admin analytics dashboard shows the same data as before optimization

---

### Step 3.4 — Add Database Index for Dictation Smart Sort

**Problem**: `src/app/api/dictation/smart/route.ts:29-53` orders by computed expression `(correctCount + incorrectCount)` — full table scan, no usable index.

**Actions**:
1. In `prisma/schema.prisma`, add a `totalAttempts Int @default(0)` field to the `Word` model
2. Add `@@index([totalAttempts])` on the Word model
3. Update existing logic to sort by `totalAttempts` (set via a database trigger or at write time)
4. Run `npx prisma migrate dev` to generate the migration

**Verification**: `npx prisma migrate dev` succeeds, `npm run build` passes

---

### Step 3.5 — Lazy-Load xlsx

**Problem**: `xlsx` (~1.2MB) is only used in the CSV import feature but is eagerly imported.

**Actions**:
1. In `src/app/api/import-csv/` route, change the top-level `import * as XLSX from 'xlsx'` to a dynamic `import('xlsx')` inside the function body

**Verification**: CSV import still works. First load may have slight delay — acceptable for admin-only feature.

---

### Step 3.6 — Memoize Handlers in WordInputCard and HomeContent

**Problem**: `WordInputCard.handleProcess` (400+ lines) and `HomeContent` handlers are recreated on every render, causing unnecessary child re-renders on every keystroke.

**Actions**:
1. Wrap `handleProcess` in `WordInputCard.tsx` with `useCallback`
2. Wrap `handleFeatureClick`, `handleDismissBanner`, and other handlers in `HomeContent.tsx` with `useCallback`

**Verification**: `npm run typecheck && npm run lint`, verify no regression in translation flow

---

## Phase 4: Code Quality — Eliminate Duplication

### Step 4.1 — Extract Shared Translation Hook (WordInputCard / GuestWordInputCard)

**Problem**: `WordInputCard.tsx` (705 lines) and `GuestWordInputCard.tsx` (411 lines) share ~60% duplicated logic: stream parsing, localStorage save/restore, file import, word splitting, 50-word limit check.

**Actions**:
1. Create `src/hooks/useWordTranslation.ts`
2. Extract shared logic into the hook:
   - Word splitting and 50-word limit validation
   - localStorage save/restore via `useEffect`
   - File import (fileInputRef + handleFileUpload)
   - Core streaming result parsing flow
3. Both components import from the hook, keeping only their unique UI and auth handling

**Verification**: `npm run typecheck && npm run lint && npm test`, manually test both components' translation flow

---

### Step 4.2 — Eliminate TranslationService / PublicWordService Duplication

**Problem**: `TranslationService.saveWordsToDatabase` and `PublicWordService.saveWordToPublicLibrary` implement nearly identical upsert + quality scoring with optimistic version locking.

**Actions**:
1. Refactor `TranslationService.saveWordsToDatabase` to call `PublicWordService` methods internally
2. Or extract a shared `upsertWordWithQualityScore` function to a separate utility module
3. Ensure the existing concurrent version lock and P2002 retry logic are preserved

**Verification**: `npm test`, translation and public word library functions work correctly

---

### Step 4.3 — Extract Admin CRUD Table Shared Hook

**Problem**: `history/page.tsx` (874 lines), `public-words/page.tsx` (747 lines), and `translation-records/page.tsx` (464 lines) independently implement the same pagination, search, and CRUD patterns.

**Actions**:
1. Create `src/hooks/useCrudTable.ts`
2. Extract shared logic:
   - `useAdminCheck` auth guard
   - Pagination state (`page`, `pageSize`)
   - Search with debounce (`searchQuery`, `debouncedSearch`)
   - CRUD fetch/loading/error state management
   - Batch selection and operations
3. Refactor the three pages to use the shared hook

**Verification**: `npm run typecheck && npm run lint`, all three admin pages function correctly

---

### Step 4.4 — Replace alert() with Toast

**Problem**: 39 instances of native `alert()` for user feedback across 8+ components. Inconsistent UX.

**Actions**:
1. Install Sonner toast: `npm install sonner` (~3KB, zero dependencies)
2. Add `<Toaster />` to `src/app/layout.tsx`
3. Replace `alert(...)` with `toast(...)` or `toast.error(...)` across all files

**Verification**: All notifications use Toast, no remaining native `alert()` calls in user-facing flows

---

## Phase 5: Developer Experience

### Step 5.1 — Restore TypeScript Strictness

**Problem**: `eslint.config.mjs` globally disables `@typescript-eslint/no-explicit-any`. 62 `catch (error: any)` and 24 `prisma as any` usages exist.

**Actions**:
1. Remove the `@typescript-eslint/no-explicit-any: 'off'` override in `eslint.config.mjs` (restore default 'error')
2. Replace 62 `catch (error: any)` with `catch (err: unknown)`
3. Where `err.message` is accessed, add `err instanceof Error` guard
4. Run `npx prisma generate` to fix most `prisma as any` issues — they may be caused by ungenerated client

**Verification**: `npm run lint` 0 errors, 0 warnings

---

### Step 5.2 — Add Prettier Formatting

**Problem**: No formatter configured. Code style may drift.

**Actions**:
1. Run `npm install -D prettier`
2. Create `.prettierrc`:
   ```json
   {
     "semi": false,
     "singleQuote": true,
     "tabWidth": 2,
     "trailingComma": "all",
     "printWidth": 100
   }
   ```
3. Add script to `package.json`: `"format": "prettier --write . --ignore-path .gitignore"`
4. Add `prettier --check .` step to CI

**Verification**: `npx prettier --check src/` returns 0 errors

---

### Step 5.3 — Add Prisma Convenience Scripts and postinstall

**Problem**: Missing database management scripts. New clones must manually `npx prisma generate`.

**Actions**:
1. Add to `package.json` scripts:
   - `"db:generate": "prisma generate"`
   - `"db:migrate": "prisma migrate dev"`
   - `"db:deploy": "prisma migrate deploy"`
   - `"db:studio": "prisma studio"`
2. Add `"postinstall": "prisma generate"` so prisma types are generated automatically after `npm install`

**Verification**: Delete `node_modules/.prisma`, run `npm install`, confirm prisma generate ran automatically

---

### Step 5.4 — Add Critical Path Tests

**Problem**: Only 6 test files for 153 source files (~3.9% coverage). Critical paths without tests: LLM pool selection, rate limiting, CSRF validation, auth token handling, ban escalation, injection detection, translation cache, dictation scoring, share code validation.

**Actions**:
1. Add tests in priority order:
   - Priority 1: `csrf.ts`, `rateLimit.ts`, `banManager.ts` (security core)
   - Priority 2: `TranslationService.ts` cache/dedup logic, dictation scoring, word sync
2. Set coverage thresholds in `vitest.config.ts`: `lines: 50, branches: 40`

**Verification**: `npm run test:coverage`, coverage meets thresholds

---

### Step 5.5 — Fix CSP script-src for Next.js Compatibility

**Problem**: `next.config.ts` CSP has `script-src 'self'` which may block Next.js required inline scripts for chunk loading.

**Actions**:
1. In `next.config.ts`, change `script-src` in production CSP to `'self' 'unsafe-inline'`
2. Or implement a nonce-based approach if `unsafe-inline` is unacceptable
3. Test with production build in browser DevTools — no CSP violation errors

**Verification**: `npm run build && npm run start`, open browser DevTools, confirm no CSP violations

---

## Phase 6: Infrastructure Hardening

### Step 6.1 — Dockerfile Optimization

**Actions**:
1. Replace `COPY prisma ./prisma` with `COPY prisma/schema.prisma ./prisma/schema.prisma` and `COPY prisma/migrations ./prisma/migrations`
2. Add HEALTHCHECK:
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=3s CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
   ```
3. Replace `npm install -g prisma@5` with using local `npx prisma`

**Verification**: `docker build -t eztor .` succeeds

---

### Step 6.2 — CI Pipeline Optimization

**Actions**:
1. Add path filters to `.github/workflows/ci.yml` to skip CI on README/docs-only commits:
   ```yaml
   paths:
     - 'src/**'
     - 'prisma/**'
     - 'package*.json'
     - 'tsconfig*.json'
     - 'next.config.*'
     - '.github/**'
   ```
2. Add healthcheck to PostgreSQL service container
3. Add `actions/cache` for `.next/cache` and `~/.npm`
4. Split lint + typecheck into a parallel job separate from build

**Verification**: Push to GitHub, CI passes with reduced build time

---

### Step 6.3 — Add Sentry Error Tracking

**Problem**: No error aggregation service. Production errors only visible in logs.

**Actions**:
1. Run `npm install @sentry/nextjs`
2. Follow Sentry Wizard: `npx @sentry/wizard -i nextjs`
3. Integrate `withSentryConfig` wrapper in `next.config.ts`

**Verification**: Deliberately trigger an error, confirm it appears in Sentry dashboard

---

## Execution Order Summary

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| 1 (Security Fixes) | 2h | None |
| 2 (Dead Code Cleanup) | 1h | None |
| 3 (N+1 Performance) | 4h | Phase 1 |
| 4 (Eliminate Duplication) | 4h | Phase 3 |
| 5 (DX Improvements) | 3h | None |
| 6 (Infrastructure) | 2h | Phase 1 |

**Total estimated: ~16 hours**

---

## Quick Reference — Most Impactful Fixes

If time is limited, execute only these:

1. **Remove `NODE_TLS_REJECT_UNAUTHORIZED = '0'`** (Step 1.1) — critical security
2. ~~**Upgrade `xlsx`** (Step 1.2) — patches 2 known CVEs (skipped — `0.20.3` not on npm registry)~~
3. **Fix N+1 database writes** (Steps 3.1, 3.2) — 20-50x reduction in DB queries
4. **Push analytics aggregation to DB** (Step 3.3) — prevents OOM on large datasets
5. **Remove debug console.log** (Step 2.4) — stops user data leaks to console
