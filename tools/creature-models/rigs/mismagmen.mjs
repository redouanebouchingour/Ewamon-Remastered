// Mismagmen's rig: a ghost witch. The white gown, its collar and brooch are the body; the wide hat (the face
// bowl sitting on the gown under the floppy white brim, its olive tufts and the earring) is the head, with glaring lib.scad
// eyes (eyeKit lids) and a blue zig-zag grin (a decal: scaled a little, never far); the hat's bent crown a two-link
// wisp (the big tuft on its tip rides the second link); the fifteen tentacles flowing out of the hem each a joint at the
// hem that flares out and sways (through `add`: the floater template knows one hanging chain only), the first one
// raised like an arm. Numbers are scad/mismagmen.scad's.
import { K, TAU, merge, osc, rigDef } from './lib/anim.mjs';
import { eyeKit } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, ellD, isAny, near } from './lib/geo.mjs';

const LAV = [0.75, 0.75, 0.84];
const OLIVE = [[0.71, 0.72, 0.3], [0.82, 0.85, 0.37], [0.96, 0.9, 0.23]];
const TEAL = [[0.05, 0.63, 0.7], [0.6, 0.95, 0.95]];
const INK = [0.1, 0.09, 0.12];
const BLUE = [0.1, 0.55, 0.88];
const YEL = [0.98, 0.86, 0.2];
const SHINE = [1, 1, 1];
const ORANGE = [0.98, 0.7, 0.1];

const HX = -0.5;    // the hat / face bowl's axis
const SY = 0.78;    // its front-to-back squash
const G = [0.6, 0, 0];
const lerpZ = (prof, z) => {   // [r, z] profile -> r at z (z rising)
  if (z <= prof[0][1]) return prof[0][0];
  for (let i = 1; i < prof.length; i++) {
    const [r1, z1] = prof[i]; const [r0, z0] = prof[i - 1];
    if (z <= z1) return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
  }
  return prof[prof.length - 1][0];
};
const BOWL = [[3.4, 19.6], [7, 20.2], [10.5, 21.3], [12.8, 22.8], [13.8, 24.5], [14.1, 26.3], [14, 27.6], [13.6, 28.3]];
const GOWN = [[8.6, 9.5], [9.3, 10.4], [8.7, 12.2], [7.3, 14.6], [5.7, 16.7], [4.3, 18.6], [3, 19.8]];
// the brim (scad brimSheet): its top at z 33 on the axis curving down to a rim that droops lowest at the sides
const BR = 16.6;
const deg = Math.PI / 180;
const rimZ = (a) => 29.2 - 2.8 * Math.cos(a) ** 2;
const capZ = (r, a) => 33 - (33 - rimZ(a)) * (r / BR) ** 2.2;
const hatR = (c) => Math.hypot(c[0] - HX, c[1] / SY);
const brimTop = (c) => capZ(Math.min(BR, hatR(c)), Math.atan2(c[1] / SY, c[0] - HX));
const EYE_L = [3.4, -10.25, 26.8];
const EYE_R = [-4.4, -10.25, 26.8];
const ES = 1.7;
const MOUTH = [[-2.2, -10.4, 24.6], [-1.1, -10.6, 24], [0, -10.65, 24.55], [1.1, -10.6, 24], [2.2, -10.4, 24.6]].map((p) => [p[0] + HX, p[1], p[2]]);
const CR = [[-0.6, 1.8, 34, 3.6], [1.4, 2.6, 35.8, 2.2], [3.6, 3.1, 36.7, 1.2], [5.2, 3.3, 36.2, 0.55]];
const TOP_TUFT = [1.6, 3, 37.9];

const TP = [[7.6, 11.4], [9.6, 9.4], [11, 6.8], [12.3, 4.6], [13.1, 2.4], [14, 1], [15.3, 1.1], [16, 2.4], [15.4, 3.7]];
const TH = [[7.6, 11.4], [9.6, 10.2], [11.6, 9.4], [13.8, 8.8], [15.8, 7.8], [16.8, 6.1], [16.5, 4.3], [15.4, 3.6], [14.7, 4.3]];
const TARM = [[7.2, 12.8], [8.9, 12.6], [10.4, 12.8], [12.2, 14], [13.4, 15.6], [14.4, 16.9], [15.4, 16.9], [15.8, 15.8], [15.3, 15]];
const TR = [1.9, 1.4, 1.1, 0.92, 0.8, 0.7, 0.6, 0.5, 0.42];
const TENDRILS = [[35, TARM, 1, 0], [0, TH, 1, 0], [60, TP, 1, 10], [85, TP, 0.95, -10], [110, TP, 0.9, 10], [135, TP, 0.85, -10],
  [160, TP, 0.8, 10], [185, TP, 0.72, -10], [210, TP, 0.68, 10], [235, TP, 0.75, -10], [255, TP, 0.85, 10],
  [275, TP, 0.95, -10], [295, TP, 1.05, 10], [315, TP, 0.95, -10], [340, TP, 1.1, 10]];
const T = TENDRILS.map(([a0, prof, k, sw], n) => {
  const pts = prof.map(([r0, z], i) => {
    const r = 7.6 + (r0 - 7.6) * k; const a = (a0 + (sw * i) / 8) * deg;
    return [G[0] + r * Math.cos(a), G[1] + r * Math.sin(a), z];
  });
  return { name: `tendril${n + 1}`, ca: Math.cos(a0 * deg), sa: Math.sin(a0 * deg), pts };
});

const face = eyeKit({
  eyes: [{ side: 'L', at: EYE_L, size: ES, yaw: 13 }, { side: 'R', at: EYE_R, size: ES, yaw: -13 }],
  parent: 'eyes', skin: LAV, lid: [1.14 * 1.3, 1, 1.2 * 0.85],
});

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0.6, 0, 12] },
  { name: 'head', parent: 'body', at: [-0.2, 0, 20.4] },
  { name: 'eyes', parent: 'head', at: [HX, -10.4, 26.8] },
  { name: 'mouth', parent: 'head', at: [HX, -10.6, 24.3] },
  { name: 'wisp1', parent: 'head', at: [-1.6, 1.2, 32] },
  { name: 'wisp2', parent: 'wisp1', at: CR[0].slice(0, 3) },
  ...T.map((t) => ({ name: t.name, parent: 'body', at: t.pts[0] })),
  ...face.joints,
];

const tendrilOf = (c) => {
  let best = { name: null, d: Infinity };
  for (const t of T) {
    const d = chainHit(c, t.pts, TR).d;
    if (d < best.d) best = { name: t.name, d };
  }
  return best;
};
const eyeD = (c) => Math.min(ellD(c, [ES * 1.3 * 1.25, ES, ES * 1.2], EYE_L), ellD(c, [ES * 1.3 * 1.25, ES, ES * 1.2], EYE_R));
const mouthD = (c) => Math.min(...MOUTH.slice(1).map((b, i) => capD(c, MOUTH[i], b, 0.3, 0.3)));

function assign(c, rgb) {
  if (isAny(rgb, [YEL, INK, SHINE], 0.03) && eyeD(c) < 1.2) return 'eyes';
  if (near(rgb, BLUE, 0.03)) return mouthD(c) < eyeD(c) * 2.2 && c[2] < 25.2 ? 'mouth' : 'eyes';
  if (near(rgb, ORANGE, 0.03)) return 'head';
  if (isAny(rgb, TEAL, 0.03)) return 'body';
  const td = tendrilOf(c);
  if (isAny(rgb, OLIVE, 0.03)) {
    if (c[2] < 20) return td.name;
    return ellD(c, [6, 6, 6], TOP_TUFT) < 1 ? 'wisp2' : 'head';
  }
  // the white / lavender skin: the crown above the brim, the hat and face, the gown, the tentacles
  const r = hatR(c);
  if (c[2] > 30 && r < 8.5 && c[2] > brimTop(c) + 0.05) return c[2] > 34.6 || c[0] > 2 ? 'wisp2' : 'wisp1';
  const gown = c[2] > 9 && c[2] < 20.4 ? Math.hypot(c[0] - G[0], c[1] - G[1]) / lerpZ(GOWN, c[2]) : Infinity;
  const bowl = c[2] > 19.4 && c[2] < 28.6 ? r / lerpZ(BOWL, c[2]) : Infinity;
  const brim = c[2] > 25.5 && r < BR + 0.6 ? 0.9 : Infinity;
  return closest([
    [td.name, td.d],
    ['body', Math.min(gown, ellD(c, [4.8, 4.6, 0.9], [0.6, 0, 18.9]))],
    ['head', Math.min(bowl, brim)],
  ]);
}

// the tendrils flare out by `k` degrees and sway round the hem in a travelling wave
const tendrils = (u, k, amp = 4, cycles = 1) => Object.fromEntries(T.map((t, i) => {
  const s = k + amp * Math.sin(TAU * (cycles * u - i / T.length));
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
  ...floaterClips({ face, wisp: ['wisp1', 'wisp2'], bob: 1, add: fx }),

  // fidget: tips the hat brim with a sly look, the crown flopping, the eyes narrowing, the grin widening
  idle_hattip: {
    seconds: 2.4,
    pose: (t, u) => {
      const tip = K(u, [[0, 0], [0.2, 1], [0.62, 1], [0.82, 0]]);
      const flop = osc(u, 3) * tip;
      return merge({
        body: { p: [0, 0, 0.5 + 0.3 * osc(u, 1)] },
        head: { r: [8 * tip, -6 * tip, 10 * tip] },
        wisp1: { r: [-10 * tip + 4 * flop, 0, 0] },
        wisp2: { r: [-8 * tip + 8 * flop, 0, 6 * flop] },
        eyes: { s: [1, 1, 1 - 0.2 * tip] },
        mouth: { s: [1 + 0.15 * tip, 1, 1 + 0.1 * tip] },
        ...face.pose('open'),
      }, tendrils(u, 2, 4, 1));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
