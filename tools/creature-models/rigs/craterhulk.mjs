// Craterhulk's rig: a golem of stacked meteor boulders with huge molten fists and pebbles orbiting beside its
// shoulders on aqua trails. The fist is the forearm joint (fore), so the template's punch bends it. Numbers are
// scad/craterhulk.scad's.
import { K, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, ell, mx, pair, pick } from './lib/biped.mjs';
import { near } from './lib/geo.mjs';

const TRAIL = [0.55, 0.8, 0.8];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5.2, 0, 11.5]),
  { name: 'body', parent: 'root', at: [0, 0.3, 13] },
  { name: 'head', parent: 'body', at: [0, -0.8, 30.5] },
  ...pair('arm*', 'body', [13.5, 0.2, 24.5]),
  ...pair('fore*', 'arm*', [14.6, -0.5, 17.5]),
  ...pair('orbit*', 'body', [17, 0, 31]),
];

const parts = [
  ['body', any(ell([10.5, 6.2, 9], [0, 0, 22]), ell([6, 5, 4], [0, 0.5, 13.6]), mx(ell([3.2, 3.2, 3.2], [6, -3, 16])),
    mx(ell([3.4, 3.4, 3.4], [8.6, 1, 22])), mx(ell([6, 5.6, 5.6], [11.5, 0.5, 29])))],
  ['head', any(ell([5.6, 5, 5], [0, -1, 34]), ell([5, 1.6, 1.2], [0, -4.6, 35.4]))],
  ['arm*', ell([3.6, 3.6, 4.4], [14, 0, 21])],
  ['fore*', ell([6, 5.6, 6.4], [15, -1, 12])],
  ['leg*', any(ell([4.2, 4.2, 4], [5.2, 0, 11.5]), ell([4, 4.4, 3.6], [5.6, -0.6, 4.6]), ell([4.4, 5.4, 2.2], [5.8, -1.6, 1.6]))],
  ['orbit*', any(ell([1.4, 1.4, 1.4], [22, -1, 34]), ell([1.1, 1.1, 1.1], [21.5, -1, 27]), ell([1, 1, 1], [19, 0, 38]))],
];

const assign = (c, rgb) => (near(rgb, TRAIL) ? `orbit${c[0] >= 0 ? 'L' : 'R'}` : pick(c, parts));

// the pebbles drift round their arcs (ry turns them in the arc's plane), never fully round: the shoulder is in the way
const drift = (u, amp, cycles = 1) => both('orbit', { r: [0, amp * osc(u, cycles), 0] }, { r: [0, amp * osc(u, cycles, 0.5), 0] });

const base = bipedClips({
  hipH: 11.5, stride: 14, armSwing: 10, hopScale: 0.2,
  punch: { arm: [-60, 0, 0], fore: [-40, 0, 0] },
  cheer: { arm: [-6, -100, 0], fore: [-8, 10, 0] },
  add: {
    idle: (t, u) => drift(u, 14),
    walk: (t, u) => drift(u, 8, 2),
    idle_look: (t, u) => drift(u, 10),
    celebrate: (t, u) => drift(u, 22, 2),
    hurt: (t, u) => both('orbit', { r: [10 * K(u, [[0, 0], [0.2, 1], [1, 0]]), -18 * K(u, [[0, 0], [0.2, 1], [1, 0]]), 0] }),
    faint: (t, u) => both('orbit', { r: [0, 30 * smooth((u - 0.2) / 0.6), 0] }),
  },
});

const clips = {
  ...base,

  // fidget: it watches one pebble swing the long way round its arc and back, head turning after it
  idle_orbit: {
    seconds: 2.6,
    pose: (t, u) => {
      const a = K(u, [[0, 0], [0.1, 0], [0.45, -55], [0.6, -55], [0.85, 20], [1, 0]]);
      return merge({
        body: { r: [0, 0, 0.08 * a] },
        head: { r: [-0.15 * Math.abs(a), 0, -0.3 * a] },
        orbitL: { r: [0, a, 0] },
        orbitR: { r: [0, 6 * osc(u, 1), 0] },
        ...both('arm', { r: [0, -3 * win(u, 0.1, 0.9, 0.1), 0] }),
      });
    },
  },

  // fidget: rolls its neck one way and the other, a shrug of the boulder shoulders, a grinding nod
  idle_crack: {
    seconds: 2.4,
    pose: (t, u) => {
      const roll = K(u, [[0, 0], [0.12, 0], [0.32, 1], [0.52, -1], [0.66, 0]]);
      const shrug = win(u, 0.66, 0.86, 0.06);
      return {
        body: { r: [0, 2 * roll, 0] },
        head: { r: [-6 * Math.abs(roll) + 6 * win(u, 0.86, 0.96, 0.03), 14 * roll, 8 * roll] },
        ...both('arm', { p: [0, 0, 0.9 * shrug], r: [0, -4 * shrug, 0] }),
        ...drift(u, 8),
      };
    },
  },
};

export default rigDef({ joints, assign, clips });
