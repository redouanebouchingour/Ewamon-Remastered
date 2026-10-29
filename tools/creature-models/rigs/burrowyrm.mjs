// Burrowyrm's rig: a little sand wyrm rearing up as one column from the ground, a big round head with a broad snout,
// crystal horns and a row of crystal spikes down its back. Numbers are scad/burrowyrm.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, closest, ellD, isAny } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const YELLOW = [0.97, 0.7, 0.25];
const CRYSTAL = [[0.45, 0.3, 0.7], [0.92, 0.88, 1]];

const eyeL = { side: 'L', at: [5.3, -9.5, 33.6], size: 2.8, yaw: -30 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: YELLOW });
const spine = ['spine1', 'spine2', 'neck'];

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'spine1', parent: 'root', at: [0, 1, 8] },
  { name: 'spine2', parent: 'spine1', at: [0, 0.5, 15] },
  { name: 'neck', parent: 'spine2', at: [0, 0, 21] },
  { name: 'head', parent: 'neck', at: [0, -1.5, 25] },
  ...face.joints,
];

const byZ = (z) => (z < 8 ? 'root' : z < 15 ? 'spine1' : z < 21 ? 'spine2' : 'neck');

function assign(c, rgb) {
  if (isAny(rgb, CRYSTAL)) return Math.abs(c[0]) > 3 || c[2] > 28 ? 'head' : byZ(c[2] - 4);   // back spikes by their root
  const head = Math.min(ellD(c, [10.6, 9.2, 8.8], [0, -1.6, 31.5]), blobD(c, [[[7, 4, 4.6], [0, -8, 27.6]], [[6, 3.4, 3.6], [0, -13, 27]]]),
    ellD(c, [4.2, 2, 4.4], [Math.abs(c[0]) > 0 ? 5.2 * Math.sign(c[0]) : 5.2, -8.6, 33.4]));
  const body = blobD(c, [[[9.4, 8.6, 3], [0, 1, 5]], [[8.2, 7.6, 4], [0, 1, 14]], [[6.4, 6, 4], [0, 0, 21]],
    [[6.4, 3.6, 3], [0, -5, 5]], [[5.8, 3.6, 4], [0, -4.4, 14]], [[4.6, 3.4, 4], [0, -4.2, 21]]]);
  return closest([['head', head], [byZ(c[2]), body]]);
}

const base = serpentClips({ face, spine });

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
