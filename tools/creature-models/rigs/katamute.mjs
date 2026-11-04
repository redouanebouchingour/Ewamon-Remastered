// Katamute's rig: a shaggy dog brawler holding a wide-legged double-biceps flex (the rest pose: upper arms out and
// down, forearms up, fists beside the head), floppy ears, a billowing hair plume streaming off its top-knot
// (pony1..3) and a big bushy tail. Numbers are scad/katamute.scad's.
import { K, TAU, both, merge, osc, rigDef, wave, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, mx, pair, petal, pick, spike } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';

const FUR = [0.92, 0.78, 0.57];
const ponies = ['pony1', 'pony2', 'pony3'];
const tails = ['tail1', 'tail2', 'tail3'];

// the head block is built at its first size and scaled up about the chin: translate(HEADF) scale(HEADK) { ... }
const HF = subFrame([0, 0.54, -4.09], [0, 0, 0], 1.18);
// the plume is raised with the head top: translate([0, 0, 1.45]) { ... }
const PF = subFrame([0, 0, 1.45]);
const eye = { side: 'L', at: [2.95, -6.2, 24.5], size: 1.35, yaw: 10, frame: HF };
const face = eyeKit({ eyes: [eye, mirrorEye(eye)], skin: FUR });

const TORSO = [[[4.6, 3.8, 3.2], [0, 0.8, 11]], [[4.0, 3.6, 2.2], [0, 0.4, 14]], [[7.2, 4.6, 3.4], [0, 0, 18.4]], [[5.6, 4.2, 2.5], [0, 0.4, 20.2]]];
const HEAD = [[[5.6, 4.5, 4.6], [0, -2.6, 26.3]], [[4.9, 3.8, 3.2], [0, -3.6, 23.2]]];
const HIP = [4.4, 1, 11];
const KNEE = [8.2, -0.5, 7];
const ANKLE = [9.8, -0.6, 3];
const SH = [7.2, 1.5, 19.8];
const EL = [13.4, 1.5, 16.6];
const WR = [14.2, -0.2, 20.4];
const FIST = [14.4, -0.4, 22.2];
const TAILZ = [0, 0, 20];
const TAIL = [[[2.4, 2.0, 2.6], [1.5, 4.4, 13.5]], [[3.6, 2.4, 4.4], [6.8, 6.6, 11.8]], [[4.2, 2.6, 5.4], [12.2, 7.8, 12.2]],
  [[3.0, 2.2, 4.2], [15.6, 8.0, 14.6]], [[1.2, 1.0, 1.8], [16.6, 7.8, 18.2]]];
const EAR = [4.0, -1.8, 28.1];
const PLUME = [[[3.0, 2.8, 3.0], [1.0, 1.6, 36.6]], [[2.5, 2.3, 2.5], [4.6, 2.6, 37.2]], [[1.9, 1.8, 2.0], [7.6, 3.4, 37.4]],
  [[1.2, 1.2, 1.3], [10.0, 4.0, 38.2]], [[0.45, 0.45, 0.5], [10.8, 4.0, 39.9]]];

// the scad's tuft(p, d, w): a flattened tuft from p tapering to p + d
const tuft = (p, d, w) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], w * 0.8, w * 0.3);
// a hull of two ellipsoids, tested as both plus the capsule between their centres
const seg = (a, b) => any(blob([a, b]), limb(a[1], b[1], Math.min(...a[0]), Math.min(...b[0])));
// a hull of two tail ellipsoids, each turned TAILZ about its centre
const tseg = (a, b) => any(petal(a[0], a[1], TAILZ), petal(b[0], b[1], TAILZ), limb(a[1], b[1], Math.min(...a[0]), Math.min(...b[0])));
const tailTufts = [[[7.4, 6.6, 8.8], [-0.4, 0.2, -2.2], 1.8], [[11.2, 7.6, 8.4], [0.6, 0.2, -2.4], 2.0], [[14.8, 8.0, 10.0], [2.4, 0.4, -2.2], 1.8],
  [[16.6, 8.0, 12.4], [3.0, 0.4, -0.6], 1.6], [[16.2, 7.8, 17.6], [0.6, -0.2, 2.4], 1.0], [[15.4, 7.8, 17.0], [-0.9, 0, 2.0], 0.9], [[17.0, 7.8, 16.6], [1.8, 0, 1.6], 0.9]];
const armTufts = [[8.6, 16.9, -0.5], [9.8, 16.2, -0.3], [11.0, 15.5, -0.1], [12.2, 14.9, 0.1], [13.4, 14.3, 0.5], [14.4, 14.4, 1.0]];
const PAW = subFrame([10.4, -1.6, 0], [0, 0, 22]);
const EARF = subFrame(EAR, [0, -15, -40], 1.15);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', HIP),
  { name: 'body', parent: 'root', at: [0, 0, 11] },
  { name: 'head', parent: 'body', at: [0, -1.5, 21.0] },
  ...pair('ear*', 'head', HF.world(EAR)),
  { name: 'pony1', parent: 'head', at: PF.world([0.5, 0.6, 31]) },
  { name: 'pony2', parent: 'pony1', at: PF.world(PLUME[1][1]) },
  { name: 'pony3', parent: 'pony2', at: PF.world(PLUME[2][1]) },
  ...pair('arm*', 'body', SH),
  ...pair('fore*', 'arm*', EL),
  ...pair('hand*', 'fore*', WR),
  { name: 'tail1', parent: 'body', at: TAIL[0][1] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1][1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2][1] },
  ...face.joints,
];

const plume = [
  ['pony1', any(limb([0.6, 0.4, 30.4], [0.2, 0.8, 32.4], 1.4, 1.8),
    blob([[[2.6, 2.4, 1.6], [0.4, 0.8, 32.2]], [[4.0, 3.4, 3.0], [-2.0, 1.0, 34.2]], [[3.6, 3.2, 2.8], [0.6, 1.6, 36.2]], [[2.6, 2.6, 2.0], [-3.0, 1.0, 37.2]]]),
    seg(PLUME[0], PLUME[1]))],
  ...chain(['pony1', 'pony1', 'pony1'], [[-4.2, -0.8, 35.4], [-1.4, -1.6, 37.0], [2.0, -0.4, 37.8], [5.0, 0.8, 38.2]], [0.7, 0.75, 0.6, 0.3]),
  ...chain(['pony1', 'pony1'], [[-4.6, 0.0, 33.0], [-1.8, -1.6, 34.4], [1.6, -1.0, 35.2]], [0.6, 0.6, 0.3]),
  ...chain(['pony1', 'pony1'], [[-4.6, 0.8, 33.2], [-6.2, 0.6, 33.2], [-6.6, 0.6, 34.4]], [0.8, 0.5, 0.15]),
  ['pony2', seg(PLUME[1], PLUME[2])],
  ['pony3', any(seg(PLUME[2], PLUME[3]), seg(PLUME[3], PLUME[4]))],
  ...chain(['pony2', 'pony3', 'pony3'], [[6.0, 3.0, 36.0], [8.6, 3.8, 35.6], [10.2, 4.4, 34.6], [9.8, 4.4, 33.4]], [1.3, 1.0, 0.6, 0.2]),
  ...chain(['pony1', 'pony2', 'pony2', 'pony2'], [[2.0, 2.0, 33.6], [5.0, 2.8, 33.4], [7.0, 3.4, 32.6], [7.4, 3.4, 31.4], [6.6, 3.2, 31.0]], [2.0, 1.5, 1.0, 0.5, 0.15]),
].map(([n, t]) => [n, inFrame(PF, t)]);

const parts = [
  ['body', any(blob(TORSO), tuft([0, -3.2, 15.2], [0, -0.4, -1.6], 1.5),
    mx(any(tuft([1.4, -3.4, 15.9], [0.1, -0.4, -1.5], 1.4), tuft([2.8, -3.6, 16.8], [0.2, -0.4, -1.5], 1.4), tuft([4.2, -3.4, 17.8], [0.3, -0.3, -1.5], 1.4),
      tuft([6.2, -1.6, 16.6], [0.6, -0.2, -2.0], 1.6), tuft([6.0, 1.2, 16.4], [0.6, 0.2, -2.0], 1.6))))],
  ['head', inFrame(HF, any(blob(HEAD), limb(HEAD[0][1], HEAD[1][1], 4.4, 3.4), ell([2.6, 2.0, 1.4], [0, -5.7, 22.6]), ell([1.25, 0.75, 0.65], [0, -7.5, 23.0]),
    limb([-2.0, -6.1, 21.4], [0, -6.9, 21.2], 0.36), limb([0, -6.9, 21.2], [3.5, -5.2, 22.5], 0.36), limb([0.8, -7.0, 21.65], [2.6, -6.25, 22.05], 0.44),
    mx(ell([1.6, 1.7, 1.4], [4.0, -3.4, 22.0])), mx(ell([1.4, 0.9, 0.7], [2.95, -6.1, 25.5])), mx(ell([1.35, 0.7, 1.55], [2.95, -6.2, 24.5])),
    limb([0.6, 0.4, 29.6], [0.6, 0.4, 30.9], 1.7)))],
  ['ear*', inFrame(HF, inFrame(EARF, any(blob([[[0.9, 1.7, 0.8], [0, 0, 0]], [[0.8, 2.0, 0.8], [2.6, -0.1, -0.4]], [[0.7, 1.5, 1.5], [3.0, -0.3, -4.0]]]),
    limb([0, 0, 0], [2.6, -0.1, -0.4], 0.8), limb([2.6, -0.1, -0.4], [3.0, -0.3, -4.0], 0.8))))],
  ...plume,
  ['arm*', any(ell([3.4, 3.4, 3.2], SH), limb(SH, EL, 3.3, 3.0), ell([2.8, 2.5, 2.1], [10.4, 0.8, 19.3]),
    ...armTufts.filter((q) => q[0] < 13).map((q) => tuft([q[0], 1.5, q[1]], [q[2], 0, -2.4], 1.6)))],
  ['fore*', any(limb(EL, WR, 2.9, 2.6), ...armTufts.filter((q) => q[0] >= 13).map((q) => tuft([q[0], 1.5, q[1]], [q[2], 0, -2.4], 1.6)),
    ...[[15.4, 0.9, 16.8], [15.8, 0.4, 18.2], [16.0, -0.1, 19.6]].map((q) => tuft(q, [1.6, 0, -1.2], 1.3)))],
  ['hand*', any(ell([2.6, 2.5, 2.5], FIST), ...[0, 1, 2, 3].map((i) => ell([0.85, 0.75, 0.8], [12.6 + 0.15 * i, -2.0 + 0.95 * i, 23.1 - 0.15 * i])),
    ell([0.8, 0.9, 1.1], [13.4, -2.5, 21.2]))],
  ['leg*', any(limb(HIP, KNEE, 3.5, 3.1), limb(KNEE, ANKLE, 2.6, 2.2),
    limb([KNEE[0] + 0.3, KNEE[1] - 0.3, KNEE[2] + 0.8], [ANKLE[0] + 0.1, ANKLE[1] - 0.2, ANKLE[2] + 0.6], 4.8, 4.2),
    limb([7.8, -1.6, 9.8], [6.6, -1.3, 13.8], 1.6, 0.9), limb([9.0, 0.6, 9.6], [7.4, 1.0, 12.4], 1.5, 0.8),
    inFrame(PAW, any(ell([2.5, 2.6, 1.7], [0, 0.6, 1.7]), ell([2.6, 1.8, 1.2], [0, -2.0, 1.2]),
      ...[-1, 0, 1].map((a) => spike([a * 1.5, -3.4, 1.1], [a * 0.4, -1.5, -1.0], 0.55)))))],
  ['tail1', tseg(TAIL[0], TAIL[1])],
  ['tail2', tseg(TAIL[1], TAIL[2])],
  ['tail3', any(tseg(TAIL[2], TAIL[3]), tseg(TAIL[3], TAIL[4]))],
  ...tailTufts.map(([p, d, w]) => [p[0] < 12.6 ? 'tail2' : 'tail3', tuft(p, d, w)]),
];

// the plume streams: a wave down its links, whole cycles per clip
const pony = (u, amp = 5, cycles = 1) => wave(ponies, u, { cycles, amp: [amp * 0.6, 0, amp], lag: 0.15, grow: 0.4 });

const base = bipedClips({
  face, tail: tails, hipH: 11, stride: 20, guard: true, hopScale: 0.8, hopH: 3.5,
  punch: { arm: [0, 0, 70], fore: [80, 0, 0] },
  cheer: { arm: [0, -22, 0], fore: [0, -12, 0] },
  add: {
    idle: (t, u) => pony(u, 4, 2),
    walk: (t, u) => pony(u, 9, 1),
    idle_look: (t, u) => pony(u, 6, 2),
    lunge: (t, u) => ({ ...pony(u, 10, 1), handR: { s: 1 } }),
    hurt: (t, u) => pony(u, 12, 2),
    faint: (t, u) => pony(u, 6, 1),
    celebrate: (t, u) => ({ ...pony(u, 12, 2), ...both('hand', { s: 1 + 0.12 * Math.abs(Math.sin(TAU * u)) }) }),
    enter: (t, u) => pony(u, 8, 1),
    exit: (t, u) => pony(u, 6, 1),
  },
});

const clips = {
  ...base,

  // fidget: a double-biceps pump, pump, hold, chin up, a smug squint
  idle_flex: {
    seconds: 2.4,
    pose: (t, u) => {
      const p = win(u, 0.08, 0.28, 0.05) + win(u, 0.32, 0.52, 0.05);
      const hold = K(u, [[0, 0], [0.55, 0], [0.62, 1], [0.86, 1], [0.95, 0]]);
      return merge({
        body: { r: [-4 * hold, 0, 0], s: [1 + 0.03 * (p + hold), 1, 1] },
        head: { r: [-10 * hold, 0, 6 * hold] },
        ...both('arm', { r: [0, -10 * p - 16 * hold, 0] }),
        ...both('fore', { r: [0, -6 * p - 6 * hold, 0] }),
        ...both('hand', { s: 1 + 0.15 * p + 0.1 * hold }),
        ...face.pose('open', 0.45 * hold),
      }, pony(u, 5, 2));
    },
  },
  // fidget: a flick of the head that tosses the plume over, one ear flopping
  idle_toss: {
    seconds: 1.8,
    pose: (t, u) => {
      const fl = K(u, [[0, 0], [0.18, -1], [0.32, 1], [0.55, 0]]);
      const swing = Math.sin(TAU * 2 * Math.max(0, u - 0.3)) * Math.max(0, 1 - (u - 0.3) / 0.6) * (u > 0.3 ? 1 : 0);
      return {
        head: { r: [-6 * Math.abs(fl), 0, 14 * fl] },
        pony1: { r: [12 * fl, 0, -20 * fl + 8 * swing] },
        pony2: { r: [8 * fl, 0, -14 * fl + 10 * swing] },
        pony3: { r: [6 * fl, 0, -10 * fl + 12 * swing] },
        earL: { r: [0, -20 * Math.max(0, fl) + 10 * swing, 0] },
        earR: { r: [0, 14 * Math.max(0, -fl), 0] },
        ...face.pose('open', blinks(u, [[0.6, 0.68]])),
        ...tails.reduce((o, n, i) => ({ ...o, [n]: { r: [0, 0, 5 * osc(u, 2, -0.1 * i)] } }), {}),
      };
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
