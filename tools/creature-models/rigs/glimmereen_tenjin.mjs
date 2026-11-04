// Glimmereen Tenjin's rig: Glimmereen's (glimmereen.mjs) with its eyes closed in a serene smile (painted, no lids),
// two ribbon streamers riding with the bow, a sun-bead on the antenna and a big tilted halo round its head that bobs
// and turns on its own (the small ring on its back edge goes round with it). Numbers are
// scad/glimmereen_tenjin.scad's (remodelled on the sprite 2026-11-04).
import { TAU, merge, osc, rigDef } from './lib/anim.mjs';
import { antennaPart, baseJoints, glimClips, parts } from './glimmereen.mjs';
import { pick } from './lib/biped.mjs';
import { isAny, near } from './lib/geo.mjs';

const ANT = [[-0.3, -1.4, 29.2], [-0.82, -1, 30.05], [-1.43, -1, 32.47], [-2.52, -1, 34.57], [-3.98, -1, 36.37]];
const SUN = [-6.41, -1, 37.87];
const HALO = [3.35, 1, 29.3];

const WING = [[0.92, 0.8, 0.52], [0.96, 0.9, 0.74], [0.86, 0.95, 0.84], [0.84, 0.92, 0.98]];
const BOW = [[0.94, 0.84, 0.95], [0.82, 0.75, 0.92], [0.96, 0.9, 0.7]];   // the loops, the knot, the ribbons
const ANTENNA = [0.93, 0.8, 0.45];
const SUNC = [[0.96, 0.8, 0.36], [0.97, 0.92, 0.5], [1, 0.97, 0.8]];
const HALOC = [0.88, 0.72, 0.36];

const joints = [
  ...baseJoints().map((j) => (j.name === 'crest2' ? { ...j, at: ANT[2] } : j)),
  // the ring's own frame (the scad's rotate([0, 0, 30]) rotate([30, 0, 0])), so a spin turns it in its plane
  { name: 'halo', parent: 'body', at: HALO, rot: [30, 0, 30] },
];

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (isAny(rgb, WING, 0.02) || (near(rgb, [1, 1, 1], 0.02) && c[1] > 5)) return `wing${S}`;
  if (isAny(rgb, BOW, 0.02)) return 'crest1';
  if (isAny(rgb, SUNC, 0.02)) return 'crest2';
  if (near(rgb, HALOC, 0.02)) return 'halo';
  if (near(rgb, ANTENNA, 0.02)) return antennaPart(c, SUN, ANT);
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
