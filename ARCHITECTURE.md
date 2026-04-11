# EZTor (English Vocabulary Learning Platform) - Architecture & Development Guide

## 1. System Overview
EZTor is a modern, full-stack web application designed to help users parse, store, and memorize English vocabulary efficiently. It leverages AI for automated structural parsing of raw text and provides multiple interactive review modes (Flashcards, Smart Dictation, Danmaku). The system supports multi-user isolation with a unique dual-layer caching strategy to optimize LLM API costs.

## 2. Technology Stack
*   **Framework:** Next.js v16.2.1 (App Router, Turbopack)
*   **Language:** TypeScript
*   **Database:** SQLite (local file-based `prisma/dev.db`)
*   **ORM:** Prisma
*   **Authentication:** NextAuth.js (Credentials Provider with stateless SVG CAPTCHA)
*   **Styling:** Tailwind CSS 4 + shadcn/ui components
*   **Animations:** Framer Motion
*   **AI Integration:** OpenAI-compatible API endpoints (configurable via Database)

## 3. Project Structure

```
web/
├── prisma/                     # Database configuration
│   ├── schema.prisma           # Prisma schema definition
│   └── dev.db                  # SQLite database file
│
├── public/                     # Static assets
│   └── sounds/                 # Audio files for dictation
│       ├── correct.mp3
│       └── incorrect.mp3
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   │   ├── analytics/            # Analytics data aggregation
│   │   │   ├── auth/[...nextauth]/   # NextAuth authentication
│   │   │   ├── captcha/              # SVG CAPTCHA generation
│   │   │   ├── config/               # API configuration management
│   │   │   ├── danmaku/              # Danmaku word fetching
│   │   │   ├── dictation/
│   │   │   │   ├── smart/            # Smart dictation algorithm
│   │   │   │   └── update/           # Update dictation results
│   │   │   ├── flashcard/
│   │   │   │   ├── import/           # Import words to flashcard
│   │   │   │   └── public/           # Public word bank access
│   │   │   ├── history/              # Word history management
│   │   │   ├── import-csv/           # CSV import functionality
│   │   │   ├── public-translate/     # Public translation endpoint
│   │   │   ├── public-words/         # Public word bank CRUD
│   │   │   ├── review-groups/        # Review group CRUD
│   │   │   │   └── [id]/             # Dynamic group routes
│   │   │   │       └── words/        # Group word management
│   │   │   ├── sync/                 # Data synchronization
│   │   │   ├── translate/            # AI translation with caching
│   │   │   ├── translate-only/       # Translation without saving
│   │   │   └── translation-records/  # Translation history records
│   │   │
│   │   ├── analytics/          # Admin analytics dashboard
│   │   ├── auth/signin/        # Custom sign-in page
│   │   ├── dictation/          # Smart dictation page
│   │   ├── history/            # Word history page
│   │   ├── public-words/       # Public word bank management
│   │   ├── translation-records/# Translation records viewer
│   │   ├── favicon.ico
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page (flashcard)
│   │
│   ├── components/             # React components
│   │   ├── home/               # Home page components
│   │   │   ├── GuestWordInputCard.tsx  # Guest user input
│   │   │   ├── HomeHeader.tsx          # Home page header
│   │   │   ├── ResultsList.tsx         # Translation results list
│   │   │   ├── TranslateOnlyCard.tsx   # Translate-only mode card
│   │   │   ├── WordInputCard.tsx       # Logged-in user input
│   │   │   └── index.ts                # Component exports
│   │   ├── providers/          # Context providers
│   │   │   └── session-provider.tsx
│   │   ├── ui/                 # UI components
│   │   │   ├── flashcard/      # Flashcard widget
│   │   │   │   └── flashcard-widget.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── danmaku.tsx     # Danmaku animation
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── login-prompt-modal.tsx  # Login prompt dialog
│   │   │   ├── progress.tsx
│   │   │   ├── progress-bar.tsx        # Custom progress bar
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── textarea.tsx
│   │   ├── error-boundary.tsx  # Error boundary component
│   │   ├── mode-toggle.tsx     # Theme toggle
│   │   └── theme-provider.tsx  # Theme provider
│   │
│   ├── lib/                    # Utility libraries
│   │   ├── analytics.ts        # Analytics event tracking
│   │   ├── banManager.ts       # User ban management
│   │   ├── injectionDetector.ts # Prompt injection detection
│   │   ├── prisma.ts           # Prisma client singleton
│   │   ├── qualityScoring.ts   # Word quality scoring algorithm
│   │   ├── rateLimit.ts        # Rate limiting (supports Redis)
│   │   ├── requestDeduplication.ts # Request deduplication
│   │   ├── security.ts         # Security utilities
│   │   ├── storage.ts          # LocalStorage versioned storage
│   │   ├── translationCache.ts # Translation caching utilities
│   │   └── utils.ts            # General utilities
│   │
│   ├── types/                  # TypeScript type definitions
│   │   ├── api.ts              # API response types
│   │   └── next-auth.d.ts      # NextAuth type extensions
│   │
│   └── proxy.ts                # Next.js middleware proxy (replaces middleware.ts)
│
├── deploy/                     # Deployment package
│   ├── .next/                  # Built application
│   ├── prisma/                 # Database for production
│   ├── public/                 # Static assets
│   ├── server.js               # Production server
│   ├── ecosystem.config.js     # PM2 configuration
│   ├── deploy.sh               # Deployment script
│   └── start.sh                # Start script
│
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config             # Tailwind CSS configuration
├── postcss.config.mjs          # PostCSS configuration
├── components.json             # shadcn/ui configuration
├── ecosystem.config.js         # PM2 configuration
└── package.json                # Dependencies and scripts
```

## 4. Core Architecture & Data Flow

### 4.1 Dual-Layer Vocabulary Caching Strategy
To minimize expensive LLM API calls, the parsing system (`/api/translate`) uses a waterfall logic:
1.  **Private Cache (L1):** Check the user's personal `Word` table. If the word exists, return it immediately.
2.  **Public Cache (L2):** Check the global `PublicWord` table. If found, copy the definition to the user's private library without calling the AI.
3.  **LLM Fetch (L3):** Only entirely unseen words are sent to the LLM. The parsed result is then saved to *both* the user's private `Word` table and the global `PublicWord` table for future users.

### 4.2 Dynamic Configuration
Instead of relying solely on `.env` files (which require server restarts to update), the application uses an `ApiConfig` table in the database. The `global` record stores the active `apiKey`, `baseUrl`, and `model`, allowing administrators to hot-swap LLM providers dynamically via the database.

### 4.3 Authentication & Security
*   **Multi-User Isolation:** Every private word, review group, and dictation statistic is strictly tied to a `userId`. Prisma schema enforces unique constraints (e.g., `[word, userId]`) to prevent duplication.
*   **Stateless CAPTCHA:** To prevent bot attacks during registration without needing Redis, the server generates an SVG and an HMAC SHA-256 hash (`text + timestamp + secret`). The client submits the guess alongside the hash for server-side verification.
*   **Security Features:** The system includes prompt injection detection, rate limiting, and user ban management to protect against abuse.

## 5. Key Features & Logic

*   **Smart Dictation (Mixed Batch Algorithm):**
    *   70% Priority: Words with the lowest accuracy or never tested.
    *   30% Time-Decay (Spaced Repetition): Words that haven't been reviewed in the longest time (`updatedAt ASC`).
*   **Review Groups:** Users can create up to 3 custom groups, each holding up to 300 words. These groups act as filters for both the Flashcard Widget and the Dictation Page.
*   **Flashcard Widget:** Fetches random batches of 20 words from either the Public Word Bank (for discovery) or a specific private Review Group.
*   **Danmaku (Bullet Comments):** A background UI element that floats the user's private vocabulary across the screen at randomized intervals and tracks, using `framer-motion` for smooth animation.

## 6. Database Schema (Prisma)
*   **`User`**: Manages credentials, ban status, and relations to words/groups. Includes `isAdmin`, `isBanned`, `banReason`, `banExpiresAt` fields.
*   **`Word`**: The private vocabulary library. Tracks `correctCount`, `incorrectCount`, and `updatedAt` for spaced repetition algorithms.
*   **`PublicWord`**: The global cache. Stripped of user data, acting as a shared dictionary. Includes `qualityScore` and `version` for quality-based updates.
*   **`ReviewGroup` & `ReviewGroupWord`**: Many-to-many relationship enabling users to organize their private words into specific study lists (max 3 groups per user).
*   **`ApiConfig`**: Singleton table for hot-swapping LLM credentials.
*   **`SecurityViolation`**: Records security violations (e.g., prompt injection attempts) for each user.
*   **`IpBan`**: IP-based ban management for blocking malicious actors.
*   **`UserPreference`**: User settings including display preferences, daily goals, theme, and danmaku configuration.
*   **`AuditLog`**: Operation audit trail for tracking user actions (CREATE, UPDATE, DELETE, LOGIN, etc.).
*   **`AnalyticsEvent`**: Real-time analytics events for tracking user behavior.
*   **`DailyStats`**: Aggregated daily statistics (DAU, new users, translations, dictations, errors).
*   **`TranslationRecord`**: Translation history with caching status and response time tracking.

## 7. Important Notes for Subsequent Development

### Next.js 16 Route Handlers
*   **Async Params:** In Next.js 15+, dynamic route parameters (e.g., `[id]`) are passed as Promises. You **must** await them before destructuring in API routes to prevent 500 Internal Server Errors.
    ```typescript
    // Correct:
    export async function GET(req: Request, { params }: { params: { id: string } }) {
      const { id } = await params; 
    }
    ```

### Prisma & SQLite Limitations
*   **No `createMany` Upsert:** SQLite does not support native `createMany` with `skipDuplicates` or upsert functionality in Prisma. Batch inserts must be handled via `Promise.all` mapping over individual `upsert` calls, or by catching `P2002` (Unique Constraint) errors gracefully during `for...of` loops.
*   **Case Sensitivity:** SQLite `findUnique` queries are case-sensitive by default. Always normalize user inputs (e.g., `username.toLowerCase().trim()`) during authentication and registration to prevent duplicate accounts ("User" vs "user").

### UI & Layout Considerations
*   **Responsive Flexbox:** When adding action buttons or tags to cards, always use `flex-wrap` and responsive padding (`px-2 sm:px-4`) to ensure the UI doesn't overflow horizontally on narrow mobile screens (e.g., 667px width).
*   **React Hook Rules:** Ensure early returns (e.g., `if (!isVisible) return null;`) are placed *after* all React Hooks (`useState`, `useEffect`, `useRef`) are declared in a component. Failing to do so will break React's render cycle during Hot Module Replacement.

### Deployment & Build
*   **External Packages:** The `svg-captcha` library relies on local font files. It must be explicitly added to `serverExternalPackages` in `next.config.ts` so Turbopack doesn't bundle it incorrectly and break the path resolution.
*   **Dev Server Artifacts:** Errors like `[next-auth][error][CLIENT_FETCH_ERROR]` or `net::ERR_ABORTED` are common artifacts of Next.js Fast Refresh killing background fetch requests during hot-reloads. They are benign and do not appear in production builds.