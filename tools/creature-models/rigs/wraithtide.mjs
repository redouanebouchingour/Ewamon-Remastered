// Wraithtide's rig: a ghost fish hovering on a column of smoke. The fish is built side-on in the picture plane (the
// scad's pp(): turned 30 about Z, x along the fish with the nose at -x, y its width, + away from the viewer), so the
// fish frame (the body, fins and tail joints) is turned -60: local +X the near side, +Y towards the tail. A bone skull
// is its face (its jaw chatters), set in the front of the hood and turned towards the viewer; two glowing socket eyes
// with bone lids (eyeKit) and a cyan flame plume trailing from each. Ragged pectoral, dorsal and tail fins, and the
// smoke under it flat wavy ribbons: the drape and its strands are wisp1, the long S-curl to the ground wisp2 / wisp3. Numbers are scad/wraithtide.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { fishClips } from './lib/fish.mjs';
import { closest, ellD, isAny, subFrame } from './lib/geo.mjs';

const BONE = [0.79, 0.81, 0.77];
const SOCKET = [0.05, 0.07, 0.08];
const GLOW = [0.13, 0.82, 0.71];
const CORE = [0.62, 0.96, 0.9];
const FLAME = [0.28, 0.89, 0.78];
const RIM = [0.47, 0.8, 0.77];
const FINS = [[0.58, 0.85, 0.81], [0.8, 0.96, 0.92], [0.36, 0.66, 0.64]];
const SMOKES = [[0.46, 0.55, 0.56], [0.55, 0.64, 0.64], [0.37, 0.45, 0.47]];

const P = subFrame([0, 0, 0], [0, 0, 30]);                       // pp(0)
const SKULL_AT = [-10, -5.6, 30.1];
const SF = subFrame(P.world(SKULL_AT), [0, 0, 30 - 22], 1.3);    // pp(0) translate(SKULL_AT) rotate(-22) scale(1.3)
const FISH = [0, 0, -60];
const W = (p) => P.world(p);

// the long smoke ribbon's control points (the scad's CURL, pp coordinates)
const CURL = [[-1.5, 0, 20.5], [0.6, 0, 16.2], [3.4, 0, 12.6], [3.7, 0, 8.8], [2.2, 0, 6], [-0.8, 0, 4.5], [-3.3, 0, 3.4],
  [-3.6, 0, 1.7], [-2.2, 0, 0.5]];
const EYE = [2.7, -3.6, -1.1];
const wisp = ['wisp1', 'wisp2', 'wisp3'];

const face = eyeKit({
  eyes: [
    { side: 'L', at: EYE, size: 1.35, yaw: 24, flat: 0.55, frame: SF },
    { side: 'R', at: [-EYE[0], EYE[1], EYE[2]], size: 1.35, yaw: -24, flat: 0.55, frame: SF },
  ],
  parent: 'head', skin: BONE,
});

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: W([-3, 0, 26]), rot: FISH },
  { name: 'head', parent: 'body', at: SF.world([0, 0, 0]), rot: SF.rot },
  { name: 'jaw', parent: 'head', at: SF.world([0, -0.6, -3.6]), rot: SF.rot },
  { name: 'eyeL', parent: 'head', at: SF.world(EYE), rot: SF.rot },
  { name: 'eyeR', parent: 'head', at: SF.world([-EYE[0], EYE[1], EYE[2]]), rot: SF.rot },
  { name: 'flameF', parent: 'head', at: SF.world([-4.2, -3.2, -1.1]), rot: SF.rot },
  { name: 'flameN', parent: 'head', at: SF.world([4, -3.2, -0.4]), rot: SF.rot },
  { name: 'finL', parent: 'body', at: W([-1.5, -3.6, 22.6]), rot: FISH },
  { name: 'finR', parent: 'body', at: W([-3, 3.6, 21.5]), rot: FISH },
  { name: 'dorsal1', parent: 'body', at: W([-3, 0, 33]), rot: FISH },
  { name: 'tail1', parent: 'body', at: W([4, 0, 26.2]), rot: FISH },
  { name: 'tail2', parent: 'tail1', at: W([6.6, 0, 26]), rot: FISH },
  { name: 'wisp1', parent: 'body', at: W([-4, 0, 18]) },
  { name: 'wisp2', parent: 'wisp1', at: W(CURL[3]) },
  { name: 'wisp3', parent: 'wisp2', at: W(CURL[5]) },
  ...face.joints,
];

function assign(c, rgb) {
  const q = P.local(c);     // pp coordinates: x along the fish, y its width, z up
  const s = SF.local(c);    // skull coordinates
  if (isAny(rgb, [FLAME], 0.03)) return s[0] < 0 ? 'flameF' : 'flameN';
  if (isAny(rgb, [GLOW, CORE, [1, 1, 1]], 0.03)) return s[0] > 0 ? 'eyeL' : 'eyeR';
  if (isAny(rgb, [SOCKET], 0.03)) return s[2] < -3.9 ? 'jaw' : 'head';
  if (isAny(rgb, [BONE], 0.03)) {
    return closest([['head', Math.min(ellD(s, [5.4, 4.6, 4.6], [0, 0.2, 0.3]), ellD(s, [4.2, 3.4, 2.3], [0, -1.1, -2.5]))],
      ['jaw', ellD(s, [2.8, 2.5, 1.9], [0, -1.7, -4.7])]]);
  }
  if (isAny(rgb, [RIM], 0.03)) return 'head';
  if (isAny(rgb, SMOKES, 0.03)) {
    // below the drape only the long curl (the ribbon at y = 0) hangs on: wisp2 down to its bend, wisp3 the tail
    if (q[2] > 9.6 || Math.abs(q[1]) > 1.5 || q[0] < -5) return 'wisp1';
    return q[2] > 5.3 ? 'wisp2' : 'wisp3';
  }
  if (isAny(rgb, FINS, 0.03)) {
    if (q[0] < -12) return 'body';                    // the drape under the chin
    if (q[0] > 6.4 && q[2] > 13) return 'tail2';
    if (q[2] > 30.4 && q[0] < 5.5) return 'dorsal1';
    if (q[1] < -1.8) return 'finL';
    if (q[1] > 1.8) return 'finR';
    return 'tail1';
  }
  return q[0] > 3.8 ? 'tail1' : 'body';
}

const clips = fishClips({ face, tail: ['tail1', 'tail2'], dorsal: ['dorsal1'], wisp, hover: true, sweep: 10 });

// fidget: the skull's jaw chatters while the fish shudders, the eye flames flaring, the smoke billowing
clips.idle_chatter = {
  seconds: 1.8,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.8, 0.08);
    const flare = 1 + 0.12 * on * (0.5 + 0.5 * osc(u, 6));
    return merge({
      root: { p: [0, 0, 0.6 * osc(u, 1)] },
      body: { r: [0, 2 * osc(u, 14) * on, 0] },
      head: { r: [-6 * on, 0, 4 * on] },
      jaw: { r: [(10 + 8 * osc(u, 10)) * on, 0, 0] },
      eyeL: { s: flare },
      eyeR: { s: flare },
      flameF: { r: [0, 14 * on, 0], s: 1 + 0.25 * on },
      flameN: { r: [0, -14 * on, 0], s: 1 + 0.25 * on },
      wisp1: { s: 1 + 0.05 * K(u, [[0, 0], [0.4, 1], [1, 0]]) },
      wisp2: { r: [6 * osc(u, 2) * on, 0, 10 * osc(u, 2, 0.2) * on] },
      ...face.pose('open', blinks(u, [[0.88, 0.94]])),
    });
  },
};

// the eye flames never sit still: a lick and a flutter layered on every clip
for (const c of Object.values(clips)) {
  const base = c.pose;
  const cycles = Math.max(1, Math.round(c.seconds * 2));
  c.pose = (t, u) => merge(base(t, u), {
    flameF: { r: [6 * osc(u, cycles), 8 * osc(u, cycles, 0.3), 0] },
    flameN: { r: [6 * osc(u, cycles, 0.5), -8 * osc(u, cycles, 0.15), 0] },
  });
}

export default rigDef({ joints, assign, clips, extras: face.extras });
