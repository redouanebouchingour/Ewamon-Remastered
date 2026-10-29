// Aonred's rig: an armoured shadow lord hovering on a jagged skirt, black flame-tipped wings, a blue fire phoenix
// rising from its crown, an orb in each claw and a curling tail. Numbers are scad/aonred.scad's (the old model; re-rig
// when the sprite-matched one lands).
import { both, merge, osc, rigDef, smooth, win, K, TAU } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const SHADE = [0.13, 0.13, 0.16];
const SHADE_HI = [0.25, 0.26, 0.3];
const SILVER = [0.66, 0.7, 0.76];
const SILVER_HI = [0.86, 0.9, 0.95];
const RUFF = [0.8, 0.86, 0.92];
const FLAMES = [[0.08, 0.22, 0.7], [0.2, 0.5, 0.95], [0.5, 0.8, 1]];
const ORB_CORE = [0.1, 0.2, 0.75];
const EYE = [[0.9, 0.12, 0.1], [0.1, 0.04, 0.06]];
const BIRD_EYE = [0.05, 0.1, 0.4];

const PHOENIX = [[0, 0.5, 32], [0.5, 0, 35], [-0.5, -0.5, 38], [0, -1.2, 40]];
const TAIL = [[0, 3.5, 15], [-4, 7, 13], [-9, 8, 14], [-12, 6, 16]];
const TAIL_R = [2, 1.6, 1.1, 0.3];
const tail = ['tail1', 'tail2', 'tail3'];
const wisp = ['wisp1', 'wisp2', 'wisp3'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 16] },
  { name: 'head', parent: 'body', at: [0, -0.8, 25] },
  { name: 'eyes', parent: 'head', at: [0, -5.3, 29.2] },
  ...wisp.map((name, i) => ({ name, parent: i === 0 ? 'head' : wisp[i - 1], at: PHOENIX[i] })),
  { name: 'wingL', parent: 'body', at: [5.5, 3, 27] },
  { name: 'wingR', parent: 'body', at: [-5.5, 3, 27] },
  { name: 'armL', parent: 'body', at: [6, 0, 23.5] },
  { name: 'handL', parent: 'armL', at: [12, -3, 15] },
  { name: 'armR', parent: 'body', at: [-6, 0, 23.5] },
  { name: 'handR', parent: 'armR', at: [-12, -3, 15] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
];

const phoenixLink = (c) => (c[2] < 34.5 ? 'wisp1' : c[2] < 37.5 ? 'wisp2' : 'wisp3');

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (near(rgb, RUFF)) return 'body';
  if (isAny(rgb, EYE)) return 'eyes';
  if (near(rgb, BIRD_EYE)) return 'wisp3';
  if (near(rgb, ORB_CORE)) return `hand${S}`;
  if (isAny(rgb, FLAMES)) {
    if (c[2] < 18 && f[0] > 8) return `hand${S}`;
    if (c[1] > 4 && Math.abs(c[2] - 23) < 2.5 && f[0] < 2.5) return 'body';
    return f[0] > 6.2 ? `wing${S}` : phoenixLink(c);
  }
  if (near(rgb, SILVER_HI)) return c[2] > 39 ? 'wisp3' : 'head';
  if (near(rgb, SILVER)) {
    if (f[0] > 8) return `arm${S}`;
    if (c[1] > 3.5 || c[2] < 24.5) return 'body';
    return 'head';
  }
  if (near(rgb, SHADE_HI) && c[1] < -3.5 && c[2] < 27 && f[0] < 7) return 'body';
  if (near(rgb, SHADE_HI) && c[2] > 29 && f[0] < 3 && c[1] < -4) return 'head';
  if (c[1] > 1.2 && c[2] > 24.5 && f[0] > 3.8) return `wing${S}`;
  const t = chainHit(c, TAIL, TAIL_R);
  return closest([
    ['body', Math.min(blobD(c, [[[5, 4.2, 3], [0, 0, 18]], [[7.5, 6.5, 2], [0, 0, 12]]]), ellD(c, [10.5, 9, 5], [0, 0, 9.5]),
      blobD(c, [[[5.6, 4.4, 4], [0, 0, 22.5]], [[4, 3.4, 3], [0, 0, 18]]]))],
    ['head', blobD(c, [[[4, 3.8, 4.2], [0, -0.8, 28]], [[2.6, 2.6, 2.4], [0, 1.4, 31.5]]])],
    [`arm${S}`, capD(f, [6, 0, 23.5], [10, -1, 19], 1.5, 1.3)],
    [`hand${S}`, Math.min(capD(f, [10, -1, 19], [12, -3, 15], 1.3, 1.1), ellD(f, [3.5, 3.5, 3.2], [12.6, -4.6, 13.5]))],
    [tail[Math.min(2, t.i)], t.d],
  ]);
}

// the wings beat slowly, open for the strike and the cheer
const wings = (open, beat = 0) => both('wing', { r: [0, open + beat, -open * 0.3] });
const add = {
  idle: (t, u) => wings(0, 4 * osc(u, 2)),
  walk: (t, u) => wings(-6, 6 * osc(u, 2)),
  idle_look: (t, u) => wings(0, 3 * osc(u, 2)),
  windup: (t, u) => wings(14 * smooth(u / 0.8)),
  lunge: (t, u) => wings(14 * K(u, [[0, 1], [0.3, 1], [0.5, -0.3], [1, 0]])),
  hurt: (t, u) => wings(-10 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])),
  faint: (t, u) => wings(-14 * smooth((u - 0.2) / 0.6)),
  celebrate: (t, u) => wings(16, 10 * Math.sin(TAU * 3 * u)),
  enter: (t, u) => wings(18 * win(u, 0.35, 0.95, 0.15)),
  idle_spin: (t, u) => wings(6 * win(u, 0.1, 0.85, 0.1), 4 * osc(u, 4)),
  idle_cackle: (t, u) => wings(4 * win(u, 0.08, 0.85, 0.08), 6 * osc(u, 8)),
};

const base = floaterClips({ tail, wisp, bob: 0.8, add });

const clips = {
  ...base,
  // fidget: spreads the burning wings wide and raises both orbs, the phoenix rearing and crying out
  idle_spread: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.9, 0]]);
      const cry = win(u, 0.35, 0.6, 0.06);
      return merge({
        body: { p: [0, 0, 0.8 * on], r: [-5 * on, 0, 0] },
        head: { r: [-8 * on, 0, 0] },
        ...wings(22 * on, 4 * osc(u, 4) * on),
        ...both('arm', { r: [-30 * on, -25 * on, 0] }),
        wisp1: { r: [-10 * on, 0, 0] },
        wisp2: { r: [-12 * on + 8 * cry, 0, 0] },
        wisp3: { r: [-16 * cry, 0, 4 * osc(u, 8) * cry] },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * osc(u, 2, -0.1 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, clips });
