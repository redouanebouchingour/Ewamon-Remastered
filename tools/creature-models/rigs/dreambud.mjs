// Dreambud's rig: a sleepy lavender cloud on stubby feet, a band of pink puffs, heavy-lidded eyes (squashed a little
// to blink, never far), a crescent moon on its brow that rocks, little stars drifting round it. Numbers are
// scad/dreambud.scad's (the old model; re-rig when the sprite-matched one lands). The feet stay on the root, so the
// cloud only bobs a little above them.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { ellD, isAny, near } from './lib/geo.mjs';

const LAV_DK = [0.6, 0.54, 0.84];
const MOON = [1, 0.88, 0.45];
const STARS = [[0.98, 0.58, 0.64], [0.55, 0.72, 0.98], [0.62, 0.48, 0.9]];
const EYE = [[1, 1, 1], [0.5, 0.42, 0.68], [0.12, 0.1, 0.16]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'eyes', parent: 'body', at: [0, -12.4, 19.8] },
  { name: 'moon', parent: 'body', at: [-3, -9.4, 25.5] },
  { name: 'stars', parent: 'root', at: [0, 0, 20] },
];

function assign(c, rgb) {
  if (near(rgb, LAV_DK) && c[2] < 5.4 && ellD(c, [3.6, 3.8, 2.8], [Math.sign(c[0]) * 5, -1, 2.6]) < 1.15) return 'root';
  if (isAny(rgb, EYE) && c[1] < -10 && Math.abs(c[2] - 19.5) < 3.5) return 'eyes';
  if (near(rgb, MOON)) return 'moon';
  if (isAny(rgb, STARS)) {
    // the two big ornaments sit on the cloud; the small ones drift
    if (ellD(c, [5, 5, 5], [11, -5, 26]) < 1 || ellD(c, [4, 4, 4], [-12.4, -3, 23]) < 1) return 'body';
    return 'stars';
  }
  return 'body';
}

// the moon rocks on the brow and the little stars drift round
const sky = (u, amp = 1, cycles = 1) => ({
  moon: { r: [0, 6 * amp * osc(u, cycles), 0] },
  stars: { r: [0, 0, 8 * amp * osc(u, cycles, 0.2)], p: [0, 0, 0.6 * amp * osc(u, cycles * 2)] },
});
const add = {
  idle: (t, u) => sky(u, 1, 1),
  walk: (t, u) => sky(u, 1.4, 1),
  idle_spin: (t, u) => sky(u, 2, 2),
  idle_cackle: (t, u) => sky(u, 1.5, 4),
  hurt: (t, u) => ({ moon: { r: [0, 18 * win(u, 0.05, 0.8, 0.1), 0] } }),
  faint: (t, u) => ({ moon: { r: [0, -30 * K(u, [[0.2, 0], [0.7, 1]]), 0] } }),
  celebrate: (t, u) => sky(u, 3, 2),
};

const base = floaterClips({ bob: 0.5, add });

const clips = {
  ...base,
  // fidget: nods off, sinking and squashing a little, the eyes drooping, then jolts awake
  idle_doze: {
    seconds: 3.2,
    pose: (t, u) => {
      const nod = K(u, [[0, 0], [0.35, 1], [0.72, 1], [0.76, -0.3], [0.9, 0]]);
      return merge({
        body: { r: [6 * nod, 0, 3 * nod], s: [1 + 0.03 * nod, 1 + 0.03 * nod, 1 - 0.05 * nod] },
        eyes: { s: [1, 1, 1 - 0.22 * Math.max(0, nod)] },
      }, sky(u, 0.6 + Math.max(0, nod), 1));
    },
  },
};

export default rigDef({ joints, assign, clips });
