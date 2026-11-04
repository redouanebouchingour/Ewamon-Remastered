// Noxmyth's rig: a hooded night sorceress floating over a black orb. The hood, face, crown and the side locks are the
// head (the hair curl a wisp chain off it); the armour, collar, tassets, robe skirt and back cape the body; four arms:
// the raised upper pair armL / handL (the floater template's arms), the lower pair held out palm up arm2L / hand2L
// (they echo the upper pair a beat later at a smaller swing); the bat-feather wings wingL / wingR (beating through
// `add`); the dark-red robe flaps flapL / flapR and three loose shadow strands strand1..3 swaying off the body; the
// shadow tail out of the belly a hanging chain whose last link carries the coil and the orb.
// Numbers are scad/noxmyth.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const C30 = Math.cos(Math.PI / 6);
const OX = 1.5;
const S = (sx, z, y = 0) => [(sx + OX - 0.5 * y) / C30, y, z];   // scad's S(): the art sheet point at depth y

const HOOD_C = [0.12, 0.1, 0.21];
const FACE_C = [0.2, 0.23, 0.38];
const INK = [0.04, 0.03, 0.08];
const CROWN = [[0.3, 0.3, 0.36], [0.82, 0.34, 0.2]];
const EYEC = [[0.7, 0.48, 1], [0.48, 0.24, 0.9], [0.97, 0.78, 1], [1, 1, 1]];
const GOLD = [0.96, 0.72, 0.42];
const VOID = [0.03, 0.02, 0.05];
const HAND = [0.3, 0.32, 0.56];
const ROBE = [0.3, 0.06, 0.1];
const WINGC = [[0.13, 0.14, 0.28], [0.4, 0.09, 0.12], [0.68, 0.17, 0.15]];
const TAIL_C = [0.08, 0.08, 0.17];
const TAIL_RED = [0.55, 0.12, 0.14];

const HOOD = [[5.6, 4.9, 5.6], [0, 0.2, 30.8]];
const FACE = [[3.9, 3.4, 4.0], [0, -1.8, 29.6]];
const DRAPE = [[[4.6, 3.8, 3.2], [0, 1.6, 27.4]], [[3.8, 3.4, 2], [0, 2, 25.4]]];
const CURL = [S(1, 34.6, 1), S(3.4, 35.4, 1), S(5.0, 36.2, 1), S(5.8, 37.4, 1), S(5.2, 38.4, 1), S(4.0, 38.2, 1)];
const CURL_R = [1.7, 1.45, 1.25, 1.0, 0.7, 0.3];
const LOCK = [[4.6, 0.6, 32.6], [6.2, 0.9, 30.6], [5.8, 1.3, 28.6], [4.8, 1.6, 26.6], [4.4, 1.8, 24.6]];
const LOCK_R = [1.6, 1.35, 1.2, 1.0, 0.7];
const TORSO = [[[2.9, 2.3, 2.1], [0, -0.6, 24.2]], [[2.4, 2.0, 2.0], [0, -0.6, 21.0]]];
const PAUL = [3.5, -0.4, 25.0];
const SH1 = [3.4, -0.3, 24.0]; const EL1 = [5.8, -1.0, 22.4]; const HA1 = [7.2, -2.2, 24.2];
const SH2 = [2.6, -0.4, 20.4]; const EL2 = [5.0, -1.4, 19.6]; const HA2 = [7.6, -2.4, 19.9];
const FLAP1 = [[3.6, 0.6, 19.4], [7.0, 0.8, 19.0], [10.4, 0.8, 17.9], [12.8, 0.6, 16.6], [13.6, 0.4, 15.4]];
const FLAP2 = [[4.0, -0.4, 17.8], [6.4, -0.6, 16.4], [8.0, -0.6, 14.6], [8.5, -0.6, 13.5]];
const FLAP3 = [[3.4, 1.6, 17.0], [5.4, 2.0, 14.6], [6.0, 2.2, 12.2], [5.8, 2.2, 11.2]];
const COL = [S(-3.2, 16.4, -0.8), S(-3.0, 14.2, -0.6), S(-2.4, 12.2, -0.4), S(0, 10.9, -0.2), S(3.6, 10.2, 0), S(6.4, 8.8, 0),
  S(7.4, 6.6, 0), S(6.2, 4.8, 0), S(4.0, 4.5, 0), S(2.4, 5.4, 0)];
const COL_R = [2.4, 2.9, 2.7, 2.3, 1.9, 1.6, 1.4, 1.2, 1.0, 0.8];
const COL_SY = 0.8;
const UP = [S(-1.6, 14.2, 0.6), S(1.8, 13.7, 0.6), S(4.6, 13.2, 0.6), S(6.8, 12.4, 0.6), S(7.8, 10.8, 0.5), S(7.2, 9.2, 0.3)];
const UP_R = [1.2, 1.1, 1.0, 0.9, 0.85, 0.8];
const HOLE = S(-3.2, 16.7, -2.9);
// the orb: pp(0) ell([3.3, 2.0, 3.3], [0.1 + OX, 0, 3.4]), i.e. turned 30° about Z
const ORB_C = [(0.1 + OX) * C30, (0.1 + OX) * 0.5, 3.4];
const orbD = (c) => {
  const d = [c[0] - ORB_C[0], c[1] - ORB_C[1], c[2] - ORB_C[2]];
  const x = d[0] * C30 + d[1] * 0.5; const y = -d[0] * 0.5 + d[1] * C30;
  return Math.hypot(x / 3.3, y / 2.0, d[2] / 3.3);
};
const STR = [
  [[S(-8.5, 15.6, 0.5), S(-10.5, 13.6, 0.5), S(-11.9, 11.8, 0.5), S(-11.8, 10.6, 0.5), S(-10.8, 10.3, 0.5)], [0.8, 0.7, 0.55, 0.4, 0.15]],
  [[S(-7.2, 14.4, -0.5), S(-8.6, 11.8, -0.5), S(-7.2, 9.6, -0.5), S(-6.0, 8.2, -0.5), S(-6.6, 7.6, -0.5), S(-7.3, 7.8, -0.5)], [0.8, 0.65, 0.55, 0.45, 0.3, 0.1]],
  [[S(3.6, 16.4, 1), S(7.5, 15.0, 1), S(10.7, 13.7, 1), S(13.4, 12.8, 1), S(14.2, 11.2, 1), S(13.4, 10.1, 1), S(12.6, 10.2, 1)], [1.0, 0.9, 0.8, 0.65, 0.5, 0.3, 0.1]],
];
const strands = STR.map((_, i) => `strand${i + 1}`);
const WY = 3.4;
const WROOT = [2.8, WY, 24];

// the tail joints sit on the column's points (belly first); the last one carries the coil and the orb
const TAIL_AT = [0, 2, 4, 6, 8];
const tail = TAIL_AT.map((_, i) => `tail${i + 1}`);
const WISP_AT = [0, 2, 4];
const wisp = WISP_AT.map((_, i) => `wisp${i + 1}`);

const eyeL = { side: 'L', at: [2.17, -4.25, 29.05], size: 0.95, yaw: 26 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE_C });

const mx = (p) => [-p[0], p[1], p[2]];
const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 18] },
  { name: 'head', parent: 'body', at: [0, -0.2, 26.2] },
  { name: 'armL', parent: 'body', at: SH1 },
  { name: 'handL', parent: 'armL', at: EL1 },
  { name: 'armR', parent: 'body', at: mx(SH1) },
  { name: 'handR', parent: 'armR', at: mx(EL1) },
  { name: 'arm2L', parent: 'body', at: SH2 },
  { name: 'hand2L', parent: 'arm2L', at: EL2 },
  { name: 'arm2R', parent: 'body', at: mx(SH2) },
  { name: 'hand2R', parent: 'arm2R', at: mx(EL2) },
  { name: 'wingL', parent: 'body', at: WROOT },
  { name: 'wingR', parent: 'body', at: mx(WROOT) },
  { name: 'flapL', parent: 'body', at: FLAP1[0] },
  { name: 'flapR', parent: 'body', at: mx(FLAP1[0]) },
  ...strands.map((name, i) => ({ name, parent: 'body', at: STR[i][0][0] })),
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: COL[TAIL_AT[i]] })),
  ...wisp.map((name, i) => ({ name, parent: i === 0 ? 'head' : wisp[i - 1], at: CURL[WISP_AT[i]] })),
  ...face.joints,
];

const linkTo = (names, at, i) => { let k = 0; for (let j = 0; j < at.length; j++) if (i >= at[j]) k = j; return names[k]; };
const flatHit = (c, pts, ws) => chainHit([c[0], c[1] * 0.4, c[2]], pts.map((p) => [p[0], p[1] * 0.4, p[2]]), ws);

function assign(c, rgb) {
  const L = side(c);
  const f = fold(c);
  const ax = f[0];
  if (isAny(rgb, CROWN, 0.03) || isAny(rgb, EYEC, 0.03) || near(rgb, FACE_C, 0.03)) return 'head';
  if (near(rgb, INK, 0.02)) return c[2] > 26 ? 'head' : 'body';
  if (isAny(rgb, WINGC, 0.03)) return `wing${L}`;
  // the suns on the wings (gold ring, void disc)
  if ((near(rgb, GOLD, 0.03) || near(rgb, VOID, 0.02)) && ax > 6 && c[2] > 21 && c[2] < 31) return `wing${L}`;
  if (near(rgb, GOLD, 0.03)) return c[2] > 27 ? 'head' : 'body';
  if (near(rgb, HAND, 0.03)) return c[2] > 22 ? `hand${L}` : `hand2${L}`;
  if (near(rgb, ROBE, 0.03)) return `flap${L}`;

  const col = chainHit([c[0], c[1] / COL_SY, c[2]], COL, COL_R);
  const up = chainHit(c, UP, UP_R);
  const hits = STR.map(([p, r]) => chainHit(c, p, r.map((x) => x + 0.15)));
  const cw = chainHit(c, CURL, CURL_R);
  const head = Math.min(ellD(c, HOOD[0], HOOD[1]), ellD(c, FACE[0], FACE[1]), blobD(c, DRAPE), chainHit(f, LOCK, LOCK_R).d,
    c[2] > 34.4 && Math.hypot(c[0], c[1] + 0.4) < 5.2 ? 0.5 : 9);
  // the back cape and the robe skirt
  const cape = c[1] > 0.8 && c[2] > 12.8 && c[2] < 26 && ax < 7.6 && ellD(c, [8, 5.5, 8], [0, 2.6, 18]) < 1.05 ? 1.0 : 9;
  const body = Math.min(blobD(c, TORSO), ellD(f, [2.3, 2.2, 1.8], PAUL) * 1.02, ellD(c, [3.5, 3.4, 1.2], [0, 0.2, 26.2]),
    ellD(c, [4.3, 4.3, 3.6], [0, 0, 16.6]), ellD(c, [1.9, 1.4, 2.1], HOLE), cape);
  const flap = Math.min(flatHit(f, FLAP1, [1.8, 1.9, 1.5, 0.9, 0.15]).d, flatHit(f, FLAP2, [1.7, 1.5, 0.8, 0.12]).d,
    flatHit(f, FLAP3, [1.3, 1.1, 0.6, 0.1]).d);
  return closest([
    ['head', head],
    [wisp[Math.min(wisp.length - 1, WISP_AT.filter((a) => cw.i >= a).length - 1)], cw.d],
    ['body', body],
    [`arm${L}`, capD(f, SH1, EL1, 0.85, 0.75)],
    [`hand${L}`, Math.min(capD(f, EL1, HA1, 0.8, 0.7), ellD(f, [1.6, 1.4, 1.8], HA1))],
    [`arm2${L}`, capD(f, SH2, EL2, 0.85, 0.75)],
    [`hand2${L}`, Math.min(capD(f, EL2, HA2, 0.8, 0.7), ellD(f, [1.6, 1.4, 1.6], HA2))],
    [`flap${L}`, flap * 1.02],
    [linkTo(tail, TAIL_AT, col.i), col.d],
    [up.i < 3 ? tail[1] : tail[2], up.d],
    [tail[tail.length - 1], orbD(c)],
    ...strands.map((n, i) => [n, hits[i].d]),
  ]);
}

// the wings beat about the vertical (rz > 0 sweeps a +X wing back); the flaps and strands sway
const beat = (amp, cycles, u, open = 0) => both('wing', { r: [0, -open, amp * osc(u, cycles)] });
const sway = (u, amp, cycles) => ({
  ...both('flap', { r: [amp * 0.5 * osc(u, cycles, 0.1), amp * 0.6 * osc(u, cycles, 0.3), 0] }, { r: [amp * 0.5 * osc(u, cycles, 0.4), amp * 0.6 * osc(u, cycles, 0.6), 0] }),
  strand1: { r: [amp * osc(u, cycles, 0.2), 0, amp * 0.6 * osc(u, cycles, 0.45)] },
  strand2: { r: [amp * osc(u, cycles, 0.55), 0, amp * 0.6 * osc(u, cycles, 0.8)] },
  strand3: { r: [amp * osc(u, cycles, 0.35), 0, -amp * 0.6 * osc(u, cycles, 0.6)] },
});
const fx = {
  idle: (t, u) => merge(beat(6, 2, u), sway(u, 6, 2)),
  walk: (t, u) => merge(beat(14, 2, u), sway(u, 10, 2)),
  idle_spin: (t, u) => merge(beat(10, 3, u), sway(u, 12, 3)),
  windup: (t, u) => merge(beat(0, 1, u, -14 * smooth(u / 0.8)), sway(u, 4, 1)),
  lunge: (t, u) => merge(beat(10, 1, u, 10 * win(u, 0.2, 0.7, 0.1)), sway(u, 10, 1)),
  hurt: (t, u) => merge(beat(12, 3, u, 16 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])), sway(u, 14, 3)),
  recoil: (t, u) => merge(beat(6, 1, u, -8), sway(u, 6, 1)),
  faint: (t, u) => merge(beat(0, 1, u, -20 * smooth((u - 0.2) / 0.6)), sway(u, 4, 1)),
  celebrate: (t, u) => merge(beat(22, 3, u, 12), sway(u, 14, 3)),
  enter: (t, u) => merge(beat(14, 1, u, 10 * win(u, 0.4, 0.95, 0.12)), sway(u, 10, 2)),
  exit: (t, u) => merge(beat(12, 2, u), sway(u, 10, 2)),
};
const base = floaterClips({ face, tail, wisp, bob: 0.6, add: fx });
delete base.idle_cackle;   // a stern face: no grin to cackle with

// the lower arms echo the upper pair a beat later at 60 % of the swing
const echo = (clip) => ({
  ...clip,
  pose: (t, u) => {
    const lag = Math.min(0.06, clip.seconds * 0.15);
    const p = clip.pose(Math.max(0, t - lag), Math.max(0, u - lag / clip.seconds));
    const now = clip.pose(t, u);
    const k = (q) => (q && q.r ? { r: q.r.map((v) => v * 0.6) } : undefined);
    const out = { ...now };
    for (const S2 of ['L', 'R']) {
      const a = k(p[`arm${S2}`]); const h = k(p[`hand${S2}`]);
      if (a) out[`arm2${S2}`] = a;
      if (h) out[`hand2${S2}`] = h;
    }
    return out;
  },
});

const clips = {
  ...Object.fromEntries(Object.entries(base).map(([n, c]) => [n, echo(c)])),

  // fidget: holds out all four palms, the orb drawing a slow orbit, the wings fanning, eyes half shut in focus
  idle_gravity: {
    seconds: 2.8,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.78, 1], [0.92, 0]]);
      const orbit = Math.sin(TAU * u * 2) * on;
      return merge({
        ...face.pose('open', 0.5 * on),
        body: { p: [0, 0, 0.6 + 0.5 * on] },
        head: { r: [8 * on, 0, 0] },
        ...both('arm', { r: [-20 * on, -10 * on, 0] }),
        ...both('hand', { r: [-15 * on, 0, 10 * on] }),
        ...both('arm2', { r: [-10 * on, 12 * on, -8 * on] }),
        ...both('hand2', { r: [0, -12 * on, 0] }),
        tail2: { r: [6 * orbit, 0, 0] },
        tail4: { r: [0, 8 * orbit, 0] },
      }, beat(8, 4, u, 8 * on), sway(u, 8 * on, 2));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
