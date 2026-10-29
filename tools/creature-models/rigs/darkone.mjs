// Darkone's rig: a floating shadow wraith in a high collar, one red eye under a blue flame plume, flames on its
// shoulders and in its claws, a ragged skirt trailing into blue fire. Numbers are scad/darkone.scad's (the old model;
// re-rig when the sprite-matched one lands).
import { K, both, merge, osc, rigDef } from './lib/anim.mjs';
import { eyeKit } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const SHADE = [0.17, 0.16, 0.18];
const RUFF = [[0.93, 0.93, 0.95], [0.6, 0.08, 0.1], [0.7, 0.1, 0.1]];
const FLAMES = [[0.15, 0.42, 0.88], [0.3, 0.68, 0.98], [0.5, 0.85, 1]];

const face = eyeKit({ eyes: [{ side: 'R', at: [-1.7, -4.55, 28.5], size: 1.6, yaw: 10 }], skin: SHADE });
const wisp = ['wisp1', 'wisp2'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 16] },
  { name: 'head', parent: 'body', at: [0, -1.2, 25] },
  { name: 'wisp1', parent: 'head', at: [0.6, -1.4, 33.5] },
  { name: 'wisp2', parent: 'wisp1', at: [-1, 0, 37.5] },
  { name: 'armL', parent: 'body', at: [7.5, -0.5, 22.5] },
  { name: 'handL', parent: 'armL', at: [13, -3, 13] },
  { name: 'armR', parent: 'body', at: [-7.5, -0.5, 22.5] },
  { name: 'handR', parent: 'armR', at: [-13, -3, 13] },
  { name: 'tail1', parent: 'body', at: [0, 0, 8] },
  ...face.joints,
];

// the collar is a shell round the head: a triangle on it lies on its outer or inner surface
const shell = (c, r, p) => 1 + 3 * Math.abs(ellD(c, r, p) - 1);

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (isAny(rgb, RUFF)) return 'body';
  if (isAny(rgb, FLAMES)) {
    if (c[2] < 9.5 && f[0] < 6) return 'tail1';
    if (f[0] > 11) return `hand${S}`;
    if (f[0] > 5.5 && c[2] < 33) return 'body';
    return c[2] > 37.5 ? 'wisp2' : c[2] > 33 ? 'wisp1' : 'head';
  }
  if (!near(rgb, SHADE) && !near(rgb, [0.27, 0.26, 0.29])) return f[0] > 11 ? `hand${S}` : 'head';   // the eye
  return closest([
    ['body', Math.min(blobD(c, [[[5, 4.4, 4], [0, 0, 18]], [[7.5, 6.5, 2.5], [0, 0, 11]]]), ellD(c, [10, 9, 5], [0, 0, 9]),
      blobD(c, [[[6, 4.4, 4], [0, 0, 22.5]], [[4, 3.5, 3], [0, 0, 18]]]), blobD(c, [[[6.4, 4.4, 2], [0, 1.6, 21]], [[7.2, 5.6, 2.5], [0, 1.2, 14]]]),
      ellD(f, [3.6, 3.2, 3.2], [7, 0.5, 24.5]), ellD(c, [6.5, 5, 3], [0, 0, 18.5]),
      shell(c, [8.5, 6.2, 9], [0, 1.6, 27]), shell(c, [7.6, 5.2, 8.4], [0, 0.8, 27.6]))],
    ['head', Math.min(blobD(c, [[[4.2, 3.8, 4.2], [0, -1.2, 28]], [[2.6, 2.6, 2.4], [0, 1.6, 32]]]), ellD(c, [2.6, 1.6, 1.2], [-1.8, -4.4, 30.1]))],
    [`arm${S}`, capD(f, [7.5, -0.5, 22.5], [11, -1.5, 18], 1.6, 1.2)],
    [`hand${S}`, Math.min(capD(f, [11, -1.5, 18], [13, -3, 13], 1.2, 1), ellD(f, [2.6, 2.6, 3], [13.4, -4.4, 10.8]))],
  ]);
}

const base = floaterClips({ face, tail: ['tail1'], wisp, bob: 0.8 });

const clips = {
  ...base,
  // fidget: the claw flames flare as it raises both hands, the plume roaring up, the red eye narrowing
  idle_flare: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.88, 0]]);
      return merge({
        body: { p: [0, 0, 0.6 * on], r: [-4 * on, 0, 0] },
        head: { r: [-6 * on, 0, 0] },
        ...face.pose('open', 0.45 * on),
        ...both('arm', { r: [-35 * on, -20 * on, 0] }),
        ...both('hand', { s: 1 + 0.12 * on * (osc(u, 6) * 0.5 + 0.5) }),
        wisp1: { r: [-8 * on, 0, 5 * osc(u, 4) * on], s: [1, 1, 1 + 0.15 * on] },
        wisp2: { r: [-6 * on, 0, 8 * osc(u, 4, 0.2) * on] },
        tail1: { s: [1, 1, 1 + 0.2 * on] },
      });
    },
  },
};


export default rigDef({ joints, assign, extras: face.extras, clips });
