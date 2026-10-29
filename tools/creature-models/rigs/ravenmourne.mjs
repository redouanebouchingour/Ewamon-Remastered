// Ravenmourne's rig: a tall cloaked raven (the feather cloak is the body) with wing panels hanging at its sides, a
// hooded head wearing the bone plague mask, a swinging crystal pendant and scaly legs under the hem. The eyes are
// glowing gems in the mask's sockets, not lib.scad's eye(): they blink and dim by scaling (gemL / gemR).
// Numbers are scad/ravenmourne.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { blinks } from './lib/face.mjs';
import { ellD, fold, isAny, near, petalD, side } from './lib/geo.mjs';

const BLACK = [0.12, 0.11, 0.15];
const PURPLE = [0.33, 0.2, 0.45];
const PURPLE_DK = [0.24, 0.15, 0.33];
const LEG = [[0.17, 0.17, 0.19], [0.3, 0.3, 0.32]];
const CRYSTAL = [0.55, 0.25, 0.8];
const GLOW = [0.9, 0.6, 1];
const SOCKET = [0.1, 0.05, 0.12];

const GEM = [2.4, -8.1, 33.6];
const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3.5, 1, 8] },
  { name: 'legR', parent: 'root', at: [-3.5, 1, 8] },
  { name: 'body', parent: 'root', at: [0, 1, 4] },
  { name: 'head', parent: 'body', at: [0, 0.5, 28] },
  { name: 'gemL', parent: 'head', at: GEM },
  { name: 'gemR', parent: 'head', at: [-GEM[0], GEM[1], GEM[2]] },
  { name: 'charm', parent: 'body', at: [0, -7.2, 20.4] },
  { name: 'wingL', parent: 'body', at: [9.6, 1.5, 25] },
  { name: 'wingR', parent: 'body', at: [-9.6, 1.5, 25] },
];

const wingD = (f) => Math.min(petalD(f, [2.2, 4.5, 12], [10.5, 1.5, 15], [0, -14, 0]),
  ...[0, 1, 2, 3].map((i) => petalD(f, [1.1, 2.4, 6], [11.5 + i * 0.6, -1.5 + i * 1.6, 8.5 - i * 0.3], [0, -22 - i * 4, 0])));

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (isAny(rgb, LEG, 0.03) && c[2] < 9) return `leg${S}`;
  if (isAny(rgb, [CRYSTAL, GLOW, SOCKET], 0.03) && c[2] > 32) return `gem${S}`;
  if (near(rgb, CRYSTAL, 0.03) && c[1] < -6.5 && c[2] < 20.5 && Math.abs(c[0]) < 1.5) return 'charm';
  if (isAny(rgb, [BLACK, PURPLE, PURPLE_DK], 0.03) && wingD(f) < 1.08) return `wing${S}`;
  if (c[2] > 29.5 || (c[2] > 25.5 && c[1] < -6.5 && ellD(c, [7, 6.5, 6], [0, 0.5, 26]) > 1.02)) return 'head';
  return 'body';
}

// the gems: blinking (squashed flat), flaring (bigger) or dimmed; the pendant swings
const gems = (k) => ({ gemL: { s: k }, gemR: { s: k } });
const blink = (u, at) => { const b = blinks(u, at); return gems([1, 1, Math.max(0.08, 1 - b)]); };
const swing = (a, cycles, u, ph = 0) => ({ charm: { r: [0, 0, a * osc(u, cycles, ph)] } });

const base = birdClips({
  flapUp: 45,
  add: {
    idle: (t, u) => merge(blink(u, [[0.3, 0.34], [0.84, 0.87]]), swing(4, 1, u)),
    walk: (t, u) => merge(swing(10, 1, u, 0.2), { charm: { r: [8, 0, 0] } }),
    windup: (t, u) => gems(1 + 0.4 * smooth(u)),
    lunge: (t, u) => merge(gems(1.4), swing(12, 1, u)),
    hurt: (t, u) => merge(gems([1, 1, 0.3]), swing(16, 2, u)),
    recoil: (t, u) => gems([1, 1, 1 - 0.8 * K(u, [[0, 0], [0.4, 1], [1, 0]])]),
    faint: (t, u) => merge(gems(Math.max(0.3, 1 - smooth((u - 0.3) / 0.6))), swing(10, 1.5, u)),
    celebrate: (t, u) => merge(gems(1.25), swing(14, 2, u)),
  },
});

const clips = {
  ...base,

  // fidget: throws its wings wide like a cape, the gems flare, then wraps them back round itself
  idle_cloak: {
    seconds: 2.6,
    pose: (t, u) => {
      const open = K(u, [[0, 0], [0.22, 1], [0.6, 1], [0.8, 0]]);
      return merge({
        body: { r: [-4 * open, 0, 0] },
        head: { r: [-8 * open, 0, 0] },
        wingL: { r: [0, -55 * open, -10 * open] },
        wingR: { r: [0, 55 * open, 10 * open] },
      }, gems(1 + 0.35 * open), swing(6, 2, u));
    },
  },

  // fidget: three slow, deep caws: the masked head bows and rises, the pendant jolting each time
  idle_caw: {
    seconds: 2.4,
    pose: (t, u) => {
      const caw = Math.max(0, Math.sin(TAU * 3 * ((u - 0.1) / 0.75))) * win(u, 0.1, 0.85, 0.04);
      return merge({
        body: { r: [6 * caw, 0, 0] },
        head: { r: [-14 * caw, 0, 0] },
        wingL: { r: [0, -10 * caw, 0] },
        wingR: { r: [0, 10 * caw, 0] },
      }, gems(1 + 0.2 * caw), swing(8, 3, u));
    },
  },
};
delete clips.idle_preen;
delete clips.idle_flap;

export default rigDef({ joints, assign, clips });
