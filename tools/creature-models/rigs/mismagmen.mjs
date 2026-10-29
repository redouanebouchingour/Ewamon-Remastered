// Mismagmen's rig: a ghost witch. The white cape bell is the body, the face and the hat brim the head (eyes and mouth
// decals), the hat's bent cone a two-link wisp, and the eight tentacle tendrils of its skirt each a joint at the
// cape's hem that flares out and sways (through `add`: the floater template knows one hanging chain only).
// Numbers are scad/mismagmen.scad's.
import { K, TAU, merge, osc, rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, ellD, isAny, near } from './lib/geo.mjs';

const WHITE = [0.97, 0.97, 1];
const GHOST = [0.78, 0.76, 0.92];
const GHOST_DK = [0.62, 0.6, 0.78];
const OLIVE = [[0.72, 0.7, 0.24], [0.9, 0.88, 0.32]];
const TEAL = [[0.15, 0.65, 0.65], [0.6, 0.95, 0.95]];
const EYE = [[0.12, 0.1, 0.16], [0.98, 0.85, 0.15], [0.2, 0.4, 0.85]];
const MOUTH = [0.3, 0.5, 0.85];

const T = [...Array(8)].map((_, i) => {
  const a = ((i * 45 + 22.5) * Math.PI) / 180;
  const ca = Math.cos(a); const sa = Math.sin(a);
  return { name: `tendril${i + 1}`, ca, sa, pts: [[3.5 * ca, 3.5 * sa, 12], [5.5 * ca, 5.5 * sa, 6], [7.5 * ca, 7.5 * sa, 2], [9.5 * ca, 9.5 * sa, 1], [10.5 * ca, 10.5 * sa, 3.5]] };
});
const HAT = [[0, 0.5, 28], [0, 3, 34.5], [0, 6, 37]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, -0.3, 20.5] },
  { name: 'eyes', parent: 'head', at: [0, -5.4, 24.6] },
  { name: 'mouth', parent: 'head', at: [0, -5, 22.6] },
  { name: 'wisp1', parent: 'head', at: HAT[0] },
  { name: 'wisp2', parent: 'wisp1', at: HAT[1] },
  ...T.map((t) => ({ name: t.name, parent: 'body', at: t.pts[0] })),
];

const tendrilOf = (c) => {
  let best = { name: null, d: Infinity };
  for (const t of T) {
    const d = chainHit(c, t.pts, [1.9, 1.6, 1.3, 1.1, 0.4]).d;
    if (d < best.d) best = { name: t.name, d };
  }
  return best;
};

function assign(c, rgb) {
  if (isAny(rgb, EYE, 0.03) && c[1] < -3.5 && c[2] > 23) return 'eyes';
  if (near(rgb, MOUTH, 0.03)) return 'mouth';
  if (isAny(rgb, TEAL, 0.03)) return c[0] < -4 ? 'head' : 'body';   // the earring, the collar jewel
  const td = tendrilOf(c);
  if (isAny(rgb, OLIVE, 0.03)) {
    if (c[2] < 6) return td.name;
    return ellD(c, [4, 4, 5], [0, 6.3, 39]) < 1 ? 'wisp2' : 'head';   // the burst on the hat's tip, the brim's bursts
  }
  if (isAny(rgb, [WHITE, GHOST, GHOST_DK], 0.03)) {
    const hat = chainHit(c, HAT, [5, 1.6, 0.5]);
    return closest([
      [td.name, td.d],
      ['body', Math.min(ellD(c, [3.8, 3.4, 1.8], [0, 0, 20]), ellD(c, [6.7, 6.2, 1.8], [0, 0, 11]), c[2] > 11 && c[2] < 20.5 ? Math.hypot(c[0], c[1]) / (6.5 - (3 * (c[2] - 11)) / 9) : Infinity, ellD(c, [3, 1.2, 1.8], [2 * Math.sign(c[0]), -2.8, 20.2]))],
      ['head', Math.min(ellD(c, [6, 5, 4.4], [0, -0.3, 24.2]), ellD(c, [12.5, 10.5, 1.8], [0, 0, 27.5]) * 1.02)],
      [hat.i === 0 ? 'wisp1' : 'wisp2', Math.min(hat.d, capD(c, HAT[0], [0, 3, 34.5], 5, 1.6) * 1.05)],
    ]);
  }
  return 'head';
}

// the tendrils flare out by `k` degrees and sway round the hem in a travelling wave
const tendrils = (u, k, amp = 4, cycles = 1) => Object.fromEntries(T.map((t, i) => {
  const s = k + amp * Math.sin(TAU * (cycles * u - i / 8));
  return [t.name, { r: [s * t.sa, -s * t.ca, 0] }];
}));
const fx = {
  idle: (t, u) => tendrils(u, 0, 4, 1),
  walk: (t, u) => merge(tendrils(u, 6, 5, 2), Object.fromEntries(T.map((x) => [x.name, { r: [8, 0, 0] }]))),
  idle_spin: (t, u) => tendrils(u, 14 * Math.sin(Math.PI * u), 6, 3),
  idle_cackle: (t, u) => tendrils(u, 4, 6, 4),
  windup: (t, u) => tendrils(u, 10 * Math.min(1, u / 0.8), 2, 1),
  lunge: (t, u) => tendrils(u, K(u, [[0, 10], [0.4, -4], [1, 4]]), 3, 1),
  hurt: (t, u) => tendrils(u, 16 * Math.sin(Math.PI * u), 8, 3),
  recoil: (t, u) => tendrils(u, -6 * Math.sin(Math.PI * u), 2, 1),
  faint: (t, u) => tendrils(u, 18 * Math.min(1, u / 0.7), 2 * (1 - u), 1),
  celebrate: (t, u) => tendrils(u, 16, 8, 3),
  enter: (t, u) => tendrils(u, 20 * (1 - Math.min(1, u / 0.6)), 4, 1),
  exit: (t, u) => tendrils(u, 8, 6, 2),
};

const clips = {
  ...floaterClips({ wisp: ['wisp1', 'wisp2'], bob: 1, add: fx }),

  // fidget: tips the hat brim with a sly look, the cone flopping, the eyes narrowing
  idle_hattip: {
    seconds: 2.4,
    pose: (t, u) => {
      const tip = K(u, [[0, 0], [0.2, 1], [0.62, 1], [0.82, 0]]);
      const flop = osc(u, 3) * tip;
      return merge({
        body: { p: [0, 0, 0.5 + 0.3 * osc(u, 1)] },
        head: { r: [10 * tip, -8 * tip, 12 * tip] },
        wisp1: { r: [-10 * tip + 4 * flop, 0, 0] },
        wisp2: { r: [-8 * tip + 8 * flop, 0, 6 * flop] },
        eyes: { s: [1, 1, 1 - 0.2 * tip] },
        mouth: { s: [1 + 0.2 * tip, 1, 1] },
      }, tendrils(u, 2, 4, 1));
    },
  },
};

export default rigDef({ joints, assign, clips });
