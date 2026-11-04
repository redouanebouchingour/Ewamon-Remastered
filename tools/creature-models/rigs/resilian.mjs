// Resilian's rig: a dragonfly larva hovering on six hanging legs. The thorax (with the neck and the first abdomen
// segment) is the body, the head carries the orange compound eyes (their own joints) and two antenna links per side,
// the segmented abdomen rising behind is a tail chain (tail1 / tail2) ending in the stalked white buds (tail3), and the
// four leaf wings (wing = the lower front blade, wing2 = the upper hind blade) buzz. Numbers are scad/resilian.scad's.
// RESILIAN holds every number of the scad; resilith (the evolution) can pass its own through resilianRig().
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, ellD, fold, isAny, near, plateD, side, unrot } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const SEG_A = 42.3;

export const RESILIAN = {
  head: { p: [0, -12, 7.5], r: [7.4, 6.3, 5.7] },
  neck: { p: [0, -8, 11.2], r: [5.6, 4, 4.6] },
  thorax: { p: [0, -4.5, 13.5], r: [5.8, 6, 5.4] },
  muzzle: [{ p: [0, -17.6, 4.7], r: [3, 0.95, 2.7] }, { p: [0, -18.1, 6.6], r: [2.1, 0.8, 1.1] }],
  eye: { side: 'L', at: [4.6, -16.1, 7.9], size: 2.4, yaw: 38, flat: 0.55 },
  skin: [0.72, 0.38, 0.14],
  ant: { pts: [[2, -14.5, 11.8], [4, -15, 16], [4.5, -13, 19.5], [3.5, -10.5, 21]], rs: [0.3, 0.26, 0.22, 0.2] },
  // abdomen segments: centres, radii (x, along the column, across), the rise; seg 5 is the smaller cap at the fork
  seg: (i) => (i < 5 ? [0, -2.3 + 3.3 * i, 12.2 + 3 * i] : [0, 13.8, 26.7]),
  segN: 6,
  segR: [3.6, 2.6, 3.0],
  segA: SEG_A,
  segOwner: ['body', 'tail1', 'tail1', 'tail2', 'tail2', 'tail3'],
  stalk: { pts: [[0.9, 14.6, 28.4], [2.6, 15.6, 30.6], [4.2, 16.4, 32.4]], rs: [0.6, 0.5, 0.4] },
  bud: { base: [4.5, 16.6, 32.8], top: [5.7, 17.2, 36.4], r: 2.5 },
  // [root, sweep, dihedral, lean, length, width] per blade: lower (front) then upper (hind)
  wings: [[[3.4, -3.5, 15.5], 6, 14, 25, 27.5, 9.5], [[3.2, -1.2, 17.2], 14, 30, 30, 25, 7]],
  wingPts: (L, W) => [[0, -0.9], [0, 0.9], [0.3 * L, 0.42 * W], [0.72 * L, 0.55 * W], [L, 0.35 * W],
    [0.98 * L, -0.05 * W], [0.85 * L, -0.35 * W], [0.4 * L, -0.42 * W]],
  legs: {
    root: [[3.4, -6.8, 10], [3.6, -4.2, 9.8], [3.6, -1.6, 10.2]],
    knee: [[6.4, -7.6, 8.2], [8.2, -4.6, 7.8], [10.6, -1.2, 7.6]],
    bend: [[7.4, -8.2, 4.6], [9, -5.2, 4.6], [11.2, -2, 4.8]],
    foot: [[6.8, -9.6, 2.2], [8.4, -6.4, 2.5], [10.2, -3.4, 2.9]],
    r: [1, 0.95, 0.85, 0.75],
  },
  // colours (scad constants)
  BODY: [0.56, 0.69, 0.33], BODY_DK: [0.31, 0.37, 0.18], WING: [0.76, 0.91, 0.5], VEIN: [0.48, 0.6, 0.29],
  RIM: [0.8, 0.3, 0.35], MARK: [0.7, 0.18, 0.24], DOT: [0.86, 0.37, 0.3], BAND: [0.72, 0.38, 0.14],
  EYE: [[0.96, 0.6, 0.28], [1, 1, 1]], INK: [0.12, 0.12, 0.1], LEG: [0.25, 0.24, 0.29], CLAW: [0.86, 0.24, 0.3],
  TUFT: [0.93, 0.94, 0.93], ANT_TIP: [0.88, 0.4, 0.2],
  extra: () => null,
};

export function resilianRig(K0) {
  const eyeL = K0.eye;
  const eyeR = mirrorEye(eyeL);
  const face = eyeKit({ eyes: [eyeL, eyeR], skin: K0.skin });
  const segs = Array.from({ length: K0.segN }, (_, i) => K0.seg(i));
  const mid = (a, b) => a.map((v, k) => (v + b[k]) / 2);
  const legPts = [0, 1, 2].map((i) => [K0.legs.root[i], K0.legs.knee[i], K0.legs.bend[i], K0.legs.foot[i]]);
  const ANT = K0.ant.pts;
  const joints = [
    { name: 'root', at: [0, 0, 0] },
    ...legPts.flatMap(([b], i) => ['L', 'R'].map((S) => ({ name: `leg${i + 1}${S}`, parent: 'root', at: [S === 'L' ? b[0] : -b[0], b[1], b[2]] }))),
    { name: 'body', parent: 'root', at: [0, -4.5, 9] },
    { name: 'head', parent: 'body', at: K0.neck.p },
    { name: 'eyeL', parent: 'head', at: eyeL.at },
    { name: 'eyeR', parent: 'head', at: eyeR.at },
    ...['L', 'R'].flatMap((S) => [0, 1].map((i) => ({
      name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}1`, at: [(S === 'L' ? 1 : -1) * ANT[i][0], ANT[i][1], ANT[i][2]],
    }))),
    { name: 'tail1', parent: 'body', at: mid(segs[0], segs[1]) },
    { name: 'tail2', parent: 'tail1', at: mid(segs[2], segs[3]) },
    { name: 'tail3', parent: 'tail2', at: mid(segs[4], segs[5]) },
    ...['', '2'].flatMap((k, w) => ['L', 'R'].map((S) => {
      const p = K0.wings[w][0];
      return { name: `wing${k}${S}`, parent: 'body', at: [S === 'L' ? p[0] : -p[0], p[1], p[2]] };
    })),
    ...face.joints,
  ];

  // a blade: translate(p) rotate([0, 0, sweep]) rotate([0, -dih, 0]) rotate([-lean, 0, 0]) plate(), i.e. one
  // rotate([-lean, -dih, sweep])
  const wingD = (f, [p, sweep, dih, lean, L, W]) => {
    const q = unrot([-lean, -dih, sweep], [f[0] - p[0], f[1] - p[1], f[2] - p[2]]);
    return plateD(q, K0.wingPts(L, W), 1.5);
  };
  const legHit = (f) => {
    let best = { i: 0, d: Infinity };
    legPts.forEach((pts, i) => {
      const h = Math.min(chainHit(f, pts, K0.legs.r).d, capD(f, pts[3], [pts[3][0], pts[3][1] - 1.4, pts[3][2] - 2.2], 0.85, 0.3));
      if (h < best.d) best = { i, d: h };
    });
    return best;
  };
  const segD = (c, i) => {
    const s = segs[i];
    const q = unrot([K0.segA, 0, 0], [c[0] - s[0], c[1] - s[1], c[2] - s[2]]);
    const k = i === K0.segN - 1 ? 0.75 : 1;
    return ellD(q, K0.segR.map((r) => r * k));
  };
  const segHit = (c) => {
    let best = { i: 0, d: Infinity };
    segs.forEach((_, i) => { const d = segD(c, i); if (d < best.d) best = { i, d }; });
    return best;
  };
  const budD = (f) => Math.min(capD(f, K0.bud.base, K0.bud.top, 0.5, K0.bud.r), chainHit(f, K0.stalk.pts, K0.stalk.rs).d);
  const eyeD = (f) => ellD(f, [eyeL.size * 1.2, eyeL.size * 1.2, eyeL.size * 1.4], eyeL.at);
  const headD = (c) => Math.min(ellD(c, K0.head.r, K0.head.p), ...K0.muzzle.map((m) => ellD(c, m.r, m.p)));

  function assign(c, rgb) {
    const f = fold(c);
    const S = side(c);
    const x = K0.extra(c, rgb, f, S);
    if (x) return x;
    const onBud = budD(f) < 1.6;
    if (isAny(rgb, [K0.RIM, K0.WING], 0.03) || (near(rgb, K0.VEIN, 0.03) && !onBud)) {
      const a = wingD(f, K0.wings[0]);
      const b = wingD(f, K0.wings[1]);
      if (Math.min(a, b) < 1.6) return a < b ? `wing${S}` : `wing2${S}`;
    }
    if (near(rgb, K0.TUFT, 0.03) || (near(rgb, K0.VEIN, 0.03) && onBud)) return 'tail3';
    if (isAny(rgb, K0.EYE, 0.03) && eyeD(f) < 1.3) return `eye${S}`;
    if (near(rgb, K0.ANT_TIP, 0.03)) return `ant${S}2`;
    if (near(rgb, K0.INK, 0.03)) {
      const ant = chainHit(f, ANT, K0.ant.rs);
      if (ant.d < 1.8) return `ant${S}${ant.i === 0 ? 1 : 2}`;
      return 'head';
    }
    if (isAny(rgb, [K0.LEG, K0.CLAW], 0.03)) return `leg${legHit(f).i + 1}${S}`;
    if (isAny(rgb, [K0.MARK, K0.DOT], 0.03)) return K0.segOwner[segHit(c).i];
    if (near(rgb, K0.BAND, 0.03)) return 'head';
    if (near(rgb, K0.BODY_DK, 0.03)) {
      // the muzzle, or a segment ring (it sits between two segments: the upper one owns it)
      if (headD(c) < 1.4) return 'head';
      const sg = segHit(c);
      const i = segs.findIndex((s, k) => k > 0 && Math.hypot(...[0, 1, 2].map((a) => c[a] - mid(segs[k - 1], s)[a])) < 3.6);
      return K0.segOwner[i > 0 ? i : sg.i];
    }
    const sg = segHit(c);
    return pick(c, [
      ['head', () => headD(c)],
      ['body', () => Math.min(ellD(c, K0.thorax.r, K0.thorax.p), ellD(c, K0.neck.r, K0.neck.p))],
      [K0.segOwner[sg.i], () => sg.d],
      ['tail3', () => budD(f)],
    ]);
  }

  const tail = ['tail1', 'tail2', 'tail3'];
  const base = insectClips({ face, ant: 2, tail, stride: 12, lift: 12, buzz: 34 });
  const clips = {
    ...base,
    // fidget: the abdomen rears up and the buds shake like a pom-pom, wings flicking
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
  return rigDef({ joints, assign, rigid: ['eyeL', 'eyeR'], extras: face.extras, clips });
}

export default resilianRig(RESILIAN);
