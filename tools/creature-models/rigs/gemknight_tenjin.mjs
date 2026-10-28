// Gemknight (Tenjin form): Gemknight's rig (gemknight.mjs) with the scad's changes: no ray burst, a golden halo over the
// helm that bobs on its own joint, and six motes of light (one joint at the waist) drifting round the knight.
import { TAU, osc, rigDef, smooth } from './lib/anim.mjs';
import { subFrame } from './lib/geo.mjs';
import { clipsFor, joints, knightAssign } from './gemknight.mjs';

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
