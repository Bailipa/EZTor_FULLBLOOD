# EZTor — Vocabulary Learning Platform

A full-stack Next.js application for English vocabulary learning, powered by LLMs.

## Tech Stack

| Layer      | Technology                                    |
| ---------- | --------------------------------------------- |
| Framework  | Next.js 16 (App Router)                       |
| Language   | TypeScript                                    |
| Database   | PostgreSQL (Prisma ORM)                       |
| Auth       | NextAuth.js (JWT)                             |
| UI         | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| Logging    | Pino                                          |
| Testing    | Vitest                                        |
| Deployment | Docker + docker-compose                       |

## Quick Start

```bash
cp .env.example .env
# Edit .env with your values

npm install
npx prisma generate
npx prisma migrate deploy
npm run dev        # → http://localhost:3000
```

## Key Features

- **Word Translation** — LLM-powered English-Chinese translation with POS, phonetics, examples, countability marking
- **Translate Only** — Quick translation without saving, 10 free uses/day; supports custom API keys
- **Word Bank** — Save words, create review groups, import CET-4/CET-6 vocabulary
- **Dictation / Review** — Smart review system with grouping, scoring
- **TTS** — Text-to-speech via Edge TTS
- **Danmaku Overlay** — Floating word display for passive learning
- **Infinite Tic-Tac-Toe** — Casual game widget
- **Admin Dashboard** — Analytics, public word library, translation records, user management, LLM provider pool
- **Security** — CSRF protection, prompt injection detection, rate limiting, ban escalation, device fingerprinting

## Project Structure

```
src/
├── app/            # Next.js App Router (pages + API routes)
│   ├── api/        # REST API endpoints
│   ├── analytics/  # Admin analytics dashboard
│   ├── dictation/  # Dictation / review
│   ├── history/    # Translation history
│   ├── game/       # Tic-Tac-Toe game
│   └── ...
├── components/     # React components (UI, vocabulary, share, review-group)
├── lib/            # Utilities (logger, rateLimiter, banManager, llmPool, cache, security)
├── services/       # Business logic (TranslationService, CacheService, StreamHandler)
└── __tests__/      # Unit tests
```

## Documentation

| Document                                         | Description                                       |
| ------------------------------------------------ | ------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)     | System architecture, design patterns, performance |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)       | Admin operations manual                           |
| [docs/SECURITY.md](docs/SECURITY.md)             | Security guidelines and secret management         |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Database backup and restore                       |
| [prisma/schema.prisma](prisma/schema.prisma)     | Data model definitions                            |
| [AGENTS.md](AGENTS.md)                           | AI coding agent instructions                      |

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
