// Toxshade's rig: a hulking hunched black rat. Long bony arms reach forward to the ground, the head thrusts out low with
// a dropped jaw that drools, a smoky mane streams off its back and a bare tail curls up behind. Numbers are
// scad/toxshade.scad's; the head block is scaled 1.18 about [0, -1, 22] (HF). The Majin form imports the pieces below.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

export const FURS = [[0.23, 0.24, 0.26], [0.42, 0.44, 0.47], [0.11, 0.11, 0.14]];
const SKIN = [0.4, 0.33, 0.39];
const EAR = [0.58, 0.44, 0.5];
const RING = EAR.map((v) => v * 0.7);
const MOUTH = [0.3, 0.12, 0.25];
const FANG = [0.95, 0.93, 0.86];

export const HF = subFrame([0, -1, 22], [0, 0, 0], 1.18);
const hs = (p) => [p[0], p[1], p[2] - 22];
const H = (p) => HF.world(hs(p));

export const TAIL = [[2, 12, 6], [6, 16, 3], [11, 17, 3.5], [15, 15, 7], [17, 13, 12], [17.5, 12, 17], [16.5, 11, 21], [14.5, 10.5, 23.5], [12.5, 10.5, 23.5], [11.5, 11, 21.5]];
const TAIL_R = [1.8, 1.5, 1.3, 1.1, 1, 0.9, 0.8, 0.65, 0.5, 0.35];
export const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: hs([2.55, -13.6, 23.2]), size: 1.75, yaw: -35, flat: 0.5, frame: HF };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FURS[2] });

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [7.5, 3, 7]),
  { name: 'body', parent: 'root', at: [0, 4, 9] },
  { name: 'head', parent: 'body', at: [0, -6, 21] },
  { name: 'jaw', parent: 'head', at: H([0, -10, 20.2]) },
  ...pair('arm*', 'body', [7.5, -4, 22]),
  ...pair('fore*', 'arm*', [10.5, -8, 15]),
  ...pair('hand*', 'fore*', [9, -13, 9]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[3] },
  { name: 'tail3', parent: 'tail2', at: TAIL[5] },
  { name: 'tail4', parent: 'tail3', at: TAIL[7] },
  ...face.joints,
];

const WISPS = [[-2, -7, 26.5, 7, -2, -2], [2, -6, 27, 8, 2, 2], [0, -3, 27.5, 10, -1, 2.5], [-4, -1, 26.5, 9, -3, -2], [4, 0, 26.5, 10, 3, 2],
  [-1, 3, 26.5, 11, 0, -2.5], [2, 6, 26, 10, 1, 2], [-6, 4, 24, 8, -4, -2], [6, 5, 24, 9, 4, 2], [0, 9, 23, 9, 0, 2],
  [-4, 10, 20, 7, -3, -2], [4, 10, 20, 7, 3, 2], [-8, 0, 22, 6, -4, -1], [8, 1, 22, 6, 4, 1]];
const FLANK = [];
for (let row = 0; row < 3; row++) {
  for (let i = 0; i < 10; i++) {
    const a = ((-40 + i * 26 + row * 12) * Math.PI) / 180;
    const p = [9.2 * Math.sin(a), 4 + 8.6 * Math.cos(a) * (Math.cos(a) > 0 ? 1 : 0.8), 20 - row * 6];
    FLANK.push(limb(p, [p[0] + Math.sin(a) * 2, p[1] + Math.cos(a) * 1.5, p[2] - 5.5], 1.7, 0.5));
  }
}

export const parts = [
  ['body', any(blob([[[9.5, 8.5, 8], [0, 5, 9]], [[10, 9, 9], [0, 3.5, 18]], [[8.5, 7, 6], [0, -2.5, 22]], [[5.5, 5, 4.5], [0, -7, 21]]]),
    blob([[[6, 3, 6], [0, -4.5, 15]], [[5, 3, 4], [0, -5.5, 20]]]), ...FLANK,
    ...WISPS.map(([x, y, z, h, lean, curl]) => limb([x, y, z], [x + lean + curl, y + h * 0.95, z + h * 0.9], 2.4, 0.6)))],
  ['head', any(inFrame(HF, ell([5, 5, 4.4], hs([0, -9, 23]))), inFrame(HF, limb(hs([0, -9, 23]), hs([0, -19.4, 19.6]), 4.2, 1.3)),
    mx(inFrame(HF, ell([2.4, 1, 2.6], hs([4.4, -6.4, 27.2])))), mx(inFrame(HF, limb(hs([4.4, -11, 21.6]), hs([7.4, -7.6, 18.6]), 1.6, 0.4))),
    mx(inFrame(HF, limb(hs([4.4, -11.6, 25.2]), hs([1.3, -14.9, 24.3]), 1.2, 0.8))))],
  ['jaw', inFrame(HF, limb(hs([0, -12, 19.6]), hs([0, -17.4, 18]), 2.2, 0.9))],
  ['arm*', limb([7.5, -4, 22], [10.5, -8, 15], 3.4, 2.3)],
  ['fore*', limb([10.5, -8, 15], [9, -13, 9], 2.3, 1.6)],
  ['hand*', any(ell([2, 2, 2], [9, -13.6, 8.6]), limb([9, -13.6, 8.6], [9, -16.4, 4.4], 1.6), ell([3, 1, 1.4], [9, -16.4, 3.2]))],
  ['leg*', any(ell([4.5, 6.5, 6], [7.5, 3, 7]), blob([[[2.4, 5, 1.3], [7.8, -3, 1.3]], [[2, 2, 1.4], [7.8, 2, 1.6]]]), limb([6.4, -7.6, 1], [9.2, -9.4, 0.5], 0.8))],
  ...chain(['tail1', 'tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3', 'tail4', 'tail4'], TAIL, TAIL_R),
];

/** assign() for the toxin colours (drool and drips) and extra rules first. */
export const makeAssign = (TOX, rules = () => null) => (c, rgb) => {
  const r = rules(c, rgb);
  if (r) return r;
  if (isAny(rgb, TOX)) {
    if (c[1] < -16 && c[2] > 12) return 'jaw';                    // drool
    if (c[2] < 5) return pick(c, parts.filter(([n]) => n === 'hand*'));   // claw drips
    return pick(c, parts);                                        // blotches
  }
  if (near(rgb, MOUTH)) return 'jaw';
  if (near(rgb, FANG) || near(rgb, EAR)) return 'head';
  if (near(rgb, SKIN) && c[1] < -18 && c[2] > 20) return 'head';   // nose
  if (!isAny(rgb, [...FURS, SKIN, RING])) return 'head';          // eyes
  return pick(c, parts);
};

export const jawK = (k) => ({ jaw: { r: [k, 0, 0] } });

export const clipsFor = ({ face: f = face, extra = {} } = {}) => {
  const base = bipedClips({
    face: f, tail: tails, hipH: 7, stride: 12, armSwing: 14, hopScale: 0.25, droop: 0.5,
    // a raking claw swipe from overhead
    punch: { arm: [-70, 10, 0], fore: [-40, 0, 0] },
    cheer: { arm: [-40, -60, 0], fore: [-40, 0, 0] },
    add: {
      ...extra,
      idle: (t, u) => merge(jawK(3 * osc(u, 2, 0.3)), extra.idle?.(t, u)),
      lunge: (t, u) => merge(jawK(20 * K(u, [[0.1, 0], [0.35, 1], [0.6, 0.3], [1, 0]])), extra.lunge?.(t, u)),
      hurt: (t, u) => merge(jawK(14 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])), extra.hurt?.(t, u)),
      celebrate: (t, u) => merge(jawK(12 * win(u, 0, 1, 0.15)), extra.celebrate?.(t, u)),
    },
  });
  return {
    ...base,

    // fidget: it sniffs the air with quick snout twitches, then grins wide and drools
    idle_sniff: {
      seconds: 2.4,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.12, 1], [0.5, 1], [0.6, 0]]);
        const tw = Math.sin(TAU * 10 * u) * win(u, 0.12, 0.48, 0.03);
        const grin = win(u, 0.6, 0.95, 0.08);
        return merge({
          head: { r: [-12 * up + 2 * tw, 0, 3 * tw] },
          ...jawK(16 * grin),
          ...f.pose('open', 0.4 * grin + blinks(u, [[0.3, 0.35]])),
          ...both('arm', { r: [3 * up, 0, 0] }),
        }, extra.idle_sniff?.(t, u));
      },
    },

    // fidget: it rakes the ground with one claw, twice, glaring at the camera side
    idle_rake: {
      seconds: 2.2,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.1, 1], [0.8, 1], [0.95, 0]]);
        const rk = Math.max(0, Math.sin(TAU * 2 * (u - 0.15))) * win(u, 0.15, 0.75, 0.03);
        return merge({
          body: { r: [3 * on, 0, 4 * on] },
          head: { r: [4 * on, 0, 14 * on] },
          ...f.pose('open', 0.45 * on),
          armL: { r: [-20 * rk, 0, 0] }, foreL: { r: [-25 * rk + 20 * on, 0, 0] }, handL: { r: [30 * rk, 0, 0] },
        }, extra.idle_rake?.(t, u));
      },
    },
  };
};

export default rigDef({ joints, assign: makeAssign([[0.66, 0.36, 0.95], [0.85, 0.65, 1]]), extras: face.extras, clips: clipsFor() });
