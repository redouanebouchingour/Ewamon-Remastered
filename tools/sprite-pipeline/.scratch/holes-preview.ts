import sharp from 'sharp';
import { clearEnclosedWhite } from '../src/alpha.js';
const [out, ids, mode] = process.argv.slice(2);
const C = 512; const tiles: sharp.OverlayOptions[] = []; let row = 0;
for (const id of ids!.split(',')) { for (const [col, side] of (['front', 'back'] as const).entries()) {
  const { data, info } = await sharp(`../../assets-src/creatures/${side}/${id}(${side}).png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { width: info.width, height: info.height, data: new Uint8Array(data) };
  const before = img.data.slice();
  const cleared = clearEnclosedWhite(img);
  console.log(id, side, cleared);
  const d = img.data;
  for (let p = 0; p < d.length; p += 4) {
    if (mode === 'mark' && before[p + 3]! > 0 && d[p + 3] === 0) { d[p] = 255; d[p + 1] = 0; d[p + 2] = 0; d[p + 3] = 255; }
    else if (d[p + 3] === 0) { d[p] = 255; d[p + 1] = 0; d[p + 2] = 255; d[p + 3] = 255; }
  }
  tiles.push({ input: await sharp(Buffer.from(d), { raw: { width: info.width, height: info.height, channels: 4 } }).resize(C, C, { kernel: 'nearest' }).png().toBuffer(), left: col * C, top: row * C });
} row++; }
await sharp({ create: { width: 2 * C, height: row * C, channels: 4, background: '#000' } }).composite(tiles).png().toFile(out!);
