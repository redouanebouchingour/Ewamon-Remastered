// Lithokrysm's rig: a hunched stone warrior with a slate helm under a crystal crown and two huge layered-rock shields
// for forearms (fore*, pivot at the elbow). It has no lib.scad eyes (glowing red slits), so no lids. Numbers are
// scad/lithokrysm.scad's.
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';

const SHIELD = subFrame([12.5, -3, 19], [0, -14, -20]);
const cry = (p, d, r) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], r * 1.05, r * 0.4);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.2, 0, 12.5]),
  { name: 'body', parent: 'root', at: [0, 0.5, 14] },
  { name: 'head', parent: 'body', at: [0, -2, 27] },
  ...pair('arm*', 'body', [7, 0, 26]),
  ...pair('fore*', 'arm*', [10.5, -1, 23]),
];

const parts = [
  ['body', any(blob([[[6, 4.6, 4.2], [0, 0, 24]], [[4.2, 3.6, 3], [0, 0.5, 17.5]]]), limb([0, 4, 17], [0, 4, 26], 2.6, 2.6), ell([5, 3.6, 2.8], [0, 0.5, 15]),
    mx(ell([3.6, 3.4, 3.2], [6.5, 0, 26.5])), ell([6, 5, 9], [0, 0, 22]))],
  ['head', any(blob([[[6.4, 6.4, 5], [0, -3, 30]], [[3.8, 3.2, 3.2], [0, -8.5, 28]]]), ell([4.8, 4.6, 3.4], [0, -2, 26.8]), ell([6.5, 4, 2.5], [0, -1, 33.5]),
    cry([0, -1, 33.5], [0, 0.6, 9.5], 1.5), mx(cry([2.4, -2, 33.5], [0.8, 0.2, 8], 1.3)), mx(cry([4.4, -1, 33], [2, 0.8, 8], 1.3)),
    mx(cry([5.6, 0.5, 32], [3.8, 1.2, 6.5], 1.2)), mx(cry([6.2, 2, 30.5], [5.2, 1.5, 4], 1.1)), mx(cry([1.8, 1.5, 33], [0.6, 1.4, 6.5], 1.1)),
    mx(ell([2, 1.2, 1.4], [4, -8.4, 28.4])))],
  ['arm*', limb([7, 0, 26], [10.5, -1, 23], 2.2, 2)],
  ['fore*', inFrame(SHIELD, any(ell([7, 3.2, 10], [0, 0, 0]), ell([10, 3, 14], [0, 0, -3])))],
  ['leg*', any(ell([2.8, 3, 3.4], [4.2, 0, 12.5]), limb([4.4, 0, 11], [5.6, -1.5, 7], 2.4, 2.2), ell([1.6, 1.4, 1.4], [5.6, -2.8, 8.6]),
    limb([5.8, -1.2, 0], [5.8, -1.2, 7], 2.7, 2.4), limb([5.8, -3.4, 0.7], [5.8, -5.4, 0.2], 1.8, 0.3))],
];

const base = bipedClips({
  hipH: 12.5, stride: 14, armSwing: 8, hopScale: 0, droop: 0.6,
  // a shield bash: the right shield swings forward and in
  punch: { arm: [-55, 0, 15], fore: [-15, 0, 0] },
  cheer: { arm: [-10, -55, 0], fore: [0, 0, 0] },
});

const clips = {
  ...base,

  // fidget: it clashes its two shields together in front of it, the crystals ringing with a shiver
  idle_clash: {
    seconds: 2.2,
    pose: (t, u) => {
      const shut = K(u, [[0, 0], [0.25, 1], [0.32, 0.85], [0.4, 1], [0.6, 1], [0.85, 0]]);
      const ring = Math.sin(TAU * 10 * u) * win(u, 0.25, 0.6, 0.05);
      return {
        body: { r: [5 * shut, 0, 0] },
        head: { r: [4 * shut + 1.5 * ring, 0, 1.5 * ring] },
        ...both('arm', { r: [-30 * shut, 0, -25 * shut] }),
        ...both('fore', { r: [0, 0, -15 * shut] }),
      };
    },
  },

  // fidget: a heavy stomp of one boot, a shake of dust off the shields
  idle_stomp: {
    seconds: 2,
    pose: (t, u) => {
      const lift = win(u, 0.1, 0.4, 0.12);
      const sh = Math.sin(TAU * 8 * u) * win(u, 0.4, 0.7, 0.04);
      return {
        root: { r: [0, -3 * lift, 0] },
        legL: { r: [-18 * lift, 3 * lift, 0] },
        body: { r: [0, 2 * lift, 2 * sh] },
        head: { r: [3 * sh, 0, 0] },
        ...both('fore', { r: [2 * sh, 3 * sh, 0] }),
        ...both('arm', { r: [0, -4 * osc(u, 1), 0] }),
      };
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), clips });
