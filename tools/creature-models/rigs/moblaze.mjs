// Moblaze's rig: Moflame grown into a burly fire hound. A crown of fire and a flame streamer on the head (mane chain),
// a fanned tail of four flame feathers (one tail joint off the rump, the feathers sway as a fan) and loose embers
// drifting round it (their own joint). Numbers are scad/moblaze.scad's; everything but the legs sits in its
// translate([0, 0, -2]) block (dz()).
import { K, TAU, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const dz = ([x, y, z]) => [x, y, z - 2];
const COATS = [[0.82, 0.45, 0.25], [0.68, 0.3, 0.16], [0.9, 0.78, 0.58], [0.78, 0.64, 0.44], [0.3, 0.16, 0.08], [1, 0.55, 0.12]];
const CREST = [0.55, 0.4, 0.18];
const FLAMES = [[0.9, 0.15, 0.08], [1, 0.5, 0.1], [1, 0.82, 0.35]];

const MANE = [[0, -10, 24], [0.5, -6, 25.5], [0.6, -2, 26], [0, 2, 25.5], [0, 5, 26.5]].map(dz);
const MANE_R = [2.2, 2.6, 2.2, 1.5, 0.6];
const mane = ['mane1', 'mane2', 'mane3', 'mane4'];
const EMBERS = [[5, 18, 27], [-4, 24, 24], [7, 26, 16], [-6, 8, 28], [3, -5, 30]].map(dz);
const LEGS = [['F', 3.2, -6.5], ['B', 3.4, 4.5]];

const eyeL = { side: 'L', at: dz([1.95, -13.6, 20.8]), size: 1.35, yaw: 10 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: COATS[0] });

const joints = [
  { name: 'root', at: [0, -1, 0] },
  ...LEGS.flatMap(([k, x, y]) => [{ name: `leg${k}L`, parent: 'root', at: [x, y, 9] }, { name: `leg${k}R`, parent: 'root', at: [-x, y, 9] }]),
  { name: 'body', parent: 'root', at: dz([0, -1, 12]) },
  { name: 'head', parent: 'body', at: dz([0, -10, 18.5]) },
  { name: 'earL', parent: 'head', at: dz([2.6, -10.5, 22.6]) },
  { name: 'earR', parent: 'head', at: dz([-2.6, -10.5, 22.6]) },
  { name: 'crown', parent: 'head', at: dz([0, -11.5, 23]) },
  ...mane.map((name, i) => ({ name, parent: i === 0 ? 'head' : mane[i - 1], at: MANE[i] })),
  { name: 'tail1', parent: 'body', at: dz([0, 6, 14]) },
  { name: 'embers', parent: 'root', at: [0, 4, 0] },
  ...face.joints,
];

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (isAny(rgb, FLAMES, 0.05)) {
    if (Math.min(...EMBERS.map((e) => ellD(c, [1.2, 1.2, 1.2], e))) < 1.1) return 'embers';
    if (ellD(c, [3.4, 3, 9], dz([0, -11.8, 27])) < 1) return 'crown';
    const m = chainHit(c, MANE, MANE_R);
    return m.d < 1.6 ? mane[Math.min(3, m.i)] : 'tail1';
  }
  if (near(rgb, CREST)) return 'head';
  if (!isAny(rgb, COATS, 0.03)) return 'head';     // eyes
  const legD = ([, x, y]) => Math.min(
    capD(f, [x, y, 9], [x * 1.05, y - 0.5, 2.5], 2.7, 2.1),
    ellD(f, [1.8, 2.4, 1.3], [x * 1.08, y - 1.2, 1.3]),
    ellD(f, [2.2, 2.2, 0.35], [x * 1.05, y - 0.3, 5.5]),
    ellD(f, [2.2, 1.2, 0.8], [x * 1.08, y - 3.4, 0.6]),
    ellD(f, [0.8, 0.6, 1.4], [x * 1.25, y - 1.6, 7]),
  );
  return closest([
    ...LEGS.map((l) => [`leg${l[0]}${S}`, legD(l)]),
    ['body', Math.min(
      blobD(c, [[[6.2, 7.5, 6], dz([0, 0, 13])], [[5.8, 5, 6], dz([0, -6, 14.5])]]),
      ellD(c, [4.6, 5.5, 3], dz([0, 0, 9.6])),
      blobD(c, [[[5.6, 3.6, 5.4], dz([0, -8.5, 17])], [[4.6, 3, 4], dz([0, -6, 19.5])]]),
      capD(c, dz([0, -8.5, 16.5]), dz([0, -10.5, 9.5]), 3.2, 0.6) * 0.95,
      capD(c, dz([0, -4, 17]), dz([0, 1, 20]), 1.6, 0.3),
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

// the tail fan sways, the embers drift and wink, the crown flickers
const fan = (u, amp = 5, cycles = 1, lift = 0) => ({ tail1: { r: [lift + 2 * osc(u, cycles, 0.3), 0, amp * osc(u, cycles)] } });
const drift = (u, cycles = 1, amp = 1) => ({ embers: { p: [0, 0, 1.2 * amp * osc(u, cycles)], s: 1 + 0.12 * osc(u, cycles * 3, 0.2) } });
const crown = (u, steps = 12, amp = 1) => ({ crown: { s: [1, 1, 1 + 0.18 * amp * (hash((Math.floor(u * steps) % steps) * 5.3) - 0.5)] } });

const base = quadrupedClips({
  face, mane, hipH: 9, stride: 14, flicker: 0.16,
  add: {
    idle: (t, u) => merge(fan(u, 5, 2), drift(u, 1), crown(u, 48)),
    walk: (t, u) => merge(fan(u, 8, 1, 4), drift(u, 2), crown(u, 8)),
    idle_sniff: (t, u) => merge(fan(u, 4, 2), drift(u, 1), crown(u, 24)),
    idle_shake: (t, u) => merge(fan(u, 14 * win(u, 0.1, 0.8, 0.06), 7), drift(u, 2, 2), crown(u, 24, 2)),
    windup: (t, u) => merge(fan(u, 3, 3, 12), crown(u, 4, 2)),
    lunge: (t, u) => merge(fan(u, 4, 2, 10), crown(u, 4, 2)),
    hurt: (t, u) => merge(fan(u, 0, 1, -14 * K(u, [[0, 0], [0.18, 1], [1, 0.4]])), drift(u, 2, 2)),
    faint: (t, u) => { const d = K(u, [[0.2, 0], [0.8, 1]]); return { ...fan(u, 0, 1, -16 * d), embers: { p: [0, 0, -3 * d], s: 1 - 0.6 * d }, crown: { s: [1, 1, 1 - 0.7 * d] } }; },
    celebrate: (t, u) => merge(fan(u, 14, 4, 12), drift(u, 2, 2), crown(u, 6, 2)),
    enter: (t, u) => merge(fan(u, 8, 1, 10 * win(u, 0.4, 0.9, 0.12)), crown(u, 6, 2)),
  },
});
const { idle_wag: _wag, ...clips0 } = base;

const clips = {
  ...clips0,
  // fidget: the fire flares: the crown roars up, the tail fans out, the embers burst outwards and settle
  idle_flare: {
    seconds: 2,
    pose: (t, u) => {
      const k = K(u, [[0, 0], [0.18, 1], [0.6, 1], [0.9, 0]]);
      return merge({
        body: { r: [-4 * k, 0, 0] },
        head: { r: [-10 * k, 0, 0] },
        crown: { s: [1 + 0.15 * k, 1 + 0.15 * k, 1 + 0.5 * k] },
        embers: { s: 1 + 0.35 * k, p: [0, 0, 2 * k] },
        tail1: { r: [10 * k, 0, 6 * Math.sin(TAU * 4 * u) * k], s: 1 + 0.12 * k },
        ...face.pose(k > 0.5 ? 'squeeze' : 'open'),
      }, crown(u, 16, 2 * k));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
