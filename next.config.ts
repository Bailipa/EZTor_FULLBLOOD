import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'

const cspProduction = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]

const cspDevelopment = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['svg-captcha'],
  experimental: {
    // Avoid spawning a separate Node process for TypeScript checks on Windows,
    // which can fail with `spawn EPERM` in some environments.
    workerThreads: true,
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
