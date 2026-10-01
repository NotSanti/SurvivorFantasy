import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'icons')
const svgPath = path.join(outDir, 'icon.svg')
mkdirSync(outDir, { recursive: true })

const svgMarkup = readFileSync(svgPath, 'utf8')

const targets = [
  { fileName: 'icon-192.png', size: 192, padRatio: 0 },
  { fileName: 'icon-512.png', size: 512, padRatio: 0 },
  { fileName: 'icon-maskable-192.png', size: 192, padRatio: 0.18 },
  { fileName: 'icon-maskable-512.png', size: 512, padRatio: 0.18 },
  { fileName: 'apple-touch-icon.png', size: 180, padRatio: 0 },
]

function pageHtml(size, padRatio) {
  const pad = Math.round(size * padRatio)
  const inner = size - pad * 2
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: ${size}px;
        height: ${size}px;
        background: #120e0c;
        overflow: hidden;
      }
      .frame {
        box-sizing: border-box;
        width: ${size}px;
        height: ${size}px;
        padding: ${pad}px;
        background: #120e0c;
      }
      svg {
        display: block;
        width: ${inner}px;
        height: ${inner}px;
      }
    </style>
  </head>
  <body>
    <div class="frame">${svgMarkup}</div>
  </body>
</html>`
}

const browser = await chromium.launch()
try {
  for (const target of targets) {
    const page = await browser.newPage({
      viewport: { width: target.size, height: target.size },
      deviceScaleFactor: 1,
    })
    await page.setContent(pageHtml(target.size, target.padRatio), {
      waitUntil: 'load',
    })
    const buffer = await page.screenshot({ type: 'png', omitBackground: false })
    writeFileSync(path.join(outDir, target.fileName), buffer)
    await page.close()
    console.log(`wrote ${target.fileName}`)
  }
} finally {
  await browser.close()
}
