import sharp from 'sharp'
import { resolve } from 'node:path'

const svgOriginal = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#18a567"/>
  <path d="M139 169h44l30 181h174l26-126H202" fill="none" stroke="#fff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="240" cy="394" r="22" fill="#fff"/><circle cx="360" cy="394" r="22" fill="#fff"/>
  <path d="M266 113v70M231 148h70" stroke="#d9ff61" stroke-width="26" stroke-linecap="round"/>
</svg>
`.trim()

const svgMaskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#18a567"/>
  <g transform="translate(256 256) scale(0.8) translate(-256 -256)">
    <path d="M139 169h44l30 181h174l26-126H202" fill="none" stroke="#fff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="240" cy="394" r="22" fill="#fff"/><circle cx="360" cy="394" r="22" fill="#fff"/>
    <path d="M266 113v70M231 148h70" stroke="#d9ff61" stroke-width="26" stroke-linecap="round"/>
  </g>
</svg>
`.trim()

const svgApple = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#18a567"/>
  <g transform="translate(256 256) scale(0.88) translate(-256 -256)">
    <path d="M139 169h44l30 181h174l26-126H202" fill="none" stroke="#fff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="240" cy="394" r="22" fill="#fff"/><circle cx="360" cy="394" r="22" fill="#fff"/>
    <path d="M266 113v70M231 148h70" stroke="#d9ff61" stroke-width="26" stroke-linecap="round"/>
  </g>
</svg>
`.trim()

async function generate() {
  const publicDir = resolve('public')

  console.log('Generating PWA icons...')

  await sharp(Buffer.from(svgOriginal))
    .resize(512, 512)
    .png()
    .toFile(resolve(publicDir, 'icon-512.png'))

  await sharp(Buffer.from(svgOriginal))
    .resize(192, 192)
    .png()
    .toFile(resolve(publicDir, 'icon-192.png'))

  await sharp(Buffer.from(svgMaskable))
    .resize(512, 512)
    .png()
    .toFile(resolve(publicDir, 'icon-maskable-512.png'))

  await sharp(Buffer.from(svgMaskable))
    .resize(192, 192)
    .png()
    .toFile(resolve(publicDir, 'icon-maskable-192.png'))

  await sharp(Buffer.from(svgApple))
    .resize(180, 180)
    .png()
    .toFile(resolve(publicDir, 'apple-touch-icon.png'))

  await sharp(Buffer.from(svgOriginal))
    .resize(32, 32)
    .png()
    .toFile(resolve(publicDir, 'favicon-32x32.png'))

  await sharp(Buffer.from(svgOriginal))
    .resize(16, 16)
    .png()
    .toFile(resolve(publicDir, 'favicon-16x16.png'))

  console.log('All icons generated successfully!')
}

generate().catch((err) => {
  console.error(err)
  process.exit(1)
})
