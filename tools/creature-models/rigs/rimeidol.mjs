// Rimeidol's rig: a frosty wraith in a hooded shroud, a skull face, ice horns, draped sleeves with icy claws and three
// long streamers trailing from the hood. The main streamer is the template's wisp chain; the other two copy its
// motion link by link (the one sweeping to -X mirrored). Numbers are scad/rimeidol.scad's (the old model, rigged before
// its sprite-accuracy rebuild).
import { K, mirror, merge, osc, rigDef, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, ellD, fold, isAny, near, petalD, side } from './lib/geo.mjs';

const SKULL = [[0.95, 0.92, 0.84], [0.78, 0.74, 0.66], [0.12, 0.1, 0.2]];
const FROST = [0.86, 0.9, 1];

const A = [[3, 4, 34], [9, 6, 37], [15, 7, 36], [19, 9, 33], [21, 11, 29]];
const B = [[4, 5, 30], [10, 8, 31], [15, 10, 28], [18, 11, 24], [17, 12, 19]];
const C = [[-3, 5, 33], [-8, 8, 35], [-13, 10, 33], [-16, 11, 29]];
const AR = [1.8, 1.6, 1.4, 1.1, 0.7];
const BR = [1.7, 1.5, 1.2, 0.9, 0.6];
const CR = [1.6, 1.4, 1.1, 0.7];
const links = (pts, pre) => pts.slice(0, -1).map((_, i) => `${pre}${i + 1}`);
const wisp = links(A, 'wisp');
const wispB = links(B, 'wispB');
const wispC = links(C, 'wispC');
const chainJoints = (names, pts) => names.map((name, i) => ({ name, parent: i === 0 ? 'head' : names[i - 1], at: pts[i] }));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 1, 8] },
  { name: 'head', parent: 'body', at: [0, 1, 22] },
  { name: 'armL', parent: 'body', at: [6, -1, 20] },
  { name: 'handL', parent: 'armL', at: [10.6, -4.2, 12.8] },
  { name: 'armR', parent: 'body', at: [-6, -1, 20] },
  { name: 'handR', parent: 'armR', at: [-10.6, -4.2, 12.8] },
  ...chainJoints(wisp, A),
  ...chainJoints(wispB, B),
  ...chainJoints(wispC, C),
];

// frost motes floating by the streamers: [centre, joint]
const MOTES = [[[22, 10, 26], wisp[3]], [[23, 8, 31], wisp[3]], [[19, 13, 17], wispB[3]], [[-17, 12, 26], wispC[2]], [[13, 4, 16], 'body']];

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (near(rgb, FROST, 0.03)) {
    for (const [p, j] of MOTES) if (ellD(c, [1, 1, 1], p) < 1.2) return j;
    return c[2] > 20 ? 'head' : `hand${S}`;                      // the eye glints, or the icy claws
  }
  if (isAny(rgb, SKULL, 0.03)) return 'head';
  const a = chainHit(c, A, AR);
  const b = chainHit(c, B, BR);
  const k = chainHit(c, C, CR);
  return closest([
    ['body', Math.min(ellD(c, [7, 6.5, 6], [0, 0, 20]), ellD(c, [10, 9, 4], [0, 1, 9]), ellD(c, [11.6, 10.6, 4.5], [0, 1, 3.5]),
      capD([Math.abs(c[0]), c[1], c[2]], [0, 6.6, 23], [0, 9.4, 7], 1.6), capD(f, [4.5, 6.6, 23], [6.75, 9.4, 7], 1.6),
      ellD(c, [8.5, 8.2, 2.6], [0, 0.5, 21]), capD(c, [0, -6, 19], [0, -8.8, 5], 4))],
    ['head', Math.min(ellD(c, [8.5, 8, 8], [0, 1, 28]), ellD(c, [7, 6, 5], [0, 2, 33]), ellD(c, [7.2, 2, 7.6], [0, -5, 27]),
      capD(f, [4, -0.5, 33.5], [5.6, -0.9, 39.5], 1.6, 0.3), capD(f, [6.5, 1, 31.5], [8.7, 1.3, 35.5], 1.1, 0.3))],
    [`arm${S}`, capD(f, [6, -1, 20], [10.5, -4, 13], 2.4, 2)],
    [`hand${S}`, Math.min(ellD(f, [2.2, 2, 1.8], [11, -4.6, 12]), petalD(f, [2.6, 1.4, 3], [11.6, -6.2, 8.8]))],
    [wisp[a.i], a.d],
    [wispB[b.i], b.d],
    [wispC[k.i], k.d],
  ]);
}

// the other two streamers follow the main one, a little softer; the -X one mirrored
function follow(clips) {
  for (const c of Object.values(clips)) {
    const pose = c.pose;
    c.pose = (t, u) => {
      const p = pose(t, u);
      const out = { ...p };
      wisp.forEach((n, i) => {
        const q = p[n] ?? { r: [0, 0, 0] };
        const soft = { r: (q.r ?? [0, 0, 0]).map((v) => v * 0.85) };
        out[wispB[i]] = soft;
        if (i < wispC.length) out[wispC[i]] = mirror(soft);
      });
      return out;
    };
  }
  return clips;
}

const base = floaterClips({
  wisp, bob: 0.7,
  add: {
    // the streamers stream out behind in the glide
    walk: (t, u) => Object.fromEntries(wisp.map((n, i) => [n, { r: [0, 0, 6 + 2 * i] }])),
  },
});
delete base.idle_cackle;   // a skull with no jaw to cackle

const clips = follow({
  ...base,

  // fidget: a chill shudder, the claws flexing, the frost streamers lifting and rippling
  idle_shiver: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.85, 0.08);
      const sh = osc(u, 14) * on;
      return merge({
        body: { p: [0, 0, 0.7 + 0.4 * on], r: [0, 1.5 * sh, 2 * sh] },
        head: { r: [-6 * on, 0, 3 * sh] },
        armL: { r: [0, -10 * on, -6 * on] },
        armR: { r: [0, 10 * on, 6 * on] },
        handL: { r: [-20 * on, 0, 0] },
        handR: { r: [-20 * on, 0, 0] },
      }, Object.fromEntries(wisp.map((n, i) => [n, { r: [-6 * on * (1 + 0.3 * i) + 3 * sh, 0, 4 * osc(u, 4, -0.1 * i) * on] }])));
    },
  },

  // fidget: a slow beckon with the left claw, the hood tilting
  idle_beckon: {
    seconds: 2.6,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.18, 1], [0.78, 1], [0.92, 0]]);
      const curl = Math.max(0, osc(u, 3)) * win(u, 0.2, 0.75, 0.06);
      return merge({
        body: { p: [0, 0, 0.7], r: [4 * up, 0, 6 * up] },
        head: { r: [6 * up, -8 * up, 10 * up] },
        armL: { r: [-50 * up, -20 * up, 0] },
        handL: { r: [-35 * curl, 0, 0] },
      }, Object.fromEntries(wisp.map((n, i) => [n, { r: [2 * osc(u, 2, -0.1 * i), 0, 4 * osc(u, 1, -0.1 * i)] }])));
    },
  },
});

export default rigDef({ joints, assign, clips });
