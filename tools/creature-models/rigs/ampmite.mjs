// Ampmite's rig: a low armoured beetle-mite on six splayed legs. Its carapace is yawed 20 degrees (BODY_YAW, drawn
// side-on): the legs, the thorax and the abdomen carry that yaw as their rest frame, so the insect template's swings
// and lifts act along the body; the head faces -Y again (rest rz +20 off the body). The thorax carries capacitor bulb
// A and its sparks, the abdomen bulb B and its sparks; the gold compound eyes are their own joints (no lids: they
// flare in the discharge fidget); slate mandibles, antennae of three links with the spark bursts on the last. Numbers
// are scad/ampmite.scad's.
import { merge, osc, rigDef, win } from './lib/anim.mjs';
import { capD, chainHit, closest, ellD, fold, petalD, side, subFrame } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const BODY_YAW = -20;
const HC = [-3.4, -13.6, 11.2];
const SEGS = [
  [[0, -5.6, 12.6], [6.2, 4.4, 5.4]],
  [[0, -0.6, 13.2], [7.4, 4.8, 6]],
  [[0, 4.8, 12.8], [7.6, 4.2, 6]],
  [[0, 9.2, 11.8], [7, 3.8, 5.6]],
  [[0, 13, 10.2], [5.9, 3.4, 4.8]],
  [[0, 16.2, 8.6], [4.5, 2.8, 3.8]],
  [[0, 18.8, 7.2], [3, 2.1, 2.7]],
];
const BULB_A = [[-1, -5.6, 22.6], 4.3, 17];
const BULB_B = [[3.6, 10.6, 23.6], 4.9, 15];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// [anchor, scale] of the bulb sparks (each about 11.4 × scale tall)
const SPARKS_A = [[add3(BULB_A[0], [-1.6, -1.2, 3.6]), 0.62]];
const SPARKS_B = [[add3(BULB_B[0], [0.6, 0.2, 4.6]), 0.72], [add3(BULB_B[0], [3.6, -1.6, 2.6]), 0.55]];
const EYE = [5.4, -2, 1.1];
const EYE_R = [2.4, 2.8, 3.05];
const EYE_YAW = -35;
const ANT = [[1.9, -2.6, 5], [4.4, -2.4, 8.6], [8.2, -1, 12.4], [12.2, 1.2, 15.6]];
const ANT_R = [0.55, 0.5, 0.45, 0.4];
const MAND = [[2.6, -3.8, -3.6], [2.3, -5.8, -4.4], [0.9, -6.8, -4.8]];
const MAND_R = [1.2, 0.9, 0.45];
const FANG = [[3.1, -4.4, -4.2], [3.3, -5, -6.3], [2.8, -5.4, -7.5]];
const FANG_R = [0.75, 0.6, 0.25];
const LEGS = [
  [[5, -6, 10.2], [10.8, -10.4, 11.6], [13.5, -13.6, 0]],
  [[6.4, -1.2, 10.2], [12.8, -2.2, 12], [16, -3, 0]],
  [[6.4, 3.8, 10.2], [14.2, 8.4, 11.4], [17.5, 12, 0]],
];
const ANKLE = 1.45;

const B = subFrame([0, 0, 0], [0, 0, BODY_YAW], 1);   // body frame <-> world
const W = (p) => B.world(p);
const mir = (p) => [-p[0], p[1], p[2]];
const H = (p) => add3(HC, p);

const yawRot = [0, 0, BODY_YAW];
const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.flatMap(([hip], i) => [
    { name: `leg${i + 1}L`, parent: 'root', at: W(hip), rot: yawRot },
    { name: `leg${i + 1}R`, parent: 'root', at: W(mir(hip)), rot: yawRot },
  ]),
  { name: 'body', parent: 'root', at: W([0, -1, 9]), rot: yawRot },
  { name: 'abdomen', parent: 'body', at: W([0, 2.4, 12]) },
  { name: 'head', parent: 'body', at: W([0, -9.3, 11.2]), rot: [0, 0, -BODY_YAW] },
  { name: 'eyeL', parent: 'head', at: H(EYE) },
  { name: 'eyeR', parent: 'head', at: H(mir(EYE)) },
  { name: 'mandL', parent: 'head', at: H(MAND[0]) },
  { name: 'mandR', parent: 'head', at: H(mir(MAND[0])) },
  ...['L', 'R'].flatMap((S) => [0, 1, 2].map((i) => ({
    name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: H(S === 'L' ? ANT[i] : mir(ANT[i])),
  }))),
];

// leg i in the body frame, folded onto +X
function legD(f, [hip, knee, foot]) {
  const ank = [foot[0], foot[1], ANKLE];
  const mid = knee.map((v, k) => v + (ank[k] - v) * 0.5);
  const h = Math.atan2(foot[1] - hip[1], foot[0] - hip[0]);
  const claws = [-55, 0, 55].map((a) => {
    const d = [Math.cos(h + (a * Math.PI) / 180), Math.sin(h + (a * Math.PI) / 180), 0];
    const p1 = [ank[0] + d[0] * 1.3, ank[1] + d[1] * 1.3, ank[2] + 0.1];
    const p2 = [ank[0] + d[0] * 2.2, ank[1] + d[1] * 2.2, ank[2] - 1.3];
    return Math.min(capD(f, ank, p1, 0.55, 0.4), capD(f, p1, p2, 0.4, 0.15));
  });
  return Math.min(ellD(f, [1.5, 1.5, 1.5], hip), capD(f, hip, knee, 1.2, 0.95), ellD(f, [1.25, 1.25, 1.25], knee),
    capD(f, knee, mid, 1.45, 0.95), capD(f, mid, ank, 0.75, 0.55), ...claws);
}
const segD = (bl, list) => Math.min(...list.map(([p, r]) => ellD(bl, [r[0] * 1.05, r[1] * 1.0, r[2] * 1.07], p)));
// a bulb: the glass, its cup and stalk; a spark burst: an ellipsoid round the bolt
const bulbD = (bl, [p, r, foot]) => Math.min(ellD(bl, [r, r, r], p),
  capD(bl, [p[0], p[1], foot], [p[0], p[1], p[2] - r], 2.2, 2.2));
const sparkD = (bl, sparks) => Math.min(...sparks.map(([a, s]) => ellD(bl, [3.2 * s, 3.2 * s, 6.2 * s], add3(a, [0, 0, 5.4 * s]))));

function assign(c) {
  const h = [c[0] - HC[0], c[1] - HC[1], c[2] - HC[2]];
  const hf = fold(h);
  const hS = side(h);
  // the antenna's spark burst rides on its last link
  if (hf[2] > ANT[3][2] - 1 && Math.hypot(hf[0] - ANT[3][0], hf[1] - ANT[3][1]) < 6.5) return `ant${hS}3`;
  const bl = B.local(c);
  const bf = fold(bl);
  const bS = side(bl);
  const a = chainHit(hf, ANT, ANT_R);
  return closest([
    [`ant${hS}${a.i + 1}`, a.d * 1.15],
    [`mand${hS}`, Math.min(chainHit(hf, MAND, MAND_R).d, capD(hf, [1.6, -6, -4.6], [1.6, -6.3, -5.9], 0.42, 0.15),
      capD(hf, [0.7, -6.6, -4.8], [0.7, -6.8, -5.9], 0.35, 0.15))],
    [`eye${hS}`, Math.min(petalD(hf, EYE_R, EYE, [0, 0, EYE_YAW]) * 0.97, ellD(hf, [0.7, 0.7, 0.7], add3(EYE, [1, -1.87, 1.35])))],
    ['head', Math.min(ellD(h, [6, 5, 5.8]), ellD(h, [4.6, 3.8, 2.8], [0, -1.3, 3]), ellD(h, [0.7, 1.4, 1.6], [0, -3.6, 3.4]),
      petalD(hf, [2, 4, 4.7], [5.1, 2.4, -1.9], [0, 0, -12]), ellD(hf, [1, 0.6, 0.8], [2.1, -4.7, -1.4]), chainHit(hf, FANG, FANG_R).d)],
    ...LEGS.map((l, i) => [`leg${i + 1}${bS}`, legD(bf, l)]),
    ['body', Math.min(segD(bl, SEGS.slice(0, 2)), ellD(bl, [4.4, 2.6, 4.2], [0, -9.3, 11.2]), ellD(bf, [1.2, 1.2, 1.2], [7, -0.6, 12.4]),
      bulbD(bl, BULB_A), sparkD(bl, SPARKS_A))],
    ['abdomen', Math.min(segD(bl, SEGS.slice(2)), capD(bf, [1.1, 20.2, 6.4], [1.7, 21.8, 4], 0.6, 0.15),
      bulbD(bl, BULB_B), sparkD(bl, SPARKS_B))],
  ]);
}

const clips = insectClips({ ant: 3, stride: 14, lift: 12 });

// fidget: the capacitors charge (the bulbs swell) and discharge in a jolt that rattles the whole mite, the compound
// eyes flaring with it
clips.idle_discharge = {
  seconds: 2,
  pose: (t, u) => {
    const charge = win(u, 0.1, 0.6, 0.3);
    const jolt = win(u, 0.6, 0.75, 0.02);
    return merge({
      root: { p: [0, 0, 0.6 * jolt] },
      body: { r: [0, 2 * osc(u, 24) * jolt, 0], s: 1 + 0.025 * charge },
      abdomen: { s: 1 + 0.02 * charge },
      head: { r: [-6 * jolt, 0, 0] },
      eyeL: { s: 1 + 0.06 * charge + 0.08 * jolt },
      eyeR: { s: 1 + 0.06 * charge + 0.08 * jolt },
      mandL: { r: [0, 0, 12 * jolt] },
      mandR: { r: [0, 0, -12 * jolt] },
      antL1: { r: [-10 * jolt, -8 * jolt, 0] },
      antR1: { r: [-10 * jolt, 8 * jolt, 0] },
    });
  },
};

export default rigDef({ joints, assign, clips });
