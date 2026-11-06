// Thornback's rig: a huge hunched bark bear under a mantle of hanging leaves, long thorny arms (shoulder, elbow, paw),
// stumpy trunk legs, a head turned to its right with branching antlers, and an amber heart-stone in its chest (its own
// joint, so it can pulse). Numbers are scad/thornback.scad's; the Tenjin form builds on the pieces below with its own
// head turn, palette and its halo and cape.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny, near, subFrame } from './lib/geo.mjs';

export const PALETTE = {
  bark: [0.36, 0.22, 0.12], barkDk: [0.2, 0.13, 0.08], barkHi: [0.52, 0.33, 0.18], antler: [0.44, 0.28, 0.15],
  leaves: [[0.31, 0.5, 0.19], [0.45, 0.63, 0.21], [0.1, 0.25, 0.12]],
  thorn: [0.93, 0.8, 0.62], muzzle: [0.93, 0.83, 0.68], amber: [[0.93, 0.66, 0.05], [1, 0.93, 0.5], [0.62, 0.3, 0.05]],
};

// the scad's numbers
export const SH = [12.5, 0.5, 22];
export const EL = [16, 1, 12.5];
export const WR = [12.5, -6.5, 10.5];
export const HS = [0.5, -9.8, 18.7];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map((v) => v * k);
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const DEG = Math.PI / 180;
/** scad thornsOn(): pale thorns round a limb, [t, angle, length, radius]. */
const thornsOn = (p1, p2, r, list) => {
  const u = norm(sub(p2, p1));
  const v1 = norm(cross(u, [0, 0, 1]));
  const v2 = cross(v1, u);
  return list.map(([t, a, len, rr]) => {
    const rad = add(mul(v1, Math.cos(a * DEG)), mul(v2, Math.sin(a * DEG)));
    return spike(add(add(p1, mul(sub(p2, p1), t)), mul(rad, r * 0.8)), mul(norm(add(rad, [0, 0, 0.45])), len), rr);
  });
};
const FORE_THORNS = [[0.1, 10, 3.4, 1.25], [0.15, 75, 3, 1.15], [0.38, -25, 3.2, 1.2], [0.42, 40, 3.4, 1.25],
  [0.68, 10, 2.8, 1.05], [0.7, 75, 2.8, 1], [0.35, 120, 2.6, 1], [0.88, 45, 2.4, 0.9], [0.6, -70, 2.6, 1], [0.2, -60, 2.8, 1.05]];
const ARM_THORNS = [[0.5, 0, 3, 1.15], [0.8, -40, 2.8, 1.05], [0.72, 45, 2.8, 1.05], [0.35, -70, 2.6, 1]];
const footF = subFrame([10.8, -2.5, 0], [0, 0, 20]);
const inF = (f, test) => (c) => test(f.local(c));

/** The joints for a head at `head.at` (its scad translate) and the neck pivot. */
export const jointsFor = (head, hs = HS) => [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [10, -0.5, 6.5]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'heart', parent: 'body', at: [hs[0], hs[1] - 0.6, hs[2]] },
  { name: 'head', parent: 'body', at: head.neck },
  ...pair('arm*', 'body', SH),
  ...pair('fore*', 'arm*', EL),
  ...pair('hand*', 'fore*', WR),
];

/** The antler tests of the scad's antler(s) module, for a head at HD. */
const antlerTests = (HD, s) => {
  const B = add(HD, [s * 3.6, 1.8, 3.6]);
  const at = (v) => add(B, [s * v[0], v[1], v[2]]);
  const p1 = at([3.2, 0.5, 2.9]); const p2 = at([7, 1, 5.2]); const q = at([9.8, 1.3, 6.4]); const p3 = at([12.4, 1.6, 8.3]);
  return [limb(B, p1, 1.8, 1.45), limb(p1, p2, 1.45, 1.15), limb(p2, q, 1.15, 0.9), limb(q, p3, 0.9, 0.5),
    limb(p1, at([2.4, 0.2, 8]), 1, 0.45), limb(at([1, 0.2, 1]), at([-0.6, -0.6, 5.2]), 0.8, 0.4),
    limb(p2, at([5.6, 0.6, 8.4]), 0.95, 0.45), limb(q, at([9.4, 1.2, 8.6]), 0.75, 0.4), limb(q, at([14.2, 1.8, 4.6]), 0.75, 0.4)];
};

/** The head's own primitives (inside its translate / rotate). */
const baseHeadTests = (head) => {
  const f = subFrame(head.at, head.rot);
  return any(
    inF(f, ell([5.9, 5.4, 5])), inF(f, ell([6.1, 4.9, 3.8], [0, -0.6, -1.5])),
    inF(f, blob([[[3.1, 2.6, 2.2], [0, -4.6, -1.6]], [[2.7, 1.8, 2], [0, -6.5, -1.4]]])), inF(f, ell([2.7, 3.2, 1.3], [0, -4.9, -3.8])),
    inF(f, (c) => ell([1.8, 1.1, 1.8], [5, 1, 3.6])([Math.abs(c[0]), c[1], c[2]])),
    ...antlerTests(head.at, 1), ...antlerTests(head.at, -1),
    ell([4.5, 4.5, 5.5], add(head.at, [0, 1.5, 8])),   // crown tuft
  );
};

/** The head test: the creature's own (`head.tests`) or the base head's primitives. */
export const headTests = (head) => head.tests ?? baseHeadTests(head);

export const partsFor = (head) => [
  ['body', any(blob([[[12.6, 9.5, 8], [0, 1, 12.5]], [[12.8, 9, 7.5], [0, 0.5, 21]]]), blob([[[9, 8, 4.5], [0, 0.5, 8.5]], [[6, 6, 3], [0, 0, 6]]]),
    ell([13.6, 10.2, 5.6], [0, 0.4, 22.6]), blob([[[12.8, 10, 5], [0, 1.5, 25]], [[8.5, 7.5, 3.5], [0, 2, 29]], [[11.5, 10.2, 4], [0, 2.5, 17]]]))],
  ['body', (c) => {
    const f = [Math.abs(c[0]), c[1], c[2]];
    return Math.min(ellD(f, [4.2, 4.6, 3.4], [10.5, 2.5, 25]), spike([12.5, 0.5, 27], [1.6, -1.2, 3.2], 1.3)(f),
      spike([11.8, 5, 27.5], [1.4, 1.4, 3.2], 1.2)(f), spike([14, 2.5, 24.5], [3, 0.2, 1.6], 1.1)(f));
  }],
  ['head', headTests(head)],
  ['arm*', any(limb(SH, EL, 4.4, 4.3), ...thornsOn(SH, EL, 4.4, ARM_THORNS))],
  ['fore*', any(limb(EL, WR, 4.3, 3.6), ...thornsOn(EL, WR, 4.1, FORE_THORNS))],
  ['hand*', any(ell([3.5, 3.8, 2.8], [12.3, -8.6, 9]), ...[-1.8, -0.6, 0.6, 1.8].map((o) => spike([12.3 + o, -11.4, 8.6], [-0.35 + o * 0.15, -1.9, -1.4], 0.72)))],
  ['leg*', any(ell([5, 5.5, 5.2], [10, -0.5, 6.5]), inF(footF, blob([[[3.9, 4.6, 2], [0, -1, 2]], [[3.4, 3.4, 2.2], [0, 1.5, 2.4]]])),
    ...[-2.1, -0.7, 0.7, 2.1].map((o) => inF(footF, spike([o, -5.2, 1.4], [o * 0.15, -1.6, -0.7], 0.65))),
    spike([14, -1.5, 8.5], [1.6, -0.8, 2.4], 0.95), spike([12.5, -4.5, 5], [0.8, -1.8, 1.8], 0.85))],
];

/** assign() for a palette, a head and extra [joint, test] parts plus colour rules (the Tenjin's). */
export const makeAssign = (C, head, extra = [], rules = () => null) => {
  const parts = [...partsFor(head), ...extra];
  const headD = headTests(head);
  return (c, rgb) => {
    const r = rules(c, rgb);
    if (r) return r;
    // the heart-stone in the chest (the back one stays on the body)
    if (isAny(rgb, C.amber) && c[1] < -7) return 'heart';
    if (isAny(rgb, C.amber)) return 'body';
    if (isAny(rgb, C.leaves)) return headD(c) < 1.05 && c[2] > (head.tuftZ ?? 31) ? 'head' : 'body';
    if (near(rgb, C.antler) || near(rgb, C.muzzle)) return 'head';
    if (!isAny(rgb, [C.bark, C.barkDk, C.barkHi, C.thorn])) return 'head';   // eyes, nose, mouth
    return pick(c, parts);
  };
};

export const faceFor = (head, e, skin) => {
  const frame = subFrame(head.at, head.rot);
  const eye = { side: 'L', frame, ...e };
  return eyeKit({ eyes: [eye, mirrorEye(eye)], skin });
};

/** The clips, for a face and extra pose layers per clip. */
export const clipsFor = ({ face, extra = {}, cape = [] }) => {
  const base = bipedClips({
    face, cape, hipH: 6.5, stride: 12, armSwing: 10, hopScale: 0.15, droop: 0.55,
    // a big overhead-forward swipe of the right paw
    punch: { arm: [-95, 15, 0], fore: [-20, 0, 0] },
    cheer: { arm: [-20, -95, 0], fore: [-10, 10, 0] },
    add: {
      ...extra,
      // a lumbering roll from side to side
      walk: (t, u) => merge({ body: { r: [0, 4 * osc(u, 1), 0] }, heart: { s: 1 } }, extra.walk?.(t, u)),
      idle: (t, u) => merge({ heart: { s: 1 + 0.04 * Math.max(0, Math.sin(TAU * 2 * u)) ** 4 } }, extra.idle?.(t, u)),
      lunge: (t, u) => merge({ heart: { s: 1 + 0.12 * K(u, [[0.2, 0], [0.4, 1], [0.8, 0]]) } }, extra.lunge?.(t, u)),
    },
  });
  return {
    ...base,

    // fidget: the heart-stone thumps twice, bright; it looks down at it and lays a paw over it
    idle_heartbeat: {
      seconds: 2.6,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.12, 1], [0.75, 1], [0.9, 0]]);
        const beat = (u0) => Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - u0) / 0.1))));
        const paw = win(u, 0.4, 0.78, 0.1);
        return merge({
          body: { r: [3 * look, 0, 0] },
          head: { r: [14 * look, 0, -4 * look] },
          heart: { s: 1 + 0.14 * (beat(0.2) + beat(0.32)) },
          ...face.pose('open', blinks(u, [[0.6, 0.66]])),
          armR: { r: [-40 * paw, 18 * paw, 0] },
          foreR: { r: [-35 * paw, 0, 0] },
        }, extra.idle_heartbeat?.(t, u));
      },
    },

    // fidget: a big lazy stretch. Arms out wide, head back, eyes squeezed, then a shake through the mantle
    idle_stretch: {
      seconds: 3,
      pose: (t, u) => {
        const s = K(u, [[0, 0], [0.25, 1], [0.55, 1], [0.7, 0]]);
        const sh = Math.sin(TAU * 6 * u) * win(u, 0.7, 0.95, 0.04);
        return merge({
          root: { r: [-2 * s, 0, 0] },
          body: { r: [-8 * s, 0, 5 * sh] },
          head: { r: [-18 * s, 0, 6 * sh] },
          ...face.pose(s > 0.6 ? 'happy' : 'open'),
          ...both('arm', { r: [-25 * s, -50 * s, 0] }),
          ...both('fore', { r: [0, -10 * s, 0] }),
        }, extra.idle_stretch?.(t, u));
      },
    },
  };
};

const HEAD = { at: [1.5, -7.5, 28], rot: [14, 0, -22], neck: [1.5, -4, 25] };
const face = faceFor(HEAD, { at: [2.9, -4.35, 1.4], size: 1.2, yaw: 18, flat: 0.5 }, PALETTE.bark);
export default rigDef({
  joints: [...jointsFor(HEAD), ...face.joints], assign: makeAssign(PALETTE, HEAD), extras: face.extras, clips: clipsFor({ face }),
});
