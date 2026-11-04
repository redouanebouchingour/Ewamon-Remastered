// Lawlander Tenjin's rig: Lawlander's body, hat, cape and pose (the scad keeps every number; no grass stalk here), plus
// the gold halo with its jade stone behind the head on a joint of its own and the five peach motes drifting about. The
// gold veins follow their limb. The colour rules are this form's palette.
import { TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, inFrame } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';
import { assignWith, clipsFor, face, joints as base, parts as baseParts } from './lawlander.mjs';

// translate([-2.3, 5, 35]) rotate([90, 0, 30]): a ring of radius 4.4 in the frame's XY plane, the stone at [0, 4.4, 0]
const HALO_AT = [-2.3, 5, 35];
const HALO = subFrame(HALO_AT, [90, 0, 30]);
const ring = (c) => Math.hypot(Math.hypot(c[0], c[1]) - 4.4, c[2]) / 0.36;
const MOTES = [[-14.8, -4, 25.5], [-16.7, 2, 23.3], [6.1, 4, 33], [19.6, -2, 22.3], [15.8, 2, 7]];

const joints = [...base.filter((j) => j.name !== 'wheat'), { name: 'halo', parent: 'head', at: HALO_AT },
  ...MOTES.map((p, i) => ({ name: `mote${i + 1}`, parent: 'root', at: p }))];
const parts = [...baseParts.filter(([n]) => n !== 'wheat'),
  ['halo', inFrame(HALO, any(ring, ell([1.2, 1.2, 0.8], [0, 4.4, 0])))],
  ...MOTES.map((p, i) => [`mote${i + 1}`, ell([0.8, 0.8, 1.1], p)])];

const LEGS = ['legL', 'legR', 'body'];
const FORE = ['foreL', 'foreR', 'handL', 'handR'];
const rules = [
  [[[0.84, 0.77, 0.58], [0.72, 0.65, 0.48]], ['hat']],
  [[[0.9, 0.72, 0.3], [0.92, 0.74, 0.32], [0.5, 0.55, 0.38]], ['hat', 'halo']],
  [[[0.93, 0.72, 0.64]], MOTES.map((_, i) => `mote${i + 1}`)],
  [[[0.95, 0.78, 0.35]], [...LEGS, ...FORE]],
  [[[0.88, 0.82, 0.68], [0.74, 0.68, 0.6], [0.52, 0.45, 0.39], [0.34, 0.26, 0.22], [0.46, 0.38, 0.32], [0.28, 0.22, 0.21],
    [1, 0.95, 0.75]], ['head', 'body']],
  [[[0.37, 0.27, 0.2], [0.26, 0.19, 0.16], [0.62, 0.65, 0.68]], LEGS],
  [[[0.46, 0.33, 0.23]], FORE],
  [[[0.68, 0.6, 0.49], [0.9, 0.85, 0.74]], ['handL', 'handR']],
  [[[0.9, 0.84, 0.62]], ['armL', 'armR', 'foreL', 'foreR', 'body']],
  [[[0.4, 0.28, 0.2]], ['foreL', 'foreR', 'body', 'cape1', 'cape2']],
  [[[0.95, 0.91, 0.78]], ['body']],
];

// the motes float on their own slow loops; the halo bobs
const drift = (u, k = 1) => Object.fromEntries(MOTES.map((_, i) => [`mote${i + 1}`,
  { p: [0.6 * k * osc(u, 1, i * 0.2), 0, 1.2 * k * osc(u, 1, 0.3 + i * 0.17)], r: [0, 0, 180 * u * (i % 2 ? 1 : -1)] }]));
const glow = {
  idle: (t, u) => ({ halo: { p: [0, 0, 0.3 * osc(u, 2)] }, ...drift(u) }),
  walk: (t, u) => drift(u, 0.5),
  idle_look: (t, u) => drift(u),
  celebrate: (t, u) => ({ halo: { p: [0, 0, 0.8 * win(u, 0, 1, 0.2)], r: [0, 8 * Math.sin(TAU * 2 * u), 0] }, ...drift(u, 2) }),
};

export default rigDef({ joints, assign: assignWith(rules)(parts), extras: face.extras, clips: clipsFor(glow) });
