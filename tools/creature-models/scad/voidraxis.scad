// Voidraxis: a cosmic serpent-dragon coiled in a figure-eight (2026-11-11 sprite-match remodel).
//
// Checklist (front sheet, x = sheet x, z up; the art is a three-quarter view, the head in profile to the viewer's left):
// - Head (x -15.5..-5, z 23..32): profile facing left, a long flat upper jaw to the tip (-15.4, 28), the mouth wide
//   open (z 25.3..26.9) with a long pale fang at (-11, 26.8..24.7) and small teeth; a chunky lower jaw (x -12.4..-8.5,
//   z 23..25.5). One fierce slanted almond eye at (-10.8, 29.6), glowing white-cream with a violet-blue halo, under a
//   hard brow that slopes down to the snout. A curled barbel loops forward off the snout tip (x -17.3..-14, z 27..32).
// - Crown: five thin purple spines standing up (x -12.8..-3, up to z 39.8).
// - Mane: long dark locks with teal and violet sheens streaming back and up to the right, tendril tips at (11.9, 35.7),
//   (11.5, 31), (9.8, 29.8); a few strands hanging down the back of the neck (x 0..3.5, z 19..27).
// - Whisker: a long thin tendril from the jaw corner trailing right to (16.5, 25.8).
// - Body: the bright purple neck and chest drop down the middle (x -8.5..-1.5 at z 20), sweep right along the bottom
//   of the big right loop (x 0..17.5, z 6..24.7), up its right side, over the top, then diagonally down-left BEHIND
//   the neck into the smaller left loop (x -14..-4, z 1..15.5), along the bottom (z 0.5..3.5) and the tail tucks up
//   behind the right loop's bottom at (9, 6). The neck is lit purple; the loops dark indigo-navy.
// - Markings: a web of glowing lilac crack lines forming irregular hex cells all over the body; white and blue
//   star specks on the dark loops.
// - Arm: a thin clawed arm reaching left from the chest (shoulder (-6.5, 16.5), hand (-15.5, 18) with four hooked
//   claws down to z 15); the far arm hidden behind it.
// - A frond of finned blades on the inner bottom (x -6.5..1, z 3..6.6).
// - Back: the neck rising out of the coil with the mane, the crack web on the neck, the loops behind.
include <lib.scad>

bodyLit = [0.28, 0.11, 0.54];
bodyDark = [0.09, 0.08, 0.36];
line = [0.66, 0.48, 0.95, NOGLOW];
star = [0.88, 0.86, 1, NOGLOW];
starB = [0.38, 0.5, 0.9, NOGLOW];
maneDark = [0.15, 0.08, 0.27];
maneTeal = [0.25, 0.42, 0.56];
maneViolet = [0.36, 0.2, 0.6];
spineC = [0.37, 0.19, 0.58];
fin = [0.17, 0.24, 0.46];
claw = [0.86, 0.76, 0.94, NOGLOW];
fang = [0.94, 0.9, 0.98, NOGLOW];
mouth = [0.12, 0.03, 0.14];
ink = [0.04, 0.02, 0.08];

// Picture-plane point [sheet x, depth, z] -> scad (the same turn as pp()).
function W(p) = [p[0] * cos(VIEW) - p[1] * sin(VIEW), p[0] * sin(VIEW) + p[1] * cos(VIEW), p[2]];

// Catmull-Rom spline through control points P, n samples per span.
function cr(a, b, c, d, t) = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
function spline(P, n) = concat([for (i = [0 : len(P) - 2]) for (k = [0 : n - 1])
  cr(P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)], k / n)], [P[len(P) - 1]]);
function lerp_r(R, n) = concat([for (i = [0 : len(R) - 2]) for (k = [0 : n - 1]) R[i] + (R[i + 1] - R[i]) * k / n], [R[len(R) - 1]]);

// ---- Body path, head end first, [sheet x, depth, z] with its radius. Neck and chest down the middle (0..6), the
// right loop (6..14), the diagonal behind the neck (14..16), the left loop (17..20), the bottom and the tucked tail.
CT = [[-6.5, 0, 29], [-3.6, 0, 26.8], [-3, -0.3, 24], [-4.5, -0.6, 20.5], [-5.6, -0.8, 16.5], [-5.8, -0.8, 12.5],
      [-4, -1, 9.0], [0.5, -1, 7.8], [5.5, -0.6, 8.4], [10, 0, 9], [13.8, 0.6, 11.6], [15, 1.2, 15.5], [13.6, 1.8, 19.8],
      [9.5, 2.4, 22], [5, 3, 20.6], [1.5, 4, 17.6], [-2.5, 4.6, 15.2], [-7, 4, 14.2], [-10.5, 2.6, 12.3],
      [-11.9, 1.2, 8.6], [-10.4, 0.2, 4.4], [-6.8, -0.4, 2.2], [-2, -0.6, 1.6], [3, -0.6, 1.8], [7, 0.4, 3.2],
      [9.2, 3.2, 6], [8.6, 3.4, 9.6], [6, 2.6, 12.4], [3, 3.4, 14.6], [0.8, 5.6, 16], [-0.5, 6.4, 16.6]];
CR = [2.1, 2.6, 2.9, 3.3, 3.5, 3.4, 3.2, 3.1, 3, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.3, 2.3, 2.3, 2.2, 2, 1.8, 1.65,
      1.55, 1.5, 1.45, 1.4, 1.35, 1.25, 0.9, 0.5];
S = 2;
LIT = 7 * S;                                  // samples before this are the lit purple neck and chest
pts = [for (p = spline(CT, S)) W(p)];
rs = lerp_r(CR, S);
NP = len(pts);
chain([for (i = [0 : LIT]) pts[i]], [for (i = [0 : LIT]) rs[i]], bodyLit, $fn = 14);
chain([for (i = [LIT : 15 * S]) pts[i]], [for (i = [LIT : 15 * S]) rs[i]], bodyDark, $fn = 14);
chain([for (i = [15 * S : NP - 1]) pts[i]], [for (i = [15 * S : NP - 1]) rs[i]], bodyDark, $fn = 12);

// ---- The glowing crack web: six zigzag lines along the body with rungs between them, staggered like a honeycomb
// and jittered, so the body reads as the sprite's irregular hex cells. Frame: the tangent and the view depth.
VD = W([0, 1, 0]);
function tg(i) = let(d = pts[min(i + 1, NP - 1)] - pts[max(i - 1, 0)]) d / norm(d);
function nA(i) = let(c = cross(tg(i), VD)) c / norm(c);
function nB(i) = let(c = cross(nA(i), tg(i))) c / norm(c);
function surf(i, a) = pts[i] + (nA(i) * cos(a) + nB(i) * sin(a)) * rs[i] * 0.97;
function jit(j, k) = ((j * 37 + k * 53) % 11 - 5) * 2.2;
function node(j, k) = surf(j, k * DA + 15 + ((j + k) % 2 == 1 ? 16 : -16) + jit(j, k));
LW = 0.2;
NL = 5;
JE = 26 * S;                                  // the tail end out of sight behind the coil carries no web
DA = 360 / NL;
for (k = [0 : NL - 1]) chain([for (j = [2 : JE]) node(j, k)], [for (j = [2 : JE]) LW * min(1, rs[j] / 1.6)], line, $fn = 4);
for (j = [2 : JE]) for (k = [0 : NL - 1]) if ((j + k) % 2 == 1)
  limb(node(j, k), node(j, (k + 1) % NL), LW * min(1, rs[j] / 1.6), LW * min(1, rs[j] / 1.6), line, $fn = 4);
// Star specks, mostly on the dark loops.
for (j = [3 : JE]) if (j > LIT || j % 2 == 0) let(a = j * 97 + 40)
  color(j > LIT && j % 3 == 0 ? starB : star) translate(surf(j, a) + (nA(j) * cos(a) + nB(j) * sin(a)) * 0.08)
    sphere(0.26, $fn = 4);

// ---- Finned frond on the inner bottom, small pale spurs on the neck's bend.
module blade(b, t, w, th, c) {
  color(c) hull() {
    translate(b) sphere(w, $fn = 8);
    translate(b + (t - b) * 0.4) scale([w * 0.9, th, w * 0.9]) sphere(1, $fn = 8);
    translate(t) sphere(0.06, $fn = 4);
  }
}
for (f = [[[-6.4, -0.6, 3.6], [1.0, -0.6, 4.2], 0.7], [[-5.6, -0.2, 3.8], [-0.4, -0.2, 5.6], 0.6],
          [[-5.0, 0.4, 4.0], [-3.8, 0.4, 6.7], 0.45], [[-6.0, -1.0, 3.2], [1.0, -1.0, 3.2], 0.45]])
  blade(W(f[0]), W(f[1]), f[2], 0.35, fin);

for (q = [[5 * S + 1, 205], [5 * S + 2, 215], [6 * S, 228], [6 * S + 1, 240]]) let(j = q[0], d = nA(j) * cos(q[1]) + nB(j) * sin(q[1]))
  spike(surf(j, q[1]), d * 1.2 + tg(j) * 0.3, 0.3, 0.04, claw);

// ---- Arms: thin and long, reaching left from the chest, a splayed hand of four hooked claws. Near arm in front
// (depth -2.6), the far one mirrored about the neck's plane (depth -0.8).
AR = [[-6.5, -2.4, 16.6], [-10.5, -3.4, 16.2], [-14.3, -3.4, 18.0], [-15.3, -3.4, 18.3]];
FINGERS = [[[-16.6, 19.4], [-16.0, 19.9]], [[-17.4, 18.6], [-17.6, 17.4]], [[-16.9, 16.9], [-16.4, 15.4]], [[-15.4, 16.4], [-14.5, 15.2]]];
module arm(far) {
  m = function(p) far ? [p[0] + 0.5, -1.6 - p[1], p[2] + 0.3] : p;
  chain([for (p = AR) W(m(p))], [1.0, 0.8, 0.65, 0.7], bodyLit, $fn = 10);
  for (f = FINGERS) let(a = m([f[0][0], -3.4, f[0][1]]), b = m([f[1][0], -3.4, f[1][1]]))
    chain([W(m(AR[3])), W(a), W(b)], [0.36, 0.24, 0.05], claw, $fn = 5);
}
arm(false);
arm(true);

// ---- Mane: a soft dark mass behind the head and long locks streaming back and up, teal and violet sheens.
color(maneDark) hull() {
  translate(W([-8.5, 0.6, 32.2])) rotate([0, 0, VIEW]) scale([2.4, 2.2, 1.8]) sphere(1, $fn = 14);
  translate(W([-3.5, 0.6, 32.6])) rotate([0, 0, VIEW]) scale([3.2, 2.4, 2.6]) sphere(1, $fn = 14);
  translate(W([0.5, 0.6, 30])) rotate([0, 0, VIEW]) scale([2.6, 2.2, 2.6]) sphere(1, $fn = 14);
  translate(W([-2, 0.4, 27.5])) rotate([0, 0, VIEW]) scale([2, 2, 1.6]) sphere(1, $fn = 12);
}
// [points [sx, z], radii, colour, depth]: each lock a smooth spline through its points, curling at the tip.
LOCKS = [
  [[[-9.5, 33.5], [-6, 36.2], [-1, 37.6], [4, 37.2], [8.5, 36.6], [11.2, 36.4], [11.9, 35.6]], [1.3, 1.25, 1.05, 0.8, 0.5, 0.25, 0.08], maneTeal, -0.6],
  [[[-9, 33], [-5, 35.6], [0, 36.6], [4.5, 36.4], [7.5, 35.6], [9.2, 35.9]], [1.25, 1.2, 1.0, 0.7, 0.35, 0.08], maneViolet, 1.4],
  [[[-8, 32.4], [-3, 34.6], [2, 34.8], [6.5, 33.6], [9.6, 31.8], [11.6, 31.2], [11.2, 31.9]], [1.45, 1.4, 1.2, 0.9, 0.5, 0.2, 0.08], maneDark, -1.6],
  [[[-7, 31.6], [-2.5, 33.4], [2.5, 33.2], [6.2, 32.4], [8.6, 32.8], [10, 33.6]], [1.25, 1.2, 0.95, 0.6, 0.3, 0.08], maneTeal, 1.8],
  [[[-6.5, 31], [-2, 32.2], [2.5, 31.4], [6, 30.2], [8.5, 29.8], [10, 30.3]], [1.35, 1.3, 1.05, 0.65, 0.3, 0.08], maneViolet, -2.2],
  [[[-5, 29.8], [-1.5, 30], [2.5, 28.8], [4.8, 27.4], [6, 27.2]], [1.25, 1.15, 0.8, 0.35, 0.08], maneTeal, -1.4],
  [[[-4, 29.4], [0, 29.6], [3.5, 28.8], [6, 29.2], [7.2, 30]], [1.15, 1.05, 0.7, 0.3, 0.08], maneDark, 1.6],
  [[[-1.4, 28], [0.2, 25.2], [1.2, 22.4], [1.6, 20.6], [2.4, 19.4]], [1.0, 0.85, 0.6, 0.3, 0.08], maneTeal, 0.6],
  [[[1.2, 28], [2.4, 25.6], [3.2, 23.4], [3.8, 22.2]], [0.9, 0.65, 0.3, 0.08], maneDark, 1.4],
  [[[0.2, 27.4], [1.6, 24.8], [1.8, 22.6], [1.2, 21.2]], [0.8, 0.6, 0.3, 0.08], maneViolet, -1.2],
  [[[-11.6, 31.4], [-9.8, 34.2], [-7, 36.6], [-3.8, 38.3], [-0.8, 38.6]], [0.9, 0.85, 0.7, 0.4, 0.08], maneTeal, -1.0],
  [[[-10.6, 31.8], [-8.6, 34.6], [-5.6, 37.0], [-2.6, 37.4]], [0.85, 0.8, 0.5, 0.08], maneViolet, 0.8],
];
for (l = LOCKS) let(P = spline([for (p = l[0]) W([p[0], l[3], p[1]])], 2), R = lerp_r(l[1], 2)) chain(P, R, l[2], $fn = 6);
// Crown spines standing up out of the mane.
for (s = [[[-12.4, 0.6, 31.6], [-12.8, 0.6, 35.8], 0.4], [[-11, -0.4, 32.2], [-11.2, -0.4, 37.4], 0.45],
          [[-9.8, 0.4, 32.8], [-8.6, 0.4, 39.8], 0.5], [[-6.6, -0.8, 33.6], [-6.9, -0.8, 38.2], 0.42],
          [[-4.2, 0.2, 33.6], [-3.1, 0.2, 39.8], 0.5]])
  chain([W(s[0]), W((s[0] + s[1]) / 2 + [0.2, 0, 0]), W(s[1])], [s[2], s[2] * 0.62, 0.06], spineC, $fn = 8);
// Long whiskers from the jaw corners trailing right, the near one over the neck, the far one behind.
for (w = [[-3.2, 0], [3.0, 0.6]]) let(d = w[0], dz = w[1])
  chain([W([-8.6, d * 0.5, 26.8 + dz]), W([-4.5, d, 26.6 + dz]), W([0, d, 26.2 + dz]), W([5, d * 0.7, 26.4 + dz]),
         W([10, d * 0.4, 26 + dz]), W([14, d * 0.25, 25.7 + dz]), W([16.6, d * 0.2, 25.9 + dz])],
        [0.32, 0.28, 0.24, 0.2, 0.16, 0.12, 0.06], maneViolet, $fn = 4);

// ---- Head: in profile facing sheet-left (turned -60 degrees), local y = sheet x + 8.5, local z = sheet z - 29.6,
// local +X towards the viewer. H0 is its centre.
H0 = [-8.5, 0, 29.6];
HYAW = -60;
translate(W(H0)) rotate([0, 0, HYAW]) {
  // skull, brow and the long flat upper jaw
  blob([[[2.0, 2.6, 2.1], [0, 0.6, 0.4]], [[1.6, 1.8, 1.25], [0, -2.2, 0.55]], [[1.35, 1.3, 1.2], [0, -3, -1.2]],
        [[1.1, 1.4, 1.0], [0, -5, -1.5]], [[0.85, 0.7, 0.8], [0, -6.3, -1.6]]], bodyLit);
  ell([0.6, 0.8, 0.5], [0, -6.0, -0.75], bodyLit);                    // nose bump
  // open mouth
  color(mouth) hull() {
    translate([0, -1, -2.7]) scale([1.25, 1.3, 0.9]) sphere(1, $fn = 10);
    translate([0, -4.9, -2.8]) scale([0.75, 0.8, 0.55]) sphere(1, $fn = 8);
    translate([0, -3.4, -4.3]) scale([0.7, 0.8, 0.55]) sphere(1, $fn = 8);
  }
  // lower jaw hanging open
  blob([[[1.3, 1.4, 1.0], [0, -0.3, -3.8]], [[1.0, 1.3, 0.95], [0, -2.6, -5.6]], [[0.75, 0.7, 0.7], [0, -3.9, -5.2]]], bodyDark);
  mirror_x() {
    // the long fang, a short front fang, two lower teeth
    spike([0.75, -3.0, -2.2], [0, -0.15, -2.1], 0.32, 0.05, fang);
    spike([0.6, -5.4, -2.3], [0, -0.1, -1.1], 0.24, 0.05, fang);
    spike([0.6, -3.6, -4.7], [0, -0.1, 1.0], 0.22, 0.05, fang);
    spike([0.7, -2.4, -4.9], [0, 0, 0.8], 0.2, 0.05, fang);
    // the glaring eye: glowing white-cream core in a violet-blue halo, an angry slanted lid
    eye([1.5, -2.3, 0.05], 1.05, iris = [1, 0.95, 0.86, GLOW], sclera = [0.58, 0.5, 1, GLOW], pupil = [1, 0.95, 0.86, GLOW],
        yaw = 80, flat = 0.45, lid = 0.4, lid_tilt = 28, lid_c = bodyLit, squint = 0.3, shine = false);
    // hard brow ridge sloping down to the snout
    color(bodyLit) hull() {
      translate([1.2, -3.7, 0.55]) sphere(0.35, $fn = 8);
      translate([1.5, -1.0, 1.3]) scale([0.5, 0.7, 0.4]) sphere(1, $fn = 10);
    }
    ell([0.18, 0.2, 0.16], [0.55, -6.6, -0.95], ink);                  // nostril
    // the curled barbel off the snout tip
    chain([[0.8, -6.7, -2.0], [0.9, -8.1, -2.2], [0.9, -8.8, -1.0], [0.8, -8.3, 0.6], [0.7, -6.9, 1.6], [0.6, -5.6, 2.3]],
          [0.3, 0.28, 0.24, 0.2, 0.15, 0.06], bodyLit, $fn = 6);
  }
}
