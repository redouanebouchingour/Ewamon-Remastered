// Lawlander's rig: a stout badger sheriff in a wide stance, his head turned to his right (profile in the art), the
// right paw hanging, the left one resting over the holster. A poncho capelet (with the body) and a long back cape in two
// links (cape1 over the back, cape2 the hem and the flap flying out to his left), a cowboy hat (its own joint, for
// tipping) and a grass stalk in the mouth (chewed). Numbers are scad/lawlander.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { near, subFrame } from './lib/geo.mjs';

// headFrame(): translate(HEAD_T) rotate(HEAD_R) scale(HEAD_S); the hat inside it: translate([0, -4, 3.1]) rotate([14, 0, 0])
const HEAD = subFrame([-1.2, -4.4, 32.4], [0, 0, -35], 1.15);
const HATF = subFrame([0, -4, 3.1], [14, 0, 0]);
const HAT = { world: (p) => HEAD.world(HATF.world(p)), local: (c) => HATF.local(HEAD.local(c)) };

const eyeL = { side: 'L', at: [2.3, -4.3, 1.25], size: 0.82, yaw: 55, frame: HEAD };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.32, 0.24, 0.21] });

// the back cape: a shell of the hull from the shoulder ellipse (z 27.5) to the hem ellipse (z 9), 0.9 thick
const capeD = (c) => {
  if (c[2] < 7.5 || c[2] > 29.5) return 9;
  const f = Math.min(1, Math.max(0, (27.5 - c[2]) / 18.5));
  const rx = 8.9 + 12.1 * f; const ry = 7 + 2 * f; const cx = 3.5 * f; const cy = 1 + 2 * f;
  return 1 + Math.abs(Math.hypot((c[0] - cx) / rx, (c[1] - cy) / ry) - 1) * ry / 0.7;
};
const cape = (lo, hi) => (c) => (c[2] >= lo && c[2] < hi ? capeD(c) : 9);
// the shoulder capelet: a shell of ell([12, 9, 8.8]) at [0, 0.5, 24], above z 23.4
const mantle = (c) => (c[2] < 23 ? 9 : 1 + Math.abs(ell([12, 9, 8.8], [0, 0.5, 24])(c) - 1) * 9 / 0.7);

const HIP = [4.2, 0.5, 12.5];

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', HIP),
  { name: 'body', parent: 'root', at: [0, 0.5, 13] },
  { name: 'head', parent: 'body', at: [-0.6, -2.6, 28.6] },
  { name: 'hat', parent: 'head', at: HAT.world([0, 0, 0]) },
  { name: 'wheat', parent: 'head', at: HEAD.world([0.8, -7.3, -1.7]) },
  { name: 'cape1', parent: 'body', at: [0, 2.5, 27.5] },
  { name: 'cape2', parent: 'cape1', at: [2.5, 4.5, 18.5] },
  { name: 'armL', parent: 'body', at: [9.2, 0, 26] },
  { name: 'foreL', parent: 'armL', at: [12.8, 1.5, 21.5] },
  { name: 'handL', parent: 'foreL', at: [10.7, -4.5, 18.6] },
  { name: 'armR', parent: 'body', at: [-9.8, -1, 26] },
  { name: 'foreR', parent: 'armR', at: [-13.2, -2, 19.6] },
  { name: 'handR', parent: 'foreR', at: [-14.6, -3, 15.6] },
  ...face.joints,
];

const leg = (s, toe) => any(
  limb([4.2 * s, 0.5, 12.5], [s > 0 ? 8.2 : -7.5, s > 0 ? 0.5 : -1, 7], 4.2, 3.4),
  limb([s > 0 ? 8.2 : -7.5, s > 0 ? 0.5 : -1, 7], [8.2 * s, s > 0 ? 0.5 : -1.5, 4.6], 3.4, 3.1),
  limb([8.2 * s, 0, 5.4], [8.2 * s, 0, 2], 2.4, 2.3),
  blob([[[2.3, 2.5, 1.6], [8.2 * s, 0, 1.6]], [[1.7, 2, 1.35], toe]]),
  ell([2.5, 2.6, 0.6], [8.2 * s, -0.3, 2.6]), ell([0.6, 1.1, 1.1], [8.2 * s, 2.2, 2.6]),
);

export const parts = [
  ['body', any(ell([8.5, 7, 7], [0, 0, 21]), ell([7.8, 6.4, 3], [0, 0.5, 15.5]), limb([0, 0, 21], [0, 0.5, 15.5], 6.4), ell([7.6, 6.2, 4], [0, 0.5, 13.5]),
    ell([4.4, 4.6, 3], [0, 0, 10.8]), mantle,
    // bandana: the neck band, the triangle, the knot and its tails
    ell([6.4, 6.2, 1.2], [0, -1, 28.6]), limb([-6.9, -5.6, 28.2], [0.5, -7.6, 22.4], 0.9), limb([6.9, -5.6, 28.2], [0.5, -7.6, 22.4], 0.9),
    limb([-6.9, -5.6, 28.2], [6.9, -5.6, 28.2], 0.9), ell([1.3, 1.2, 1.2], [5, 2.6, 30.4]), limb([5.6, 3.6, 31], [5.6, 3.6, 36.4], 1.1), limb([7.4, 2.6, 30.6], [8.4, 2.6, 34.4], 0.95),
    // holster, gun and lasso on the left hip
    blob([[[1.5, 1.3, 2.6], [9.6, -1.4, 11.2]], [[1.1, 1.0, 1.2], [9.9, -1.6, 7.8]]]), limb([9.4, -1.5, 13.4], [9.0, -2.6, 15.2], 0.9),
    ell([2.6, 3.4, 4.6], [10.8, 2.6, 10.6]), limb([11, 1.6, 6.8], [11.6, 0.6, 3.8], 0.4))],
  ['head', inFrame(HEAD, any(ell([3.9, 4.1, 3.7], [0, 0.5, 0.5]), mx(ell([2.9, 2.8, 2.6], [2, -1.6, -1])), limb([0, -3, -0.6], [0, -7.8, -0.75], 2.6, 1.45),
    ell([1.45, 1, 1.05], [0, -8.95, -0.35]), ell([3.4, 3.2, 2.8], [0, 2.2, -2.8]), mx(ell([1.2, 2.2, 2], [3.7, 0.9, -1.4])),
    mx(ell([0.95, 0.6, 1.0], [3.2, 1.4, 3.3])), mx(ell([0.82, 0.6, 0.95], [2.3, -4.3, 1.25]))))],
  ['hat', inFrame(HAT, any(ell([9.4, 7.6, 1.2], [0, 0, 0.6]), ell([4.9, 4.5, 4.4], [0, 0, 2.2]), ell([3.9, 4, 1.6], [0, 0, 4.4])))],
  ['wheat', inFrame(HEAD, limb([0.8, -7.3, -1.7], [-0.4, -11.6, -2.8], 0.6, 0.6))],
  ['cape1', cape(18.5, 99)],
  ['cape2', cape(0, 18.5)],
  ['armR', any(ell([3.1, 3.1, 3.1], [-9.8, -1, 26]), limb([-9.8, -1, 26], [-13.2, -2, 19.6], 2.9, 2.6))],
  ['foreR', any(ell([2.6, 2.6, 2.6], [-13.2, -2, 19.6]), limb([-13.2, -2, 19.6], [-14.6, -3, 15.6], 2.6, 2.3), ell([2.85, 2.85, 0.6], [-13.8, -2.4, 18.2]))],
  ['handR', any(ell([2.7, 2.5, 2.8], [-15.4, -3.5, 13.2]), limb([-15.4, -3.5, 11.7], [-16, -5, 7.8], 1.9, 0.6))],
  ['armL', any(ell([3.4, 3.4, 3.2], [9.2, 0, 26]), limb([9.2, 0, 26], [12.8, 1.5, 21.5], 3.3, 2.7))],
  ['foreL', any(ell([2.6, 2.6, 2.6], [12.8, 1.5, 21.5]), limb([12.8, 1.5, 21.5], [10.7, -4.5, 18.6], 2.6, 2.2), ell([2.7, 2.7, 0.6], [11.3, -2.6, 19.4]))],
  ['handL', any(ell([2.2, 2.3, 2], [9.2, -6.2, 17.9]), limb([9.2, -7.4, 16.9], [9.2, -8, 13.9], 1.7, 0.6))],
  ['legL', leg(1, [8.9, -3.6, 1.35])],
  ['legR', leg(-1, [-9.8, -6.2, 1.35])],
];

// colour decides which joints a triangle may go to (the hat sits right over the eyes, the capelet over the shoulders,
// the belt over the thighs); the primitives then pick among those. Rules: [[colours], [joints]], the first match wins,
// anything else goes to the body or the cape.
const LEGS = ['legL', 'legR', 'body'];
const FORE = ['foreL', 'foreR', 'handL', 'handR'];
export const colourRules = [
  [[[0.36, 0.29, 0.26], [0.19, 0.15, 0.13]], ['hat']],
  [[[0.92, 0.8, 0.5]], ['hat', 'body']],
  [[[0.74, 0.65, 0.38]], ['wheat']],
  [[[0.87, 0.8, 0.67], [0.76, 0.7, 0.62], [0.62, 0.55, 0.48], [0.32, 0.24, 0.21], [0.52, 0.44, 0.38], [0.28, 0.22, 0.21],
    [0.93, 0.6, 0.18], [0.11, 0.05, 0.05], [1, 1, 1]], ['head', 'body']],
  [[[0.44, 0.31, 0.24], [0.21, 0.15, 0.15], [0.62, 0.65, 0.68]], LEGS],
  [[[0.66, 0.47, 0.31]], FORE],
  [[[0.85, 0.77, 0.64], [0.9, 0.85, 0.74]], ['handL', 'handR']],
  [[[0.25, 0.33, 0.45]], ['armL', 'armR', 'foreL', 'foreR', 'body']],
  [[[0.43, 0.29, 0.21]], ['foreL', 'foreR', 'body', 'cape1', 'cape2']],
];
export const assignWith = (rules) => (list) => (c, rgb) => {
  const hit = rules.find(([cols]) => cols.some((k) => near(rgb, k, 0.015)));
  const ok = hit ? hit[1] : ['body', 'cape1', 'cape2'];
  return pick(c, list.filter(([n]) => ok.includes(n)));
};
export const assign = assignWith(colourRules);

const addAll = (...maps) => Object.fromEntries([...new Set(maps.flatMap((m) => Object.keys(m)))]
  .map((k) => [k, (t, u) => merge(...maps.map((m) => m[k]?.(t, u)))]));

// the stalk bobs as he chews; it flips on a hit
const chew = {
  idle: (t, u) => ({ wheat: { r: [0, 6 * osc(u, 4), 4 * osc(u, 2)] } }),
  walk: (t, u) => ({ wheat: { r: [0, 4 * osc(u, 2), 0] } }),
  hurt: (t, u) => ({ wheat: { r: [0, 20 * Math.sin(TAU * 2 * u) * (1 - u), 0] }, hat: { r: [-10 * Math.sin(Math.PI * u), 0, 0], p: [0, 0, 0.8 * Math.sin(Math.PI * u)] } }),
  faint: (t, u) => ({ hat: { r: [14 * K(u, [[0.2, 0], [0.8, 1]]), 0, 0] } }),
};

export const clipsFor = (extra = {}) => {
  const base = bipedClips({
    face, hipH: 12.5, stride: 16, armSwing: 14, hopScale: 0.4, droop: 0.6, cape: ['cape1', 'cape2'],
    punch: { arm: [-80, 0, 0], fore: [-15, 0, 0] },
    add: addAll(chew, extra),
  });
  return {
    ...base,

    // fidget: a slow tip of the hat with the left paw, eyes half shut
    idle_tip: {
      seconds: 2.6,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.25, 1], [0.7, 1], [0.9, 0]]);
        const tip = win(u, 0.32, 0.62, 0.08);
        return {
          head: { r: [6 * tip, 0, 8 * up] },
          hat: { r: [14 * tip, 0, 0] },
          ...face.pose('open', 0.5 * up),
          armL: { r: [-70 * up, -20 * up, 0] }, foreL: { r: [-50 * up, 0, 0] },
          wheat: { r: [0, 6 * osc(u, 3), 0] },
        };
      },
    },

    // fidget: the paw hovers over the holster, taps twice, and he settles back with a smug chew
    idle_draw: {
      seconds: 2.4,
      pose: (t, u) => {
        const at = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.92, 0]]);
        const tap = Math.max(0, Math.sin(TAU * 4 * u)) * win(u, 0.3, 0.7, 0.04);
        return {
          body: { r: [0, 0, 6 * at] },
          head: { r: [-4 * at, 0, 10 * at] },
          ...face.pose('open', 0.4 * at + blinks(u, [[0.8, 0.86]])),
          armL: { r: [6 * at, -6 * at, 0] }, foreL: { r: [8 * at, 0, 0] },
          handL: { r: [-12 * tap, 0, 0] },
          wheat: { r: [0, 12 * osc(u, 4) * (1 - at), 0] },
        };
      },
    },
  };
};

export default rigDef({ joints, assign: assign(parts), extras: face.extras, clips: clipsFor() });
