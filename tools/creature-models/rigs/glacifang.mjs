// Glacifang's rig: a frost drake prowling on all fours, a snarling wedge head (its jaw a joint), bat wings raised off
// the shoulders and a spiked tail curling up behind. The quadruped template has no wings: wingL / wingR are moved by
// `add` layers. Numbers are scad/glacifang.scad's. `drakeRig()` builds the rig from a drake's numbers; Blizzraak
// (scad/blizzraak.scad, the same body plan grown up) uses it too.
import { K, TAU, both, merge, osc, rigDef, shake, smooth, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const capChain = (c, pts, rs) => chainHit(c, pts, rs).d;

/**
 * A drake: `legF` / `legB` the left legs' [pivot, test(c folded)], `body` / `neckHead` tests (world), `head` the
 * head's subFrame and `skull` / `jaw` tests in its own numbers, `jawAt` the hinge (head numbers), `tail` points / radii
 * (world), `wing` the left batwing's S, E, W, tips, `wingCols` colours that only the wings use, `rimCols` colours the
 * wings share with other parts (tested by distance to the wing bones), `eye` the left eye in head numbers, `skin`.
 */
export function drakeRig(o) {
  const H = o.head;
  const tailN = o.tailJoints.length;
  const tail = o.tailJoints.map((_, i) => `tail${i + 1}`);
  const eyeL = { side: 'L', ...o.eye, frame: H };
  const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: o.lidSkin ?? o.skin });
  const [S, E, Wr, tips] = o.wing;
  // the bones, the finger spars and the crystal at the wrist (pointing on from the forearm and up)
  const wristTip = Wr.map((v, i) => v + (v - E[i]) * 0.25 + [0, -1, 1.5][i]);
  const wingD = (f) => Math.min(capChain(f, [S, E, Wr, tips[0]], [2.4, 1.9, 1.6, 0.8]), ...tips.map((t) => capD(f, Wr, t, 1.4, 0.8)),
    capD(f, Wr, wristTip, 1.6, 0.8));

  const joints = [
    { name: 'root', at: [0, 0, 0] },
    { name: 'legFL', parent: 'root', at: o.legF[0] },
    { name: 'legFR', parent: 'root', at: [-o.legF[0][0], o.legF[0][1], o.legF[0][2]] },
    { name: 'legBL', parent: 'root', at: o.legB[0] },
    { name: 'legBR', parent: 'root', at: [-o.legB[0][0], o.legB[0][1], o.legB[0][2]] },
    { name: 'body', parent: 'root', at: o.bodyAt },
    { name: 'head', parent: 'body', at: o.headAt },
    { name: 'jaw', parent: 'head', at: H.world(o.jawAt) },
    { name: 'wingL', parent: 'body', at: S },
    { name: 'wingR', parent: 'body', at: [-S[0], S[1], S[2]] },
    ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: o.tailPts[o.tailJoints[i]] })),
    ...face.joints,
  ];

  function assign(c, rgb) {
    const f = fold(c);
    const s = side(c);
    if (isAny(rgb, o.wingCols, 0.018)) return `wing${s}`;
    if (isAny(rgb, o.rimCols, 0.018) && f[2] > 12 && wingD(f) < 1.25) return `wing${s}`;
    const h = H.local(c);
    const t = chainHit(c, o.tailPts, o.tailRs);
    const tailJ = () => { let k = 0; for (let i = 0; i < tailN; i++) if (t.i >= o.tailJoints[i]) k = i; return tail[k]; };
    if (o.tailOnly?.(c, rgb)) return tailJ();
    return closest([
      [`legF${s}`, o.legF[1](f)],
      [`legB${s}`, o.legB[1](f)],
      ['body', o.body(c)],
      ['head', Math.min(o.neckHead(c), o.skull(h))],
      ['jaw', o.jaw(h) * (isAny(rgb, o.jawCols, 0.03) ? 0.85 : 1.15)],
      [tailJ(), t.d * 1.05],
    ]);
  }

  // the wings: `lift` raises both (ry), `sweep` swings them forward or back (rx)
  const W = (lift, sweep = 0, liftR = lift) => both('wing', { r: [sweep, -lift, 0] }, { r: [sweep, -liftR, 0] });
  const J = (open) => ({ jaw: { r: [open, 0, 0] } });
  const base = quadrupedClips({
    face, tail, hipH: o.hipH, stride: o.stride ?? 12,
    add: {
      idle: (t, u) => merge(W(3 * osc(u, 2), 2 * osc(u, 1, 0.3)), J(2 * (osc(u, 2) * 0.5 + 0.5))),
      walk: (t, u) => merge(W(4 * osc(u, 2, 0.1), 3 * osc(u, 1)), J(2)),
      idle_sniff: (t, u) => W(-4 * win(u, 0.14, 0.6, 0.1), 0),
      idle_shake: (t, u) => { const k = win(u, 0.1, 0.8, 0.06); return W(10 * k * Math.sin(TAU * 7 * u), 6 * k * Math.sin(TAU * 7 * u + 1)); },
      windup: (t, u) => { const w = smooth(u / 0.8); return merge(W(18 * w, -8 * w), J(10 * w)); },
      lunge: (t, u) => {
        const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
        const bite = K(u, [[0, 0.5], [0.3, 1], [0.42, 0], [1, 0]]);
        return merge(W(18 - 30 * hit, -8 + 16 * hit), J(22 * bite));
      },
      hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return merge(W(22 * k + 4 * shake(u, 5), -10 * k), J(14 * k)); },
      recoil: (t, u) => { const k = K(u, [[0, 0], [0.4, 1], [1, 0]]); return W(-10 * k, 4 * k); },
      faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return merge(W(-24 * d, 8 * d), J(12 * d)); },
      celebrate: (t, u) => merge(W(14 + 18 * Math.sin(TAU * 3 * u), 6 * osc(u, 3, 0.25)), J(14)),
      enter: (t, u) => { const over = win(u, 0.4, 0.9, 0.12); const on = smooth((u - 0.1) / 0.4); return merge(W(-16 * (1 - on) + 24 * over, 0), J(16 * over)); },
      exit: (t, u) => { const k = win(u, 0, 0.85, 0.2); return { ...W(0, 0), wingL: { r: [0, (-16 - 16 * Math.sin(TAU * 2 * u)) * k, 0] } }; },
    },
  });
  const { idle_wag: _wag, ...clips0 } = base;

  const clips = {
    ...clips0,
    // fidget: rears its head up and roars at the sky, wings flung wide, jaw open, then a puff of frost breath
    idle_roar: {
      seconds: 2.4,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.88, 0]]);
        const tr = Math.sin(TAU * 14 * u) * win(u, 0.25, 0.68, 0.04);
        return merge({
          body: { r: [-6 * up, 0, 0] },
          head: { r: [-26 * up + 1.5 * tr, 0, 0] },
          ...J(30 * up + 2 * tr),
          ...face.pose(up > 0.5 ? 'squeeze' : 'open'),
        }, W(28 * up + 2 * tr, -6 * up), Object.fromEntries(tail.map((n, i) => [n, { r: [6 * up * (1 + 0.2 * i), 0, 3 * tr] }])));
      },
    },
  };
  return rigDef({ joints, assign, extras: face.extras, clips });
}

const H = subFrame([0, -13.6, 16], [-6, 0, 0], 1.38);
const leg = (sh, el, mid, foot) => (f) => Math.min(
  ellD(f, ...sh), capD(f, ...el), capD(f, ...mid),
  ellD(f, [2, 2.4, 1.1], foot), ellD(f, [1.6, 1.3, 1], [foot[0], foot[1] + 1.4, foot[2] + 0.4]), ellD(f, [2.2, 1.6, 1.2], [foot[0], foot[1] - 2.6, foot[2] - 0.4]),
);

export default drakeRig({
  skin: [0.87, 0.93, 0.99],
  lidSkin: [0.36, 0.48, 0.7],
  head: H,
  eye: { at: [2.25, -3.35, 1.0], size: 1.5, yaw: 38, flat: 0.5 },
  jawAt: [0, 0.5, -1.6],
  jawCols: [[0.76, 0.86, 0.92], [0.32, 0.12, 0.2]],
  hipH: 11,
  legF: [[4.8, -6, 12.5], leg([[3.4, 4, 4.6], [4.8, -6, 13]], [[4.8, -6, 11], [6.4, -5.6, 8.4], 2.8, 2.8], [[6.4, -5.6, 8.4], [6.8, -9.4, 1.8], 2.6, 2], [6.8, -10.2, 1.2])],
  legB: [[5, 5, 11.4], leg([[4.2, 5.2, 5.8], [5, 5, 11.4]], [[5.8, 6.6, 8], [6.4, 7.8, 4], 3.2, 2.2], [[6.4, 7.8, 4], [6.4, 5.4, 1.5], 2.2, 1.9], [6.4, 4.6, 1.2])],
  bodyAt: [0, 0, 12],
  body: (c) => Math.min(
    blobD(c, [[[6.4, 6, 6.6], [0, -4, 13.5]], [[5.2, 5, 5.2], [0, 2.5, 13]], [[5.8, 4, 5.6], [0, 5.5, 12.5]]]),
    blobD(c, [[[4.4, 3.6, 4], [0, -7.6, 11.4]], [[3.8, 5, 2.4], [0, 0, 8.8]]]),
    ellD(c, [4.4, 4.4, 4.6], [0, -7.5, 16]),
    capD(c, [0, -11, 22], [0, 7, 19], 2.5, 2.5) * 0.9,    // the spine crystals
  ),
  headAt: [0, -10.5, 15.6],
  neckHead: (c) => Math.min(ellD(c, [3.2, 3.4, 3.2], [0, -13, 15.4]), ellD(c, [2.2, 1.8, 1.8], [0, -14, 13]),
    ...[[-3, -26.6, 13], [-4.2, -27.6, 15], [-2, -28.4, 15.4]].map((p) => ellD(c, [1.2, 1.2, 1.2], p))),
  skull: (h) => Math.min(
    blobD(h, [[[3.5, 3.3, 3], [0, 0, 0.4]], [[2.6, 2.1, 1.9], [0, -5.2, -0.1]], [[2, 1.1, 1.3], [0, -8.2, -0.6]]]),
    capD(fold(h), [1.8, -0.8, 2.6], [3.2, 5.6, 7.4], 1.2, 0.4), capD(fold(h), [3, -1, -0.8], [5.8, 2, -1.2], 0.9, 0.3),
    capD(fold(h), [3.2, 0.6, 0.6], [6, 3.6, 1.6], 0.8, 0.3), capD(h, [0, -1.6, 2.4], [0, 0.6, 6.8], 1, 0.3),
  ),
  jaw: (h) => Math.min(blobD(h, [[[2.9, 2.4, 1.4], [0, -0.6, -2.7]], [[1.5, 1.1, 0.7], [0, -7, -4]]]), capD(h, [0, -1.4, -1.6], [0, -7, -2.5], 2, 1)),
  tailPts: [[0, 9, 12.5], [2, 15, 10], [7, 18, 8], [12, 16, 9], [14, 11, 13], [13, 8, 18], [11, 9, 21]],
  tailRs: [3.6, 3, 2.5, 2, 1.6, 1.2, 0.6].map((r) => r + 0.8),
  tailJoints: [0, 2, 4],
  wing: [[4.4, -3, 18.6], [10, -1, 25.6], [12, 3, 35.5], [[21, 6, 33], [22, 9.6, 24], [18, 10.6, 17], [12, 10, 15]]],
  wingCols: [[0.92, 0.95, 1.0], [0.84, 0.8, 0.97], [0.62, 0.75, 0.92], [0.74, 0.72, 0.93]],
  rimCols: [[0.68, 0.86, 1.0], [0.97, 0.98, 1.0]],
});
