import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

const cspProduction = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://api.xiaoying.life",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "media-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]

const cspDevelopment = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://api.xiaoying.life",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https:",
  "media-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['svg-captcha'],
  outputFileTracingExcludes: {
    // process.cwd() 动态 fs 路径会触发整项目追踪；排除非运行时目录，
    // 避免把源码/设计稿/构建产物打包进 standalone。
    '/*': [
      './src/**',
      './android/**',
      './desktop/**',
      './data/**',
      './LB/**',
      './logs/**',
      './vendor/**',
      './scripts/**',
      './docs/**',
      './eztor-promo/**',
      './*.docx',
      './yanshitupian.png',
      './screenshot.png',
      './captcha.png',
      './flywheel-poster.html',
      './dev.db',
      './package-lock.json',
      './next.config.ts',
      './tsconfig.json',
      './tsconfig.test.json',
      './tsconfig.tsbuildinfo',
      './components.json',
      './postcss.config.mjs',
      './eslint.config.mjs',
      './vitest.config.ts',
      './AGENTS.md',
      './README.md',
      './README.zh-CN.md',
      './WORK_REPORT.md',
      './LICENSE',
      './docker-compose.yml',
      './Dockerfile',
      './docker-entrypoint.sh',
      './ecosystem.config.js',
      './start.sh',
      './deploy-full.sh',
      './deploy.sh',
      './--width',
    ],
  },
  experimental: {
    // Avoid spawning a separate Node process for TypeScript checks on Windows,
    // which can fail with `spawn EPERM` in some environments.
    workerThreads: true,
    // Tree-shake heavy re-export packages by rewriting to subpath imports
    optimizePackageImports: ['framer-motion', 'lucide-react', 'radix-ui'],
  },
  async headers() {
    const csp = (isProduction ? cspProduction : cspDevelopment).join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Build-Id',
            value: BUILD_ID,
          },
          ...(isProduction
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ]
  },
}

export default nextConfig
