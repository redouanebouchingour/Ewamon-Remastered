// Coalette: a baby coal kaiju. Charcoal hide of cracked plates, a glowing ember core on its belly, golden slit eyes
// under heavy brows, a ridge of soft flames from its brow down its back and along its tail, and a thick tail that
// curls up behind it into a tall flame plume.
//
// Checklist (front sheet, x / z):
//   pose      crouched kaiju, hunched forward, head low and forward; the far arm (-X) reaches out to the left with
//             its claws open (hand x -18..-14, z 6..10); the near arm (+X) hangs down in front of the near flank
//             (claws x 0..3, z 5); feet forward under the belly (far foot x -13..-7, near x -2..5, z 0..3); the near
//             haunch a big round thigh at x 5..14, z 4..13.
//   head      broad lizard head x -12.6..-2, z 14..24.5: big cranium, flat wide face, blunt muzzle, maroon jaw.
//   face      near eye x -6..-4, z 17.3..19.2: golden with a black slit, amber rim, hooded by a heavy brow
//             slanting to the nose; far eye a sliver on the left edge (-12, 18.5); nostril (-9.3, 16.5); mouth a
//             dark line low on the muzzle (z 14.6).
//   belly     ember core disc centred (-5.8, 8.2), r 4.5: maroon halo, orange ring, yellow ring, dark heart.
//   flames    soft tongues (red rim, orange, yellow heart): three on the head (tips -10/30.5, -5.5/31.5, -1/28.5),
//             two on the back (4.6/27), three along the tail (8/20, 12.5/20.5, 17/26), the plume x 8..16.5,
//             z 20..39.5 on the tail tip.
//   tail      thick, segmented coal plates with maroon seams: low behind the near thigh (x 8..14, z 3..8), rising
//             at x 13..18 to z 22.
//   back      the tail sweeps out to the creature's +X and curls up; flames along the spine and the tail's top.
include <lib.scad>

coal = [0.29, 0.21, 0.26];
coalDk = [0.22, 0.15, 0.19];
seam = [0.45, 0.13, 0.08];
maroon = [0.36, 0.13, 0.12];
ink = [0.05, 0.03, 0.07];
claw = [0.7, 0.53, 0.4];
fRed = [0.8, 0.23, 0.05, NOGLOW];
fOrange = [0.93, 0.5, 0.06, NOGLOW];
coreOrange = [0.96, 0.59, 0.12, GLOW];
fYellow = [0.98, 0.76, 0.24, GLOW];
coreHalo = [0.57, 0.17, 0.1, NOGLOW];
crack = [0.9, 0.36, 0.08, GLOW];
crackDim = [0.9, 0.36, 0.08, NOGLOW];

// A point read off the front sheet at depth y (the camera looks 10 degrees down: deeper parts sit higher).
function S(sx, sz, y) = [(sx - 0.5 * y) / 0.866, y, sz - 0.17 * y];

// ---- Flames: soft tongues built from circles along a curved path, layered red / orange / yellow (each layer a bit
// thicker so it shows on both faces), and crossed with a second one turned 90 degrees so they read from every side.
// `fork` adds a second, shorter tip branching off the side (+1 right, -1 left, 0 none): ragged, not a cone.
module tongue2d(h, w, lean, bend, fork = 1) {
  rs = [1, 0.95, 0.72, 0.42, 0.06];
  function at(s) = [lean * s * s + bend * sin(180 * s), h * s];
  for (i = [0 : 3]) hull() for (k = [i, i + 1]) translate(at(k / 4)) circle(r = max(0.08, w * rs[k]), $fn = 8);
  if (fork != 0) hull() {
    translate(at(0.4)) circle(r = w * 0.55, $fn = 6);
    translate(at(0.62) + [fork * w * 1.25, -h * 0.02]) circle(r = 0.08, $fn = 6);
  }
}
module tongue(h, w, lean, bend, t, layers = 3, fork = 1) {
  color(fRed) rotate([90, 0, 0]) linear_extrude(height = t, center = true) tongue2d(h, w, lean, bend, fork);
  color(fOrange) rotate([90, 0, 0]) linear_extrude(height = t + 0.5, center = true) tongue2d(h * 0.74, w * 0.68, lean * 0.6, bend * 0.8, -fork);
  if (layers > 2) color(fYellow) rotate([90, 0, 0]) linear_extrude(height = t + 1, center = true)
    translate([0, h * 0.04]) tongue2d(h * 0.46, w * 0.42, lean * 0.3, bend * 0.5, 0);
}
// A flame at p, its face turned to the sprite camera, plus the crossed copy.
module flame(p, h, w, lean = 0, bend = 0, t = 1.6, fork = 1) {
  translate(p) rotate([0, 0, VIEW]) {
    tongue(h, w, lean, bend, t, 3, fork);
    rotate([0, 0, 90]) tongue(h * 0.9, w * 0.8, 0, bend * 0.5, t, 2, -fork);
  }
}

// ---- Coal plates: glowing seams laid on a surface. A lat-long net of points (jittered, rows offset like bricks)
// over an ellipsoid round centre c with radii r; each seam is a thin quad standing on the surface (it holds the
// outward normal), and the caller intersects the net with its body grown a little, so the seams lie flush on it.
// Latitudes `lats`, longitude step `dl`; only seams whose midpoint lies in the box bx = [lo, hi] are drawn.
function jit(i, j, seed) = rands(-1, 1, 2, seed + i * 31 + j * 7);
function netPt(c, r, la, lo) = c + [r[0] * cos(la) * cos(lo), r[1] * cos(la) * sin(lo), r[2] * sin(la)];
function inBox(p, bx) = p[0] > bx[0][0] && p[0] < bx[1][0] && p[1] > bx[0][1] && p[1] < bx[1][1] && p[2] > bx[0][2] && p[2] < bx[1][2];
module seamQuad(a, b, c) {
  n = (a + b) / 2 - c;
  u = n / norm(n) * 2.6;
  hull() for (p = [a + u, a - u, b + u, b - u]) translate(p) cube(0.28, center = true);
}
module seamNet(c, r, lats, dl, bx, seed) {
  n = round(360 / dl);
  pts = [for (i = [0 : len(lats) - 1]) [for (j = [0 : n - 1])
    let(d = jit(i, j, seed)) netPt(c, r, lats[i] + d[0] * 5, j * dl + (i % 2) * dl / 2 + d[1] * dl * 0.2)]];
  for (i = [0 : len(lats) - 1]) for (j = [0 : n - 1]) {
    a = pts[i][j];
    b = pts[i][(j + 1) % n];
    if (inBox((a + b) / 2, bx)) seamQuad(a, b, c);
    // up to the next row: the brick offset joins each point to one above
    if (i < len(lats) - 1) {
      u = pts[i + 1][(j + (i % 2)) % n];
      if (inBox((a + u) / 2, bx)) seamQuad(a, u, c);
    }
  }
}

// ---- Body: a hunched pear, hips low and wide, shoulders forward, a thick neck reaching to the low head.
torso = [[[8, 7.5, 6.6], [-1, -0.5, 8]], [[6.6, 6, 6.2], [0, 0.5, 14.5]], [[4.6, 4.4, 4.4], [-1.6, -5, 17.5]]];
blob(torso, coal);

// Ember core on the belly, painted flush with the hull in rings (halo, orange, yellow, dark heart), front half only.
coreC = [-5.8, 8.2];
module coreRing(r, g, c) color(c) intersection() {
  blob([for (e = torso) [e[0] + [g, g, g], e[1]]]);
  prism([for (a = [0 : 30 : 330]) coreC + r * [cos(a), sin(a)]]);
  translate([-30, -30, -1]) cube([60, 28, 40]);
}
coreRing(4.6, 0.12, coreHalo);
coreRing(3.6, 0.24, coreOrange);
coreRing(2.3, 0.36, fYellow);
coreRing(0.9, 0.48, seam);

// Cracked coal: glowing seams between plates over the back, shoulders, flanks and haunches (not the belly core).
color(crack) intersection() {
  union() {
    blob([for (e = torso) [e[0] + [0.14, 0.14, 0.14], e[1]]]);
    mirror_x() ell([4.54, 5.14, 4.74], [8.6, 2.5, 8.5]);
  }
  union() {
    seamNet([-0.5, 0, 11], [8.6, 7.8, 10.4], [-5, 20, 42, 62], 45, [[-30, -30, 3], [30, 30, 40]], 3);
    mirror_x() seamNet([8.6, 2.5, 8.5], [4.5, 5.1, 4.7], [-5, 35], 72, [[9.5, -30, 4], [30, 30, 40]], 11);
  }
  difference() {
    translate([-30, -30, 0]) cube([60, 60, 40]);
    // keep the belly core clear
    translate([-30, -30, 0]) cube([33, 27.5, 15]);
  }
}

// ---- Head (centre H): big cranium, broad flat face, blunt muzzle, a maroon lower jaw.
H = [-2, -9.5, 20.6];
head = [[[4.6, 4.6, 4.8], H + [0, 0.8, 0.6]], [[4.6, 3.4, 3.6], H + [0, -3, -0.8]], [[3.4, 3.2, 2.6], H + [0, -5.6, -1.6]]];
blob(head, coal);
ell([3.0, 3.0, 1.3], H + [0, -3.6, -3.7], maroon);
// Seams over the crown and the back of the head, clear of the face.
color(crack) intersection() {
  blob([for (e = head) [e[0] + [0.14, 0.14, 0.14], e[1]]]);
  seamNet(H + [0, 0.8, 0.6], [4.7, 4.7, 4.9], [10, 40], 50, [[-30, H[1] - 1.2, H[2] + 1.6], [30, 30, 40]], 23);
}
// Mouth: a dark line round the front of the muzzle, low down.
color(ink) intersection() {
  blob([for (e = head) [e[0] + [0.15, 0.15, 0.15], e[1]]]);
  translate(H + [-10, -20, -3.7]) cube([20, 17, 0.32]);
}
// Nostrils.
mirror_x() color(ink) translate([1.15, 0, 0] + [0, H[1] - 8.45, H[2] - 0.6]) scale([0.45, 0.3, 0.32]) sphere(1, $fn = 8);
// Brow ridge over an eye at p (size s, same yaw), the inner end (side * -x) dropping towards the nose: a scowl.
module brow(p, s, side, yaw) {
  color(coalDk) translate(p) rotate([0, 0, yaw]) hull() {
    translate([side * s * 1.0, s * 0.1, s * 0.85]) scale([s * 0.55, s * 0.62, s * 0.42]) sphere(1, $fn = 10);
    translate([-side * s * 0.85, -s * 0.15, s * 0.45]) scale([s * 0.5, s * 0.6, s * 0.38]) sphere(1, $fn = 10);
    translate([0, s * 0.2, s * 0.95]) scale([s * 1.05, s * 0.75, s * 0.5]) sphere(1, $fn = 10);
  }
}
eyeR = 1.35;
eyeL = H + [4, -4.2, -0.1];
eyeRt = H + [-4, -4.2, -0.1];
for (e = [[eyeL, 30, 1], [eyeRt, -30, -1]]) {
  eye(e[0], eyeR, iris = [0.98, 0.76, 0.24, NOGLOW], sclera = [0.93, 0.5, 0.06, NOGLOW], pupil = ink, yaw = e[1],
      lid = 0.26, lid_tilt = 24, lid_c = coalDk, slit = 0.3);
  brow(e[0], eyeR, e[2], e[1]);
}

// ---- Arms: the far one (-X) reaches out to the left with open claws, the near one (+X) hangs down.
limb([-5.6, -3.5, 14], [-10.5, -6, 10.5], 2.4, 2.1, coal);
limb([-10.5, -6, 10.5], [-14, -7.5, 8.6], 2.1, 1.8, coal);
ell([2, 1.9, 1.6], [-14.6, -7.8, 8.2], coal);
for (a = [-1, 0, 1]) spike([-14.6 + a * 1.1, -8.4 - abs(a) * 0.2 + a * 0.6, 7.2], [-0.5 + a * 0.3, -0.6, -1.4], 0.42, 0.06, claw);
limb([6, -3.5, 14], [7.6, -6.5, 10], 2.4, 2.1, coal);
limb([7.6, -6.5, 10], [6.4, -8.6, 7], 2.1, 1.8, coal);
ell([1.9, 1.9, 1.6], [6.3, -9, 6.4], coal);
for (a = [-1, 0, 1]) spike([6.3 + a * 1.0, -10, 5.4], [a * 0.2, -0.7, -1.2], 0.42, 0.06, claw);

// ---- Legs: big round haunches, short shins reaching forward to wide feet under the belly, pale claws.
mirror_x() {
  ell([4.4, 5, 4.6], [8.6, 2.5, 8.5], coal);
  limb([8.2, 0, 5.5], [6.3, -6, 2], 2.9, 2.3, coal);
  blob([[[2.6, 3.4, 1.7], [6.2, -8, 1.7]], [[2.2, 2, 1.5], [6.2, -5.5, 1.6]]], coal);
  for (a = [-1, 0, 1]) spike([6.2 + a * 1.4, -11, 0.9], [a * 0.3, -1.2, -0.3], 0.48, 0.06, claw);
}

// ---- Tail: a glowing core with coal plates over each link, so the seams glow between them. It rises from the rump
// out and up behind the near thigh in a thick S, curling back at the top into the plume.
tail = [[3, 7, 7], [7.5, 10, 7], [11.5, 10.5, 10], [13, 9, 15], [12.5, 7.5, 20], [11.5, 6.5, 24], [11, 6, 26.5]];
tailR = [4, 3.6, 3.3, 3.0, 2.7, 2.3, 1.9];
chain(tail, tailR * 0.97, crackDim);
color(coal) translate(tail[0]) sphere(tailR[0] * 1.03, $fn = 16);
for (i = [0 : len(tail) - 2]) color(coal) hull() {
  translate(tail[i] + (tail[i + 1] - tail[i]) * 0.2) sphere(tailR[i] * 1.03, $fn = 16);
  translate(tail[i] + (tail[i + 1] - tail[i]) * 0.8) sphere(tailR[i + 1] * 1.03, $fn = 16);
}

// ---- Flames along the ridge: head, back, tail.
flame(S(-9.4, 21.5, -13), 10, 1.7, -0.6, -0.6);
flame(S(-6.2, 24, -9), 9, 1.8, 1.0, 0.6);
flame(S(-1.6, 22.5, -4.5), 7, 1.6, 0.4, 0.5);
flame(S(3.2, 19.5, 2.5), 8, 1.7, 1.2, -0.5);
flame(S(6.5, 16, 6), 5.5, 1.4, 0.6, 0.3);
// The tail's upper half wrapped in ragged flames, outer and inner side.
flame([11.5, 10.5, 12.3], 6, 1.6, -0.8, 0.4, fork = -1);
flame([15.3, 9, 15.5], 7, 1.7, 1.6, 0.4);
flame([14.6, 7.5, 20.5], 8, 1.8, 1.2, -0.4);
flame([10.6, 7.5, 20.5], 7, 1.6, -1.6, 0.4, fork = -1);
flame([12.8, 6.5, 24.5], 9, 1.8, 0.8, 0.5);
flame([9.2, 6.5, 24.5], 8, 1.7, -1.4, -0.4, fork = -1);

// ---- The plume on the tail tip: a big S-curved tongue with three smaller ones round it, thicker so it reads from
// the side too.
tip = tail[len(tail) - 1];
translate(tip + [0, 0, -1]) rotate([0, 0, VIEW]) {
  tongue(15, 4.4, -0.6, 2.2, 3);
  translate([2.6, 0, 2]) tongue(8, 2, 1.6, 0.4, 2.4, 3, -1);
  translate([-2.4, 0, 1]) tongue(7, 1.8, -1.4, -0.3, 2.4, 2, 1);
  rotate([0, 0, 90]) tongue(11, 2.6, 0, 1.2, 2.4, 2, -1);
}
