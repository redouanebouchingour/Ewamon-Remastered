// Nebucloak's rig: a small mint imp in a pointed hood (the tip flops) and a short cone cape (one joint: the shell can't
// bend), claws raised, two rings of wind wisps circling it on their own joints. Numbers are scad/nebucloak.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { chainHit, isAny, near, side, subFrame } from './lib/geo.mjs';

const SKIN = [0.5, 0.78, 0.7];
const SKIN_DK = [0.36, 0.62, 0.58];
const CREAM = [0.93, 0.92, 0.72];
const HOOD = [0.36, 0.18, 0.55];
const CAPE = [[0.55, 0.38, 0.75], [0.72, 0.18, 0.55]];
const GEM = [0.85, 0.15, 0.6];
const WIND = [0.62, 0.84, 0.95];
const CLAW = [0.95, 0.95, 0.88];
const TIP = [[0, 2.5, 32.5], [0.5, 4.5, 35.5], [2.8, 6, 36.5], [5, 6.5, 35.5]];

// the slanted eyes sit in a translate() rotate() block; the lid is cream like the face
const eye = (S) => {
  const k = S === 'L' ? 1 : -1;
  return { side: S, at: [0, 0, 0], size: 1.35, flat: 0.5, frame: subFrame([2.2 * k, -6.9, 27.4], [0, 25 * k, -20 * k]) };
};
const face = eyeKit({ eyes: [eye('L'), eye('R')], skin: CREAM });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [2.6, 0, 12]),
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'cape1', parent: 'body', at: [0, 1, 20] },
  { name: 'head', parent: 'body', at: [0, -0.5, 21.5] },
  { name: 'tip', parent: 'head', at: TIP[1] },
  ...pair('arm*', 'body', [4.2, 0, 19]),
  ...pair('fore*', 'arm*', [7.5, -1, 18]),
  ...pair('hand*', 'fore*', [9.5, -2, 21.5]),
  { name: 'windA', parent: 'root', at: [0, 0, 26] },
  { name: 'windB', parent: 'root', at: [0, 0, 6] },
  ...face.joints,
];

const parts = [
  ['leg*', any(limb([2.6, 0, 12], [3.2, -0.5, 3], 2.8, 2), ell([2.1, 2.8, 1.4], [3.2, -1.4, 1.4]))],
  ['body', any(blob([[[4.6, 3.6, 4], [0, 0, 13]], [[3.6, 3, 3.4], [0, 0, 18]]]), blob([[[3, 1.6, 3.4], [0, -2.6, 13]], [[2, 1.2, 2.4], [0, -2.4, 17]]]))],
  ['arm*', limb([4.2, 0, 19], [7.5, -1, 18], 1.3, 1.1)],
  ['fore*', limb([7.5, -1, 18], [9.5, -2, 21.5], 1.1, 1)],
  ['hand*', ell([1.6, 1.4, 1.7], [9.7, -2.2, 22.5])],
  ['head', any(ell([5.6, 5.2, 5.4], [0, -1.6, 27]), ell([4.6, 3, 3.6], [0, -4.4, 25.9]), mx(ell([1.9, 1.2, 1.4], [2.2, -6.9, 27.4])))],
];

function assign(c, rgb) {
  const S = side(c);
  if (near(rgb, WIND)) return c[2] > 16 ? 'windA' : 'windB';
  if (near(rgb, CLAW)) return `hand${S}`;
  if (isAny(rgb, CAPE)) return 'cape1';
  if (near(rgb, GEM)) return 'body';
  if (near(rgb, HOOD)) {
    if (c[2] < 21.8) return 'body';                                  // the collar
    const h = chainHit(c, TIP, [4, 2.8, 1.6, 0.6]);
    return h.d < 1.15 && (h.i > 0 || h.t > 0.5) ? 'tip' : 'head';
  }
  if (near(rgb, SKIN_DK)) return c[2] < 4 ? `leg${S}` : 'head';    // feet; forehead point and smile
  if (!isAny(rgb, [SKIN, CREAM])) return 'head';                    // eyes
  return pick(c, parts);
}

// the wind rings: the upper ring is symmetric under a half turn, so half a turn per loop closes it; the lower one turns once
const wind = (u, a = 0.5, b = 1) => ({ windA: { r: [0, 0, 360 * a * u] }, windB: { r: [0, 0, -360 * b * u] } });
const flop = (u, cycles = 1, amp = 1) => ({ tip: { r: [6 * amp * osc(u, cycles), 0, 8 * amp * osc(u, cycles, 0.25)] } });

const base = bipedClips({
  face, cape: ['cape1'], hipH: 12, stride: 18, guard: true, hopScale: 0.8,
  punch: { arm: [-50, 0, 20], fore: [50, 0, 0] },
  cheer: { arm: [-20, -100, 0], fore: [-10, 20, 0] },
  add: {
    idle: (t, u) => merge(wind(u), flop(u, 2, 0.6)),
    walk: (t, u) => merge(wind(u), flop(u, 2, 1.2), { tip: { r: [-8, 0, 0] } }),
    idle_look: (t, u) => merge(wind(u), flop(u, 1)),
    windup: (t, u) => merge(wind(u, 0.25, 0.25), { windA: { s: 1 - 0.15 * u }, windB: { s: 1 - 0.15 * u } }),
    lunge: (t, u) => merge(wind(u, 0.5, 0.5), flop(u, 1, 2), { windA: { s: 0.85 + 0.3 * K(u, [[0, 0], [0.4, 1], [1, 0.5]]) } }),
    hurt: (t, u) => merge(wind(u, 0.25, 0.25), flop(u, 2, 2)),
    recoil: (t, u) => wind(u, 0.15, 0.15),
    faint: (t, u) => ({ windA: { r: [0, 0, 60 * u], s: 1 - 0.99 * Math.min(1, u / 0.7) }, windB: { r: [0, 0, -60 * u], s: 1 - 0.99 * Math.min(1, u / 0.6) }, tip: { r: [20 * u, 0, 0] } }),
    celebrate: (t, u) => merge(wind(u, 0.5, 1), flop(u, 2, 1.5)),
    enter: (t, u) => merge(wind(u, 0.5, 1), { windA: { s: 0.3 + 0.7 * Math.min(1, u / 0.7) }, windB: { s: 0.3 + 0.7 * Math.min(1, u / 0.7) } }),
    exit: (t, u) => merge(wind(u, 0.5, 1), { windA: { s: 1 + 0.4 * u }, windB: { s: 1 + 0.4 * u } }),
  },
});

const clips = {
  ...base,

  // fidget: it whips the wind up: the rings spin hard, the claws stir the air in circles, the hood tip streams
  idle_gust: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const a = TAU * 3 * u;
      return merge({
        body: { r: [0, 0, 6 * Math.sin(a / 3) * on] },
        head: { r: [-6 * on, 0, -4 * Math.sin(a / 3) * on] },
        ...face.pose('open', blinks(u, [[0.88, 0.93]])),
        ...both('arm', { r: [-15 * on + 8 * Math.sin(a) * on, -10 * on, 8 * Math.cos(a) * on] }, { r: [-15 * on - 8 * Math.sin(a) * on, -10 * on, -8 * Math.cos(a) * on] }),
        ...both('fore', { r: [0, 0, 15 * Math.sin(a) * on] }),
      }, wind(u, 1.5, 3), flop(u, 3, 1.6));
    },
  },

  // fidget: it ducks into its hood, peeks out sideways, and pops back up
  idle_peek: {
    seconds: 2,
    pose: (t, u) => {
      const duck = win(u, 0.1, 0.75, 0.12);
      const peek = K(u, [[0, 0], [0.3, 0], [0.4, 1], [0.6, 1], [0.7, 0]]);
      return merge({
        body: { p: [0, 0, -0.5 * duck] },
        head: { r: [14 * duck, 0, 18 * peek] },
        ...face.pose(duck > 0.5 && peek < 0.3 ? 'shut' : 'open'),
        ...both('arm', { r: [-20 * duck, 10 * duck, 0] }),
        ...both('fore', { r: [-30 * duck, 0, 0] }),
      }, wind(u), flop(u, 1));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
