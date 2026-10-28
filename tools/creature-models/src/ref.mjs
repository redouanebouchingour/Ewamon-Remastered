// Cuts each creature's front and back art out of the shipped atlases (packages/client/public/creatures) so a modeller
// can look at it: `.cache/ref/<id>_front.png`, `<id>_back.png` (512 px, on white), plus `<id>.png` with both side by side.
//   node src/ref.mjs [id …]      (no ids = every sprite in the manifest)
//   node src/ref.mjs --list      (prints the ids, one per line)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { REF_DIR, ROOT, readManifest } from './paths.mjs';

const args = process.argv.slice(2);
const manifest = readManifest();
if (args[0] === '--list') {
  console.log(Object.keys(manifest.sprites).join('\n'));
  process.exit(0);
}
const ids = args.length > 0 ? args : Object.keys(manifest.sprites);
mkdirSync(REF_DIR, { recursive: true });

for (const id of ids) {
  const entry = manifest.sprites[id];
  if (!entry) throw new Error(`unknown creature ${id}`);
  const sides = [];
  for (const side of ['front', 'back']) {
    const s = entry[side];
    const atlas = manifest.atlases.find((a) => a.id === s.atlas) ?? manifest.atlases[s.atlas];
    const file = atlasFile(atlas);
    const [x, y, w, h] = s.px;
    const img = await sharp(join(ROOT, 'packages/client/public/creatures', file))
      .extract({ left: x, top: y, width: w, height: h })
      .resize(512, 512)
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
    await sharp(img).toFile(join(REF_DIR, `${id}_${side}.png`));
    sides.push(img);
  }
  await sharp({ create: { width: 1024, height: 512, channels: 3, background: '#ffffff' } })
    .composite([{ input: sides[0], left: 0, top: 0 }, { input: sides[1], left: 512, top: 0 }])
    .png()
    .toFile(join(REF_DIR, `${id}.png`));
  console.log(`ref ${id}`);
}

function atlasFile(atlas) {
  if (!atlas) throw new Error('atlas not found in manifest');
  return atlas.albedo.url;
}
