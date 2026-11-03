// Blizzraak's rig: Glacifang grown into a heavy crystal-armoured ice dragon crouched on all fours, its head low and
// turned to its right with the jaw open, huge raised bat wings with frost spray, and a slim tail that sweeps to its far
// side and rises in a tall crystal blade beside the head. Built with Glacifang's drakeRig(); numbers are
// scad/blizzraak.scad's. The scad models everything at the art's sheet height and lowers it by G (the rock in the
// art), so the tests lift a point by G (`up`) and the joint positions drop by G (`dn`).
import { blobD, capD, ellD, fold, subFrame } from './lib/geo.mjs';
import { drakeRig } from './glacifang.mjs';

const G = 4.4;
const up = (c) => [c[0], c[1], c[2] + G];
const dn = (p) => [p[0], p[1], p[2] - G];
const lift = (test) => (c) => test(up(c));

const H = subFrame(dn([-2.7, -11.4, 13.2]), [-5, 0, -22], 1.12);

// the wing plane: through the shoulder, swept 15 deg back; points are [u, z], traced as u = (sheet x - WX) / cos 15
const WS = [3.4, -1.5, 22];
const WA = (15 * Math.PI) / 180;
const WX = 0.866 * WS[0] + 0.5 * WS[1];
const wu = ([sx, z]) => [(sx - WX) / Math.cos(WA), z];
const wp = ([u, z]) => [WS[0] + u * Math.cos(WA), WS[1] + u * Math.sin(WA), z];
const WING = [WS, wp(wu([1.4, 28.6])), wp(wu([2.4, 34.4])), [[19.1, 39.7], [18.8, 30], [15.8, 25], [9.5, 22.1]].map((q) => wp(wu(q)))];

const leg = (parts) => lift((f) => Math.min(...parts.map((t) => t(f))));
const legF = leg([
  (f) => ellD(f, [3.4, 4, 4.4], [6, -7, 14]),
  (f) => capD(f, [6.6, -7.4, 12], [7.4, -8.2, 8.4], 3.1, 2.6),
  (f) => capD(f, [7.4, -8.2, 8.4], [6.6, -11.2, 5.8], 2.6, 2.1),
  (f) => ellD(f, [1.9, 2.1, 1.0], [6.6, -11.8, 5.4]),
  (f) => ellD(f, [1.5, 1.4, 1.0], [6.6, -10.4, 5.9]),
  (f) => ellD(f, [2.4, 1.9, 1.0], [6.6, -13.8, 5.1]),
]);
const legB = leg([
  (f) => ellD(f, [3.4, 4.4, 4.5], [7.2, 4, 13.8]) * 0.97,
  (f) => capD(f, [7.8, 3.5, 11], [8.4, 6.8, 7.2], 2.8, 2.0),
  (f) => capD(f, [8.4, 6.8, 7.2], [8.2, 4.2, 5.6], 2.0, 1.7),
  (f) => ellD(f, [1.9, 2.1, 1.0], [8.2, 3.2, 5.4]),
  (f) => ellD(f, [2.2, 1.8, 1.0], [8.2, 1.2, 5.1]),
]);

// the tail's spine, then the blade (pp(4) on the sheet: its middle and its tip)
const TP = [[0, 8, 16], [-2.5, 13, 13], [-7, 14, 9], [-11.5, 10.5, 6.6], [-14.5, 5, 6.4], [-16, 0, 8], [-16.8, -3.5, 10.5],
  [-17, -5.2, 13], [-17.24, -5.34, 22.3], [-16.32, -4.81, 29.5]];
const TR = [3.6, 2.8, 2.2, 2.0, 1.9, 1.7, 1.5, 1.25, 2.6, 1.4];

const rig = drakeRig({
  skin: [0.36, 0.66, 0.83],
  lidSkin: [0.24, 0.5, 0.71],
  head: H,
  eye: { at: [1.95, -2.5, 1.35], size: 0.8, yaw: 42, flat: 0.5 },
  jawAt: [0, 0.6, -1.6],
  jawCols: [[0.55, 0.22, 0.27], [0.8, 0.5, 0.52]],
  hipH: 9.5,
  stride: 10,
  legF: [dn([6, -7, 14]), legF],
  legB: [dn([7.2, 4, 13.8]), legB],
  bodyAt: dn([0, -1, 15]),
  body: lift((c) => Math.min(
    blobD(c, [[[7.4, 7, 7.2], [0, -5.5, 15.6]], [[7, 7, 6.4], [0, 3.5, 14.6]]]),
    blobD(c, [[[5.4, 4.6, 3.4], [0, -6.5, 11.4]], [[5.2, 6.4, 3.2], [0, 2.5, 10.2]]]),
    ellD(c, [5.2, 3.8, 4.4], [0, -10, 13.4]),
    ellD(c, [5.2, 4.8, 5.2], [0, -7.5, 17]),
    // the gems: up the spine and over each shoulder; the shoulder orbs
    capD(c, [0, -10, 24], [0, 10, 20], 6, 4) * 0.92,
    capD(fold(c), [4.5, -10, 21], [4.5, 8, 19], 4.2, 3.2) * 0.92,
    ellD(fold(c), [2.8, 2.8, 2.8], [5.9, -9.7, 17.1]),
  )),
  headAt: dn([-1.2, -9.4, 14]),
  neckHead: lift((c) => Math.min(ellD(c, [3.8, 3.6, 3.6], [-1.4, -10, 14.4]), ellD(c, [2.8, 2.6, 2.3], [-0.6, -9.6, 12.4]),
    ellD(c, [2, 1.8, 1.6], [-1.6, -12, 12]))),
  skull: (h) => Math.min(
    blobD(h, [[[3.0, 3.0, 2.7], [0, 1.2, 1.0]], [[2.3, 2.2, 1.9], [0, -3.2, 0.8]], [[1.6, 1.1, 1.4], [0, -5.9, 0.3]]]),
    capD(fold(h), [1.2, -5.8, -0.7], [2.2, -1.9, -1.5], 0.5, 0.4),
    capD(h, [0, -3.2, 2.3], [0, -2.2, 6.7], 1.1, 0.4), capD(h, [0, 1.2, 3.3], [0, 3, 8.7], 1.1, 0.4),
    capD(fold(h), [1.3, -2.1, 2.5], [1.9, -0.9, 7.7], 1.1, 0.4), capD(fold(h), [2.0, 0.1, 2.6], [3, 1.7, 8], 1.1, 0.4),
    capD(fold(h), [1.9, 2.4, 2.2], [3.3, 4.6, 6.6], 1.1, 0.4),
    capD(fold(h), [2.4, 1.0, -0.8], [4, 3.8, -1.4], 0.8, 0.3), capD(fold(h), [2.6, 2.2, 0.6], [4.2, 5, 1.2], 0.8, 0.3),
  ),
  jaw: (h) => Math.min(blobD(h, [[[2.6, 2.4, 1.3], [0, 0.4, -2.3]], [[1.3, 1, 0.75], [0, -5.0, -3.6]]]),
    capD(fold(h), [1.0, -4.7, -3.1], [1.8, -1.7, -2.0], 0.45, 0.35)),
  tailPts: TP.map(dn),
  tailRs: TR.map((r) => r + 1),
  tailJoints: [0, 2, 4, 6],
  wing: [WING[0], WING[1], WING[2], WING[3]].map((p, i) => (i < 3 ? dn(p) : p.map(dn))),
  wingCols: [[0.7, 0.9, 0.97], [0.5, 0.78, 0.91], [0.85, 0.96, 1.0], [0.16, 0.38, 0.6], [0.27, 0.55, 0.76]],
  rimCols: [[0.9, 0.97, 1.0]],
});

// The tail runs round to the far side, so the template's wag swings a long lever: the blade beside the head swept
// across the face. Damp each link's turn, the root most.
const DAMP = { tail1: 0.25, tail2: 0.4, tail3: 0.5, tail4: 0.6 };
rig.clips = Object.fromEntries(Object.entries(rig.clips).map(([name, c]) => [name, {
  ...c,
  pose: (t, u) => {
    const p = c.pose(t, u);
    for (const [j, k] of Object.entries(DAMP)) if (p[j]?.r) p[j] = { ...p[j], r: p[j].r.map((v) => v * k) };
    return p;
  },
}]));

export default rig;
