// Glaciarm's rig: a steel-blue knight with two huge ice fists held forward, each ringed by six frost shards that turn
// on their own joint (frostL / frostR; a sixth of a turn per loop keeps the loops seamless). The glowing eyes flare
// on their own joint. Numbers are scad/glaciarm.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { fold, near, side } from './lib/geo.mjs';

const GLOW = [0.6, 0.95, 1];
const ICE_LIGHT = [0.82, 0.94, 1];
const H = [0, -1.5, 36];
const FIST = [17.5, -7, 18];
const shardAt = (a) => [FIST[0] + 10 * Math.cos((a * Math.PI) / 180), FIST[1] + 1.5 * Math.sin((a * Math.PI) / 90), FIST[2] + 9 * Math.sin((a * Math.PI) / 180)];
const SHARDS = [0, 60, 120, 180, 240, 300].map(shardAt);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 0, 15]),
  { name: 'body', parent: 'root', at: [0, 0, 16] },
  { name: 'head', parent: 'body', at: [0, -1.3, 31.2] },
  { name: 'eyes', parent: 'head', at: [0, -6.9, 35.4] },
  ...pair('arm*', 'body', [11.5, 0, 28]),
  ...pair('fore*', 'arm*', [13.5, -1, 22]),
  ...pair('hand*', 'fore*', [15.5, -4.2, 19.6]),
  ...pair('frost*', 'hand*', FIST),
];

const parts = [
  ['leg*', any(limb([4, 0, 15], [5.5, -0.5, 9], 3.2, 2.9), ell([3, 3.1, 1], [5.5, -0.5, 9.6]), ell([2.4, 1.8, 2.4], [5.6, -3, 8.5]),
    ell([2.5, 2.5, 4], [6.6, -2.4, 12]), limb([5.5, -0.5, 8.5], [6, -0.5, 3], 3, 3.2), ell([3.5, 3.6, 0.9], [6, -0.5, 4]),
    blob([[[3.6, 5.4, 1.8], [6.2, -2, 1.8]], [[3, 3, 2], [6.2, 0.5, 2.4]]]))],
  ['body', any(blob([[[10, 7, 6], [0, 0, 27]], [[6.5, 5.5, 4], [0, 0, 19.5]]]), ell([7.5, 2, 4.2], [0, -5.6, 27.5]), ell([7.2, 6, 1.4], [0, 0, 16.3]),
    limb([0, -5.4, 15.4], [0, -5.2, 10.5], 1.5, 1), mx(ell([6.4, 6.4, 4.6], [11, 0, 31])), mx(ell([6.8, 6.8, 1.2], [11, 0, 28.6])),
    mx(ell([4, 4, 6], [11, 0.5, 37])))],
  ['head', any(blob([[[4.6, 5, 4.2], H], [[4.2, 4.4, 3.2], [0, -2.1, 33.4]]]), ell([0.9, 5.4, 4.6], [0, -1.5, 36.2]), ell([5, 4.8, 1], [0, -1.3, 31]),
    ell([3.5, 1, 2.5], [0, -6.1, 34.4]))],
  ['arm*', limb([11.5, 0, 28], [13.5, -1, 22], 2.6, 2.4)],
  ['fore*', any(limb([13.5, -1, 22], [15.5, -4, 19], 2.6, 3.2))],
  ['hand*', any(ell([3.4, 3.4, 1], [15.5, -4.2, 19.6]), ell([6.9, 6.9, 6.6], FIST), ell([6, 6, 5.7], [17.5, -9.4, 16.5]))],
];

function assign(c, rgb) {
  if (near(rgb, GLOW) && c[2] > 34 && c[1] < -5) return 'eyes';
  if (near(rgb, ICE_LIGHT)) {
    const f = fold(c);
    if (SHARDS.some((s) => Math.hypot(f[0] - s[0], f[1] - s[1], f[2] - s[2]) < 2)) return `frost${side(c)}`;
  }
  return pick(c, parts);
}

// the shard rings turn about the fists (y, in the ring's plane); 60 deg per loop closes it
const frost = (u, turns = 1, k = 1) => both('frost', { r: [0, -60 * turns * u, 0], s: k });
const flare = (k) => ({ eyes: { s: 1 + 0.35 * k } });

const base = bipedClips({
  hipH: 15, stride: 16, armSwing: 8, hopScale: 0.3, hopH: 3,
  punch: { arm: [-50, 0, 0], fore: [-20, 0, 0] },
  cheer: { arm: [0, -72, 0], fore: [0, 18, 0] },
  add: {
    idle: (t, u) => frost(u),
    walk: (t, u) => frost(u),
    idle_look: (t, u) => frost(u),
    windup: (t, u) => merge(frost(u, 1, 1 + 0.15 * smooth(u)), flare(smooth(u / 0.6))),
    lunge: (t, u) => merge(frost(u, 2), flare(K(u, [[0, 1], [0.4, 1.3], [1, 0]]))),
    hurt: (t, u) => merge(frost(u), { eyes: { s: [1, 1, 1 - 0.5 * K(u, [[0, 0], [0.2, 1], [1, 0]])] } }),
    recoil: (t, u) => frost(u),
    faint: (t, u) => ({ ...both('frost', { s: 1 - 0.9 * smooth((u - 0.1) / 0.6) + 1e-3 }), eyes: { s: [1, 1, 1 - 0.7 * smooth((u - 0.3) / 0.5)] } }),
    celebrate: (t, u) => merge(frost(u, 3, 1.1), flare(0.4)),
    enter: (t, u) => merge(frost(u, 1, 0.2 + 0.8 * smooth((u - 0.2) / 0.5)), flare(win(u, 0.5, 0.95, 0.1))),
    exit: (t, u) => frost(u),
  },
});

const clips = {
  ...base,

  // fidget: knocks the two ice fists together in front, frost flying, the eyes flaring
  idle_knock: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.86, 0]]);
      const knock = Math.max(0, Math.sin(TAU * 2 * ((u - 0.25) / 0.4))) * win(u, 0.25, 0.65, 0.02);
      return merge({
        body: { r: [3 * on, 0, 0] },
        head: { r: [6 * on, 0, 0] },
        ...both('arm', { r: [-25 * on, 0, -32 * on - 6 * knock] }),
        ...both('fore', { r: [-10 * on, 0, -10 * on] }),
      }, frost(u, 2, 1 + 0.25 * knock), flare(0.6 * knock));
    },
  },

  // fidget: the frost rings whirl a full turn while it clenches the fists and the eyes glow
  idle_whirl: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.85, 0.12);
      return merge({
        ...both('hand', { s: 1 + 0.06 * on }),
        ...both('fore', { r: [-8 * on, 0, 0] }),
        head: { r: [-4 * on, 0, 0] },
        ...both('frost', { r: [0, -360 * smooth((u - 0.1) / 0.75), 0], s: 1 + 0.2 * on }),
      }, flare(0.5 * on));
    },
  },
};

export default rigDef({ joints, assign, clips });
