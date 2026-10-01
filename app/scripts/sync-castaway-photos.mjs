/**
 * One-shot helper: refresh Season 51 castaway portraits from survivorstatsdb
 * into app/public/castaways/. Personal / non-commercial use only.
 *
 * Usage: node scripts/sync-castaway-photos.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'castaways')
const VERSION = '1.0.19'
const NAME_TO_SLUG = {
  Aaliyah: 'aaliyah',
  Alexis: 'alexis',
  Ana: 'ana',
  Brady: 'brady',
  Carter: 'carter',
  Cristian: 'cristian',
  Danny: 'danny',
  Devin: 'devin',
  Eric: 'eric',
  Jelly: 'angelica',
  Jenna: 'jenna',
  Kristin: 'kristin',
  Lewis: 'lewis',
  Linnea: 'linnea',
  Maggie: 'maggie',
  Mike: 'mike',
  Ori: 'ori',
  Patt: 'patt',
  Rob: 'rob',
  Sharonda: 'sharonda',
  'Thien An': 'an',
}

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json,image/png,image/*,*/*',
  Referer: 'https://www.survivorstatsdb.com/season?vs=US51&tab=tab-castaways',
}

async function getJson(url) {
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`${url} -> ${response.status}`)
  return response.json()
}

async function download(url, dest) {
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`${url} -> ${response.status}`)
  await writeFile(dest, Buffer.from(await response.arrayBuffer()))
}

await mkdir(OUT, { recursive: true })
const castaways = await getJson(
  `https://www.survivorstatsdb.com/data/castaways.json?v=${VERSION}`,
)
const byId = new Map(castaways.map((row) => [row.id, row]))
const seasonRows = (
  await getJson(`https://www.survivorstatsdb.com/data/castawaySeasonTbl.json?v=${VERSION}`)
).filter((row) => row.vs === 'US51')

const manifest = []
for (const row of seasonRows.sort((a, b) => a.name.localeCompare(b.name))) {
  const slug = NAME_TO_SLUG[row.name]
  if (!slug) {
    console.warn(`skip unmapped ${row.name}`)
    continue
  }
  const image = byId.get(row.id)?.image ?? row.image_small
  if (!image) {
    console.warn(`skip missing image ${row.name}`)
    continue
  }
  const dest = path.join(OUT, `${slug}.png`)
  await download(`https://www.survivorstatsdb.com/${image.replace(/^\//, '')}`, dest)
  console.log(`ok ${row.name} -> ${slug}.png`)
  manifest.push({
    name: row.name,
    slug,
    source: image,
    path: `/castaways/${slug}.png`,
  })
}

await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`wrote ${manifest.length} portraits`)
