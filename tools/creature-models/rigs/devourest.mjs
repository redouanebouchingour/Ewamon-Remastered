// Devourest's rig: Malice grown into a horned indigo wraith, feathered violet wings, a glowing chest sigil (the core),
// painted crescent eyes and grin (decals: scaled a little, never shrunk far), a wisp tail curling on the ground.
// Numbers are scad/devourest.scad's (the old model; re-rig when the sprite-matched one lands).
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const BODY_HI = [0.3, 0.22, 0.45];
const WING = [[0.3, 0.2, 0.5], [0.62, 0.36, 0.8], [1, 0.55, 0.92]];
const GLOW = [1, 0.92, 0.55];
const SIGIL = [[1, 0.5, 0.92], [1, 0.85, 0.97]];
const SWIRL = [0.78, 0.4, 0.8];

const TAIL = [[0, 0, 15], [0, 0.5, 10], [1.5, 1, 6], [3.5, 1.5, 3], [5, 1, 1.2], [6.5, 0.5, 1.4], [7, 0, 2.6]];
const TAIL_R = [7, 5.4, 3.6, 2.3, 1.4, 0.8, 0.5];
const tail = TAIL.slice(1, -1).map((_, i) => `tail${i + 1}`);
const ARM = [[6, 0, 26], [10, 0, 22], [12, -0.5, 16], [13, -0.5, 12]];
const HORN = [[4, 0.5, 40.5], [6, 0.5, 44], [6.4, 0.6, 47], [8.4, 0.7, 48.8]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 15] },
  { name: 'core', parent: 'body', at: [0, -7.5, 21] },
  { name: 'head', parent: 'body', at: [0, 0, 28.5] },
  { name: 'eyes', parent: 'head', at: [0, -6.5, 36.4] },
  { name: 'mouth', parent: 'head', at: [0, -7, 31.5] },
  { name: 'wingL', parent: 'body', at: [6, 4, 31] },
  { name: 'wingR', parent: 'body', at: [-6, 4, 31] },
  { name: 'armL', parent: 'body', at: ARM[0] },
  { name: 'handL', parent: 'armL', at: ARM[2] },
  { name: 'armR', parent: 'body', at: [-6, 0, 26] },
  { name: 'handR', parent: 'armR', at: [-12, -0.5, 16] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i + 1] })),
];

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (near(rgb, GLOW)) return c[2] > 34 ? 'eyes' : 'mouth';
  if (isAny(rgb, SIGIL)) return 'core';
  if (near(rgb, SWIRL)) return 'body';
  if (isAny(rgb, WING)) return c[2] > 20 ? `wing${S}` : `hand${S}`;
  if (near(rgb, BODY_HI)) return 'head';
  const t = chainHit(c, TAIL, TAIL_R);
  const a = chainHit(f, ARM, [2.6, 2.2, 2.4, 2.6]);
  const h = chainHit(f, HORN, [1.8, 1.3, 0.9, 0.3]);
  return closest([
    ['body', ellD(c, [8, 7, 9], [0, 0, 21])],
    ['head', Math.min(ellD(c, [8, 7, 7.5], [0, 0, 35]), h.d)],
    [a.i < 2 ? `arm${S}` : `hand${S}`, a.d],
    [t.i === 0 ? 'body' : tail[Math.min(tail.length - 1, t.i - 1)], t.d],
    [`wing${S}`, ellD(f, [4, 1, 5], [6, 4, 31])],
  ]);
}

// the wings: a slow beat, spread wide for the strike and the cheer (ry < 0 lifts a wing reaching out along +X)
const wings = (open, beat = 0) => both('wing', { r: [0, -open - beat, 0] });
const add = {
  idle: (t, u) => wings(0, 5 * osc(u, 2)),
  walk: (t, u) => wings(4, 8 * osc(u, 2)),
  idle_spin: (t, u) => wings(8 * win(u, 0.1, 0.85, 0.1), 6 * osc(u, 6)),
  idle_cackle: (t, u) => wings(6 * win(u, 0.08, 0.85, 0.08), 5 * osc(u, 8)),
  windup: (t, u) => wings(18 * smooth(u / 0.8)),
  lunge: (t, u) => wings(18 * K(u, [[0, 1], [0.3, 1], [0.45, -0.4], [1, 0]])),
  hurt: (t, u) => wings(-10 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])),
  faint: (t, u) => wings(-16 * smooth((u - 0.2) / 0.6)),
  celebrate: (t, u) => wings(14, 14 * Math.sin(TAU * 3 * u)),
  enter: (t, u) => wings(20 * win(u, 0.35, 0.95, 0.15)),
};

const base = floaterClips({ tail, bob: 1, add });

const clips = {
  ...base,
  // fidget: opens the wings wide like a cloak and the sigil throbs, the grin stretching
  idle_loom: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.9, 0]]);
      const th = osc(u, 4) * 0.5 + 0.5;
      return merge({
        body: { p: [0, 0, 1.2 * on], r: [-6 * on, 0, 0] },
        head: { r: [8 * on, 0, 0] },
        eyes: { s: [1.05, 1, 1 - 0.15 * on] },
        mouth: { s: [1 + 0.15 * on, 1, 1 + 0.2 * on] },
        core: { s: 1 + 0.12 * on * th },
        ...wings(22 * on, 3 * osc(u, 4) * on),
        ...both('arm', { r: [0, -25 * on, 15 * on] }),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * osc(u, 2, -0.12 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, clips });
