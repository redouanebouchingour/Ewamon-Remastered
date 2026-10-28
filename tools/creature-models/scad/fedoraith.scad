// Fedoraith: Nerohat grown into a scarecrow wraith: a grey stone face with a gold zig-zag grin and red eyes under
// a blue cowboy hat, a ragged navy shroud of streaming tatters spreading wide and hanging to the ground, thin arms
// with spidery grey hands.
include <lib.scad>

face = [0.32, 0.31, 0.34];
faceHi = [0.42, 0.41, 0.44];
gold = [0.85, 0.7, 0.18];
shroud = [0.2, 0.2, 0.36];
shroudHi = [0.33, 0.33, 0.52];
shroudDk = [0.12, 0.12, 0.24];
hat = [0.18, 0.28, 0.58];
hatHi = [0.28, 0.4, 0.72];
hatDk = [0.08, 0.12, 0.28];
hand = [0.24, 0.24, 0.32];
eyeRed = [0.92, 0.18, 0.08];

// A tattered strand: a flat tapering ribbon through points.
module strand(pts, w, c) {
  for (i = [0 : len(pts) - 2]) color(c) hull() {
    translate(pts[i]) scale([1, 0.45, 1]) sphere(w * (1 - i / len(pts)), $fn = 10);
    translate(pts[i + 1]) scale([1, 0.45, 1]) sphere(max(0.15, w * (1 - (i + 1) / len(pts))), $fn = 10);
  }
}

// Shroud body: a long sagging cloak under the head.
blob([[[8, 6, 4], [0, 1, 20]], [[6.5, 5, 4], [0, 1, 12]], [[4, 3.5, 2], [0, 1, 4.5]]], shroud);
// Tatters hanging down all round to the ground.
for (a = [0 : 24 : 359]) {
  r = 5.5;
  strand([[r * sin(a), 1 - r * 0.8 * cos(a), 12], [(r + 1.5) * sin(a), 1 - (r + 1) * 0.8 * cos(a), 6], [(r + 1.8) * sin(a) + 0.8, 1 - (r + 1.4) * 0.8 * cos(a), 0.4]],
    1.8, (a / 24) % 3 == 0 ? shroudHi : (a / 24) % 3 == 1 ? shroud : shroudDk);
}
// Wide ragged shoulders: strands streaming out sideways and up.
mirror_x() {
  for (i = [0 : 4]) {
    z = 25 - i * 2.4;
    strand([[4, 1.5, z], [9 + i * 0.5, 2, z + 1.5 - i * 0.6], [14 + i * 0.4, 2.5 + i * 0.3, z + 3.5 - i * 1.6], [18 - i * 0.3, 3, z + 5.5 - i * 2.5]],
      2, i % 2 == 0 ? shroud : shroudHi);
  }
}

// Head: a big grey round face.
ell([7, 6, 6.4], [0, -1.5, 23], face);
// Angry red eyes with gold rims.
mirror_x() translate([2.8, -7.1, 24.4]) rotate([0, 20, -15]) {
  color(gold) scale([1.7, 0.6, 1.1]) sphere(1, $fn = 18);
  color(eyeRed) translate([0, -0.4, 0]) scale([1.2, 0.4, 0.8]) sphere(1, $fn = 16);
  color([0.15, 0, 0]) translate([0.1, -0.7, 0]) scale([0.3, 0.2, 0.5]) sphere(1, $fn = 10);
}
// Zig-zag grin: a dark jack-o'-lantern mouth outlined in gold, both cut from shells of the face ellipsoid.
function grinTop(x, i) = 21.6 - 0.05 * x * x + (i % 2 == 0 ? 0.7 : -0.5);
function grinBot(x) = 20.6 - 2.2 * cos(x / 5.2 * 90);
grinPts = [for (i = [0 : 10]) let(x = -5.2 + i * 1.04) [x, grinTop(x, i)]];
botPts = [for (i = [10 : -1 : 0]) let(x = -5.2 + i * 1.04) [x, grinBot(x)]];
module grinShape(pts) rotate([90, 0, 0]) linear_extrude(12) polygon(pts);
module faceShell(k) translate([0, -1.5, 23]) scale([7, 6, 6.4] * k) sphere(1, $fn = 40);
color(gold) intersection() {
  faceShell(1.02);
  grinShape(concat([for (p = grinPts) p + [0, 0.9]], [for (p = botPts) p + [0, -0.9]]));
}
color(shroudDk) intersection() {
  faceShell(1.03);
  grinShape(concat(grinPts, botPts));
}

// Cowboy hat, tipped forward, a dent in the crown and a dark band.
translate([0, -0.5, 28.6]) rotate([-10, 0, 0]) {
  color(hat) scale([9.5, 7.5, 1]) cylinder(h = 0.8, r = 1, $fn = 36);
  mirror_x() color(hat) translate([7.8, 0, 0.7]) rotate([0, -35, 0]) scale([2.4, 6, 0.7]) sphere(1, $fn = 18);
  color(hatHi) hull() {
    translate([0, 0, 0.6]) scale([4.6, 4, 1]) sphere(1, $fn = 24);
    translate([0, 0, 4.4]) scale([3.6, 2.8, 1]) sphere(1, $fn = 20);
  }
  color(hatDk) translate([0, -0.4, 5.2]) scale([0.7, 2.2, 0.5]) sphere(1, $fn = 12);
  color(hatDk) translate([0, 0, 1]) scale([4.65, 4.05, 1]) cylinder(h = 1, r = 1, $fn = 24);
}

// Thin arms out of the shroud, spidery hands with long fingers.
mirror_x() {
  chain([[6, -1, 17], [10, -2, 14], [13.5, -2.5, 15.5], [16, -3, 14]], [0.6, 0.55, 0.5, 0.5], hand);
  ell([1.6, 1.3, 1.4], [17, -3.4, 14], hand);
  for (f = [[-60, 4.5], [-25, 5.5], [10, 5.5], [45, 4.5]]) {
    a = f[0]; l = f[1];
    chain([[17, -3.4, 14], [17 + sin(a) * l * 0.5, -3.4 - l * 0.25, 14 + cos(a) * l * 0.55], [17 + sin(a) * l * 0.9, -3.4 - l * 0.5, 14 + cos(a) * l * 0.65], [17 + sin(a) * l, -3.4 - l * 0.6, 14 + cos(a) * l * 0.35]], [0.5, 0.4, 0.3, 0.15], hand);
  }
}
