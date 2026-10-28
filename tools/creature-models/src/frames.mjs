import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NPC_SET, PKG } from './paths.mjs';

/**
 * frames.json: per creature, how build.mjs placed the scad model in its GLB, so rig.mjs can map GLB vertices back to
 * scad coordinates without hand calibration. `height` and `minZ` are the scad height and floor (the ground line for a
 * floater) that became 1 m and y = 0; `cx` / `cy` the scad x / y centre the build moved to the origin; `size` the
 * scad extents and `triangles` the count, which rig.mjs checks against the GLB to catch a stale entry.
 */
/** The NPC set (`--npc`) keeps its own frames. */
export const FRAMES = join(PKG, NPC_SET ? 'frames.npc.json' : 'frames.json');

export function readFrames() {
  return existsSync(FRAMES) ? JSON.parse(readFileSync(FRAMES, 'utf8')) : {};
}

/**
 * Sets one creature's entry in a JSON map written one line per creature, re-read just before and swapped in with a
 * rename, so sessions rigging other creatures at the same time neither drop each other's lines nor read a half-written
 * file.
 */
export function updateJsonMap(file, id, value) {
  const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  all[id] = value;
  const lines = Object.keys(all).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(all[k])}`);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `{\n${lines.join(',\n')}\n}\n`);
  renameSync(tmp, file);
}

export function saveFrame(id, frame) {
  updateJsonMap(FRAMES, id, frame);
}

/** The frame of a mesh in scad coordinates (flat xyz, Z up) and its ground line (null: its lowest point). */
export function frameOf(pos, triangles, ground = null) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
  const floor = ground ?? min[2];
  const r = (v) => Math.round(v * 1e4) / 1e4;
  return {
    height: r(max[2] - floor), minZ: r(floor), cx: r((min[0] + max[0]) / 2), cy: r((min[1] + max[1]) / 2),
    size: [r(max[0] - min[0]), r(max[1] - min[1]), r(max[2] - min[2])], triangles,
  };
}
