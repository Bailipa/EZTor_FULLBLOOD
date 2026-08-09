// 从安装包文件名解析平台与版本，供下载记录与下载页使用。

const VERSION_RE = /(\d+)\.(\d+)\.(\d+)/
const INSTALLER_EXT_RE = /\.(exe|apk|dmg|appimage|deb|zip)$/i

const EXT_PLATFORM: Record<string, string> = {
  '.apk': 'android',
  '.exe': 'windows',
  '.dmg': 'mac',
  '.zip': 'mac',
  '.appimage': 'linux',
  '.deb': 'linux',
}

export interface DownloadClassification {
  platform: string
  version: string | null
}

export function isInstallerFile(fileName: string): boolean {
  return INSTALLER_EXT_RE.test(fileName)
}

export function classifyDownload(fileName: string): DownloadClassification | null {
  if (!isInstallerFile(fileName)) return null
  const lower = fileName.toLowerCase()
  const ext = INSTALLER_EXT_RE.exec(lower)?.[0].toLowerCase()
  const platform = ext ? EXT_PLATFORM[ext] : undefined
  if (!platform) return null
  const version = VERSION_RE.exec(fileName)?.[0] ?? null
  return { platform, version }
}
