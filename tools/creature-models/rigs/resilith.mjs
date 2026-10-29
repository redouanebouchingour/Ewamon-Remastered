// Resilith's rig: Resilian's (rigs/resilian.mjs) with Resilith's bigger wings, heavier legs, the brown mask and the
// crystal sprigs on the tuft stalks. Numbers are scad/resilith.scad's.
import { RESILIAN, resilianRig } from './resilian.mjs';
import { ellD, isAny } from './lib/geo.mjs';

const MASK = [[0.42, 0.28, 0.2], [0.85, 0.5, 0.2], [0.95, 0.9, 0.8]];
const GREEN = [0.45, 0.6, 0.22];

export default resilianRig({
  ...RESILIAN,
  eye: { side: 'L', at: [2.1, -13.6, 8.6], size: 1.5, yaw: 12, flat: 0.5 },
  skin: [0.3, 0.42, 0.15],
  wings: [[[2.5, -3, 14.5], [70, -35, 8], 18, 6.5], [[2.5, -1, 13.5], [70, 0, 28], 16, 6]],
  leg: (i) => { const b = [2.6, -6 + i * 2.6, 8.5]; const k = [b[0] + 5, b[1] - 1 + (i - 1) * 1.2, b[2] - 1.5]; return [b, k, [k[0] + 1.6, k[1] - 1.2, k[2] - 5.5]]; },
  legR: [0.9, 0.8, 0.6],
  WING: [[0.82, 0.3, 0.35], [0.7, 0.88, 0.5]],
  TUFT: [[0.62, 0.92, 0.66], [0.85, 1, 0.85]],
  extra: (c, rgb, f, S) => {
    if (isAny(rgb, MASK, 0.03) && c[1] < -9) return 'head';
    // the green armour plates on the shins
    if (isAny(rgb, [GREEN], 0.03) && c[2] < 8 && f[0] > 5) {
      const i = [0, 1, 2].map((k) => ellD(f, [1.6, 1.6, 1.9], [7.8, -6 + k * 2.6 - 1.2 + (k - 1) * 1.2, 5.8])).reduce((a, d, k, all) => (d < all[a] ? k : a), 0);
      return `leg${i + 1}${S}`;
    }
    return null;
  },
});
