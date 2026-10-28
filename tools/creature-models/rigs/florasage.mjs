// Florasage's rig: an upright leaf dragon with antlers, two great fans of leaf wings and a long tail coiled on the
// ground that lifts a sunflower. The coil lies on the ground, so it only breathes a little (no template tail sway);
// the sunflower on its tip sways and spins. Numbers are scad/florasage.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { fold, isAny, near, side, subFrame } from './lib/geo.mjs';

const GREEN = [0.27, 0.5, 0.22];
const LEAVES = [[0.32, 0.58, 0.26], [0.45, 0.7, 0.32], [0.18, 0.36, 0.16]];
const FLOWER = [[1, 0.62, 0.12], [0.98, 0.45, 0.1], [0.4, 0.24, 0.1]];
const TAIL = [[0, 4, 7], [3, 9, 4], [9, 12, 3], [14, 9, 3], [14, 4, 4.5], [10, 3, 6], [7, 6, 4], [2, 12, 2.6],
  [-6, 13, 2.4], [-12, 9, 2.6], [-15, 3, 4], [-15, -1, 7], [-14, -2, 10]];
const TAIL_R = [3.6, 3.2, 2.8, 2.4, 2.1, 1.8, 1.7, 1.6, 1.4, 1.2, 1, 0.8, 0.7];
// which joint each tail link belongs to
const LINK = ['tail1', 'tail1', 'tail1', 'tail2', 'tail2', 'tail2', 'tail2', 'tail3', 'tail3', 'tail4', 'tail4', 'flower'];
const WING = subFrame([3.5, 4, 24], [0, 10, 15]);

const eyeL = { side: 'L', at: [2.8, -7.3, 32.3], size: 1.8, yaw: 22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREEN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.6, 0.8, 9]),
  { name: 'body', parent: 'root', at: [0, 1, 9] },
  { name: 'head', parent: 'body', at: [0, -2.2, 27] },
  ...pair('arm*', 'body', [4.2, -1, 21]),
  ...pair('fore*', 'arm*', [5.6, -3.4, 17]),
  ...pair('wing*', 'body', [3.5, 4, 24]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[3] },
  { name: 'tail3', parent: 'tail2', at: TAIL[7] },
  { name: 'tail4', parent: 'tail3', at: TAIL[9] },
  { name: 'flower', parent: 'tail4', at: TAIL[11], rot: [75, 0, -25] },
  ...face.joints,
];

const parts = [
  ['leg*', any(ell([3.2, 4, 4.6], [4.6, 0.8, 8.5]), limb([5.2, 1.6, 6], [5.6, 2.2, 1.6], 1.8, 1.4),
    blob([[[1.8, 3.6, 1.2], [5.8, -0.6, 1.2]], [[1.4, 1.4, 1.2], [5.8, 2, 1.2]]]))],
  ['body', any(blob([[[5.6, 5, 5], [0, 1, 11]], [[5, 4.8, 5.5], [0, -0.5, 18]], [[4.2, 4.2, 4], [0, -1.2, 23]]]),
    ell([3.4, 2.4, 6.5], [0, -2.9, 16.5]), limb([0, -1, 23], [0, -2.2, 27], 3.6, 3.1))],
  ['head', any(limb([0, -2.2, 27], [0, -3, 30], 3.1, 2.9), blob([[[5, 4.8, 4.2], [0, -3.2, 31.5]], [[3.6, 3.8, 2.8], [0, -7.8, 30.6]]]),
    limb([1.8, -2.5, 34], [4, -1.7, 39], 0.8), limb([-1.8, -2.5, 34], [-4, -1.7, 39], 0.8))],
  ['arm*', limb([4.2, -1, 21], [5.6, -3.4, 17], 1.4, 1.1)],
  ['fore*', limb([5.6, -3.4, 17], [4.4, -5.6, 15.8], 1.1, 0.9)],
  ...TAIL.slice(1).map((p, i) => [LINK[i], limb(TAIL[i], p, TAIL_R[i], TAIL_R[i + 1])]),
];

function assign(c, rgb) {
  if (isAny(rgb, FLOWER) || isAny(rgb, LEAVES)) {
    if (c[2] < 20 && c[0] < -8 && c[1] < 4) return 'flower';             // the tail's sunflower and its leaf
    const w = WING.local(fold(c));
    if (c[2] > 18 && Math.abs(w[1]) < 3 && Math.hypot(w[0], w[2]) > 2) return `wing${side(c)}`;
  }
  if (near(rgb, [0.5, 0.35, 0.22]) && c[2] > 33) return 'head';           // the antlers
  return pick(c, parts);
}

// the coil breathes; the sunflower nods and sways
const coil = (u, cycles, amp = 1) => ({
  tail1: { r: [0, 0, 1.2 * amp * osc(u, cycles)] },
  tail2: { r: [0, 0, 1.5 * amp * osc(u, cycles, -0.1)] },
  tail3: { r: [0, 0, 2 * amp * osc(u, cycles, -0.2)] },
  tail4: { r: [-3 * amp * osc(u, cycles, -0.3), 0, 3 * amp * osc(u, cycles, -0.3)] },
  flower: { r: [5 * amp * osc(u, cycles, -0.4), 4 * amp * osc(u, cycles, -0.15), 0] },
});

const base = bipedClips({
  face, hipH: 9, stride: 18, armSwing: 14, hopScale: 0.4, hopH: 3,
  wing: { open: [0, -12, -22], flap: 12 },
  cheer: { arm: [-80, -40, 0], fore: [-20, 0, 0] },
  punch: { arm: [-60, 10, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => coil(u, 1),
    walk: (t, u) => coil(u, 1, 2),
    idle_look: (t, u) => coil(u, 1),
    lunge: (t, u) => merge(coil(u, 1, 2), { flower: { r: [0, 0, 120 * K(u, [[0.1, 0], [0.5, 1]])] } }),
    hurt: (t, u) => coil(u, 2, 2.5),
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.6); return { tail4: { r: [6 * d, 0, 0] }, flower: { r: [30 * d, 0, 0] } }; },
    celebrate: (t, u) => merge(coil(u, 2, 2), { flower: { r: [0, 0, 360 * smooth(u)] } }),
    enter: (t, u) => ({ flower: { r: [0, 0, 180 * smooth((u - 0.2) / 0.6)] } }),
  },
});

const clips = {
  ...base,

  // fidget: basks in the sun, wings fanned wide, face up, eyes shut, the tail's sunflower turned up beside it
  idle_bask: {
    seconds: 3,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.78, 1], [0.95, 0]]);
      return merge({
        ...face.pose(on > 0.5 ? 'happy' : 'open'),
        body: { r: [-4 * on, 0, 0] },
        head: { r: [-18 * on, 0, 6 * on] },
        ...both('wing', { r: [0, -16 * on + 2 * osc(u, 3) * on, -22 * on] }),
        ...both('arm', { r: [0, -12 * on, 0] }),
        tail4: { r: [-6 * on, 0, 0] },
        flower: { r: [-20 * on, 0, 0] },
      }, coil(u, 1));
    },
  },

  // fidget: lifts the tail flower round to its face, sniffs it and spins it once
  idle_sniff: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.8, 1], [0.95, 0]]);
      const spin = 360 * smooth((u - 0.4) / 0.35);
      return {
        ...face.pose('open', blinks(u, [[0.3, 0.38]])),
        head: { r: [10 * on, 0, -28 * on] },
        body: { r: [0, 0, -6 * on] },
        tail3: { r: [0, 0, -4 * on] },
        tail4: { r: [-14 * on, 0, -10 * on] },
        flower: { r: [-10 * on, 0, spin] },
        ...both('wing', { r: [0, 3 * osc(u, 2), 0] }),
      };
    },
  },
};

// the coil lies on the ground: its first link undoes the root's and the body's pitch and roll (and half the yaw), so
// a lunge or a faint does not lift it off the ground behind or push the flower into it
for (const c of Object.values(clips)) {
  const f = c.pose;
  c.pose = (t, u) => {
    const p = f(t, u);
    const r = [0, 1, 2].map((i) => (p.root?.r?.[i] ?? 0) + (p.body?.r?.[i] ?? 0));
    return merge(p, { tail1: { r: [-r[0], -r[1], -0.5 * r[2]] } });
  };
}

export default rigDef({ joints, assign, extras: face.extras, clips });
