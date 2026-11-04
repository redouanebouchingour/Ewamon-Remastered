// Murmink's rig: a lanky charcoal imp crouched to pounce, claws held out wide, a white mask on a head hunched forward
// and turned to the camera, a blue flame of hair off the forehead and a flame mane streaming down its back (a cape
// chain), fans of iridescent threads hanging from its claws. Numbers are scad/murmink.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny, side, subFrame } from './lib/geo.mjs';

const SKIN = [0.22, 0.2, 0.28];
const CLAW = [0.16, 0.13, 0.19];
const MASK = [0.93, 0.92, 0.94];
const FLAMES = [[0.27, 0.36, 0.7], [0.29, 0.54, 0.82], [0.29, 0.81, 0.9]];
const THREADS = [[0.93, 0.94, 0.92], [0.83, 0.77, 0.81], [0.73, 0.9, 0.87], [0.67, 0.66, 0.69], [0.88, 0.85, 0.88]];

// the head block: translate(HEAD_T) rotate(HEAD_R) scale(HEAD_S)
const HF = subFrame([-1.5, -4, 27], [0, 0, 15], 1.06);
const H = (p) => HF.world(p);
// a head-local test mirrored about the head's own x = 0
const hmx = (test) => (c) => { const l = HF.local(c); return test([Math.abs(l[0]), l[1], l[2]]); };

// the back mane (scad's flameDk chain) and its three links
const MANE = [[0.5, 2.8, 31], [2.2, 4.8, 27], [0.6, 5.2, 23], [2.4, 5.2, 19.5], [4.6, 4.8, 15], [7.5, 3.6, 12.5], [8.6, 2.6, 10.4]];
const MANE_R = [4.2, 4.2, 3.0, 2.8, 3.6, 1.8, 0.35];
const cape = ['cape1', 'cape2', 'cape3'];
const TAIL = [[2.0, 3.0, 13], [8, 5, 12.5], [12, 4.5, 13], [15, 3, 10.5], [14.5, 1.5, 7], [11.5, 0.5, 5.5]];
const TAIL_R = [1.6, 1.55, 1.6, 1.5, 1.1, 0.3];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];

// the eyes are painted on the mask (black socket, red almond, slit pupil), centred at head-local (2, -0.2): a
// mask-coloured lid of the socket's size closes over them
const eyeL = { side: 'L', at: [2.0, -3.0, -0.2], size: 1.75, flat: 0.45, yaw: 24, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: MASK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3, 0.3, 13.2]),
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'head', parent: 'body', at: [-0.3, -1.6, 23.6] },
  { name: 'crest', parent: 'head', at: H([0.4, -1.4, 3.8]) },
  { name: 'earL', parent: 'head', at: H([3.1, 0.6, 2.2]) },
  { name: 'earR', parent: 'head', at: H([-3.1, 0.6, 2.2]) },
  ...pair('arm*', 'body', [3.6, -0.4, 22.5]),
  ...pair('fore*', 'arm*', [8.5, -1.5, 19.5]),
  ...pair('hand*', 'fore*', [12, -4, 22]),
  ...pair('thread*', 'hand*', [13, -7.9, 20.2]),
  { name: 'cape1', parent: 'body', at: [1.2, 4.2, 28] },
  { name: 'cape2', parent: 'cape1', at: [1.4, 5.0, 21.5] },
  { name: 'cape3', parent: 'cape2', at: [3.8, 5.0, 16.5] },
  ...TAIL.slice(0, 4).map((at, i) => ({ name: tail[i], parent: i === 0 ? 'body' : tail[i - 1], at })),
  ...face.joints,
];

const skull = inFrame(HF, any(ell([4.2, 4, 4.4]), ell([1.2, 1.3, 1.3], [0, -2.6, -4.4])));
const ear = (k) => inFrame(HF, limb([3.1 * k, 0.6, 2.2], [7.4 * k, 1.4, 7.8], 2.3, 0.3));
const hair = inFrame(HF, (l) => chainHit(l, [[0.4, -1.4, 3.8], [1.0, -0.6, 7.0], [2.6, 0.2, 9.6], [4.4, 0.8, 11.8], [6.1, 1.2, 13.1]], [3.1, 2.4, 1.7, 1.0, 0.25]).d);
const parts = [
  ['body', blob([[[4.0, 3.3, 3.4], [0, -0.6, 21.3]], [[3.9, 3.3, 2.8], [0, -0.2, 17.5]], [[4.6, 3.6, 3.3], [0, 0.3, 14]]])],
  ['head', any(skull, limb([0, -0.8, 22.5], [-0.8, -3, 25.5], 2.3, 2.0),
    hmx(any(limb([3.4, 0.4, -1.6], [5.7, 1.0, -2.9], 1.2, 0.3), limb([3.0, 0.2, -3.2], [4.6, 0.6, -5.1], 1.0, 0.3))))],
  ['earL', ear(1)], ['earR', ear(-1)],
  ['arm*', limb([3.6, -0.4, 22.5], [8.5, -1.5, 19.5], 1.75, 1.3)],
  ['fore*', limb([8.5, -1.5, 19.5], [12, -4, 22], 1.3, 1.15)],
  ['hand*', any(ell([2, 1.8, 1.8], [13, -5, 22.6]), limb([13, -6, 23.3], [13, -8.2, 21], 1.6, 0.5))],
  ['leg*', any(limb([3.0, 0.3, 13.2], [7.4, -2.0, 9.4], 3.2, 2.0), limb([7.4, -2.0, 9.4], [7.6, 0.8, 3.4], 1.6, 1.05),
    limb([7.6, 0.8, 3.4], [8.0, -1.2, 0.9], 1.0, 0.95), ell([1.5, 2.4, 0.9], [8.0, -2.2, 0.9]))],
  ...chain(tail, TAIL, TAIL_R),
];
const flameParts = [
  ['crest', hair],
  ['earL', ear(1)], ['earR', ear(-1)],
  ['mane', (c) => chainHit(c, MANE, MANE_R).d],
  ['mane', limb([2.0, 4.2, 27], [8.6, 2.8, 31.4], 2.1, 0.3)],           // the tongue over the near shoulder
];

function assign(c, rgb) {
  const S = side(c);
  if (isAny(rgb, [MASK], 0.012)) return 'head';     // the mask is a hair off the threads' white
  if (isAny(rgb, THREADS, 0.012)) return `thread${S}`;
  if (isAny(rgb, FLAMES, 0.03)) {
    const n = pick(c, flameParts);
    if (n !== 'mane') return n;
    if (c[2] > 25) return 'cape1';
    return c[2] > 17 ? 'cape2' : 'cape3';
  }
  if (isAny(rgb, [CLAW], 0.03)) return c[2] > 15 ? `hand${S}` : `leg${S}`;
  if (!isAny(rgb, [SKIN], 0.03)) return 'head';   // the mask and the painted eyes
  return pick(c, parts);
}

// the flames flicker in size on beats that wrap at u = 1, the threads sway
const flick = (u, steps = 12, amp = 0.08) => Object.fromEntries(['crest', ...cape].map((n, i) => [n, { s: 1 + amp * (hash((Math.floor(u * steps) % steps) * 3.1 + i * 7.7) - 0.5) }]));
const sway = (u, cycles = 1, amp = 1) => both('thread', { r: [6 * amp * osc(u, cycles), 0, 5 * amp * osc(u, cycles, 0.25)] }, { r: [6 * amp * osc(u, cycles, 0.4), 0, 5 * amp * osc(u, cycles, 0.65)] });
const crest = (u, cycles = 2, amp = 1) => ({ crest: { r: [4 * amp * osc(u, cycles), 0, 6 * amp * osc(u, cycles, 0.3)] } });

const base = bipedClips({
  face, tail, cape, hipH: 13, stride: 18, guard: true,
  // a raking claw: the right arm swings forward and down across the body
  punch: { arm: [-50, 0, 20], fore: [50, 0, 0] },
  cheer: { arm: [0, -45, 0], fore: [0, -35, 0] },   // claws flung up and out to the sides, the threads clear of the face
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
