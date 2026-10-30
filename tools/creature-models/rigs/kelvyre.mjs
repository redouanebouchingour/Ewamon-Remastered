// Kelvyre's rig: a lean biped split down the middle, fire on its right (-X), ice on its left (+X). The fire arm is
// raised with a flame floating over the open hand, the ice arm hangs; a long ice tail with a burning tip curls out to
// its left. The flames get joints of their own so they flicker (the hand flame, the crown on the head, the tail tip);
// the shoulder and elbow flames ride their arm. Numbers are scad/kelvyre.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { bipedClips } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, closest, ellD, isAny } from './lib/geo.mjs';

const FIRE = [0.50, 0.19, 0.16];
const FIRE_DK = [0.36, 0.15, 0.14];
const FLAME = [[0.96, 0.49, 0.05], [0.98, 0.75, 0.26]];
const ICE = [0.42, 0.70, 0.91];
const ICE_HI = [0.70, 0.87, 0.96];
const RING = [[0.42, 0.44, 0.50], [0.79, 0.26, 0.07]];

const hipF = [-2.8, 0.2, 15.2];
const kneeF = [-7.4, -2.0, 10.0];
const ankleF = [-8.0, 1.2, 4.2];
const toeF = [-11.2, -2.8, 1.2];
const hipI = [2.8, 0.2, 15.2];
const kneeI = [4.6, -2.6, 9.2];
const ankleI = [3.8, 0.8, 4.0];
const toeI = [2.8, -3.6, 1.2];
const shF = [-5.4, 0.2, 25.2];
const elF = [-12.2, -1.0, 20.0];
const haF = [-14.4, -3.0, 25.4];
const shI = [5.4, 0.2, 25.0];
const elI = [6.6, 0.4, 18.2];
const haI = [5.6, -2.0, 12.8];
const TAIL = [[0.8, 3.4, 13.2], [2.6, 5.2, 8.6], [5.0, 5.4, 4.6], [8.2, 4.2, 3.0], [11.6, 2.2, 4.0], [13.9, 0.4, 7.0], [14.8, -0.8, 10.4]];
const TAILR = [1.9, 1.75, 1.6, 1.5, 1.4, 1.3, 1.1];
const tails = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail6'];
const add3 = (a, b) => a.map((v, i) => v + b[i]);
const HAND_FLAME = add3(haF, [-0.2, 0, 2.6]);

const eyeL = { side: 'L', at: [1.7, -3.45, 33.0], size: 1.05, yaw: 18 };
const face0 = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: ICE });
// each eye's lid in its own half's skin
const face = { ...face0, extras: face0.extras.map((x) => (x.joint === 'lidR' ? { ...x, color: FIRE } : x)) };

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: hipI },
  { name: 'legR', parent: 'root', at: hipF },
  { name: 'body', parent: 'root', at: [0, 0.2, 15.5] },
  { name: 'head', parent: 'body', at: [0, -0.2, 28.8] },
  { name: 'crown', parent: 'head', at: [-3.2, 0.4, 34.4] },
  { name: 'armL', parent: 'body', at: shI },
  { name: 'foreL', parent: 'armL', at: elI },
  { name: 'handL', parent: 'foreL', at: haI },
  { name: 'armR', parent: 'body', at: shF },
  { name: 'foreR', parent: 'armR', at: elF },
  { name: 'handR', parent: 'foreR', at: haF },
  { name: 'flameH', parent: 'handR', at: HAND_FLAME },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  ...tails.slice(1).map((n, i) => ({ name: n, parent: tails[i], at: TAIL[i + 1] })),
  { name: 'flameT', parent: 'tail6', at: TAIL[6] },
  ...face.joints,
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function assign(c, rgb) {
  // flames and the molten cracks share one orange: a triangle on a skin surface (a crack, laid 0.16 proud) belongs to
  // that part, the rest to the flame whose root is nearest
  if (isAny(rgb, FLAME)) {
    const skin = bodyPart(c, 1.2);
    if (skin !== null) return skin;
    return closest([
      ['flameH', dist(c, add3(HAND_FLAME, [0, 0, 2])) / 3.2],
      ['crown', dist(c, [-3.6, 0.5, 36.5]) / 3.2],
      ['armR', dist(c, add3(shF, [-1.6, 0.2, 2.6])) / 2.6],
      ['foreR', Math.min(dist(c, add3(elF, [-0.8, 0.2, -1.6])), dist(c, [-14.2, -1.8, 21.6])) / 2.4],
      ['flameT', dist(c, add3(TAIL[6], [0, 0, 3.5])) / 4],
    ]);
  }
  // the neck ring and its drips and icicles ride the body
  if (isAny(rgb, RING) && c[2] > 24.5 && c[2] < 30 && Math.hypot(c[0], c[1]) < 4.5) return 'body';
  // ice spikes: the crest on the head, the shoulder and forearm spikes, the knee spike, the tail ridge
  if (isAny(rgb, [ICE_HI])) {
    if (c[2] > 32) return 'head';
    const t = chainHit(c, TAIL, TAILR);
    return closest([
      ['armL', Math.min(dist(c, add3(shI, [1.6, 0.4, 2.8])) / 3, capD(c, shI, elI, 2.4, 2.2))],
      ['foreL', capD(c, elI, haI, 2.6, 2.4)],
      ['legL', dist(c, add3(kneeI, [1.0, 1.6, 0.6])) / 1.8],
      [`tail${Math.min(6, t.i + 1)}`, t.d * 0.9],
    ]);
  }
  if (isAny(rgb, [FIRE_DK]) && c[2] > 34) return 'head';   // the fire horn
  return bodyPart(c);
}

// the part whose primitive c lies on (normalised distance), null beyond `max`
function bodyPart(c, max = Infinity) {
  const t = chainHit(c, TAIL, TAILR);
  return closest([
    ['head', Math.min(ellD(c, [3.9, 3.8, 3.8], [0, -0.2, 32.8]), ellD(c, [2.3, 2.5, 2.0], [0, -3.1, 31.3]),
      ellD(c, [1.6, 1.8, 1.6], [2.8, -1.7, 31.4]), ellD(c, [1.6, 1.8, 1.6], [-2.8, -1.7, 31.4]), capD(c, [0, 0, 29.2], [0, -0.4, 29.6], 1.8, 1.8))],
    ['body', Math.min(capD(c, [0, 0.2, 15.6], [0, 0.1, 18.4], 4.0, 3.2), capD(c, [0, 0.1, 18.4], [0, -0.3, 23.2], 3.2, 4.8),
      ellD(c, [6.0, 3.0, 1.9], [0, 0.2, 25.4]), capD(c, [0, 0.3, 25.5], [0, 0, 28.6], 1.9, 1.8))],
    ['armL', Math.min(ellD(c, [2, 2, 2], shI), capD(c, shI, elI, 1.75, 1.45))],
    ['foreL', capD(c, elI, haI, 1.45, 1.2)],
    ['handL', Math.min(ellD(c, [1.35, 1.15, 1.45], haI), capD(c, add3(haI, [0, -0.3, -0.6]), add3(haI, [0, -0.6, -2.8]), 1.3, 1.0))],
    ['armR', Math.min(ellD(c, [2, 2, 2], shF), capD(c, shF, elF, 2.0, 1.75))],
    ['foreR', capD(c, elF, haF, 1.75, 1.35)],
    ['handR', Math.min(ellD(c, [1.6, 1.25, 1.45], haF), capD(c, add3(haF, [0, -0.2, 0.6]), add3(haF, [-0.3, -0.5, 2.6]), 1.6, 1.0))],
    ['legL', Math.min(capD(c, hipI, kneeI, 2.4, 1.8), capD(c, kneeI, ankleI, 1.7, 1.25), capD(c, ankleI, toeI, 1.6, 1.4))],
    ['legR', Math.min(capD(c, hipF, kneeF, 2.8, 2.1), capD(c, kneeF, ankleF, 1.9, 1.35), capD(c, ankleF, toeF, 1.6, 1.4))],
    [`tail${Math.min(6, t.i + 1)}`, t.d],
  ], max);
}

// the flames flicker: a quick uneven stretch and sway, `n` whole beats per clip so loops close
const flick = (u, n, k = 1) => {
  const f = (ph) => 0.5 * osc(u, n, ph) + 0.5 * osc(u, n * 2, ph + 0.3);
  return {
    flameH: { s: [1 - 0.06 * k * f(0), 1, 1 + 0.16 * k * f(0.1)], r: [0, 7 * k * f(0.4), 0] },
    crown: { s: [1, 1, 1 + 0.12 * k * f(0.55)], r: [0, 6 * k * f(0.2), 0] },
    flameT: { s: [1 - 0.05 * k * f(0.7), 1, 1 + 0.14 * k * f(0.8)], r: [0, 8 * k * f(0.9), 0] },
  };
};

const base = bipedClips({
  face, tail: tails, hipH: 14, stride: 18, armSwing: 10,
  // it thrusts the fire palm at the foe: the raised arm swings forward and the forearm straightens
  punch: { arm: [-55, 0, 20], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => flick(u, 8),
    walk: (t, u) => flick(u, 4),
    idle_look: (t, u) => flick(u, 6),
    windup: (t, u) => merge(flick(u, 2, 1.5), { flameH: { s: 1 + 0.45 * smooth(u / 0.8) } }),
    lunge: (t, u) => merge(flick(u, 2, 1.5), { flameH: { s: 1 + 0.5 * K(u, [[0, 1], [0.4, 1.2], [0.7, 0.2], [1, 0]]) } }),
    hurt: (t, u) => flick(u, 3, 2),
    recoil: (t, u) => flick(u, 2, 1.5),
    celebrate: (t, u) => merge(flick(u, 4, 1.6), { flameH: { s: 1 + 0.35 * Math.abs(Math.sin(TAU * u)) }, flameT: { s: 1 + 0.25 * Math.abs(Math.sin(TAU * u)) } }),
    faint: (t, u) => ({ flameH: { s: 1 - 0.85 * smooth(u) }, crown: { s: [1, 1, 1 - 0.7 * smooth(u)] }, flameT: { s: 1 - 0.8 * smooth(u) } }),
    enter: (t, u) => merge(flick(u, 2), { flameH: { s: smooth(u / 0.7) } }),
    exit: (t, u) => flick(u, 2),
  },
});

const clips = {
  ...base,

  // fidget: it studies the flame in its palm, which swells and spins while frost creeps along the ice arm (a shiver)
  idle_flare: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.86, 0.12);
      const swell = K(u, [[0, 0], [0.3, 0.2], [0.5, 1], [0.7, 0.8], [0.9, 0], [1, 0]]);
      return merge({
        head: { r: [-6 * on, 0, -16 * on] },
        armR: { r: [-10 * on, 0, 8 * on] },
        foreR: { r: [-6 * on, 0, 0] },
        flameH: { s: 1 + 0.6 * swell, r: [0, 0, 360 * smooth((u - 0.3) / 0.5)] },
        foreL: { r: [0, 2.5 * Math.sin(TAU * 9 * u) * swell, 0] },
        ...face.pose('open', blinks(u, [[0.9, 0.95]])),
        body: { r: [0, 0, -4 * on] },
      }, flick(u, 6));
    },
  },

  // fidget: the two halves disagree: the fire hand clenches and the ice hand flexes, it shakes them both out
  idle_shake: {
    seconds: 2.0,
    pose: (t, u) => {
      const s1 = win(u, 0.1, 0.45, 0.06);
      const s2 = win(u, 0.5, 0.85, 0.06);
      return merge({
        handR: { s: [1, 1, 1 - 0.18 * s1] },
        handL: { s: [1, 1, 1 - 0.18 * s1] },
        foreR: { r: [0, 0, 6 * Math.sin(TAU * 8 * u) * s2] },
        foreL: { r: [0, 0, -6 * Math.sin(TAU * 8 * u) * s2] },
        head: { r: [4 * s1, 0, 8 * Math.sin(TAU * 2 * u) * s2] },
        ...face.pose('open', 0.4 * s1),
      }, flick(u, 4, 1 + s1));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
