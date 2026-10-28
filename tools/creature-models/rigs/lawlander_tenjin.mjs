// Lawlander Tenjin's rig: Lawlander's body, hat, stalk and duster (the scad keeps every number), plus the gold halo with
// its jade stone behind the head on a joint of its own and the five golden motes drifting about. The gold veins
// follow their nearest part.
import { TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, inFrame } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';
import { assign, clipsFor, face, joints as base, parts as baseParts } from './lawlander.mjs';

// translate([4, 0, 38]) rotate([90, 0, 0]): a ring of radius 6.5 standing in the XZ plane
const HALO = subFrame([4, 0, 38], [90, 0, 0]);
const ring = (c) => Math.hypot(Math.hypot(c[0], c[1]) - 6.5, c[2]) / 0.45;
const MOTES = [[-13, -4, 30], [14, -6, 24], [-12, 2, 18], [15, 4, 14], [-10, -6, 36]];

const joints = [...base, { name: 'halo', parent: 'head', at: [4, 0, 38] },
  ...MOTES.map((p, i) => ({ name: `mote${i + 1}`, parent: 'root', at: p }))];
const parts = [...baseParts, ['halo', any(inFrame(HALO, ring), ell([1.4, 0.8, 1.4], [4, -0.2, 44.6]))],
  ...MOTES.map((p, i) => [`mote${i + 1}`, ell([0.8, 0.8, 1.1], p)])];

// the motes float on their own slow loops; the halo bobs
const drift = (u, k = 1) => Object.fromEntries(MOTES.map((_, i) => [`mote${i + 1}`,
  { p: [0.6 * k * osc(u, 1, i * 0.2), 0, 1.2 * k * osc(u, 1, 0.3 + i * 0.17)], r: [0, 0, 180 * u * (i % 2 ? 1 : -1)] }]));
const glow = {
  idle: (t, u) => ({ halo: { p: [0, 0, 0.3 * osc(u, 2)] }, ...drift(u) }),
  walk: (t, u) => drift(u, 0.5),
  idle_look: (t, u) => drift(u),
  celebrate: (t, u) => ({ halo: { p: [0, 0, 0.8 * win(u, 0, 1, 0.2)], r: [0, 8 * Math.sin(TAU * 2 * u), 0] }, ...drift(u, 2) }),
};

export default rigDef({ joints, assign: assign(parts), extras: face.extras, clips: clipsFor(glow) });
