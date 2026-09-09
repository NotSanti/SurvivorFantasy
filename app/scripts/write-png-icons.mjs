import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

function crc32(bytes) {
  let crc = ~0
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([length, crcInput, crc])
}

function writePng(fileName, size, { padded }) {
  const margin = padded ? Math.round(size * 0.18) : Math.round(size * 0.08)
  const rows = []
  for (let y = 0; y < size; y += 1) {
    const row = [0]
    for (let x = 0; x < size; x += 1) {
      const inMark =
        x >= margin &&
        x < size - margin &&
        y >= margin &&
        y < size - margin
      if (inMark) {
        row.push(0x14, 0x21, 0x1c, 0xff)
        const cx = size / 2
        const cy = size * 0.58
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy < (size * 0.16) ** 2) {
          row.splice(row.length - 4, 4, 0xc7, 0x92, 0x4a, 0xff)
        }
      } else {
        row.push(0x14, 0x21, 0x1c, 0xff)
      }
    }
    rows.push(Buffer.from(row))
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(path.join(outDir, fileName), png)
}

writePng('icon-192.png', 192, { padded: false })
writePng('icon-512.png', 512, { padded: false })
writePng('icon-maskable-192.png', 192, { padded: true })
writePng('icon-maskable-512.png', 512, { padded: true })
writePng('apple-touch-icon.png', 180, { padded: false })
