// Renders the PNG app icons from the SVG sources in /assets.  Usage: npm run icons
import { copyFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const path = (p) => fileURLToPath(new URL(p, import.meta.url))

const rounded = await readFile(path('../assets/icon.svg'))
const fullBleed = await readFile(path('../assets/icon-maskable.svg'))

const icons = [
  [rounded, 192, 'pwa-192x192.png'],
  [rounded, 512, 'pwa-512x512.png'],
  [fullBleed, 512, 'maskable-icon-512x512.png'],
  [fullBleed, 180, 'apple-touch-icon-180x180.png'],
]

for (const [svg, size, name] of icons) {
  await sharp(svg, { density: 144 }).resize(size, size).png().toFile(path(`../public/${name}`))
  console.log(`public/${name}`)
}

await copyFile(path('../assets/icon.svg'), path('../public/favicon.svg'))
console.log('public/favicon.svg')
