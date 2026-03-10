/**
 * Generates assets/splash.png as a solid #07070F rectangle (1284x2778).
 * No external dependencies — uses Node.js built-in zlib.
 *
 * Run: node scripts/gen-splash.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([t, data]);
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

async function main() {
  const width = 1284, height = 2778;
  const [r, g, b] = [0x07, 0x07, 0x0f];

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const row = width * 3;
  const raw = Buffer.allocUnsafe((row + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (row + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const o = y * (row + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }

  const compressed = await new Promise((res, rej) =>
    zlib.deflate(raw, { level: 9 }, (e, d) => e ? rej(e) : res(d))
  );

  const out = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  const dest = path.join(__dirname, '..', 'assets', 'splash.png');
  fs.writeFileSync(dest, out);
  console.log(`✓ splash.png written (${width}x${height}, #07070F)`);
}

main().catch(console.error);
