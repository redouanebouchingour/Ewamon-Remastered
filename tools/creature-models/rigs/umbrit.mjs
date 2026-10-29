// Umbrit's rig: a small hooded shade, a bell cloak with a ragged hem, a floppy hood tip (the template's wisp chain),
// a void face with two round white eyes and thin twig arms. The lids are void-dark ellipsoids that close over the
// eyes; their strokes are drawn in the eyes' white. Numbers are scad/umbrit.scad's (the old model, rigged before its
// sprite-accuracy rebuild).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const CLOAK_LT = [0.4, 0.38, 0.45];
const CLOAK_DK = [0.18, 0.16, 0.22];
const VOID = [0.06, 0.04, 0.09];
const EYE = [[0.88, 0.92, 0.92], [1, 1, 1]];

const TIP = [[0, 2, 36], [2.5, 4.5, 38], [5.5, 6.5, 37], [7.5, 7.5, 35]];
const TIP_R = [3.2, 2.4, 1.6, 0.8];
const wisp = TIP.slice(0, -1).map((_, i) => `wisp${i + 1}`);

const eyeL = { side: 'L', at: [2.1, -6.6, 29.5], size: 1.4, flat: 0 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: VOID, ink: EYE[0] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 9] },
  { name: 'head', parent: 'body', at: [0, 0.3, 24] },
  { name: 'armL', parent: 'body', at: [6.5, 0, 22] },
  { name: 'handL', parent: 'armL', at: [10, -0.5, 19] },
  { name: 'armR', parent: 'body', at: [-6.5, 0, 22] },
  { name: 'handR', parent: 'armR', at: [-10, -0.5, 19] },
  ...wisp.map((name, i) => ({ name, parent: i === 0 ? 'head' : wisp[i - 1], at: TIP[i] })),
  ...face.joints,
];

// the cloak: hull of a disc at the hem (z 8, 9 × 8.5) and a dome at the shoulders (z 25, 7.6 × 7.1)
const bell = (c) => {
  const k = Math.min(1, Math.max(0, (c[2] - 8) / 17));
  return Math.max(Math.hypot(c[0] / (9 - 1.4 * k), (c[1] - 0.3 * k) / (8.5 - 1.4 * k)), (c[2] - 28) / 3 + 1);
};

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (isAny(rgb, [VOID, ...EYE], 0.03)) return 'head';
  if (c[2] < 8.6) return 'body';                                           // the hem, its tatters and wisps
  const w = chainHit(c, TIP, TIP_R);
  return closest([
    ['body', near(rgb, CLOAK_LT, 0.03) ? 9 : bell(c)],
    ['head', near(rgb, CLOAK_LT, 0.03) || near(rgb, CLOAK_DK, 0.03) && c[2] > 27 ? ellD(c, [8, 7.5, 7.5], [0, 0.3, 30]) : 9],
    [wisp[w.i], near(rgb, CLOAK_LT, 0.03) ? w.d : 9],
    [`arm${S}`, capD(f, [6.5, 0, 22], [10, -0.5, 19], 0.6, 0.5)],
    [`hand${S}`, Math.min(capD(f, [10, -0.5, 19], [11, -1, 15], 0.5, 0.45), ellD(f, [1.6, 1.4, 2.8], [11, -1.2, 13.2]))],
  ]);
}

const base = floaterClips({ face, wisp, bob: 0.8 });

const clips = {
  ...base,

  // fidget: peeks out from the hood, the hood shrinking down shyly, then a little wave of a twig hand
  idle_shy: {
    seconds: 2.6,
    pose: (t, u) => {
      const hide = K(u, [[0, 0], [0.15, 1], [0.45, 1], [0.6, 0]]);
      const wave = win(u, 0.55, 0.9, 0.06);
      const wv = Math.sin(TAU * 3 * u);
      return merge({
        ...face.pose(hide > 0.6 ? 'shut' : 'open', 0),
        body: { p: [0, 0, 0.6 - 0.5 * hide], s: [1, 1, 1 - 0.05 * hide] },
        head: { r: [14 * hide, 0, 10 * wave] },
        ...both('arm', { r: [0, 12 * hide, -20 * hide] }),
        armL: { r: [0, -60 * wave, 0] },
        handL: { r: [0, -20 * wv * wave, 0] },
      }, Object.fromEntries(wisp.map((n, i) => [n, { r: [12 * hide, 0, 4 * osc(u, 2, -0.1 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
