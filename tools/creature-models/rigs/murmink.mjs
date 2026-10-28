// Murmink's rig: a lanky charcoal imp, claws raised, a blue flame crest on its head and a flame mane streaming down its
// back (a cape chain), iridescent threads hanging from its claws. Numbers are scad/murmink.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, fold, isAny, side } from './lib/geo.mjs';

const SKIN = [0.22, 0.2, 0.27];
const MASK = [0.93, 0.93, 0.95];
const FLAMES = [[0.12, 0.25, 0.7], [0.2, 0.5, 0.92], [0.35, 0.8, 0.95]];
const THREADS = [[0.88, 0.8, 0.95], [0.75, 0.92, 0.9], [0.95, 0.88, 0.8]];
const CLAW = [0.1, 0.09, 0.12];

const STREAM = [[0, 3.5, 31], [1.5, 5.5, 27], [-1, 5.8, 22], [1.5, 6, 17], [-0.5, 6.2, 13], [2, 6.5, 9]];
const STREAM_R = [3.4, 3, 2.8, 2.4, 2, 1];
const cape = ['cape1', 'cape2', 'cape3'];
const TAIL = [[1.5, 3, 13], [5, 6, 10], [9, 6.5, 8], [12, 5, 9.5], [13, 3.5, 12]];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];

// the eyes are painted slits on the mask, not lib.scad eye()s: a mask-coloured lid of about their size covers them
const eyeL = { side: 'L', at: [2, -5.2, 30.6], size: 1.25, flat: 0.4 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: MASK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3, -0.4, 11]),
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'head', parent: 'body', at: [0, 0, 26] },
  { name: 'crest', parent: 'head', at: [0, 0, 32] },
  ...pair('ear*', 'head', [4.2, 0.4, 32]),
  ...pair('arm*', 'body', [4.4, 0, 23.5]),
  ...pair('fore*', 'arm*', [8.5, -0.5, 21]),
  ...pair('hand*', 'fore*', [11, -2.5, 25]),
  ...pair('thread*', 'hand*', [11.2, -5.6, 26]),
  { name: 'cape1', parent: 'body', at: STREAM[0] },
  { name: 'cape2', parent: 'cape1', at: STREAM[1] },
  { name: 'cape3', parent: 'cape2', at: STREAM[3] },
  ...TAIL.slice(0, 4).map((at, i) => ({ name: tail[i], parent: i === 0 ? 'body' : tail[i - 1], at })),
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[4.6, 3.6, 4.5], [0, 0, 22]], [[3.2, 2.8, 3], [0, 0, 17]], [[4.2, 3.4, 3], [0, 0.4, 13.5]]]), ell([2.6, 1.4, 4], [0, -2.8, 20]))],
  ['head', any(blob([[[5.4, 5, 5], [0, 0.6, 30]], [[3.4, 3.4, 3], [0, 0, 26.5]]]), limb([0, -4, 31], [0, -3.4, 25.8], 3, 1),
    ...[20, 60].map((a) => mx(spike([3 * Math.cos((a * Math.PI) / 180), 1, 25], [3 * Math.cos((a * Math.PI) / 180), 1, -1.2], 1.1))))],
  ['ear*', spike([4.2, 0.4, 32], [3.4, 0, 5], 2)],
  ['arm*', limb([4.4, 0, 23.5], [8.5, -0.5, 21], 1.4, 1.1)],
  ['fore*', limb([8.5, -0.5, 21], [11, -2.5, 25], 1.1, 0.9)],
  ['hand*', any(ell([1.5, 1.3, 1.3], [11.4, -3, 26]), limb([11.4, -4, 26.5], [12, -6.4, 25.6], 1.2, 0.3))],
  ['leg*', any(ell([2.5, 2.8, 3.6], [3, -0.4, 11]), limb([3.4, -0.8, 9], [4.2, 0.8, 5], 1.8, 1.2), limb([4.2, 0.8, 5], [4.6, -0.6, 1.4], 1.2, 1),
    ell([1.3, 2.6, 0.9], [4.8, -2.4, 0.9]), spike([4.8, -4.6, 0.8], [0, -1.4, -0.4], 0.8))],
  ...chain(tail, TAIL, [1.4, 1.2, 1, 0.8, 0.4]),
];

function assign(c, rgb) {
  const S = side(c);
  if (isAny(rgb, THREADS, 0.03)) return `thread${S}`;
  if (isAny(rgb, FLAMES, 0.03)) {
    // the head crest and the side wisp; the rest is the back stream, link by link
    if ((c[2] > 31.5 && c[1] < 3) || (c[0] > 2.5 && c[2] > 29 && c[1] < 3)) return 'crest';
    const h = chainHit(c, STREAM, STREAM_R);
    return cape[[0, 1, 1, 2, 2][h.i]];
  }
  if (isAny(rgb, [CLAW], 0.03) && c[2] > 20) return `hand${S}`;
  if (!isAny(rgb, [SKIN, [0.32, 0.3, 0.38], CLAW], 0.03)) return 'head';   // the mask and the eyes
  const f = fold(c);
  if (f[2] < 2.5 && f[1] < -3) return `leg${S}`;                            // toe claws
  return pick(c, parts);
}

// the flames flicker in size on beats that wrap at u = 1, the threads sway
const flick = (u, steps = 12, amp = 0.08) => Object.fromEntries(['crest', ...cape].map((n, i) => [n, { s: 1 + amp * (hash((Math.floor(u * steps) % steps) * 3.1 + i * 7.7) - 0.5) }]));
const sway = (u, cycles = 1, amp = 1) => both('thread', { r: [6 * amp * osc(u, cycles), 0, 5 * amp * osc(u, cycles, 0.25)] }, { r: [6 * amp * osc(u, cycles, 0.4), 0, 5 * amp * osc(u, cycles, 0.65)] });
const crest = (u, cycles = 2, amp = 1) => ({ crest: { r: [4 * amp * osc(u, cycles), 0, 6 * amp * osc(u, cycles, 0.3)] } });

const base = bipedClips({
  face, tail, cape, hipH: 11, stride: 18, guard: true,
  // a raking claw: the right arm swings forward and down across the body
  punch: { arm: [-50, 0, 20], fore: [50, 0, 0] },
  cheer: { arm: [-20, -110, 0], fore: [-10, 20, 0] },
  add: {
    idle: (t, u) => merge(flick(u, 16), sway(u, 2), crest(u, 2)),
    walk: (t, u) => merge(flick(u, 6), sway(u, 1, 1.6), crest(u, 1, 1.2), both('thread', { r: [-10, 0, 0] })),
    idle_look: (t, u) => merge(flick(u, 8), sway(u, 1)),
    windup: (t, u) => merge(flick(u, 3), { crest: { s: 1 + 0.2 * u } }),
    lunge: (t, u) => merge(flick(u, 4), sway(u, 1, 2.5)),
    hurt: (t, u) => merge(flick(u, 4, 0.2), sway(u, 2, 2)),
    faint: (t, u) => ({ crest: { s: 1 - 0.4 * Math.min(1, u / 0.7) }, ...both('thread', { r: [0, 0, 0] }) }),
    celebrate: (t, u) => merge(flick(u, 6, 0.15), sway(u, 2, 2), { crest: { s: 1.15 } }),
    exit: (t, u) => merge(flick(u, 4), sway(u, 1, 1.5)),
  },
});

const clips = {
  ...base,

  // fidget: it weaves the threads between its claws, the hands circling each other in front of its chest
  idle_weave: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const a = TAU * 2 * u;
      return merge({
        body: { r: [4 * on, 0, 0] },
        head: { r: [10 * on, 0, 4 * Math.sin(a)] },
        ...face.pose('open', 0.3 * on + blinks(u, [[0.5, 0.55]])),
        armL: { r: [-25 * on, 12 * on, -20 * on] }, armR: { r: [-25 * on, -12 * on, 20 * on] },
        foreL: { r: [8 * Math.sin(a) * on, 0, -25 * on + 10 * Math.cos(a) * on] },
        foreR: { r: [-8 * Math.sin(a) * on, 0, 25 * on + 10 * Math.cos(a) * on] },
      }, flick(u, 12), sway(u, 4, 1.4), crest(u, 2));
    },
  },

  // fidget: a silent cackle: shoulders shake, head tipped back, the flame crest flaring up
  idle_cackle: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.85, 0.12);
      const sh = Math.sin(TAU * 10 * u) * on;
      return merge({
        body: { p: [0, 0, 0.3 * Math.abs(sh)], r: [-5 * on, 0, 0] },
        head: { r: [-14 * on + 2 * sh, 0, 0] },
        jaw: { r: [0, 0, 0] },
        ...face.pose(on > 0.3 ? 'happy' : 'open'),
        ...both('arm', { r: [0, 4 * sh, 0] }),
        crest: { s: 1 + 0.25 * on },
      }, flick(u, 20, 0.12), sway(u, 2, 1.2));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
