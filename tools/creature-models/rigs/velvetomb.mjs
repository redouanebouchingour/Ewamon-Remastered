// Velvetomb's rig: a towering velvet phantom, a flared cloak over a smoke cloud, a white pointed mask under a tall
// cowl, wide sleeves with clawed hands, a glowing orb by its right hand (the template's core) and five smoke curls.
// The curl off the crown is the template's wisp chain; the others copy its motion link by link, mirrored when they
// sweep to -X. Numbers are scad/velvetomb.scad's (the old model, rigged before its sprite-accuracy rebuild).
import { K, TAU, merge, mirror, osc, rigDef, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const MASK = [[0.95, 0.93, 0.97], [0.74, 0.68, 0.8], [0.1, 0.04, 0.12], [0.6, 0.1, 0.4], [0.55, 0.3, 0.6]];
const SMOKE = [0.86, 0.8, 0.9];
const ORB = [[0.88, 0.8, 1], [1, 0.97, 1]];
const CLAW = [0.5, 0.44, 0.55];

const radii = (rs) => rs.map((r) => Math.max(r * 1.25, 1.1));
// [points, radii, parent, joint prefix, mirrored]
const CURLS = [
  [[[2, 2, 37], [6, 3, 40], [10, 5, 40], [12, 6, 37], [10.5, 6.5, 35]], [2.4, 2, 1.6, 1.1, 0.6], 'head', 'wisp', false],
  [[[4, 3, 31], [9, 5, 33], [13, 6, 34], [16, 7, 32], [15, 8, 29.5]], [2.4, 2, 1.6, 1.1, 0.6], 'body', 'curlB', false],
  [[[6, 4, 26], [11, 6, 27], [15, 7, 25], [17, 8, 21], [15.5, 8.5, 18.5]], [2.2, 1.9, 1.5, 1, 0.5], 'body', 'curlC', false],
  [[[-2, 2, 37], [-5, 4, 40], [-8, 6, 40.5], [-9, 7, 38]], [2, 1.6, 1.2, 0.6], 'head', 'curlD', true],
  [[[0, 4, 33], [-4, 7, 31], [-8, 9, 29], [-10, 9, 25], [-8.5, 9, 23]], [2.2, 1.8, 1.4, 1, 0.5], 'body', 'curlE', true],
].map(([pts, rs, parent, pre, mir]) => ({ pts, rs: radii(rs), parent, mir, names: pts.slice(0, -1).map((_, i) => `${pre}${i + 1}`) }));
const wisp = CURLS[0].names;

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0.5, 8] },
  { name: 'head', parent: 'body', at: [0, 0.5, 28] },
  { name: 'armL', parent: 'body', at: [6, 0, 27] },
  { name: 'handL', parent: 'armL', at: [11.4, -2.4, 20.6] },
  { name: 'armR', parent: 'body', at: [-6, 0, 27] },
  { name: 'handR', parent: 'armR', at: [-11.4, -2.4, 20.6] },
  { name: 'core', parent: 'handR', at: [-8, -7, 18] },
  ...CURLS.flatMap((k) => k.names.map((name, i) => ({ name, parent: i === 0 ? k.parent : k.names[i - 1], at: k.pts[i] }))),
];

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (isAny(rgb, MASK, 0.03)) return 'head';
  if (isAny(rgb, ORB, 0.03)) return ellD(c, [3.6, 3.6, 3.6], [-8, -7, 18]) < 1.3 ? 'core' : 'body';
  if (near(rgb, CLAW, 0.03)) return c[2] < 6 ? 'body' : `hand${S}`;
  if (c[2] < 8.4 || (c[2] < 9 && !near(rgb, SMOKE, 0.03))) return 'body';   // the hem cloud, the talon feet
  const hits = CURLS.map((k) => { const h = chainHit(c, k.pts, k.rs); return [k.names[h.i], h.d]; });
  return closest([
    ['body', Math.min(blobD(c, [[[7, 5.5, 4], [0, 0, 26]], [[11, 9, 4], [0, 0.5, 13]], [[13, 11, 2], [0, 1, 6]]]), ellD(c, [6.4, 5.2, 3.6], [0, -1, 27]),
      ellD(c, [2.6, 1, 2.6], [0, 8.9, 18]))],
    ['head', Math.min(blobD(c, [[[5, 5, 5], [0, 0.5, 32]], [[3.5, 3.5, 6], [0, 1.5, 36]]]), capD(c, [-1, 0.5, 37], [-2.5, 0.5, 42], 2.4, 0.3),
      blobD(c, [[[6.5, 4, 5], [0, 2, 36]], [[5, 4, 4], [3, 2.5, 39]]]), ellD(c, [4, 3, 3], [-3.5, 3, 39.5]))],
    [`arm${S}`, capD(f, [6, 0, 27], [11, -2, 21], 2.6, 2.4)],
    [`hand${S}`, Math.min(ellD(f, [2.8, 2.6, 2], [11.6, -2.6, 20]), ellD(f, [1.6, 1.4, 1.4], [12, -3.2, 18.4]))],
    ...hits,
  ]);
}

// every other curl follows the crown curl: shoulder curls a little softer, the -X ones mirrored
function follow(clips) {
  for (const c of Object.values(clips)) {
    const pose = c.pose;
    c.pose = (t, u) => {
      const p = pose(t, u);
      const out = { ...p };
      for (const k of CURLS.slice(1)) {
        k.names.forEach((n, i) => {
          const r = (p[wisp[Math.min(i, wisp.length - 1)]]?.r ?? [0, 0, 0]).map((v) => v * (k.parent === 'body' ? 0.8 : 1));
          out[n] = k.mir ? mirror({ r }) : { r };
        });
      }
      return out;
    };
  }
  return clips;
}

const base = floaterClips({
  wisp, bob: 0.9,
  add: {
    walk: (t, u) => Object.fromEntries(wisp.map((n, i) => [n, { r: [0, 0, 5 + 2 * i] }])),
  },
});
delete base.idle_cackle;   // a mask: no grin to cackle with

const clips = follow({
  ...base,

  // fidget: raises the orb to the mask and gazes into it, the orb swelling, the smoke curling up
  idle_scry: {
    seconds: 2.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.78, 1], [0.92, 0]]);
      const glow = (Math.sin(TAU * 3 * u) * 0.5 + 0.5) * up;
      return merge({
        body: { p: [0, 0, 0.9], r: [3 * up, 0, -6 * up] },
        head: { r: [12 * up, 0, -10 * up] },
        armR: { r: [-35 * up, 30 * up, 0] },
        handR: { r: [-20 * up, 0, 0] },
        core: { s: 1 + 0.25 * glow },
      }, Object.fromEntries(wisp.map((n, i) => [n, { r: [-6 * up + 3 * osc(u, 2, -0.1 * i), 0, 5 * osc(u, 1, -0.1 * i)] }])));
    },
  },

  // fidget: a slow bow with a sweep of the left sleeve
  idle_bow: {
    seconds: 2.4,
    pose: (t, u) => {
      const b = K(u, [[0, 0], [0.3, 1], [0.6, 1], [0.85, 0]]);
      return merge({
        body: { p: [0, 0, 0.9], r: [10 * b, 0, 0] },
        head: { r: [14 * b, 0, 0] },
        armL: { r: [-30 * b, -10 * b, -30 * b] },
      }, Object.fromEntries(wisp.map((n, i) => [n, { r: [8 * b * (1 + 0.2 * i), 0, 3 * osc(u, 1, -0.1 * i)] }])));
    },
  },
});

export default rigDef({ joints, assign, clips });
