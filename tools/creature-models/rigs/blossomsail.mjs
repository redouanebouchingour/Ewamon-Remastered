// Blossomsail's rig: a lavender-grey dove in flight with pink petal-feather wings raised in a V (an inner wing and
// the primaries off the hand as a tip joint), a small head turned to its right under a crown of blossoms, little feet
// tucked under, a trailing tail of green willow streamers in two links, and blossom petals drifting round it.
// Numbers are scad/blossomsail.scad's (the 2026-11-03 sprite-match model).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, blob, ell, fromSheet, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, ellD, fold, subFrame, unrot } from './lib/geo.mjs';

const GREY = [0.72, 0.71, 0.79];

// ---- the scad's numbers
const BODY = [[[3.6, 3.5, 4.4], [0, -2.5, 22.3]], [[2.8, 2.8, 2.4], [0, -0.2, 19.3]], [[1.3, 1.3, 1.2], [1.2, 6.5, 15.8]]];
const NECK = [[0, -3, 24.5], [0, -4, 27.2], [0, -4.4, 29]];
const HEAD = subFrame([0, -4.5, 30.8], [0, 0, -25]);
const SHOULDER = [2.4, -2.4, 24.8];
const SWEEP = 15;
const W = ([x, z]) => [(x - 0.88) / 0.966, 0, z - 24.8];
const ARM = [[0.9, 24.8], [4, 27.5], [7.5, 31.5], [10.5, 34]].map(W);
const FEATHERS = [
  [6.8, 31, 12.8, 36.8], [8.6, 32.6, 15, 38.6],
  [10.5, 34, 16.7, 39.9], [10, 33.4, 18.6, 38.1], [9.5, 32.8, 19.7, 36], [9, 32.3, 20, 33.6], [8.5, 31.8, 19.6, 31],
  [7.8, 31.2, 19, 28.6], [7, 30.5, 18, 26.4], [6.2, 29.6, 16.6, 24.3], [5.4, 28.7, 14.6, 22.6], [4.6, 27.9, 12.2, 21],
  [3.6, 27, 9.6, 19.8], [2.6, 26.2, 6.8, 19.9], [1.6, 25.4, 4.2, 20.8]].map((f) => [W([f[0], f[1]]), W([f[2], f[3]])]);
const PRIMARY = (i) => i >= 2 && i <= 7;   // the six feathers off the hand ride the wing tip
const TAILS = [
  [[4.5, 16, 6.5], [8, 16, 7.5], [11, 15, 8.5], [13.5, 13.3, 9], [14.4, 12.3, 9]],
  [[4.8, 15.8, 6.5], [8.5, 14.5, 7.5], [11.5, 12.5, 8.5], [13.2, 10, 9]],
  [[4.8, 15.5, 6.5], [8, 13.5, 7.5], [10.8, 10.5, 8.5], [12.4, 7.6, 9]],
  [[4.5, 15, 6.5], [7, 12, 7], [9, 9, 8], [10.2, 6.2, 8.5]],
  [[4.5, 15, 6.5], [6.8, 11, 7], [8.2, 8, 7.5], [8.6, 5.2, 7.5]],
  [[4.3, 15, 6.5], [5.8, 11, 7], [6.6, 7.5, 7], [6.5, 4.6, 7]],
  [[4, 15, 6], [4.2, 11, 6], [3.3, 7.5, 5.5], [2.2, 5.2, 5]],
  [[4, 15.5, 6], [3, 11, 5.5], [1, 8.2, 4.5], [-1.5, 7.6, 3.5], [-3, 8.4, 3]],
  [[4, 15, 6], [2.8, 10, 5], [1, 6.6, 4], [-1.5, 5.8, 3], [-3, 6, 2.5]],
  [[2.2, 5.2, 5], [1.4, 4, 4.8]],
].map((s) => s.map(([x, z, y]) => fromSheet(x, z, y)));
const BUDS = [[-4.4, 9.4, 2.6], [-4.4, 6.1, 2.2], [0.9, 3.4, 4.6]].map(([x, z, y]) => fromSheet(x, z, y));
const PETALS = [[-16, 20.2, -2], [-14, 17.8, 0], [-15.5, 15.9, 2], [-11.5, 15.8, -1], [-16, 13.3, 1], [-13, 12.5, -2],
  [-9, 13.6, 1], [-8.9, 9.4, -1], [-12.2, 7.9, 2], [-8.6, 5, 0], [-4.5, 3.6, -1], [14.5, 10.2, 3], [11.2, 4.9, 4],
  [4.3, 3.2, 2], [-1.5, 2.4, 0]].map(([x, z, y]) => fromSheet(x, z, y));

// ---- the eyes: eye([1.5, -1.75, 0.45], 1.0, yaw = 48) inside the head's frame
const eyeL = { side: 'L', at: [1.5, -1.75, 0.45], size: 1.0, yaw: 48, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREY });

// the left wing's frame: translate(SHOULDER) rotate([0, 0, SWEEP])
const wingLocal = (c) => unrot([0, 0, SWEEP], [c[0] - SHOULDER[0], c[1] - SHOULDER[1], c[2] - SHOULDER[2]]);
const wingWorld = (p) => {
  const a = (SWEEP * Math.PI) / 180;
  return [SHOULDER[0] + p[0] * Math.cos(a) - p[1] * Math.sin(a), SHOULDER[1] + p[0] * Math.sin(a) + p[1] * Math.cos(a), SHOULDER[2] + p[2]];
};
const WRIST = wingWorld(ARM[2]);
const tailMid = TAILS.slice(0, 7).map((s) => s[1]);
const TAIL2 = [0, 1, 2].map((k) => tailMid.reduce((a, p) => a + p[k], 0) / tailMid.length);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 19] },
  ...pair('leg*', 'body', [1.2, -0.2, 17.2]),
  { name: 'head', parent: 'body', at: [0, -3, 25] },
  { name: 'crest1', parent: 'head', at: HEAD.world([0, 0.4, 2.4]) },
  ...pair('wing*', 'body', SHOULDER),
  ...pair('wing2*', 'wing*', WRIST),
  { name: 'tail1', parent: 'body', at: TAILS[0][0] },
  { name: 'tail2', parent: 'tail1', at: TAIL2 },
  { name: 'drift', parent: 'root', at: [-6, 0, 10] },
  ...face.joints,
];

// the wing: [inner, tip] distances in the left wing's frame
function wingD(c) {
  const q = wingLocal(c);
  let inner = Math.min(capD(q, ARM[0], ARM[1], 1.1, 0.8), capD(q, ARM[1], ARM[2], 0.8, 0.6));
  let tip = capD(q, ARM[2], ARM[3], 0.6, 0.4);
  FEATHERS.forEach(([a, b], i) => {
    const d = capD(q, a, b, 1.25, 0.9);
    if (PRIMARY(i)) tip = Math.min(tip, d); else inner = Math.min(inner, d);
  });
  return [inner, tip];
}

const headTest = (c) => {
  const q = HEAD.local(c);
  return Math.min(ellD(q, [2.3, 2.6, 2.3]), capD(q, [0, -2.2, -0.2], [0, -4.8, -0.9], 0.8, 0.3), ellD(q, [1.1, 0.6, 1.2], [1.5, -1.75, 0.45]),
    ellD(q, [1.1, 0.6, 1.2], [-1.5, -1.75, 0.45]));
};
const crownTest = (c) => {
  const q = HEAD.local(c);
  if (ellD(q, [2.3, 2.6, 2.3]) < 1.03 || Math.hypot(q[0], q[1]) > 6 || q[2] < -1.5) return Infinity;
  return q[2] > 1.2 || q[1] > 2 ? 0.5 : Infinity;
};
const neck = any(...NECK.slice(1).map((p, i) => limb(NECK[i], p, [2, 1.6, 1.5][i], [2, 1.6, 1.5][i + 1])));
const legTest = any(limb([1.2, -0.2, 17.2], [1.3, -0.5, 15.2], 0.55, 0.5), ell([0.8, 0.9, 0.6], [1.3, -0.6, 14.8]),
  limb([1.3, -1.1, 14.8], [1.3, -1.6, 13.7], 0.5, 0.3));
const segs = (s) => s.slice(1).map((p, i) => [s[i], p]);
const tail1 = (c) => Math.min(...TAILS.slice(0, 9).map((s) => capD(c, s[0], s[1], 1.3, 1.3)));
const tail2 = (c) => Math.min(...TAILS.flatMap((s, k) => segs(s).slice(k < 9 ? 1 : 0).map(([a, b]) => capD(c, a, b, 1.3, 1.1))),
  ...BUDS.map((b) => ellD(c, [1.7, 1.7, 1.9], b)));

const parts = [
  ['body', any(blob(BODY), ell([2.8, 1.6, 3.6], [0, -4.6, 21.8]))],
  ['head', (c) => Math.min(headTest(c), neck(c))],
  ['leg*', legTest],
  ['tail1', tail1],
  ['tail2', tail2],
];

function assign(c) {
  if (PETALS.some((p) => ellD(c, [1.6, 1.6, 1.6], p) < 1)) return 'drift';
  if (crownTest(c) < 1) return 'crest1';
  const [wi, wt] = wingD(fold(c));
  const best = pick(c, parts);
  const f = fold(c);
  const bd = Math.min(...parts.map(([n, test]) => test(n.endsWith('*') ? f : c)));
  const S = c[0] >= 0 ? 'L' : 'R';
  if (Math.min(wi, wt) < bd) return wt < wi ? `wing2${S}` : `wing${S}`;
  return best;
}

const clips = birdClips({ face, crest: ['crest1'], tail: ['tail1', 'tail2'], flapUp: 22 });
// the petals drift on every loop
const drift = (amp, cycles) => (t, u) => ({ drift: { p: [0, 0, amp * osc(u, cycles)], r: [0, 0, 4 * osc(u, cycles, 0.3)] } });
for (const [name, amp, cycles] of [['idle', 0.8, 1], ['walk', 0.8, 1], ['idle_flap', 1.2, 2], ['idle_preen', 0.8, 1], ['idle_peck', 0.8, 1], ['celebrate', 1.2, 2]]) {
  const base = clips[name].pose;
  clips[name].pose = (t, u) => merge(base(t, u), drift(amp, cycles)(t, u));
}

// the wings are already raised high: the template's upward flaps (ry < 0 on the left) would cross them over the head,
// so every clip keeps 40 % of the upward swing; drooping (faint) stays as it is
for (const clip of Object.values(clips)) {
  const base = clip.pose;
  clip.pose = (t, u) => {
    const p = base(t, u);
    for (const [k, up] of [['wingL', -1], ['wingR', 1], ['wing2L', -1], ['wing2R', 1]]) {
      const r = p[k]?.r;
      if (r && r[1] * up > 0) p[k] = { ...p[k], r: [r[0], r[1] * 0.4, r[2]] };
    }
    return p;
  };
}

// fidget: a slow graceful wingbeat that sheds petals, eyes closed in bliss
clips.idle_bloom = {
  seconds: 2.8,
  pose: (t, u) => {
    const beat = (Math.sin(TAU * 2 * u - Math.PI / 2) * 0.5 + 0.5) * win(u, 0.08, 0.86, 0.1);
    const bliss = win(u, 0.15, 0.85, 0.08);
    return merge({
      body: { r: [-4 * bliss, 0, 0] },
      head: { r: [-8 * bliss, 0, 6 * Math.sin(TAU * u) * bliss] },
      ...face.pose(bliss > 0.5 ? 'happy' : 'open', blinks(u, [[0.92, 0.96]])),
      wingL: { r: [0, -16 * beat, 0] },
      wingR: { r: [0, 16 * beat, 0] },
      wing2L: { r: [0, -8 * beat, 0] },
      wing2R: { r: [0, 8 * beat, 0] },
      crest1: { r: [3 * osc(u, 2), 0, 0] },
      tail1: { r: [2 * osc(u, 2), 0, 3 * osc(u, 1)] },
      tail2: { r: [3 * osc(u, 2, 0.15), 0, 4 * osc(u, 1, 0.15)] },
      drift: { p: [0, 0, 2.4 * K(u, [[0, 0], [0.5, 1], [1, 0]])], r: [0, 0, 14 * Math.sin(TAU * u)] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
