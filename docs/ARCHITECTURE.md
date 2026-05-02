# Architecture

> Based on code as of 2026-04.

## System Overview

```
Browser (React 19)
    │
    ▼
Next.js 16 (App Router)
    ├── Middleware (CSRF, Auth)
    │
    ├── API Routes (/api/*)
    │   ├── translate / translate-only → LLM Pool
    │   ├── dictation → Review Groups
    │   ├── share → Shared Vocab
    │   ├── tts → Edge TTS
    │   ├── analytics → Event Store
    │   └── admin → Config / Users / Public Words
    │
    ├── Services Layer
    │   ├── TranslationService  (LLM prompt engineering, caching, quality scoring)
    │   ├── CacheService        (DB-backed word lookup with mirror refresh)
    │   ├── PublicWordService   (Public library upsert with quality gating)
    │   └── StreamHandler       (SSE streaming for translation)
    │
    └── Data Layer (Prisma → PostgreSQL)
```

## Key Design Patterns

### Translation Pipeline

```
User Input → sentenceDetector (word vs sentence)
          → security.ts (sanitization, injection detection)
          → requestDeduplication (concurrent identical requests)
          → translationCache (LRU, 10K entries, 24h TTL)
          → llmPool (provider selection, failover, quotas)
          → LLM API call
          → qualityScoring → PublicWordService (upsert to library)
          → StreamHandler (SSE response to client)
```

### LLM Provider Pool (`lib/llmPool.ts`)

- Providers loaded from `LlmApiProvider` table, sorted by priority
- Handles quota exceeded (402) and rate limit (429) with automatic failover
- Supports custom user-provided API keys (stored in browser localStorage only)
- Connection pooling via `connectionPool.ts`

### Translate-Only Limit (`lib/translateOnlyUsage.ts`)

- Per-user: 10 free translations/day (UTC+8 midnight reset)
- Per-device: cross-account cumulative limit via `DeviceUsageLog`
- Device fingerprint via `deviceId.ts` (localStorage)
- Admins unlimited

### Security Layers

| Layer                  | Module                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| CSRF                   | `csrf.ts` → middleware for all non-public paths                       |
| Prompt Injection       | `injectionDetector.ts` (regex patterns), `security.ts` (sanitization) |
| Rate Limiting          | `rateLimit.ts` (sliding window, memory + Redis stores)                |
| Ban Escalation         | `banManager.ts` (warning → 1h → 24h → permanent)                      |
| Environment Validation | `envValidator.ts` → `instrumentation.ts` at startup                   |

### Vocabulary Data Model

```
PublicWord  ←── publicWordId ──→  Word (per-user)
  (qualityScore, version)         (sourceType: ai/import/public)
                                  (correctCount, incorrectCount)
```

Public words cascade updates to all linked private words via `publicWordCascade.ts`. Private words use `publicWordId` reference to deduplicate common fields.

### History Page Performance

The history page (`/history`) uses `react-virtuoso` with:

- `contain: layout style paint` CSS containment on cards
- GPU acceleration via `transform: translateZ(0)` / `backface-visibility: hidden`
- `overscan: 300` and `increaseViewportBy: { top: 500, bottom: 500 }`
- Memoized `itemContent` render callback with stable `computeItemKey`
- Smooth scroll container with `overflow-anchor: none`

### Structured Logging

Pino-based logger (`lib/logger.ts`) with:

- JSON output in production, pretty-print in development
- Per-request child loggers with `requestId` + `userId` context
- Security event logging via `logger.security()`

## Deployment

```bash
docker-compose up -d
```

Services: `app` (Next.js on port 3000) + `db` (PostgreSQL 16 on port 5432). Health check at `/api/health`.
