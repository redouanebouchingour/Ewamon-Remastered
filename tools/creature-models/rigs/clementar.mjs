// Clementar's rig: an elder fennec in a long plaid djellaba, a cluster of oranges held up on each open palm, a bushy
// tail lying along the ground. The robe below the sash is its own joint (skirt, on the root) so the hem stays on the
// ground while the body sways; the feet only peek out, so the walk is a small shuffle. Each wide sleeve is one hull
// from shoulder to wrist, so it moves as one arm joint and the hand (palm + fruit) bends at the wrist. The far arm
// sits 1.8 further out than a mirror of the near one (the scad's `translate([1.8, 0, 0])`). Numbers are
// scad/clementar.scad's.
import { K, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, mx, pick, ppFrame, fromSheet, plate } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const TAN = [0.82, 0.68, 0.38];

// the near (left, +X) arm's numbers; the far one is x -> -(x + 1.8)
const far = ([x, y, z]) => [-(x + 1.8), y, z];
const SHOULDER = [6.2, -1.2, 23.0];
const WRIST = [12.3, -2.8, 19.6];
// the ears: mirror_x() translate(EAR_AT) rotate(EAR_ROT) plates of earPts (x outward, z up from the root), the bands
// 0.42 to 0.5 in front and the back panel 0.42 behind; the pivot where the ear's inner base meets the skull
const EAR = subFrame([6.0, -2.5, 31.3], [-6, 13, 16]);
const earPts = [[-4.0, 1.4], [-3.6, 2.6], [-2.9, 4.0], [-0.5, 6.0], [1.4, 7.7], [2.6, 8.9], [3.6, 9.3], [4.5, 8.8], [4.7, 6.0],
  [4.4, 3.2], [3.4, 1.2], [1.6, -0.4], [-0.4, -0.9], [-2.6, -0.3]];
const EAR_PIVOT = EAR.world([-2.0, 0, 0.6]);
const sashEndPts = [[-7.6, 16.0], [-9.6, 13.8], [-12.2, 12.2], [-14.4, 11.1], [-14.2, 10.2], [-12.4, 9.5], [-12.1, 7.6],
  [-11.0, 7.6], [-10.6, 9.4], [-9.0, 11.2], [-7.4, 13.2]];
// the tail's spine (sheet x, sheet z, depth, radius), 1.3 low like the scad; its segments are scaled 0.9 in y
const TAIL = [[4.8, 11.6, 4.8, 3.2], [7.9, 9.2, 6.4, 4.2], [11.4, 8.7, 7.4, 4.7], [14.4, 10.6, 7.8, 4.3],
  [15.3, 13.9, 7.8, 3.6], [16.4, 16.8, 7.6, 2.7], [17.6, 18.7, 7.4, 1.7], [19.1, 19.2, 7.2, 0.7]].map(([sx, z, d, r]) => [fromSheet(sx, z - 1.3, d), r]);

// the head (scad SKULL, JAW, RUFF, MUZ1 / MUZ2, NOSE, FEZ)
const SKULL = [[0, -2.6, 30.2], [5.2, 4.3, 3.3]];
const JAW = [[0, -4.6, 27.3], [2.9, 2.8, 2.1]];
const RUFF = [[3.5, -3.8, 28.3], [1.8, 1.7, 1.45]];
const FEZ = [0, -3.4, 32.2];

// two eyes, each eye() squashed about its centre by EYE_SQ: translate(EYE) scale(EYE_SQ) translate(-EYE) eye(EYE, ...)
const EYE = [2.4, -6.3, 30.3];
const EYE_SQ = [1.3, 1, 0.62];
const eyeAt = (k) => {
  const at = [k * EYE[0], EYE[1], EYE[2]];
  return { side: k > 0 ? 'L' : 'R', at, size: 1.05, yaw: k * 24, flat: 0.5,
    frame: subFrame(at.map((v, i) => v * (1 - EYE_SQ[i])), [0, 0, 0], EYE_SQ) };
};
// the lid ellipsoid flattened to the almond eye (the frame scales its size by 1.3 all round)
const face = eyeKit({ eyes: [eyeAt(1), eyeAt(-1)], skin: TAN, lid: [1.1, 1.05, 0.62] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.8, -1.6, 3.4] },
  { name: 'legR', parent: 'root', at: [-5.2, -3.6, 3.4] },
  { name: 'skirt', parent: 'root', at: [0, 0, 14.5] },
  { name: 'body', parent: 'root', at: [0, 0, 14.5] },
  { name: 'head', parent: 'body', at: [0, -2, 26.5] },
  { name: 'earL', parent: 'head', at: EAR_PIVOT },
  { name: 'earR', parent: 'head', at: [-EAR_PIVOT[0], EAR_PIVOT[1], EAR_PIVOT[2]] },
  { name: 'armL', parent: 'body', at: SHOULDER },
  { name: 'armR', parent: 'body', at: far(SHOULDER) },
  { name: 'handL', parent: 'armL', at: WRIST },
  { name: 'handR', parent: 'armR', at: far(WRIST) },
  { name: 'tail1', parent: 'skirt', at: TAIL[0][0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[3][0] },
  ...face.joints,
];

// the robe's hull: [z, rx, ry, y centre] rings, linear between them
const ROBE = [[4.8, 9.2, 7.2, -0.4], [10, 8.0, 6.4, -0.2], [15.5, 7.4, 5.8, 0], [21.5, 7.4, 5.8, 0], [24.5, 7.0, 5.4, 0.3], [28, 4.5, 3.6, 2.2]];
const robe = (c) => {
  const z = Math.min(ROBE[ROBE.length - 1][0], Math.max(ROBE[0][0], c[2]));
  let i = 0;
  while (i < ROBE.length - 2 && z > ROBE[i + 1][0]) i++;
  const [z0, ...a] = ROBE[i]; const [z1, ...b] = ROBE[i + 1];
  const k = (z - z0) / (z1 - z0);
  const [rx, ry, cy] = a.map((v, j) => v + (b[j] - v) * k);
  const over = Math.abs(c[2] - z) / 1.4;
  return Math.hypot(c[0] / rx, (c[1] - cy) / ry) + over;
};
const sleeve = (m) => any(limb(m(SHOULDER), m(WRIST), 2.7, 2.2), limb(m(SHOULDER), m([5.8, -1.0, 16.1]), 2.7, 1.0),
  limb(m(WRIST), m([13.0, -2.4, 15.9]), 2.2, 1.0), limb(m([5.8, -1.0, 16.1]), m([13.0, -2.4, 15.9]), 1.3), limb(m([9.8, -2.6, 17.4]), m([9, -1.8, 20.5]), 2.2));
const hand = (m) => any(limb(m([14.0, -4.8, 19.5]), m([16.6, -5.4, 19.8]), 2.1, 1.1), limb(m([13.4, -5.0, 20.2]), m([12.0, -6.2, 21.8]), 0.7),
  ...[[17.0, -5.0, 21.2], [16.2, -7.0, 20.9], [14.6, -7.4, 20.7]].map((p) => limb(m([15.0, -5.4, 20.0]), m(p), 0.7)),
  ...[[10.2, 25.5, -4.6], [8.0, 22.6, -4.8], [12.4, 23.2, -5.4], [12.6, 28.4, -4.4], [14.2, 24.6, -4.6], [6.6, 25.3, -4.6], [10.0, 28.0, -4.6]]
    .map(([sx, z, d], i) => ell(i < 3 ? [2.3, 2.1, 2.0] : [1.4, 1.4, 1.4], m(fromSheet(sx, z, d)))));
const foot = (ankle, toe) => any(limb([ankle[0], ankle[1], 2.4], [ankle[0], ankle[1], 7], 1.5, 1.4), limb([ankle[0], ankle[1], 2.4], [toe[0], toe[1], 1.2], 1.5, 1.4));
const id = (p) => p;

const parts = [
  ['body', any(robe, ell([2.4, 1.5, 2.4], [0, -4.2, 24.8]), plate(sashEndPts, 1.2, ppFrame(3.2)))],
  ['head', any(ell(SKULL[1], SKULL[0]), ell(JAW[1], JAW[0]), mx(ell(RUFF[1], RUFF[0])),
    ell([2.4, 2.3, 2.1], [0, -5.7, 28.4]), ell([1.2, 1.1, 1.0], [0, -8.8, 27.9]), limb([0, -5.7, 28.4], [0, -8.8, 27.9], 2.0, 1.0),
    ell([0.75, 0.6, 0.55], [0, -9.8, 28.2]), mx(ell([1.45, 0.75, 0.8], EYE)),
    limb(FEZ, [FEZ[0], FEZ[1], FEZ[2] + 5.5], 2.95, 2.5), limb([0, -3.4, 37.75], [2.0, -2.9, 37.5], 0.3), limb([2.0, -2.9, 37.5], [2.75, -3.1, 34.8], 0.35))],
  ['ear*', plate(earPts, 1.4, EAR)],
  ['armL', sleeve(id)], ['armR', sleeve(far)],
  ['handL', hand(id)], ['handR', hand(far)],
  ['legL', foot([4.8, -1.6], [7.2, -5.8])], ['legR', foot([-5.2, -3.6], [-7.4, -7.4])],
  ['tail1', any(...TAIL.slice(0, 3).map(([p, r], i) => limb(p, TAIL[i + 1][0], r, TAIL[i + 1][1])))],
  ['tail2', any(...TAIL.slice(3, -1).map(([p, r], i) => limb(p, TAIL[i + 4][0], r, TAIL[i + 4][1])))],
];

/** assign(): nearest primitive; the robe and the sash end below the sash's lower edge hang on the skirt. */
const assign = (c) => {
  const j = pick(c, parts);
  return j === 'body' && c[2] < 14.5 ? 'skirt' : j;
};

// the hem sways a little behind the shuffle
const hem = (u, cycles, amp) => ({ skirt: { r: [0.4 * amp * osc(u, cycles * 2, 0.2), 0, amp * osc(u, cycles, 0.15)] } });

const clips = {
  ...bipedClips({
    face, tail: ['tail1', 'tail2'], hipH: 4, stride: 12, armSwing: 5, hopScale: 0.5, hopH: 1.5,
    punch: { arm: [-40, 0, -10] },
    cheer: { arm: [-10, -35, 0] },
    add: {
      idle: (t, u) => hem(u, 1, 0.6),
      walk: (t, u) => hem(u, 1, 2.5),
      idle_look: (t, u) => hem(u, 1, 0.8),
      celebrate: (t, u) => merge(hem(u, 2, 2), both('hand', { r: [0, 0, 20 * osc(u, 2)] })),
      lunge: (t, u) => hem(u, 1, 1.5),
      hurt: (t, u) => ({ skirt: { r: [-2 * K(u, [[0, 0], [0.2, 1], [1, 0]]), 0, 0] } }),
    },
  }),

  // fidget: juggles. Each palm tosses its oranges up in turn and catches them, the eye following
  idle_juggle: {
    seconds: 2.4,
    pose: (t, u) => {
      const toss = (u0) => { const x = (u - u0) / 0.3; return x > 0 && x < 1 ? Math.sin(Math.PI * x) : 0; };
      const l = toss(0.12); const r = toss(0.5);
      return {
        head: { r: [-8 * (l + r), 0, 10 * l - 10 * r] },
        handL: { p: [0, 0, 3 * l], r: [-10 * l, -12 * l, 0] },
        handR: { p: [0, 0, 3 * r], r: [-10 * r, 12 * r, 0] },
        armL: { r: [0, -6 * win(u, 0.06, 0.24, 0.04), 0] },
        armR: { r: [0, 6 * win(u, 0.44, 0.62, 0.04), 0] },
        ...face.pose('open', blinks(u, [[0.9, 0.95]])),
        ...hem(u, 2, 0.8),
      };
    },
  },

  // fidget: the sly one. A slow knowing tilt of the head and a wink: the near eye shuts to a smug ∩ while the far one
  // stays half-lidded, ears tip back
  idle_wink: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.95, 0]]);
      return {
        body: { r: [0, 0, 4 * on] },
        head: { r: [-4 * on, 10 * on, 14 * on] },
        ...both('ear', { r: [10 * on, -6 * on, 0] }),
        ...face.pose('open', 0.3 * on),
        ...(u > 0.3 && u < 0.7 ? { lidL: { s: [1, 1, 1] }, happyL: { s: 1 } } : {}),
        ...both('hand', { r: [-6 * on, 0, 0] }),
        ...hem(u, 1, 0.5),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
