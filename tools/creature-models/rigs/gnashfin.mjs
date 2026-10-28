// Gnashfin's rig: a stubby shark pup on two feet. The huge head sits straight on the shoulders, so it turns only a
// little; the pale lower jaw chomps, the pectoral fins are the arms, the tail drags behind. Numbers are scad/gnashfin.scad's.
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { near } from './lib/geo.mjs';

const NAVY = [0.13, 0.22, 0.45];
const CREAM = [0.97, 0.93, 0.72];

// the jaw rim and the teeth, as the scad lays them out
const rim = (t, z) => [10 * Math.sin((t * 80 * Math.PI) / 180), -2.6 - 9.4 * Math.cos((t * 80 * Math.PI) / 180) * (1 - 0.15 * t * t), z];
const teeth = (z0, dz, n) => Array.from({ length: n }, (_, i) => { const p = rim(-0.94 + (1.88 * i) / (n - 1), z0); return limb(p, [p[0], p[1], p[2] + dz], 1.4, 0.6); });
const UPPER = teeth(25.2, -3.4, 9);
const LOWER = teeth(19.8, 3, 8);

export const TAIL = [[1, 5, 7], [5, 9, 5.5], [10, 11, 6], [13, 11, 8]];
export const tails = ['tail1', 'tail2', 'tail3'];

export const eye = { side: 'L', at: [5.5, -10.8, 30.2], size: 4.5, yaw: 22, squash: 0.6, flat: 0.45 };
export const faceFor = (skin) => eyeKit({ eyes: [eye, mirrorEye(eye)], skin });
const face = faceFor(NAVY);

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.3, 0, 4.4]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'head', parent: 'body', at: [0, 1, 19] },
  { name: 'jaw', parent: 'head', at: [0, 2, 21] },
  ...pair('arm*', 'body', [6.5, -1, 16]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
];

export const parts = [
  ['body', any(blob([[[8, 7, 7], [0, 0, 9]], [[7.5, 6.8, 6], [0, 0, 15]]]), blob([[[6, 3.5, 6], [0, -4.2, 10]], [[5.5, 3, 4], [0, -4, 15]]]),
    ell([8.6, 6.4, 4], [0, 2.6, 18.5]))],
  ['head', any(ell([10.5, 9, 7.5], [0, 2, 28]), ell([9, 6.5, 5], [0, -6, 28.5]), ell([4, 2.4, 2.8], [0, -14, 27.4]), ell([10.4, 8.6, 7.4], [0, 2, 28]),
    limb([0, -3.6, 33.6], [0, 6.6, 44.8], 2, 0.6))],
  ['jaw', any(ell([9.6, 7, 4], [0, -1.5, 19]), ell([8.4, 5.4, 2.6], [0, -6, 18.8]), ell([4, 1.6, 1.4], [0, -11, 19.4]))],
  ['arm*', any(limb([6.5, -1, 16], [15, -2.5, 8.5], 2.4, 0.6), limb([6.5, -1, 16], [11.5, 1.5, 7.5], 2.4, 0.5))],
  ['leg*', any(ell([3.4, 3.4, 3.6], [4.3, 0, 4.4]), ell([3.2, 4.2, 1.8], [4.6, -1.6, 1.8]))],
  ...chain(tails, TAIL, [4.5, 3.4, 2.4, 1.8]),
  ['tail3', any(limb([13, 11, 8], [16, 13, 21], 2.4, 0.5), limb([13, 11, 8], [18, 12, 3], 2.2, 0.5))],
];

export function assign(c, rgb) {
  if (near(rgb, CREAM)) {
    if (Math.abs(c[2] - 19.6) < 1.1 && Math.hypot(c[0], c[1] + 2.6) > 8) return 'jaw';   // the lower gum
    if (Math.abs(c[2] - 25.4) < 1.1 && Math.hypot(c[0], c[1] + 2.6) > 8) return 'head';
    const u = Math.min(...UPPER.map((t) => t(c)));
    const l = Math.min(...LOWER.map((t) => t(c)));
    if (Math.min(u, l) < 1.6) return l < u ? 'jaw' : 'head';
  }
  return pick(c, parts);
}

export const base = (o = {}) => bipedClips({
  face, tail: tails, hipH: 4.4, stride: 20, armSwing: 18, hopScale: 0.7, hopH: 3,
  cheer: { arm: [0, -22, 0], fore: [0, 0, 0] },
  punch: { arm: [-50, -30, 0], fore: [0, 0, 0] },
  ...o,
  add: {
    lunge: (t, u) => ({ jaw: { r: [14 * K(u, [[0, 0], [0.25, 1], [0.4, 0], [0.6, 0.6], [0.8, 0]]), 0, 0] } }),
    celebrate: (t, u) => ({ jaw: { r: [6 * Math.abs(Math.sin(TAU * 2 * u)), 0, 0] } }),
    walk: (t, u) => ({ head: { r: [0, 0, -2 * osc(u, 1)] } }),
    // the big head droops less than the template's, it would plant the snout in the ground
    faint: (t, u) => ({ head: { r: [-16 * smooth((u - 0.18) / 0.55), 0, 0] } }),
    enter: (t, u) => ({ head: { r: [-12 * (1 - smooth((u - 0.2) / 0.35)), 0, 0] } }),
    ...(o.add ?? {}),
  },
});

export const fidgets = (F = face) => ({
  // fidget: chomp-chomp at the air, a grin, a blink
  idle_chomp: {
    seconds: 1.8,
    pose: (t, u) => {
      const ch = Math.max(0, Math.sin(TAU * 2 * Math.min(1, u / 0.5))) * (u < 0.5 ? 1 : 0);
      const on = win(u, 0.02, 0.6, 0.08);
      return {
        body: { r: [-3 * on, 0, 0] },
        head: { r: [-6 * on, 0, 4 * osc(u, 2)] },
        jaw: { r: [16 * ch, 0, 0] },
        ...F.pose('open', blinks(u, [[0.7, 0.78]])),
        ...both('arm', { r: [0, -12 * on, 0] }),
      };
    },
  },
  // fidget: a big tail swish side to side, the fins flapping for balance
  idle_swish: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0, 1, 0.12);
      const s = osc(u, 2) * on;
      return {
        body: { r: [0, 2 * s, -4 * s] },
        head: { r: [0, 0, 3 * s] },
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 0, -14 * s * (1 + 0.3 * i)] }])),
        ...both('arm', { r: [0, -10 * on + 8 * osc(u, 4), 0] }),
        ...F.pose('open', 0),
      };
    },
  },
});

export default rigDef({ joints: [...joints, ...face.joints], assign, extras: face.extras, clips: { ...base(), ...fidgets() } });
