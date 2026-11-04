// Resilithorn's rig: a hunched forest beast on four plated legs with two clawed arms, on the insect template with
// hanging legs (two pairs, `hang`) and the arms as its claws. The carapace, chest, bib, pauldrons, ridge leaves and
// side twigs are the body; the helmet head (turned 15 degrees in the scad: H) carries the two branching antlers as
// antenna chains (ant1 = the base of the bough, ant2 = everything above it: branches, leaves, berries); the plated
// tail is tail1..tail3. Numbers are scad/resilithorn.scad's.
import { K, TAU, both, merge, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, chainHit, ellD, isAny, near, side, subFrame } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const H = subFrame([0, -11, 20.3], [0, 0, 15]);
const BARK = [0.42, 0.31, 0.22];
const BERRY = [0.31, 0.47, 0.75];
const LEAVES = [[0.49, 0.7, 0.45], [0.56, 0.77, 0.48]];
const RED = [0.72, 0.2, 0.22];
const LEGS = [
  [[7.4, -4, 11], [8.3, -4.6, 6], [8.4, -4.8, 2.2]],
  [[7.8, 9, 10], [9, 9.6, 5.5], [9.2, 10, 2.2]],
];
const TAIL = [[0, 15, 12.5], [2.5, 19.5, 11], [4.8, 22, 9.6], [6.5, 23.5, 8.6]];
const TAIL_R = [5, 3.7, 2.4, 0.8];
const tail = ['tail1', 'tail2', 'tail3'];
// antler: base B and the first fork t1 (the scad's antler(sx) for sx = 1)
const ANT_B = [3.2, -10.2, 22.8];
const ANT_T1 = [ANT_B[0] + 1.5, ANT_B[1] + 1.5, ANT_B[2] + 4.5];

const eyeL = { side: 'L', at: [2, -3.05, -0.9], size: 1.3, yaw: 22, flat: 0.6, frame: H };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.6, 0.72, 0.37] });

const sided = (S, p) => [S === 'L' ? p[0] : -p[0], p[1], p[2]];
const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.flatMap(([hip], i) => ['L', 'R'].map((S) => ({ name: `leg${i + 1}${S}`, parent: 'root', at: sided(S, hip) }))),
  { name: 'body', parent: 'root', at: [0, 2, 10] },
  { name: 'head', parent: 'body', at: [0, -8.5, 19] },
  ...['L', 'R'].flatMap((S) => [
    { name: `ant${S}1`, parent: 'head', at: sided(S, ANT_B) },
    { name: `ant${S}2`, parent: `ant${S}1`, at: sided(S, ANT_T1) },
    { name: `claw${S}`, parent: 'body', at: sided(S, [9.2, -2.5, 19]) },
  ]),
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

// the head's primitives, tested in the head's own frame
const headD = (c) => {
  const l = H.local(c);
  return Math.min(
    blobD(l, [[[3.9, 3.9, 3.4], [0, 0.2, 0.8]], [[2.2, 2.4, 1.6], [0, 0.8, 3.8]]]),
    ellD(l, [3.1, 3.2, 2.6], [0, -1, -2.2]),
    ellD(l, [2.2, 1.5, 1.2], [0, -3.7, -2.7]),
    ...[1, -1].flatMap((k) => [ellD(l, [1.4, 1, 1.4], [2 * k, -3.05, -0.9]), ellD(l, [1.6, 1.1, 0.8], [1.7 * k, -3.8, 0.8])]),
  );
};
const legD = ([hip, knee, ank]) => any(
  limb(hip, knee, 3.1, 2.4), limb(knee, ank, 2.3, 2.6), ell([2.9, 3.2, 1.6], [ank[0], ank[1] - 0.6, 1.6]),
  ell([2.7, 0.9, 2.6], [knee[0] - 0.1, knee[1] - 1.9, knee[2] + 2.2]), ell([2.3, 0.9, 1.9], [ank[0], ank[1] - 1.9, 3.6]),
);
const parts = [
  ['body', any(ell([9.4, 7, 7.8], [0, 0.5, 16.6]), ell([9.2, 8.8, 6.4], [0, 9.5, 13.5]), ell([8.4, 11.5, 4.6], [0, 3.5, 10.6]),
    ell([6.6, 5, 5], [0, -5.6, 14.6]), ell([2.4, 1.2, 2.6], [3.4, -9.3, 11.2]),
    ell([3.5, 3.8, 2.9], [9.2, -2.5, 19.6]), ell([3.5, 3.8, 2.9], [-9.2, -2.5, 19.6]))],
  ['head', headD],
  ['leg1*', legD(LEGS[0])],
  ['leg2*', legD(LEGS[1])],
  ['claw*', any(limb([9, -2.5, 18.5], [12.4, -3.4, 15], 1.5, 1.4), limb([12.4, -3.4, 15], [13.8, -5, 12.2], 2.2, 2),
    ell([1.4, 1.8, 2], [13.3, -3.3, 14.6]), ell([2, 2.2, 1.8], [14, -5.5, 11.6]))],
];

function assign(c, rgb) {
  const S = side(c);
  const leafy = isAny(rgb, LEAVES, 0.03);
  // antlers: bark, berries and leaves above the helmet in front of the shell (the side twigs are further back)
  if ((near(rgb, BARK, 0.03) || near(rgb, BERRY) || (leafy && c[2] > 29)) && c[1] < -2.5 && c[2] > 21.5)
    return `ant${S}${c[2] < ANT_T1[2] - 0.6 ? 1 : 2}`;
  if (near(rgb, BARK, 0.03) || near(rgb, BERRY)) return 'body';   // the side twigs
  if (near(rgb, RED)) {
    if (c[2] > 5) return `claw${S}`;
    return Math.abs(c[1] - LEGS[0][2][1]) < Math.abs(c[1] - LEGS[1][2][1]) ? `leg1${S}` : `leg2${S}`;
  }
  const t = chainHit(c, TAIL, TAIL_R);
  if (leafy) return c[1] > 17 ? tail[Math.min(2, t.i)] : 'body';   // ridge and tail crystal leaves
  return pick(c, [...parts, ['tail', () => t.d * 1.05]]).replace(/^tail$/, tail[Math.min(2, t.i)]);
}

// the arms groom the antlers, so the front legs stay planted (cancels the template's front-leg lift)
const groomOn = (u) => K(u, [[0, 0], [0.15, 1], [0.78, 1], [0.92, 0]]);
const base = insectClips({
  face, ant: 2, tail, legs: 2, hang: true, stride: 10, lift: 9,
  add: { idle_groom: (t, u) => both('leg1', { r: [30 * groomOn(u), 30 * groomOn(u), 24 * groomOn(u)] }) },
});
// antlers are bone, not feelers: they keep a third of the template's antenna sway and droop
const ANT = ['antL1', 'antL2', 'antR1', 'antR2'];
const stiff = (pose) => (t, u) => {
  const q = pose(t, u);
  for (const n of ANT) if (q[n]?.r) q[n] = { ...q[n], r: q[n].r.map((v) => v * 0.35) };
  return q;
};

const clips = {
  ...Object.fromEntries(Object.entries(base).map(([k, c]) => [k, { ...c, pose: stiff(c.pose) }])),
  // fidget: shakes its antlers like a stag, berries swinging, then a snort
  idle_rattle: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.7, 0.08);
      const sh = Math.sin(TAU * 7 * u) * on;
      const snort = K(u, [[0.72, 0], [0.78, 1], [0.92, 0]]);
      return merge(base.idle.pose(t, u), {
        head: { r: [-4 * on + 8 * snort, 4 * sh, 6 * sh] },
        antL2: { r: [0, -4 * sh, 0] }, antR2: { r: [0, 4 * sh, 0] },
        body: { r: [0, 0, 2 * sh], s: [1 + 0.03 * snort, 1 + 0.03 * snort, 1] },
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
