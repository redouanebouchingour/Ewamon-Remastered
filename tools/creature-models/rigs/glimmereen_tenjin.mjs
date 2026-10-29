// Glimmereen Tenjin's rig: Glimmereen's (glimmereen.mjs) with its eyes closed in a serene smile (no lids), gold
// ribbon streamers riding with the bow, a sun-bead on the antenna and a halo floating over its head that bobs and
// spins on its own. Numbers are scad/glimmereen_tenjin.scad's.
import { TAU, merge, osc, rigDef } from './lib/anim.mjs';
import { ANT, antennaPart, baseJoints, glimClips, parts } from './glimmereen.mjs';
import { pick } from './lib/biped.mjs';
import { capD, ellD, isAny, near } from './lib/geo.mjs';

const BEAD = [-4, -0.4, 34.4];
const HALO = [0.6, 1, 29.2];
const WING = [[0.86, 1, 0.88], [1, 0.95, 0.72], [0.84, 0.94, 1], [0.95, 0.78, 0.35]];
const BOW = [[0.88, 0.75, 0.98], [0.74, 0.6, 0.9]];
const ANTENNA = [0.95, 0.82, 0.4];
const GOLD = [0.98, 0.8, 0.2];
const RAYS = [1, 0.95, 0.4];
const MOTES = [1, 0.95, 0.55];
const ANT2 = [ANT[0], ANT[1], [-3.6, -0.4, 33]];

const joints = [
  ...baseJoints(),
  { name: 'halo', parent: 'body', at: HALO },
];

/** How far c is from the tilted halo ring (a torus of radius 6.4 about HALO, rotate([-14, 8, 0])). */
const haloD = (c) => {
  const d = [c[0] - HALO[0], c[1] - HALO[1], c[2] - HALO[2]];
  const n = [Math.sin((8 * Math.PI) / 180), Math.sin((14 * Math.PI) / 180), 1];
  const nl = Math.hypot(...n);
  const h = (d[0] * n[0] + d[1] * n[1] + d[2] * n[2]) / nl;
  const r = Math.sqrt(Math.max(0, d[0] ** 2 + d[1] ** 2 + d[2] ** 2 - h * h));
  return Math.hypot(r - 6.4, h);
};

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (isAny(rgb, WING, 0.03) || (near(rgb, [1, 1, 1], 0.02) && c[1] > 3)) return `wing${S}`;
  if (isAny(rgb, BOW, 0.03)) return 'crest1';
  if (near(rgb, MOTES, 0.02)) return 'body';
  if (near(rgb, RAYS, 0.03) || (near(rgb, GOLD, 0.03) && ellD(c, [2.8, 2.8, 2.8], BEAD) < 1)) return 'crest2';
  if (near(rgb, GOLD, 0.03)) return haloD(c) < 1.2 || c[1] > 2.5 ? 'halo' : 'crest2';
  if (near(rgb, ANTENNA, 0.03)) {
    // the antenna (x <= 0, y < 0.2) or one of the two streamers (y > 0.5)
    const onAnt = Math.min(capD(c, ANT2[0], ANT2[1], 0.6), capD(c, ANT2[1], ANT2[2], 0.6));
    return onAnt < 1.4 && c[1] < 0.3 ? antennaPart(c, BEAD) : 'crest1';
  }
  return pick(c, parts);
}

// the halo floats a beat behind the body and turns slowly; it jumps in the hits and drops in the faint
const ring = (u, amp = 0.4, spin = 1, cycles = 2) => ({ halo: { p: [0, 0, amp * osc(u, cycles, 0.25)], r: [3 * osc(u, cycles), 0, 360 * spin * u] } });
const extra = {
  idle: (t, u) => ring(u, 0.5, 0, 2),
  walk: (t, u) => ring(u, 0.4, 0, 2),
  idle_look: (t, u) => ring(u, 0.4, 0, 2),
  hurt: (t, u) => ({ halo: { p: [0, 0, 1.4 * Math.sin(Math.PI * u)], r: [10 * Math.sin(TAU * 3 * u) * (1 - u), 0, 0] } }),
  faint: (t, u) => ({ halo: { p: [0, -0.6 * Math.min(1, u / 0.7), -2 * Math.min(1, u / 0.7)], r: [16 * Math.min(1, u / 0.7), 0, 0] } }),
  celebrate: (t, u) => ring(u, 1, 1, 2),
  enter: (t, u) => ({ halo: { p: [0, 0, 2 * (1 - Math.min(1, u / 0.6))] } }),
};

const clips = glimClips(null, extra);
// the fidgets carry the halo too (a loop of its own beat)
for (const n of ['idle_twirl', 'idle_bead']) {
  const p = clips[n].pose;
  clips[n] = { ...clips[n], pose: (t, u) => merge(p(t, u), ring(u, 0.5, n === 'idle_twirl' ? 1 : 0, 2)) };
}

export default rigDef({ joints, assign, clips });
