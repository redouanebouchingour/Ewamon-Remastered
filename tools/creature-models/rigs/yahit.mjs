// Yahit's rig: a grub-like worm standing on its segmented tail-body, the upper lump is its head, a top hat on top, a
// monocle and two thin arms ending in huge boxing gloves. Numbers are scad/yahit.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, isAny, near } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const SKIN = [0.55, 0.43, 0.38];
const SEGS = [[0.58, 0.55, 0.45], [0.42, 0.4, 0.33]];
const HAT = [[0.15, 0.15, 0.16], [0.5, 0.1, 0.12]];
const GLOVE = [[0.86, 0.15, 0.13], [1, 0.4, 0.38]];
const LACE = [0.97, 0.97, 0.97];

const face = eyeKit({
  eyes: [{ side: 'R', at: [-4.8, -6.6, 28], size: 1.5, yaw: 25 }, { side: 'L', at: [3, -7.4, 28], size: 1.6, yaw: -15 }],
  skin: SKIN,
});
const spine = ['spine1', 'spine2'];
const ARM = (s) => [[s * 8, -1, 22], [s * 12.5, -2, 19], [s * 14.5, -4, 24]];

const joints = [
  { name: 'root', at: [0, 0.5, 0] },
  { name: 'spine1', parent: 'root', at: [0, 0.5, 6] },
  { name: 'spine2', parent: 'spine1', at: [0, 0.5, 12] },
  { name: 'head', parent: 'spine2', at: [0, 0, 18] },
  { name: 'hat', parent: 'head', at: [0, 0, 32] },
  { name: 'armL', parent: 'head', at: ARM(1)[0] },
  { name: 'foreL', parent: 'armL', at: ARM(1)[1] },
  { name: 'armR', parent: 'head', at: ARM(-1)[0] },
  { name: 'foreR', parent: 'armR', at: ARM(-1)[1] },
  ...face.joints,
];

const byZ = (z) => (z < 6 ? 'root' : z < 12 ? 'spine1' : 'spine2');

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  const s = c[0] >= 0 ? 1 : -1;
  if (isAny(rgb, HAT) && c[2] > 31.5) return 'hat';
  if (isAny(rgb, GLOVE) || near(rgb, LACE)) return `fore${S}`;
  if (isAny(rgb, SEGS)) return byZ(c[2]);
  const a = ARM(s);
  return closest([
    ['head', Math.min(blobD(c, [[[10.5, 8.5, 7], [0, 0, 23]], [[8.5, 7.5, 5.5], [0, -1.5, 27]]]),
      blobD(c, [[[5, 4.5, 3.6], [-1.5, -6.5, 24]], [[3.2, 3, 2.6], [-3, -9, 23.5]]]), ellD(c, [3, 1.5, 3], [3, -8.4, 28]),
      chainHit(c, [[5.3, -8.2, 27], [7, -7, 25], [8.2, -5, 25.5]], [0.6, 0.6, 0.6]).d)],
    [`arm${S}`, capD(c, a[0], a[1], 1.5, 1.4)],
    [`fore${S}`, capD(c, a[1], a[2], 1.4, 1.5)],
  ]);
}

const hatBob = (amp, cycles, u) => ({ hat: { r: [amp * osc(u, cycles, 0.2), 0, 0.5 * amp * osc(u, cycles / 2, 0.4)] } });

const base = serpentClips({
  face, spine,
  add: {
    idle: (t, u) => hatBob(1.5, 2, u),
    walk: (t, u) => hatBob(4, 2, u),
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.3]]); return { hat: { p: [0, 0, 2 * k], r: [-16 * k, 0, 10 * k] } }; },
    celebrate: (t, u) => hatBob(8, 2, u),
    // a straight right jab on the hit
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return { armR: { r: [-40 * hit, 0, -30 * hit] }, foreR: { r: [-30 * hit, 0, 0] } }; },
  },
});

const clips = {
  ...base,

  // fidget: shadowboxing, a left-right-left of quick jabs, the head bobbing
  idle_shadowbox: {
    seconds: 2,
    pose: (t, u) => {
      const jab = (a, b) => K(u, [[a, 0], [a + 0.06, 1], [b, 0]]);
      const l1 = jab(0.15, 0.3); const r1 = jab(0.35, 0.5); const l2 = jab(0.55, 0.7);
      return merge({
        head: { r: [3 * osc(u, 4), 0, 6 * (r1 - l1 - l2)] },
        armL: { r: [-40 * (l1 + l2), 0, 30 * (l1 + l2)] },
        foreL: { r: [-30 * (l1 + l2), 0, 0] },
        armR: { r: [-40 * r1, 0, -30 * r1] },
        foreR: { r: [-30 * r1, 0, 0] },
        ...face.pose('open', 0.3 * win(u, 0.12, 0.75, 0.05)),
      }, hatBob(2, 4, u));
    },
  },

  // fidget: lifts its hat with the left glove, a polite bow, and sets it back down
  idle_hattip: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.88, 0]]);
      const bow = win(u, 0.3, 0.66, 0.08);
      return {
        spine2: { r: [8 * bow, 0, 0] },
        head: { r: [10 * bow, 0, 0] },
        armL: { r: [-30 * up, -40 * up, 0] },
        foreL: { r: [-20 * up, 0, 0] },
        hat: { p: [0, 0, 3 * up], r: [-10 * bow, 0, 0] },
        ...face.pose(bow > 0.5 ? 'happy' : 'open'),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
