// Mossling: a sleepy little tortoise under a high mossy shell of green scutes, seedlings sprouting from the moss.
include <lib.scad>

skin = [0.47, 0.62, 0.32];
skinDark = [0.3, 0.42, 0.2];
spot = [0.27, 0.35, 0.18];
shell = [0.2, 0.42, 0.16];
scute = [0.33, 0.58, 0.22];
moss = [0.5, 0.72, 0.28];
rim = [0.45, 0.32, 0.2];
leaf = [0.42, 0.7, 0.24];
mud = [0.42, 0.3, 0.2];
lid = [0.48, 0.6, 0.33];

// Domed shell sitting on a brown under-rim.
SH = [14, 16, 14.5];
SZ = 4.5;
color(rim) translate([0, 0, SZ - 0.6]) scale([SH[0] + 0.6, SH[1] + 0.6, 2.2]) sphere(1, $fn = 32);
color(shell) translate([0, 0, SZ]) scale(SH) difference() {
  sphere(1, $fn = 36);
  translate([0, 0, -1.2]) cube(2.4, center = true);
}
// Scutes: raised lighter plates on the dome, [azimuth, elevation, size].
function dome(az, el, k = 1) = [SH[0] * k * cos(el) * cos(az), SH[1] * k * cos(el) * sin(az), SZ + SH[2] * k * sin(el)];
for (s = [[0, 90, 4.6], [0, 50, 3.8], [72, 50, 3.8], [144, 50, 3.8], [216, 50, 3.8], [288, 50, 3.8],
          [36, 18, 3.6], [108, 18, 3.6], [180, 18, 3.6], [252, 18, 3.6], [324, 18, 3.6], [0, 20, 3.4]]) {
  az = s[0]; el = s[1]; r = s[2];
  color(scute) translate(dome(az, el, 0.97)) rotate([0, 90 - el, az]) scale([1, 1.05, 0.32]) sphere(r, $fn = 6);
}
// Moss cap on top.
color(moss) translate([0, 0, SZ + SH[2] - 1.6]) scale([8, 9, 2.4]) sphere(1, $fn = 24);
for (p = [[5, -6, 0], [-6, 4, 0], [3, 7, 0], [-4, -7, 0]]) color(moss) translate(dome(atan2(p[1], p[0]), 60, 0.98)) scale([2.6, 2.6, 1]) sphere(1, $fn = 12);

// Seedlings: a stem with two round leaves.
module sprout(p, yaw, h = 3.2) {
  limb(p, p + [0, 0, h], 0.35, 0.25, leaf);
  for (k = [-1, 1]) color(leaf) translate(p + [k * 1.5 * cos(yaw), k * 1.5 * sin(yaw), h + 0.4]) rotate([0, -k * 25, yaw])
    scale([2, 0.95, 0.35]) sphere(1, $fn = 10);
}
for (s = [[0, 90, 0], [30, 55, 30], [110, 55, 100], [190, 55, 10], [260, 50, 70], [330, 45, 120], [150, 30, 50], [60, 30, 0], [235, 28, 80]])
  sprout(dome(s[0], s[1], 0.98), s[2]);

// Head poking out under the front rim, with sleepy half-lidded eyes and leaf ears.
blob([[[7, 6, 5.6], [0, -17, 8.5]], [[5.4, 4.2, 4], [0, -20.5, 7.6]]], skin);
limb([0, -12, 7], [0, -16, 8], 4.6, 5, skin);
for (p = [[3, -18, 13], [-2.5, -17, 13.6], [5.5, -19, 9]]) ell([1.1, 1.1, 0.6], p, spot);
mirror_x() {
  translate([3.2, -22.2, 9.4]) {
    eye([0, 0, 0], 1.7, iris = [0.45, 0.32, 0.2], pupil = [0.15, 0.1, 0.08], sclera = [0.95, 0.9, 0.8], yaw = 25, flat = 0.6, shine = false);
    // Heavy upper lid covering the top half of the eye.
    color(lid) rotate([0, 0, 25]) translate([0, -0.15, 0.3]) scale([1.4, 0.95, 0.85]) difference() {
      sphere(1.7, $fn = 18);
      translate([0, 0, -1.7]) cube(3.4, center = true);
    }
  }
  // Leaves sprouting from the sides of the head.
  petal([3.4, 0.7, 2], [7.6, -17, 9.5], [0, -15, -25], leaf);
  petal([2.6, 0.6, 1.5], [6.6, -15, 12], [0, -40, 10], leaf);
}
// Flat little mouth and nostrils.
color(skinDark) translate([0, -24.4, 6.2]) rotate([90, 0, 0]) scale([2.2, 0.35, 0.4]) cylinder(h = 0.5, r = 1, center = true, $fn = 16);
mirror_x() ell([0.35, 0.3, 0.35], [0.9, -24.6, 7.8], skinDark);

// Stubby legs with mud-caked feet.
module leg(p, out) {
  limb(p + [-out * 2, 0, 5], p + [0, 0, 1.6], 3, 2.8, skin);
  color(mud) translate(p + [0, 0, 0.9]) scale([3.1, 3.3, 1.2]) sphere(1, $fn = 20);
  for (q = [[0.8, -2.6, 3.5], [-0.4, -2.4, 2.4]]) ell([0.8, 0.5, 0.6], p + q, mud);
}
mirror_x() {
  leg([12, -9, 0], 1);
  leg([12, 9, 0], 1);
}
// Little pointed tail.
spike([0, 16, 5.5], [0, 4, -1.5], 1.6, 0.2, skin);
// Clods of earth.
for (p = [[-14, -14, 0.5], [13, -15, 0.5], [-15, 12, 0.5]]) ell([0.8, 0.8, 0.5], p, mud);
