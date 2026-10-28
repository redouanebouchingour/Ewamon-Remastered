// Puffinch's rig: a round chick (the egg body is its head too), stubby wings, a crest tuft and two ribbon tail
// feathers lying on the ground. Numbers are scad/puffinch.scad's.
import { rigDef } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, closest, ellD, fold, isAny, near, side, unrot } from './lib/geo.mjs';

const TAN = [0.78, 0.6, 0.36];
const TAN_DK = [0.62, 0.45, 0.26];
const CREAM = [0.97, 0.9, 0.7];
const FOOT = [0.98, 0.55, 0.15];

const RIBBONS = [
  [[6, 10, 6], [11, 12, 3], [15, 10, 2.2], [18, 13, 1], [21, 11, 0.6], [24, 13, 0.6]],
  [[4, 11, 5], [7, 15, 2], [11, 17, 1.4], [15, 15, 0.6], [18, 18, 0.6], [22, 17, 0.6]],
];
const trail = RIBBONS.map((pts, k) => pts.slice(0, -1).map((_, i) => `trail${'AB'[k]}${i + 1}`));
const FEATHERS = [[0, 5.5], [-22, 5], [-44, 4.2]];

const eyeL = { side: 'L', at: [4.3, -10.9, 20], size: 2.5, yaw: -18, flat: 0.4 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: CREAM });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [5, -1, 4] },
  { name: 'legR', parent: 'root', at: [-5, -1, 4] },
  { name: 'body', parent: 'root', at: [0, -1, 3] },
  { name: 'wingL', parent: 'body', at: [12, 1, 18] },
  { name: 'wingR', parent: 'body', at: [-12, 1, 18] },
  { name: 'crest1', parent: 'body', at: [0, 1, 28.5] },
  ...RIBBONS.flatMap((pts, k) => trail[k].map((name, i) => ({ name, parent: i === 0 ? 'root' : trail[k][i - 1], at: pts[i] }))),
  ...face.joints,
];

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (near(rgb, FOOT)) return `leg${S}`;
  if (near(rgb, TAN_DK)) return c[2] > 27 ? 'crest1' : 'body';
  if (!isAny(rgb, [TAN, CREAM])) return 'body';                 // eyes, beak
  const wing = Math.min(...FEATHERS.map(([a, l]) => {
    const q = unrot([0, a - 25, -12], [f[0] - 12, f[1] - 1, f[2] - 18]);
    return ellD([q[0] - l * 0.7, q[1], q[2]], [l, 1.1, 1.5]);
  }));
  const rib = RIBBONS.map((pts) => chainHit(c, pts, pts.map(() => 0.9)));
  return closest([
    ['body', ellD(c, [13, 12, 14], [0, 0, 16]) / 1.015],
    [`wing${S}`, wing],
    ...rib.map((h, k) => [trail[k][Math.min(4, h.i)], h.d]),
  ]);
}

const clips = birdClips({ face, crest: ['crest1'], trail, flapUp: 85 });

export default rigDef({ joints, assign, extras: face.extras, clips });
