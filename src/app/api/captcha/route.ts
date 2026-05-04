import { NextResponse } from 'next/server'
import svgCaptcha from 'svg-captcha'
import crypto from 'crypto'
import { getRequiredEnvVar } from '@/lib/envValidator'
import { logger } from '@/lib/logger'

const SECRET_KEY = getRequiredEnvVar('NEXTAUTH_SECRET')

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, 'data-blocked=')
    .replace(/<iframe/gi, '<disabled-iframe')
    .replace(/<object/gi, '<disabled-object')
    .replace(/<embed/gi, '<disabled-embed')
    .replace(/<animate\b[^>]*\bon\w+\s*=/gi, '<animate data-blocked=')
    .replace(/<set\b[^>]*\bon\w+\s*=/gi, '<set data-blocked=')
    .replace(/<handler\b/gi, '<disabled-handler ')
    .replace(/<listener\b/gi, '<disabled-listener ')
}

function svgToBase64(svg: string): string {
  const sanitized = sanitizeSvg(svg)
  const base64 = Buffer.from(sanitized).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

export async function GET() {
  try {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      color: true,
      background: '#f0f0f0',
      width: 150,
      height: 50,
    })

    const text = captcha.text.toLowerCase()
    const timestamp = Date.now()
    const dataToHash = `${text}:${timestamp}`
    const hash = crypto.createHmac('sha256', SECRET_KEY).update(dataToHash).digest('hex')

    const imageBase64 = svgToBase64(captcha.data)

    return NextResponse.json(
      {
        image: imageBase64,
        hash: hash,
        timestamp: timestamp,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    )
  } catch (err: unknown) {
    logger.error({ err }, 'CAPTCHA Generation Error:')
    return NextResponse.json({ error: 'Failed to generate captcha' }, { status: 500 })
  }
}
