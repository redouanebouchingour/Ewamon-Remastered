// Voidraxis's rig: an eastern void dragon reared up in a great upright loop. The bottom of the loop stays on the
// ground (root, with the small gripping hind legs); the front of the loop is the spine up to the head with its dropped
// jaw; the clawed forelegs reach from the chest; the tail drops away behind. Numbers are scad/voidraxis.scad's (its
// body is a Catmull-Rom spline through `ctrl`, rebuilt here); the head is its translate(hp) scale(1.5) block (H).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, fold, isAny, near, side, subFrame, unrot } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const BODY = [0.11, 0.07, 0.27];
const MANE = [[0.2, 0.42, 0.55], [0.32, 0.2, 0.6], [0.14, 0.14, 0.38]];
const CLAW = [0.75, 0.68, 0.9];
const FANG = [0.92, 0.88, 0.98];

const CTRL = [[-3, -5, 30], [0, -3.5, 26], [2.2, -3, 21], [0.5, -3.4, 16], [-4, -2.6, 11], [-6, -1.5, 6], [-2, 0, 3.4],
  [5, 1, 3.6], [11, 2, 7.5], [12.5, 2.6, 13.5], [9, 3, 18], [2.5, 4, 17.5], [-4, 4, 13.5], [-9, 3, 9],
  [-12, 1, 4.6], [-15.5, -1.5, 3], [-18, -3, 4]];
const CTRL_R = [2.8, 3.1, 3.5, 3.9, 4.3, 4.5, 4.6, 4.5, 4.3, 4, 3.7, 3.3, 2.9, 2.4, 1.9, 1.2, 0.5];
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

const HP = [-3, -6, 32];
const H = subFrame(HP, [0, 0, 0], 1.5);
const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2', 'tail3'];
const LEG = [[3.4, -4.6, 17.5], [7, -7.4, 15], [6.4, -11, 16.4]];
const HIND = [[3.4, -1.6, 4], [6.6, -4, 2.6], [6.2, -6.6, 1.4]];

const eyeL = { side: 'L', at: [1.75, -2.6, 1.35], size: 1.6, yaw: 44, squash: 0.6, frame: H };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY });

const joints = [
  { name: 'root', at: [-2, 0, 0] },
  { name: 'spine1', parent: 'root', at: CTRL[4] },
  { name: 'spine2', parent: 'spine1', at: CTRL[3] },
  { name: 'neck', parent: 'spine2', at: CTRL[2] },
  { name: 'head', parent: 'neck', at: [-1.5, -4.5, 28.5] },
  { name: 'jaw', parent: 'head', at: H.world([0, 0.5, -1.2]) },
  { name: 'armL', parent: 'spine2', at: LEG[0] },
  { name: 'foreL', parent: 'armL', at: LEG[1] },
  { name: 'armR', parent: 'spine2', at: [-LEG[0][0], LEG[0][1], LEG[0][2]] },
  { name: 'foreR', parent: 'armR', at: [-LEG[1][0], LEG[1][1], LEG[1][2]] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'root' : tail[i - 1], at: CTRL[13 + i] })),
  ...face.joints,
];

/** The joint of a body point by its spline span (ctrl i to i + 1). */
function spanJoint({ i }) {
  const s = Math.floor(i / N);
  if (s <= 1) return 'neck';
  if (s === 2) return 'spine2';
  if (s === 3) return 'spine1';
  if (s >= 13) return tail[Math.min(2, s - 13)];
  return 'root';
}

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  const h = H.local(c);
  if (isAny(rgb, MANE)) return c[2] > 26 ? 'head' : 'neck';
  if (near(rgb, CLAW) && c[2] > 26) return 'head';               // horns
  if (near(rgb, FANG)) return h[2] < -1.6 ? 'jaw' : 'head';
  const headD = blobD(h, [[[2.8, 3, 2.4], [0, 0.4, 0.4]], [[2.3, 2.7, 1.9], [0, -2, 0.4]], [[1.8, 2.4, 1.4], [0, -4.4, 0.4]], [[1.3, 1, 1], [0, -6.6, 0.4]],
    [[1.1, 2.6, 0.6], [0, -4.4, 1.6]]]);
  const q = unrot([-16, 0, 0], [h[0], h[1], h[2] + 1.2]);
  const jawD = blobD(q, [[[2.2, 2, 0.9], [0, 0, 0]], [[1.6, 1.6, 0.8], [0, -2.7, -0.1]], [[1, 1, 0.7], [0, -5.4, -0.2]]]);
  const arm = capD(f, LEG[0], LEG[1], 1.6, 1.28);
  const fore = Math.min(capD(f, LEG[1], LEG[2], 1.28, 0.96), capD(f, LEG[2], [LEG[2][0], LEG[2][1] - 1.6, LEG[2][2] - 0.4], 1.2));
  const hind = Math.min(capD(f, HIND[0], HIND[1], 1.4, 1.12), capD(f, HIND[1], HIND[2], 1.12, 0.84), capD(f, HIND[2], [HIND[2][0], HIND[2][1] - 1.6, HIND[2][2]], 1));
  const hit = chainHit(c, PTS, RS);
  return closest([['head', headD], ['jaw', jawD * 1.02], [`arm${S}`, arm], [`fore${S}`, fore], ['root', hind], [spanJoint(hit), hit.d]]);
}

const base = serpentClips({ face, spine, tail });

const clips = {
  ...base,

  // fidget: coils its forelegs and rakes the air, the mane rippling, a slow glare round
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
        armL: { r: [-30 * on + 20 * rake, 0, 0] },
        foreL: { r: [-20 * on - 15 * rake, 0, 0] },
        armR: { r: [-30 * on - 20 * rake, 0, 0] },
        foreR: { r: [-20 * on + 15 * rake, 0, 0] },
        ...face.pose('open', blinks(u, [[0.88, 0.92]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
