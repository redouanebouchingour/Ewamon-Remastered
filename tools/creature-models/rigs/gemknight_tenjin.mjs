// Gemknight (Tenjin form): Gemknight's old-model rig (the base below) with the scad's changes: no ray burst, a golden
// halo over the helm that bobs on its own joint, and six motes of light (one joint at the waist) drifting round the
// knight.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blade, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';

// Gemknight's old-model rig (scad/gemknight_tenjin.scad is still a copy of that model); gemknight.mjs moved to its
// sprite-accuracy model on 2026-10-29. A prism sword held low in the right hand, a kite shield on the left forearm
// (handL), a cape of strips in two links and a burst of rainbow rays behind it (dropped here).
// the sword: grip at the fist, rotate([0, -150, 0]) turns the blade down and out
const SWORD = { p: [-11, -3, 16.5], d: [-0.5, 0, -0.866] };
const SHIELD = subFrame([11.5, -6, 21], [90, 0, -25]);
const AURA_C = [0, 6, 24];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.6, 0, 17]),
  { name: 'body', parent: 'root', at: [0, 0, 18] },
  { name: 'head', parent: 'body', at: [0, -0.6, 32.5] },
  ...pair('arm*', 'body', [8.6, -0.3, 28.5]),
  { name: 'foreL', parent: 'armL', at: [10.1, -1.6, 22.6] },
  { name: 'foreR', parent: 'armR', at: [-10, -1.4, 22.2] },
  { name: 'handL', parent: 'foreL', at: [10.6, -3.4, 20.5] },
  { name: 'handR', parent: 'foreR', at: SWORD.p },
  { name: 'cape1', parent: 'body', at: [0, 4.2, 31] },
  { name: 'cape2', parent: 'cape1', at: [0, 7.5, 16] },
];

// the cape's twelve strips: top -> mid on cape1, mid -> bottom on cape2
const strips = Array.from({ length: 12 }, (_, i) => {
  const t = i / 11 - 0.5;
  const top = [t * 12, 4.2, 31];
  const mid = [t * 18, 7 + Math.abs(t) * 2, 16];
  const bot = [t * 26 + (t > 0 ? 2 : -2), 9 + Math.abs(t) * 4, 2.5 + Math.abs(t) * 3];
  return [['cape1', limb(top, mid, 1, 1.2)], ['cape2', limb(mid, bot, 1.2, 1.5)]];
}).flat();

const parts = [
  ['leg*', any(ell([2.8, 3, 4.6], [3.6, 0, 15]), ell([2, 1.6, 2], [3.8, -2.6, 10.5]), ell([2.8, 2.8, 0.6], [3.8, 0, 12.6]),
    ell([2.4, 2.6, 4.6], [4, 0, 6]), ell([2.6, 4.4, 1.6], [4.2, -1.2, 1.6]))],
  ['body', any(ell([7.4, 5, 6.4], [0, 0, 26.5]), ell([5.6, 2, 4.8], [0, -3.8, 27]), ell([5.4, 4, 2.6], [0, 0, 20.5]),
    limb([0, -2.6, 19.5], [0, -3.4, 15.6], 1.2, 1), mx(ell([4, 4, 3.2], [7.4, 0, 31])), mx(ell([4.2, 4.2, 0.9], [7.6, 0, 29.4])),
    mx(ell([3.4, 3.6, 2.4], [8, 0, 28])), ell([8, 2.4, 1.6], [0, 3.2, 31.6]))],
  ['head', any(ell([3.6, 3.8, 4.2], [0, -0.6, 36]), ell([3, 3, 1.2], [0, -0.6, 32]))],
  ['armR', ell([2, 2, 3.6], [-9.2, -0.6, 25])],
  ['foreR', ell([2, 2, 3.4], [-10.6, -2, 19.5])],
  ['handR', any(ell([2, 2.2, 2], [-11, -3, 16.5]), blade(SWORD.p, SWORD.d, 17.5, 1.7, 1.6))],
  ['armL', ell([2, 2, 3.4], [9.6, -0.6, 25.5])],
  ['foreL', ell([2, 2.4, 3], [10.4, -2.4, 20.5])],
  ...strips,
];

/** The shield plate (kite polygon, its facets and a boss) in its own frame. */
const onShield = (c) => {
  const l = SHIELD.local(c);
  return l[2] > -1 && l[2] < 3 && Math.abs(l[0]) < 6 && l[1] > -11.5 && l[1] < 10.5;
};

function knightAssign(c, aura = true) {
  if (onShield(c)) return 'handL';
  // the rays of the aura: a thin ring of triangles at y 5.5..6 round the back
  if (aura && c[1] > 5.3 && c[1] < 6.3 && Math.hypot(c[0] / 9, (c[2] - AURA_C[2]) / 12) > 0.92) return 'aura';
  return pick(c, parts);
}

// the aura breathes and turns a little
const auraPulse = (u, cycles, amp = 1) => ({ aura: { s: 1 + 0.04 * amp * osc(u, cycles), r: [0, 4 * amp * osc(u, cycles / 2, 0.25), 0] } });

const clipsFor = (extra = {}) => {
  const add = {
    idle: (t, u) => auraPulse(u, 2),
    walk: (t, u) => auraPulse(u, 2, 0.6),
    windup: (t, u) => ({ aura: { s: 1 + 0.1 * smooth(u / 0.8) } }),
    lunge: (t, u) => { const hit = K(u, [[0.1, 0], [0.4, 1], [1, 0]]); return { aura: { s: 1.1 + 0.12 * hit }, handL: { r: [-10 * hit, 0, 0] } }; },
    hurt: (t, u) => ({ aura: { s: 1 - 0.15 * K(u, [[0, 0], [0.18, 1], [1, 0.3]]) } }),
    faint: (t, u) => ({ aura: { s: 1 - 0.6 * smooth((u - 0.1) / 0.7) } }),
    celebrate: (t, u) => ({ aura: { s: 1.12 + 0.08 * Math.sin(TAU * 2 * u), r: [0, 30 * smooth(u), 0] } }),
    enter: (t, u) => ({ aura: { s: 0.3 + 0.7 * smooth((u - 0.2) / 0.5) + 0.1 * win(u, 0.5, 0.9, 0.1) } }),
    exit: (t, u) => auraPulse(u, 2),
  };
  for (const [k, f] of Object.entries(extra)) { const a = add[k]; add[k] = (t, u) => merge(a?.(t, u), f(t, u)); }
  const base = bipedClips({
    hipH: 17, stride: 16, armSwing: 10, hopScale: 0.3, hopH: 3,
    cape: ['cape1', 'cape2'],
    punch: { arm: [-70, 0, 20], fore: [-25, 0, 0] },
    cheer: { arm: [-10, -115, 0], fore: [-10, 10, 0] },
    add,
  });
  const clips = {
    ...base,

    // fidget: raises the shield in front of the helm and peers over it, then lowers it
    idle_shield: {
      seconds: 2.4,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.18, 1], [0.75, 1], [0.92, 0]]);
        const peek = win(u, 0.35, 0.65, 0.06);
        return merge({
          body: { r: [2 * on, 0, 6 * on] },
          head: { r: [6 * on - 6 * peek, 0, -8 * on + 12 * peek] },
          armL: { r: [-35 * on, 0, -12 * on] },
          foreL: { r: [-40 * on, 0, 0] },
          armR: { r: [8 * on, 0, 0] },
        }, auraPulse(u, 2));
      },
    },

    // fidget: brings the sword up in a forward arc, the blade catching the light, and back down
    idle_flourish: {
      seconds: 2.2,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.85, 0]]);
        const tw = win(u, 0.3, 0.6, 0.06);
        return merge({
          body: { r: [0, 0, -6 * up] },
          head: { r: [-6 * up, 0, -12 * up] },
          armR: { r: [-40 * up, 0, 14 * up] },
          foreR: { r: [-30 * up, 0, 0] },
          handR: { r: [-50 * up, 0, 30 * tw * Math.sin(TAU * 2 * (u - 0.3))] },
        }, auraPulse(u, 2, 1.5));
      },
    },
  };
  // the form's layers on the fidgets too (the template clips took them through `add`)
  for (const k of ['idle_shield', 'idle_flourish']) {
    const f = clips[k].pose;
    if (extra[k]) clips[k].pose = (t, u) => merge(f(t, u), extra[k](t, u));
  }
  return clips;
};


const HALO = subFrame([0, 1.5, 38.5], [80, 0, 0]);
const MOTES = [[-9, 2, 34], [10, 1, 30], [-12, -2, 20], [13, -3, 12], [-6, -4, 38], [7, 3, 40]];

function assign(c) {
  const h = HALO.local(c);
  if (Math.hypot(Math.hypot(h[0], h[1]) - 5.2, h[2]) < 1) return 'halo';
  if (MOTES.some((m) => Math.hypot(c[0] - m[0], c[1] - m[1], c[2] - m[2]) < 0.8)) return 'motes';
  return knightAssign(c, false);
}

// the halo floats and tilts; the motes drift round the waist and bob
const drift = (u, cycles, amp = 1) => ({
  halo: { p: [0, 0, 0.35 * amp * osc(u, cycles)], r: [3 * amp * osc(u, cycles / 2, 0.25), 0, 0] },
  motes: { r: [0, 0, 25 * amp * osc(u, 1)], p: [0, 0, 0.6 * amp * osc(u, cycles, 0.3)] },
});

const clips = clipsFor({
  idle: (t, u) => drift(u, 2),
  walk: (t, u) => drift(u, 2, 0.5),
  idle_shield: (t, u) => drift(u, 2),
  idle_flourish: (t, u) => drift(u, 2),
  hurt: (t, u) => ({ halo: { r: [14 * Math.sin(TAU * 3 * u) * (1 - u), 0, 8 * Math.sin(TAU * 2 * u) * (1 - u)] } }),
  faint: (t, u) => { const d = smooth((u - 0.2) / 0.6); return { halo: { p: [0, 0, -1.2 * d], r: [-25 * d, 0, 10 * d] }, motes: { s: 1 - 0.9 * d } }; },
  celebrate: (t, u) => ({ halo: { p: [0, 0, 1.2 * Math.abs(Math.sin(TAU * u))], r: [0, 0, 0] }, motes: { r: [0, 0, 180 * smooth(u)], p: [0, 0, 1.5 * Math.sin(TAU * u)] } }),
  enter: (t, u) => ({ halo: { s: 0.2 + 0.8 * smooth((u - 0.15) / 0.5) }, motes: { s: smooth((u - 0.3) / 0.5) + 1e-3 } }),
});

export default rigDef({
  joints: [...joints, { name: 'halo', parent: 'head', at: [0, 1.5, 38.5] }, { name: 'motes', parent: 'root', at: [0, 0, 25] }],
  assign,
  clips,
});
