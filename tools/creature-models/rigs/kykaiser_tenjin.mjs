// Kykaiser Tenjin's rig: Kykaiser's body, blades and tail (the scad keeps every number, only the colours change), plus
// the gold halo with its pearl behind the head, which floats on a joint of its own and turns slowly.
import { K, TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, inFrame } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';
import { assign, clipsFor, face, joints as base, parts as baseParts } from './kykaiser.mjs';

// translate([0, 4.5, 33]) rotate([-12, 0, 0]): a ring of radius 8.5 in the local XZ plane, a pearl at its top
const HALO = subFrame([0, 4.5, 33], [-12, 0, 0]);
const ring = (c) => Math.hypot(Math.hypot(c[0], c[2]) - 8.5, c[1]) / 0.35;

const joints = [...base, { name: 'halo', parent: 'head', at: [0, 4.5, 33], rot: [-12, 0, 0] }];
const parts = [...baseParts, ['halo', inFrame(HALO, any(ring, ell([0.9, 0.9, 0.9], [0, 0, 8.5])))]];

// the halo hovers on a slow bob and sways; it spins up on the celebration
const halo = {
  idle: (t, u) => ({ halo: { p: [0, 0, 0.3 * osc(u, 2)], r: [0, 4 * osc(u, 1), 0] } }),
  walk: (t, u) => ({ halo: { p: [0, 0, 0.2 * osc(u, 2, 0.2)] } }),
  hurt: (t, u) => ({ halo: { r: [0, 10 * Math.sin(TAU * 3 * u) * (1 - u), 0] } }),
  faint: (t, u) => ({ halo: { r: [0, 0, 0], p: [0, 0, -0.6 * K(u, [[0.2, 0], [0.8, 1]])] } }),
  celebrate: (t, u) => ({ halo: { r: [0, 360 * u, 0], p: [0, 0, 0.6 * win(u, 0, 1, 0.2)] } }),
};

const clips = clipsFor(halo);
export default rigDef({ joints, assign: assign(parts), extras: face.extras, clips });
