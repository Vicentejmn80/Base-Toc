import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(data.length, 0)
  header.write(type, 4)
  const crcInput = Buffer.concat([header.subarray(4, 8), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([header, data, crc])
}

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1)
    raw[row] = 0
    pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function fillRect(pixels, width, x0, y0, w, h, color) {
  const x1 = Math.max(0, Math.floor(x0))
  const y1 = Math.max(0, Math.floor(y0))
  const x2 = Math.min(width, Math.ceil(x0 + w))
  const y2 = Math.min(width, Math.ceil(y0 + h))
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) {
      const i = (y * width + x) * 4
      pixels[i] = color[0]
      pixels[i + 1] = color[1]
      pixels[i + 2] = color[2]
      pixels[i + 3] = color[3]
    }
  }
}

function roundedRect(pixels, size, inset, radius, color) {
  const x0 = inset
  const y0 = inset
  const x1 = size - inset
  const y1 = size - inset
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const dx = x < x0 + radius ? x0 + radius - x : x > x1 - radius ? x - (x1 - radius) : 0
      const dy = y < y0 + radius ? y0 + radius - y : y > y1 - radius ? y - (y1 - radius) : 0
      if (dx * dx + dy * dy > radius * radius) continue
      const i = (y * size + x) * 4
      pixels[i] = color[0]
      pixels[i + 1] = color[1]
      pixels[i + 2] = color[2]
      pixels[i + 3] = color[3]
    }
  }
}

function drawN(pixels, size, inset) {
  const inner = size - inset * 2
  const left = inset + inner * 0.22
  const top = inset + inner * 0.18
  const height = inner * 0.64
  const stroke = inner * 0.11
  const right = inset + inner * 0.78 - stroke
  const white = [255, 255, 255, 255]
  fillRect(pixels, size, left, top, stroke, height, white)
  fillRect(pixels, size, right, top, stroke, height, white)
  const steps = Math.ceil(height)
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1)
    fillRect(pixels, size, left + t * (right - left), top + t * (height - stroke * 0.6), stroke * 1.05, stroke * 0.7, white)
  }
}

function makeIcon(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4)
  if (maskable) {
    fillRect(pixels, size, 0, 0, size, size, [17, 24, 39, 255])
    drawN(pixels, size, size * 0.18)
  } else {
    roundedRect(pixels, size, 0, size * 0.22, [17, 24, 39, 255])
    drawN(pixels, size, 0)
  }
  return encodePng(size, size, pixels)
}

writeFileSync(join(outDir, 'icon-192.png'), makeIcon(192, false))
writeFileSync(join(outDir, 'icon-512.png'), makeIcon(512, false))
writeFileSync(join(outDir, 'icon-maskable-192.png'), makeIcon(192, true))
writeFileSync(join(outDir, 'icon-maskable-512.png'), makeIcon(512, true))
writeFileSync(join(outDir, 'apple-touch-icon.png'), makeIcon(180, false))
console.log('PWA icons written to', outDir)
