// Thundrix's rig: a storm eagle with its wings flung up in a V (an inner and an outer joint each), a swept crest on
// a golden head, a fanned tail and talons gripping lightning. The torso and head sit inside the scad's
// `translate([0, 0, 18]) scale([1.25, 1.25, 1.15]) translate([0, 0, -18])` block (`inner`); the eyes are not
// lib.scad's eye(), so the lids are fitted to the glowing slits. Numbers are scad/thundrix.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capsule, fold, isAny, near, side, subFrame } from './lib/geo.mjs';

const GOLD = [0.9, 0.7, 0.3];
const GOLD_DK = [0.72, 0.5, 0.2];
const GOLD_HI = [0.98, 0.84, 0.45];
const TALON = [0.95, 0.68, 0.25];
const BOLT = [0.6, 0.85, 1];
const BLUE = [[0.24, 0.47, 0.8], [0.4, 0.62, 0.92]];
const BOLT_Y = [1, 0.86, 0.35];

const inner = subFrame([0, 0, 18 - 18 * 1.15], [0, 0, 0], [1.25, 1.25, 1.15]);
const ROOT = [5, 1.5, 25];
const TIP = [27, 3, 43];
const MID = ROOT.map((v, i) => (v + TIP[i]) / 2);

const eyeL = { side: 'L', at: [2.5, -4.6, 32], size: 1.0, yaw: -25, squash: 0.5, frame: inner };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GOLD });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: inner.world([3, -0.5, 13]) },
  { name: 'legR', parent: 'root', at: inner.world([-3, -0.5, 13]) },
  { name: 'body', parent: 'root', at: [0, 0.5, 9] },
  { name: 'head', parent: 'body', at: inner.world([0, 0.5, 28]) },
  { name: 'tail1', parent: 'body', at: [0, 4, 13] },
  { name: 'wingL', parent: 'body', at: ROOT },
  { name: 'wingR', parent: 'body', at: [-ROOT[0], ROOT[1], ROOT[2]] },
  { name: 'wing2L', parent: 'wingL', at: MID },
  { name: 'wing2R', parent: 'wingR', at: [-MID[0], MID[1], MID[2]] },
  ...face.joints,
];

const torso = [[[6.5, 6, 8], [0, 1, 22]], [[5, 5, 6], [0, 1.5, 15]]];

function assign(c, rgb) {
  const S = side(c);
  const q = inner.local(c);
  const f = fold(c);
  if (near(rgb, TALON) || near(rgb, GOLD_HI, 0.03) && q[2] < 14 || (isAny(rgb, [BOLT, BOLT_Y], 0.04) && c[2] < 6 && Math.abs(c[0]) < 7)) return `leg${S}`;
  if (isAny(rgb, [BOLT, BOLT_Y], 0.04)) return 'body';                       // the floating sparks
  if (q[2] > 28.3 && Math.abs(q[0]) < 6) return 'head';
  if (isAny(rgb, [GOLD, GOLD_DK]) && c[1] > 2.5 && c[2] < 12.5 && Math.abs(c[0]) < 4) return 'tail1';
  const flight = isAny(rgb, BLUE, 0.03) && f[0] > 3;   // the blue flight feathers are all wing, even where they hang by the body
  if (!flight && blobD(q, torso) < 1.12 && f[0] < 7.5) return 'body';
  if (flight || (f[0] > 4 && c[2] > 6)) {
    const h = capsule(f, ROOT, TIP, 1);
    return f[0] > 16 || h.t > 0.5 ? `wing2${S}` : `wing${S}`;
  }
  return 'body';
}

const clips = {
  ...birdClips({
    face, tail: ['tail1'], flapUp: 22,
    add: {
      // the V-wings never fold flat: the template's droops are halved by lifting them back up a little
      faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return { wingL: { r: [0, -10 * d, 0] }, wingR: { r: [0, 10 * d, 0] } }; },
    },
  }),

  // fidget: rears up and screams at the sky, the wings shuddering with static
  idle_screech: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.86, 0]]);
      const sh = Math.sin(TAU * 14 * u) * win(u, 0.25, 0.7, 0.04);
      return {
        body: { r: [-8 * up, 0, 0] },
        head: { r: [-28 * up + 3 * sh, 0, 0] },
        ...face.pose(up > 0.5 ? 'squeeze' : 'open'),
        wingL: { r: [0, -8 * up + 3 * sh, 0] },
        wingR: { r: [0, 8 * up - 3 * sh, 0] },
        wing2L: { r: [0, -6 * up + 4 * sh, 0] },
        wing2R: { r: [0, 6 * up - 4 * sh, 0] },
        tail1: { r: [-10 * up, 0, 6 * sh] },
      };
    },
  },

  // fidget: shakes out each wing in turn and settles its crest
  idle_rouse: {
    seconds: 2.4,
    pose: (t, u) => {
      const l = Math.sin(TAU * 8 * u) * win(u, 0.1, 0.4, 0.05);
      const r = Math.sin(TAU * 8 * u) * win(u, 0.45, 0.75, 0.05);
      return merge({
        body: { r: [0, 4 * osc(u, 2), 0] },
        head: { r: [0, 0, 10 * win(u, 0.1, 0.4, 0.08) - 10 * win(u, 0.45, 0.75, 0.08)] },
        ...face.pose('open'),
        wingL: { r: [0, 8 * l, 0] },
        wing2L: { r: [0, 10 * l, 0] },
        wingR: { r: [0, -8 * r, 0] },
        wing2R: { r: [0, -10 * r, 0] },
      });
    },
  },
};
delete clips.idle_preen;

export default rigDef({ joints, assign, extras: face.extras, clips });
