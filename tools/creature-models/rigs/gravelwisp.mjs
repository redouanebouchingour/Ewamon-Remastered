// Gravelwisp's rig: an empty hooded cloak floating on a sandy wisp. The cloak is the body, the hood the head (its
// floppy point is the wisp chain), the two glowing amber eyes a decal, the trailing sand wisp the tail, the scarf's
// loose end its own joint and the purple squiggles at its sides the "arms" (pivots at their middles, so they tilt in
// place). Floater template. Numbers are scad/gravelwisp.scad's.
import { merge, osc, rigDef, wave } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, ellD, isAny, near } from './lib/geo.mjs';

const SAND_HI = [0.92, 0.8, 0.55];
const LILAC = [[0.6, 0.48, 0.66], [0.45, 0.33, 0.52]];
const VOID = [0.12, 0.1, 0.16];
const AMBER = [[1, 0.8, 0.2], [1, 0.95, 0.6]];
const WISP_C = [0.9, 0.62, 0.3];
const SQUIGGLE = [0.5, 0.3, 0.65];

const TAIL = [[0, 1, 14], [0.6, 0.6, 9], [1.6, 0.4, 5], [2, 0.6, 1.4], [1.6, 0.8, 0.3]];
const TAIL_R = [4, 3, 2, 1, 0.3];
const POINT = [[0, 2, 41], [0.6, 3, 44.5], [2.4, 4.4, 46.4], [5.4, 5.4, 46.2], [7, 5.4, 44.6]];
const POINT_R = [3.8, 2.8, 1.9, 1.2, 0.4];
const tail = TAIL.slice(0, -1).map((_, i) => `tail${i + 1}`);
const wisp = POINT.slice(0, -1).map((_, i) => `wisp${i + 1}`);
const SCARF = [[5, -2.6, 26], [6.6, -2, 19]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0.6, 14] },
  { name: 'head', parent: 'body', at: [0, 0.5, 27] },
  { name: 'eyes', parent: 'head', at: [0, -4.8, 32.3] },
  { name: 'scarf', parent: 'body', at: SCARF[0] },
  { name: 'armL', parent: 'body', at: [13.7, -1, 23.8] },
  { name: 'armR', parent: 'body', at: [-13.7, -1, 23.8] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...wisp.map((name, i) => ({ name, parent: i === 0 ? 'head' : wisp[i - 1], at: POINT[i] })),
];

// the cloak's bell: a frustum from r (10, 8.4) at z 14 to (6.4, 6) at z 24
const bell = (c) => {
  const k = Math.min(1, Math.max(0, (c[2] - 14) / 10));
  const rx = 10 + (6.4 - 10) * k;
  const ry = 8.4 + (6 - 8.4) * k;
  const out = Math.max(0, 14 - c[2], c[2] - 25) / 2;
  return Math.hypot(c[0] / rx, (c[1] - 0.6) / ry) + out;
};

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (isAny(rgb, AMBER, 0.03)) return 'eyes';
  if (near(rgb, SQUIGGLE, 0.03)) return `arm${S}`;
  if (near(rgb, WISP_C, 0.03)) return tail[Math.min(tail.length - 1, chainHit(c, TAIL, TAIL_R).i)];
  if (near(rgb, SAND_HI, 0.03) && c[2] < 8) return 'root';   // dust motes on the ground
  if (near(rgb, VOID, 0.03)) return 'head';
  if (isAny(rgb, LILAC, 0.03)) return c[2] > 29 ? 'head' : 'body';
  const p = chainHit(c, POINT, POINT_R);
  return closest([
    ['body', Math.min(bell(c), ellD(c, [6.6, 6, 1.7], [0, 0.4, 25]), ellD(c, [6, 5.6, 1.5], [0, 0.4, 26.7]), ellD(c, [5.8, 5.4, 1.4], [0, 0.2, 28]))],
    ['scarf', capD(c, SCARF[0], SCARF[1], 1.6, 1.2)],
    ['head', Math.min(ellD(c, [8.2, 7.8, 7.8], [0, 0.5, 33.5]), ellD(c, [4.4, 4.4, 3], [0, 2, 40]))],
    [wisp[Math.min(wisp.length - 1, p.i)], p.d],
  ]);
}

// the scarf end flaps a beat behind the body
const flap = (u, amp, cycles) => wave(['scarf'], u, { cycles, amp: [amp, 0, amp * 0.6], phase: 0.2 });
const fx = { idle: [4, 2], walk: [12, 2], idle_spin: [14, 3], idle_cackle: [6, 4], windup: [6, 1], lunge: [16, 1], hurt: [16, 3], recoil: [8, 1], faint: [4, 1], celebrate: [14, 3], enter: [10, 1], exit: [8, 2] };
const add = Object.fromEntries(Object.entries(fx).map(([n, [a, c]]) => [n, (t, u) => flap(u, a, c)]));
add.walk = (t, u) => merge(flap(u, 12, 2), { scarf: { r: [20, 0, 0] } });

const base = floaterClips({ tail, wisp, bob: 1, add });

const clips = {
  ...base,

  // fidget: the eyes narrow (a decal: never shrunk far) as the hood dips, then flare wide, the hood point twitching
  idle_squint: {
    seconds: 2.4,
    pose: (t, u) => {
      const off = u > 0.3 && u < 0.62 ? 1 : 0;
      const flare = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.62) / 0.2)));
      return merge({
        body: { p: [0, 0, 0.6 + 0.4 * osc(u, 2)] },
        head: { r: [4 * off, 0, 0] },
        eyes: { s: [1 + 0.2 * flare, 1, 1 - 0.25 * off + 0.3 * flare] },
      }, wave(wisp, u, { cycles: 3, amp: [6, 0, 4], lag: 0.15, grow: 0.3 }), flap(u, 4, 2));
    },
  },
};

export default rigDef({ joints, assign, clips });
