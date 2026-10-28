// Shardling's rig: a stocky crystal golem with a big round head, the right fist gripping a prism dagger (raised) and
// the left one hanging. Its glowing eyes are joints (eyeL / eyeR) that squash to blink; the rainbow aura behind it
// (`aura`, off the body) breathes and the floating chips (`chips`, off the root) orbit. Numbers are
// scad/shardling.scad's; no lib.scad eye(), so no eyeKit.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { ellD, isAny, near } from './lib/geo.mjs';

const RAINBOW = [[1, 0.45, 0.45], [1, 0.7, 0.35], [1, 0.92, 0.4], [0.5, 0.9, 0.5], [0.45, 0.75, 1], [0.7, 0.55, 1]];
const GLOW = [0.7, 0.95, 1];
const H = [0, -1.5, 28];
const at = (d) => [H[0] + d[0], H[1] + d[1], H[2] + d[2]];
// the dagger: rotate([0, -12, 0]) of a 13.4 long prism from [-13.6, -6, 15], pommel 1.6 below
const SHARD = limb([-13.6 + 0.33, -6, 15 - 1.56], [-13.6 - 0.208 * 13.4, -6, 15 + 0.978 * 13.4], 1.8, 1.2);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5, 0, 6]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -1.5, 23] },
  ...pair('eye*', 'head', at([2.6, -7.5, 0.8])),
  { name: 'aura', parent: 'body', at: [0, 5.5, 23] },
  { name: 'chips', parent: 'root', at: [0, 0, 20] },
  ...pair('arm*', 'body', [10, 0, 20]),
  { name: 'foreL', parent: 'armL', at: [11.6, -0.3, 18.5] },
  { name: 'handL', parent: 'foreL', at: [12.3, -1, 12.2] },
  { name: 'foreR', parent: 'armR', at: [-11.8, -0.6, 19.4] },
  { name: 'handR', parent: 'foreR', at: [-13, -2.6, 15] },
];

const parts = [
  ['body', any(ell([10.4, 8.6, 8.6], [0, 0, 14.5]), ell([8, 3, 6], [0, -6.2, 14.5]))],
  ['head', any(ell([8, 7.6, 7.2], H), ell([6.4, 3, 4.6], at([0, -5.4, 0.6])), mx(ell([2.2, 0.8, 0.6], at([2.6, -7.6, 2.6]))))],
  ['arm*', ell([4.4, 4.4, 4], [10, 0, 20])],
  ['foreL', ell([3.4, 3.4, 4], [12, -0.5, 15])],
  ['handL', ell([3.8, 3.8, 3.6], [12.6, -1.5, 9.5])],
  ['foreR', ell([3.4, 3.4, 3.8], [-12.4, -1, 16])],
  ['handR', any(ell([3.4, 3.4, 3.2], [-13.4, -4, 13.5]), SHARD)],
  ['leg*', any(ell([3.6, 3.6, 3.4], [5, 0, 6]), ell([3.8, 4.8, 2.2], [5.4, -1, 2.2]))],
];

function assign(c, rgb) {
  if (near(rgb, GLOW) || (near(rgb, [1, 1, 1]) && c[2] > 26)) return c[0] >= 0 ? 'eyeL' : 'eyeR';
  if (isAny(rgb, RAINBOW)) {
    if (SHARD(c) < 1.4) return 'handR';
    if (Math.hypot(c[0], c[2] - 20) > 13.2) return 'chips';
    if (ellD(c, [8, 7.6, 7.2], H) < 1.06) return 'head';
    if (ellD(c, [10.4, 8.6, 8.6], [0, 0, 14.5]) < 1.12) return 'body';
    return 'aura';
  }
  return pick(c, parts);
}

// the eyes blink by squashing; the aura breathes and the chips orbit a whole number of turns per loop
const eyes = (k) => both('eye', { s: [1, 1, Math.max(0.12, k)] });
const fx = (u, turns, k = 1) => ({ aura: { s: 1 + 0.06 * k * osc(u, Math.max(1, Math.round(turns * 2))), r: [0, 4 * k * osc(u, 1), 0] }, chips: { r: [0, 360 * turns * u, 0] } });
const blinkAt = (u, a) => 1 - Math.max(0, 1 - Math.abs(u - a) / 0.03);
const base = bipedClips({
  hipH: 6, stride: 16, armSwing: 14, hopScale: 0.8, hopH: 2.5, droop: 0.5,
  // a stab with the prism dagger
  punch: { arm: [-75, 0, 0], fore: [-10, 0, 0] },
  cheer: { arm: [-6, -110, 0], fore: [0, 0, 0] },
  add: {
    idle: (t, u) => merge(fx(u, 1), eyes(blinkAt(u, 0.36) * blinkAt(u, 0.88))),
    walk: (t, u) => fx(u, 0),
    idle_look: (t, u) => merge(fx(u, 0), eyes(blinkAt(u, 0.32))),
    windup: (t, u) => merge(fx(u, 0, 1.5), eyes(1 - 0.4 * u)),
    lunge: (t, u) => merge(fx(u, 0, 2), eyes(0.6)),
    hurt: (t, u) => merge(fx(u, 0, 2), eyes(u > 0.06 ? 0.15 : 1)),
    recoil: (t, u) => eyes(1 - 0.85 * K(u, [[0, 0], [0.4, 1], [1, 0]])),
    faint: (t, u) => merge({ aura: { s: 1 - 0.6 * win(u, 0.3, 1.5, 0.4) } }, eyes(1 - 0.88 * Math.min(1, u * 3))),
    celebrate: (t, u) => merge(fx(u, 1, 2), eyes(1.15)),
    enter: (t, u) => merge({ aura: { s: 0.3 + 0.7 * Math.min(1, u * 1.5) }, chips: { r: [0, 360 * u, 0] } }, eyes(u < 0.4 ? 0.12 : 1)),
    exit: (t, u) => merge(fx(u, 0), eyes(u < 0.85 ? 0.5 : 0.12)),
  },
});

const clips = {
  ...base,

  // fidget: it flips the prism dagger round in its fist, catches it, and grins
  idle_twirl: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = win(u, 0.08, 0.85, 0.1);
      return merge({
        body: { r: [0, 0, -6 * up] },
        head: { r: [-4 * up, 6 * up, -12 * up] },
        armR: { r: [-25 * up, 10 * up, 0] },
        foreR: { r: [-20 * up, 0, 0] },
        handR: { r: [0, 360 * K(u, [[0.18, 0], [0.62, 1]]), 0] },
      }, fx(u, 0), eyes(blinkAt(u, 0.75)));
    },
  },

  // fidget: it puffs up and the aura flares wide, the chips race round, it gleams with its chin up
  idle_gleam: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = win(u, 0.12, 0.82, 0.12);
      return {
        body: { p: [0, 0, 0.3 * on], r: [-5 * on, 0, 0], s: [1 + 0.04 * on, 1 + 0.04 * on, 1] },
        head: { r: [-12 * on, 0, 8 * Math.sin(TAU * u) * on] },
        ...both('arm', { r: [0, -14 * on, 0] }),
        aura: { s: 1 + 0.3 * on, r: [0, 10 * Math.sin(TAU * 2 * u) * on, 0] },
        chips: { r: [0, 720 * u, 0] },
        ...eyes(1 + 0.25 * on),
      };
    },
  },
};

export default rigDef({ joints, assign, clips });
