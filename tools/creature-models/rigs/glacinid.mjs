// Glacinid's rig: an ice serpent in a W, the chubby neck rearing up at the front and the tail climbing at the back
// into a frost-coral tree. The low coil stays on the ground (root); the chest and neck are the spine, the rising tail
// its own chain. Numbers are scad/glacinid.scad's: the body chain BODY, the coral list CORAL (regenerated here with
// the same coralSegs), and the head block translate(HC) scale(HS) (H).
import { K, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, subFrame } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const ICE = [0.75, 0.87, 0.93];
const DEG = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(...a);
const nrm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// fromSheet(sx, z, y) and the scad's sd(dsx, dz, dy)
const S = (sx, z, y) => [(sx - 0.5 * y) / Math.cos(30 * DEG), y, z];
const sd = (dsx, dz, dy = 0) => [(dsx - 0.5 * dy) / Math.cos(30 * DEG), dy, dz];

const BODY = [[-16.8, 20.5, -3.5, 4.2], [-17, 16, -3, 5.4], [-17.3, 10.2, -2, 6.4], [-11.5, 8.5, 0, 5], [-5, 11, 2, 4.4], [2, 12, 4, 4.3],
  [9, 12.3, 5, 4.5], [15.5, 12, 5, 4.8], [16, 17, 4, 4.4], [13, 22, 3, 4.1], [10, 27, 3, 3.6], [8.5, 31.5, 3, 2.9],
  [8, 34.5, 3, 2.0]];
const PTS = BODY.map((b) => S(b[0], b[1], b[2]));
const RS = BODY.map((b) => b[3]);

// the scad's coralSegs(): [p, q, r1, r2] per segment
const NV = [0.5, -0.866, 0];
function sideV(d) { const c = cross(d, NV); return len(c) < 0.01 * len(d) ? [0, 0, 1] : nrm(c); }
function coralSegs(p, d, r, depth, spin, sg) {
  const q = add(p, d); const L = len(d); const u = nrm(d); const s0 = sideV(d); const w = cross(u, s0);
  const sv = add(mul(s0, Math.cos(spin * DEG)), mul(w, Math.sin(spin * DEG)));
  const dm = mul(add(mul(u, Math.cos(20 * DEG)), mul(sv, sg * Math.sin(20 * DEG))), L * 0.78);
  const ds = mul(add(mul(u, Math.cos(50 * DEG)), mul(sv, -sg * Math.sin(50 * DEG))), L * 0.55);
  const out = [[p, q, r, r * 0.92]];
  if (depth > 0) out.push(...coralSegs(q, dm, r * 0.88, depth - 1, -spin, -sg), ...coralSegs(q, ds, r * 0.78, depth - 1, -spin, -sg));
  return out;
}
const CR = 1.4;   // the scad's coral thickness on the body
const CORAL = [
  [9, 32.5, 3, 0, 2.7, 0.3, 1.0, 3, 25, 1], [10.5, 29.5, 3, 2.7, 3.7, 0.4, 1.0, 3, -25, -1], [12, 26, 3, 3.8, 2.9, 0.4, 1.0, 3, 30, 1],
  [14.5, 21.5, 3.5, 3.7, 2.9, 0.3, 0.9, 2, -30, -1], [18, 16.5, 4, 2.4, 1.8, 0.3, 0.85, 2, 25, 1], [8, 29, 3, -1.6, 2.9, 0.3, 0.8, 2, 30, 1],
  [11, 31, 3.5, 1.5, 3, 1.5, 0.9, 3, 35, 1], [9.5, 34, 2, 1.2, 2.4, -1, 0.85, 3, -35, 1], [12.5, 28, 4.5, 3.2, 2.2, 1, 0.9, 3, 40, -1],
  [14, 23, 1.5, 3.6, 2, -1, 0.85, 2, -40, 1], [13, 24, 2, 3, 3.5, -1, 0.9, 3, -35, -1], [15.5, 19, 4, 3.2, 1.4, 1, 0.85, 2, 30, 1],
  [17.5, 13.5, 6, 3, 2.5, 1, 0.8, 2, -30, 1], [19.5, 12, 5, 1.9, -1.1, 0.3, 0.75, 1, 20, 1],
  [-1.5, 14, 4, 0.5, 5.9, 0.4, 1.1, 3, 30, 1], [-5, 13, 2, 0, 5.0, 0.4, 0.9, 2, -30, -1], [3, 14.5, 5, 1, 4.7, 0.4, 0.9, 2, 30, -1],
  [0, 14, 2.5, -1.5, 5, -0.5, 1.0, 3, -35, -1], [-3, 13.5, 4, 1.5, 5.5, 0.6, 1.0, 3, 35, -1], [5.5, 14.5, 5, 2, 3.5, 0.5, 0.8, 2, 20, 1],
  [-4, 14, 5.5, -0.5, 4.6, 1, 0.9, 3, -40, 1], [1.5, 14.5, 2, 0.8, 4.8, -1, 0.9, 3, 40, -1],
  [-10, 15, -1, 1.6, 4.4, 0.5, 0.9, 3, -30, 1], [-7.5, 13.5, 0.5, 0.8, 4.2, 0.5, 0.9, 2, 30, -1],
  [-8, 13, 1, 3.3, 1.6, 0.6, 0.7, 2, 35, 1], [3, 14, 5.5, 3.7, 1.2, 0.6, 0.7, 2, -35, -1], [10, 14.5, 6, 3.9, 1.9, 0.4, 0.7, 1, 30, 1],
  [-2, 12.5, 6, 4, 1, 0.5, 0.75, 2, 30, -1], [6, 13, 7, 4, 1.5, 0.3, 0.7, 2, -30, 1],
  [-10, 9.5, -3.5, 4.2, 0.8, 0.6, 0.6, 1, 8, 1], [-4, 11.5, -2, 4.2, 0.6, 0.6, 0.6, 1, -8, -1], [2, 10, 0, 4.2, 0.5, 0.4, 0.6, 1, 8, 1],
  [8, 11.5, 1, 4.2, 0.6, 0.2, 0.6, 1, -8, -1], [12.5, 8.5, 1, 4, 1.6, 0, 0.6, 1, 8, 1],
  [-20, 5.5, -2, -1.1, -1.7, 0, 0.7, 1, 20, 1], [-12, 4.5, 0, 0.5, -2.3, 0, 0.7, 1, 20, -1], [-5.5, 6.5, 1.5, -0.2, -3.2, 0, 0.7, 1, 20, 1],
  [10, 7.5, 5, 0.2, -2.4, 0, 0.65, 1, 20, -1], [17, 7.5, 5, 0.5, -1.7, 0, 0.65, 1, 20, 1], [-22.5, 10, -2, -1.2, 0.3, 0, 0.6, 1, 20, 1],
];
// shards on the back and down the neck: [base, dir], as capsules of their blade width
const SHARDS = [[-9.5, 16, -1.5, 0.8, 7], [0.5, 14, 4.5, 1, 9], [3.5, 14.5, 5, 2.2, 10], [6.5, 14.5, 5.5, 2, 6.5], [-3.5, 13.5, 3.5, 0.2, 6],
  [-7.5, 12.5, 1.5, -0.6, 5]].map((s) => [S(s[0], s[1], s[2]), sd(s[3], s[4], 0.5), 1.1])
  .concat([0, 1, 2].map((i) => [S(-18.5 + i * 0.2, 19.5 - i * 4, -7.2 + i * 0.6), sd(-0.6, -2.6, -0.4), 1.6]));

const HC = S(-16.8, 24.2, -4.5);
const H = subFrame(HC, [0, 0, 0], 1.35);
const MANE = [[10, 7], [34, 7.8], [58, 8.5], [82, 8.7], [106, 8.2], [130, 7.3], [155, 6.4]];
// the head block's own parts, in its frame: skull + snout + jaw, brows, mane blades, crown, antlers
const ANTLER = coralSegs([2.2, 1.2, 2.6], [1.2, 0.8, 2.1], 0.7, 3, 20, -1);
const headParts = (h) => {
  const x = Math.abs(h[0]); const f = [x, h[1], h[2]];
  return Math.min(
    blobD(h, [[[4.0, 3.8, 3.6], [0, 0, 0]], [[2.4, 2.3, 1.9], [0, -3.7, -1.1]], [[2.1, 2.4, 1.0], [0, -3.0, -2.6]]]),
    capD(f, [0.7, -3.8, 1.85], [3.6, -1.6, 3.0], 0.75, 0.7),   // brow
    ...MANE.map(([a, l]) => capD(f, [0, -0.8, 0], [Math.sin(a * DEG) * l * 0.88, 0.7, Math.cos(a * DEG) * l], 1.6, 0.3)),
    capD(h, [0, -1.0, -2.6], [0, -1.6, -6.2], 1.2, 0.3),   // chin blade
    capD(h, [0, 0.6, 2.8], [0, 1, 10], 1.9, 0.4),   // crown
    capD(f, [1.4, 0.2, 2.8], [2.5, -0.2, 8], 1.3, 0.4),
    capD(f, [0.85, 1.6, 2.6], [1.3, 2.3, 7.2], 1.2, 0.4),
    ...ANTLER.map(([p, q, r1, r2]) => capD(f, p, q, r1, r2)),
  );
};

const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [2.1, -2.95, 0.6], size: 1.15, yaw: 28, flat: 0.35, frame: H };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: ICE });

const mid = (a, b) => mul(add(a, b), 0.5);
const joints = [
  { name: 'root', at: [PTS[4][0], PTS[4][1], 0] },
  { name: 'spine1', parent: 'root', at: PTS[2] },
  { name: 'spine2', parent: 'spine1', at: PTS[1] },
  { name: 'neck', parent: 'spine2', at: mid(PTS[0], PTS[1]) },
  { name: 'head', parent: 'neck', at: PTS[0] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'root' : tail[i - 1], at: PTS[8 + i] })),
  ...face.joints,
];

/** The joint a point of the body chain belongs to, by its link and the place along it. */
function linkJoint({ i, t }) {
  if (i === 0) return t < 0.5 ? 'neck' : 'spine2';
  if (i === 1) return t < 0.5 ? 'spine2' : 'spine1';
  if (i === 2) return t < 0.75 ? 'spine1' : 'root';
  if (i === 7) return t < 0.6 ? 'root' : 'tail1';
  if (i >= 8) return tail[Math.min(3, i - 8)];
  return 'root';
}

// every body coral segment and shard as a capsule, labelled with the joint of the body link its tree grows from
const bodyCaps = [];
for (const k of CORAL) {
  const base = S(k[0], k[1], k[2]);
  const j = linkJoint(chainHit(base, PTS, RS));
  for (const [p, q, r1, r2] of coralSegs(base, sd(k[3], k[4], k[5]), k[6] * CR, k[7], k[8], k[9])) bodyCaps.push([j, p, q, r1, r2]);
}
for (const [p, d, w] of SHARDS) bodyCaps.push([linkJoint(chainHit(p, PTS, RS)), p, add(p, d), w, 0.3]);

function assign(c) {
  const hit = chainHit(c, PTS, RS);
  const cand = [['head', headParts(H.local(c))], [linkJoint(hit), hit.d * 1.02]];
  for (const [j, p, q, r1, r2] of bodyCaps) cand.push([j, capD(c, p, q, r1, r2)]);
  cand.push(['spine1', ellD(c, [5.4, 5.4, 5.6], add(PTS[2], [-0.6, -1.4, 0.4]))]);   // the chest's lavender patch
  return closest(cand);
}

const base = serpentClips({ face, spine, tail });

const clips = {
  ...base,

  // faint: the template folds the neck forward, which drives the big crowned head into the chest; Glacinid slumps
  // sideways instead, the neck keeling over to its left so the head comes to rest beside the coil, the tail tree drooping
  faint: {
    seconds: 0.9,
    pose: (t, u) => {
      const jolt = win(u, 0, 0.2, 0.05);
      const down = smooth((u - 0.15) / 0.6);
      return merge({
        spine1: { r: [-4 * jolt + 4 * down, 16 * down, 2 * down] },
        spine2: { r: [-4 * jolt + 4 * down, 18 * down, 2 * down] },
        neck: { r: [-4 * jolt + 6 * down, 18 * down, 2 * down] },
        head: { r: [-12 * jolt + 8 * down, 14 * down, -8 * down] },
        ...face.pose(u > 0.1 ? 'dizzy' : 'open'),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [-10 * down * (1 + 0.2 * i), 0, 0] }])));
    },
  },

  // fidget: shakes frost off its antlers, a shiver running down the coil to the tail tree
  idle_shiver: {
    seconds: 2,
    pose: (t, u) => {
      const sh = Math.sin(Math.PI * 2 * 9 * u) * win(u, 0.2, 0.7, 0.05);
      const look = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      return merge({
        neck: { r: [-3 * look, 0, 3 * sh] },
        head: { r: [-6 * look, 6 * sh, 0] },
        ...face.pose(Math.abs(sh) > 0.2 ? 'squeeze' : 'open', blinks(u, [[0.84, 0.88]])),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 3 * Math.sin(Math.PI * 2 * 9 * u - i) * win(u, 0.3, 0.8, 0.05)] }])),
      { spine2: { r: [osc(u, 2), 0, 0] } });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
