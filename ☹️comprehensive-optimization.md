# 🚀 EZTor Project Pre-Deployment Comprehensive Optimization Analysis Report

Project: EZTor (Vocabulary Memory Tool)
Version: 0.3.0
Tech Stack: Next.js 16.2.1 / React 19 / Prisma (SQLite) / NextAuth / OpenAI API
Analysis Date: 2026-04-15

## 1. Architectural Design Assessment

### 1.1 Overall Architecture Overview

The project adopts Next.js App Router architecture, with isomorphic frontend and backend, and API Routes as the BFF layer. The database uses SQLite (Prisma ORM), and authentication uses NextAuth v4 (JWT strategy).

### 1.2 Identified Issues

✅Critical — Missing Middleware Layer (Priority: P0)
Current Status: proxy.ts defines complete authentication/CSRF/permission middleware logic, but it is not loaded by Next.js. There is no middleware.ts file in the project, which means:

- CSRF protection is completely ineffective
- Admin route protection is completely ineffective
- Authentication checks rely on each API route to call getServerSession independently instead of unified interception
  Recommended Improvement: Rename proxy.ts to src/middleware.ts and export the default function to ensure Next.js loads it automatically.

Impact: Security — Any unauthenticated user can directly access admin APIs and pages.

✅Critical — Translate Route Giant Function (Priority: P0)
Current Status: The POST function in translate/route.ts is 1162 lines long, responsible for:

- Authentication & permission checks
- Rate limiting
- Input validation & injection detection
- Multi-level cache queries (user library → public library)
- Public library data completion
- LLM calls & streaming responses
- Database writes (user library + public library)
- Translation records
- Concurrent request deduplication
- Auto-synchronization
  Recommended Improvement: Split into independent service layers:
- TranslationService — Core translation logic
- CacheService — Multi-level cache management
- PublicWordService — Public word library operations
- StreamHandler — Streaming response processing
  Impact: Extremely poor maintainability, difficult for new developers to understand and modify; testing is difficult; easy to introduce regression bugs.

✅ Medium — Duplicate Authentication Logic (Priority: P1)
Current Status: Authentication logic is completely duplicated in auth.ts and route.ts (nextauth). Both files contain the same authOptions, authorize function, captcha verification, etc.

Recommended Improvement: Define authOptions only in auth/\[...nextauth]/route.ts, and import it in other files.

Impact: Maintenance cost doubles, and the two sets of code are prone to inconsistency.

🟡 Medium — Inconsistent API Response Format (Priority: P1)
Current Status:

- Some routes return { success: true, data: ... } (e.g., translate-only)
- Some routes return { error: ... } (e.g., translate)
- Some routes return streaming responses
- Both apiErrorHandler.ts and api.ts define response utility functions, but they are used inconsistently
  Recommended Improvement: Uniformly use handleApiError, createSuccessResponse, createErrorResponse from apiErrorHandler.ts, and enforce their use in all API routes.

Impact: Frontend needs to handle multiple response formats, increasing error probability.

🟡 Medium — LLM Pool Uses Raw SQL Instead of Prisma Model (Priority: P1)
Current Status: llmPool.ts uses $executeRawUnsafe and $queryRaw for the LlmApiProvider table instead of Prisma's type-safe queries. The table is not even defined in schema.prisma, but created dynamically via CREATE TABLE IF NOT EXISTS.

Recommended Improvement: Add LlmApiProvider to schema.prisma, use Prisma migration management, and eliminate raw SQL.

Impact: Loss of type safety, inability to use Prisma migrations, inconsistent database schema.

🟢 Low — Missing Service Layer Abstraction (Priority: P2)
Current Status: Business logic is directly embedded in API Route handlers, with no independent Service layer. The lib/ directory mainly contains utility functions and infrastructure code.

Recommended Improvement: Introduce a src/services/ layer to extract business logic from Route handlers for easier testing and reuse.

## 2. Algorithm & Complexity Analysis

### 2.1 Key Algorithm Analysis

✅ Critical — TranslationCache's O(n) Operations (Priority: P0)
Current Status: In translationCache.ts:

- set(): this.accessOrder = this.accessOrder.filter(k => k !== key) — O(n) per insertion
- get(): Same filter + push — O(n) per read
- delete(): Same filter — O(n) per deletion
- getStats(): Iterates all entries to calculate JSON.stringify(entry.data).length — O(n×m) where m is entry size
  Complexity: Each get/set operation is O(n), with n up to 10000 (MAX\_CACHE\_ENTRIES). In high concurrency scenarios, cache operations become a bottleneck.

Recommended Improvement: Use doubly linked list + Map to implement O(1) LRU cache; replace JSON.stringify in getStats() with incremental counters.

Impact: Cache performance degrades under high concurrency, and getStats() may cause CPU spikes.

🟡 Medium — Translate Route's N+1 Query Problem (Priority: P1)
Current Status: After streaming response ends, translate/route.ts performs database operations for each word individually:

- prisma.word.upsert() — once per word
- prisma.publicWord.findUnique() + prisma.publicWord.create/updateMany() — 2-3 times per word
- safeRecordTranslation() — once per word
  Complexity: O(n) database round trips, where n is the number of translated words. 50 words may generate 150+ database operations.

Recommended Improvement: Use prisma.$transaction() for batch operations, or use createMany / updateMany for batch writes.

Impact: When translating 50 words, database operations after stream end may take several seconds, increasing response time.

🟡 Medium — Polling Wait for Concurrent Request Deduplication (Priority: P1)
Current Status: translate/route.ts uses polling to wait for concurrent requests:

```
for (let attempt = 0; attempt < MAX_WAIT_ATTEMPTS; attempt++) {
  await new Promise(resolve => setTimeout(resolve, CONCURRENT_WAIT_MS));
  // check completed requests...
}
```

Maximum wait: 5 seconds (10 × 500ms).

Complexity: Worst case O(MAX\_WAIT\_ATTEMPTS × CONCURRENT\_WAIT\_MS) = 5 seconds of blocking.

Recommended Improvement: Use Promise.race() or event-driven pattern instead of polling, leveraging createDeduplicatedRequest already available in requestDeduplication.ts.

Impact: Unnecessary delay, waste of server resources.

🟡 Medium — WordInputCard Frontend Animation Blocking (Priority: P1)
Current Status: WordInputCard.tsx uses await new Promise(resolve => setTimeout(resolve, 300/800)) to control animation rhythm during streaming parsing, and these awaits are executed serially in the handleProcess async function.

Complexity: Each word has at least 1.1 seconds of animation delay (300ms + 800ms), with worst case 55 seconds for 50 words.

Recommended Improvement: Use CSS animations or requestAnimationFrame instead of setTimeout, decoupling animation from data processing.

Impact: User experience — animations severely slow down result display for large numbers of words.

🟢 Low — SentenceDetector Misjudgment Risk (Priority: P2)
Current Status: sentenceDetector.ts uses simple rules to judge sentences:

- 5+ words → sentence
- 3+ words and starts with question word/pronoun → sentence
  Problem: Phrases like "take for granted" (3 words) will be misjudged as sentences; "what about" will also be misjudged.

Recommended Improvement: Add common phrase whitelist, or use NLP library (like compromise) for more accurate judgment.

## 3. File Management Assessment

### 3.1 Project Total Size: 5.7 GB

### 3.2 Deletable Redundant Files

Path Size Description Priority
release-extract/ 459 MB Old deployment unzip artifacts 🔴 P0
deploy-fix.zip 603 MB Deployment fix zip package 🔴 P0
release/ 104 MB Old release artifacts 🔴 P0
dist/ 78 MB Old build artifacts 🔴 P0
prisma/prisma/dev.db 19 MB Development database copy 🟡 P1
dev.db (root) 16 KB Root directory development database 🟡 P1
data/dev.db — Another development database 🟡 P1
src/\_deprecated/ 12 KB Deprecated code 🟡 P1
vendor/edgeTTS-openai-api/ 324 KB Unused Python TTS service 🟡 P1
simple words.xlsx (root) 152 KB Duplicate Excel file (also in data/) 🟢 P2
cookies.txt 4 KB Should not be in code repository 🔴 P0
volces-ca.crt 0 B SSL certificate file, should not be in repo 🔴 P0
deploy-fix.ps1 8 KB One-time fix script 🟢 P2
next.config.mjs — Duplicate with next.config.ts 🟡 P1

### 3.3 Scattered Test/Debug Documentation (42 .md + 24 .txt)

Root directory contains many development process documents and test result files, such as:

- 2.1特殊字符注入测试结果、2.2 Prompt注入攻击结果.txt, etc.
- BUG\_FIX\_EXPLANATION.md, BUG\_FIX\_SOLUTION.md, BUG\_FIX\_SUMMARY.md
- 翻译项目功能优化与问题修复需求文稿.txt, 翻译项目问题分析报告.txt
- Multiple duplicate Chinese and English documents (e.g., LLM Pool Development Document.md and LLM池开发文档.md)
  Recommended Improvements:

1. Immediately delete release-extract/, deploy-fix.zip, release/, dist/ — save \~1.2 GB
2. Move test result files to docs/test-results/ or delete them
3. Merge/archive development documents to docs/ directory
4. Delete sensitive/temporary files like cookies.txt, volces-ca.crt
5. Delete next.config.mjs, keep only next.config.ts
6. Delete src/\_deprecated/ directory
   Estimated Savings: After cleanup, project size can be reduced from 5.7 GB to about 4.5 GB (excluding node\_modules), and deployment package can be reduced by about 1.2 GB.

## 4. Security Assessment

### 4.1 Critical Security Issues

🔴 Critical — Middleware Not Effective, CSRF/Permission Protection形同虚设 (Priority: P0)
Current Status: As mentioned earlier, proxy.ts contains complete CSRF validation and admin permission check logic, but it is not loaded by Next.js. There is no middleware.ts file.

Risks:

- Attackers can发起 CSRF attacks from any domain
- Non-admins can directly access sensitive endpoints like /api/admin/users, /api/llm-providers, /api/config
- Admin pages (/analytics, /users, /llm-config) have no frontend protection
  Recommended Improvement: Immediately migrate proxy.ts to src/middleware.ts.

🔴 Critical — NODE\_TLS\_REJECT\_UNAUTHORIZED = '0' (Priority: P0)
Current Status: Line 4 in connectionPool.ts:

```
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

This globally disables TLS certificate verification, making all HTTPS requests (including API Key transmission) vulnerable to man-in-the-middle attacks.

Recommended Improvement: Delete this line. If you need to connect to servers with self-signed certificates, use axios/fetch's tls options to disable for specific connections instead of globally.

Impact: API Keys for all LLM API requests can be intercepted by man-in-the-middle attackers.

🔴 Critical — Unrestricted Auto-Registration (Priority: P0)
Current Status: In auth/\[...nextauth]/route.ts, new accounts are automatically created when users don't exist. Although there are captcha and rate limiting:

- No invitation code/registration switch
- No email verification
- Captcha is only 4 letters, brute force space is limited but exists
- Full functionality access immediately after registration
  Recommended Improvements:

1. Add registration switch environment variable ALLOW\_REGISTRATION=true/false
2. Implement invitation code mechanism
3. Add review/limitation period for newly registered users

🔴 Critical — Prompt Injection Detection Results Not Enforced (Priority: P0)
Current Status:

- Line 235 in translate/route.ts: detectBatchPromptInjection(normalizedWords) — called but return value not checked
- Line 107 in translate-only/route.ts: detectPromptInjection(input) — same, return value not checked
  This means even if injection attacks are detected, requests continue to be processed.

Recommended Improvement:

```
const injectionResult = detectBatchPromptInjection(normalizedWords);
if (injectionResult.isInjection) {
  await recordViolation(session.user.id, 'PROMPT_INJECTION', ...);
  return NextResponse.json({ error: '...' }, { status: 400 });
}
```

### 4.2 Medium Security Issues

🟡 Medium — CSP Policy Too Permissive (Priority: P1)
Current Status: CSP in next.config.ts includes:

- script-src 'self' 'unsafe-inline' 'unsafe-eval' — allows inline scripts and eval, weakening XSS protection
- connect-src 'self' https: — allows connections to any HTTPS site
  Recommended Improvements:
- Remove 'unsafe-eval', use nonce instead of 'unsafe-inline'
- Restrict connect-src to known API domains

🟡 Medium — API Keys Stored in Plaintext in Database (Priority: P1)
Current Status: apiKey fields in LlmApiProvider and ApiConfig tables are stored in plaintext in SQLite database.

Recommended Improvement: Use AES-256-GCM to encrypt API Keys, with keys read from environment variables.

🟡 Medium — Error Messages Leak Internal Details (Priority: P1)
Current Status: translate/route.ts returns in error responses:

- SSL certificate error details
- Network connection error details
- Model quota error details
  Recommended Improvement: Return generic error messages in production, log detailed information only in server logs.

🟡 Medium — Rate Limiting Uses Memory Storage (Priority: P1)
Current Status: rateLimit.ts uses MemoryRateLimitStore by default, which fails in multi-instance deployments or process restarts.

Recommended Improvement: Use Redis storage in production (RedisRateLimitStore implementation exists but is not enabled).

🟢 Low — console.log Leaks Sensitive Information (Priority: P2)
Current Status: Multiple console.log statements output sensitive information like user IDs, IP addresses, input content:

- injectionDetector.ts: Records intercepted input content
- translate/route.ts: Records complete AI response text
- banManager.ts: Records user operations
  Recommended Improvement: Use structured logging library, do not output DEBUG level logs in production.

## 5. User Experience Optimization

### 5.1 Identified Issues

🟡 Medium — Home Page Component Overly Stateful (Priority: P1)
Current Status: page.tsx is a 'use client' component managing 10+ state variables. The entire home page is client-side rendered, no SEO optimization, slow first screen loading.

Recommended Improvements:

- Extract static parts (Header, Welcome Banner) as Server Components
- Use Suspense + streaming SSR to improve first screen loading
- Add appropriate metadata and robots.txt

<br />

Recommended Improvement: Add responsive navigation component with main function entries.

🟡 Medium — Animation Performance Issues (Priority: P1)
Current Status: In WordInputCard.tsx:

- FlyingWord animation uses framer-motion's fixed positioning, which may cause大量重排
- 800ms artificial delay between each word animation
- AnimatePresence has poor performance with many child elements
  Recommended Improvements:
- Use CSS transform + will-change instead of JS animations
- Batch display results instead of animating one by one
- Consider using react-virtuoso (installed but not used here) to virtualize result lists

🟡 Medium — Missing Loading States and Error Boundaries (Priority: P1)
Current Status:

- Most pages have no Skeleton/Loading states
- error-boundary.tsx is only used outside TranslateOnlyCard
- Add loading.tsx to all pages
- Wrap all critical components with ErrorBoundary

🟡 Medium — Accessibility Deficiencies (Priority: P1)
Current Status:

- Missing aria-label attributes
- Color contrast not verified
- Keyboard navigation support incomplete
- No skip navigation links
- Forms lack associated label elements
  Recommended Improvement: Conduct WCAG 2.1 AA compliance audit, add necessary ARIA attributes.

🟢 Low — Incomplete Internationalization (Priority: P2)
Current Status: UI text mixes Chinese and English, some error messages are in Chinese, some in English. No i18n framework.

Recommended Improvement: Introduce next-intl or similar library to uniformly manage multi-language text.

## 6. Comprehensive Priority Matrix

Priority ID Issue Domain Impact
🔴 P0 S-1 Middleware Not Effective Security CSRF/permission protection failure
🔴 P0 S-2 TLS Verification Globally Disabled Security API Keys can be intercepted
🔴 P0 S-3 Prompt Injection Detection Not Enforced Security Injection attacks can bypass
🔴 P0 A-1 Translate Route Giant Function Architecture Unmaintainable
🔴 P0 F-1 Redundant Deployment Artifacts (\~1.2GB) File Deployment package too large
🔴 P0 S-4 Unrestricted Auto-Registration Security Abuse risk
🟡 P1 A-2 Duplicate Authentication Logic Architecture Maintenance cost
🟡 P1 A-3 Inconsistent API Response Format Architecture Frontend compatibility
🟡 P1 A-4 LLM Pool Raw SQL Architecture Type safety
🟡 P1 C-1 TranslationCache O(n) Complexity Performance degradation
🟡 P1 C-2 N+1 Database Queries Complexity Response delay
🟡 P1 C-3 Concurrent Request Polling Wait Complexity Resource waste
🟡 P1 S-5 CSP Policy Too Permissive Security XSS risk
🟡 P1 S-6 API Keys Plaintext Storage Security Data leakage
🟡 P1 S-7 Error Message Leakage Security Information leakage
🟡 P1 S-8 Rate Limiting Memory Storage Security Multi-instance failure
🟡 P1 U-1 Home Page No SSR/SEO Experience Slow first screen
🟡 P1 U-2 Missing Global Navigation Experience Poor discoverability
🟡 P1 U-3 Animation Performance Experience Interaction lag
🟡 P1 U-4 Missing Loading/Error States Experience Poor user experience
🟡 P1 U-5 Accessibility Deficiencies Experience Accessibility
🟢 P2 A-5 Missing Service Layer Architecture Testability
🟢 P2 C-4 Sentence Detection Misjudgment Complexity Function accuracy
🟢 P2 S-9 console.log Leakage Security Log security
🟢 P2 U-6 Incomplete Internationalization Experience User coverage

## 7. Pre-Deployment Must-Fix Items (Blockers)

The following issues must be fixed before going live, otherwise they will cause serious security risks or functional abnormalities:

1. Enable Middleware — Migrate proxy.ts to src/middleware.ts
2. Remove NODE\_TLS\_REJECT\_UNAUTHORIZED='0' — Globally disabling TLS verification is a serious security vulnerability
3. Enforce Prompt Injection Detection Results — Must reject requests when injection is detected
4. Clean Up Redundant Files — Delete release-extract/, deploy-fix.zip, release/, dist/, cookies.txt, volces-ca.crt
5. Add Registration Control — At least add ALLOW\_REGISTRATION environment variable switch

## 8. Implementation Recommendation Roadmap

### Phase 1: Pre-Launch (1-2 days)

- Fix 5 Blocker items
- Clean up redundant files
- Basic functionality regression testing

### Phase 2: Stability (1 week)

- Split Translate Route
- Unify authentication logic
- Unify API response format
- Optimize TranslationCache to O(1)
- Batch database operations

### Phase 3: Hardening (2 weeks)

- Encrypt API Key storage
- Enable Redis rate limiting
- Tighten CSP policy
- Add global navigation
- Improve loading/error states
- Accessibility improvements

### Phase 4: Optimization (Ongoing)

- Home page SSR optimization
- Animation performance optimization
- Internationalization support
- LLM Pool migration to Prisma Model
- Introduce service layer abstraction

