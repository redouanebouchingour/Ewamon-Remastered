// Resilian's rig: a flying grub standing on six hanging legs. The thorax (the first two segments) is the body, the
// segmented abdomen rising behind is a tail chain (tail1 / tail2) ending in the cotton-tuft stalks (tail3), and the
// four leaf wings (wing = front pair, wing2 = rear) buzz. Resilith (its evolution) reuses this with its own numbers.
// Numbers are scad/resilian.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, ellD, fold, isAny, near, polyD, side, unrot } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const SEGS = [[0, -4.5, 11, 4.2], [0, -1, 13, 3.7], [0, 2.5, 15.3, 3.3], [0, 5.6, 17.8, 3], [0, 8.4, 20.4, 2.7], [0, 10.8, 23, 2.4]];
const SEG_OWNER = ['body', 'body', 'tail1', 'tail1', 'tail2', 'tail2'];
const ANT = [[1.6, -12, 12.5], [3, -14, 15], [5, -15, 16]];
const tail = ['tail1', 'tail2', 'tail3'];

export const RESILIAN = {
  eye: { side: 'L', at: [2.6, -13.5, 8.2], size: 1.3, yaw: -20, flat: 0.4 },
  skin: [0.85, 0.5, 0.2],
  wings: [[[2.5, -3, 14.5], [70, -28, 8], 15, 5.5], [[2.5, -1, 13.5], [70, 2, 28], 13.5, 5]],
  leg: (i) => { const b = [2.6, -6 + i * 2.6, 8.5]; const k = [b[0] + 3, b[1] - 0.5, b[2] - 3]; return [b, k, [k[0] + 0.4, k[1] - 0.8, k[2] - 4.2]]; },
  legR: [0.8, 0.7, 0.55],
  WING: [[0.82, 0.3, 0.35], [0.74, 0.92, 0.48]],
  TUFT: [[0.95, 0.95, 0.93]],
  extra: () => null,
};

const LEG_C = [0.2, 0.2, 0.26];
const RED = [0.85, 0.18, 0.25];
const GREEN_DK = [0.3, 0.42, 0.15];

export function resilianRig(K0) {
  const face = eyeKit({ eyes: [K0.eye, mirrorEye(K0.eye)], skin: K0.skin });
  const legs = [0, 1, 2].map(K0.leg);
  const joints = [
    { name: 'root', at: [0, 0, 0] },
    ...legs.flatMap(([b], i) => ['L', 'R'].map((S) => ({ name: `leg${i + 1}${S}`, parent: 'root', at: [S === 'L' ? b[0] : -b[0], b[1], b[2]] }))),
    { name: 'body', parent: 'root', at: [0, -3, 8.5] },
    { name: 'head', parent: 'body', at: [0, -6, 9] },
    ...['L', 'R'].flatMap((S) => [0, 1].map((i) => ({
      name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}1`, at: [(S === 'L' ? 1 : -1) * ANT[i][0], ANT[i][1], ANT[i][2]],
    }))),
    { name: 'tail1', parent: 'body', at: [0, 0.8, 14] },
    { name: 'tail2', parent: 'tail1', at: [0, 7, 19] },
    { name: 'tail3', parent: 'tail2', at: [0.6, 11.5, 24.5] },
    ...['', '2'].flatMap((k, w) => ['L', 'R'].map((S) => {
      const p = K0.wings[w][0];
      return { name: `wing${k}${S}`, parent: 'body', at: [S === 'L' ? p[0] : -p[0], p[1], p[2]] };
    })),
    ...face.joints,
  ];

  const wingD = (f, [p, r, len, w]) => {
    const P = [[0, 0], [len * 0.35, w], [len * 0.8, w * 1.05], [len, w * 0.5], [len * 0.92, -w * 0.25], [len * 0.4, -w * 0.5]];
    const q = unrot(r, [f[0] - p[0], f[1] - p[1], f[2] - p[2]]);
    return Math.max(polyD([q[0], q[1]], P), Math.abs(q[2]) - 0.5);
  };
  const legHit = (f) => {
    let best = { i: 0, d: Infinity };
    legs.forEach((pts, i) => { const h = chainHit(f, pts, K0.legR); if (h.d < best.d) best = { i, d: h.d }; });
    return best;
  };
  const segHit = (c) => {
    let best = { i: 0, d: Infinity };
    SEGS.forEach(([x, y, z, r], i) => { const d = ellD(c, [r, r * 0.95, r * 0.9], [x, y, z]); if (d < best.d) best = { i, d }; });
    return best;
  };

  function assign(c, rgb) {
    const f = fold(c);
    const S = side(c);
    const x = K0.extra(c, rgb, f, S);
    if (x) return x;
    if (isAny(rgb, K0.WING, 0.03)) {
      const a = wingD(f, K0.wings[0]);
      const b = wingD(f, K0.wings[1]);
      if (Math.min(a, b) < 1.2) return a < b ? `wing${S}` : `wing2${S}`;
    }
    if (isAny(rgb, K0.TUFT, 0.04) || (near(rgb, GREEN_DK) && c[1] > 10)) return 'tail3';
    if (near(rgb, LEG_C)) {
      const ant = chainHit(f, ANT, [0.25, 0.2, 0.12]);
      const lg = legHit(f);
      if (ant.d < lg.d) return `ant${S}${Math.min(2, ant.i + 1)}`;
      return `leg${lg.i + 1}${S}`;
    }
    if (near(rgb, RED) && c[2] < 5) return `leg${legHit(f).i + 1}${S}`;
    const lg = legHit(f);
    const sg = segHit(c);
    const hd = Math.min(ellD(c, [5.6, 5.4, 5], [0, -9, 9]), ellD(c, [5.8, 5.6, 2.6], [0, -9, 7.6]));
    const st = capD(f, [0.6, 11.5, 24.5], [3.6, 13.5, 29], 0.8, 0.45);
    return pick(c, [['head', () => hd], [SEG_OWNER[sg.i], () => sg.d], ['tail3', () => st], [`leg${lg.i + 1}${S}`, () => lg.d * 1.1]]);
  }

  const base = insectClips({ face, ant: 2, tail, stride: 12, lift: 12, buzz: 34 });
  const clips = {
    ...base,
    // fidget: the abdomen rears up and the tufts shake like a pom-pom, wings flicking
    idle_pompom: {
      seconds: 2,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.18, 1], [0.75, 1], [0.92, 0]]);
        const sh = Math.sin(TAU * 8 * u) * win(u, 0.22, 0.72, 0.04);
        return merge(base.idle.pose(t, u), {
          tail1: { r: [-10 * up, 0, 0] },
          tail2: { r: [-8 * up, 0, 6 * sh] },
          tail3: { r: [0, 10 * sh, 12 * sh] },
          wingL: { r: [0, -8 * Math.abs(sh), 0] }, wingR: { r: [0, 8 * Math.abs(sh), 0] },
          ...face.pose(up > 0.5 ? 'happy' : 'open'),
        });
      },
    },
  };
  return rigDef({ joints, assign, extras: face.extras, clips });
}

export default resilianRig(RESILIAN);
