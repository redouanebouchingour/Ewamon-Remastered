// Voidraxis's rig: a cosmic serpent-dragon coiled in a figure-eight. The coil stays on the ground (root, with the
// frond); the lit neck rises out of it (spine1, spine2, neck) to the head in profile with its dropped jaw; the thin
// clawed arms reach from the chest; the tail is the strand that tucks up through the right loop (tail1..3); the mane
// locks ripple off the head (mane1). Numbers are scad/voidraxis.scad's: its body is a Catmull-Rom spline through `CT`
// ([sheet x, depth, z], turned by W()), rebuilt here; the head is its translate(W(H0)) rotate([0, 0, -60]) block (H).
// The upper body carries a rest turn of -60 degrees so rx leans it towards the face and rz turns the face.
import { K, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, fold, isAny, near, subFrame } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const LIT = [0.28, 0.11, 0.54];
const MANE = [[0.15, 0.08, 0.27], [0.25, 0.42, 0.56], [0.36, 0.2, 0.6]];
const WHISK = [0.36, 0.2, 0.6];
const CLAW = [0.86, 0.76, 0.94];
const FANG = [0.94, 0.9, 0.98];
const MOUTH = [0.12, 0.03, 0.14];

const V = (30 * Math.PI) / 180;
const W = ([x, d, z]) => [x * Math.cos(V) - d * Math.sin(V), x * Math.sin(V) + d * Math.cos(V), z];

const cr = (a, b, c, d, t) => [0, 1, 2].map((k) => 0.5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t * t * t));
function spline(P, n) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    for (let k = 0; k < n; k++) out.push(cr(P[Math.max(i - 1, 0)], P[i], P[i + 1], P[Math.min(i + 2, P.length - 1)], k / n));
  }
  out.push(P[P.length - 1]);
  return out;
}
function lerpR(R, n) {
  const out = [];
  for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < n; k++) out.push(R[i] + ((R[i + 1] - R[i]) * k) / n);
  out.push(R[R.length - 1]);
  return out;
}

const CT = [[-6.5, 0, 29], [-3.6, 0, 26.8], [-3, -0.3, 24], [-4.5, -0.6, 20.5], [-5.6, -0.8, 16.5], [-5.8, -0.8, 12.5],
  [-4, -1, 9.0], [0.5, -1, 7.8], [5.5, -0.6, 8.4], [10, 0, 9], [13.8, 0.6, 11.6], [15, 1.2, 15.5], [13.6, 1.8, 19.8],
  [9.5, 2.4, 22], [5, 3, 20.6], [1.5, 4, 17.6], [-2.5, 4.6, 15.2], [-7, 4, 14.2], [-10.5, 2.6, 12.3],
  [-11.9, 1.2, 8.6], [-10.4, 0.2, 4.4], [-6.8, -0.4, 2.2], [-2, -0.6, 1.6], [3, -0.6, 1.8], [7, 0.4, 3.2],
  [9.2, 3.2, 6], [8.6, 3.4, 9.6], [6, 2.6, 12.4], [3, 3.4, 14.6], [0.8, 5.6, 16], [-0.5, 6.4, 16.6]];
const CR = [2.1, 2.6, 2.9, 3.3, 3.5, 3.4, 3.2, 3.1, 3, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.3, 2.3, 2.3, 2.2, 2, 1.8, 1.65,
  1.55, 1.5, 1.45, 1.4, 1.35, 1.25, 0.9, 0.5];
const N = 2;
const PTS = spline(CT, N).map(W);
const RS = lerpR(CR, N);

// the mane locks ([sheet x, z] points, radii, depth), as in the scad; locks 7..9 hang down the back of the neck
const LOCKS = [
  [[[-9.5, 33.5], [-6, 36.2], [-1, 37.6], [4, 37.2], [8.5, 36.6], [11.2, 36.4], [11.9, 35.6]], [1.3, 1.25, 1.05, 0.8, 0.5, 0.25, 0.08], -0.6],
  [[[-9, 33], [-5, 35.6], [0, 36.6], [4.5, 36.4], [7.5, 35.6], [9.2, 35.9]], [1.25, 1.2, 1.0, 0.7, 0.35, 0.08], 1.4],
  [[[-8, 32.4], [-3, 34.6], [2, 34.8], [6.5, 33.6], [9.6, 31.8], [11.6, 31.2], [11.2, 31.9]], [1.45, 1.4, 1.2, 0.9, 0.5, 0.2, 0.08], -1.6],
  [[[-7, 31.6], [-2.5, 33.4], [2.5, 33.2], [6.2, 32.4], [8.6, 32.8], [10, 33.6]], [1.25, 1.2, 0.95, 0.6, 0.3, 0.08], 1.8],
  [[[-6.5, 31], [-2, 32.2], [2.5, 31.4], [6, 30.2], [8.5, 29.8], [10, 30.3]], [1.35, 1.3, 1.05, 0.65, 0.3, 0.08], -2.2],
  [[[-5, 29.8], [-1.5, 30], [2.5, 28.8], [4.8, 27.4], [6, 27.2]], [1.25, 1.15, 0.8, 0.35, 0.08], -1.4],
  [[[-4, 29.4], [0, 29.6], [3.5, 28.8], [6, 29.2], [7.2, 30]], [1.15, 1.05, 0.7, 0.3, 0.08], 1.6],
  [[[-1.4, 28], [0.2, 25.2], [1.2, 22.4], [1.6, 20.6], [2.4, 19.4]], [1.0, 0.85, 0.6, 0.3, 0.08], 0.6],
  [[[1.2, 28], [2.4, 25.6], [3.2, 23.4], [3.8, 22.2]], [0.9, 0.65, 0.3, 0.08], 1.4],
  [[[0.2, 27.4], [1.6, 24.8], [1.8, 22.6], [1.2, 21.2]], [0.8, 0.6, 0.3, 0.08], -1.2],
  [[[-11.6, 31.4], [-9.8, 34.2], [-7, 36.6], [-3.8, 38.3], [-0.8, 38.6]], [0.9, 0.85, 0.7, 0.4, 0.08], -1.0],
  [[[-10.6, 31.8], [-8.6, 34.6], [-5.6, 37.0], [-2.6, 37.4]], [0.85, 0.8, 0.5, 0.08], 0.8],
].map(([p, r, d]) => ({ pts: spline(p.map(([x, z]) => W([x, d, z])), 2), rs: lerpR(r, 2) }));
const WHISKERS = [[-3.2, 0], [3.0, 0.6]].map(([d, dz]) => ({
  pts: [[-8.6, d * 0.5, 26.8 + dz], [-4.5, d, 26.6 + dz], [0, d, 26.2 + dz], [5, d * 0.7, 26.4 + dz], [10, d * 0.4, 26 + dz],
    [14, d * 0.25, 25.7 + dz], [16.6, d * 0.2, 25.9 + dz]].map(W),
  rs: [0.32, 0.28, 0.24, 0.2, 0.16, 0.12, 0.06],
}));

// arms: the near (left, +X of the head frame) one and the far one mirrored about the neck's plane
const AR = [[-6.5, -2.4, 16.6], [-10.5, -3.4, 16.2], [-14.3, -3.4, 18.0], [-15.3, -3.4, 18.3]];
const FINGERS = [[[-16.6, 19.4], [-16.0, 19.9]], [[-17.4, 18.6], [-17.6, 17.4]], [[-16.9, 16.9], [-16.4, 15.4]], [[-15.4, 16.4], [-14.5, 15.2]]];
const farP = (p) => [p[0] + 0.5, -1.6 - p[1], p[2] + 0.3];
const ARM = { L: AR.map(W), R: AR.map((p) => W(farP(p))) };
const FING = {
  L: FINGERS.map(([a, b]) => [W([a[0], -3.4, a[1]]), W([b[0], -3.4, b[1]])]),
  R: FINGERS.map(([a, b]) => [W(farP([a[0], -3.4, a[1]])), W(farP([b[0], -3.4, b[1]]))]),
};

const YAW = -60;
const H = subFrame(W([-8.5, 0, 29.6]), [0, 0, YAW], 1);
const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2', 'tail3'];
const mane = ['mane1'];

// the eyes: placed in world terms (the head's rest turn already carries the -60), yaw relative to the head
const EYE = { size: 1.05, flat: 0.45 };
const face = eyeKit({
  eyes: [{ side: 'L', at: H.world([1.5, -2.3, 0.05]), yaw: 80, ...EYE }, { side: 'R', at: H.world([-1.5, -2.3, 0.05]), yaw: -80, ...EYE }],
  skin: LIT,
});

const joints = [
  { name: 'root', at: W([-2, 0, 0]) },
  { name: 'spine1', parent: 'root', at: W(CT[5]), rot: [0, 0, YAW] },
  { name: 'spine2', parent: 'spine1', at: W(CT[4]) },
  { name: 'neck', parent: 'spine2', at: W(CT[2]) },
  { name: 'head', parent: 'neck', at: W([-6.2, 0, 28.6]) },
  { name: 'jaw', parent: 'head', at: H.world([0, 0.3, -3.0]) },
  { name: 'mane1', parent: 'head', at: W([-6.5, 0, 31.6]) },
  { name: 'armL', parent: 'spine2', at: ARM.L[0] },
  { name: 'foreL', parent: 'armL', at: ARM.L[1] },
  { name: 'armR', parent: 'spine2', at: ARM.R[0] },
  { name: 'foreR', parent: 'armR', at: ARM.R[1] },
  { name: 'tail1', parent: 'root', at: W(CT[25]) },
  { name: 'tail2', parent: 'tail1', at: W(CT[26]) },
  { name: 'tail3', parent: 'tail2', at: W(CT[27]) },
  ...face.joints,
];

/** The joint of a body point by its spline span (CT i to i + 1). */
function spanJoint(i) {
  const s = Math.floor(i / N);
  if (s <= 1) return 'neck';
  if (s <= 3) return 'spine2';
  if (s === 4) return 'spine1';
  if (s >= 25) return tail[Math.min(2, s - 25)];
  return 'root';
}

const HEAD = [[[2.0, 2.6, 2.1], [0, 0.6, 0.4]], [[1.6, 1.8, 1.25], [0, -2.2, 0.55]], [[1.35, 1.3, 1.2], [0, -3, -1.2]],
  [[1.1, 1.4, 1.0], [0, -5, -1.5]], [[0.85, 0.7, 0.8], [0, -6.3, -1.6]], [[0.6, 0.8, 0.5], [0, -6.0, -0.75]],
  [[0.6, 1.4, 0.5], [1.35, -2.3, 0.9]], [[0.6, 1.4, 0.5], [-1.35, -2.3, 0.9]], [[1.2, 1.2, 1.3], [1.5, -2.3, 0.05]], [[1.2, 1.2, 1.3], [-1.5, -2.3, 0.05]]];
const JAW = [[[1.3, 1.4, 1.0], [0, -0.3, -3.8]], [[1.0, 1.3, 0.95], [0, -2.6, -5.6]], [[0.75, 0.7, 0.7], [0, -3.9, -5.2]]];
const BARBEL = [[0.8, -6.7, -2.0], [0.9, -8.1, -2.2], [0.9, -8.8, -1.0], [0.8, -8.3, 0.6], [0.7, -6.9, 1.6], [0.6, -5.6, 2.3]];
const BARBEL_R = [0.3, 0.28, 0.24, 0.2, 0.15, 0.06];
// upper fangs on the head, lower teeth on the jaw: [base, tip, r]
const UPPER = [[[0.75, -3.0, -2.2], [0.75, -3.15, -4.3], 0.32], [[0.6, -5.4, -2.3], [0.6, -5.5, -3.4], 0.24]];
const LOWER = [[[0.6, -3.6, -4.7], [0.6, -3.7, -3.7], 0.22], [[0.7, -2.4, -4.9], [0.7, -2.4, -4.1], 0.2]];

function assign(c, rgb) {
  const h = H.local(c);
  const hf = fold(h);
  // the whiskers: the root on the head, the long trailing rest on the neck
  if (near(rgb, WHISK)) {
    const w = Math.min(...WHISKERS.map((k) => chainHit(c, k.pts, k.rs).d));
    const l = Math.min(...LOCKS.map((k) => chainHit(c, k.pts, k.rs).d));
    if (w < l && w < 1.6) return h[1] < 3.5 ? 'head' : 'neck';
  }
  if (isAny(rgb, MANE)) {
    if (c[2] < 31.5 && h[1] > 4 && c[2] > 18 && Math.min(...[7, 8, 9].map((i) => chainHit(c, LOCKS[i].pts, LOCKS[i].rs).d)) < 1.4) return 'neck';
    // crown spines and locks rising from over the brow stay on the head
    if (h[1] < -1.5) return 'head';
    return 'mane1';
  }
  if (near(rgb, MOUTH)) return h[2] < -3.7 ? 'jaw' : 'head';
  if (near(rgb, FANG)) {
    const up = Math.min(...UPPER.map(([a, b, r]) => capD(hf, a, b, r, 0.05)));
    const lo = Math.min(...LOWER.map(([a, b, r]) => capD(hf, a, b, r, 0.05)));
    return lo < up ? 'jaw' : 'head';
  }
  const headD = Math.min(blobD(h, HEAD), chainHit(hf, BARBEL, BARBEL_R).d);
  const jawD = blobD(h, JAW);
  const parts = [['head', headD], ['jaw', jawD * 1.02]];
  for (const S of ['L', 'R']) {
    const A = ARM[S];
    parts.push([`arm${S}`, capD(c, A[0], A[1], 1.0, 0.8)]);
    parts.push([`fore${S}`, Math.min(capD(c, A[1], A[2], 0.8, 0.65), capD(c, A[2], A[3], 0.65, 0.7),
      ...FING[S].map(([a, b]) => Math.min(capD(c, A[3], a, 0.36, 0.24), capD(c, a, b, 0.24, 0.05))))]);
  }
  const hit = chainHit(c, PTS, RS);
  parts.push([spanJoint(hit.i), hit.d]);
  return closest(parts);
}

// the long arms reach forward under the jaw: lower the template's raised-arm poses so the claws stay off the face
const lower = (k) => ({ ...both('arm', { r: [18 * k, 0, 0] }), ...both('fore', { r: [22 * k, 0, 0] }) });
const base = serpentClips({
  face, spine, tail, mane,
  add: {
    celebrate: (t, u) => lower(Math.sin(Math.PI * u)),
    idle_hiss: (t, u) => lower(win(u, 0.12, 0.78, 0.1)),
  },
});

const clips = {
  ...base,

  // fidget: rakes the air with both clawed hands, the jaw working, a slow glare round
  idle_rake: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.8, 0.1);
      const rake = osc(u, 3) * on;
      const look = K(u, [[0, 0], [0.2, 16], [0.55, 16], [0.75, -10], [0.9, 0]]);
      return merge({
        neck: { r: [-3 * on, 0, 0] },
        head: { r: [-4 * on, 0, look] },
        jaw: { r: [8 * on, 0, 0] },
        mane1: { r: [3 * osc(u, 2), 0, 2 * osc(u, 2, 0.25)] },
        armL: { r: [-10 * on + 16 * rake, -12 * on, 0] },
        foreL: { r: [-8 * on - 14 * rake, 0, 0] },
        armR: { r: [-10 * on - 16 * rake, 12 * on, 0] },
        foreR: { r: [-8 * on + 14 * rake, 0, 0] },
        ...face.pose('open', blinks(u, [[0.88, 0.92]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
