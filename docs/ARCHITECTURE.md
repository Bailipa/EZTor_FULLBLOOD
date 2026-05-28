# Architecture

> Based on code as of 2026-05.

## System Overview

```
Browser (React 19)
    │
    ▼
Next.js 16 (App Router)
    ├── Middleware (CSRF, Auth, Mobile Redirect)
    │
    ├── API Routes (/api/*)
    │   ├── translate / translate-only → LLM Pool
    │   ├── dictation → Review Groups
    │   ├── share → Shared Vocab
    │   ├── tts → Xiaomi MiMo V2 TTS
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

### TTS Architecture (`lib/tts.ts` + `lib/ttsBrowser.ts`)

```
Browser click → ttsBrowser.ts → POST /api/tts → tts.ts → Xiaomi MiMo V2 API
                                                    ↓
                                              LRU Cache (200 entries, 24h TTL)
                                                    ↓
                                              Pending Dedup Map
                                                    ↓
                                              MiMo API Response (base64 WAV)
                                                    ↓
                                              Cache → Return to Browser
```

| Component | File | Role |
|-----------|------|------|
| Server TTS | `src/lib/tts.ts` | MiMo V2 API call + LRU cache + pending dedup |
| Browser TTS | `src/lib/ttsBrowser.ts` | Client-side: call `/api/tts`, fallback to `speechSynthesis` |
| API Route | `src/app/api/tts/route.ts` | Rate limit + proxy to `synthesizeSpeech` |

MiMo TTS config:
- Model: `mimo-v2-tts` (V2, faster than V2.5)
- Voice: `default_en` (English female)
- Cache: 200 entries, 24h TTL, 5-min cleanup interval
- Timeout: 15s, max 1 retry

### Mobile Guest Redirect (Middleware)

```
Request → Middleware → pathname === '/'?
                         ↓
                    skip-preview param? → pass through
                         ↓
                    UA is mobile? → check token
                         ↓ no token
                    302 → /flywheel-preview.html
```

- `public/flywheel-preview.html` — standalone feature preview page
- `PUBLIC_PATHS` includes `/flywheel-preview.html`
- `skip-preview` query param bypasses redirect (for "受限模式" link)

### XiaoYing OIDC Integration

- `src/lib/xiaoying-oidc.ts` — OIDC PKCE flow (EdDSA via jose)
- `src/lib/xiaoying-oidc-attempts.ts` — DB-backed attempt store (TTL 10min)
- `src/app/api/auth/xiaoying/start/route.ts` — Initiate login
- `src/app/api/auth/xiaoying/callback/route.ts` — Handle callback
- Detection: `src/lib/isXiaoYingWebView.ts` — UA check for "xiaoying"/"小应"

## Deployment

```bash
docker-compose up -d
```

Services: `app` (Next.js on port 3000) + `db` (PostgreSQL 16 on port 5432). Health check at `/api/health`.
