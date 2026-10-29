// Fibrostis's rig: a small shaggy fibre-creature on stumpy legs, long hanging arms, big round eyes peering out of the
// fur, a wild crest and loose fibre wisps drifting beside it. It stands, so it takes the biped template (the plans
// list it with the floaters). Numbers are scad/fibrostis.scad's (the old model; re-rig when the sprite-matched one
// lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const FUR_DK = [0.42, 0.4, 0.46];
const EYE = [[0.86, 0.88, 0.8], [0.58, 0.62, 0.52], [0.12, 0.12, 0.14]];
const WISP = [0.88, 0.88, 0.82];

const eyeL = { side: 'L', at: [3.5, -9.4, 26.2], size: 2.7, yaw: -14, flat: 0.7 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR_DK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.5, 0, 7] },
  { name: 'legR', parent: 'root', at: [-4.5, 0, 7] },
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -0.5, 19] },
  { name: 'crest1', parent: 'head', at: [0, 0, 32] },
  { name: 'armL', parent: 'body', at: [8, -1, 20] },
  { name: 'handL', parent: 'armL', at: [10.5, -2, 10] },
  { name: 'armR', parent: 'body', at: [-8, -1, 20] },
  { name: 'handR', parent: 'armR', at: [-10.5, -2, 10] },
  { name: 'wispL', parent: 'root', at: [15.5, 1, 9] },
  { name: 'wispR', parent: 'root', at: [-15, 0, 6] },
  { name: 'wispT', parent: 'root', at: [-9, 2, 34] },
  ...face.joints,
];

// tufts stick out about 3 units past the shapes they grow on, so the tests are padded
const parts = [
  ['leg*', any(limb([4.5, 0, 7], [4.8, -0.5, 2.5], 5.5, 5), blob([[[4.4, 6, 2.6], [5, -2.6, 1.6]], [[3.6, 3, 2.3], [5, 1, 1.4]]]))],
  ['body', blob([[[11.5, 10.5, 10.5], [0, 0, 13]]])],
  ['head', any(ell([12, 11, 10.5], [0, -0.5, 26]), ell([7.5, 3.5, 6.5], [0, -7.6, 24]))],
  ['crest1', ell([10, 4, 3], [2, 0.5, 35.5])],
  ['arm*', limb([8, -1, 20], [10.5, -2, 12], 3.4, 3.4)],
  ['hand*', any(ell([3.2, 3.6, 3], [10.6, -3, 8.4]), limb([9.8, -1.8, 12], [10.5, -2, 10], 3, 3))],
];

function assign(c, rgb) {
  if (near(rgb, WISP)) return c[2] > 28 ? 'wispT' : c[0] > 0 ? 'wispL' : 'wispR';
  if (isAny(rgb, EYE)) return 'head';
  if (c[1] < -5 && c[2] > 19.5 && Math.abs(c[0]) < 8) return 'head';   // the face, sockets, snout and whiskers
  if (c[2] > 33) return 'crest1';
  return pick(c, parts);
}

// the loose fibres drift and the crest sways
const drift = (u, amp = 1, cycles = 1) => ({
  wispL: { r: [0, 6 * amp * osc(u, cycles), 8 * amp * osc(u, cycles, 0.3)], p: [0, 0, 0.6 * amp * osc(u, cycles * 2)] },
  wispR: { r: [0, -6 * amp * osc(u, cycles, 0.5), -8 * amp * osc(u, cycles, 0.7)], p: [0, 0, 0.6 * amp * osc(u, cycles * 2, 0.4)] },
  wispT: { r: [5 * amp * osc(u, cycles, 0.2), 0, 10 * amp * osc(u, cycles)] },
  crest1: { r: [4 * amp * osc(u, cycles * 2), 0, 6 * amp * osc(u, cycles, 0.2)] },
});
const add = {
  idle: (t, u) => drift(u, 1, 1),
  walk: (t, u) => drift(u, 1.5, 1),
  idle_look: (t, u) => drift(u, 1, 1),
  hurt: (t, u) => drift(u, 3, 3),
  celebrate: (t, u) => drift(u, 3, 2),
};

const base = bipedClips({ face, hipH: 7, stride: 18, armSwing: 18, add });

const clips = {
  ...base,
  // fidget: a wet-dog shake from the crest down, the fibres flung out round it
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

  // fidget: peers round, sinking down into the fur, eyes going wide, then pops back up with a blink
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
