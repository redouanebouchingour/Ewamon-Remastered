// Petraptor's rig: a standing pterosaur. Thick legs off the root (the far one stepped out), a pear-shaped torso, a
// thick neck into the skull, which is turned 45 deg towards the creature's right (the scad's headFrame, rotate
// [0, 0, -45], authored with S()) and carries the crest, the beak and the darker lower bill (the jaw). Feathered wings
// hang from arms held out sideways, and a short tail sweeps back to the ground (three links). Numbers are
// scad/petraptor.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, closest, ellD, fold, near, side, subFrame } from './lib/geo.mjs';

const SLATE = [0.4, 0.4, 0.47];
const JAW = [0.68, 0.53, 0.35];

const HEAD_YAW = -45;
const headF = subFrame([0, 0, 0], [0, 0, HEAD_YAW], 1);
const S = (sx, z, x = 0) => [x, sx * 1.035 - 0.268 * x, z];
const eyeL = { side: 'L', at: [1.4, -1.9, 26.4], size: 1.5, yaw: 62, flat: 0.5, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SLATE });
// the eye kit places its joints in world terms; the head joint carries the head's yaw, so take it out again
const faceJoints = face.joints.map((j) => ({ ...j, rot: [j.rot[0], j.rot[1], j.rot[2] - HEAD_YAW] }));

const TAIL = [[0, 3.5, 10], [1.2, 7.5, 7.4], [2.6, 11.2, 5.2], [3.6, 14.2, 4]];
const TAIL_R = [3.2, 2.2, 1.3, 0.35];
const NECK = [[0, 0, 18.5], [0.1, 0.3, 22.5], [0.3, 0.6, 25.6]];
const NECK_R = [3.3, 2.9, 2.5];
const LEGS = {
  L: { hip: [3.9, 0.2, 9.2], ankle: [4.9, -0.4, 2.8], foot: [5.2, -1.4, 1.1], s: 1 },
  R: { hip: [-3.9, -0.4, 9], ankle: [-4.8, -3.8, 3], foot: [-5.4, -4.6, 1.15], s: -1 },
};
// the near wing (x > 0), as in the scad; W() reads a sheet point at depth y
const W = (sx, z, y) => [(sx - 0.5 * y) / 0.866, y, z];
const SH = [4, 0.5, 17.5];
const HAND = W(9, 16.2, -0.8);
const KNOB = W(10.2, 22.4, 1);
const ROOTS = [W(7.6, 17, 1), W(9.8, 18.6, 1.2), W(11.8, 19.6, 1.2), W(13.8, 18.4, 1.2), W(16, 15.2, 1.2)];
const TIPS = [W(7.6, 10, 1.8), W(10.9, 7.2, 2.2), W(14.2, 3.4, 2.4), W(17.4, 4, 2.4), W(18.3, 9, 2)];
const FW = [1.8, 2.15, 2.25, 2.15, 1.5];
const add = (a, b) => a.map((v, i) => v + b[i]);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEGS.L.hip },
  { name: 'legR', parent: 'root', at: LEGS.R.hip },
  { name: 'body', parent: 'root', at: [0, 0.6, 8] },
  { name: 'head', parent: 'body', at: [0.2, 0.5, 24.6], rot: [0, 0, HEAD_YAW] },
  { name: 'jaw', parent: 'head', at: headF.world(S(-0.6, 23.6)) },
  { name: 'wingL', parent: 'body', at: SH },
  { name: 'wingR', parent: 'body', at: [-SH[0], SH[1], SH[2]] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  ...faceJoints,
];

// a hull of ellipsoids [r, p], approximated by ellipsoids interpolated along each pair
const hullD = (c, parts) => {
  let d = Infinity;
  for (let i = 0; i < parts.length - 1; i++) for (let t = 0; t <= 1; t += 0.25) {
    d = Math.min(d, ellD(c, lerp(parts[i][0], parts[i + 1][0], t), lerp(parts[i][1], parts[i + 1][1], t)));
  }
  return d;
};
const headD = (h) => Math.min(
  hullD(h, [[[2.5, 3.6, 3], S(0.6, 27.6)], [[1.7, 1.6, 1.6], S(-4.2, 26.4)]]),
  hullD(h, [[[1.9, 1.8, 1.2], S(-2.8, 24.2)], [[2.15, 1.5, 1], S(1.4, 25.1)]]),
  hullD(h, [[[1.7, 1.6, 1.4], S(-1.6, 24.6)], [[1.2, 1.3, 1.4], S(-6.2, 25.3)], [[0.9, 0.9, 1], S(-7.6, 22.4)], [[0.3, 0.3, 0.3], S(-8.4, 20)]]),
  hullD(h, [[[1.5, 1.6, 1], S(-1.6, 23.2)], [[0.55, 0.5, 0.45], S(-6.4, 20.6)]]));
const legD = (c, L) => Math.min(
  ellD(c, [2.9, 3.4, 3.8], L.hip),
  capD(c, add(L.hip, [0.3 * L.s, -0.2, -2.2]), L.ankle, 1.8, 1.3),
  hullD(c, [[[1.3, 1.3, 1.3], L.ankle], [[1.8, 2.4, 1.05], L.foot]]),
  ...[-1, 0, 1].map((k) => capD(c, add(L.foot, [k * 1.2, -1.7, 0.2]), add(L.foot, [k * 1.7, -3.4, -0.85]), 0.78, 0.2)),
  capD(c, add(L.foot, [0, 1.8, 0.2]), add(L.foot, [0, 3, -0.5]), 0.5, 0.2));
const wingD = (f) => Math.min(
  capD(f, SH, W(6.6, 17.6, 0), 2, 1.6), capD(f, W(6.6, 17.6, 0), HAND, 1.6, 1.2),
  ...[-1, 0, 1].map((k) => capD(f, add(HAND, [k * 1.05, -0.4, -0.2]), add(HAND, [k * 1.1, -1.1, -2.6]), 0.6, 0.3)),
  capD(f, add(HAND, [0.4, 1, 0.4]), W(9.3, 19.2, 0.8), 0.9, 0.85), capD(f, W(9.3, 19.2, 0.8), KNOB, 0.85, 1.2),
  capD(f, KNOB, W(12.8, 20.4, 1.1), 1.2, 0.95), capD(f, W(12.8, 20.4, 1.1), W(16.2, 14.6, 1.2), 0.95, 0.65),
  ...ROOTS.map((r, i) => capD(f, r, TIPS[i], FW[i], 0.6)));
const bodyD = (c) => Math.min(
  hullD(c, [[[5, 4.6, 5.4], [0, 0.8, 11.8]], [[4.2, 3.8, 4], [0, 0, 17.2]]]),
  chainHit(c, NECK, NECK_R).d,
  ...[17.6, 19.7, 21.8, 23.8].map((z) => capD(fold(c), [1.3, 2.2, z], [3.2, 5.6, z + 0.5], 1.05, 0.3)));

function assign(c, rgb) {
  const S2 = side(c);
  if (near(rgb, JAW) && c[2] > 19) return 'jaw';
  if (c[2] > 26.8) return 'head';
  const t = chainHit(c, TAIL, TAIL_R);
  if (c[1] > 5.6 && c[2] < 10.5 && t.d < 1.4) return `tail${Math.min(3, t.i + 1)}`;
  return closest([
    ['head', c[2] > 19 ? headD(headF.local(c)) : Infinity],
    ['body', bodyD(c)],
    ['legL', legD(c, LEGS.L)],
    ['legR', legD(c, LEGS.R)],
    [`wing${S2}`, wingD(fold(c))],
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
