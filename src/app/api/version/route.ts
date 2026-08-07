import { NextResponse } from 'next/server'
import { existsSync, readdirSync, statSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const VERSION_RE = /(\d+)\.(\d+)\.(\d+)/
const INSTALLER_RE = /\.(exe|apk|dmg|AppImage|deb|zip)$/i

// 安装包扩展名（小写，含点，与 path.extname() 输出一致）→ 平台（应用内按平台对照，避免跨平台版本误报）
const PLATFORM_BY_EXT: Record<string, 'android' | 'desktop'> = {
  '.apk': 'android',
  '.exe': 'desktop',
  '.dmg': 'desktop',
  '.appimage': 'desktop',
  '.deb': 'desktop',
  '.zip': 'desktop',
}

function findDownloadsDir(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'downloads'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'downloads'),
  ]
  for (const c of candidates) {
    try {
      if (existsSync(c) && statSync(c).isDirectory()) return c
    } catch {
      // ignore
    }
  }
  return null
}

type Ver = [number, number, number]

function parseVersion(s: string): Ver | null {
  const m = VERSION_RE.exec(s)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
}

function compare(a: Ver, b: Ver): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

/**
 * GET /api/version
 * 扫描 public/downloads 里的安装包文件名，自动解析出最新版本号与安装包清单。
 * 供应用内"是否有更新"判断与下载页使用。
 * latestVersion 为全平台最大版本（兼容旧调用）；platforms 为各平台独立版本，
 * 应用内按自身平台对照，避免安卓发新版导致桌面误报。
 */
export async function GET() {
  const dir = findDownloadsDir()
  if (!dir) return NextResponse.json({ success: true, data: { latestVersion: null, installers: [] } })

  const files = readdirSync(dir).filter((f) => INSTALLER_RE.test(f))
  const entries = files
    .map((f) => ({ file: f, version: parseVersion(f), platform: PLATFORM_BY_EXT[path.extname(f).toLowerCase()] }))
    .filter((e): e is { file: string; version: Ver; platform: 'android' | 'desktop' } => e.version !== null && Boolean(e.platform))

  let latest: { version: Ver; file: string } | null = null
  for (const e of entries) {
    if (!latest || compare(e.version, latest.version) > 0) {
      latest = e
    }
  }

  const platforms: Record<'android' | 'desktop', { latestVersion: string | null; latestInstaller: string | null; installers: string[] }> = {
    android: { latestVersion: null, latestInstaller: null, installers: [] },
    desktop: { latestVersion: null, latestInstaller: null, installers: [] },
  }
  for (const p of Object.keys(platforms) as ('android' | 'desktop')[]) {
    const list = entries.filter((e) => e.platform === p)
    if (list.length === 0) continue
    let lp: { version: Ver; file: string } | null = null
    for (const e of list) {
      if (!lp || compare(e.version, lp.version) > 0) lp = e
    }
    platforms[p] = {
      latestVersion: lp ? lp.version.join('.') : null,
      latestInstaller: lp ? lp.file : null,
      installers: list.map((e) => e.file).sort(),
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      latestVersion: latest ? latest.version.join('.') : null,
      installers: entries.map((e) => e.file).sort(),
      platforms,
    },
  })
}
