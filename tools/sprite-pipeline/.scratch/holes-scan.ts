import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { clearEnclosedWhite } from '../src/alpha.js';
for (const side of ['front', 'back']) for (const file of readdirSync(`../../assets-src/creatures/${side}`)) {
  if (file.endsWith('.gif')) continue;
  const { data, info } = await sharp(`../../assets-src/creatures/${side}/${file}`, { pages: 1 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = clearEnclosedWhite({ width: info.width, height: info.height, data: new Uint8Array(data) });
  if (c) console.log(file, info.width, c, (c / (info.width * info.height) * 100).toFixed(2) + '%');
}
