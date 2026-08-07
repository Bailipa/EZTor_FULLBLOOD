import sharp from 'sharp'
import { mkdirSync, existsSync, statSync } from 'fs'
import { execSync } from 'child_process'

const SITE_ICON = '/tmp/site-icon.png'
const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

async function sampleBg(img) {
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  // 采样左上角像素决定纯色背景
  const i = 0
  const hasAlpha = info.channels === 4
  if (hasAlpha && data[3] < 20) return '#ffffff'
  return `rgb(${data[0]},${data[1]},${data[2]})`
}

async function main() {
  if (!existsSync(SITE_ICON)) throw new Error('缺少站点图标 /tmp/site-icon.png')
  const src = sharp(SITE_ICON)

  // 1) PWA 常规图标
  await src.clone().resize(192, 192).png().toFile(`${OUT}/icon-192.png`)
  await src.clone().resize(512, 512).png().toFile(`${OUT}/icon-512.png`)

  // 2) maskable：纯色背景 + 居中 72% 图标（预留安全区）
  const bg = await sampleBg(src.clone())
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: bg },
  })
    .composite([{ input: await src.clone().resize(370, 370).png().toBuffer(), gravity: 'center' }])
    .png()
    .toFile(`${OUT}/icon-maskable.png`)
  console.log('PWA icons ok (bg=' + bg + ')')

  // 3) Electron build icon
  mkdirSync('desktop/build', { recursive: true })
  await src.clone().resize(512, 512).png().toFile('desktop/build/icon.png')

  // 4) Android mipmap
  const mipmaps = [
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ]
  for (const [d, s] of mipmaps) {
    const dir = `android/app/src/main/res/mipmap-${d}`
    mkdirSync(dir, { recursive: true })
    await src.clone().resize(s, s).png().toFile(`${dir}/ic_launcher.png`)
  }
  console.log('android mipmaps ok')
}

main()
  .then(async () => {
    // 重建 .icns（macOS iconutil）
    const { execSync } = await import('child_process')
    const ic = 'desktop/build/icon.iconset'
    execSync(`rm -rf ${ic} && mkdir -p ${ic}`)
    for (const s of [16, 32, 64, 128, 256, 512]) {
      execSync(`sips -z ${s} ${s} desktop/build/icon.png --out ${ic}/icon_${s}x${s}.png >/dev/null 2>&1`)
      execSync(`sips -z ${s * 2} ${s * 2} desktop/build/icon.png --out ${ic}/icon_${s}x${s}@2x.png >/dev/null 2>&1`)
    }
    execSync(`iconutil -c icns ${ic} -o desktop/build/icon.icns && rm -rf ${ic}`)
    console.log('electron icns ok')
  })
  .catch((e) => {
    console.error('FAIL', e)
    process.exit(1)
  })
