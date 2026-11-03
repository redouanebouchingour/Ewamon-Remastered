// Bankaiser's rig: a hulking demon beast hunched in a shaggy mantle of black feather shards, a white horned skull in a
// black hood with angry red eyes, a bone-armoured near arm (+X) and the far arm (-X) gripping the huge crescent blade
// (handR). The shard tiers and the flank sweeps are one cape link (cape1) that trails and ruffles; the yoke, the cape
// mass, the collar ring and the ribbons ride the body. Numbers are scad/bankaiser.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, fromSheet, inFrame, limb, pick, ppFrame } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, polyD, subFrame } from './lib/geo.mjs';

const DEG = Math.PI / 180;
const S = (a) => Math.sin(a * DEG);
const C = (a) => Math.cos(a * DEG);
const add = (a, b) => a.map((v, i) => v + b[i]);
const Sh = (sx, z, y = 0) => fromSheet(sx - 2, z, y);

const INK = [0.06, 0.06, 0.07];
const BONE = [[0.89, 0.89, 0.88], [0.73, 0.72, 0.72]];
const STEEL = [0.49, 0.50, 0.50];
const REDS = [[0.50, 0.07, 0.10], [0.80, 0.20, 0.25], [0.87, 0.16, 0.20], [1, 0.62, 0.64]];
const EYE_RED = [0.95, 0.12, 0.14];

// shard(p, d, w): a flat leaf from p along d, tested as a capsule
const shard = (p, d, w) => limb(p, add(p, d), w * 0.7, 0.3);

// the head block: translate(HC) rotate([0, 0, 16])
const HC = Sh(-0.6, 34.6, -4.8);
const headF = subFrame(HC, [0, 0, 16]);
const EYE = [1.15, -2.95, 0.55];
const eyeL = { side: 'L', at: EYE, size: 0.6, yaw: 24, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: INK, ink: [0.8, 0.2, 0.25] });

const SHL = [9.5, -2, 29]; const ELL = [10, -5, 21.5]; const WRL = [10, -6.5, 17];
const SHR = [-9.5, -1, 29]; const ELR = [-13.6, -3.2, 24.5]; const WRR = [-15.8, -5.6, 21];
const HIP = { L: [5, 0, 13], R: [-5, -1, 13] };
const LEG = {
  L: { hip: HIP.L, knee: [8, -3.5, 8.5], ankle: [9, -3.2, 3.2], toe: [9.6, -6.6, 1.1] },
  R: { hip: HIP.R, knee: [-8.5, -5.5, 8.5], ankle: [-9.6, -6.2, 3.2], toe: [-10.6, -9.2, 1.1] },
};

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: HIP.L },
  { name: 'legR', parent: 'root', at: HIP.R },
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'head', parent: 'body', at: add(HC, [0.2, 1.5, -3]) },
  { name: 'cape1', parent: 'body', at: [0, 2.5, 31] },
  { name: 'armL', parent: 'body', at: SHL },
  { name: 'foreL', parent: 'armL', at: ELL },
  { name: 'handL', parent: 'foreL', at: WRL },
  { name: 'armR', parent: 'body', at: SHR },
  { name: 'foreR', parent: 'armR', at: ELR },
  { name: 'handR', parent: 'foreR', at: WRR },
  ...face.joints,
];

// ---- the scad's primitives -------------------------------------------------------------------------------------
const TIERS = [[31.5, 9.5, 6.5, 6, 6, 3.4, 52], [24.5, 10.5, 7, 7, 8, 3.6, 55], [16, 10, 7, 4.5, 10.5, 3.8, 30]];
const tierShards = [];
TIERS.forEach((T, ti) => {
  for (let k = 0; k <= 16; k++) {
    const a = -90 + T[6] + (k * (360 - 2 * T[6])) / 16;
    const ca = C(a); const sa = S(a);
    const nearX = ca > 0.35 && ti < 2; const farLow = ca < -0.35 && ti === 2; const nearLow = ca > 0.35 && ti === 2;
    if (ti === 2 || Math.abs(a - 90) > 20) {
      tierShards.push(shard([T[1] * ca, 2.5 + T[2] * sa, T[0] + (k % 2) * 0.8],
        [(T[3] + (nearX ? 4 : 0) + (farLow ? 4 : 0) + (nearLow ? 4 : 0)) * ca, T[3] * 0.8 * sa, -T[4] + (nearX ? 2.5 : 0) - (k % 2) * 1.2], T[5]));
    }
  }
});
const sweeps = [
  [Sh(9, 30.5, 2), [8, 0, 0], 2.6], [Sh(10, 27, 3), [9.5, 1, -1.5], 2.8], [Sh(10, 23.5, 3), [9.5, 1, -2.5], 2.8],
  [Sh(10, 19.5, 3), [8, 1, -4], 2.6], [Sh(9, 15.5, 2), [8, 0.5, -5.5], 2.8], [Sh(8, 12, 1), [6.5, 0, -6], 2.6],
  [Sh(-10, 15, -1), [-8, -2, -3], 2.8], [Sh(-9.5, 12.5, -2), [-8.5, -2.5, -4], 2.6], [Sh(-8, 10.5, -3), [-5, -2, -3.5], 2.2],
].map(([p, d, w]) => shard(p, d, w));
const collarRing = Array.from({ length: 12 }, (_, k) => { const a = -50 + (k * 280) / 11; return shard([6.5 * C(a), 1.5 + 4.8 * S(a), 33], [5 * C(a), 3.5 * S(a), -3.5 - (k % 2)], 2.8); });
const frontEdges = [[-6.5, -3.8, 28, [-1.2, -1.6, -13], 3.4], [-8, -2.5, 27, [-2.5, -1.2, -14], 3.4], [-4.6, -4.6, 22, [-0.8, -1.4, -10], 2.6],
  [6.5, -3.8, 26, [1, -1.6, -11], 3], [7.8, -2.2, 25, [2, -1, -12], 3.2],
  [-3.5, -5.6, 25, [3, -0.6, -8], 2.6], [-1, -5.8, 22.5, [3.4, -0.4, -7.5], 2.4], [1.8, -5.6, 21, [2.6, -0.6, -7], 2.2],
  [-3.2, -4.2, 14.5, [-1.28, -1.5, -8.5], 2.6], [0, -4.2, 14.5, [0, -1.5, -8.5], 2.6], [3.2, -4.2, 14.5, [1.28, -1.5, -8.5], 2.6]]
  .map((f) => shard([f[0], f[1], f[2]], f[3], f[4]));
const torso = any(blob([[[7, 5.6, 5.5], [0, 0.5, 25]], [[6.3, 5.2, 5], [0, 0, 16]]]), ell([10.5, 7.5, 3.6], [0, 1.5, 29.5]),
  blob([[[9, 5, 4], [0, 5, 28]], [[11, 6, 5], [0, 6, 19]], [[10, 5.5, 3], [0, 5.5, 11]]]));

const inHead = inFrame(headF, any(ell([4, 3.7, 3.7], [0, 1.3, 0.5]),
  shard([-2.3, 0.6, 2.8], [-0.8, 0.6, 2.4], 1.6), shard([0.1, 0.4, 3.4], [0.3, 0.8, 2.2], 1.6), shard([2.5, 0.7, 2.8], [1.1, 0.8, 2.3], 1.6),
  shard([3.4, 0.2, 1.4], [2.2, 0.6, -4], 2), shard([-3.4, 0.2, 1.4], [-2.2, 0.6, -4], 2),
  shard([3, 2.4, 2.4], [2.6, 2, -3], 2), shard([-3, 2.4, 2.4], [-2.6, 2, -3], 2),
  blob([[[2.1, 1.6, 1.7], [0, -1.6, 1.1]], [[1.9, 1.3, 1], [0, -1.9, 0]]]), blob([[[1.3, 1.1, 1.1], [0, -2.1, -0.6]], [[0.8, 0.8, 0.7], [0, -2.5, -2]]]),
  limb([-1.4, -0.6, 2.1], [-2.5, 0.6, 6.3], 0.9, 0.3)));

const legParts = ['L', 'R'].map((s) => {
  const g = LEG[s];
  return [`leg${s}`, any(limb(g.hip, g.knee, 3, 2.4), limb(g.knee, g.ankle, 2.2, 1.6), ell([1.9, 1.3, 2.3], add(g.knee, [0, -1.6, 0.4])),
    blob([[[2.1, 2.2, 1.4], add(g.ankle, [0, 0, -1.6])], [[1.9, 1.4, 1], add(g.toe, [0, 1, 0])]]))];
});
const armParts = [
  ['armL', any(limb(SHL, ELL, 2.2, 1.9), ell([3.2, 2.8, 1.5], add(SHL, [0, -0.3, 1.2])), ell([1.8, 1.4, 2.6], add(add(SHL, ELL).map((v) => v / 2), [0.3, -1.2, 0])),
    limb(add(SHL, [-1, -1.3, 2]), add(SHL, [-6.5, -2.5, 4.6]), 1, 0.3))],
  ['foreL', limb(ELL, WRL, 1.8, 1.6)],
  ['handL', any(ell([1.6, 1.4, 1.2], add(WRL, [0, -0.4, -0.8])), limb(add(WRL, [0, -1.2, -1.4]), add(WRL, [0, -2, -3]), 0.6))],
  ['armR', limb(SHR, ELR, 2.2, 1.9)],
  ['foreR', any(limb(ELR, WRR, 1.8, 1.5), ell([1.7, 1.3, 2.2], add(add(ELR, WRR).map((v) => v / 2), [0, -0.8, 0])))],
  ['handR', any(ell([1.5, 1.5, 1.5], WRR), limb([-15, -5.2, 18.3], [-16.2, -5.9, 23.8], 0.7))],
];
const dark = [
  ...legParts, ...armParts,
  ['head', inHead],
  ['cape1', any(...tierShards, ...sweeps)],
  ['body', any(torso, ...collarRing, ...frontEdges)],
];

// the blade: pp(3) translate([-2, 0, 0]) plate(CRES, 1.2)
const bladeF = ppFrame(3);
const CRES = [[-12.3, 34.8], [-14.9, 33.2], [-17.1, 30.2], [-18.6, 26.2], [-19, 22.2], [-18.2, 18.6], [-16.2, 15.9],
  [-13.2, 14.2], [-9.4, 13.4], [-11.2, 15.6], [-13.4, 17.6], [-14.7, 19.9], [-15.1, 23.5], [-14.8, 27.5], [-13.9, 31]].map(([x, z]) => [x - 2, z]);
const onBlade = (c) => { const q = bladeF.local(c); return Math.abs(q[1]) < 1.4 && polyD([q[0], q[2]], CRES) < 0.8; };

function assign(c, rgb) {
  if (isAny(rgb, BONE, 0.03) || near(rgb, STEEL, 0.03)) {
    if (onBlade(c)) return 'handR';
    if (inHead(c) < 1.2) return 'head';
    if (c[2] < 11) return c[0] >= 0 ? 'legL' : 'legR';
    if (c[1] > 4) return 'body';                                  // the back plate, spine and ribs
    return pick(c, [...armParts, ['body', ell([1.4, 0.9, 2], [-4.5, -5.6, 19])], ['body', limb([-4.5, -6, 19.5], [-5.3, -7, 16.3], 0.8)]]);
  }
  if (near(rgb, EYE_RED, 0.04)) return 'head';
  if (near(rgb, INK, 0.02)) return inHead(c) < 1.3 ? 'head' : 'handL';  // sockets and nose, else the near hand's claws
  if (isAny(rgb, REDS, 0.04)) {
    if (c[2] < 3) return c[0] >= 0 ? 'legL' : 'legR';               // talons
    if (c[2] < 7.5 && Math.abs(c[0] - (c[0] >= 0 ? LEG.L.knee[0] : LEG.R.knee[0])) < 2.6 && c[1] > -7) return c[0] >= 0 ? 'legL' : 'legR';  // knee bands
    return 'body';                                                // gem, ruff, ribbons, chain, hip trims
  }
  return pick(c, dark);
}

// the blade hand: a slow menacing turn of the blade in idle, a big sweeping arc in the lunge
const base = bipedClips({
  face, hipH: 13, stride: 12, armSwing: 8, cape: ['cape1'], droop: 0.5, hopScale: 0,
  punch: { arm: [-30, 40, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => ({ handR: { r: [0, 0, 4 * osc(u, 1)] } }),
    lunge: (t, u) => { const hit = K(u, [[0.1, 0], [0.4, 1], [0.62, 1], [1, 0]]); return { handR: { r: [-20 * hit, 0, -30 * hit] } }; },
  },
});

const clips = {
  ...base,

  // fidget: raises the blade and inspects its edge, the skull tilting, then lowers it
  idle_whet: {
    seconds: 2.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.88, 0]]);
      const tilt = osc(u, 2) * win(u, 0.25, 0.7, 0.08);
      return {
        head: { r: [6 * up, 0, -14 * up + 5 * tilt] },
        armR: { r: [-24 * up, 14 * up, 0] },
        foreR: { r: [-20 * up, 0, 0] },
        handR: { r: [0, 0, 16 * tilt] },
        armL: { r: [0, -4 * up, 0] },
        cape1: { r: [1.5 * osc(u, 1), 0, 1.5 * osc(u, 1, 0.3)] },
        ...face.pose('open', blinks(u, [[0.78, 0.86]])),
      };
    },
  },

  // fidget: the mantle ruffles up like a crow's feathers, a cold shiver, the skull cocking to the side
  idle_ruffle: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.15, 0.7, 0.08);
      const sh = Math.sin(TAU * 10 * u) * on;
      return merge({
        body: { r: [-3 * on, 0, 0], s: [1 + 0.04 * on, 1 + 0.04 * on, 1] },
        head: { r: [-4 * on, 12 * win(u, 0.55, 0.95, 0.08), 0] },
        cape1: { r: [-4 * on + 2 * sh, 2 * sh, 0], s: [1 + 0.05 * on, 1 + 0.05 * on, 1] },
        ...both('arm', { r: [0, -5 * on, 0] }),
        ...face.pose('open', blinks(u, [[0.1, 0.18]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
