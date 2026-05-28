# Security Guidelines

## Environment Variables

| Variable              | Security | Notes                                                                  |
| --------------------- | -------- | ---------------------------------------------------------------------- |
| `NEXTAUTH_SECRET`     | High     | JWT signing key, min 32 chars, generate with `openssl rand -base64 32` |
| `DATABASE_URL`        | High     | DB connection string with credentials                                  |
| `LLM_API_KEY`         | High     | LLM API key (env var or database)                                      |
| `MIMO_API_KEY`        | High     | Xiaomi MiMo TTS API key                                                |
| `XIAOYING_OIDC_CLIENT_SECRET` | High | XiaoYing OIDC client secret                                      |
| `NEXTAUTH_URL`        | Low      | Application URL                                                        |
| `NEXT_PUBLIC_APP_URL` | None     | Public URL, exposed to client                                          |
| `MIMO_VOICE`          | None     | TTS voice name, exposed to server only                                 |

## Secret Storage

- **Development**: `.env` file (excluded from Git via `.gitignore`)
- **Production**: Use KMS (AWS Secrets Manager, Azure Key Vault), Kubernetes Secrets, or platform env vars (Vercel, etc.)
- Never commit `.env` or hardcode keys in source code
- Validate env vars at startup via `src/lib/envValidator.ts` → `src/instrumentation.ts`

## Code Best Practices

```typescript
// Correct — use validated env var
import { getRequiredEnvVar } from '@/lib/envValidator'
const apiKey = getRequiredEnvVar('LLM_API_KEY')

// Correct — mask sensitive values in logs
import { maskSensitiveValue } from '@/lib/envValidator'
logger.info({ key: maskSensitiveValue(apiKey) }, 'API configured')

// Wrong — never do this
const apiKey = 'sk-1234567890abcdef'
console.log('Using API key:', process.env.LLM_API_KEY)
```

## Built-in Security Modules

| Module                     | Purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| `lib/csrf.ts`              | CSRF token validation on all non-public API routes     |
| `lib/injectionDetector.ts` | Regex-based prompt injection detection                 |
| `lib/security.ts`          | Input sanitization, LLM special token stripping        |
| `lib/rateLimit.ts`         | Sliding-window rate limiting (30 req/min default)      |
| `lib/banManager.ts`        | Escalating ban system (warning → 1h → 24h → permanent) |
| `lib/deviceId.ts`          | Browser device fingerprinting for abuse prevention     |

## Key Rotation

For `NEXTAUTH_SECRET` rotation: generate a new key, update env vars, restart services. Note this invalidates all existing user sessions.

For `LLM_API_KEY` rotation: update in database or env vars, no session impact.

## Incident Response

If a secret is exposed:

1. Rotate the compromised secret immediately
2. Check audit logs for unauthorized access
3. If committed to Git, use `git filter-branch` or BFG Repo-Cleaner to purge history

## Code Review Checklist

- [ ] No hardcoded keys or passwords
- [ ] Sensitive values use environment variables
- [ ] Logs mask or omit secret values
- [ ] API keys not exposed to client code
- [ ] New env vars added to `.env.example`
