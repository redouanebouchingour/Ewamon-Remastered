// Nebucloak's rig: a small mint imp in a big teardrop hood (the tip flops) and a short flared cape (one joint: the shell
// can't bend), clawed hands raised, two rings of wind crescents circling it on their own joints. Numbers are
// scad/nebucloak.scad's; the legs are posed apart (the near one straight, the far one bent), so each has its own test.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { chainHit, ellD, isAny, near, side, subFrame } from './lib/geo.mjs';

const SKIN = [0.45, 0.69, 0.65];
const CREAM = [0.9, 0.9, 0.73];
const PALE = [0.85, 0.9, 0.82];
const HOOD = [0.25, 0.14, 0.41];
const CAPE = [[0.46, 0.34, 0.67], [0.6, 0.18, 0.58]];
const GEM = [0.78, 0.12, 0.66];
const SHINE = [1, 0.72, 1];
const INK = [0.14, 0.12, 0.2];
const WIND = [0.64, 0.84, 0.9];

const add3 = (a, b) => a.map((v, i) => v + b[i]);
const LEG_N = [[2.2, -0.3, 9.2], [5.4, -0.6, 5.6], [6.0, -0.6, 2.2], [5.6, -1.6, 0.4]];
const LEG_F = [[-2.2, -0.3, 9.2], [-5.8, -0.6, 6.3], [-1.6, -0.9, 2.4], [-1.2, -1.9, 0.4]];
const LEG_R = [2.3, 1.6, 1.15, 0.45];
const legTest = (P) => any(...[0, 1, 2].map((i) => limb(P[i], P[i + 1], LEG_R[i] + 0.25, LEG_R[i + 1] + 0.25)), ell([0.55, 0.6, 0.5], add3(P[3], [0, -0.1, 0.25])));
const BODY = [[[4.2, 3.6, 3.4], [0, 0, 10]], [[3.4, 3, 3], [0, 0, 15.5]]];
const ARM = [[3.6, -1, 16.8], [7.4, -1, 15.4], [10.2, -1.6, 18]];
const HAND = [10.9, -1.8, 19.2];
const FINGERS = [[-0.95, [-0.55, -0.1, 1.9]], [0.05, [0.05, -0.3, 2.1]], [1.0, [0.75, -0.1, 1.8]]];
const COLLAR = [[5.8, 5.0, 2.4], [0, 0.3, 19.6]];

// the head group is turned 10 degrees towards +X; everything in it is written in that frame
const HF = subFrame([0, -0.5, 27.8], [0, 0, 10]);
const HEAD = [7.7, 5.7, 6.8];
const HEAD_C = [0, -1, 0];
const TIP = [[2.5, 3, 9.4], [5.4, 4, 9.8], [8.4, 4.6, 9.2], [10.8, 5, 7.6]];
const TIP_R = [3.2, 2.4, 1.4, 0.35];
const TIP_W = TIP.map((p) => HF.world(p));
const EYE = [4.15, -5.4, -1.0];

// the almond eyes fit lib.scad eye()'s envelope; the lids are cream like the face
const eye = (S) => {
  const k = S === 'L' ? 1 : -1;
  return { side: S, at: [EYE[0] * k, EYE[1], EYE[2]], size: 2.3, flat: 0.42, yaw: 24 * k, frame: HF };
};
const face = eyeKit({ eyes: [eye('L'), eye('R')], skin: CREAM });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEG_N[0] },
  { name: 'legR', parent: 'root', at: LEG_F[0] },
  { name: 'body', parent: 'root', at: [0, 0, 9.5] },
  { name: 'cape1', parent: 'body', at: [0, 1, 19.8] },
  { name: 'head', parent: 'body', at: [0, -0.5, 21] },
  { name: 'tip', parent: 'head', at: TIP_W[1] },
  ...pair('arm*', 'body', ARM[0]),
  ...pair('fore*', 'arm*', ARM[1]),
  ...pair('hand*', 'fore*', ARM[2]),
  { name: 'windA', parent: 'root', at: [0, 1, 28] },
  { name: 'windB', parent: 'root', at: [1, 1, 7] },
  ...face.joints,
];

const parts = [
  ['legL', legTest(LEG_N)],
  ['legR', legTest(LEG_F)],
  ['body', any(blob(BODY), ell(...COLLAR))],
  ['arm*', limb(ARM[0], ARM[1], 1.55, 1.35)],
  ['fore*', limb(ARM[1], ARM[2], 1.35, 1.15)],
  ['hand*', any(ell([1.9, 1.5, 1.75], HAND), ...FINGERS.map((f) => spike(add3(HAND, [f[0], -0.1, 1.0]), f[1], 0.62)))],
  ['head', inFrame(HF, ell(HEAD, HEAD_C))],
];

function assign(c, rgb) {
  const S = side(c);
  if (near(rgb, WIND)) return c[2] > 17 ? 'windA' : 'windB';
  if (isAny(rgb, CAPE)) return 'cape1';
  if (near(rgb, GEM)) return 'body';
  if (near(rgb, SHINE)) return c[2] < 21 ? 'body' : 'head';         // the gem's glint; the eyes' highlights
  if (near(rgb, PALE)) return `hand${S}`;
  if (near(rgb, INK)) return Math.abs(c[0]) > 6 && c[2] < 26 ? `hand${S}` : 'head';   // claw tips; the smirk
  if (near(rgb, HOOD)) {
    if (c[2] < 18.8 || ellD(c, ...COLLAR) < 1.08) return 'body';     // the capelet and its points
    const h = chainHit(c, TIP_W, TIP_R);
    return h.d < 1.15 && (h.i > 0 || h.t > 0.45) ? 'tip' : 'head';
  }
  if (near(rgb, CREAM)) return c[2] > 20 ? 'head' : pick(c, parts.slice(0, 3));
  if (!near(rgb, SKIN)) return 'head';                                  // the eyes
  return pick(c, parts);
}

// the wind rings: the upper ring is symmetric under a half turn, so half a turn per loop closes it; the lower one turns once
const wind = (u, a = 0.5, b = 1) => ({ windA: { r: [0, 0, 360 * a * u] }, windB: { r: [0, 0, -360 * b * u] } });
const flop = (u, cycles = 1, amp = 1) => ({ tip: { r: [6 * amp * osc(u, cycles), 0, 8 * amp * osc(u, cycles, 0.25)] } });

const base = bipedClips({
  face, cape: ['cape1'], hipH: 9.2, stride: 18, guard: true, hopScale: 0.8,
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
