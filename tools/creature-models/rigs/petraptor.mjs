// Petraptor's rig: a standing pterosaur. Thick legs off the root, a pear-shaped torso, a short thick neck into the
// wedge skull with its swept crest (the darker lower bill is the jaw), feathered wings hanging from raised arms, and a
// short tail sweeping back to the ground (three links). The head sits inside the scad's
// `translate([0, -3, 29]) rotate([-4, 0, 0]) scale(1.3)` (headF). Numbers are scad/petraptor.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, closest, ellD, fold, near, side, subFrame } from './lib/geo.mjs';

const SLATE = [0.38, 0.4, 0.48];
const TAN_DK = [0.62, 0.48, 0.32];

const headF = subFrame([0, -3, 29], [-4, 0, 0], 1.3);
const eyeL = { side: 'L', at: [1.9, -2.8, 0.85], size: 1.55, yaw: 40, flat: 0.5, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SLATE });

const TAIL = [[0, 4, 10], [0, 8, 6], [0, 12.4, 3.2], [0.6, 17, 1.4]];
const ROOTS = [[6.6, 1, 19], [9, 1.6, 19.2], [11.4, 1.4, 21.4], [13.6, 1, 23.6], [15.6, 1.2, 24], [17.4, 1, 23.8]];
const TIPS = [[6.6, 2.6, 8.4], [9.6, 3.2, 6.4], [12.4, 3.4, 5.4], [15.6, 3.2, 5.6], [18.6, 2.6, 7.4], [21, 2, 10.6]];
const SH = [4.4, 0, 22];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3.8, 0, 9] },
  { name: 'legR', parent: 'root', at: [-3.8, 0, 9] },
  { name: 'body', parent: 'root', at: [0, 1, 8] },
  { name: 'head', parent: 'body', at: [0, -1.2, 25.5] },
  { name: 'jaw', parent: 'head', at: headF.world([0, -3, -1.4]) },
  { name: 'wingL', parent: 'body', at: SH },
  { name: 'wingR', parent: 'body', at: [-SH[0], SH[1], SH[2]] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  ...face.joints,
];

const legD = (f) => Math.min(ellD(f, [3, 3.6, 4.2], [3.8, 0, 9]), capD(f, [4, 0, 7], [4.4, -0.4, 2], 2, 1.6), ellD(f, [2.6, 4.6, 1.6], [4.4, -2.4, 1.1]));
const wingD = (f) => Math.min(
  capD(f, SH, [9, 1, 19.6], 2.4, 1.9), capD(f, [9, 1, 19.6], [13.6, -0.6, 25], 1.9, 1.5), capD(f, [13.6, -0.6, 25], [17.6, 0.6, 24.6], 1.4, 0.8),
  ...ROOTS.map((r, i) => capD(f, r, TIPS[i], 2.1, 0.6)));

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (near(rgb, TAN_DK) && c[2] > 24) return 'jaw';
  if (c[2] > 25.8 && f[0] < 5.2 && !(f[0] > 4 && c[2] < 27 && wingD(f) < 1)) return 'head';
  const t = chainHit(c, TAIL, [3.4, 2.4, 1.4, 0.3]);
  if (c[1] > 7.4 && c[2] < 10 && f[0] < 4) return `tail${Math.min(3, t.i + 1)}`;
  if (c[1] > 4.5 && c[2] < 10.5 && f[0] < 3 && t.d < 1.25) return `tail${Math.min(3, t.i + 1)}`;
  return closest([
    ['body', Math.min(ellD(c, [6, 5.2, 6], [0, 1, 12.5]), ellD(c, [4.6, 4.2, 4.6], [0, -0.4, 19.5]),
      capD(c, [0, 0, 21], [0, -1, 25], 3.6, 3.2), ellD(c, [3.6, 1.6, 4.2], [0, -3.4, 18]))],
    [`leg${S}`, legD(f)],
    [`wing${S}`, wingD(f)],
  ]);
}

const jaw = (a) => ({ jaw: { r: [a, 0, 0] } });
const base = birdClips({
  face, tail: ['tail1', 'tail2', 'tail3'], flapUp: 40,
  add: {
    lunge: (t, u) => jaw(22 * K(u, [[0, 0.3], [0.3, 1], [0.42, 0], [1, 0]])),
    hurt: (t, u) => jaw(14 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])),
    celebrate: () => jaw(12),
    faint: (t, u) => jaw(10 * Math.min(1, u / 0.6)),
  },
});

const clips = {
  ...base,

  // fidget: throws its head back and screeches, the beak wide, the wings half raised and trembling
  idle_screech: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.66, 1], [0.84, 0]]);
      const tr = Math.sin(TAU * 12 * u) * win(u, 0.22, 0.66, 0.04);
      return merge({
        body: { r: [-6 * up, 0, 0] },
        head: { r: [-26 * up + 2 * tr, 0, 0] },
        ...jaw(28 * up),
        ...face.pose(up > 0.5 ? 'squeeze' : 'open'),
        wingL: { r: [0, -26 * up + 4 * tr, 0] },
        wingR: { r: [0, 26 * up - 4 * tr, 0] },
        tail1: { r: [-6 * up, 0, 0] },
      });
    },
  },

  // fidget: stretches one wing out wide and then the other, the crest tilting with it
  idle_stretch: {
    seconds: 2.8,
    pose: (t, u) => {
      const l = win(u, 0.06, 0.44, 0.12);
      const r = win(u, 0.52, 0.9, 0.12);
      return merge({
        body: { r: [0, 6 * r - 6 * l, 0] },
        head: { r: [0, 0, 14 * l - 14 * r] },
        ...face.pose('open', 0),
        wingL: { r: [-12 * l, -50 * l, 0] },
        wingR: { r: [-12 * r, 50 * r, 0] },
      }, { tail1: { r: [0, 0, 6 * osc(u, 1)] } });
    },
  },
};
delete clips.idle_preen;

export default rigDef({ joints, assign, extras: face.extras, clips });
