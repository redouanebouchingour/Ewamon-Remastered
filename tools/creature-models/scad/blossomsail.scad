// Blossomsail: an elegant lavender-grey dove in flight, seen from the front: wings raised high in a wide V, each a fan
// of long pale-pink petal feathers with near-white tips over a darker pink row of coverts; a slim neck and a small
// round head turned to its right, one big plum almond eye, a short sage beak, a crown of pink blossoms with leaves and
// buds; little green feet tucked under; a long trailing tail of green willow streamers, two of them curling round to
// end in pink buds; blossom petals drifting about it.
//
// Checklist (front sheet, x = sheet x, z):
//   head    x -5..0, z 28.5..33, round; beak x -6.6..-4.6 z 29.6..31.4 sage grey, pointing to the viewer's left
//   eye     x -3.7..-1.3, z 30.5..32.3: almond, plum iris filling it, white highlight top-left, soft upper lid
//   crown   blossoms at (-4, 34.4) (-1.2, 34) (-5.5, 33.8), leaves up (-2, 36.8) and back, buds (0.4, 38.4) (2.4, 36.4)
//   neck    x -4..-0.5 at z 27, slim; body teardrop chest x -4.8..2.5 at z 22, rump narrowing to (4.5, 15.8)
//   wings   near: shoulder (0.9, 24.8), arm to (7.5, 31.5), tips (16.7, 39.9) .. (20, 33.6) .. (6.8, 19.9)
//           far: tips (-15.6, 39.2) .. (-17.2, 35) .. (-8, 19.5); the scad wings are mirrored, swept 15 deg back
//   feet    green, (-1.5, 15) and (1, 14.3), small grasping toes
//   tail    green streamers from (4.5, 15.8) fanning to (14.4, 12.3) (12.4, 7.6) (10.2, 6) (6.6, 4.4) (2.2, 5.2),
//           two curling left to buds at (-4.5, 9.6) and (-4.5, 6); a bud at (0.8, 3.2)
//   petals  drifting, mostly on the left (x -16..-4, z 3..20), three on the right
//   back    grey back, the wing arms across it, the same pink fans; nothing else
// It hovers: the ground is the sheet's z 0, under the lowest petal.
// ground: 0
include <lib.scad>

grey = [0.72, 0.71, 0.79];
greyLight = [0.8, 0.8, 0.86];
beak = [0.5, 0.58, 0.53];
beakDark = [0.3, 0.36, 0.33];
plum = [0.52, 0.2, 0.46];
plumDark = [0.3, 0.08, 0.27];
pupil = [0.16, 0.04, 0.14];
pink = [0.98, 0.78, 0.8, NOGLOW];
pinkPale = [0.99, 0.9, 0.9, NOGLOW];
pinkDark = [0.9, 0.6, 0.64, NOGLOW];
petalCore = [0.95, 0.66, 0.3, NOGLOW];
leaf = [0.51, 0.63, 0.42, NOGLOW];
leafDark = [0.36, 0.47, 0.37];
leafLight = [0.62, 0.75, 0.47, NOGLOW];

// ---- Body: a teardrop leaning forward, chest high, rump narrowing back and down to the tail.
BODY = [[[3.6, 3.5, 4.4], [0, -2.5, 22.3]], [[2.8, 2.8, 2.4], [0, -0.2, 19.3]], [[1.3, 1.3, 1.2], [1.2, 6.5, 15.8]]];
blob(BODY, grey);
// The pale breast.
ell([2.8, 1.6, 3.6], [0, -4.6, 21.8], greyLight);
// Neck: slim, curving forward to the head.
NECK = [[0, -3, 24.5], [0, -4, 27.2], [0, -4.4, 29]];
chain(NECK, [2, 1.6, 1.5], grey);

// ---- Head: turned 25 deg to its right (the beak to the viewer's left); everything inside is in the head's frame.
HEAD_AT = [0, -4.5, 30.8];
HEAD_ROT = [0, 0, -25];
module blossom(p, s, rot = [0, 0, 0]) {
  translate(p) rotate(rot) {
    for (a = [0 : 72 : 359]) color(pink) rotate([0, 0, a]) translate([s * 0.85, 0, 0]) scale([s * 0.75, s * 0.6, s * 0.3]) sphere(1, $fn = 10);
    color(pinkDark) scale([s * 0.5, s * 0.5, s * 0.3]) translate([0, 0, 0.4]) sphere(1, $fn = 8);
    color(petalCore) translate([0, 0, s * 0.3]) sphere(s * 0.22, $fn = 6);
  }
}
// A flat leaf from a to b, widest past the middle.
module leafy(a, b, w) {
  L = norm(b - a);
  translate(a) rotate(_dir_rot(b - a)) hull() {
    sphere(0.2, $fn = 6);
    translate([0, 0, L * 0.58]) scale([w, w * 0.35, L * 0.42]) sphere(1, $fn = 10);
  }
}
module bud(p, s, rot = [0, 0, 0]) {
  translate(p) rotate(rot) {
    color(pink) scale([s * 0.75, s * 0.75, s]) sphere(1, $fn = 10);
    color(leafDark) translate([0, 0, -s * 0.8]) scale([s * 0.5, s * 0.5, s * 0.45]) sphere(1, $fn = 8);
  }
}
translate(HEAD_AT) rotate(HEAD_ROT) {
  ell([2.3, 2.6, 2.3], [0, 0, 0], grey);
  // Beak: short and a little hooked, sage grey with a darker tip.
  spike([0, -2.2, -0.2], [0, -2.6, -0.7], 0.8, 0.15, beak);
  spike([0, -4.5, -0.75], [0, -0.4, -0.5], 0.28, 0.08, beakDark);
  // Eyes: big plum almonds, a soft lid over the top, a white shine.
  mirror_x() eye([1.5, -1.75, 0.45], 1.0, iris = plumDark, sclera = plum, pupil = pupil, yaw = 48, lid = 0.22, lid_tilt = -8, lid_c = grey, squint = 0.12, shine = true);
  // Crown: blossoms round the top, leaves and buds sweeping up and back.
  // (head-frame numbers chosen so they land on the sheet: sheet x = 0.573 x + 0.819 y - 2.25, z = 30.8 + z)
  blossom([1.2, 0.45, 3.0], 1.6, [60, 20, 0]);
  blossom([-1.5, -1.1, 2.8], 1.6, [55, -15, 0]);
  blossom([-2.2, -1.9, 1.8], 1.1, [70, -40, 0]);
  blossom([0.2, 1.7, 2.6], 1.3, [20, 30, 0]);
  // Leaves: one up over the middle, a spray sweeping back to the right.
  for (l = [[[-0.5, 0, 3.2], [-0.2, 0.3, 6.2], 0.75], [[1.4, 1.6, 2.2], [3.2, 3.4, 3.4], 0.7], [[1.4, 1.8, 1.4], [3.0, 3.6, 0.6], 0.65],
            [[0.6, 2.2, 0.6], [1.6, 3.6, -0.8], 0.6], [[-0.6, 1.8, 2.4], [-1.4, 3.4, 3.4], 0.6]])
    color(leaf) leafy(l[0], l[1], l[2]);
  // Buds on stems: one tall over the crown, two off the back.
  limb([0.6, 1.4, 2.8], [1.0, 2.4, 6.6], 0.2, 0.17, leafDark);
  bud([1.0, 2.5, 7.3], 0.95);
  limb([1.8, 2.4, 2.4], [2.9, 3.5, 4.8], 0.2, 0.17, leafDark);
  bud([3.0, 3.6, 5.5], 0.85, [30, 20, 0]);
  limb([1.8, 2.4, 1.0], [2.9, 3.5, 1.6], 0.2, 0.17, leafDark);
  bud([3.2, 3.8, 1.9], 0.8, [60, 40, 0]);
}

// ---- Wings: raised in a wide V, swept 15 deg back. Authored in the near (+X) wing's own plane: u along the wing
// (sheet x - 0.88) / 0.966, z = sheet z - 24.8; mirrored to the far wing.
SHOULDER = [2.4, -2.4, 24.8];
SWEEP = 15;
function W(p) = [(p[0] - 0.88) / 0.966, 0, p[1] - 24.8];
ARM = [[0.9, 24.8], [4, 27.5], [7.5, 31.5], [10.5, 34]];
// [base x, base z, tip x, tip z] on the sheet: two over the wrist, six primaries off the hand, seven secondaries.
FEATHERS = [
  [6.8, 31, 12.8, 36.8], [8.6, 32.6, 15, 38.6],
  [10.5, 34, 16.7, 39.9], [10, 33.4, 18.6, 38.1], [9.5, 32.8, 19.7, 36], [9, 32.3, 20, 33.6], [8.5, 31.8, 19.6, 31],
  [7.8, 31.2, 19, 28.6], [7, 30.5, 18, 26.4], [6.2, 29.6, 16.6, 24.3], [5.4, 28.7, 14.6, 22.6], [4.6, 27.9, 12.2, 21],
  [3.6, 27, 9.6, 19.8], [2.6, 26.2, 6.8, 19.9], [1.6, 25.4, 4.2, 20.8]];
// A petal feather from a to b: narrow at the root, widest two thirds out, a rounded tip (the art's petal shape).
module feather(a, b, w, t, y = 0) {
  d = b - a;
  L = norm(d);
  translate(a + [0, y, 0]) rotate([0, atan2(d[0], d[2]), 0]) hull() {
    translate([0, 0, 0.3]) scale([0.35, t, 0.35]) sphere(1, $fn = 8);
    translate([0, 0, L * 0.64]) scale([w, t, L * 0.36]) sphere(1, $fn = 12);
  }
}
module wing() {
  translate(SHOULDER) rotate([0, 0, SWEEP]) {
    // The arm: grey, along the leading edge, in front of the feather bases.
    chain([for (p = ARM) W(p) + [0, -0.4, 0]], [1.1, 0.8, 0.6, 0.4], grey);
    for (i = [0 : len(FEATHERS) - 1]) {
      f = FEATHERS[i];
      a = W([f[0], f[1]]);
      b = W([f[2], f[3]]);
      // Long feathers: pale pink, the outer half near white on every other one.
      color(i % 2 == 0 ? pink : pinkPale) feather(a, b, 1.25, 0.42, 0.15);
      // Coverts: a darker pink row over the feather roots.
      color(pinkDark) feather(a, a + (b - a) * 0.5, 1.0, 0.4, -0.35);
    }
  }
}
mirror_x() wing();

// ---- Feet: little green talons tucked under the belly.
mirror_x() {
  limb([1.2, -0.2, 17.2], [1.3, -0.5, 15.2], 0.55, 0.5, leafDark);
  ell([0.8, 0.9, 0.6], [1.3, -0.6, 14.8], leaf);
  for (a = [-35, 0, 35]) spike([1.3 + sin(a) * 0.4, -1.1, 14.8], [sin(a) * 0.6, -0.5, -1.1], 0.28, 0.08, leaf);
}

// ---- Tail: willow streamers, each [sheet x, z, depth y] points with half-widths; flat leaves facing the viewer.
module streamer(pts, rs, c) {
  for (i = [0 : len(pts) - 2]) color(c) hull() {
    translate(fromSheet(pts[i][0], pts[i][1], pts[i][2])) scale([rs[i], rs[i] * 0.55, rs[i]]) sphere(1, $fn = 10);
    translate(fromSheet(pts[i + 1][0], pts[i + 1][1], pts[i + 1][2])) scale([rs[i + 1], rs[i + 1] * 0.55, rs[i + 1]]) sphere(1, $fn = 10);
  }
}
TAILS = [
  [[[4.5, 16, 6.5], [8, 16, 7.5], [11, 15, 8.5], [13.5, 13.3, 9], [14.4, 12.3, 9]], [0.8, 1.3, 1.2, 0.8, 0.25]],
  [[[4.8, 15.8, 6.5], [8.5, 14.5, 7.5], [11.5, 12.5, 8.5], [13.2, 10, 9]], [0.8, 1.3, 1.2, 0.3]],
  [[[4.8, 15.5, 6.5], [8, 13.5, 7.5], [10.8, 10.5, 8.5], [12.4, 7.6, 9]], [0.8, 1.3, 1.2, 0.3]],
  [[[4.5, 15, 6.5], [7, 12, 7], [9, 9, 8], [10.2, 6.2, 8.5]], [0.8, 1.25, 1.15, 0.3]],
  [[[4.5, 15, 6.5], [6.8, 11, 7], [8.2, 8, 7.5], [8.6, 5.2, 7.5]], [0.8, 1.2, 1.1, 0.3]],
  [[[4.3, 15, 6.5], [5.8, 11, 7], [6.6, 7.5, 7], [6.5, 4.6, 7]], [0.8, 1.2, 1.1, 0.3]],
  [[[4, 15, 6], [4.2, 11, 6], [3.3, 7.5, 5.5], [2.2, 5.2, 5]], [0.8, 1.2, 1.05, 0.3]]];
CURLS = [
  [[[4, 15.5, 6], [3, 11, 5.5], [1, 8.2, 4.5], [-1.5, 7.6, 3.5], [-3, 8.4, 3]], [0.6, 0.85, 0.7, 0.45, 0.3]],
  [[[4, 15, 6], [2.8, 10, 5], [1, 6.6, 4], [-1.5, 5.8, 3], [-3, 6, 2.5]], [0.6, 0.85, 0.7, 0.45, 0.3]]];
for (i = [0 : len(TAILS) - 1]) streamer(TAILS[i][0], TAILS[i][1], i % 2 == 0 ? leaf : leafLight);
for (s = CURLS) streamer(s[0], s[1], leafDark);
BUDS = [[-4.4, 9.4, 2.6], [-4.4, 6.1, 2.2], [0.9, 3.4, 4.6]];
streamer([[2.2, 5.2, 5], [1.4, 4, 4.8]], [0.25, 0.2], leafDark);
for (b = BUDS) translate(fromSheet(b[0], b[1], b[2])) rotate([0, 70, 0]) {
  color(pink) scale([1.3, 1.0, 1.6]) sphere(1, $fn = 10);
  color(pinkDark) translate([0, -0.45, 0.2]) scale([0.7, 0.7, 1.2]) sphere(1, $fn = 8);
}

// ---- Petals drifting about it: [sheet x, z, depth y, turn].
PETALS = [[-16, 20.2, -2, 20], [-14, 17.8, 0, -30], [-15.5, 15.9, 2, 40], [-11.5, 15.8, -1, -10], [-16, 13.3, 1, 60],
  [-13, 12.5, -2, 0], [-9, 13.6, 1, 30], [-8.9, 9.4, -1, -40], [-12.2, 7.9, 2, 10], [-8.6, 5, 0, 70], [-4.5, 3.6, -1, -20],
  [14.5, 10.2, 3, 30], [11.2, 4.9, 4, -30], [4.3, 3.2, 2, 50], [-1.5, 2.4, 0, 0]];
for (p = PETALS) translate(fromSheet(p[0], p[1], p[2])) rotate([20, p[3], 10]) color(pink) scale([0.95, 0.4, 1.35]) sphere(1, $fn = 10);
