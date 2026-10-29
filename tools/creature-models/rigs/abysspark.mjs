// Abysspark's rig: a heavy spiny anglerfish on its ragged belly fins: a gaping lower jaw, wing-like pectoral fins, a
// spiked dorsal crest, a three-link tail ending in a forked fin and an angler stalk to a crackling lure. Numbers are
// scad/abysspark.scad's. abyssparkRig({ tenjin: true }) is the Tenjin form (jade feather fins, gold veins, a halo).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { fishClips } from './lib/fish.mjs';
import { chainHit, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const NAVY_HI = [0.2, 0.32, 0.62];
const NAVY_DK = [0.06, 0.1, 0.3];
const CYAN = [0.25, 0.8, 0.9];
const TOOTH = [0.95, 0.95, 0.92];
const MAWS = [[0.65, 0.08, 0.1], [0.06, 0.12, 0.3]];
const JADES = [[0.7, 0.9, 0.78], [0.86, 0.97, 0.88]];
const YELLOW_HI = [1, 0.97, 0.65];

const STALK = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
  .map((t) => [1 * t, -8 - 12 * t, 26 + 10 * Math.sin(t * Math.PI) + 7.5 * t]);
const STALK_R = STALK.map((_, i) => 0.8 - i * 0.03);
const LURE = [1, -20, 31];
const lure = ['lure1', 'lure2', 'lure3'];
const LURE_AT = [STALK[0], STALK[4], STALK[7]];
const TAIL = [[0, 13, 13], [0, 18, 12], [0, 22, 13]];
const tail = ['tail1', 'tail2', 'tail3'];

export function abyssparkRig({ tenjin = false } = {}) {
  const eyeL = { side: 'L', at: [4.7, -11.7, 21.1], size: 2.2, yaw: 30, squash: 0.6 };
  const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: NAVY_DK });

  const joints = [
    { name: 'root', at: [0, 0, 0] },
    { name: 'body', parent: 'root', at: [0, -2, 9] },
    { name: 'jaw', parent: 'body', at: [0, -8, 14] },
    ...pair('fin*', 'body', [7, -2, 17]),
    { name: 'dorsal1', parent: 'body', at: [0, -5, 25] },
    ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
    ...lure.map((name, i) => ({ name, parent: i === 0 ? 'body' : lure[i - 1], at: LURE_AT[i] })),
    ...face.joints,
  ];

  const parts = [
    ['body', any(blob([[[8, 9, 9], [0, -5, 18]], [[7, 7, 7.5], [0, 4, 16]]]),
      blob([[[6.5, 4, 2.2], [0, -8.5, 24.5]], [[3.5, 2.5, 1.6], [0, -11.5, 23.6]]]),
      ...[[3.5, -8, 7, 30], [5, -1, 7, 15], [3, 6, 8, 0], [-3.5, -8, 7, 30], [-5, -1, 7, 15], [-3, 6, 8, 0]]
        .map(([x, y, z, a]) => petal([0.8, 2.6, 6], [x, y, z], [a, x > 0 ? 25 : -25, 0])),
      ell([6, 4, 4], [4.7, -11.7, 21.1]), ell([6, 4, 4], [-4.7, -11.7, 21.1]))],
    ['jaw', any(blob([[[6.8, 4, 3], [0, -10, 11.5]], [[5, 3, 2.2], [0, -14.5, 12]]]), petal([0.8, 2, 4], [0, -12, 7], [-30, 0, 0]),
      ell([1, 3, 1.4], [5.2, -11.8, 13]), ell([1, 3, 1.4], [-5.2, -11.8, 13]))],
    ['dorsal1', any(...[0, 1, 2, 3].map((i) => petal([0.9, 3.5, 7.5 - i * 1.2], [0, -6 + i * 4.5, 26 - i * 1.6], [-50, 0, 0])),
      ...[0, 1, 2, 3, 4].flatMap((i) => [1, -1].map((s) => spike([2.6 * s, -4 + i * 4, 25 - i * 2], [1.5 * s, 1.6, 3.2 - i * 0.3], 1.1))))],
    ['tail1', any(limb(TAIL[0], TAIL[1], 3, 2), ell([3.2, 4, 3.5], [0, 13, 13]))],
    ['tail2', limb(TAIL[1], TAIL[2], 2, 1.4)],
    ['tail3', any(...[1, -1].map((s) => { const a = ((s * 45 - 5) * Math.PI) / 180; const k = tenjin ? 5 : 4; return petal(tenjin ? [0.9, 6.5, 2.6] : [0.9, 5, 2.2], [0, 22 + k * Math.cos(a), 13 + k * Math.sin(a)], [s * 45 - 5, 0, 0]); }))],
  ];

  function assign(c, rgb) {
    const f = fold(c);
    const S = side(c);
    if (near(rgb, YELLOW_HI) || ellD(c, [7.5, 7.5, 7.5], LURE) < 1) return 'lure3';
    const h = chainHit(c, STALK, STALK_R);
    if (h.d < 1.4 && c[2] > 25.5 && c[1] < -7.5) return lure[h.i < 4 ? 0 : h.i < 7 ? 1 : 2];
    if (isAny(rgb, [TOOTH, ...MAWS], 0.03) && c[1] < -11) return c[2] < 15.5 ? 'jaw' : 'body';
    // pectoral fins: the plain one's navy-hi wing and cyan ray tips, the Tenjin's jade feathers with gold edges
    if (f[0] > 8.6 && c[1] < 14 && c[2] > 9) return `fin${S}`;
    if (!tenjin && near(rgb, NAVY_HI) && c[1] < 14) return `fin${S}`;
    if (tenjin && isAny(rgb, JADES, 0.03) && f[0] > 6.5 && c[2] > 11 && c[1] < 14) return `fin${S}`;
    if (near(rgb, CYAN) && f[0] > 14) return `fin${S}`;
    if (c[1] > 12.5 && f[0] < 3.5 && c[2] < 20) {
      const t = chainHit(c, [...TAIL, [0, 30, 13]], [3, 2, 1.4, 1.4]);
      return tail[Math.min(2, t.i)];
    }
    return pick(c, parts);
  }

  const clips = fishClips({ face, tail, dorsal: ['dorsal1'], lure, sweep: 9 });

  // fidget: opens its maw wide in a slow yawn of a threat, the lure flaring, the spines bristling
  clips.idle_maw = {
    seconds: 2.4,
    pose: (t, u) => {
      const open = K(u, [[0, 0], [0.3, 1], [0.6, 1], [0.75, 0]]);
      const crackle = osc(u, 20) * win(u, 0.3, 0.6, 0.05);
      return merge({
        body: { r: [-6 * open, 0, 0] },
        jaw: { r: [26 * open, 0, 0] },
        ...face.pose('open', blinks(u, [[0.85, 0.9]])),
        dorsal1: { r: [-10 * open, 0, 0] },
        lure3: { r: [6 * crackle, 0, 6 * crackle], s: 1 + 0.2 * open },
        finL: { r: [0, -14 * open, 0] },
        finR: { r: [0, 14 * open, 0] },
      });
    },
  };

  return rigDef({ joints, assign, extras: face.extras, clips });
}

export default abyssparkRig();
