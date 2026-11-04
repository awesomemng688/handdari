import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
for (const size of [192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const rect = (x, y, a, b, c, d) => x >= a && x <= c && y >= b && y <= d;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size; let color = [91, 49, 108];
    if (rect(u, v, .20, .18, .80, .82) && !rect(u, v, .207, .187, .793, .813)) color = [209, 177, 125];
    if (rect(u, v, .32, .30, .38, .70) || rect(u, v, .62, .30, .68, .70) || rect(u, v, .38, .475, .62, .525) || rect(u, v, .285, .285, .415, .31) || rect(u, v, .585, .285, .715, .31) || rect(u, v, .285, .69, .415, .715) || rect(u, v, .585, .69, .715, .715)) color = [255, 255, 255];
    const offset = y * (size * 4 + 1) + 1 + x * 4; raw[offset] = color[0]; raw[offset + 1] = color[1]; raw[offset + 2] = color[2]; raw[offset + 3] = 255;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(new URL('../public/icon-' + size + '.png', import.meta.url), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
