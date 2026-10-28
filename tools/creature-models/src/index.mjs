import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR } from './paths.mjs';

/**
 * Rewrites creature-models/index.json from the GLBs on disk. A rigged creature (`<id>.rig.glb`, written by rig.mjs) is
 * served in place of its static `<id>.glb` and marked `rig: true`; the static GLB stays as the rig's input.
 */
export function writeIndex() {
  const files = readdirSync(OUT_DIR).filter((f) => f.endsWith('.glb') && !f.endsWith('.rig.glb')).sort();
  const models = Object.fromEntries(files.map((f) => {
    const id = f.slice(0, -4);
    const rig = `${id}.rig.glb`;
    if (existsSync(join(OUT_DIR, rig))) return [id, { url: rig, bytes: statSync(join(OUT_DIR, rig)).size, rig: true }];
    return [id, { url: f, bytes: statSync(join(OUT_DIR, f)).size }];
  }));
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify({ version: 1, heightMeters: 1, facing: '+z', models }, null, 2)}\n`);
}
