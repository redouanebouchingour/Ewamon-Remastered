// Nerohat's rig: a round charcoal ghost-pot (the body is the head), a little blue cowboy hat, thin wavy arms reaching
// down to big spidery hands resting on the ground. Numbers are scad/nerohat.scad's (the old model, rigged before its
// sprite-accuracy rebuild).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { isAny, near } from './lib/geo.mjs';

const BODY = [0.24, 0.21, 0.22];
const HAT = [[0.18, 0.28, 0.55], [0.28, 0.4, 0.7], [0.1, 0.15, 0.32]];
const HAND = [0.3, 0.3, 0.34];

const eyeL = { side: 'L', at: [3.1, -7.9, 10.6], size: 1.3, yaw: -20, flat: 0.1 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: BODY, lid: [1.15, 1.2, 1.0] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 2] },
  { name: 'hat', parent: 'body', at: [0, 0.5, 18.6] },
  { name: 'armL', parent: 'body', at: [8, -1, 8] },
  { name: 'handL', parent: 'armL', at: [16, -3, 3.5] },
  { name: 'armR', parent: 'body', at: [-8, -1, 8] },
  { name: 'handR', parent: 'armR', at: [-16, -3, 3.5] },
  ...face.joints,
];

function assign(c, rgb) {
  if (isAny(rgb, HAT, 0.03) && c[2] > 17.5) return 'hat';
  if (near(rgb, HAND, 0.03)) {
    const S = c[0] >= 0 ? 'L' : 'R';
    return Math.abs(c[0]) > 15 || c[2] < 3 ? `hand${S}` : `arm${S}`;
  }
  return 'body';
}

// the hat jiggles on top; the long fingers drum on the ground
const hat = (amp, cycles, u) => ({ hat: { r: [amp * osc(u, cycles, 0.2), 0.6 * amp * osc(u, cycles, 0.45), 0] } });
const drum = (u, cycles, amp = 1) => ({
  handL: { r: [0, -6 * amp * Math.max(0, osc(u, cycles)), 0] },
  handR: { r: [0, 6 * amp * Math.max(0, osc(u, cycles, 0.5)), 0] },
});

const base = floaterClips({
  face, bob: 0.35,
  add: {
    idle: (t, u) => merge(hat(2, 2, u), drum(u, 4, 0.6)),
    walk: (t, u) => hat(4, 2, u),
    idle_cackle: (t, u) => hat(6, 8, u),
    lunge: (t, u) => ({ hat: { r: [-10 * win(u, 0.3, 0.8, 0.1), 0, 0] } }),
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.3]]); return { hat: { p: [0, 0, 2 * k], r: [-16 * k, 12 * k, 0] } }; },
    faint: (t, u) => { const d = win(u, 0.2, 1, 0.3); return { hat: { r: [18 * d, -14 * d, 0], p: [0, -0.5 * d, -0.4 * d] } }; },
    celebrate: (t, u) => hat(8, 2, u),
  },
});
delete base.idle_spin;   // no head to spin; the hat does the tricks instead

const clips = {
  ...base,

  // fidget: lifts its hat clean off, gives it a twirl, plonks it back with a wink
  idle_tiphat: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.15, 1], [0.7, 1], [0.85, 0]]);
      const spin = K(u, [[0.2, 0], [0.62, 360]]);
      const wink = win(u, 0.7, 0.86, 0.04);
      return {
        ...face.pose('open'),
        lidL: { s: wink < 0.02 ? 1e-4 : [1, 1, wink] },
        body: { r: [0, 0, 6 * up] },
        hat: { p: [0, 0, 3.5 * up], r: [0, 0, spin] },
      };
    },
  },

  // fidget: drums its long fingers on the ground, impatient, eyes half shut
  idle_drum: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.9, 0.08);
      return merge({ ...face.pose('open', 0.4 * on), body: { r: [0, 0, 3 * osc(u, 2) * on] } }, drum(u, 8, 1.6 * on), hat(1.5, 4, u));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
