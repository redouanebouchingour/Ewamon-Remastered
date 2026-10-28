// Zenryu's rig: a white dragon martial artist in a fighting stance (the right fist raised at the chin, the left one
// low), a shaggy mane, a thick tail curling up and three wind rings that turn around it. Numbers are scad/zenryu.scad's;
// the head is inside translate([0, -0.6, 30]) scale(1.2). Zenryu Majin reuses it (`zen({ majin: true })`).
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { fold, near } from './lib/geo.mjs';
import { subFrame } from './lib/geo.mjs';

const FUR = [0.9, 0.92, 0.96];
const WIND = [0.3, 0.85, 0.9];
const TAIL = [[0, 3.5, 12], [5, 6.5, 7], [11, 5, 4.5], [16, 2.5, 8], [17, 1.5, 14], [15.5, 1.5, 19]];
const TAIL_R = [3, 2.8, 2.4, 2, 1.6, 1.3];
export const tails = ['tail1', 'tail2', 'tail3', 'tail4'];
const RINGS = [[22, 12.5, 8], [13, 13, -7], [5, 11.5, 5]];
const SPARKS = [[-12, -1, 24], [12, -1, 22], [-11, 0, 12], [9, -3, 8], [-6, -5, 30], [6, 4, 30]];
const H = subFrame([0, -0.6, 30], [0, 0, 0], 1.2);
const DEG = Math.PI / 180;
const sin = (a) => Math.sin(a * DEG);
const cos = (a) => Math.cos(a * DEG);
const hf = (test) => (c) => test(fold(H.local(c)));
const hp = (test) => (c) => test(H.local(c));
const lock = (p, d, r) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], r, 0.3);
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function zen({ majin = false } = {}) {
  const eyeL = { side: 'L', at: [1.7, -3, 0.4], size: 1.3, yaw: -14, flat: 0.4, frame: H };
  const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });
  // the arms: [shoulder, elbow, wrist, fist] for the left (+X) and the right
  const armsL = majin ? [[7, 0, 24.5], [9.5, -1, 19.5], [10.6, -2.5, 15.5], [10.9, -3, 14.3]] : [[7, 0, 24.5], [9, -1, 19], [9.6, -3, 14.5], [9.8, -3.6, 13.4]];
  const armsR = majin ? armsL.map(([x, y, z]) => [-x, y, z]) : [[-7, 0, 24.5], [-8.5, -3, 19.5], [-5.5, -6, 25], [-4.8, -6.6, 26.2]];
  const joints = [
    { name: 'root', at: [0, 0, 0] },
    ...pair('leg*', 'root', [3.8, 0, 12]),
    { name: 'body', parent: 'root', at: [0, 0, 13] },
    { name: 'head', parent: 'body', at: [0, -0.3, 27.5] },
    { name: 'mane1', parent: 'body', at: [0, 3.5, majin ? 28 : 26.5] },
    ...[['L', armsL], ['R', armsR]].flatMap(([S, a]) => [
      { name: `arm${S}`, parent: 'body', at: a[0] },
      { name: `fore${S}`, parent: `arm${S}`, at: a[1] },
      { name: `hand${S}`, parent: `fore${S}`, at: a[2] },
    ]),
    { name: 'tail1', parent: 'body', at: TAIL[0] },
    { name: 'tail2', parent: 'tail1', at: TAIL[1] },
    { name: 'tail3', parent: 'tail2', at: TAIL[2] },
    { name: 'tail4', parent: 'tail3', at: TAIL[3] },
    ...(majin
      ? SPARKS.map((p, i) => ({ name: `spark${i + 1}`, parent: 'root', at: add3(p, [0.3, 0, 1.6]) }))
      : RINGS.map(([z, , tilt], i) => ({ name: `ring${i + 1}`, parent: 'root', at: [0, 0, z], rot: [tilt, 4, 0] }))),
    ...face.joints,
  ];

  // mane locks: [p, d, r] per the scad loops; the top and back ones ride the head, the low back ones are mane1
  const headLocks = [];
  const backLocks = [];
  if (majin) {
    for (let k = 0; k <= 10; k++) { const a = -150 + k * 30; headLocks.push([[3 * sin(a), 1 + 1.5 * Math.abs(cos(a)), 32.5 + 2 * cos(a)], [6 * sin(a), 3.5, 6 + 4 * cos(a)], 2.2]); }
    for (let k = 0; k <= 8; k++) { const a = -80 + k * 20; headLocks.push([[3 * sin(a), 3, 33], [6.5 * sin(a), 7, 3 + (k % 3) * 2], 2.6]); }
    for (let k = 0; k <= 9; k++) { const a = -90 + k * 20; backLocks.push([[4.5 * sin(a), 3.5, 28], [6 * sin(a), 5, -12 + (k % 2) * 3], 2.8]); }
  } else {
    for (let k = 0; k <= 11; k++) { const a = -165 + k * 30; headLocks.push([[3 * sin(a), 0.8 + 1.5 * Math.abs(cos(a)), 31.5 + 2.5 * cos(a)], [5.5 * sin(a), 3.5, 4 * cos(a) + 2], 2]); }
    for (let k = 0; k <= 8; k++) { const a = -80 + k * 20; headLocks.push([[3 * sin(a), 2.5, 32], [6 * sin(a), 6, -1 + (k % 3)], 2.3]); }
    for (let k = 0; k <= 7; k++) { const a = -70 + k * 20; backLocks.push([[4 * sin(a), 3.5, 26], [5 * sin(a), 4, -7], 2.4]); }
  }
  for (let i = 0; i <= 2; i++) headLocks.push(...[1, -1].map((s) => [[3.2 * s, -2 + i, 30.5 - i * 1.2], [3.2 * s, -1, -1.5 - i * 0.5], 1.5]));
  const parts = [
    ['body', any(blob([[[6.4, 4.4, 5], [0, 0, 22]], [[4.6, 3.6, 3.6], [0, 0, 16]]]), mx(ell([2.8, 1.3, 2.2], [2.4, -3.4, 22.5])),
      ell([5.2, 4.2, 1], [0, 0, 15]), ell([1.2, 0.8, 1], [-0.8, -4.3, 15]), limb([-0.8, -4.5, 14.5], [-1.6, -4.8, 10.5], 0.6, 0.45),
      limb([-0.4, -4.5, 14.5], [0.4, -4.8, 11], 0.6, 0.45), blob([[[4.8, 3.8, 1.8], [0, 0, 13]], [[4.4, 3.6, 1.6], [0, 0, 12]]]),
      ...[0, 1, 2].map((i) => mx(lock([4, 0.5 + i, 28 - i * 1.5], [4.5, -1 + i, -2], 1.8))))],
    ['head', any(hp(blob([[[3.6, 3.4, 3.4], [0, 0, 0]], [[2.2, 2.4, 1.6], [0, -3.8, -1]]])), hp(ell([1.8, 1, 1], [0, -5.4, -0.6])),
      hf(ell([1.5, 0.45, 1.35], [1.65, -2.6, 0.45])), hf(limb([0.45, -3.5, 1.05], [2.9, -2.2, 2.1], 0.6)), hf(spike([0.9, -5.4, -1.4], [0, -0.1, -0.9], 0.25)),
      hp(ell([3.6, 3.4, 0.9], [0, -0.6, 2.4])), ...[-1.2, 0, 1.2].map((x) => hp(spike([x, -3, 3], [x * 0.3, 0.4, 2.2 - Math.abs(x) * 0.4], 0.55))),
      hf(limb([2.6, -1, 2.6], [3.6, 0.5, 4.6], 0.6, 0.45)), hf(limb([3.6, 0.5, 4.6], [4, 2, 6.2], 0.45, 0.15)),
      ...headLocks.map(([p, d, r]) => lock(p, d, r)))],
    ['mane1', any(...backLocks.map(([p, d, r]) => lock(p, d, r)))],
    ...[['L', armsL], ['R', armsR]].flatMap(([S, a]) => [
      [`arm${S}`, any(limb(a[0], a[1], 2.3, 2), ell([3, 3, 2.8], [6.6 * (S === 'L' ? 1 : -1), 0, 25]))],
      [`fore${S}`, limb(a[1], a[2], 2, 1.8)],
      [`hand${S}`, ell([2, 2, 2], a[3])],
    ]),
    ['leg*', any(blob([[[3.6, 3.6, 3.6], [3.8, 0, 12]], [[3.2, 3.2, 2.6], [5, -1, 6]]]), ell([2.6, 2.6, 0.8], [5, -1, 4.2]), ell([2.1, 2.1, 0.8], [5.2, -0.8, 3.2]),
      blob([[[2.4, 3.2, 1.4], [5.3, -1.6, 1.4]], [[2, 2, 1.4], [5.3, 0.6, 1.5]]]), ell([1.6, 1.4, 0.8], [5.3, -5, 0.9]))],
    ...chain(tails, TAIL, TAIL_R.map((r) => r * 1.25)),
  ];
  const assign = (c, rgb) => {
    if (near(rgb, WIND)) {
      if (majin) { let b = 0; SPARKS.forEach((p, i) => { if (Math.hypot(...add3(c, p.map((v) => -v))) < Math.hypot(...add3(c, SPARKS[b].map((v) => -v)))) b = i; }); return `spark${b + 1}`; }
      let b = 0; RINGS.forEach(([z], i) => { if (Math.abs(c[2] - z) < Math.abs(c[2] - RINGS[b][0])) b = i; });
      return `ring${b + 1}`;
    }
    return pick(c, parts);
  };
  return { joints, parts, assign, face };
}

// the wind rings turn (whole turns per loop), the sparks flicker on counted beats
const H32 = (n) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x & 0xffff) / 0xffff; };
export const rings = (u, turns = 1, k = 1) => ({
  ring1: { r: [0, 0, 360 * turns * u * k] }, ring2: { r: [0, 0, -360 * turns * u * k] }, ring3: { r: [0, 0, 360 * turns * u * k + 40 * osc(u, 1)] },
});
export const sparks = (u, steps, amp = 1) => Object.fromEntries(SPARKS.map((_, i) => {
  const b = Math.floor(u * steps) % steps;
  return [`spark${i + 1}`, { s: Math.max(1e-4, (0.35 + 0.9 * H32(b * 7 + i * 31)) * amp), r: [0, 360 * H32(b * 3 + i), 0] }];
}));

export function clipsFor({ face, majin = false, punch }) {
  const fx = majin
    ? { idle: (t, u) => sparks(u, 24), walk: (t, u) => sparks(u, 6), windup: (t, u) => sparks(u, 4, 1.4), lunge: (t, u) => sparks(u, 5, 1.6), hurt: (t, u) => sparks(u, 4, 0.6),
      recoil: (t, u) => sparks(u, 4, 0.8), faint: (t, u) => sparks(u, 8, 1 - smooth(u / 0.7)), celebrate: (t, u) => sparks(u, 8, 1.5), enter: (t, u) => sparks(u, 6, smooth(u)),
      exit: (t, u) => sparks(u, 4), idle_look: (t, u) => sparks(u, 12) }
    : { idle: (t, u) => rings(u, 1), walk: (t, u) => rings(u, 1), windup: (t, u) => rings(u, 0.25), lunge: (t, u) => rings(u, 0.5), hurt: (t, u) => rings(u, 0.2),
      recoil: (t, u) => rings(u, 0.2), faint: (t, u) => rings(smooth(u), 0.3), celebrate: (t, u) => rings(u, 1), enter: (t, u) => rings(smooth(u), 1), exit: (t, u) => rings(u, 0.5), idle_look: (t, u) => rings(u, 1) };
  const base = bipedClips({
    face, tail: tails, hipH: 12, stride: 18, armSwing: 10, hopScale: 0.6, cape: ['mane1'],
    punch: punch ?? { arm: [-70, 0, 0], fore: [100, 0, 0] },
    cheer: { arm: [-10, -115, 0], fore: [0, -20, 0] },
    add: fx,
  });
  const fxOf = (name, u) => fx[name]?.(0, u) ?? {};
  return {
    ...base,

    // fidget: the crane: one knee rises, the arms open wide like wings, it balances, then sets the foot down
    idle_crane: {
      seconds: 3,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.9, 0]]);
        const wob = Math.sin(TAU * 2 * u) * win(u, 0.25, 0.7, 0.05);
        return merge({
          root: { r: [0, 0, 1.5 * wob] },
          legL: { r: [-55 * on, 0, 0] },
          body: { r: [-2 * on, -3 * on + 1.5 * wob, 0] },
          head: { r: [-4 * on, 0, 6 * on] },
          ...face.pose('open', 0.45 * on + blinks(u, [[0.5, 0.55]])),
          ...both('arm', { r: [-20 * on, -60 * on, 0] }),
          ...both('fore', { r: [-30 * on, 0, 0] }),
          ...both('hand', { r: [0, 0, 0] }),
          tail1: { r: [-6 * on, 0, 4 * wob] },
        }, fxOf('idle', u));
      },
    },

    // fidget: a slow meditative breath, eyes shut, chest swelling; the wind (or the sparks) answers it
    idle_breath: {
      seconds: 3.2,
      pose: (t, u) => {
        const b = Math.sin(Math.PI * u) ** 2;
        return merge({
          body: { p: [0, 0, 0.3 * b], r: [-4 * b, 0, 0], s: [1 + 0.04 * b, 1 + 0.04 * b, 1] },
          head: { r: [-8 * b, 0, 0] },
          ...face.pose(b > 0.25 ? 'shut' : 'open'),
          ...both('arm', { r: [0, -10 * b, 0] }),
          ...both('fore', { r: [-10 * b, 0, 0] }),
          mane1: { r: [-6 * b, 0, 0] },
        }, majin ? sparks(u, 16, 0.6 + 0.9 * b) : rings(u, 2));
      },
    },
  };
}

const Z = zen();
export default rigDef({ joints: Z.joints, assign: Z.assign, extras: Z.face.extras, clips: clipsFor({ face: Z.face }) });
