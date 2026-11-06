// Solpyre Tenjin's rig: Solpyre's (rigs/solpyre.mjs) in the ascended colours. The halo behind the crown rides on the
// head; the floating sparks of light and the light veins stay on the body. Numbers are scad/solpyre_tenjin.scad's.
import { solpyreRig } from './solpyre.mjs';
import { near } from './lib/geo.mjs';

const HALO = [0.98, 0.88, 0.62];
const BEAD = [0.94, 0.58, 0.52];
const SPARK = [0.99, 0.94, 0.81];
const VEIN = [0.99, 0.84, 0.45];
const HC = [-1.73, 3.6, 27.6];   // the halo's centre, F(0.3, 32.6, 3.6): a ring of radius 9.4 (x stretched to 10.2) in XZ

const tenjin = (c, rgb) => {
  if (near(rgb, HALO, 0.02) || near(rgb, BEAD, 0.02)) {
    const r = Math.hypot((c[0] - HC[0]) * (9.4 / 10.2), c[2] - HC[2]);
    if (Math.abs(c[1] - HC[1]) < 0.6 && r > 8.7 && r < 10.1) return 'head';
  }
  if (near(rgb, SPARK, 0.015) || near(rgb, VEIN, 0.015)) return 'body';
  return null;
};

export default solpyreRig({
  head: [0.84, 0.38, 0.14],
  bodyRed: [0.75, 0.29, 0.16],
  orange: [0.85, 0.42, 0.15],
  tan: [0.8, 0.51, 0.3],
  claw: [0.53, 0.3, 0.18],
  flames: [[0.96, 0.71, 0.33], [0.97, 0.72, 0.34], [0.98, 0.9, 0.72], [0.9, 0.5, 0.16]],
  scales: [[0.82, 0.36, 0.18], [0.55, 0.19, 0.15], [0.9, 0.52, 0.2]],
}, { extra: tenjin });
