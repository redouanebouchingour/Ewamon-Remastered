// Raidori Tenjin's rig: Raidori's body, pose, joints and clips (rigs/raidori.mjs), porcelain and gold. The flowing
// mane locks and the halo ride on mane1, the gold horn-locks are the ears, the floating sparkles ride the body.
// Numbers are scad/raidori_tenjin.scad's (its geometry is scad/raidori.scad's apart from the mane, the eyes, the
// horns, the star and the sparkles).
import { rigDef } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, closest, ellD, isAny, near } from './lib/geo.mjs';
import { STAR_AT, TAIL, TAIL_R, bodyTest, clips, ff, headTest, joints as baseJoints, legParts, tail } from './raidori.mjs';

const BODY = [0.85, 0.85, 0.86];
const GOLDS = [[0.86, 0.66, 0.14], [0.84, 0.66, 0.13]];
const MANE = [[0.97, 0.86, 0.42], [0.90, 0.70, 0.22]];
const CREAMS = [[0.99, 0.97, 0.84], [0.99, 0.96, 0.80], [1, 0.97, 0.84], [0.99, 0.95, 0.75], [1, 1, 1]];
const BLADE = [0.98, 0.93, 0.66];
const HALO = [0.98, 0.80, 0.30];
const SPARKLES = [[-14, -14, 25], [4, -14, 37], [6.5, -9, 30], [3.5, -4, 28.5], [-13, -6, 15], [13, 6, 22]];
const LINK = [0, 0, 1, 1, 2, 2, 3];

// the eyes sit where Raidori's do (a gold-rimmed oval, its front about 0.62 x size out)
const eyeL = { side: 'L', at: [2.35, -3.3, -1.5], size: 1.5, yaw: 22, flat: 0.5, squash: 0.7, frame: ff };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY });
const joints = [...baseJoints.filter((j) => !/^(lid|happy|dizzy|squeeze)/.test(j.name)), ...face.joints];

// the horn-locks (inside the face's scale) and the crown lock, in the face frame
const horn = (p) => {
  const q = [Math.abs(p[0]), p[1], p[2]];
  return Math.min(capD(q, [2.8, -1.4, 2.6], [3.4, -1.2, 4.6], 1.15, 0.95), capD(q, [3.4, -1.2, 4.6], [3.5, -0.8, 6.6], 0.95, 0.65),
    capD(q, [3.5, -0.8, 6.6], [2.9, -0.4, 8.2], 0.65, 0.25));
};
const jawTest = (c) => ellD(ff.local(c), [2.3, 2.5, 1.35], [0, -4.0, -6.0]);
const nearStar = (c) => ellD(c, [5.6, 3, 5.6], STAR_AT) < 1;
const tailHit = (c) => { const t = chainHit(c, TAIL, TAIL_R); return [tail[LINK[t.i]], t.d]; };

function assign(c, rgb) {
  const f = ff.local(c);
  if (near(rgb, HALO, 0.02)) return SPARKLES.some((p) => ellD(c, [2.2, 2.2, 2.2], p) < 1) ? 'body' : 'mane1';
  if (isAny(rgb, CREAMS, 0.03) || near(rgb, BLADE, 0.02) || isAny(rgb, GOLDS, 0.03)) {
    if (nearStar(c)) return 'tail4';
    if (near(rgb, BLADE, 0.02)) return 'body';
    if (c[2] > 17.5 && headTest(c) < 1.6) return 'head';   // the eyes, their rims and brows, the fangs
    return closest([['body', bodyTest(c)], ...legParts.map(([n, t]) => [n, t(c)])]);   // paws, claws, bands, patches, cracks
  }
  if (isAny(rgb, MANE, 0.03)) {
    if (f[1] < -1.6 && f[2] < -0.5 && Math.abs(f[0]) < 8.5) return 'head';   // the moustache
    const crown = Math.min(capD(f, [-1.5, -0.6, 4.6], [2.5, 0.2, 5.0], 1.05, 1.1), capD(f, [2.5, 0.2, 5.0], [6.5, 1.6, 4.4], 1.1, 1.05));
    const h = horn(f);
    if (h < 1.2 && h < crown) return f[0] > 0 ? 'earL' : 'earR';
    return 'mane1';
  }
  if (near(rgb, BODY, 0.03) || near(rgb, [0.74, 0.74, 0.76], 0.015) || near(rgb, [0.72, 0.72, 0.74], 0.015)) {
    const [tn, td] = tailHit(c);
    return closest([['head', headTest(c)], ['jaw', jawTest(c)], ['body', bodyTest(c)], ...legParts.map(([n, t]) => [n, t(c)]),
      [tn, c[1] > 16.5 ? td : td + 0.3]]);
  }
  return 'head';   // nose, mouth
}

// the base clips carry Raidori's face; the lids here are porcelain, from this kit by the same names
export default rigDef({ joints, assign, extras: face.extras, clips });
