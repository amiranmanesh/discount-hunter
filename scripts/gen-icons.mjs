#!/usr/bin/env node
/**
 * Generates the app icons as PNGs with no image dependencies.
 *
 * The artwork is a rounded square in the Snapp orange gradient holding a
 * magnifier whose lens contains a percent sign — "hunt for the discount" in one
 * glyph. Everything is rasterised here (signed distance fields, supersampled
 * coverage, a hand-rolled PNG encoder) so CI can reproduce the icons byte for
 * byte without native modules or a browser.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

/** 192 and 512 are what the web app manifest asks for; the rest are favicons. */
const OUTPUTS = [{ dir: path.join(root, 'public/icons'), sizes: [32, 96, 192, 512] }];

const SUPERSAMPLE = 4;

/** Background gradient, along the top-left → bottom-right diagonal. */
const GRADIENT = [
  { at: 0, color: [255, 138, 0] }, // Snapp orange
  { at: 0.55, color: [255, 95, 0] },
  { at: 1, color: [239, 64, 86] }, // Digikala red
];
const INK = [255, 255, 255];

/* ------------------------------------------------------------------ *
 * Signed distance fields, in a 128-unit design space. Negative inside.
 * ------------------------------------------------------------------ */

function roundedBox(x, y, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(x - cx) - (halfW - radius);
  const qy = Math.abs(y - cy) - (halfH - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function circle(x, y, cx, cy, radius) {
  return Math.hypot(x - cx, y - cy) - radius;
}

/** A ring of the given stroke width, centred on `radius`. */
function ring(x, y, cx, cy, radius, width) {
  return Math.abs(Math.hypot(x - cx, y - cy) - radius) - width / 2;
}

/** A round-capped segment of the given thickness. */
function capsule(x, y, ax, ay, bx, by, width) {
  const px = x - ax;
  const py = y - ay;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.min(Math.max((px * dx + py * dy) / (dx * dx + dy * dy), 0), 1);
  return Math.hypot(px - dx * t, py - dy * t) - width / 2;
}

/** The lens, its handle and the percent sign inside it, unioned. */
function inkDistance(x, y) {
  const lens = ring(x, y, 56, 55, 27, 9);
  const handle = capsule(x, y, 76, 76, 99, 99, 9);
  const dotTop = circle(x, y, 47, 46, 6);
  const dotBottom = circle(x, y, 65, 64, 6);
  const slash = capsule(x, y, 66, 44, 46, 66, 7);
  return Math.min(lens, handle, dotTop, dotBottom, slash);
}

function plateDistance(x, y) {
  return roundedBox(x, y, 64, 64, 60, 60, 30);
}

/* ------------------------------------------------------------------ *
 * Rasterising
 * ------------------------------------------------------------------ */

function gradientAt(x, y) {
  // Project onto the diagonal and normalise to 0..1.
  const t = Math.min(Math.max((x + y) / 256, 0), 1);
  let lower = GRADIENT[0];
  let upper = GRADIENT[GRADIENT.length - 1];
  for (let i = 0; i < GRADIENT.length - 1; i += 1) {
    if (t >= GRADIENT[i].at && t <= GRADIENT[i + 1].at) {
      lower = GRADIENT[i];
      upper = GRADIENT[i + 1];
      break;
    }
  }
  const span = upper.at - lower.at || 1;
  const k = (t - lower.at) / span;
  return [0, 1, 2].map((c) => Math.round(lower.color[c] + (upper.color[c] - lower.color[c]) * k));
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const step = 128 / size;
  const sub = step / SUPERSAMPLE;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let plateHits = 0;
      let inkHits = 0;
      let gr = 0;
      let gg = 0;
      let gb = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const x = px * step + (sx + 0.5) * sub;
          const y = py * step + (sy + 0.5) * sub;
          const insidePlate = plateDistance(x, y) < 0;
          if (!insidePlate) continue;
          plateHits += 1;
          const [r, g, b] = gradientAt(x, y);
          gr += r;
          gg += g;
          gb += b;
          if (inkDistance(x, y) < 0) inkHits += 1;
        }
      }

      const offset = (py * size + px) * 4;
      if (plateHits === 0) continue; // fully transparent corner

      const alpha = plateHits / samples;
      const inkCoverage = inkHits / plateHits;
      const base = [gr / plateHits, gg / plateHits, gb / plateHits];
      for (let c = 0; c < 3; c += 1) {
        pixels[offset + c] = Math.round(base[c] + (INK[c] - base[c]) * inkCoverage);
      }
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }
  return pixels;
}

/* ------------------------------------------------------------------ *
 * A minimal PNG encoder (RGBA8, no interlacing)
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10-12: compression, filter and interlace methods, all zero.

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */

const cache = new Map();
for (const output of OUTPUTS) {
  await mkdir(output.dir, { recursive: true });
  for (const size of output.sizes) {
    if (!cache.has(size)) cache.set(size, encodePng(render(size), size));
    const file = path.join(output.dir, `icon-${size}.png`);
    await writeFile(file, cache.get(size));
    console.log(`✓ ${path.relative(root, file)}`);
  }
}
