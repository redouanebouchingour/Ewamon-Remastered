// Verdatide: Mossling grown into a great sea turtle, a meadow of grass, flowers and stones on its shell, a mossy beard,
// barnacled flippers.
include <lib.scad>

skin = [0.36, 0.55, 0.3];
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
SH = [15, 17, 14.5];
SZ = 5;
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

// Grass tufts, flowers and stones in the meadow on the shell.
module tuft(p, yaw) {
  for (i = [0 : 4]) let(a = yaw + i * 72) spike(p, [cos(a) * 1.2, sin(a) * 1.2, 3.4 + (i % 2) * 1.2], 0.55, 0.05, leaf);
}
module flower(p, c) {
  limb(p, p + [0, 0, 3], 0.2, 0.2, leaf);
  for (a = [0 : 72 : 359]) color(c) translate(p + [0.8 * cos(a), 0.8 * sin(a), 3.1]) scale([0.75, 0.75, 0.3]) sphere(1, $fn = 8);
  color([1, 0.9, 0.4]) translate(p + [0, 0, 3.3]) sphere(0.4, $fn = 8);
}
for (s = [[0, 88, 0], [40, 60, 20], [120, 62, 40], [200, 60, 10], [290, 58, 50], [80, 38, 0], [160, 36, 30], [250, 36, 60], [330, 36, 10], [20, 22, 0], [110, 20, 0], [200, 22, 0], [290, 20, 0]])
  tuft(dome(s[0], s[1], 0.97), s[2]);
fl = [[1, 0.8, 0.25], [0.75, 0.55, 0.95], [0.45, 0.6, 1], [0.95, 0.6, 0.85]];
for (i = [0 : 11]) let(az = i * 30 + 10, el = 30 + (i % 3) * 18) flower(dome(az, el, 0.98), fl[i % 4]);
for (s = [[60, 70], [230, 45], [140, 30], [310, 62]]) color([0.55, 0.57, 0.55]) translate(dome(s[0], s[1], 0.98)) scale([1.6, 1.3, 0.9]) sphere(1, $fn = 10);

// Seedlings: a stem with two round leaves.
module sprout(p, yaw, h = 3.2) {
  limb(p, p + [0, 0, h], 0.35, 0.25, leaf);
  for (k = [-1, 1]) color(leaf) translate(p + [k * 1.5 * cos(yaw), k * 1.5 * sin(yaw), h + 0.4]) rotate([0, -k * 25, yaw])
    scale([2, 0.95, 0.35]) sphere(1, $fn = 10);
}
for (s = [[70, 45, 30], [250, 50, 100]]) sprout(dome(s[0], s[1], 0.98), s[2]);

// Head low under the front rim: a broad beaked face, calm eyes, a long beard of moss.
blob([[[6, 5.6, 4.8], [0, -18, 8]], [[4.6, 3.6, 3.4], [0, -21.5, 7]]], skin);
limb([0, -12, 7], [0, -16, 8], 4.4, 4.8, skin);
for (p = [[3, -18, 12], [-2.5, -17, 12.4]]) ell([1.1, 1.1, 0.6], p, spot);
mirror_x() {
  translate([3, -22.6, 9]) {
    eye([0, 0, 0], 1.4, iris = [0.1, 0.12, 0.08], pupil = [0.05, 0.05, 0.05], sclera = [0.85, 0.88, 0.75], yaw = 25, flat = 0.6);
    color(lid) rotate([0, 0, 25]) translate([0, -0.15, 0.45]) scale([1.4, 0.95, 0.6]) difference() {
      sphere(1.4, $fn = 18);
      translate([0, 0, -1.4]) cube(2.8, center = true);
    }
  }
}
color(skinDark) translate([0, -25, 6]) rotate([90, 0, 0]) scale([2.4, 0.35, 0.4]) cylinder(h = 0.5, r = 1, center = true, $fn = 16);
mirror_x() ell([0.35, 0.3, 0.35], [0.9, -25.2, 7.8], skinDark);
// Beard: strands of moss hanging from the chin to the ground.
for (i = [0 : 8]) let(x = -3.2 + i * 0.8, l = 4.5 + (i % 3) * 1.4)
  chain([[x, -22 + abs(x) * 0.4, 5.2], [x * 1.1, -23.5, 5.2 - l * 0.5], [x * 1.15, -23.2, 5 - l]], [0.55, 0.45, 0.2], i % 2 == 0 ? moss : [0.4, 0.58, 0.22]);

// Flippers: long flat paddles sweeping out from under the shell, barnacles on the front pair.
barnacle = [0.78, 0.76, 0.72];
module flipper(root, tip, w) {
  color(skin) hull() {
    translate(root) scale([w * 0.6, w * 0.6, 1.4]) sphere(1, $fn = 16);
    translate((root + tip) / 2 + [0, 0, -0.3]) scale([w, w, 0.8]) sphere(1, $fn = 16);
    translate(tip) sphere(0.6, $fn = 10);
  }
}
mirror_x() {
  flipper([10, -8, 4], [21, -19, 0.8], 5);
  for (t = [[0.35, 0.8], [0.45, -1.2], [0.55, 0.6], [0.65, -0.6], [0.5, 2], [0.3, -1.6]]) let(k = t[0], q = [10 + 11 * k + t[1], -8 - 11 * k + t[1], 4 - 3.2 * k + 0.4]) {
    color(barnacle) translate(q) cylinder(h = 1.1, r1 = 0.95, r2 = 0.6, $fn = 10);
    color([0.45, 0.43, 0.4]) translate(q + [0, 0, 1.05]) sphere(0.42, $fn = 8);
  }
  flipper([10, 9, 3.5], [17, 18, 0.8], 3.8);
}
// Little pointed tail.
spike([0, 16, 5.5], [0, 4, -1.5], 1.6, 0.2, skin);
