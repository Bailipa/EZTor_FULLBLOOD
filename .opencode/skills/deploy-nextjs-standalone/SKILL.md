---
name: deploy-nextjs-standalone
description: Deployment guide for Next.js standalone output mode — build, static files, PM2, nginx proxy
---

# Deploy: Next.js Standalone Mode

This project uses `output: 'standalone'` in `next.config.ts`. The build output is at `.next/standalone/server.js`.

## Build Checklist

```bash
# 1. Build
npm run build

# 2. Static files MUST be copied manually
cp -r .next/static .next/standalone/.next/static

# 3. Copy .env
cp .env .next/standalone/.env

# 4. Start
pm2 start .next/standalone/server.js --name cet4-web
```

**Never forget step 2.** Without it, `/_next/static/` URLs return 404, causing the browser to reject CSS/JS with MIME type errors.

## PM2

```bash
pm2 status                    # check if running
pm2 logs cet4-web --lines 20  # view recent logs
pm2 restart cet4-web          # restart
pm2 stop cet4-web             # stop
pm2 delete cet4-web           # remove from list
```

## Build Troubleshooting

**TypeScript error in `fix-word-userid.ts`** — This is a one-off script, not app code. Fix the error or exclude it from `tsconfig.json`:

```bash
# Fix: add updatedAt
sed -i 's|data: { name: mapping.group, userId: correctId }|data: { name: mapping.group, userId: correctId, updatedAt: new Date() }|' fix-word-userid.ts

# Or exclude from tsconfig
sed -i 's|"scripts"|"scripts", "fix-word-userid.ts"|' tsconfig.json
```

**Clean rebuild** — When in doubt, start fresh:
```bash
rm -rf .next && npm run build && cp -r .next/static .next/standalone/.next/static
```

## nginx Proxy

The server uses nginx (BT-Panel) as reverse proxy. The vhost config at `/www/server/panel/vhost/nginx/114.55.58.90.conf` includes proxy configs from `/www/server/panel/vhost/nginx/proxy/114.55.58.90/*.conf`.

### Critical: Disable proxy_cache

BT-Panel default `proxy.conf` enables global proxy caching (`proxy_cache cache_one`). This caches ALL proxied responses including HTML pages, ignoring the backend's `Cache-Control: no-store`. **Always add `proxy_cache off;`** in the proxy location block:

```nginx
location ^~ /
{
    proxy_pass http://127.0.0.1:3000/;
    proxy_cache off;   # ← REQUIRED for dynamic sites
    ...
}
```

After enabling/disabling cache, clear the old cache:
```bash
rm -rf /www/server/nginx/proxy_cache_dir/*
nginx -t && nginx -s reload
```

### Debugging Nginx cache issues

If curl to `localhost:3000` shows new content but browser shows old content, Nginx is caching:
```bash
# Compare: direct vs proxied
curl -sI http://localhost:3000/ | grep -i x-build-id
curl -sI https://eztor.dogeggcode.cyou/ | grep -i x-build-id
```

### Reload nginx after changes

```bash
nginx -t && nginx -s reload
```

### Watch for duplicate location blocks

BT-Panel proxy directory may have multiple `.conf` files. The main config `include`s all of them. If two files define the same location, nginx will fail:
```bash
ls /www/server/panel/vhost/nginx/proxy/114.55.58.90/
# Only one file should define "location ^~ /"
```

## Deployment Verification

Always verify deployment in this order. If any step fails, stop and fix before proceeding.

### 1. Server-side: BUILD_ID matches

```bash
cat /www/wwwroot/114.55.58.90/.next/standalone/BUILD_ID.txt
```

### 2. Server-side: Next.js responds correctly (bypass Nginx)

```bash
curl -sI http://localhost:3000/ | grep -i x-build-id
curl -s http://localhost:3000/ | grep -o 'data-build-id="[^"]*"'
```

Both must match the BUILD_ID file. If they don't, tarball extraction failed or PM2 didn't restart.

### 3. PM2 status

```bash
pm2 list                          # uptime should be recent
pm2 describe cet4-web             # script path, restarts, memory
pm2 logs cet4-web --lines 20      # check for startup errors
```

### 4. Browser verification (after clearing site data)

```js
// DevTools Console
document.documentElement.dataset.buildId   // must match BUILD_ID
fetch('/').then(r => console.log(r.headers.get('X-Build-Id')))  // must match BUILD_ID
```

If step 2 passes but browser shows old version → Nginx cache. Redeploy alone won't fix it.

## Build ID Infrastructure

The project embeds a build timestamp for verification:

| Mechanism | File | Visible |
|-----------|------|---------|
| `data-build-id` attribute | `src/app/layout.tsx` | `<html>` tag in DevTools |
| `X-Build-Id` HTTP header | `next.config.ts` headers() | Network tab response headers |
| `BUILD_ID.txt` file | `.next/standalone/BUILD_ID.txt` | Server filesystem |

The BUILD_ID is set by `deploy.sh` via `export NEXT_PUBLIC_BUILD_ID=$(date +%Y%m%d_%H%M%S)` before building. It is hard-coded into the build output and does not depend on runtime environment variables.
