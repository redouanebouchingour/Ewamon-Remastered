// Verdatide's rig: a great sea turtle with a meadow on its shell (the body), a big old head turned 25 degrees to its
// left out of the shell's hood with a long moss beard (mane1), and four leaf-shaped flippers as the legs. The template's
// walk swings legs with rx, which would drive a flipper lying out sideways into the ground: here stride is 0 and the
// walk paddles them with rz through `add`. Numbers are scad/verdatide.scad's. The head sits in
// headFrame() translate(HM) scale(1.1) translate(-HM): HF maps the head's own numbers p (minus HM) to the world; the neck
// and the hood's cut sit in headFrame() alone (NF).
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny, near, rot, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const SHELL = [[0.13, 0.2, 0.15], [0.36, 0.48, 0.26], [0.42, 0.55, 0.28], [0.57, 0.7, 0.35], [0.46, 0.57, 0.29],
  [0.93, 0.82, 0.38], [0.82, 0.5, 0.82], [0.45, 0.62, 0.95], [0.42, 0.44, 0.42], [0.63, 0.63, 0.58], [0.45, 0.38, 0.26]];
const BARNACLE = [[0.63, 0.63, 0.58], [0.3, 0.31, 0.29]];
const FACE = [[0.5, 0.6, 0.4], [0.38, 0.49, 0.31], [0.1, 0.13, 0.08], [0.06, 0.07, 0.05], [1, 1, 1]];
const BEARD = [[0.59, 0.53, 0.3], [0.46, 0.57, 0.29], [0.3, 0.4, 0.25], [0.37, 0.48, 0.28]];
const SKIN_DARK = [0.21, 0.3, 0.22];

const NP = [0, -8, 17];
const HY = 25;
const HM = [0, -15, 19.4];
const rz = (v) => rot([0, 0, HY], v);
const NF = subFrame(NP.map((v, i) => v - rz(NP)[i]), [0, 0, HY]);
const HF = subFrame(NP.map((v, i) => v + rz([HM[0] - NP[0], HM[1] - NP[1], HM[2] - NP[2]])[i]), [0, 0, HY], 1.1);
const H = (p) => HF.world([p[0] - HM[0], p[1] - HM[1], p[2] - HM[2]]);
const headP = (c) => { const q = HF.local(c); return [q[0] + HM[0], q[1] + HM[1], q[2] + HM[2]]; };

const eyeL = { side: 'L', at: [3.17, -18.6 - HM[1], 20.6 - HM[2]], size: 1.5, yaw: 38, flat: 0.5, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.3, 0.4, 0.25] });

const FS = [9, -4, 13]; const FR = [11, -7, 11]; const FT = [27.5, -1, 0.6];
const BS = [11, 10, 10]; const BR = [12.5, 13, 9]; const BT = [16, 23, 4.5];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: FS },
  { name: 'legFR', parent: 'root', at: [-FS[0], FS[1], FS[2]] },
  { name: 'legBL', parent: 'root', at: BS },
  { name: 'legBR', parent: 'root', at: [-BS[0], BS[1], BS[2]] },
  { name: 'body', parent: 'root', at: [0, 4, 12] },
  { name: 'head', parent: 'body', at: NP },
  { name: 'mane1', parent: 'head', at: H([0, -19, 15.6]) },
  { name: 'tail1', parent: 'body', at: [0, 20, 9] },
  ...face.joints,
];

const parts = [
  ['legF*', any(limb(FS, FR, 2.9), limb(FR, FT, 5.5, 1.4))],
  ['legB*', any(limb(BS, BR, 2.2), limb(BR, BT, 4, 1))],
  ['body', any(ell([18.5, 21, 22], [0, 4, 14]), ell([12, 14, 4], [0, 4, 9.6]))],
  ['tail1', spike([0, 20, 9], [0, 4, -3], 1.6)],
];

function assign(c, rgb) {
  if (isAny(rgb, BARNACLE, 0.03) && c[2] < 14) return `leg${c[1] < 5 ? 'F' : 'B'}${c[0] >= 0 ? 'L' : 'R'}`;
  const P = headP(c);
  // the beard: strands under the jaw
  if (isAny(rgb, BEARD, 0.03) && P[2] < 16.4 && Math.abs(P[0]) < 6.5 && P[1] < -11 && P[1] > -24) return 'mane1';
  if (isAny(rgb, FACE, 0.03) || (near(rgb, [0.3, 0.4, 0.25], 0.03) && P[2] > 16)) return 'head';
  if (near(rgb, SKIN_DARK, 0.03)) {
    // the neck in the hood (head), the hood's cut and the body under the shell (body)
    const n = NF.local(c);
    const neck = ellD(n, [6.6, 6, 6.4], [0, -9, 17.5]);
    const hood = Math.abs(ellD(n, [10, 10.4, 11.3], [0, -15, 13.4]) - 1);
    const under = ellD(c, [12, 14, 4], [0, 4, 9.6]);
    return neck - 1 < Math.min(hood, under - 1) ? 'head' : 'body';
  }
  if (isAny(rgb, SHELL, 0.03) && c[2] > 8) return 'body';
  return pick(c, parts);
}

const paddle = (u, amp, cycles = 1) => legs(
  { r: [0, -4 * Math.max(0, osc(u, cycles, 0.25)), amp * osc(u, cycles)] },
  { r: [0, 0, 0.5 * amp * osc(u, cycles, 0.5)] },
  { r: [0, -4 * Math.max(0, osc(u, cycles, 0.75)), amp * osc(u, cycles, 0.5)] },
  { r: [0, 0, 0.5 * amp * osc(u, cycles)] },
);
const beard = (u, amp, cycles = 2) => ({ mane1: { r: [amp * osc(u, cycles), 0, 0.6 * amp * osc(u, cycles, 0.25)] } });

const clips = quadrupedClips({
  face, tail: ['tail1'], hipH: 4, stride: 0,
  add: {
    idle: (t, u) => beard(u, 3, 2),
    walk: (t, u) => merge(paddle(u, 14), beard(u, 6, 2), { body: { r: [0, 0, 2 * osc(u, 1)] } }),
    idle_shake: (t, u) => beard(u, 14 * win(u, 0.1, 0.9, 0.05), 8),
    lunge: (t, u) => beard(u, 10, 1),
    hurt: (t, u) => beard(u, 12, 3),
    celebrate: (t, u) => merge(paddle(u, 16, 2), beard(u, 10, 2)),
    // the template splays the legs up 48 degrees, which stands a flipper on its edge into the shell: keep the flippers
    // flat on the ground and let the shell sink onto them instead
    faint: (t, u) => {
      const down = smooth((u - 0.15) / 0.6);
      const sink = 4 * (1 - Math.cos((48 * down * Math.PI) / 180));
      return merge(legs({ r: [0, 44 * down, 0] }), { root: { p: [0, 0, sink] }, body: { p: [0, 0, -1.6 * down] } });
    },
  },
});

// fidget: a slow, sage nod, then strokes the beard with a front flipper
clips.idle_ponder = {
  seconds: 3.6,
  pose: (t, u) => {
    const nod = K(u, [[0, 0], [0.15, 1], [0.3, 0], [0.4, 1], [0.5, 0]]);
    const stroke = win(u, 0.55, 0.9, 0.08);
    return merge({
      head: { r: [8 * nod - 4 * stroke, 0, 8 * stroke] },
      legFL: { r: [0, -18 * stroke, -26 * stroke + 6 * stroke * osc(u, 6)] },
      ...face.pose(nod > 0.5 ? 'shut' : 'open', stroke * 0.4),
    }, beard(u, 4 + 6 * stroke, 6));
  },
};

// fidget: a big sigh that lifts the shell, the meadow's flowers trembling with it
clips.idle_sigh = {
  seconds: 2.4,
  pose: (t, u) => {
    const b = Math.sin(Math.PI * Math.min(1, u / 0.85));
    return merge({
      body: { p: [0, 0, 0.7 * b], s: [1 + 0.02 * b, 1 + 0.02 * b, 1 + 0.03 * b] },
      head: { r: [-6 * b, 0, 0] },
      ...face.pose(b > 0.6 ? 'shut' : 'open'),
    }, beard(u, 4 * b, 4), { tail1: { r: [0, 0, 10 * Math.sin(TAU * 2 * u) * b] } });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
