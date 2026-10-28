// Nettlewisp's rig: a little moss spirit, a big cat head with antlers (the scad scales the head block 1.3x), vine
// arms dangling, a vine tail with a leaf tuft and four leaves drifting round it (one joint that orbits). Numbers are
// scad/nettlewisp.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, side, subFrame } from './lib/geo.mjs';

const FACE = [0.8, 0.92, 0.66];
const MOSSES = [[0.2, 0.5, 0.2], [0.4, 0.68, 0.3], [0.1, 0.3, 0.14], [0.62, 0.82, 0.5], [0.55, 0.74, 0.45], [0.4, 0.3, 0.18], [0.5, 0.36, 0.22]];
const GLOW = [0.85, 1, 0.55];
const D = Math.PI / 180;

// translate([0, -1.5, 22]) scale(1.3) translate([0, 1.5, -26]) { head }
const H = subFrame([0, 0.45, -11.8], [0, 0, 0], 1.3);
const hw = (p) => H.world(p);
const leaf = (p, d, w) => limb(p, p.map((v, i) => v + d[i]), w * 0.7, w * 0.3);

const TAIL = [[2, 5, 7], [6, 8, 6], [10, 9, 8], [12, 8, 12], [13, 6, 17]];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const ARM = [[5.5, -1, 15], [9, -2, 12], [10.5, -2.5, 8], [11.5, -2, 4]];

const eyeL = { side: 'L', at: [2.5, -7.4, 25.6], size: 1.5, yaw: -15, flat: 0.4, frame: H };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.4, 0, 5]),
  { name: 'body', parent: 'root', at: [0, 0, 5] },
  { name: 'head', parent: 'body', at: [0, -1, 17] },
  ...pair('ear*', 'head', hw([4.4, -1, 30])),
  ...pair('arm*', 'body', ARM[0]),
  ...pair('fore*', 'arm*', ARM[1]),
  ...pair('hand*', 'fore*', ARM[2]),
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  { name: 'drift', parent: 'root', at: [0, 0, 20] },
  ...face.joints,
];

const fringe = [];
for (let t = 0; t < 3; t++) for (let a = 0; a < 360; a += 30) {
  const aa = (a + t * 15) * D;
  const r = [7.4, 6.8, 5.6][t];
  fringe.push(spike([r * Math.cos(aa), r * 0.88 * Math.sin(aa), [7, 11, 15.5][t]], [Math.cos(aa) * 3, Math.sin(aa) * 2.6, -4.5], 1.7));
}
const brow = [];
for (let a = 20; a <= 160; a += 28) brow.push(inFrame(H, leaf([6.4 * Math.cos(a * D), -4, 25 + 4.6 * Math.sin(a * D)], [Math.cos(a * D) * 1.6, -1.2, Math.sin(a * D) * 1.6 - 0.6], 1.4)));

const parts = [
  ['body', any(blob([[[8, 7, 6], [0, 0, 11]], [[6, 5.5, 4.5], [0, 0, 15.5]], [[7.6, 6.6, 3], [0, 0, 6.5]]]), ...fringe)],
  ['leg*', any(limb([3.4, 0, 5], [3.6, -0.5, 1.5], 2.7, 2.5), ell([2.7, 3.3, 1.4], [3.6, -1.4, 1.4]), leaf([3.6, -4.4, 1.2], [0.4, -1.4, -0.3], 0.9))],
  ['arm*', any(limb(ARM[0], ARM[1], 1, 0.8), leaf([9, -2, 12], [2.5, -0.5, -1], 1.2))],
  ['fore*', any(limb(ARM[1], ARM[2], 0.8, 0.6), leaf([10.5, -2.5, 8], [-2, -0.5, -2], 1))],
  ['hand*', any(limb(ARM[2], ARM[3], 0.6, 0.4), leaf([11.5, -2, 4], [1, -0.5, -2.5], 1))],
  ['head', any(inFrame(H, any(ell([7, 6, 6], [0, -1.5, 26]), ell([6.2, 3.8, 4.9], [0, -4.4, 24.6]), ell([2.8, 1.8, 1.8], [0, -7.4, 23.4]),
    leaf([6.4, -3.5, 22.5], [1.8, -0.6, -2.2], 1.3), leaf([-6.4, -3.5, 22.5], [-1.8, -0.6, -2.2], 1.3))), ...brow)],
  ['ear*', inFrame(H, any(limb([4.4, -1, 30], [6.6, -1.5, 35.5], 2.4, 0.4), limb([4.5, -2.4, 30.5], [6.3, -2, 34.5], 1.2, 0.3)))],
  ...TAIL.slice(1).map((p, i) => [tail[Math.min(3, i)], limb(TAIL[i], p, 1.2, 0.7)]),
  ['tail4', any(...[-40, -20, 0, 20, 40].map((a) => leaf([13, 6, 17], [Math.sin(a * D) * 3, -0.5, 5 + Math.cos(a * D)], 1.5)))],
  ['drift', any(leaf([-10, -3, 30], [1, 0, 1.4], 0.7), leaf([10, -5, 28], [-1, 0, 1.2], 0.6), leaf([-12, 2, 18], [1.2, 0, -1], 0.6), leaf([14, 1, 22], [0.5, 0, 1.4], 0.6))],
];

function assign(c, rgb) {
  if (near(rgb, GLOW)) return 'body';
  if (near(rgb, [0.5, 0.36, 0.22])) return 'head';                         // the antlers
  if (!isAny(rgb, [...MOSSES, FACE])) return 'head';                         // eyes, nose, mouth
  const f = [Math.abs(c[0]), c[1], c[2]];
  // the antler-tip leaves
  if (near(rgb, [0.62, 0.82, 0.5]) && f[2] > 36) return 'head';
  return pick(c, parts);
}

const orbit = (u, turns = 1) => ({ drift: { r: [0, 0, 360 * turns * u], p: [0, 0, 1.2 * osc(u, 2 * Math.max(1, Math.round(Math.abs(turns))))] } });

const base = bipedClips({
  face, tail, hipH: 5, stride: 22, armSwing: 18, hopScale: 1, hopH: 3,
  // a vine whip: the right arm flings forward and down
  punch: { arm: [-80, 0, 10], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => merge(orbit(u), both('fore', { r: [3 * osc(u, 2), 0, 0] }), both('hand', { r: [5 * osc(u, 2, 0.2), 0, 0] })),
    walk: (t, u) => orbit(u, 0),
    idle_look: (t, u) => orbit(u, 0),
    celebrate: (t, u) => orbit(u, 1),
    enter: (t, u) => ({ drift: { s: 0.2 + 0.8 * Math.min(1, u / 0.7) } }),
    faint: (t, u) => ({ drift: { p: [0, 0, -12 * Math.min(1, u / 0.9)], r: [0, 0, 40 * u] } }),
  },
});

const clips = {
  ...base,

  // fidget: a cat's twitch: one ear flicks, then the other, the tail tuft flicks and it gives a little double hop
  idle_twitch: {
    seconds: 2.2,
    pose: (t, u) => {
      const fl = (u0) => Math.sin(TAU * 3 * Math.min(1, Math.max(0, (u - u0) / 0.15))) * win(u, u0, u0 + 0.15, 0.02);
      const hop = Math.max(0, Math.sin(TAU * 2 * Math.min(1, Math.max(0, (u - 0.55) / 0.35))));
      return merge({
        root: { p: [0, 0, 1.6 * hop] },
        head: { r: [0, 8 * fl(0.1), 0] },
        earL: { r: [-16 * fl(0.1), 10 * fl(0.1), 0] },
        earR: { r: [-16 * fl(0.28), -10 * fl(0.28), 0] },
        ...face.pose(hop > 0.3 ? 'happy' : 'open', blinks(u, [[0.42, 0.48]])),
        tail3: { r: [0, 0, 18 * fl(0.38)] }, tail4: { r: [10 * fl(0.38), 0, 24 * fl(0.38)] },
        ...both('arm', { r: [0, -10 * hop, 0] }),
      }, orbit(u));
    },
  },

  // fidget: it reaches up and bats at a drifting leaf with a vine arm, missing
  idle_bat: {
    seconds: 2.4,
    pose: (t, u) => {
      const reach = K(u, [[0, 0], [0.2, 1], [0.32, 0.6], [0.44, 1], [0.56, 0.6], [0.72, 0]]);
      return merge({
        body: { r: [-4 * reach, 0, -5 * reach] },
        head: { r: [-14 * reach, 0, -10 * reach] },
        ...face.pose('open', blinks(u, [[0.8, 0.85]])),
        armL: { r: [-40 * reach, -60 * reach, 0] }, foreL: { r: [-20 * reach, 0, 0] }, handL: { r: [-20 * reach * osc(u, 4), 0, 0] },
      }, orbit(u));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
