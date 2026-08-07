import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DOWNLOAD_PASSWORD = process.env.DOWNLOAD_PASSWORD || 'bailipa6'
const TOKEN = Buffer.from(DOWNLOAD_PASSWORD).toString('base64')

export async function POST(req: Request) {
  let password = ''
  try {
    const body = await req.json()
    password = typeof body?.password === 'string' ? body.password : ''
  } catch {
    // 非法 body 按空密码处理
  }

  if (!password || password !== DOWNLOAD_PASSWORD) {
    return NextResponse.json({ success: false, error: '下载密码错误' }, { status: 403 })
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set('dl_pass', TOKEN, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 1 天
  })
  return res
}
