// Abyssrake's rig: an abyssal sea serpent rearing up out of two upright coils that stay put on the ground (root); the
// neck is the spine, up to a horned head with a dropped jaw; the great dorsal fin rides the neck links it grows from;
// the tail tip tucked behind the neck flicks on its own. Numbers are scad/abyssrake.scad's: the body is a Catmull-Rom
// spline through `CTRL`, authored in the picture plane (pp: rotate VIEW = 30 about Z) and dropped G = 4; the head is
// its own frame (translate(HP) rotate(HYAW) inside pp), HEAD below.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, isAny, near, plateD, subFrame, unrot } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const G = 4;
const NAVY = [0.12, 0.23, 0.4];
const NAVY_HI = [0.17, 0.33, 0.52];
const SLATE = [[0.4, 0.5, 0.58], [0.2, 0.27, 0.36]];
const GLOW = [0.21, 0.95, 0.97];
const FIN = [0.1, 0.44, 0.6];
const FRILL = [0.15, 0.74, 0.84];
const RIDGE = [0.1, 0.45, 0.6];
const MOUTH = [[0.55, 0.16, 0.21], [0.3, 0.06, 0.1]];
const TONGUE = [0.82, 0.34, 0.36];
const FANG = [0.97, 0.88, 0.6];
const EYE = [[0.35, 0.9, 0.15], [0.72, 1, 0.38], [0.03, 0.05, 0.1]];

const CTRL = [[-3, -0.5, 31.5], [0.3, 1.2, 31.8], [1.3, 1, 28.5], [-0.4, 0.5, 22], [-2, 0, 15.5], [-2.8, -0.5, 10],
  [1, -1.5, 6.9], [6.5, -2, 6.6], [12, -1.8, 7.1], [15, -1.4, 11.5], [12.7, -1, 16.2], [7.5, -0.5, 16.2],
  [2.8, 1, 13.2], [2, 3.5, 8.3], [-3, 5, 6.2], [-9, 3.5, 5.9], [-13.6, 2.8, 6.3], [-15.7, 2.4, 10.6],
  [-13.4, 2.2, 14.3], [-9.6, 2.6, 14.4], [-6, 4, 13], [-3.5, 5, 12]];
const CTRL_R = [3, 3.4, 3.8, 4.4, 4.6, 4.8, 3.2, 2.9, 3, 3.2, 3.2, 3.3, 3, 2.6, 2.3, 2.2, 2.2, 2.4, 2.9, 2.4, 1.6, 0.6];
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

// translate([0, 0, -G]) pp(0) { ... }: the picture-plane frame
const PP = subFrame([0, 0, -G], [0, 0, 30], 1);
const W = (p) => PP.world(p);
// the head: pp(0) translate(HP) rotate([0, 0, HYAW]) -> one translate + rotate about Z
const HP = [-5.5, -1.5, 33.3];
const HEAD = subFrame(W(HP), [0, 0, 30 - 70], 1);
const JAWA = 50;
const HINGE = [0, 0.2, -3];
const jawLocal = (h) => unrot([JAWA, 0, 0], [h[0] - HINGE[0], h[1] - HINGE[1], h[2] - HINGE[2]]);

const eyeL = { side: 'L', at: [1.95, -3.6, -2], size: 1, yaw: 68, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, { ...mirrorEye(eyeL), frame: HEAD }], skin: NAVY });

const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'spine1', parent: 'root', at: W(CTRL[4]) },
  { name: 'spine2', parent: 'spine1', at: W(CTRL[3]) },
  { name: 'neck', parent: 'spine2', at: W(CTRL[2]) },
  { name: 'head', parent: 'neck', at: W(CTRL[0]) },
  { name: 'jaw', parent: 'head', at: HEAD.world(HINGE) },
  { name: 'tail1', parent: 'root', at: W(CTRL[19]) },
  { name: 'tail2', parent: 'tail1', at: W(CTRL[20]) },
  ...face.joints,
];

// a chain link (pts i -> i + 1) to its joint: the arch over the head and the neck top, two neck links, the coils
function spanJoint(i) {
  const s = Math.floor(i / N);
  if (s <= 1) return 'neck';
  if (s === 2) return 'spine2';
  if (s === 3) return 'spine1';
  if (s >= 20) return 'tail2';
  if (s >= 19) return 'tail1';
  return 'root';
}
const NECK_PTS = PTS.slice(0, 4 * N + 1);
const NECK_RS = RS.slice(0, 4 * N + 1);

// the head's primitives, in its own frame
const SKULL = [[[3, 3.2, 3], [0, 0.8, 0.4]], [[2.2, 2.6, 2.3], [0, -4.2, -0.6]], [[1.4, 1.2, 1.45], [0, -8, -1.9]], [[2, 3.6, 0.5], [0, -4.5, -2.9]]];
const JAW = [[[2, 1.6, 1], [0, 0, 0]], [[1.5, 1.25, 0.9], [0, -4.1, 0]], [[1, 0.9, 0.75], [0, -8.2, 0]]];
const FRILL_PTS = [[-0.6, 1], [2.4, 3.6], [6, 3.4], [3.8, 1.4], [6.6, 0], [4, -1.2], [5.6, -3.6], [2.4, -2.8], [-0.4, -1.8]];
const FRILL_F = subFrame([2.5, 1.4, -1.6], [0, 0, -30 + 90], 1);
function headD(h) {
  const f = [Math.abs(h[0]), h[1], h[2]];
  return Math.min(
    blobD(h, SKULL),
    capD(f, [1.1, -1.5, 1.9], [1.5, -0.7, 4.9], 0.6, 0.15),        // horns
    capD(f, [1.1, 0.9, 2.3], [1.5, 2.6, 5.2], 0.7, 0.15),
    plateD(FRILL_F.local(f), FRILL_PTS, 0.8) * 0.9,                  // cheek frill
    Math.hypot(...jawLocal(h)) < 2 ? 1.05 : 9,                      // round the hinge, the skull wins over the jaw
  );
}
// the throat blob: a hull of three spheres in pp under the jaw
const THROAT = [[[-5.2, -1.2, 28.6], 2], [[-6.4, -1.4, 25.6], 1.5], [[-3, -0.6, 22.6], 2.6]];
const throatD = (p) => Math.min(capD(p, THROAT[0][0], THROAT[2][0], THROAT[0][1], THROAT[2][1]),
  capD(p, THROAT[0][0], THROAT[1][0], THROAT[0][1], THROAT[1][1]), capD(p, THROAT[1][0], THROAT[2][0], THROAT[1][1], THROAT[2][1]));

function assign(c, rgb) {
  const p = PP.local(c);
  const h = HEAD.local(c);
  const q = jawLocal(h);
  // around the hinge: the jaw is everything swung down past 25 degrees from the palate
  const swung = (Math.atan2(-(h[2] - HINGE[2]), -(h[1] - HINGE[1])) * 180) / Math.PI > 25;
  if (near(rgb, FANG) || isAny(rgb, MOUTH)) return swung ? 'jaw' : 'head';
  if (near(rgb, TONGUE)) return 'jaw';
  if (isAny(rgb, EYE) || near(rgb, FRILL) || near(rgb, NAVY_HI)) return 'head';
  const hit = chainHit(p, PTS, RS);
  if (near(rgb, FIN) || (near(rgb, GLOW) && hit.d > 1.25)) {
    if (p[2] > 18 && p[0] > -4) return spanJoint(chainHit(p, NECK_PTS, NECK_RS).i);   // the dorsal fin rides the neck
  }
  if (isAny(rgb, [GLOW, RIDGE, ...SLATE])) return spanJoint(chainHit(p, PTS, RS.map((r) => r * 1.15)).i);
  return closest([['head', headD(h)], ['jaw', blobD(q, JAW) * 1.05], ['neck', throatD(p) * 1.02], [spanJoint(hit.i), hit.d]]);
}

const base = serpentClips({ face, spine, tail });

const clips = {
  ...base,

  // fidget: a deep-sea roar, the jaws gaping wider, the head shaking, then a snap back
  idle_roar: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.66, 1], [0.74, 0]]);
      const tr = osc(u, 14) * win(u, 0.22, 0.66, 0.05);
      return merge({
        spine2: { r: [-4 * on, 0, 0] },
        neck: { r: [-6 * on, 0, 2 * tr] },
        head: { r: [-12 * on, 2 * tr, 3 * tr] },
        jaw: { r: [18 * on, 0, 0] },
        ...face.pose('open', on > 0.5 ? 0.4 : blinks(u, [[0.86, 0.9]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
