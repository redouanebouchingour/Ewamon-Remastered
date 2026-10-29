// Solpyre Tenjin's rig: Solpyre's (rigs/solpyre.mjs) in the ascended amber colours. The halo behind the crest rides
// on the head; the floating sparks of light stay on the body. Numbers are scad/solpyre_tenjin.scad's.
import { solpyreRig } from './solpyre.mjs';
import { near } from './lib/geo.mjs';

const GOLD_HI = [1, 0.84, 0.35];

// the halo (a gold ring of radius 6 to 6.8 round [0, 1.5, 31] in the XZ plane behind the head) rides the head; the
// sparks of light floating out at the sides stay with the body (the veins are on the body anyway)
const halo = (c, rgb) => {
  if (!near(rgb, GOLD_HI, 0.03)) return null;
  const r = Math.hypot(c[0], c[2] - 31);
  if (Math.abs(c[1] - 1.5) < 0.6 && r > 5.6 && r < 7.2) return 'head';
  return Math.abs(c[0]) > 5.5 ? 'body' : null;
};

export default solpyreRig({
  body: [0.72, 0.32, 0.12],
  talon: [0.42, 0.28, 0.18],
  flames: [[1, 0.5, 0.12], [1, 0.72, 0.3], [1, 0.95, 0.75]],
}, { extra: halo });
