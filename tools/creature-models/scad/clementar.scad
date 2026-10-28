// Clementar: the Fennorange line's elder. A tan fennec in a long hooded olive-plaid djellaba bound by a woven
// multicoloured sash, a maroon fez with a green star between tall orange-lined ears, a sly half-wink, and a cluster of
// three leafy oranges held up in each hand. Its big tan tail sweeps out from under the robe.
include <lib.scad>

// Brow ridge over an eye at p (size s, same yaw), overhanging its front; the inner end drops `drop` (share of s)
// towards the nose so the face itself scowls.
module brow(p, s, drop, c, yaw = 0) {
  color(c) translate(p) rotate([0, 0, yaw]) hull() {
    translate([s * 1.0, s * 0.1, s * 0.8]) scale([s * 0.55, s * 0.62, s * 0.42]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([-s * 0.8, -s * 0.12, s * (0.7 - drop)]) scale([s * 0.55, s * 0.62, s * 0.4]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    // Sealed back over the eye's top so no sclera shows above the ridge.
    translate([s * 0.1, s * 0.2, s * 0.95]) scale([s * 1.05, s * 0.75, s * 0.5]) rotate([0, 90, 0]) sphere(1, $fn = 12);
  }
}

fur = [0.84, 0.72, 0.48];
furDk = [0.7, 0.57, 0.36];
cream = [0.95, 0.87, 0.68];
earIn = [1, 0.58, 0.14, NOGLOW];
fez = [0.5, 0.08, 0.1];
fezTop = [0.42, 0.06, 0.08];
star = [0.15, 0.45, 0.2];
robe = [0.34, 0.37, 0.2];
robeDk = [0.2, 0.22, 0.12];
robeLine = [0.22, 0.24, 0.13];
sashY = [0.85, 0.65, 0.22];
sashR = [0.7, 0.2, 0.12];
sashG = [0.25, 0.45, 0.2];
orange = [0.96, 0.5, 0.1];
orangeHi = [1, 0.66, 0.25];
leafC = [0.25, 0.48, 0.18];
nose = [0.25, 0.15, 0.12];

module ear(p, d, w, inner, tip, outer) {
  color(outer) hull() {
    translate(p) scale([w, w * 0.4, w * 0.8]) sphere(1, $fn = 18);
    translate(p + d * 0.45) scale([w * 0.85, w * 0.3, w * 0.85]) sphere(1, $fn = 14);
  }
  color(tip) hull() {
    translate(p + d * 0.45) scale([w * 0.84, w * 0.29, w * 0.84]) sphere(1, $fn = 14);
    translate(p + d) sphere(0.4, $fn = 8);
  }
  color(inner) hull() {
    translate(p + [0, -w * 0.4, 0.8]) scale([w * 0.6, w * 0.2, w * 0.55]) sphere(1, $fn = 14);
    translate(p + d * 0.45 + [0, -w * 0.32, 0]) scale([w * 0.55, w * 0.15, w * 0.55]) sphere(1, $fn = 12);
    translate(p + d * 0.85 + [0, -0.9, 0]) sphere(0.3, $fn = 8);
  }
}

module fruit(p, r) {
  ell([r, r, r * 0.92], p, orange);
  ell([r * 0.4, r * 0.2, r * 0.4], p + [-r * 0.3, -r * 0.82, r * 0.3], orangeHi);
}

// A hand-held cluster of three oranges with leaves.
module cluster(p) {
  fruit(p + [-1.4, 0, 0], 1.9);
  fruit(p + [1.4, -0.3, 0], 1.9);
  fruit(p + [0, 0.4, 2.2], 1.9);
  for (a = [20, 140, 260]) petal([1.8, 0.7, 0.18], p + [cos(a) * 2.6, sin(a) * 1.6, 3.2], [0, -25, a], leafC);
  limb(p + [0, 0.4, 3.8], p + [0, 0.4, 4.6], 0.2, 0.15, leafC);
}

module fezHat(p, tilt) {
  translate(p) rotate([0, tilt, 0]) {
    color(fez) cylinder(h = 4, r1 = 3, r2 = 2.5, $fn = 24);
    color(fezTop) translate([0, 0, 4]) cylinder(h = 0.3, r = 2.5, $fn = 24);
    color(star) translate([0, -2.8, 2]) rotate([90 - 7, 0, 0]) linear_extrude(0.5, center = true)
      polygon([for (i = [0 : 9]) let(r = i % 2 == 0 ? 1.1 : 0.45, a = 90 + i * 36) [r * cos(a), r * sin(a)]]);
  }
}

// Feet peeking out from under the robe.
mirror_x() ell([1.6, 2.6, 1.1], [3, -1.6, 1.1], fur);
mirror_x() limb([3, 0, 1.4], [3, 0, 4], 1.3, 1.3, fur);

// Robe: a long flared djellaba from the shoulders to the ankles.
color(robe) hull() {
  translate([0, 0.2, 3.5]) scale([6.6, 5.4, 1]) sphere(1, $fn = 28);
  translate([0, 0, 13]) scale([5.2, 4.2, 3]) sphere(1, $fn = 28);
  translate([0, 0, 20]) scale([5.6, 4.2, 3.6]) sphere(1, $fn = 28);
}
// Plaid: vertical and horizontal lines inset on the robe surface.
function robeRx(z) = z < 13 ? 6.6 - (z - 3.5) * 0.6 / 9.5 : 6.0 - (z - 13) * 0.4 / 7;
function robeRy(z) = z < 13 ? 5.4 - (z - 3.5) * 0.6 / 9.5 : 4.8 - (z - 13) * 0.6 / 7;
for (z = [5.5, 8, 10.5, 16.5, 19]) color(robeLine) translate([0, z < 13 ? 0.2 - (z - 3.5) * 0.2 / 9.5 : 0, z]) scale([robeRx(z) + 0.2, robeRy(z) + 0.2, 0.25]) sphere(1, $fn = 28);
for (a = [0 : 30 : 330]) color(robeDk) hull() {
  translate([6.6 * sin(a), 0.2 - 5.4 * cos(a), 3.6]) sphere(0.25, $fn = 6);
  translate([5.25 * sin(a), -4.25 * cos(a), 13]) sphere(0.25, $fn = 6);
}
// Front opening seam with a gold trim line.
color(sashY) hull() {
  translate([0, -5.4, 4]) sphere(0.25, $fn = 6);
  translate([0, -4.2, 13]) sphere(0.25, $fn = 6);
}
// Hood bunched behind the neck.
ell([4.6, 3.2, 3.4], [0, 3.2, 23.4], robe);
ell([3.6, 2.4, 2.4], [0, 3.8, 21.4], robeDk);

// Woven sash at the waist, with a fringed end hanging on the viewer's left.
color(sashY) translate([0, 0, 13.6]) scale([6.5, 5.4, 1.5]) sphere(1, $fn = 28);
for (dz = [-0.65, 0.65]) color(sashR) translate([0, 0, 13.6 + dz]) scale([6.38, 5.3, 0.28]) sphere(1, $fn = 28);
for (a = [0 : 30 : 330]) color(a % 60 == 0 ? sashG : sashR) translate([6.45 * sin(a), -5.35 * cos(a), 13.6]) scale([0.55, 0.55, 0.55]) sphere(1, $fn = 8);
color(sashY) hull() {
  translate([-4.8, -2.6, 13.2]) sphere(0.8, $fn = 10);
  translate([-8, -2.5, 7]) scale([1.6, 0.35, 0.8]) sphere(1, $fn = 10);
}
color(sashR) translate([-6.6, -2.6, 9.4]) rotate([0, -30, 0]) scale([1.5, 0.4, 0.35]) sphere(1, $fn = 8);
for (i = [0 : 3]) limb([-9.2 + i * 0.7, -2.5, 6.6 + i * 0.4], [-9.6 + i * 0.7, -2.5, 4.8 + i * 0.4], 0.18, 0.15, sashR);

// Neck and head: a fox head with a cream muzzle, one eye winking.
ell([2.8, 2.6, 2], [0, -0.6, 23.4], fur);
blob([[[5.6, 4.8, 4.8], [0, -0.6, 27.8]], [[3.8, 3.6, 3.2], [0, -2, 26.4]]], fur);
mirror_x() spike([4.2, -0.8, 26], [2, 0.4, -1.4], 1.3, 0.1, fur);
blob([[[2.6, 2, 1.9], [0, -4.4, 26]], [[1.1, 1.2, 0.9], [0, -7.6, 26.4]]], cream);
ell([0.7, 0.5, 0.55], [0, -8.6, 26.8], nose);
color(nose) translate([0.6, -6.4, 25.3]) rotate([90, 0, 12]) scale([1.4, 0.3, 1]) cylinder(h = 0.4, r = 1, center = true, $fn = 12);
// Viewer's right eye open, left eye a closed wink.
eye([2.4, -4.0, 28.8], 1.6, iris = [0.85, 0.5, 0.12], pupil = [0.2, 0.08, 0.04], yaw = 8, flat = 0.42, lid = 0.5, lid_tilt = 14, lid_c = furDk, slit = 0.5);
brow([2.4, -4.0, 28.8], 1.6, 0.3, fur, 8);
color(nose) translate([-2.4, -4.75, 28.6]) rotate([0, -8, 10]) scale([1.6, 0.5, 0.36]) sphere(1, $fn = 10);
mirror([1, 0, 0]) brow([2.4, -4.2, 28.4], 1.6, 0.1, fur);

// Tall ears and the fez.
mirror_x() ear([3.2, 0.4, 30.4], [5, 2.5, 11.5], 3, earIn, fur, fur);
fezHat([0.2, 0, 31.3], 4);

// Sleeved arms raised to shoulder height, fur hands holding the orange clusters.
mirror_x() {
  limb([4.8, 0, 21.4], [8.6, -1.4, 18.4], 1.9, 1.7, robe);
  limb([8.6, -1.4, 18.4], [10.6, -2.4, 21], 1.7, 1.6, robe);
  ell([1.6, 1.5, 1.2], [11, -2.6, 22.2], fur);
  cluster([11.2, -2.6, 24.6]);
}

// Big tan tail curving out behind on the viewer's right.
blob([[[1.4, 1.4, 1.4], [1.5, 4.5, 9]], [[3.6, 3.2, 3.4], [7, 7, 6.5]], [[4.6, 3.6, 4.6], [11.5, 6.5, 9.5]]], fur);
blob([[[4.4, 3.4, 4], [12.2, 6.5, 11.6]], [[1.8, 1.6, 2], [13.4, 6, 17.4]]], [0.9, 0.79, 0.56]);
