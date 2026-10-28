// Astaroth's rig: a wolf-faced demon knight, greatsword low in the right hand, a katana in the left, bat wings and a
// spade-tipped tail. Numbers are scad/astaroth.scad's (the wings are drawn inside scale([1.25, 1, 1.15]) translate([0, 0, -3])).
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blade, blob, chain, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { near } from './lib/geo.mjs';

const WING = [0.6, 0.16, 0.17];
const WING_BONE = [0.18, 0.08, 0.09];
const TAIL = [[2, 4, 15], [6, 9, 11], [12, 10, 9], [16, 8, 12], [18, 6, 15]];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 0, 15]),
  { name: 'body', parent: 'root', at: [0, 0, 15] },
  { name: 'head', parent: 'body', at: [0, -0.5, 30.5] },
  { name: 'jaw', parent: 'head', at: [0, -3, 30.6] },
  { name: 'armL', parent: 'body', at: [8, 0, 26] },
  { name: 'foreL', parent: 'armL', at: [9.5, -1, 20] },
  { name: 'handL', parent: 'foreL', at: [9, -4, 14.6] },
  { name: 'armR', parent: 'body', at: [-8, 0, 26] },
  { name: 'foreR', parent: 'armR', at: [-9.5, -2, 20] },
  { name: 'handR', parent: 'foreR', at: [-9, -5.5, 14.6] },
  ...pair('wing*', 'body', [3.75, 4, 28.75]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
];

const parts = [
  ['body', any(ell([6, 4.5, 3.5], [0, 0, 15.5]), blob([[[5, 4, 4], [0, 0, 18]], [[8, 5.5, 4.5], [0, 0, 24]]]), ell([5.5, 5, 3.5], [0, 1, 30]),
    mx(ell([4, 4, 3.4], [8.2, 0, 27])), ell([3.5, 1, 5], [0, -3.6, 12.5]))],
  ['head', any(blob([[[4.2, 4, 3.8], [0, -1, 33]], [[2.2, 3, 2], [0, -5.6, 31.6]]]), mx(limb([3.2, -0.5, 35.5], [5, -0.5, 38], 1.2, 1)))],
  ['jaw', ell([2, 2.6, 1], [0, -5, 29.9])],
  ['leg*', any(limb([4, 0, 15], [5.5, -1.5, 9], 3.2, 2.6), limb([5.5, -1.5, 9], [5.8, 1, 3], 2.4, 1.8),
    blob([[[2.2, 3.4, 1.2], [5.8, -1.5, 1.2]], [[1.6, 1.6, 1.2], [5.8, 1, 1.5]]]))],
  ['armL', limb([8, 0, 26], [9.5, -1, 20], 2.6, 2.2)],
  ['foreL', any(limb([9.5, -1, 20], [9, -3.5, 15.5], 2.2, 2), ell([2.4, 2.4, 2.4], [9.3, -2.2, 17.8]))],
  ['handL', any(ell([2, 2, 1.8], [9, -4, 14.6]), limb([9, -4, 13.8], [14, -7, 1.9], 1.2, 0.8))],
  ['armR', limb([-8, 0, 26], [-9.5, -2, 20], 2.6, 2.2)],
  ['foreR', any(limb([-9.5, -2, 20], [-9, -5, 15.5], 2.2, 2), ell([2.4, 2.4, 2.4], [-9.3, -3.5, 17.8]))],
  ['handR', any(ell([2, 2, 1.8], [-9, -5.5, 14.6]), blade([-9, -5.5, 14.6], [-0.7, -0.35, -0.62], 17, 2.8, 4.5))],
  ...chain(tails, TAIL, [1.6, 1.3, 1.0, 0.8, 0.6]),
  ['tail4', ell([2, 1.2, 2.4], [18.6, 5.5, 16.2])],
];

function assign(c, rgb) {
  if (near(rgb, WING, 0.03) || near(rgb, WING_BONE, 0.03)) return c[0] >= 0 ? 'wingL' : 'wingR';
  return pick(c, parts);
}

const base = bipedClips({
  tail: tails, hipH: 15, stride: 18, armSwing: 12, hopScale: 0.5,
  wing: { open: [0, -18, 10], flap: 16 },
  punch: { arm: [-75, 10, 0], fore: [-25, 0, 0] },
  cheer: { arm: [-15, -55, 0], fore: [-25, 15, 0] },
  add: {
    idle: (t, u) => ({ jaw: { r: [2 * Math.max(0, osc(u, 2, 0.1)), 0, 0] } }),
    lunge: (t, u) => ({ jaw: { r: [14 * win(u, 0.3, 0.7, 0.08), 0, 0] } }),
    celebrate: (t, u) => ({ jaw: { r: [12 * win(u, 0, 1, 0.15), 0, 0] }, head: { r: [-12 * win(u, 0, 1, 0.15), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: the wings unfurl wide and give two slow beats, head lifted, then fold back
  idle_wingstretch: {
    seconds: 3,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.95, 0]]);
      const beat = Math.sin(TAU * 2 * smooth((u - 0.2) / 0.55)) * on;
      return {
        body: { r: [-4 * on, 0, 0] },
        head: { r: [-10 * on, 0, 0] },
        jaw: { r: [4 * on, 0, 0] },
        ...both('wing', { r: [0, -20 * on + 16 * beat, 12 * on] }),
        ...both('arm', { r: [0, -6 * on, 0] }),
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 0, 6 * (1 + 0.3 * i) * osc(u, 1)] }])),
      };
    },
  },

  // fidget: it drags the greatsword's tip in a slow arc, rolls its head, and the spade tail cracks like a whip
  idle_menace: {
    seconds: 2.4,
    pose: (t, u) => {
      const drag = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.8, 0]]);
      const flick = win(u, 0.55, 0.75, 0.05);
      return {
        body: { r: [3 * drag, 0, -6 * drag] },
        head: { r: [6 * drag, 8 * drag, -14 * drag] },
        armR: { r: [-12 * drag, 0, 0] },
        foreR: { r: [0, 0, 18 * drag] },
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [-12 * flick * (1 + 0.4 * i), 0, 10 * Math.sin(TAU * 2 * u) * (0.3 + flick)] }])),
      };
    },
  },
};

export default rigDef({ joints, assign, clips });
