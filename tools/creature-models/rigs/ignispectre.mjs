// Ignispectre's rig: a skeletal ghost in a ragged flame robe. The robe, mantle, spine, ribs and pelvis are the body,
// the skull the head, the blue fire in its sockets (and the flames licking up the brow) the eyes, the flame halo round
// the skull a one-link wisp off the head, the orange glow in the ribcage the pulsing core, the bony arms arm (upper
// arm and elbow) + hand (forearm, wrist and claws). The hem flames, embers and smoke on the ground stay on the root.
// Floater template. Numbers are scad/ignispectre.scad's.
import { K, merge, osc, rigDef, smooth } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, closest, ellD, isAny, near } from './lib/geo.mjs';

const BONE = [[0.8, 0.72, 0.57], [0.88, 0.82, 0.68], [0.55, 0.45, 0.35]];
const SOCKET = [0.06, 0.08, 0.13];
const ROBE = [[0.22, 0.4, 0.6], [0.12, 0.25, 0.42], [0.31, 0.55, 0.72]];
const FIRE_MID = [0.16, 0.33, 0.56];
const FIRE_BLUE = [0.4, 0.7, 0.88];
const FIRE_CYAN = [0.54, 0.88, 0.97];
const FIRE_PALE = [0.74, 0.97, 0.98];
const EMBER = [[0.94, 0.5, 0.18], [1, 0.82, 0.38]];
const SMOKE = [[0.78, 0.74, 0.69], [0.66, 0.62, 0.58]];

// fromSheet(sx, z, y) of lib.scad
const sh = (sx, z, y) => [(sx - 0.5 * y) / Math.cos(Math.PI / 6), y, z];
const S = [-1.2, -4.5, 33.4];   // skull centre, turned SY degrees about Z
const SY = 18 * Math.PI / 180;
const C = [-0.4, -1.6, 24.9];   // ribcage centre
// arms: shoulder, elbow, wrist (L = the creature's +X side, the raised near arm)
const ARM = {
  L: [[4.8, 0.3, 27.4], sh(6.8, 25.2, -2), sh(10.8, 28.4, -4.5)],
  R: [[-4.8, 0.3, 27.4], sh(-9.0, 23.8, -1), sh(-14.2, 20.8, -2.5)],
};
const NECK = [[-0.5, -1.2, 28.2], [-1.1, -3.2, 30.6]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0.5, 18] },
  { name: 'core', parent: 'body', at: C },
  { name: 'head', parent: 'body', at: NECK[1] },
  { name: 'eyes', parent: 'head', at: [-0.49, -6.69, 32.6] },
  { name: 'wisp1', parent: 'head', at: [-0.6, -1.0, 31.5] },
  { name: 'armL', parent: 'body', at: ARM.L[0] },
  { name: 'handL', parent: 'armL', at: ARM.L[1] },
  { name: 'armR', parent: 'body', at: ARM.R[0] },
  { name: 'handR', parent: 'armR', at: ARM.R[1] },
];

// a point in the skull's own frame (the scad's skull() block)
const skullLocal = (c) => {
  const d = [c[0] - S[0], c[1] - S[1], c[2] - S[2]];
  return [d[0] * Math.cos(SY) + d[1] * Math.sin(SY), -d[0] * Math.sin(SY) + d[1] * Math.cos(SY), d[2]];
};
const skullD = (c) => {
  const l = skullLocal(c);
  return Math.min(
    ellD(l, [2.9, 3.2, 2.9], [0, 0.3, 0.2]), ellD(l, [2.2, 1.7, 1.25], [0, -1.4, -1.95]),
    ellD(l, [1.85, 1.5, 0.72], [0, -1.5, -4.05]), ellD(l, [1.9, 1.2, 0.7], [0, -2.6, -3.2]),
    capD([Math.abs(l[0]), l[1], l[2]], [1.7, -0.8, -3.9], [2.15, -0.1, -2.2], 0.45, 0.4),
  );
};
const isEye = (c) => {
  const l = skullLocal(c);
  return Math.abs(l[0]) < 2.8 && l[1] < -1.2 && l[2] > -1.8 && l[2] < 2.4;
};
const o = [0, 0, 0.42];
const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const armParts = (c, Sd) => {
  const [p, e, w] = ARM[Sd];
  return [
    [`arm${Sd}`, Math.min(capD(c, p, e, 1.1, 0.9), ellD(c, [1.15, 1.15, 1.15], e))],
    // forearm bones, wrist and the whole claw (within the fingers' reach of the wrist)
    [`hand${Sd}`, Math.min(capD(c, add(e, o), add(w, o), 0.62, 0.52), capD(c, add(e, o, -1), add(w, o, -1), 0.6, 0.5), ellD(c, [5.6, 5.6, 5.6], w) * 1.0)],
  ];
};
const torsoD = (c) => Math.min(
  capD(c, [-0.3, 0.6, 19.4], [-0.5, 0.2, 28.4], 0.8), ellD(c, [3.4, 2.3, 1.5], [-0.3, -0.8, 20.2]),
  ellD([Math.abs(c[0] + 0.0), c[1], c[2]], [1.7, 1.2, 1.3], [2.0, -1.2, 20.7]), ellD(c, [5.4, 4.0, 3.9], C),
  capD(c, [-0.4, -4.8, 27.9], [-0.3, -4.9, 25.2], 0.5), capD(c, [-4.8, 0.3, 27.4], [4.8, 0.3, 27.4], 0.6),
  ellD([Math.abs(c[0]), c[1], c[2]], [1.05, 1.05, 1.05], [4.8, 0.3, 27.4]), capD(c, ...NECK, 0.65, 0.55),
);
// floating bone shards
const SHARDS = [[sh(8.2, 37.0, 0), sh(9.3, 35.6, 0)], [sh(-15.4, 27.2, -1), sh(-14.6, 28.0, -1)], [sh(7.0, 18.4, 0), sh(7.9, 17.4, 0)]];
const shardD = (c) => Math.min(...SHARDS.map(([a, b]) => capD(c, a, b, 0.38)));

const isHalo = (c) => c[2] > 29.3 && Math.abs(c[0] + 0.6) < 9.6 && c[1] > -5.6;
const isArmFlame = (c) => c[0] < -9.5 && c[2] > 21 && c[2] < 27;

function assign(c, rgb) {
  const fire = near(rgb, FIRE_MID, 0.03) || near(rgb, FIRE_BLUE, 0.03) || near(rgb, FIRE_CYAN, 0.03) || near(rgb, FIRE_PALE, 0.03);
  if (isAny(rgb, SMOKE, 0.03)) return 'root';
  if (fire) {
    if (c[2] < 7.5) return 'root';                                   // hem flames
    if ((near(rgb, FIRE_BLUE, 0.03) || near(rgb, FIRE_PALE, 0.03)) && isEye(c) && Math.hypot(c[0] - S[0], c[1] - S[1], c[2] - S[2]) < 4.6) return 'eyes';
    if (isHalo(c)) return 'wisp1';
    if (isArmFlame(c)) return 'handR';                               // flames rising off the far forearm
    return 'body';                                                   // floating flames
  }
  if (isAny(rgb, EMBER, 0.03)) {
    if (c[2] < 3) return 'root';
    return ellD(c, [4.4, 3.6, 3.8], C) < 1.15 ? 'core' : 'body';
  }
  if (near(rgb, SOCKET, 0.03)) return 'head';
  if (isAny(rgb, ROBE, 0.03)) return 'body';
  if (isAny(rgb, BONE, 0.03)) {
    const Sd = c[0] >= 0 ? 'L' : 'R';
    return closest([['head', skullD(c)], ['body', Math.min(torsoD(c), shardD(c))], ...armParts(c, Sd)]);
  }
  return 'body';
}

// the claws flex: the forearms curl in a little on a beat
const flex = (k) => ({ handL: { r: [0, 0, -12 * k] }, handR: { r: [0, 0, 12 * k] } });

const clips = {
  ...floaterClips({
    wisp: ['wisp1'], bob: 1,
    add: {
      idle: (t, u) => flex(0.5 + 0.5 * osc(u, 2)),
      windup: (t, u) => flex(smooth(u / 0.8)),
      lunge: (t, u) => flex(K(u, [[0, 1], [0.35, -0.6], [0.7, 1]])),
      hurt: (t, u) => ({ wisp1: { s: [1, 1, 1 - 0.3 * Math.sin(Math.PI * u)] } }),
      faint: (t, u) => ({ wisp1: { s: Math.max(0.4, 1 - 0.6 * smooth(u / 0.8)) }, core: { s: Math.max(0.8, 1 - 0.2 * smooth(u / 0.8)) } }),
    },
  }),

  // fidget: the ghost fire flares high, the ribcage glows hot, the skull tips back and the claws spread
  idle_flare: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.85, 0]]);
      const fl = osc(u, 8) * on;
      return merge({
        body: { p: [0, 0, 0.6 + 0.5 * on] },
        head: { r: [-12 * on, 0, 4 * fl] },
        wisp1: { s: [1 + 0.15 * on, 1 + 0.15 * on, 1 + 0.5 * on + 0.08 * fl], r: [4 * fl, 0, 6 * fl] },
        core: { s: 1 + 0.12 * on },
        eyes: { s: [1 + 0.15 * on, 1, 1 + 0.25 * on] },
        armL: { r: [0, -20 * on, 10 * on] },
        armR: { r: [0, 20 * on, -10 * on] },
      }, flex(-on));
    },
  },
};

export default rigDef({ joints, assign, clips });
