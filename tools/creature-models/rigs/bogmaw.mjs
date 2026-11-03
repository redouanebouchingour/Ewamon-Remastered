// Bogmaw's rig: a huge squat warty bog toad on thick bent legs, a domed head with small heavy-lidded eyes on top, a
// grin of big flat teeth over a bulging orange throat sac (the jaw), moss and warts over its back and a thick tail
// curling round its left hind foot. Numbers are scad/bogmaw.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick } from './lib/biped.mjs';
import { chain } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const HIDE = [0.39, 0.35, 0.29];
const THROAT = [[0.73, 0.51, 0.36], [0.42, 0.29, 0.22]];
const MOSS = [0.42, 0.47, 0.27];
const MOUTH = [[0.76, 0.67, 0.52], [0.11, 0.1, 0.08], [0.5, 0.45, 0.37]];   // teeth, gum ink, lip ridge
const EYE = [[0.8, 0.71, 0.55], [0.62, 0.5, 0.32]];

const EYE_AT = [7.1, -15.9, 37.3];
const eyeL = { side: 'L', at: EYE_AT, size: 1.6, yaw: 22, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: HIDE });

const TAIL = [[0, 18, 10], [8, 25, 7.5], [16, 26, 5.5], [23, 20, 3.5], [25, 11, 2], [22.5, 3, 0.9]];
const TAIL_R = [5.6, 5, 4.2, 3.2, 2, 0.7];
const tail = ['tail1', 'tail2', 'tail3'];

const CRAN = [[15.6, 11.5, 9.6], [0, -10, 29]];
const JAW = [[16.2, 12.3, 2.4], [0, -10.4, 27.4]];
const THR = [[16.6, 12.9, 3.6], [0, -10.8, 24.4]];
const SAC = [[11.5, 9.5, 4], [0, -11, 19.8]];
const HAU = [[7.5, 10, 8.5], [13.5, 9, 10]];

const joints = [
  { name: 'root', at: [0, 2, 0] },
  { name: 'legFL', parent: 'root', at: [12, -11, 15] },
  { name: 'legFR', parent: 'root', at: [-12, -11, 15] },
  { name: 'legBL', parent: 'root', at: HAU[1] },
  { name: 'legBR', parent: 'root', at: [-HAU[1][0], HAU[1][1], HAU[1][2]] },
  { name: 'body', parent: 'root', at: [0, 4, 12] },
  { name: 'head', parent: 'body', at: [0, -4, 27] },
  { name: 'jaw', parent: 'head', at: [0, -3, 27.5] },
  { name: 'eyeL', parent: 'head', at: EYE_AT },
  { name: 'eyeR', parent: 'head', at: [-EYE_AT[0], EYE_AT[1], EYE_AT[2]] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[3] },
  ...face.joints,
];

const fingers = (c, [x, y], n, len, r1, r2, z0, z1) => any(...n.map((a) => limb([x, y, z0], [x + Math.sin(a * Math.PI / 180) * len, y - Math.cos(a * Math.PI / 180) * len, z1], r1, r2)))(c);

const parts = [
  ['eye*', ell([1.8, 1.45, 1.85], EYE_AT)],
  ['legF*', any(limb([12, -11, 15], [15.5, -14.5, 8], 5.2, 4.4), limb([15.5, -14.5, 8], [13, -18, 3], 4.4, 3.3), ell([4.2, 4.2, 1.8], [13, -19, 1.8]),
    (c) => fingers(c, [13, -19], [-55, -18, 18, 55], 4.6, 1.4, 0.85, 1.4, 0.85))],
  ['legB*', any(ell(HAU[0], HAU[1]), limb([17.5, 3, 6.5], [17.5, 12, 2.6], 3.2, 2.4), limb([17.5, 12, 2.2], [17, 2, 1.4], 2.2, 1.6),
    (c) => fingers(c, [17, 2], [-40, -12, 15, 42], 3.6, 0.9, 0.65, 1.2, 0.7))],
  ['body', any(blob([[[14.5, 11, 9], [0, -4, 29.5]], [[15, 12, 9], [0, 5, 27]], [[17, 16, 12.5], [0, 6, 18]], [[13, 9, 9], [0, 17, 13]]]),
    ell([10.5, 8, 6], [0, -1.5, 13.5]))],
  ['head', any(ell(...CRAN), ell([15.3, 11.4, 1.3], [0, -10, 33.5]), ell([3.3, 3.2, 2.8], [6.8, -13.5, 36.6]), ell([3.3, 3.2, 2.8], [-6.8, -13.5, 36.6]),
    ell([15.6, 11.6, 2.6], [0, -10, 30.4]))],
  ['jaw', blob([JAW, THR, SAC])],
  ...chain(['tail1', 'tail2', 'tail2', 'tail3', 'tail3'], TAIL, TAIL_R),
];

function assign(c, rgb) {
  if (c[2] > 34 && (isAny(rgb, EYE, 0.03) || near(rgb, MOUTH[1], 0.03))) return c[0] >= 0 ? 'eyeL' : 'eyeR';
  if (isAny(rgb, MOUTH, 0.03)) return 'head';
  if (isAny(rgb, THROAT, 0.03)) return 'jaw';
  if (near(rgb, MOSS, 0.03) && c[1] < -16 && c[2] < 27.5) return 'jaw';      // moss drips off the lower lip
  return pick(c, parts);
}

const clips = quadrupedClips({
  face, tail, hipH: 9, stride: 10,
  add: {
    idle: (t, u) => ({ jaw: { s: [1 + 0.04 * (osc(u, 4) * 0.5 + 0.5), 1, 1 + 0.08 * (osc(u, 4) * 0.5 + 0.5)] } }),
  },
});

// fidget: the throat sac swells huge and lets out a deep croak, twice
clips.idle_croak = {
  seconds: 2.4,
  pose: (t, u) => {
    const sw = (u0) => K(u, [[u0, 0], [u0 + 0.18, 1], [u0 + 0.28, 1], [u0 + 0.36, 0]]);
    const s = sw(0.08) + sw(0.5);
    return merge({
      jaw: { s: [1 + 0.12 * s, 1 + 0.1 * s, 1 + 0.22 * s], r: [-3 * s, 0, 0] },
      head: { r: [-5 * s, 0, 0] },
      body: { r: [-2 * s, 0, 0] },
      ...face.pose(s > 0.5 ? 'shut' : 'open'),
    }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 4 * (1 + 0.3 * i) * osc(u, 2)] }])));
  },
};

// fidget: snaps at a fly, the maw clapping shut with a satisfied grin
clips.idle_fly = {
  seconds: 2,
  pose: (t, u) => {
    const look = K(u, [[0, 0], [0.2, 1], [0.45, 1], [0.6, 0]]);
    const snap = K(u, [[0.4, 0], [0.47, 1], [0.55, 0]]);
    const grin = win(u, 0.6, 0.95, 0.06);
    return {
      head: { r: [-10 * look + 8 * snap, 0, 18 * look] },
      jaw: { r: [24 * snap, 0, 0] },
      ...face.pose(grin > 0.4 ? 'happy' : 'open'),
    };
  },
};

// The throat sac hangs off the head but sits on the chest: blend that seam too, or a head nod cracks it open.
export default rigDef({ joints, assign, extras: face.extras, clips, seams: { allow: [['body', 'jaw']] } });
