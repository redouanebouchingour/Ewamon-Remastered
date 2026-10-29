// Smellduck's rig: a round duckling (head and body one egg, so the body is the head), a scallop-shell crest on the
// crown, a thick leaf tail held out at its left side, a drool drip under the bill and flat webbed feet. It has no
// wings to flap (only a folded-wing bulge), so the bird template's flap and preen give way to its own sleepy fidgets.
// Numbers are scad/smellduck.scad's.
import { K, TAU, merge, osc, rigDef, shake, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { ppFrame } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const GREEN = [0.60, 0.87, 0.31];
const PINKS = [[0.76, 0.17, 0.43], [0.52, 0.15, 0.30]];
const TAILS = [[0.17, 0.51, 0.40], [0.18, 0.21, 0.18]];
const MINT = [0.76, 0.93, 0.83];

// the egg's axis leans towards the bill: ax(z) = bx + lean * z
const ax = (z) => -5.7 - 0.03 * z;
const HX = ax(22);
const FACE = subFrame([HX, 0, 0], [0, 0, 10]);
const FEET = [['L', -5.7 + 8.9], ['R', -5.7 - 8.5]];

// the sleepy slit eyes (not lib.scad eye()): a mint sliver 2.3 x 0.9 x 0.8 at the head's surface, turned 28 deg out
const R25 = 11.08 - 0.4;
const eyes = [1, -1].map((s) => {
  const a = 28 * s;
  return {
    side: s > 0 ? 'L' : 'R', size: 2, flat: 0.45, yaw: a, frame: FACE,
    at: [ax(25.3) - HX + R25 * Math.sin((a * Math.PI) / 180), -R25 * Math.cos((a * Math.PI) / 180), 25.3],
  };
});
const face = eyeKit({ eyes, parent: 'body', skin: GREEN, lid: [1.2, 0.95, 0.45] });

const joints = [
  { name: 'root', at: [-5.7, -1, 0] },
  ...FEET.map(([S, x]) => ({ name: `leg${S}`, parent: 'root', at: [x, -1.5, 2] })),
  { name: 'body', parent: 'root', at: [-5.7, -1, 2.5] },
  { name: 'crest1', parent: 'body', at: ppFrame(3.7).world([-4.2, 0, 28.6]) },
  { name: 'tail1', parent: 'body', at: ppFrame(3).world([4.6, 0, 9]) },
  { name: 'drool', parent: 'body', at: FACE.world([-1.9, -14.6, 16]) },
  ...face.joints,
];

function assign(c, rgb) {
  if (isAny(rgb, PINKS)) return 'crest1';
  if (isAny(rgb, TAILS)) return 'tail1';
  if (near(rgb, MINT) && c[2] > 7 && c[2] < 17) return 'drool';
  if (c[2] < 2.6 && Math.hypot(c[0] - ax(c[2]), c[1]) > 6.4) return c[0] > ax(0) ? 'legL' : 'legR';
  return 'body';
}

const drool = (rx, rz = 0, s = 1) => ({ drool: { r: [rx, 0, rz], s: [1, 1, s] } });

const base = birdClips({
  face, crest: ['crest1'], tail: ['tail1'],
  add: {
    idle: (t, u) => drool(4 * osc(u, 2, 0.4), 3 * osc(u, 1, 0.2), 1 + 0.08 * osc(u, 2)),
    walk: (t, u) => drool(10 * osc(u, 2, 0.3), 14 * osc(u, 1, 0.25)),
    idle_peck: (t, u) => drool(-12 * win(u, 0.15, 0.75, 0.1), 6 * osc(u, 3)),
    windup: (t, u) => drool(-8 * smooth(u / 0.8)),
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return drool(-30 * hit, 0, 1 + 0.3 * hit); },
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return drool(30 * k, 18 * shake(u, 4)); },
    recoil: (t, u) => drool(12 * K(u, [[0, 0], [0.4, 1], [1, 0]])),
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return drool(-12 * d, 0, 1 + 0.5 * d); },
    celebrate: (t, u) => drool(18 * osc(u, 2), 10 * osc(u, 2, 0.25)),
    enter: (t, u) => drool(10 * win(u, 0.4, 0.9, 0.12)),
    exit: (t, u) => drool(6 * osc(u, 2)),
  },
});
const { idle_flap: _flap, idle_preen: _preen, ...clips0 } = base;

const clips = {
  ...clips0,

  // fidget: dozes off standing: the eyes close, the body nods forward, the drool stretches towards the ground, then
  // it jerks awake (the drool snaps back) and blinks
  idle_doze: {
    seconds: 3.4,
    pose: (t, u) => {
      const nod = K(u, [[0, 0], [0.2, 0.4], [0.3, 0.3], [0.62, 1], [0.7, 1]]);
      const jolt = win(u, 0.7, 0.8, 0.02);
      const after = smooth((u - 0.7) / 0.25);
      const n = nod * (1 - after);
      return merge({
        root: { p: [0, 0, 0.6 * jolt] },
        body: { r: [8 * n - 6 * jolt, 0, 3 * n], s: [1, 1, 1 + 0.04 * jolt] },
        ...face.pose(u > 0.12 && u < 0.72 ? 'shut' : 'open', blinks(u, [[0.82, 0.87], [0.9, 0.94]])),
        crest1: { r: [6 * n - 14 * jolt, 0, 0] },
        tail1: { r: [-4 * n, 0, 8 * jolt] },
      }, drool(-6 * n + 20 * jolt, 0, 1 + 0.9 * n - 0.4 * jolt));
    },
  },

  // fidget: slurps the drool back up (it shrinks into the bill), a shiver of satisfaction, then it drips again
  idle_slurp: {
    seconds: 2,
    pose: (t, u) => {
      const sl = K(u, [[0, 0], [0.2, 1], [0.55, 1], [0.95, 0]]);
      const sh = Math.sin(TAU * 9 * u) * win(u, 0.25, 0.5, 0.04);
      return merge({
        body: { r: [-4 * sl, 3 * sh, 0], s: [1 + 0.02 * sh, 1 + 0.02 * sh, 1 - 0.03 * sl] },
        ...face.pose(sl > 0.6 && u < 0.5 ? 'happy' : 'open'),
        crest1: { r: [4 * sh, 0, 4 * sh] },
        tail1: { r: [0, 0, 10 * sh] },
      }, drool(4 * sh, 0, 1 - 0.65 * sl));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
