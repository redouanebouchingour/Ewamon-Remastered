// Aonred's rig: a blue-flame spirit knight hovering on its own flame vortex: a pale fanged helm with red eyes, a blue
// fire phoenix rising from its crown, dark feather wings crested with blue flame, a fireball under each claw and a
// curling tail-sash. Floater template; the vortex base turns slowly under it. Numbers are scad/aonred.scad's
// (remodelled on the sprite 2026-11-03).
import { both, merge, osc, rigDef, smooth, win, K, TAU } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side, unrot } from './lib/geo.mjs';

const SHADE = [0.14, 0.14, 0.17];
const SHADE_HI = [0.24, 0.25, 0.26];
const INK = [0.06, 0.08, 0.12];
const SILVER = [0.5, 0.66, 0.8];
const SILVER_HI = [0.76, 0.87, 0.95];
const FLAMES = [[0.05, 0.24, 0.56], [0.17, 0.47, 0.82], [0.44, 0.76, 0.97], [0.07, 0.31, 0.82]];
const ORB_MID = [0.04, 0.16, 0.48];
const EYE = [[0.88, 0.14, 0.12], [0.16, 0.04, 0.06]];
const MARK = [0.55, 0.08, 0.08];

const eyeL = { side: 'L', at: [1.75, -7.15, 24.55], size: 0.72, yaw: 22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'head', skin: SILVER });

const TAIL = [[0, 3.4, 17], [4, 6.6, 15.6], [8.6, 7.4, 15.8], [12.4, 5.4, 17.2]];
const TAIL_R = [2, 1.6, 1.05, 0.25];
const tail = ['tail1', 'tail2', 'tail3'];
const wisp = ['wisp1', 'wisp2', 'wisp3'];

const ARM = [[5.6, 0, 22.2], [8.6, -1.8, 18.6], [14.2, -2.4, 18.2]];
const ARM_R = [1.45, 1.25, 1.15];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 14] },
  { name: 'vortex', parent: 'body', at: [0, 0, 3] },
  { name: 'head', parent: 'body', at: [0, -3.4, 21.6] },
  { name: 'wisp1', parent: 'head', at: [0, -3.2, 29.6] },
  { name: 'wisp2', parent: 'wisp1', at: [0, -5.2, 33.4] },
  { name: 'wisp3', parent: 'wisp2', at: [0, -4.6, 35.4] },
  { name: 'wingL', parent: 'body', at: [5.6, 1.6, 24.2] },
  { name: 'wingR', parent: 'body', at: [-5.6, 1.6, 24.2] },
  { name: 'armL', parent: 'body', at: ARM[0] },
  { name: 'handL', parent: 'armL', at: ARM[2] },
  { name: 'armR', parent: 'body', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
  { name: 'handR', parent: 'armR', at: [-ARM[2][0], ARM[2][1], ARM[2][2]] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

// the wing's own frame: translate([5, 2.2, 0]) rotate([0, 0, -10]) translate([-5, 0, 0]) (on the folded +X side)
const wingLocal = (f) => {
  const q = unrot([0, 0, -10], [f[0] - 5, f[1] - 2.2, f[2]]);
  return [q[0] + 5, q[1], q[2]];
};
const WING_TIPS = [[15.8, 34.8], [17.8, 31.4], [18.6, 28.4], [18.4, 25.6], [17.4, 22.6], [13.4, 21]];
function wingD(f) {
  const w = wingLocal(f);
  if (Math.abs(w[1]) > 2.6) return Infinity;
  // feathers and the fan in the XZ plane, the flame tongues rising off the top edge (up to about 6 units)
  const fe = Math.min(...WING_TIPS.map((t) => capD([w[0], 0, w[2]], [5.6, 0, 24], [t[0], 0, t[1]], 1.6, 0.6)));
  const top = w[2] > 23 && w[0] > 3.4 && w[0] < 21 && w[2] < 42 ? 1 : Infinity;
  return Math.min(fe, top);
}

// the phoenix: neck (wisp1), the bird's head (wisp2), the plume streaming up and back (wisp3)
const PLUME = [
  [[0, -5.6, 35.6], [0, -3.6, 37.8], [0.4, -0.8, 39.2], [0, 2.6, 40]], [[0, -3.2, 33.6], [0, 0.8, 35.6], [0, 4.8, 37.2], [0, 8, 38.6]],
  [[0, -4.4, 35.4], [0, -1.6, 36.8], [-0.3, 1.6, 37.6], [0, 4.6, 38.6]], [[1, -4.5, 35], [2.6, -2, 37], [3.4, 0.8, 38.5], [3, 3.6, 39.2]],
];
const PLUME_R = [[1.5, 1.3, 0.9, 0.2], [2, 1.8, 1.2, 0.2], [1, 0.9, 0.6, 0.15], [1.1, 1, 0.7, 0.15]];
const NECK_FL = [[[1.2, -3, 31.5], [3.2, -1.4, 33], [4.8, 0.6, 34.6], [5.4, 2.6, 36.4]], [[1.2, -2.4, 30.2], [3.2, -0.6, 30.8], [5, 1.2, 32], [5.6, 2.8, 33.4]]];
const NECK_FL_R = [[1.3, 1.1, 0.7, 0.15], [0.9, 0.8, 0.5, 0.12]];
function phoenix(c, f) {
  return closest([
    ['wisp1', Math.min(blobD(c, [[[1.9, 2, 2.2], [0, -3.4, 31]], [[1.5, 1.8, 1.5], [0, -5.4, 33.6]]]),
      ...NECK_FL.map((p, i) => chainHit(f, p, NECK_FL_R[i]).d))],
    ['wisp2', Math.min(ellD(c, [1.7, 2.3, 1.6], [0, -6.6, 34.8]), capD(c, [0, -8.4, 34.7], [0, -10.3, 33.5], 0.7, 0.1),
      ellD(c, [0.9, 1.3, 0.8], [0, -6.4, 35.8]))],
    ['wisp3', Math.min(...PLUME.map((p, i) => chainHit(i === 3 ? f : c, p, PLUME_R[i]).d))],
  ]);
}

const HEAD = [[[3.7, 3.4, 3.7], [0, -4.8, 26.4]], [[2.8, 2.6, 1.8], [0, -4.2, 29.3]]];
const JAW = [[[3.4, 2.8, 2], [0, -5.2, 20.6]], [[2.1, 2, 1.1], [0, -5.6, 18.3]]];
const headD = (c) => Math.min(blobD(c, HEAD), blobD(c, JAW), ellD(c, [2.7, 2.2, 1.5], [0, -5.6, 22.8]));
const torsoD = (c, f) => Math.min(
  blobD(c, [[[5.4, 4, 3.8], [0, 0, 19.5]], [[4.2, 3.4, 2.6], [0, 0, 15.8]]]),
  ellD(f, [2.8, 2.6, 2.3], [5.2, 0.4, 22.2]),
  capD(f, [5.6, 0.2, 24], [6.2, 0.6, 26], 0.8, 0.1),
  capD(f, [4.4, -2.9, 22], [1, -4, 15.8], 0.32, 0.3),
);
const armD = (f) => Math.min(chainHit(f, ARM.slice(0, 2), ARM_R.slice(0, 2)).d, capD(f, ARM[1], ARM[2], 1.25, 1.15),
  capD(f, [8.6, -1.6, 19.4], [8, -1.4, 21.8], 0.7, 0.1), capD(f, [13.4, -2.2, 19], [14.2, -1.9, 21.4], 0.6, 0.1),
  ellD(f, [0.8, 0.7, 0.8], [12.8, -3.5, 18.9]), ellD(f, [1.6, 1.6, 1.6], [12.6, -2.3, 18.3]));
const handD = (f) => Math.min(ellD(f, [1.7, 1.6, 1.3], [15.2, -2.8, 16.8]), ellD(f, [3.1, 3.1, 3.1], [15.6, -3.4, 13]),
  ...[-1.3, 0, 1.3].map((dx) => chainHit(f, [[15.2 + dx * 0.8, -3.6, 17.2], [15.5 + dx, -5.7, 15.6], [15.5 + dx * 1.1, -6.6, 13.8]], [0.6, 0.45, 0.12]).d));

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  const r = Math.hypot(c[0], c[1]);
  const hand = f[0] > 10.5 && c[2] > 8.8 && c[2] < 19 && c[1] < 1;
  if (isAny(rgb, EYE) || near(rgb, MARK)) return 'head';
  if (near(rgb, ORB_MID)) return `hand${S}`;
  // the vortex: column, disc, spiral arms and rim flames
  if ((isAny(rgb, FLAMES) || near(rgb, INK)) && c[2] < 13.4 && r < 15 && !hand) return 'vortex';
  if (isAny(rgb, FLAMES)) {
    if (hand) return `hand${S}`;
    if (f[0] < 1.2 && c[1] < -7.2 && c[2] < 30.5) return 'head';             // brow gem and the crest's flame inlay
    if (c[1] > 3.4 && c[2] < 25 && f[0] < 2.5) return 'body';                 // the gem on its back
    if (near(rgb, FLAMES[3]) && c[2] < 20) return `arm${S}`;                  // wrist gem
    if (c[2] > 29.5 && (f[0] < 4 || (f[0] < 6.4 && c[1] > -3.4 && wingD(f) > 1.2))) return phoenix(c, f);
    return `wing${S}`;
  }
  if (near(rgb, INK)) {
    if (c[2] > 33) return 'wisp2';                                             // the bird's eyes
    return 'head';                                                             // helm bands and jaw seams
  }
  if (near(rgb, SILVER_HI)) return 'head';                                    // fangs and crown
  if (near(rgb, SILVER)) {
    if (f[0] > 10) return `arm${S}`;                                           // wrist band
    if (c[2] < 16) return 'body';                                              // skirt rims and waist ring
    return closest([['head', headD(c)], ['body', Math.min(torsoD(c, f), ellD(c, [2.4, 1.2, 2.4], [0, 4.1, 23]),
      ...[1, -1].map((s) => capD(c, [1.6 * s, 4.3, 21.4], [3 * s, 3.6, 18.2], 0.3, 0.25)))]]);
  }
  // dark armour: torso, skirt, pauldrons, arms, hands, wings, tail
  if (c[2] < 13.8) return 'body';
  const t = chainHit(c, TAIL, TAIL_R);
  return closest([
    ['body', torsoD(c, f)],
    [`arm${S}`, armD(f)],
    [`hand${S}`, handD(f)],
    [`wing${S}`, wingD(f) * 1.05],
    [tail[Math.min(2, t.i)], t.d],
  ]);
}

// the wings beat slowly, open for the strike and the cheer; the vortex turns under it
// open > 0 lifts the tips (ry < 0 on the +X wing) and sweeps them back (rz > 0); beat flaps them up and down
const wings = (open, beat = 0) => both('wing', { r: [0, -(open * 0.6 + beat), open * 0.4] });
const spin = (u) => ({ vortex: { r: [0, 0, -120 * u] } });           // a third of a turn per loop: the spiral is 3-fold
const drift = (t) => ({ vortex: { r: [0, 0, -30 * t] } });
const add = {
  idle: (t, u) => merge(wings(0, 5 * osc(u, 2)), spin(u)),
  walk: (t, u) => merge(wings(-6, 6 * osc(u, 2)), spin(u)),
  idle_spin: (t, u) => merge(wings(6 * win(u, 0.1, 0.85, 0.1), 4 * osc(u, 4)), spin(u)),
  idle_cackle: (t, u) => merge(wings(4 * win(u, 0.08, 0.85, 0.08), 6 * osc(u, 8)), spin(u)),
  windup: (t, u) => merge(wings(14 * smooth(u / 0.8)), drift(t)),
  lunge: (t, u) => merge(wings(14 * K(u, [[0, 1], [0.3, 1], [0.5, -0.3], [1, 0]])), drift(t)),
  hurt: (t, u) => merge(wings(-10 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])), drift(t)),
  recoil: (t) => drift(t),
  faint: (t, u) => merge(wings(-14 * smooth((u - 0.2) / 0.6)), drift(t)),
  celebrate: (t, u) => merge(wings(16, 10 * Math.sin(TAU * 3 * u)), drift(t)),
  enter: (t, u) => merge(wings(18 * win(u, 0.35, 0.95, 0.15)), drift(t)),
  exit: (t) => drift(t),
};

const base = floaterClips({ face, tail, wisp, bob: 0.8, add });

const clips = {
  ...base,
  // fidget: spreads the burning wings wide and raises both fireballs, the phoenix rearing and crying out
  idle_spread: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.9, 0]]);
      const cry = win(u, 0.35, 0.6, 0.06);
      return merge({
        body: { p: [0, 0, 0.8 * on], r: [-5 * on, 0, 0] },
        head: { r: [-8 * on, 0, 0] },
        ...wings(22 * on, 4 * osc(u, 4) * on),
        ...both('arm', { r: [0, -25 * on, 0] }),
        wisp1: { r: [-10 * on, 0, 0] },
        wisp2: { r: [-12 * on + 8 * cry, 0, 0] },
        wisp3: { r: [-16 * cry, 0, 4 * osc(u, 8) * cry] },
        ...face.pose('open'),
        ...spin(u),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * osc(u, 2, -0.1 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
