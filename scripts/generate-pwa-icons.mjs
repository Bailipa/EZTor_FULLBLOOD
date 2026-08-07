import sharp from 'sharp'
import { mkdirSync } from 'fs'

const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c3aed"/>
      <stop offset="0.55" stop-color="#9333ea"/>
      <stop offset="1" stop-color="#0891b2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <text x="256" y="348" font-family="Arial, Helvetica, sans-serif" font-size="300" font-weight="900" fill="#ffffff" text-anchor="middle">E</text>
  <circle cx="356" cy="150" r="46" fill="#fbbf24"/>
</svg>
`

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size)))
    .png()
    .toFile(`${OUT}/icon-${size}.png`)
  console.log(`generated ${OUT}/icon-${size}.png`)
}

// maskable（带安全边距）
await sharp(Buffer.from(svg(512)))
  .png()
  .toFile(`${OUT}/icon-maskable.png`)
console.log('generated icon-maskable.png')
