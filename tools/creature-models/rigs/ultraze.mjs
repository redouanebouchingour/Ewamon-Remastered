// Ultraze's rig: a hunched gunmetal war robot, the right claw raised, the left arm hanging behind its forearm shield,
// exhaust stacks puffing red smoke. Its eyes are glowing slits (no lib.scad eye()), so the face is two slit joints
// that blink and squint by scaling. Numbers are scad/ultraze.scad's; the head is inside
// translate([0, -2, 33]) scale(1.3) translate([0, 0, -33]).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks } from './lib/face.mjs';
import { fold, near, subFrame } from './lib/geo.mjs';

const SEAM = [0.85, 0.1, 0.1];
const SMOKE = [0.75, 0.12, 0.08];
const H = subFrame([0, -2, 33 - 33 * 1.3], [0, 0, 0], 1.3);
const hf = (test) => (c) => test(fold(H.local(c)));
const hp = (test) => (c) => test(H.local(c));
const sin = (a) => Math.sin((a * Math.PI) / 180);

// the slit eyes: open, blinking (squashed shut), happy / squeezed (half shut), dizzy (flickering)
const face = {
  pose: (kind = 'open', blink = 0) => {
    const k = { open: 1 - 0.92 * Math.min(1, blink), shut: 0.08, happy: 0.35, squeeze: 0.2, dizzy: 0.5 }[kind] ?? 1;
    return both('eye', { s: [1, 1, k] }, { s: [1, 1, kind === 'dizzy' ? 0.15 : k] });
  },
};

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.5, 1, 16]),
  { name: 'body', parent: 'root', at: [0, 1, 16.5] },
  { name: 'head', parent: 'body', at: [0, -2, 32] },
  { name: 'jaw', parent: 'head', at: H.world([0, -4.5, 33]) },
  { name: 'eyeL', parent: 'head', at: H.world([1.4, -6.5, 36]), rot: [0, -20, 0] },
  { name: 'eyeR', parent: 'head', at: H.world([-1.4, -6.5, 36]), rot: [0, 20, 0] },
  { name: 'smoke1', parent: 'body', at: [0.5, 7.5, 40.5] },
  { name: 'smoke2', parent: 'body', at: [-3, 6.5, 37.5] },
  { name: 'armL', parent: 'body', at: [11, 0, 29] },
  { name: 'foreL', parent: 'armL', at: [14, -1, 21] },
  { name: 'handL', parent: 'foreL', at: [14.5, -4, 14] },
  { name: 'armR', parent: 'body', at: [-11, 0, 29] },
  { name: 'foreR', parent: 'armR', at: [-15, -2, 23] },
  { name: 'handR', parent: 'foreR', at: [-16, -4, 30] },
];

const clawsR = [-45, -18, 9, 36].flatMap((a) => chain(['handR'], [[-16.2 + sin(a) * 1.6, -4.6, 32], [-16.2 + sin(a) * 2.8, -5.2, 35], [-16.2 + sin(a) * 3.2, -6.6, 36.5]], [0.6, 0.45, 0.1]));
const clawsL = [-35, -10, 15, 40].flatMap((a) => chain(['handL'], [[14.5 + sin(a) * 1.4, -5.4, 12.5], [14.5 + sin(a) * 2.2, -7, 10.5], [14.5 + sin(a) * 2.4, -7.2, 8]], [0.6, 0.45, 0.1]));
const stacks = [[-3, 6.5, 30, 7], [0.5, 7.5, 31, 9], [4, 6.5, 30, 6]].map(([x, y, z, h]) => limb([x, y, z], [x, y, z + h + 0.9], 1.6));

const parts = [
  ['body', any(blob([[[6, 4.5, 3.5], [0, 1, 17]]]), ell([5.5, 4, 2.4], [0, 0.5, 17.5]), blob([[[4, 3.4, 4], [0, 1, 21]]]),
    ...[19.5, 21.5, 23.5].map((z) => ell([3.6, 2.8, 0.8], [0, -1, z])), blob([[[9, 6, 5], [0, 2, 29]], [[7, 5, 3], [0, 1, 25.5]]]),
    ell([6.5, 2.4, 3.6], [0, -2.4, 29]), ell([2, 1, 2], [0, -4.9, 28.2]), blob([[[7, 3, 5], [0, 5, 27]]]), ...stacks,
    mx(ell([5, 5, 4.4], [10.5, 1, 31])), mx(ell([3.8, 3.8, 2.6], [10.8, -0.2, 32.6])))],
  ['head', any(hp(blob([[[3.6, 3.8, 4], [0, -2.5, 36]], [[2.6, 2.6, 2.4], [0, -4.6, 33]]])), hp(ell([2.8, 2.2, 2.2], [0, -4.6, 37])),
    hp(ell([2.4, 1, 1.8], [0, -6.4, 33])), hf(ell([1.3, 0.8, 0.8], [1.4, -6, 36])), hf(limb([1, -6.6, 37.6], [2.2, -5.8, 39], 0.3)),
    hf(limb([3, -3, 38], [4.4, -1, 40.5], 0.9, 0.7)), hf(limb([4.4, -1, 40.5], [4.6, 2, 42], 0.7, 0.15)),
    hf(limb([2.6, -1, 39], [3.4, 1.5, 40], 0.7, 0.5)), hf(limb([3.4, 1.5, 40], [3.2, 4, 40.4], 0.5, 0.15)),
    ...[-1.4, -0.5, 0.5, 1.4].map((x) => hp(ell([0.5, 0.5, 0.8], [x, -7.2, 34.3]))))],
  ['jaw', any(...[-1.4, -0.5, 0.5, 1.4].map((x) => hp(ell([0.45, 0.45, 0.7], [x, -7.1, 31.8]))))],
  ['leg*', any(limb([3.5, 1, 16], [7.5, -2, 10.5], 3.2, 2.6), ell([2.2, 2.2, 2.2], [7.5, -2.4, 10.5]), limb([7.5, -2, 10.5], [8, 1.5, 4], 2.2, 1.7),
    ell([2, 1.5, 3], [7.6, -1.5, 8]), blob([[[2.6, 3.4, 1.6], [8.2, -1.5, 1.6]]]), ...[-30, 0, 30].map((a) => spike([8.2 + sin(a) * 1.8, -4.5, 1.2], [sin(a) * 0.6, -2, -0.9], 0.6)),
    spike([8.2, 1.5, 1.4], [0, 1.8, -1], 0.6))],
  ['armR', any(limb([-11, 0, 29], [-15, -2, 23], 2.4, 2), ell([2.6, 2.6, 3.2], [-14.6, -2.4, 24.6]))],
  ['foreR', limb([-15, -2, 23], [-16, -4, 30], 2, 1.8)],
  ['handR', ell([2.2, 1.6, 2], [-16.2, -4.4, 31])],
  ...clawsR,
  ['armL', any(limb([11, 0, 29], [14, -1, 21], 2.4, 2), ell([2.2, 2.2, 2.2], [14, -1, 21]))],
  ['foreL', any(limb([14, -1, 21], [14.5, -4, 14], 2.2, 2), ell([1.8, 4.2, 6], [16.2, -2.6, 17]), ell([0.8, 3.2, 4.8], [17.4, -2.6, 17.4]),
    limb([17.6, -5.5, 14], [17.6, -3, 21], 0.4))],
  ['handL', ell([2, 1.8, 1.8], [14.5, -4.6, 13])],
  ...clawsL,
];

function assign(c, rgb) {
  if (near(rgb, SMOKE)) return c[0] > -1.5 ? 'smoke1' : 'smoke2';
  if (near(rgb, SEAM) && c[2] > 33) {
    const l = H.local(c);
    if (l[1] < -5.8 && l[2] > 35.2 && l[2] < 36.8 && Math.abs(l[0]) < 2.6) return l[0] > 0 ? 'eyeL' : 'eyeR';
  }
  return pick(c, parts);
}

// the smoke puffs swell and drift up on counted beats; the stacks cough harder in a fight
const puff = (u, beats, amp = 1) => {
  const ph = (k) => ((u * beats + k) % 1);
  return {
    smoke1: { p: [0, 0, 1.2 * amp * ph(0)], s: 0.25 + 1.05 * Math.max(0.2, amp) * Math.sin(Math.PI * ph(0)) },
    smoke2: { p: [0, 0, 1.2 * amp * ph(0.5)], s: 0.25 + 1.05 * Math.max(0.2, amp) * Math.sin(Math.PI * ph(0.5)) },
  };
};

const base = bipedClips({
  face, hipH: 15, stride: 14, armSwing: 10, hopScale: 0.3, droop: 0.6,
  // the raised claw rakes forward
  punch: { arm: [-60, 0, 0], fore: [90, 0, 0] },
  cheer: { arm: [-10, -100, 0], fore: [0, -30, 0] },
  add: {
    idle: (t, u) => puff(u, 4),
    walk: (t, u) => puff(u, 2, 1.2),
    idle_look: (t, u) => puff(u, 2),
    windup: (t, u) => ({ ...puff(u, 1, 1.4), jaw: { r: [14 * u, 0, 0] } }),
    lunge: (t, u) => ({ ...puff(u, 1, 1.6), jaw: { r: [18 * K(u, [[0, 1], [0.4, 1], [1, 0]]), 0, 0] } }),
    hurt: (t, u) => puff(u, 1, 0.5),
    recoil: (t, u) => puff(u, 1, 0.6),
    faint: (t, u) => puff(u, 2, 1 - Math.min(1, u * 1.4)),
    celebrate: (t, u) => ({ ...puff(u, 2, 1.6), jaw: { r: [16 * win(u, 0, 1, 0.15), 0, 0] } }),
    enter: (t, u) => puff(u, 1, 1.5),
    exit: (t, u) => puff(u, 1),
  },
});

const clips = {
  ...base,

  // fidget: a target scan: the head ratchets left and right in servo steps, the eyes narrow to slits on each stop
  idle_scan: {
    seconds: 2.4,
    pose: (t, u) => {
      const step = (x) => Math.floor(x * 4) / 4 + 0.25 * Math.min(1, ((x * 4) % 1) * 4);
      const look = K(step(u), [[0, 0], [0.25, 24], [0.5, 0], [0.75, -24], [1, 0]]);
      return merge({
        body: { r: [0, 0, 0.3 * look] },
        head: { r: [-3, 0, look] },
        ...face.pose('open', 0.5 + 0.5 * Math.cos(TAU * 4 * u) * 0.6),
        ...both('arm', { r: [2 * osc(u, 2), 0, 0] }),
      }, puff(u, 4));
    },
  },

  // fidget: it vents: a shudder, the stacks belch a big cloud, the maw drops open glowing
  idle_vent: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.6, 1], [0.85, 0]]);
      const sh = Math.sin(TAU * 11 * u) * win(u, 0.05, 0.3, 0.05);
      return merge({
        root: { r: [0, 0, 0.8 * sh] },
        body: { r: [-6 * on, 0, 1.2 * sh] },
        head: { r: [-12 * on, 0, 0] },
        jaw: { r: [22 * on, 0, 0] },
        ...face.pose(on > 0.5 ? 'happy' : 'open'),
        ...both('arm', { r: [6 * on, -10 * on, 0] }),
      }, puff(u, 2, 1 + 1.2 * on));
    },
  },
};

export default rigDef({ joints, assign, clips });
