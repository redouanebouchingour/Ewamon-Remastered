// Clementar Majin's rig: Clementar's joints on the corrupted form (scad/clementar_majin.scad). The robe below the sash
// is its own joint (skirt, on the root) so the torn hem stays down while the body sways; the legs hang off the root
// from the hips. Each sleeve plus its bare forearm is one arm joint from the shoulder, and the hand (palm, fingers,
// the fruit cluster) bends at the wrist; the far arm has its own numbers (it is not a mirror). The head is built in
// Clementar's head frame and moved: headT() = translate(NECK + HT) rotate(HR) translate(-NECK). The vines follow
// the parts they coil round. Fidgets: it crushes a blood orange and glares.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, ell, inFrame, limb, mx, petal, pick, plate, ppFrame, fromSheet } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { rot, subFrame } from './lib/geo.mjs';

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const FUR_DK = [0.22, 0.12, 0.07];

// ---- the head frame (scad NECK, HT, HR) and its parts in Clementar's head coordinates
const NECK = [0, -2, 26.5];
const HT = [0, -3.4, -2.2];
const HR = [12, 0, 0];
const HF = subFrame(add(NECK, HT), HR);
const headWorld = (p) => HF.world(sub(p, NECK));
const HEAD = { local: (c) => add(HF.local(c), NECK) };
const SKULL = [[0, -2.8, 30.0], [4.8, 4.2, 3.5]];
const JAW = [[0, -4.6, 27.3], [3.0, 2.9, 2.2]];
const RUFF = [[3.6, -3.6, 27.8], [1.9, 1.7, 1.6]];
const MUZ1 = [[0, -6.0, 28.3], [2.4, 2.3, 1.95]];
const MUZ2 = [[0, -9.4, 28.1], [1.15, 1.1, 0.9]];
const NOSE = [[0, -10.4, 28.3], [0.75, 0.6, 0.55]];
const FEZ = [-0.8, -6.0, 30.0];
const FEZ_TOP = add(FEZ, rot([-4, 0, 0], [0, 0, 6.6]));

// two eyes, each eye() squashed about its centre by EYE_SQ inside the head frame
const EYE = [2.35, -6.0, 30.2];
const EYE_SQ = [1.2, 1, 0.8];
const eyeAt = (k) => {
  const at = [k * EYE[0], EYE[1], EYE[2]];
  const sq = subFrame(at.map((v, i) => v * (1 - EYE_SQ[i])), [0, 0, 0], EYE_SQ);
  return { side: k > 0 ? 'L' : 'R', at, size: 1.3, yaw: k * 24, flat: 0.5,
    frame: { world: (p) => headWorld(sq.world(p)), scale: sq.scale, rot: HR } };
};
const face = eyeKit({ eyes: [eyeAt(1), eyeAt(-1)], skin: FUR_DK, lid: [1.1, 1.0, 0.75] });

// ---- the ears: pp(d) translate(root) rotate([0, 0, a]) scale([1 / cos(a), 1, 1]) translate(-root) plate(pts)
const earFrame = (d, root, a) => {
  const pp = ppFrame(d);
  const f = subFrame(root, [0, 0, a], [1 / Math.cos((a * Math.PI) / 180), 1, 1]);
  return { local: (c) => add(f.local(pp.local(c)), root), world: (p) => pp.world(f.world(sub(p, root))) };
};
const NEAR_EAR = [[-0.4, 33.4], [2.0, 35.6], [4.5, 37.4], [6.6, 38.6], [8.9, 39.6], [8.8, 37.5], [8.3, 35.4], [8.4, 34.0],
  [7.6, 32.6], [7.2, 31.2], [6.0, 30.2], [5.6, 29.0], [4.0, 29.4], [2.0, 30.6], [0.5, 31.8]];
const FAR_EAR = [[-13.9, 40.0], [-11.6, 38.0], [-9.2, 36.0], [-7.0, 33.6], [-6.4, 32.0], [-7.0, 30.4], [-8.6, 28.8],
  [-9.6, 29.6], [-10.6, 31.0], [-11.8, 32.6], [-12.7, 34.6], [-13.2, 37.0]];
const EAR_L = earFrame(-6.8, [2.6, 0, 31.0], 15);
const EAR_R = earFrame(-3.4, [-7.6, 0, 31.0], -38);

// ---- arms: [shoulder, elbow, wrist, drape corners] (scad ARM_L / ARM_R), fruit [r, sheet x, z, depth], leaves
const ARM_L = [[6.5, -0.5, 22.2], [11.6, -1.5, 17.8], [15.0, -3.6, 22.8], [11.2, -1.3, 15.6], [7.4, -0.5, 16.4]];
const ARM_R = [[-7.5, -0.5, 22.2], [-12.4, -1.5, 17.8], [-13.6, -3.2, 21.4], [-13.8, -1.5, 15.0], [-8.6, -0.5, 15.4]];
const FRUIT_L = [[2.05, 12.5, 30.2, -4.4], [2.2, 10.6, 27.4, -4.6], [2.35, 15.4, 27.4, -4.2]];
const FRUIT_R = [[2.15, -13.9, 27.6, -3.6], [2.2, -18.1, 25.3, -3.0], [2.2, -13.9, 24.4, -4.6]];
const LEAF_L = [[13.2, 32.6, -4.4], [15.0, 32.4, -4.2], [16.9, 30.0, -4.2], [11.6, 32.4, -4.4]];
const LEAF_R = [[-17.2, 29.8, -3.2], [-15.4, 30.2, -3.4], [-13.9, 30.4, -3.6]];

// ---- legs [ankle, toe, hip] and the tail spine (sheet x, sheet z, depth, radius), 1.3 low like the scad
const LEG_L = [[8.4, 1.5, 0], [11.6, -1.8, 0], [5.4, 0.6, 9.0]];
const LEG_R = [[-7.0, -2.0, 0], [-11.4, -4.6, 0], [-4.4, -1.0, 9.0]];
const TAIL = [[5.5, 10.5, 4.5, 3.0], [9.5, 8.9, 6.0, 3.9], [13.8, 9.8, 7.0, 4.5], [16.6, 12.6, 7.4, 4.2],
  [17.3, 15.9, 7.4, 3.5], [17.8, 18.8, 7.2, 2.7], [18.5, 21.2, 7.0, 1.6], [19.0, 22.6, 7.0, 0.7]].map(([sx, z, d, r]) => [fromSheet(sx, z - 1.3, d), r]);
const TUFTS = [[18.6, 21.6], [19.8, 19.4], [20.4, 15.4], [20.4, 11.6], [19.0, 7.4], [14.8, 5.8], [16.4, 21.4], [14.6, 18.0]]
  .map(([sx, z]) => fromSheet(sx - 1.0, z - 1.3, 7.2));
const sashEndPts = [[-5.2, 15.8], [-7.5, 13.4], [-10.0, 11.6], [-12.4, 10.5], [-13.7, 9.6], [-13.0, 8.8], [-11.3, 9.0],
  [-9.5, 9.6], [-8.6, 8.6], [-7.8, 7.4], [-6.8, 7.6], [-6.6, 9.6], [-5.6, 11.6], [-4.4, 13.4], [-3.8, 14.8]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEG_L[2] },
  { name: 'legR', parent: 'root', at: LEG_R[2] },
  { name: 'skirt', parent: 'root', at: [0, 0, 14.3] },
  { name: 'body', parent: 'root', at: [0, 0, 14.3] },
  { name: 'head', parent: 'body', at: add(NECK, HT) },
  { name: 'earL', parent: 'head', at: EAR_L.world([2.6, 0, 31.2]) },
  { name: 'earR', parent: 'head', at: EAR_R.world([-7.6, 0, 30.6]) },
  { name: 'armL', parent: 'body', at: ARM_L[0] },
  { name: 'armR', parent: 'body', at: ARM_R[0] },
  { name: 'handL', parent: 'armL', at: ARM_L[2] },
  { name: 'handR', parent: 'armR', at: ARM_R[2] },
  { name: 'tail1', parent: 'skirt', at: TAIL[0][0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[3][0] },
  ...face.joints,
];

// the robe's hull: [z, rx, ry, x centre, y centre] rings, linear between them
const ROBE = [[5.6, 11.0, 7.8, -1.6, 0.6], [10, 9.4, 7.0, -1.2, 0.4], [14.8, 6.0, 4.8, -0.4, 0], [19, 6.8, 5.2, -0.5, 0],
  [23, 8.0, 5.6, -1.0, 0.3], [26.8, 5.6, 4.2, 0.4, 1.2]];
const robe = (c) => {
  const z = Math.min(ROBE[ROBE.length - 1][0], Math.max(ROBE[0][0], c[2]));
  let i = 0;
  while (i < ROBE.length - 2 && z > ROBE[i + 1][0]) i++;
  const [z0, ...a] = ROBE[i]; const [z1, ...b] = ROBE[i + 1];
  const k = (z - z0) / (z1 - z0);
  const [rx, ry, cx, cy] = a.map((v, j) => v + (b[j] - v) * k);
  const over = Math.abs(c[2] - z) / 1.4;
  return Math.hypot((c[0] - cx) / rx, (c[1] - cy) / ry) + over;
};
const arm = (A) => any(limb(A[0], A[1], 3.0, 2.4), limb(A[0], A[4], 3.0, 1.0), limb(A[1], A[3], 2.4, 1.0), limb(A[3], A[4], 1.4),
  limb(add(A[1], [0, -0.2, 0.4]), A[2], 1.35, 1.15));
const hand = (A, F, L) => any(ell([2.0, 1.8, 1.3], add(A[2], [0, -0.4, 1.0])), limb(add(A[2], [0, -0.8, 1.2]), add(A[2], [0, -2.0, 2.9]), 1.4),
  ...F.map(([r, sx, z, d]) => ell([r, r, r], fromSheet(sx, z, d))), ...L.map(([sx, z, d]) => ell([1.4, 1.4, 1.0], fromSheet(sx, z, d))));
const leg = ([ankle, toe, hip]) => any(limb(add(ankle, [0, 0, 2.3]), add(toe, [0, 0, 1.2]), 2.0, 1.5), limb(add(ankle, [0, 0, 2.4]), hip, 2.1, 2.5));

const parts = [
  ['body', any(robe, ell([2.6, 2.4, 2.6], [0, -5.0, 23.6]), plate(sashEndPts, 1.2, ppFrame(-2.6)))],
  ['head', any(inFrame(HEAD, any(ell(SKULL[1], SKULL[0]), ell(JAW[1], JAW[0]), mx(ell(RUFF[1], RUFF[0])), ell(MUZ1[1], MUZ1[0]),
    ell(MUZ2[1], MUZ2[0]), limb(MUZ1[0], MUZ2[0], 2.0, 1.0), ell(NOSE[1], NOSE[0]), limb([0, -5.2, 26.1], [0, -8.6, 24.7], 1.35, 0.75),
    mx(ell([1.6, 0.8, 1.2], EYE)), mx(petal([1.9, 0.55, 0.8], [4.7, -3.6, 27.3], [0, 35, -25])),
    mx(petal([1.5, 0.5, 0.65], [3.9, -3.2, 25.8], [0, 55, -20])), mx(limb([0.9, -6.95, 31.05], [3.0, -5.95, 31.8], 0.5)))),
  limb(FEZ, FEZ_TOP, 3.25, 2.75))],
  ['earL', plate(NEAR_EAR, 1.4, EAR_L)],
  ['earR', plate(FAR_EAR, 1.4, EAR_R)],
  ['armL', arm(ARM_L)], ['armR', arm(ARM_R)],
  ['handL', hand(ARM_L, FRUIT_L, LEAF_L)], ['handR', hand(ARM_R, FRUIT_R, LEAF_R)],
  ['legL', leg(LEG_L)], ['legR', leg(LEG_R)],
  ['tail1', any(...TAIL.slice(0, 3).map(([p, r], i) => limb(p, TAIL[i + 1][0], r, TAIL[i + 1][1])))],
  ['tail2', any(...TAIL.slice(3, -1).map(([p, r], i) => limb(p, TAIL[i + 4][0], r, TAIL[i + 4][1])), ...TUFTS.map((p) => ell([1.9, 1.5, 1.5], p)))],
];

/** assign(): nearest primitive; the robe and the sash end below the sash's lower edge hang on the skirt. */
const assign = (c) => {
  const j = pick(c, parts);
  return j === 'body' && c[2] < 14.3 ? 'skirt' : j;
};

// the hem sways a little behind the shuffle
const hem = (u, cycles, amp) => ({ skirt: { r: [0.4 * amp * osc(u, cycles * 2, 0.2), 0, amp * osc(u, cycles, 0.15)] } });

const clips = {
  ...bipedClips({
    face, tail: ['tail1', 'tail2'], hipH: 9, stride: 12, armSwing: 5, hopScale: 0.5, hopH: 1.5,
    punch: { arm: [-40, 0, -10] },
    cheer: { arm: [-10, -35, 0] },
    add: {
      idle: (t, u) => hem(u, 1, 0.6),
      walk: (t, u) => hem(u, 1, 2.5),
      idle_look: (t, u) => hem(u, 1, 0.8),
      celebrate: (t, u) => merge(hem(u, 2, 2), both('hand', { r: [0, 0, 20 * osc(u, 2)] })),
      lunge: (t, u) => hem(u, 1, 1.5),
      hurt: (t, u) => ({ skirt: { r: [-2 * K(u, [[0, 0], [0.2, 1], [1, 0]]), 0, 0] } }),
    },
  }),

  // fidget: squeezes the right cluster until it splits, the head lowered over it, ears back
  idle_crush: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.8, 1], [0.95, 0]]);
      const sq = win(u, 0.3, 0.62, 0.08);
      const sh = Math.sin(TAU * 14 * u) * sq;
      return {
        body: { r: [4 * on, 0, -4 * on] },
        head: { r: [10 * on, 0, -12 * on] },
        armR: { r: [-8 * on, 0, 12 * on] },
        handR: { s: [1 + 0.06 * sq, 1 + 0.06 * sq, 1 - 0.14 * sq], r: [-10 * on, 1.5 * sh, 0] },
        ...face.pose('open', 0.4 * on + 0.25 * sq),
        ...both('ear', { r: [16 * on, -8 * on, 0] }),
        ...hem(u, 1, 0.6),
      };
    },
  },

  // fidget: a slow turn of the head towards the camera side, lids lowering into a glare, ears flattening
  idle_glare: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.25, 1], [0.75, 1], [0.95, 0]]);
      return {
        body: { r: [3 * on, 0, 6 * on] },
        head: { r: [6 * on, 0, 20 * on] },
        ...both('ear', { r: [20 * on, -10 * on, 0] }),
        ...face.pose('open', 0.5 * on + blinks(u, [[0.86, 0.9]])),
        ...both('arm', { r: [4 * on, 5 * on, 0] }),
        ...hem(u, 1, 0.6),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
