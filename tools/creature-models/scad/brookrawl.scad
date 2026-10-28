// Brookrawl: a crouching stone turtle boxer in a black top hat, big red gloves up, a plated shell on its back and a
// bronze power-sigil on its shoulder.
include <lib.scad>

stone = [0.42, 0.47, 0.53];
stoneHi = [0.58, 0.62, 0.66];
stoneDark = [0.27, 0.3, 0.36];
sand = [0.62, 0.56, 0.45];
glove = [0.8, 0.12, 0.12];
gloveHi = [0.95, 0.3, 0.25];
cuff = [0.55, 0.06, 0.08];
hat = [0.15, 0.16, 0.22];
band = [0.75, 0.1, 0.1];
bronze = [0.7, 0.5, 0.3];
eyeRed = [0.95, 0.2, 0.15];

// Torso: a broad, rounded stone barrel.
blob([[[10, 8.5, 9], [0, 0, 17]], [[8.5, 7.5, 6], [0, -0.5, 24]]], stone);
// Chest plates in front: lighter slabs.
module slab(az, el, r, c) {
  q = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];
  p = [10 * q[0], -0.2 + 8.3 * q[1], 19 + 9 * q[2]];
  n = [q[0] / 10, q[1] / 8.3, q[2] / 9];
  color(c) translate(p) rotate(_dir_rot(n)) translate([0, 0, -0.5]) cylinder(h = 0.9, r1 = r, r2 = r * 0.85, $fn = 6);
}
for (s = [[-25, 40, 2.6, sand], [10, 42, 2.4, stoneHi], [-35, 10, 2.8, stoneHi], [0, 15, 3, sand], [35, 12, 2.6, stoneHi],
          [-15, -18, 2.8, stoneHi], [20, -15, 2.6, sand], [-55, 30, 2.4, sand], [55, -10, 2.4, stoneHi]])
  slab(s[0], s[1], s[2], s[3]);

// Shell on the back: a dome studded with hexagonal plates.
color(stoneDark) translate([0, 3.5, 18]) scale([10.5, 7, 11]) sphere(1, $fn = 28);
for (az = [-75 : 30 : 75]) for (el = [-50 : 25 : 60]) {
  q = [cos(el) * sin(az + (el % 50 == 0 ? 0 : 15)), cos(el) * cos(az + (el % 50 == 0 ? 0 : 15)), sin(el)];
  p = [10.5 * q[0], 3.5 + 7 * q[1], 18 + 11 * q[2]];
  n = [q[0] / 10.5, q[1] / 7, q[2] / 11];
  color(stone) translate(p) rotate(_dir_rot(n)) translate([0, 0, -0.6]) cylinder(h = 1.2, r1 = 2.9, r2 = 2.5, $fn = 6);
}

// Small head sunk between the shoulders, with glowing red eyes.
blob([[[4.6, 4.2, 3.6], [0, -4, 30]], [[3.4, 3, 2.6], [0, -6.8, 29]]], stone);
mirror_x() {
  color(eyeRed) translate([1.8, -9.2, 30]) rotate([0, 0, -15]) scale([1.1, 0.4, 0.55]) sphere(1, $fn = 14);
  color(stoneDark) translate([1.9, -9.2, 31]) rotate([0, -15, -15]) scale([1.5, 0.6, 0.4]) sphere(1, $fn = 12);
}
color(stoneDark) translate([0, -9.5, 28.2]) scale([1.6, 0.3, 0.25]) sphere(1, $fn = 12);

// Top hat, tipped slightly back.
translate([0, -3.5, 33]) rotate([-8, 0, 0]) {
  color(hat) cylinder(h = 0.8, r = 6, $fn = 32);
  color(hat) cylinder(h = 7, r1 = 3.8, r2 = 4.1, $fn = 28);
  color(band) translate([0, 0, 0.6]) cylinder(h = 1.5, r = 3.95, $fn = 28);
}

// Bronze power sigil on the viewer's right shoulder.
translate([4.4, -8.6, 25.5]) rotate([0, 0, 18]) scale(1.3) rotate([90, 0, 0]) {
  color(bronze) cylinder(h = 1, r = 2.6, center = true, $fn = 20);
  color(stoneDark) translate([0, 0, -0.4]) cylinder(h = 0.6, r = 1.8, center = true, $fn = 20);
  color(bronze) translate([0, 0, -0.6]) difference() {
    cylinder(h = 0.6, r = 1.4, center = true, $fn = 20);
    cylinder(h = 1, r = 0.9, center = true, $fn = 20);
    translate([0, 1, 0]) cube([0.9, 1.6, 2], center = true);
  }
  color(bronze) translate([0, 0.7, -0.6]) cube([0.4, 1.4, 0.6], center = true);
}

// Arms: thick stone arms ending in big red boxing gloves, held up in guard.
module gloveAt(p, rot) {
  translate(p) rotate(rot) {
    color(glove) scale([5.4, 5.8, 5.8]) sphere(1, $fn = 24);
    color(gloveHi) translate([-1, -2.2, 1.8]) scale([3.4, 3.4, 3.2]) sphere(1, $fn = 18);
    color(glove) translate([4, -1.8, -0.8]) scale([2, 2.4, 2.6]) sphere(1, $fn = 14);
    color(cuff) translate([0, 4.8, 0]) rotate([90, 0, 0]) cylinder(h = 3, r = 3.8, center = true, $fn = 20);
  }
}
// Viewer's left: raised high and out.
limb([-8.5, -1, 24], [-12.5, -2, 20], 3, 2.6, stone);
limb([-12.5, -2, 20], [-12, -6, 26], 2.6, 2.4, stone);
gloveAt([-13.5, -9, 28], [10, 0, 10]);
// Viewer's right: guarding the belly.
limb([8.5, -1, 22], [10, -4, 16], 3, 2.6, stone);
limb([10, -4, 16], [5, -8, 15], 2.6, 2.4, stone);
gloveAt([3, -12.5, 15.5], [0, 0, -20]);

// Legs: wide crouching stance, thick plated thighs, three-toed feet.
mirror_x() {
  limb([6, 0, 11], [10, -2, 6], 3.6, 3, stone);
  limb([10, -2, 6], [9.5, -2, 1.6], 3, 2.6, stone);
  ell([3.2, 3.2, 2.6], [9.5, -2, 6], stoneHi);
  blob([[[3, 4, 1.4], [9.5, -4, 1.4]], [[2.6, 2, 1.3], [9.5, -1, 1.4]]], stoneDark);
  for (a = [-30, 0, 30]) spike([9.5 + sin(a) * 1.8, -7.5, 1], [sin(a) * 0.6, -1.4, -0.4], 0.6, 0.1, sand);
}
// Stubby tail out the back.
limb([0, 9, 9], [0, 13, 5], 2.2, 1, stoneDark);
