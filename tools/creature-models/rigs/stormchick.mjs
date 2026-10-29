// Stormchick's rig: one spiky ball of down (the body is the head), stubby feet, a fan of lightning-bolt tail
// feathers and huge startled eyes (white discs, not lib.scad's eye(): the lids are fitted with eyeKit's squash).
// Numbers are scad/stormchick.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { near, side } from './lib/geo.mjs';

const DOWN = [0.98, 0.82, 0.3];
const BEAK = [0.95, 0.5, 0.2];
const BOLT = [1, 0.86, 0.25];

const eyeL = { side: 'L', at: [4.4, -9.4, 17.4], size: 3.0, yaw: -16, squash: 0.55 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: DOWN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4, -3, 4] },
  { name: 'legR', parent: 'root', at: [-4, -3, 4] },
  { name: 'body', parent: 'root', at: [0, -1, 3.5] },
  { name: 'tail1', parent: 'body', at: [8, 4, 15] },
  ...face.joints,
];

function assign(c, rgb) {
  if (near(rgb, BEAK) && c[2] < 4.5) return `leg${side(c)}`;
  // the bolt feathers stand out of the back on the +X side
  if (near(rgb, BOLT, 0.03) && c[0] > 7 && c[1] > -2 && c[2] > 9) return 'tail1';
  return 'body';
}

// the static crackle: the whole fluff trembles in short bursts
const crackle = (u, amp, at) => ({ body: { s: 1 + amp * Math.abs(Math.sin(TAU * 20 * u)) * win(u, at[0], at[1], 0.02) } });

const clips = {
  ...birdClips({ face, tail: ['tail1'], add: { idle: (t, u) => crackle(u, 0.02, [0.6, 0.7]) } }),

  // fidget: static builds up, the fluff bristles and shivers, then a zap that makes it jump and blink
  idle_charge: {
    seconds: 2.2,
    pose: (t, u) => {
      const build = K(u, [[0, 0], [0.55, 1], [0.6, 0]]);
      const zap = win(u, 0.58, 0.75, 0.03);
      return merge({
        root: { p: [0, 0, 2.5 * zap] },
        body: { s: 1 + 0.05 * build + 0.03 * build * Math.sin(TAU * 30 * u), r: [0, 0, 4 * osc(u, 2)] },
        ...face.pose(zap > 0.3 ? 'squeeze' : 'open'),
        tail1: { r: [0, -20 * zap + 4 * build * Math.sin(TAU * 24 * u), 0] },
      });
    },
  },
};
delete clips.idle_preen;   // no wings to preen under

export default rigDef({ joints, assign, extras: face.extras, clips });
