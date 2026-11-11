// Ultraze's rig: a hunched chrome battle robot in a wide stance, the right (-X) claw raised, the left (+X) arm a
// huge plated gauntlet hanging low, exhaust stacks puffing red smoke. Its eyes are glowing slits (no lib.scad eye()),
// so the face is two slit joints that blink and squint by scaling. Numbers are scad/ultraze.scad's; the head is inside
// translate([-4.4, -5, 31.8]) rotate([0, 0, 20]), the hands and feet in their own turned frames. The scad's banded
// limbs (bands()) are tested as one capsule each.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pick, petal, spike } from './lib/biped.mjs';
import { near, petalD, subFrame } from './lib/geo.mjs';

const EYE = [[1, 0.18, 0.08], [1, 0.52, 0.1]];
const SMOKE = [[0.6, 0.13, 0.1], [0.92, 0.3, 0.12]];
const H = subFrame([-4.4, -5, 31.8], [0, 0, 20]);
const HL = subFrame([16.2, -1.6, 13], [0, 0, 30]);
const HR = subFrame([-15.3, -5.5, 24.6], [0, 0, 30]);
const FL = subFrame([16.2, -3.2, 0], [0, 0, 30]);
const FR = subFrame([-7, 1.4, 0], [0, 0, -30]);
const inF = (f, ...tests) => (c) => any(...tests)(f.local(c));
const fx = (c) => [Math.abs(c[0]), c[1], c[2]];
const fold15 = (c) => [1.5 + Math.abs(c[0] - 1.5), c[1], c[2]];
const claw = (pts, r = 0.55) => any(limb(pts[0], pts[1], r, r * 0.8), limb(pts[1], pts[2], r * 0.8, 0.1));

// the slit eyes: open, blinking (squashed shut), happy / squeezed (half shut), dizzy (flickering)
const face = {
  pose: (kind = 'open', blink = 0) => {
    const k = { open: 1 - 0.92 * Math.min(1, blink), shut: 0.08, happy: 0.35, squeeze: 0.2, dizzy: 0.5 }[kind] ?? 1;
    return both('eye', { s: [1, 1, k] }, { s: [1, 1, kind === 'dizzy' ? 0.15 : k] });
  },
};

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4, 0.6, 15.5] },
  { name: 'legR', parent: 'root', at: [-1.2, 1, 15.5] },
  { name: 'body', parent: 'root', at: [1.5, 1, 15.5] },
  { name: 'head', parent: 'body', at: [-3, -3.5, 29.5] },
  { name: 'jaw', parent: 'head', at: H.world([0, -0.8, -2.6]), rot: [0, 0, 20] },
  { name: 'eyeL', parent: 'head', at: H.world([1.55, -3.45, 0.9]), rot: [0, -22, 20] },
  { name: 'eyeR', parent: 'head', at: H.world([-1.55, -3.45, 0.9]), rot: [0, 22, 20] },
  { name: 'smoke1', parent: 'body', at: [-0.4, 3.2, 36.9] },
  { name: 'smoke2', parent: 'body', at: [6.6, 6, 36.5] },
  { name: 'armL', parent: 'body', at: [9.6, 0.8, 26.2] },
  { name: 'foreL', parent: 'armL', at: [14.6, 1.4, 22.8] },
  { name: 'handL', parent: 'foreL', at: [16.4, -0.6, 15.2] },
  { name: 'armR', parent: 'body', at: [-8.6, -1.2, 23.6] },
  { name: 'foreR', parent: 'armR', at: [-7.6, -3, 18.3] },
  { name: 'handR', parent: 'foreR', at: [-14.4, -5, 22.5] },
];

const pauld = (c, k) => any(ell([4.2 * k, 4.2 * k, 3.7 * k], c), ell([3.6 * k, 3.6 * k, 3 * k], [c[0] + 0.3 * k, c[1] - 0.4 * k, c[2] + 1.1 * k]));
const stacks = [[[-0.3, 3, 31.5], [-0.4, 3.2, 36.6], 0.95], [[3.8, 4.2, 32], [6.2, 5.8, 36], 1.15], [[6.6, 4.8, 31.5], [8.2, 6.2, 34.6], 0.8], [[1.8, 6, 31.5], [2, 6.8, 35.6], 0.85]];
const fingersR = [[-1.6, -1.9, 3.6, -1.6, 5.6], [-0.5, -0.3, 4, 0.7, 6], [0.6, 1.3, 3.6, 2.6, 4.8], [1.7, 2.8, 2.4, 4.3, 2.6]];
// the gauntlet's two outer plates (hulls of these sphere centres)
const plateUp = [[17, 1.9, 26.8], [19.4, 1.6, 23.6], [20.2, 0.9, 19.8], [17.6, 0.3, 19.6], [16.2, 1.6, 23.8]];
const plateLow = [[20.4, 1, 20.6], [20.2, -0.2, 15.4], [18.6, -1, 13.6], [17, -0.8, 15.2], [17.4, 0.6, 20.4]];
const toes = (kx, y1, y2, y3) => [-1, 0, 1].map((x) => claw([[kx[0] * x, y1, 1.3], [kx[1] * x, y2, 1], [kx[2] * x, y3, 0.1]], 0.7));

const parts = [
  ['body', any(
    ell([4.4, 3.4, 2.4], [1.5, 1, 15]), ell([4.7, 3.7, 0.9], [1.5, 1, 16.6]), petal([1.6, 0.8, 1.8], [1.4, -2.3, 14.4], [10, 0, 0]),
    ell([3.2, 2.7, 3.2], [1.2, 0.6, 19.5]), ...[18, 19.6, 21.2].flatMap((z) => [ell([3, 2.4, 0.6], [1.2, 0.4, z]), ell([1.1, 0.8, 0.68], [0, -1.9, z]), ell([1.1, 0.8, 0.68], [2.4, -1.9, z])]),
    blob([[[5.4, 4, 3.4], [1.5, 0, 24]], [[6.4, 4.6, 3.2], [1.8, 1, 27]]]), blob([[[6.2, 4.6, 4.2], [2, 3, 29.5]], [[4.4, 3.4, 2.4], [1.6, 2.4, 32.2]]]),
    ell([3, 3, 3.4], [-2.2, -0.2, 21.8]), petal([2.8, 1, 1.7], [2.6, -1.6, 31.4], [-30, 0, -20]), petal([2.4, 1, 1.4], [4.4, 0.4, 33], [-40, 0, -20]),
    (c) => petalD(fold15(c), [3, 1.3, 2.3], [4.1, -3.2, 25.6], [0, 14, -16]), ell([3.3, 1.1, 2.6], [1.4, -3.2, 23.4]), ell([1.8, 0.6, 1.8], [1.4, -4.25, 23.2]),
    ell([1.25, 0.75, 1.25], [1.4, -4.5, 23.2]), ell([2.6, 2.6, 2.4], [-2.5, -3, 28.6]),
    ...[[32.4, 5.4, 4], [30.2, 6.6, 5], [27.8, 7, 5.4], [25.3, 6.6, 5]].map((b) => petal([b[2] * 0.85, 1, 1.5], [2, b[1] - 0.3, b[0]], [-25, 0, 0])),
    pauld([9.2, 1.4, 28.8], 1.1), pauld([-9.2, 0.6, 27], 1.05),
    spike([12, 3.6, 30.6], [1.4, 1.6, 2.2], 0.7), spike([-11.4, 3, 29], [-1.3, 1.6, 2], 0.6),
    ...stacks.map(([a, b, r]) => limb(a, b, r * 1.2)),
  )],
  ['head', inF(H,
    blob([[[3.8, 3.6, 3.6], [0, 0.6, 1.6]], [[3.2, 3.2, 2.6], [0, 0.4, -1.2]]]), blob([[[2.9, 2, 2.8], [0, -1.8, 1.6]], [[2.3, 1.7, 1.6], [0, -2.2, -1.4]]]),
    ell([1.3, 3, 1], [0, 0.8, 4.6]), ell([1.9, 0.9, 1.5], [0, -3.3, -2.2]), ell([1.2, 0.55, 0.8], [0, -3.7, -2.4]),
    (c) => petalD(fx(c), [1.3, 0.5, 0.75], [1.5, -3.2, 0.95], [0, -22, 0]), (c) => limb([0.8, -3.78, 1.8], [1.8, -2.92, 3.2], 0.16)(fx(c)),
    ...[-1.3, -0.45, 0.45, 1.3].map((x) => spike([x, -3.95, -0.75], [0, -0.1, -1.2], 0.36)), ell([0.8, 0.4, 0.7], [0, -3.6, -0.4]),
    (c) => any(limb([3.5, 0.3, -1.2], [4.1, 0.6, 1.4], 0.75, 0.6), limb([4.1, 0.6, 1.4], [4.2, 0.8, 3.8], 0.6, 0.4), limb([4.2, 0.8, 3.8], [3.6, 0.7, 5.8], 0.4, 0.1))(fx(c)),
  )],
  ['jaw', inF(H, ell([1.8, 1.4, 0.95], [0, -2.7, -4.4]), (c) => limb([2, -1, -3], [1.4, -2.4, -4.3], 0.7, 0.6)(fx(c)),
    ...[-1.4, -0.5, 0.5, 1.4].map((x) => spike([x, -3.85, -3.7], [0, -0.1, 1.1], 0.33)))],
  ['armL', limb([9.6, 0.8, 26.2], [14.4, 1.4, 23], 2.45, 2.1)],
  ['foreL', any(ell([2.2, 2.2, 2.2], [14.6, 1.4, 22.8]), limb([14.6, 1.4, 22.8], [16.4, -0.6, 15.4], 3.3, 2.6),
    ...plateUp.map((q, i) => limb(q, plateUp[(i + 1) % plateUp.length], 0.75)), limb([17.4, 1.4, 25], [19.2, 0.8, 20.2], 1.4),
    ...plateLow.map((q, i) => limb(q, plateLow[(i + 1) % plateLow.length], 0.8)), limb([19.4, 0.4, 19], [18.6, -0.4, 14.6], 1.4),
    limb([19.9, 1.7, 24.2], [20.9, 1, 20.4], 0.32), limb([20.9, 1, 20.4], [20.8, -0.1, 15.6], 0.32), limb([20.8, -0.1, 15.6], [19.2, -1, 13.3], 0.32))],
  ['handL', any(ell([1.8, 1.8, 1.6], [16.4, -0.6, 15.2]), ell([2.4, 2, 2], [16.2, -1.6, 13]), ell([2.3, 1.4, 1.1], [16.3, -2.6, 14]),
    inF(HL, claw([[-1.6, -0.6, -0.6], [-2.8, -1.6, -1.6], [-3.9, -1.2, -2.6]], 0.62), claw([[-0.8, -0.8, -1.2], [-1.3, -1.9, -3.2], [-1.9, -1.4, -4.6]], 0.62),
      claw([[0.4, -0.8, -1.3], [0.6, -1.9, -3.4], [0.5, -1.4, -5]], 0.62), claw([[1.5, -0.8, -1.1], [2.6, -1.8, -2.8], [3.6, -1.3, -4.2]], 0.62)))],
  ['armR', any(ell([2.3, 2.3, 2.3], [-8.6, -1.6, 22.3]), limb([-8.8, -0.5, 24.5], [-7.6, -3, 18.3], 2.35, 1.8))],
  ['foreR', any(ell([1.6, 1.6, 1.6], [-7.6, -3, 18.3]), limb([-7.6, -3, 18.3], [-14.4, -5, 22.5], 2.35, 1.9),
    limb([-7, -2.4, 14.4], [-11, -4, 16.6], 0.6, 1.2), limb([-11, -4, 16.6], [-14.6, -5, 18.6], 1.2, 1.1), limb([-14.6, -5, 18.6], [-16.6, -5.2, 20.4], 1, 0.5))],
  ['handR', inF(HR, ell([2, 0.9, 2.1], [0, 0, 0]), ell([1.7, 0.6, 1.6], [0, 0.5, 0.1]),
    ...fingersR.flatMap((f) => [limb([f[0], -0.2, 1.6], [f[1], -0.4, f[2]], 0.6, 0.5),
      claw([[f[1], -0.4, f[2]], [(f[1] + f[3]) / 2, -1, (f[2] + f[4]) / 2 + 0.3], [f[3], -1.4, f[4]]], 0.5)]))],
  ['legL', any(limb([4, 0.6, 15.5], [12.2, -3, 10], 3.3, 2.4), ell([2.1, 2.1, 2.1], [12.2, -3, 10]), ell([2.1, 1.5, 2.2], [12.4, -4.5, 10]),
    limb([12.2, -3, 10], [15.4, -2.6, 4.6], 2.65, 2.1), limb([3.4, -2.4, 14.6], [8.8, -5, 10.6], 0.3),
    inF(FL, blob([[[2.3, 2.2, 1.3], [0, 0, 1.6]], [[1.6, 1.6, 1.4], [-0.2, 0.9, 3]]]), ell([1.8, 1.6, 0.9], [0, -0.5, 2.6]),
      ...toes([1.6, 2.1, 2.8], -1.7, -3, -4), spike([0, 1.8, 1.2], [0, 1.4, -1], 0.55)))],
  ['legR', any(limb([-1.2, 1, 15.5], [-5, -1, 10.8], 3.2, 2.3), ell([1.9, 1.9, 1.9], [-5, -1, 10.8]), ell([2, 1.5, 2.1], [-6, -2.7, 10.8]),
    limb([-5, -1, 10.8], [-3, 2.2, 8.6], 2.25, 1.8), ell([1.8, 1.8, 1.8], [-3, 2.2, 8.6]), limb([-3, 2.2, 8.6], [-5.6, 3.6, 3.6], 2, 1.6),
    inF(FR, blob([[[2.2, 2.4, 1.3], [0, 0, 1.5]], [[1.5, 1.5, 1.4], [0, 2.2, 3]]]), ell([1.7, 1.7, 0.9], [0, -0.6, 2.5]),
      ...toes([1.4, 1.8, 2], -1.8, -3.2, -4.6), spike([0, 2.6, 1.2], [0, 1.6, -1], 0.55)))],
];

function assign(c, rgb) {
  if (SMOKE.some((s) => near(rgb, s))) return c[0] < 3.5 ? 'smoke1' : 'smoke2';
  if (EYE.some((s) => near(rgb, s)) && c[2] > 29) return H.local(c)[0] > 0 ? 'eyeL' : 'eyeR';
  // the gauntlet's tall outer plates ride the forearm
  if (c[0] > 17.2 && c[2] > 15.4 && c[2] < 27.6) return 'foreL';
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
