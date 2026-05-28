# Admin Guide

## Setting Admin Permission

```sql
UPDATE "User" SET "isAdmin" = true WHERE username = 'your_username';
```

Or use `npx prisma studio` → User table → set `isAdmin` to `true`.

## Admin Pages

| Page                | Path                   | Function                                                   |
| ------------------- | ---------------------- | ---------------------------------------------------------- |
| Analytics           | `/analytics`           | User stats, daily trends, feature usage, CSV/JSON export   |
| Public Words        | `/public-words`        | Manage public word library, quality scores                 |
| Translation Records | `/translation-records` | View all translation requests, filter by user/word         |
| LLM Providers       | `/llm-config`          | Configure LLM provider pool (API keys, models, priorities) |
| User Management     | `/users`               | View/ban/manage users                                      |

## Special Pages

| Page                | Path                   | Function                                                   |
| ------------------- | ---------------------- | ---------------------------------------------------------- |
| Mobile Preview      | `/flywheel-preview.html` | Standalone feature preview (mobile guest entry point)    |
| Auth Sign In        | `/auth/signin`         | Login/register page (XiaoYing OIDC + credentials)         |
| Home                | `/`                    | Main page (guest: limited, authenticated: full app)        |
| Dictation           | `/dictation`           | Spelling quiz (综合默写 + 语境填空)                         |
| History             | `/history`             | Word bank management                                       |

## API Endpoints (Admin Only)

| Endpoint                   | Method              | Description                   |
| -------------------------- | ------------------- | ----------------------------- |
| `/api/analytics`           | GET                 | Analytics overview + trends   |
| `/api/public-words`        | GET/POST/PUT/DELETE | Public word library CRUD      |
| `/api/translation-records` | GET/DELETE          | Translation record management |
| `/api/llm-providers`       | GET/POST/PUT/DELETE | LLM provider pool management  |
| `/api/admin/users`         | GET/POST/DELETE     | User administration           |
| `/api/config`              | GET/POST            | Global system configuration   |

## Common Operations

**Add a public word**: Visit `/public-words` → Click "Add Word" → Fill in fields → Save.

**Export analytics**: Visit `/analytics` → Click "Export CSV" or "Export JSON".

**Monitor system**: Check `/analytics` for error counts and recent events.

**Configure LLM providers**: Visit `/llm-config` → Add/manage providers with API keys, base URLs, models, and priorities. The pool auto-failovers on 402/429 errors.

**XiaoYing login button**: Follow official guidelines at `https://developer.xiaoying.life/docs/oidc/button-guidelines`. Use official icon (`/xiaoying-icon.svg`), text "使用小应账号快捷登录", white background with border.

**TTS configuration**: Set `MIMO_API_KEY` in `.env` to enable Xiaomi MiMo TTS. Voice defaults to `default_en` (English female). Cache is 200 entries with 24h TTL.

## Quick Links

| Function            | URL                    |
| ------------------- | ---------------------- |
| Analytics           | `/analytics`           |
| Public Words        | `/public-words`        |
| Translation Records | `/translation-records` |
| LLM Providers       | `/llm-config`          |
| User Management     | `/users`               |
| Sign In             | `/auth/signin`         |
| Home                | `/`                    |
