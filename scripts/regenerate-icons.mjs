import sharp from 'sharp'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const sourcePath = 'public/icons/brand-master.png'
const traySourcePath = 'public/icons/brand-mark-tray.svg'
const source = readFileSync(sourcePath)
const traySource = readFileSync(traySourcePath)
const backgroundSample = await sharp(source).extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer()
const background = { r: backgroundSample[0], g: backgroundSample[1], b: backgroundSample[2], alpha: 1 }

async function png(input, size, ensureAlpha = false) {
  const resized = sharp(input).resize(size, size)
  return (ensureAlpha ? resized.ensureAlpha() : resized).png().toBuffer()
}

async function roundedPng(input, size) {
  const radius = Math.max(2, Math.round(size * 0.2))
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${radius}" fill="white"/></svg>`,
  )
  return sharp(input)
    .resize(size, size)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function writePng(input, size, path) {
  await sharp(await roundedPng(input, size)).toFile(path)
}

async function writeIco(path, sizes) {
  const images = await Promise.all(sizes.map(async (size) => ({ size, data: await roundedPng(source, size) })))
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16
    header.writeUInt8(size === 256 ? 0 : size, entry)
    header.writeUInt8(size === 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(data.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += data.length
  })
  writeFileSync(path, Buffer.concat([header, ...images.map(({ data }) => data)]))
}

async function writeIcos() {
  await writeIco('public/favicon.ico', [16, 24, 32, 48, 64, 128, 256])
  await writeIco('public/eztor_favicon.ico', [16, 24, 32, 48, 64, 128, 256])
  await writeIco('desktop/build/icon.ico', [16, 24, 32, 48, 64, 128, 256])
  await writeIco('desktop/tray-icon.ico', [16, 24, 32, 48, 64])
}

async function main() {
  if (process.argv[2] === '--ico-only') {
    await writeIcos()
    return
  }

  mkdirSync('public/icons', { recursive: true })

  await writePng(source, 192, 'public/icons/icon-192.png')
  await writePng(source, 512, 'public/icons/icon-512.png')
  const safeIcon = await png(source, 410)
  await sharp({ create: { width: 512, height: 512, channels: 4, background } })
    .composite([{ input: safeIcon, gravity: 'center' }])
    .png()
    .toFile('public/icons/icon-maskable.png')

  await writePng(source, 512, 'desktop/icon-512.png')
  await writePng(source, 512, 'desktop/build/icon.png')

  const traySizes = [
    ['desktop/tray-icon-16.png', 16],
    ['desktop/tray-icon-32.png', 32],
    ['desktop/tray-icon.png', 32],
    ['desktop/tray-icon@2x.png', 64],
  ]
  for (const [path, size] of traySizes) await writePng(source, size, path)

  for (const [path, size] of [['desktop/tray-icon-mac.png', 32], ['desktop/tray-icon-mac@2x.png', 64]]) {
    await sharp(traySource).resize(size, size).png().toFile(path)
  }
  await writeIcos()

  const mipmaps = [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]
  for (const [density, size] of mipmaps) {
    await writePng(source, size, `android/app/src/main/res/mipmap-${density}/ic_launcher.png`)
  }

  mkdirSync('desktop/build/icon.iconset', { recursive: true })
  const iconset = 'desktop/build/icon.iconset'
  for (const size of [16, 32, 128, 256, 512]) {
    await writePng(source, size, `${iconset}/icon_${size}x${size}.png`)
    await writePng(source, size * 2, `${iconset}/icon_${size}x${size}@2x.png`)
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', 'desktop/build/icon.icns'])
  rmSync(iconset, { recursive: true, force: true })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
