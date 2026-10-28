import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR } from './paths.mjs';

/**
 * Rewrites creature-models/index.json from the GLBs on disk. A rigged creature (`<id>.rig.glb`, written by rig.mjs) is
 * served as that and marked `rig: true` (its static GLB, the rig's input, lives in STATIC_DIR); the others serve
 * their static `<id>.glb`.
 */
export function writeIndex() {
  const ids = [...new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith('.glb')).map((f) => f.replace(/(\.rig)?\.glb$/, '')))].sort();
  const models = Object.fromEntries(ids.map((id) => {
    const rig = `${id}.rig.glb`;
    if (existsSync(join(OUT_DIR, rig))) return [id, { url: rig, bytes: statSync(join(OUT_DIR, rig)).size, rig: true }];
    return [id, { url: `${id}.glb`, bytes: statSync(join(OUT_DIR, `${id}.glb`)).size }];
  }));
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify({ version: 1, heightMeters: 1, facing: '+z', models }, null, 2)}\n`);
}
