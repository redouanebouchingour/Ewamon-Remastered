// Raikitsune's rig: a crouched thunder fox, a crackling orb held out in its right paw (the orb rides the forearm and
// spins on its own joint), scarf ribbons that flutter, and nine big tails fanned in the picture plane behind it, each
// on its own joint off the hips so they sway, fan wide and fold. Numbers are scad/raikitsune.scad's.
import { K, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, ppFrame, slab, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, closest, isAny, subFrame } from './lib/geo.mjs';

const FUR = [0.88, 0.38, 0.06];
const ORB_COLS = [[0.3, 0.78, 1], [0.93, 1, 1]];
const EYE_COLS = [[0.62, 0.94, 0.94], [0.08, 0.6, 0.85], [0.03, 0.08, 0.2]];
const BOLT_PALE = [0.72, 0.97, 0.98];
const ORB_C = [-12.1, -8.1, 19.6];
const D = Math.PI / 180;

// the head block: translate(H) rotate([0, 0, HY]) scale(HS)
const HF = subFrame([0.9, -1.2, 27.7], [0, 0, -25], 1.28);
const PP = ppFrame(0);
const RIB = ppFrame(-2.2);

// the tails, in the pp frame: tip x, tip z, half-width, bend, tip depth (scad TAILS)
const RT = [1.75, 5.5, 11.5];
const TK = 0.7;
const TAILS = [
  [-22.5, 13.5, 3.9, 1.2, 4.5], [-22.2, 29, 4.4, 1.8, 6], [-18.6, 36, 4.3, 1.2, 7.5], [-10.2, 38.6, 4.1, 1.0, 8.5],
  [5, 39.6, 4.0, -1.0, 9], [19.6, 33.6, 4.3, -1.2, 7.5], [22.2, 26, 4.4, -1.8, 6.5], [22.2, 11, 3.9, -1.2, 4.5],
  [12.8, 4.6, 3.0, -1.5, 3],
];
const US = [0, 0.2, 0.5, 0.76, 0.88, 1];
const RS = [0.5, 0.85, 1, 0.9, 0.6, 0.14];
const tailPts = (t) => {
  const dx = t[0] - RT[0]; const dz = t[1] - RT[2];
  const L = Math.hypot(dx, dz);
  const n = [-dz / L, dx / L];
  return US.map((u) => {
    const b = t[3] * Math.sin(Math.PI * u);
    return [RT[0] + dx * u + n[0] * b, RT[1] + (t[4] - RT[1]) * u, RT[2] + dz * u + n[1] * b];
  });
};
const fans = TAILS.map((_, i) => `fan${i + 1}`);
// each tail's angle from straight up in the fan's plane (deg, + to the viewer's right): which way "spread" turns it
const ANG = TAILS.map((t) => Math.atan2(t[0] - RT[0], t[1] - RT[2]) / D);
// distance to tail i, in the pp frame with the depth un-squashed so its flattened balls are round
const tailD = (i) => {
  const pts = tailPts(TAILS[i]).map((p) => [p[0], p[1] / TK, p[2]]);
  const rs = RS.map((r) => r * TAILS[i][2]);
  return (c) => {
    const q = PP.local(c);
    const s = [q[0], q[1] / TK, q[2]];
    let best = Infinity;
    for (let k = 0; k < pts.length - 1; k++) best = Math.min(best, capD(s, pts[k], pts[k + 1], rs[k], rs[k + 1]));
    return best;
  };
};

const eyeL = { side: 'L', at: [1.6, -2.6, 0.5], size: 0.92, yaw: 28, flat: 0.45, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const EAR_BASE = [2.0, 0.2, 2.3];
const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.0, 0.4, 11]),
  { name: 'body', parent: 'root', at: [0, 0, 11] },
  { name: 'head', parent: 'body', at: [0.5, -0.8, 24.2] },
  { name: 'earL', parent: 'head', at: HF.world(EAR_BASE), rot: [0, 0, -25] },
  { name: 'earR', parent: 'head', at: HF.world([-EAR_BASE[0], EAR_BASE[1], EAR_BASE[2]]), rot: [0, 0, -25] },
  { name: 'scarf', parent: 'body', at: RIB.world([4.5, 0, 24]), rot: [0, 0, 30] },
  { name: 'armL', parent: 'body', at: [3.4, -0.4, 20.8] },
  { name: 'foreL', parent: 'armL', at: [6.4, -1.2, 15.6] },
  { name: 'armR', parent: 'body', at: [-3.4, -0.4, 20.8] },
  { name: 'foreR', parent: 'armR', at: [-6.6, -4.2, 18.2] },
  { name: 'orb', parent: 'foreR', at: ORB_C },
  ...fans.map((name) => ({ name, parent: 'body', at: PP.world(RT), rot: [0, 0, 30] })),
  ...face.joints,
];

const RIB_UP = [[4.2, 24.2], [4.5, 25.6], [6, 29], [7.4, 30], [7, 28.3], [10.4, 27.5], [12, 26.5], [9.1, 24.4], [5.3, 23.6]];
const RIB_LO = [[4.6, 23.3], [7, 22.9], [8.5, 21.9], [11.5, 22.3], [14.1, 22.5], [15.4, 22], [16.7, 23.5], [17.1, 21.6], [18.1, 20.4],
  [16, 20.8], [15.4, 19.1], [15, 20.2], [13.3, 21.2], [11.8, 21.4], [8.9, 20.6], [5.2, 22.4]];

// the head block's primitives, in its own (unscaled) numbers
const headTest = any(
  blob([[[3.3, 3.1, 2.9], [0, 0, 0.2]], [[2.4, 2.2, 2.0], [0, -1.6, -0.8]]]),
  blob([[[1.9, 1.8, 1.5], [0, -2.6, -0.9]], [[0.85, 0.95, 0.8], [0, -5.7, -1.1]]]),
  blob([[[2.7, 2.4, 1.9], [0, -1.4, -1.2]], [[1.95, 1.85, 1.45], [0, -2.7, -1.0]]]),
  mx(limb([2.6, -0.6, -1.3], [4.3, 0.5, -2.1], 1.0, 0.25)),
  ell([0.55, 0.45, 0.45], [0, -6.4, -0.85]),
  mx(ell([1.3, 0.6, 0.95], [1.6, -2.45, 0.5])),
  mx(limb([0.55, -3.1, 1.25], [2.6, -1.8, 2.2], 0.45)),
);
const earTest = any(limb(EAR_BASE, [4.1, 0.6, 7.6], 1.7, 0.4), limb([2.2, -0.6, 3.0], [3.2, 0, 4.7], 0.9, 0.25));

const parts = [
  ['leg*', any(limb([3.0, 0.4, 11], [6.6, -1.6, 6.6], 3.3, 2.4), ell([3.0, 3.2, 3.2], [3.4, -0.2, 10.2]), limb([5.0, -0.6, 8.8], [6.6, -1.6, 6.6], 2.5, 2.35),
    limb([6.6, -1.6, 6.6], [8.2, -1.4, 2.0], 2.1, 1.5), blob([[[2.1, 2.3, 1.3], [8.6, -1.8, 1.3]], [[2.0, 1.6, 1.1], [9.6, -4.0, 1.1]]]),
    spike([9.6, -5.2, 0.8], [0, -1.4, -0.5], 1.6), ell([0.9, 0.45, 1.5], [7.5, -2.9, 4.2]))],
  ['body', any(blob([[[3.5, 3.2, 3.0], [0, 0.6, 12]], [[3.6, 3.0, 3.4], [0, -0.6, 18]], [[2.6, 2.4, 2], [0.2, -0.8, 22]]]),
    ell([2.3, 2.2, 2.4], [0.5, -0.8, 24.5]), ell([1.2, 0.6, 1.2], [-0.2, -3.4, 19.4]),
    blob([[[4.4, 3.9, 1.5], [0.2, -0.9, 23.2]], [[2.6, 1.1, 1.3], [-0.3, -3.0, 21.9]]]), limb([-3.4, -2.6, 22.6], [-6.2, -3.6, 21.4], 1.1, 0.6))],
  ['scarf', any(slab(RIB_UP, 1.4, 0.8, RIB), slab(RIB_LO, 1.4, 0.8, RIB))],
  ['armL', limb([3.4, -0.4, 20.8], [6.4, -1.2, 15.6], 1.5, 1.25)],
  ['foreL', any(limb([6.4, -1.2, 15.6], [7.2, -2.4, 10.8], 1.2, 1.0), ell([1.15, 1.3, 1.0], [7.4, -2.8, 10.0]), spike([7.4, -3.6, 9.4], [0, -0.7, -1.0], 0.9),
    limb([7.2, -1.0, 14.8], [7.8, -2.0, 11.6], 1.0, 0.8), spike([6.8, -0.9, 16.0], [0.6, 0.9, 4.2], 0.6), spike([7.6, -1.3, 13.4], [1.4, 0.6, 2.4], 0.45))],
  ['armR', limb([-3.4, -0.4, 20.8], [-6.6, -4.2, 18.2], 1.5, 1.25)],
  ['foreR', any(limb([-6.6, -4.2, 18.2], [-9.4, -6.8, 17.2], 1.2, 1.0), ell([1.25, 1.25, 1.1], [-10.1, -7.4, 17.3]), spike([-10.8, -8.1, 17.3], [-0.4, -0.4, 1.2], 1.0))],
  ...TAILS.map((_, i) => [fans[i], tailD(i)]),
];

function assign(c, rgb) {
  if (isAny(rgb, ORB_COLS, 0.03)) return 'orb';
  // the crackles round the orb spin with it; the tails' own bolts go with their tail
  if (isAny(rgb, [BOLT_PALE], 0.03) && Math.hypot(c[0] - ORB_C[0], c[1] - ORB_C[1], c[2] - ORB_C[2]) < 6.4) return 'orb';
  if (isAny(rgb, EYE_COLS, 0.03)) return 'head';
  // head and ears in the head's own frame; ears mirror in that frame
  const q = HF.local(c);
  const f = [Math.abs(q[0]), q[1], q[2]];
  const S = c[0] >= 0 ? 'L' : 'R';
  const fc = [Math.abs(c[0]), c[1], c[2]];
  const list = parts.map(([n, t]) => (n.endsWith('*') ? [n.slice(0, -1) + S, t(fc)] : [n, t(c)]));
  list.push(['head', headTest(q)], [q[0] >= 0 ? 'earL' : 'earR', earTest(f)]);
  return closest(list);
}

// the fan: each tail sways on its own phase; `spread` fans them wider (ry in the fan's plane), `lift` swings them back
const fan = (u, cycles = 1, amp = 1, spread = 0, lift = 0) => Object.fromEntries(ANG.map((a, i) => [fans[i], {
  r: [lift + 3 * amp * osc(u, cycles, -0.07 * i), spread * Math.sign(a) * Math.min(1, Math.abs(a) / 52) + 3 * amp * osc(u, cycles, 0.25 - 0.07 * i), 0],
}]));
const flutter = (u, cycles = 2, amp = 1) => ({ scarf: { r: [6 * amp * osc(u, cycles), 0, 8 * amp * osc(u, cycles, 0.25)] } });
const spin = (u, turns = 1) => ({ orb: { r: [0, 72 * turns * u, 0] } });

const base = bipedClips({
  face, hipH: 11, stride: 18, armSwing: 14, hopScale: 1, hopH: 4,
  // the orb thrust out in front: the right arm swings forward about the shoulder
  punch: { arm: [-20, 0, 35], fore: [0, 0, 15] },
  add: {
    idle: (t, u) => merge(fan(u, 2), flutter(u, 4, 0.6), spin(u, 5)),
    walk: (t, u) => merge(fan(u, 1, 1.4, 0, 6), flutter(u, 2, 1.4), spin(u, 1)),
    idle_look: (t, u) => merge(fan(u, 1), flutter(u, 2), spin(u, 3)),
    windup: (t, u) => merge(fan(u, 0, 0, 10 * u, -4 * u), spin(u, 1), { orb: { s: 1 + 0.25 * u } }),
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return merge(fan(u, 0, 0, 10 - 6 * hit, 6 * hit), spin(u, 2), flutter(u, 1, 2), { orb: { s: 1.25 + 0.25 * hit } }); },
    hurt: (t, u) => merge(fan(u, 2, 3, -8 * u), flutter(u, 2, 2), spin(u, 1)),
    recoil: (t, u) => fan(u, 1, 1.5),
    faint: (t, u) => { const d = Math.min(1, u / 0.7); return merge(fan(u, 0, 0, -16 * d, 12 * d), { orb: { s: 1 - 0.5 * d } }); },
    celebrate: (t, u) => merge(fan(u, 2, 3, 12 * win(u, 0, 1, 0.15)), flutter(u, 2, 2), spin(u, 2)),
    enter: (t, u) => merge(fan(u, 0, 0, -20 * (1 - Math.min(1, u / 0.6)) + 8 * win(u, 0.5, 0.9, 0.12)), spin(u, 1)),
    exit: (t, u) => merge(fan(u, 1, 1.5), flutter(u, 1, 1.4), spin(u, 1)),
  },
});

const clips = {
  ...base,

  // fidget: the nine tails fan out wide one after another like a peacock, crackle, then fold back
  idle_fan: {
    seconds: 2.6,
    pose: (t, u) => {
      const open = (i) => K(u, [[0, 0], [0.1 + 0.04 * i, 0], [0.25 + 0.04 * i, 1], [0.7, 1], [0.9, 0]]);
      const tails = Object.fromEntries(ANG.map((a, i) => [fans[i], { r: [-6 * open(i), 16 * Math.sign(a) * Math.min(1, Math.abs(a) / 52) * open(i) + 2 * osc(u, 4, 0.1 * i) * open(i), 0] }]));
      const on = open(4);
      return merge(tails, {
        body: { r: [-3 * on, 0, 0] },
        head: { r: [-8 * on, 0, 10 * on] },
        ...face.pose(on > 0.5 ? 'happy' : 'open'),
        ...both('ear', { r: [-10 * on, 0, 0] }),
      }, flutter(u, 2), spin(u, 4), { orb: { s: 1 + 0.15 * Math.abs(osc(u, 6)) * on } });
    },
  },

  // fidget: a little toss of the orb up out of its right paw and a catch
  idle_toss: {
    seconds: 1.8,
    pose: (t, u) => {
      const up = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.2) / 0.45))));
      const bob = win(u, 0.1, 0.3, 0.04) + win(u, 0.6, 0.8, 0.04);
      return merge({
        head: { r: [-12 * up, 0, -10 * up] },
        ...face.pose('open', blinks(u, [[0.85, 0.9]])),
        armR: { r: [0, 8 * bob, 0] }, foreR: { r: [0, 0, -10 * bob] },
        orb: { p: [0, 0, 7 * up], r: [0, 360 * u, 0] },
        ...both('ear', { r: [-8 * up, 0, 0] }),
      }, fan(u, 1), flutter(u, 2));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
