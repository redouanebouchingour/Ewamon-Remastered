// Abyssrake's rig: an abyssal sea serpent rising from a pile of rocks, its body thrown into two upright loops that stay
// put with the rocks (root); the S-neck is the spine, up to a horned head with a dropped jaw and a great crest fan; the
// last loop's tail end rises free. Numbers are scad/abyssrake.scad's (its body is a Catmull-Rom spline through
// `ctrl`, rebuilt here); the head is its translate(H) scale(1.25) translate(-H) block (HF).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { blobD, chainHit, closest, isAny, near, subFrame, unrot } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const NAVY = [0.1, 0.2, 0.36];
const FINS = [[0.35, 0.88, 1], [0.12, 0.55, 0.82], [0.08, 0.28, 0.46]];
const FANG = [0.95, 0.9, 0.7];
const ROCK = [[0.22, 0.24, 0.3], [0.32, 0.34, 0.4]];

const CTRL = [[-3, -6, 31], [-1, -4, 27], [2.5, -3, 22], [2.5, -3, 16], [0, -2.5, 10], [0, -1, 5],
  [7, 0, 3.6], [13.5, 1, 7], [15, 1.5, 14], [11.5, 1.5, 19], [6.5, 1.5, 16], [6, 3, 9],
  [1, 5, 4.6], [-7, 4, 4.4], [-13, 2.5, 7.5], [-14, 1.5, 13], [-10, 1, 15.5], [-7.5, 0, 12], [-9, -1.5, 8.5]];
const CTRL_R = [3, 3.4, 3.8, 4, 4.2, 4.2, 4.2, 4, 3.8, 3.6, 3.4, 3.4, 3.4, 3.2, 3, 2.6, 2, 1.4, 0.6];
const N = 3;
const cr = (a, b, c, d, t) => [0, 1, 2].map((k) => 0.5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t * t * t));
const PTS = [];
const RS = [];
for (let i = 0; i < CTRL.length - 1; i++) {
  for (let k = 0; k < N; k++) {
    PTS.push(cr(CTRL[Math.max(i - 1, 0)], CTRL[i], CTRL[i + 1], CTRL[Math.min(i + 2, CTRL.length - 1)], k / N));
    RS.push(CTRL_R[i] + ((CTRL_R[i + 1] - CTRL_R[i]) * k) / N);
  }
}
PTS.push(CTRL[CTRL.length - 1]);
RS.push(CTRL_R[CTRL_R.length - 1]);

const H = [-3.5, -7.5, 33];
const HF = subFrame([0.25 * -H[0], 0.25 * -H[1], 0.25 * -H[2]], [0, 0, 0], 1.25);
const at = (d) => [H[0] + d[0], H[1] + d[1], H[2] + d[2]];
const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2'];

// the head sits off x = 0, so the right eye is written out rather than mirrored
const eyeL = { side: 'L', at: at([2.9, -3.8, 1.3]), size: 1.75, yaw: 44, squash: 0.6, frame: HF };
const face = eyeKit({ eyes: [eyeL, { ...eyeL, side: 'R', at: at([-2.9, -3.8, 1.3]), yaw: -44 }], skin: NAVY });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'spine1', parent: 'root', at: CTRL[4] },
  { name: 'spine2', parent: 'spine1', at: CTRL[3] },
  { name: 'neck', parent: 'spine2', at: CTRL[2] },
  { name: 'head', parent: 'neck', at: [-1.5, -4.5, 28.5] },
  { name: 'jaw', parent: 'head', at: HF.world(at([0, 1, -1.6])) },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'root' : tail[i - 1], at: CTRL[16 + i] })),
  ...face.joints,
];

function spanJoint({ i }) {
  const s = Math.floor(i / N);
  if (s <= 1) return 'neck';
  if (s === 2) return 'spine2';
  if (s === 3) return 'spine1';
  if (s >= 16) return tail[Math.min(1, s - 16)];
  return 'root';
}

// fin fans: the crest and cheek frills ride the head; the three fans down the neck ride its links
const NECK_FANS = [4, 7, 10].map((i, j) => ({ p: [PTS[i][0], PTS[i][1] + RS[i] * 0.75, PTS[i][2]], l: 6.4 - j * 1.2, joint: spanJoint({ i }) }));
const HEAD_FANS = [{ p: HF.world(at([0, 2.4, 1.8])), l: 13.5 }, { p: HF.world(at([3.4, 0.6, 0])), l: 6 }, { p: HF.world(at([-3.4, 0.6, 0])), l: 6 }];

function assign(c, rgb) {
  if (isAny(rgb, ROCK) && c[2] < 3) return 'root';
  const h = HF.local(c);
  const d = [h[0] - H[0], h[1] - H[1], h[2] - H[2]];      // in the head block's own numbers, from H
  if (near(rgb, FANG)) return d[2] < -2.6 ? 'jaw' : 'head';
  const hit = chainHit(c, PTS, RS);
  if (isAny(rgb, FINS)) {
    if (hit.d < 1.25 && Math.hypot(...d) > 7) return spanJoint(hit);   // spots and ridge spines on the body
    const fans = [...HEAD_FANS.map((f) => ({ ...f, joint: 'head' })), ...NECK_FANS];
    let best = fans[0]; let bd = Infinity;
    for (const f of fans) { const k = Math.hypot(c[0] - f.p[0], c[1] - f.p[1], c[2] - f.p[2]) / f.l; if (k < bd) { bd = k; best = f; } }
    return bd < 1.3 ? best.joint : spanJoint(hit);
  }
  const headD = Math.min(blobD(d, [[[4.2, 4.4, 3.4], [0, 0, 0]], [[3, 3, 2], [0, -5, 0.6]], [[1.8, 1.6, 1.4], [0, -9.6, 0.2]]]),
    Math.hypot(...d) < 9 && d[2] > 1.5 ? 1 : 9);              // the brow horns
  const q = unrot([-30, 0, 0], [d[0], d[1] + 0.5, d[2] + 2.2]);
  const jawD = blobD(q, [[[3.4, 2.4, 1.8], [0, 0, 0]], [[2.5, 1.8, 1.4], [0, -4, -0.2]], [[1.7, 1.2, 1.1], [0, -8, -0.4]]]);
  return closest([['head', headD], ['jaw', jawD * 1.03], [spanJoint(hit), hit.d], ['root', isAny(rgb, ROCK) ? 0 : 9]]);
}

const base = serpentClips({ face, spine, tail });

const clips = {
  ...base,

  // fidget: a deep-sea roar, the jaws gaping wide, the head shaking, then a snap shut
  idle_roar: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.66, 1], [0.74, 0]]);
      const tr = osc(u, 14) * win(u, 0.22, 0.66, 0.05);
      return merge({
        spine2: { r: [-4 * on, 0, 0] },
        neck: { r: [-6 * on, 0, 2 * tr] },
        head: { r: [-12 * on, 2 * tr, 3 * tr] },
        jaw: { r: [24 * on, 0, 0] },
        ...face.pose('open', on > 0.5 ? 0.4 : blinks(u, [[0.86, 0.9]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
