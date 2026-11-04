// Fibrostis's rig: a shaggy grey fibre-creature, head and body one pear of hanging strands, short furry legs, hairy
// arms hanging at its sides, two calm round eyes in the pale face fur and wisps of smoke curling round it. It stands,
// so it takes the biped template. Numbers are scad/fibrostis.scad's (the sprite-matched model, 2026-11-04): every
// strand group there has its own exact shades, so the cut is by colour, then by height and side.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { bipedClips } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capsule, isAny, near } from './lib/geo.mjs';

const SH_HEAD = [[0.45, 0.42, 0.43], [0.55, 0.53, 0.52], [0.64, 0.62, 0.6], [0.72, 0.71, 0.68], [0.8, 0.8, 0.76]];
const SH_BODY = [[0.465, 0.435, 0.445], [0.565, 0.545, 0.535], [0.655, 0.635, 0.615], [0.735, 0.725, 0.695], [0.815, 0.815, 0.775]];
const SH_ARM = [[0.48, 0.45, 0.46], [0.58, 0.56, 0.55], [0.67, 0.65, 0.63], [0.75, 0.74, 0.71], [0.83, 0.83, 0.79]];
const SH_LEG = [[0.43, 0.405, 0.415], [0.535, 0.515, 0.505], [0.625, 0.605, 0.585], [0.705, 0.695, 0.665], [0.785, 0.785, 0.745]];
const CORE = [0.52, 0.49, 0.5];
const COREA = [0.54, 0.51, 0.52];
const CORELG = [0.47, 0.44, 0.45];
const FACE = [0.78, 0.78, 0.73];
const EYE = [[0.1, 0.08, 0.1], [0.8, 0.82, 0.78], [0.66, 0.66, 0.7], [0.17, 0.15, 0.18]];
const SMOKE = [0.87, 0.87, 0.83];
const TOL = 0.0065;   // the groups' shades sit 0.015 apart
const inSet = (rgb, set) => isAny(rgb, set, TOL);

const eyeL = { side: 'L', at: [3.31, -9.3, 27.04], size: 2.2, yaw: 20.3, flat: 0.42 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

const SHO = [9.4, -0.5, 19.5];
const HAND = [12.4, -1.2, 9.5];
const NECK = 21.5;   // where the head's strands and the pear's core hand over to the body

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [5.6, 0.5, 8.5] },
  { name: 'legR', parent: 'root', at: [-5.6, 0.5, 8.5] },
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -1, NECK] },
  { name: 'armL', parent: 'body', at: SHO },
  { name: 'handL', parent: 'armL', at: HAND },
  { name: 'armR', parent: 'body', at: [-SHO[0], SHO[1], SHO[2]] },
  { name: 'handR', parent: 'armR', at: [-HAND[0], HAND[1], HAND[2]] },
  // the smoke: the S-curl behind the near (+X) side, the C-curl in front of the far side, the curls off the crown
  { name: 'wispL', parent: 'root', at: [10.6, 9.6, 15] },
  { name: 'wispR', parent: 'root', at: [-13.5, -6.6, 16] },
  { name: 'wispT', parent: 'root', at: [3.6, 3.8, 35] },
  ...face.joints,
];

// arm or hand: how far down the shoulder-to-hand capsule the triangle sits
const armPart = (c) => {
  const s = c[0] >= 0 ? 1 : -1;
  const { t } = capsule([c[0] * s, c[1], c[2]], SHO, HAND, 2.7, 2.5);
  return `${t > 0.8 ? 'hand' : 'arm'}${s > 0 ? 'L' : 'R'}`;
};

function assign(c, rgb) {
  if (near(rgb, SMOKE, TOL)) return c[2] > 29 ? 'wispT' : c[0] > 0 ? 'wispL' : 'wispR';
  if (inSet(rgb, EYE) || near(rgb, FACE, TOL)) return 'head';
  if (inSet(rgb, SH_LEG) || near(rgb, CORELG, TOL)) return c[0] >= 0 ? 'legL' : 'legR';
  if (inSet(rgb, SH_ARM) || near(rgb, COREA, TOL)) return armPart(c);
  if (inSet(rgb, SH_BODY)) return 'body';
  // the head's strands (the beard hangs over the chest: below the neck it rides with the body) and the pear's core
  return c[2] > NECK ? 'head' : 'body';
}

// the smoke drifts and curls
const drift = (u, amp = 1, cycles = 1) => ({
  wispL: { r: [0, 6 * amp * osc(u, cycles), 8 * amp * osc(u, cycles, 0.3)], p: [0, 0, 0.6 * amp * osc(u, cycles * 2)] },
  wispR: { r: [0, -6 * amp * osc(u, cycles, 0.5), -8 * amp * osc(u, cycles, 0.7)], p: [0, 0, 0.6 * amp * osc(u, cycles * 2, 0.4)] },
  wispT: { r: [5 * amp * osc(u, cycles, 0.2), 0, 10 * amp * osc(u, cycles)] },
});
const add = {
  idle: (t, u) => drift(u, 1, 1),
  walk: (t, u) => drift(u, 1.5, 1),
  idle_look: (t, u) => drift(u, 1, 1),
  hurt: (t, u) => drift(u, 3, 3),
  celebrate: (t, u) => drift(u, 3, 2),
};

const base = bipedClips({ face, hipH: 8.5, stride: 18, armSwing: 18, add, droop: 0.6 });

const clips = {
  ...base,
  // fidget: a wet-dog shake from the head down, the smoke flung out round it
  idle_shake: {
    seconds: 1.6,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.8, 0.06);
      const sh = Math.sin(TAU * 6 * u) * on;
      return merge({
        body: { r: [0, 4 * sh, 10 * sh] },
        head: { r: [0, 6 * sh, 16 * sh] },
        armL: { r: [0, -20 * on + 10 * sh, 0] },
        armR: { r: [0, 20 * on + 10 * sh, 0] },
        ...face.pose(on > 0.3 ? 'squeeze' : 'open'),
      }, drift(u, 1 + 3 * on, 4));
    },
  },

  // fidget: peers round, sinking down into the fur, then pops back up with a blink
  idle_peek: {
    seconds: 2.6,
    pose: (t, u) => {
      const hide = K(u, [[0, 0], [0.18, 1], [0.66, 1], [0.8, 0]]);
      const look = K(u, [[0.2, 0], [0.32, 18], [0.48, 18], [0.58, -14], [0.68, 0]]);
      return merge({
        body: { s: [1 + 0.04 * hide, 1 + 0.04 * hide, 1 - 0.06 * hide] },
        head: { r: [-6 * hide, 0, look], p: [0, 0, -1.2 * hide] },
        ...face.pose('open', blinks(u, [[0.82, 0.88]])),
      }, drift(u, 0.6, 1));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
