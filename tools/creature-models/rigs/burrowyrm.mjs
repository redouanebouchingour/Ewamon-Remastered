// Burrowyrm's rig: a baby sand wyrm whose body rises as one column out of its burrow, a big round head with a long
// muzzle turned towards its right, gem eyes, crystal horns and three crystal spikes down its back. The sand clods and
// the buried base stay planted on the root; the column bends in three links and the head turns on top.
// Numbers are scad/burrowyrm.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, closest, isAny, subFrame } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const ORANGE = [0.87, 0.43, 0.19];
const CREAM = [0.95, 0.71, 0.32];
const BAND = [0.72, 0.45, 0.2];
const SAND = [[0.86, 0.59, 0.27], [0.76, 0.5, 0.23]];
const CRYSTAL = [[0.42, 0.29, 0.6], [0.93, 0.9, 1]];

// The scad's frames.
const CC = [0.4, 1.6, 0];
const HC = [-3.2, -2.5, 29.5];
const MP = [0, -4, 0];
const col = subFrame(CC, [0, 0, -30]);
const head = subFrame(HC, [0, 0, 0]);
const muz = subFrame([HC[0] + MP[0], HC[1] + MP[1], HC[2] + MP[2]], [0, 0, -40]);

const COL = [
  [[9.2, 9.6, 1.6], [0, 0, 1.6]],
  [[9.0, 9.6, 3.5], [0, 0, 5]],
  [[8.2, 9.4, 3.8], [0, 0, 10.5]],
  [[6.2, 7.6, 3.2], [0, -0.2, 15.5]],
  [[5.4, 6.0, 3], [-0.3, -1.6, 20.5]],
];
const HEAD = [
  [[9.6, 8, 8], [0, 0, 0]],
  [[7.4, 6.8, 5.5], [0, -2, -4]],
];
const MUZ = [
  [[5.3, 4.6, 4.8], [0, -1.5, -9.6]],
  [[4.7, 4.4, 4.6], [0, -4.4, -11.2]],
  [[4.5, 4.1, 4], [0, -7.3, -8.8]],
];
// The nape hull's two ends, in world terms (the head end and the column end).
const NAPE = [[[6.6, 5.6, 4.5], [HC[0], HC[1] + 1.6, HC[2] - 3.5]], [[5.6, 6.2, 2], col.world([-0.3, -0.8, 19])]];
const SPIKES = [[[5.9, 4.5, 13.0], 'spine2'], [[4.4, 3.4, 18.6], 'neck'], [[3.6, 2.8, 24.2], 'neck']];

const eyeL = { side: 'L', at: [5.1, -6.5, -2.6], size: 3.0, yaw: 16, frame: head };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: CREAM });
const spine = ['spine1', 'spine2', 'neck'];

const joints = [
  { name: 'root', at: [0.4, 1.6, 0] },
  { name: 'spine1', parent: 'root', at: [0.4, 1.6, 5] },
  { name: 'spine2', parent: 'spine1', at: [0.3, 1.4, 11] },
  { name: 'neck', parent: 'spine2', at: [0.1, 1.1, 17] },
  { name: 'head', parent: 'neck', at: [-1.8, -1.0, 23.5] },
  ...face.joints,
];

const byZ = (z) => (z < 5 ? 'root' : z < 11 ? 'spine1' : z < 17 ? 'spine2' : 'neck');
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function assign(c, rgb) {
  if (isAny(rgb, SAND)) return 'root';                       // the burrow stays put
  if (isAny(rgb, CRYSTAL)) {
    if (c[2] > 29) return 'head';                            // the horns
    return SPIKES.reduce((b, s) => (dist2(c, s[0]) < dist2(c, b[0]) ? s : b))[1];
  }
  if (isAny(rgb, [BAND])) return byZ(c[2]);                  // belly segment lines
  if (!isAny(rgb, [ORANGE, CREAM])) return 'head';           // eyes, nostrils, smile
  const dHead = Math.min(blobD(head.local(c), HEAD), blobD(muz.local(c), MUZ));
  const dCol = blobD(col.local(c), COL);
  const dNape = blobD(c, NAPE);
  return closest([['head', dHead], [byZ(c[2]), dCol], [c[2] > 26 ? 'head' : 'neck', dNape]]);
}

// A short column: the template's forward strike and slump would plant the muzzle in the sand, so they lean a little less.
const ease = (k) => Object.fromEntries(spine.map((n) => [n, { r: [k, 0, 0] }]));
const add = {
  lunge: (t, u) => ease(-5 * K(u, [[0.08, 0], [0.38, 1], [0.62, 1], [1, 0]])),
  faint: (t, u) => ease(-6 * Math.min(1, Math.max(0, (u - 0.15) / 0.6))),
};
const base = serpentClips({ face, spine, add });

const clips = {
  ...base,

  // fidget: burrows its snout into the sand for a sniff, then pops up and shakes the sand off its head
  idle_dig: {
    seconds: 2.6,
    pose: (t, u) => {
      const dig = K(u, [[0, 0], [0.2, 1], [0.5, 1], [0.62, 0]]);
      const nuzzle = osc(u, 8) * win(u, 0.2, 0.5, 0.04);
      const sh = Math.sin(Math.PI * 2 * 7 * u) * win(u, 0.64, 0.9, 0.03);
      return merge({
        spine1: { r: [8 * dig, 0, 0] },
        spine2: { r: [10 * dig, 0, 0] },
        neck: { r: [10 * dig, 0, 0] },
        head: { r: [14 * dig, 0, 4 * nuzzle + 10 * sh] },
        ...face.pose(dig > 0.5 ? 'shut' : sh !== 0 ? 'squeeze' : 'open', blinks(u, [[0.92, 0.96]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
