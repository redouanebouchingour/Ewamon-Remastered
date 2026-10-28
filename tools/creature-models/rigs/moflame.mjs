// Moflame's rig: a lean fire pup on four legs, a flame streaming back from its crest and a long flame tail. Numbers are
// scad/moflame.scad's; everything but the legs sits in its translate([0, 0, -2]) block (dz()).
import { rigDef } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const dz = ([x, y, z]) => [x, y, z - 2];
const COAT = [0.86, 0.42, 0.22];
const COAT_DK = [0.68, 0.3, 0.16];
const CREAM = [0.9, 0.78, 0.58];
const CREAM_DK = [0.78, 0.64, 0.44];
const STRIPE = [0.12, 0.08, 0.06];
const CREST = [0.55, 0.4, 0.18];
const FLAMES = [[0.9, 0.15, 0.08], [1, 0.5, 0.1], [1, 0.82, 0.35]];

const MANE = [[0, -10, 24], [0.5, -6, 25.5], [0.6, -2, 26], [0, 2, 25.5], [0, 5, 26.5]].map(dz);
const MANE_R = [2.2, 2.6, 2.2, 1.5, 0.6];
const TAIL = [[0, 6, 15], [0.3, 10, 17], [0.5, 14, 19], [0.2, 18, 20.5], [0, 22, 22.5], [0, 25, 24]].map(dz);
const TAIL_R = [2.2, 3, 3.2, 2.8, 2, 0.7];
const mane = ['mane1', 'mane2', 'mane3', 'mane4'];
const tail = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];
const LEGS = [['F', 3.2, -6.5], ['B', 3.4, 4.5]];

const eyeL = { side: 'L', at: dz([1.95, -13.6, 20.8]), size: 1.3, yaw: 10 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: COAT });

const joints = [
  { name: 'root', at: [0, -1, 0] },
  ...LEGS.flatMap(([k, x, y]) => [{ name: `leg${k}L`, parent: 'root', at: [x, y, 9] }, { name: `leg${k}R`, parent: 'root', at: [-x, y, 9] }]),
  { name: 'body', parent: 'root', at: dz([0, -1, 12]) },
  { name: 'head', parent: 'body', at: dz([0, -10, 18.5]) },
  { name: 'earL', parent: 'head', at: dz([2.6, -10.5, 22.6]) },
  { name: 'earR', parent: 'head', at: dz([-2.6, -10.5, 22.6]) },
  ...mane.map((name, i) => ({ name, parent: i === 0 ? 'head' : mane[i - 1], at: MANE[i] })),
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (isAny(rgb, FLAMES, 0.05)) {
    const m = chainHit(c, MANE, MANE_R);
    const t = chainHit(c, TAIL, TAIL_R);
    return m.d < t.d ? mane[Math.min(3, m.i)] : tail[Math.min(4, t.i)];
  }
  if (near(rgb, CREST)) return 'head';
  if (!isAny(rgb, [COAT, COAT_DK, CREAM, CREAM_DK, STRIPE])) return 'head';     // eyes
  const legD = ([, x, y]) => Math.min(
    capD(f, [x, y, 9], [x * 1.05, y - 0.5, 2.5], 2.4, 1.9),
    ellD(f, [1.8, 2.4, 1.3], [x * 1.08, y - 1.2, 1.3]),
    ellD(f, [2.2, 2.2, 0.35], [x * 1.05, y - 0.3, 5.5]),
    ellD(f, [2.2, 1.2, 0.8], [x * 1.08, y - 3.4, 0.6]),
  );
  return closest([
    ...LEGS.map((l) => [`leg${l[0]}${S}`, legD(l)]),
    ['body', Math.min(
      blobD(c, [[[5.5, 7, 5.5], dz([0, 0, 13])], [[5, 4.5, 5.5], dz([0, -6, 14.5])]]),
      ellD(c, [4.6, 5.5, 3], dz([0, 0, 9.6])),
      ellD(c, [4, 2.5, 4], dz([0, -9, 16])),
      // the chest ruff's petals hang from (0, -9.5, 15) down to z 10
      capD(c, dz([0, -9.5, 15]), dz([0, -11, 10]), 2.6, 0.6) * 0.95,
    )],
    ['head', Math.min(
      blobD(c, [[[3.8, 3.8, 3.6], dz([0, -11, 20])], [[2.3, 2.6, 1.9], dz([0, -14.5, 18.6])]]),
      ellD(f, [1.7, 1.6, 1.5], dz([2.6, -12.8, 18.3])),
      ellD(c, [0.9, 0.6, 0.6], dz([0, -16.9, 19.2])),
      ellD(f, [2, 1.6, 1.8], dz([1.95, -13.8, 21])),
    )],
    [`ear${S}`, capD(f, dz([2.6, -10.5, 22.6]), dz([4, -8.9, 26]), 1.1, 0.1)],
  ]);
}

const clips = quadrupedClips({ face, tail, mane, hipH: 9, stride: 14, flicker: 0.16 });

export default rigDef({ joints, assign, extras: face.extras, clips });
