// Ravenmourne: a tall cloaked raven in ragged black-and-violet feathers, wearing a bone plague-mask skull with a long
// curved beak and glowing violet eyes; a gold chain of skull charms and a violet crystal hangs on its chest.
include <lib.scad>

black = [0.12, 0.11, 0.15];
dark = [0.24, 0.17, 0.32];
purple = [0.33, 0.2, 0.45];
purpleDk = [0.24, 0.15, 0.33];
bone = [0.88, 0.84, 0.72];
boneDk = [0.7, 0.65, 0.53];
leg = [0.17, 0.17, 0.19];
gold = [0.93, 0.7, 0.2];
crystal = [0.55, 0.25, 0.8];
glow = [0.9, 0.6, 1];

// Feather cloak: a tall bell, narrow at the neck and flaring to ragged points at the hem.
blob([[[7, 6.5, 6], [0, 0.5, 26]], [[10, 8.5, 6], [0, 1, 15]], [[11, 9, 3], [0, 1.5, 9]]], black);
// Ragged hem: long feather tongues hanging around the bottom, alternating black and violet.
for (i = [0 : 15]) {
  a = i * 360 / 16;
  c = (i % 2 == 0) ? purple : dark;
  color(c) hull() {
    translate([9.3 * sin(a), 1.5 - 7.8 * cos(a), 13]) rotate([0, 0, -a]) scale([2.6, 0.8, 2.2]) sphere(1, $fn = 12);
    translate([11.5 * sin(a), 1.5 - 9.8 * cos(a), 5.5 + (i % 3) * 0.8]) sphere(0.35, $fn = 8);
  }
}
// Layered feather tiers on the cloak: a mid row of shorter points.
for (i = [0 : 13]) {
  a = i * 360 / 14 + 12;
  c = (i % 3 == 0) ? purple : black;
  color(c) hull() {
    translate([7.6 * sin(a), 0.8 - 6.8 * cos(a), 22]) rotate([0, 0, -a]) scale([2.4, 0.8, 1.8]) sphere(1, $fn = 12);
    translate([10 * sin(a), 0.8 - 8.6 * cos(a), 14.5]) sphere(0.3, $fn = 8);
  }
}
// Wing panels hanging at the sides, violet edged.
mirror_x() {
  petal([2.2, 4.5, 12], [10.5, 1.5, 15], [0, -14, 0], black);
  for (i = [0 : 3]) petal([1.1, 2.4, 6], [11.5 + i * 0.6, -1.5 + i * 1.6, 8.5 - i * 0.3], [0, -22 - i * 4, 0], i % 2 == 0 ? purple : purpleDk);
}

// Hood: a spiky feather crown around the mask.
ell([6.8, 6.4, 6.6], [0, 0.5, 33], dark);
for (s = [[0, 3, 39, 0, 3, 7], [2.5, 2, 38, 3, 4, 5], [-2.5, 2, 38, -3, 4, 5], [4.5, 1, 36, 4, 2, 3], [-4.5, 1, 36, -4, 2, 3],
          [0, 5.5, 36, 0, 6, 3], [3, 5, 35, 2.5, 5, 2], [-3, 5, 35, -2.5, 5, 2]])
  spike([s[0], s[1], s[2]], [s[3], s[4], s[5]], 2, 0.15, dark);
// Ruff of short feathers at the neck.
for (a = [0 : 30 : 359])
  color(purpleDk) hull() {
    translate([5.6 * sin(a), 0.5 - 5.2 * cos(a), 29]) sphere(1.3, $fn = 10);
    translate([7 * sin(a), 0.5 - 6.6 * cos(a), 25]) sphere(0.3, $fn = 8);
  }

// Bone mask: a skull cap over the face, with a long down-curved beak.
blob([[[5, 3.5, 4.8], [0, -4.5, 33]], [[3.8, 3, 3], [0, -6, 31]]], bone);
color(bone) hull() {
  translate([0, -7, 31.5]) scale([2.6, 2, 2.2]) sphere(1, $fn = 18);
  translate([0, -12, 29.5]) scale([1.2, 1.2, 1.1]) sphere(1, $fn = 14);
}
color(bone) hull() {
  translate([0, -12, 29.5]) scale([1.2, 1.2, 1.1]) sphere(1, $fn = 14);
  translate([0, -15, 26]) sphere(0.3, $fn = 10);
}
// Beak seam and nostril.
color(boneDk) translate([0, -10, 29.6]) rotate([0, 90, 0]) scale([0.3, 3, 0.25]) cylinder(h = 4, r = 1, center = true, $fn = 12);
mirror_x() ell([0.3, 0.4, 0.3], [1, -9.5, 31.8], boneDk);
// Eye sockets: dark hollows with glowing violet gems.
mirror_x() {
  ell([1.8, 0.8, 1.6], [2.4, -7.6, 33.6], [0.1, 0.05, 0.12]);
  ell([1.2, 0.6, 1.1], [2.4, -8.1, 33.6], crystal);
  ell([0.5, 0.3, 0.5], [2.1, -8.6, 34], glow);
}

// Gold necklace: a sagging chain of beads across the chest, with charms.
for (t = [-1 : 0.1 : 1.01]) {
  x = 7 * t;
  y = -6.8 + 1.8 * t * t;
  z = 23 - 3.5 * (1 - t * t);
  color(gold) translate([x, y, z]) sphere(0.5, $fn = 10);
}
// Centre crystal pendant.
color(crystal) hull() {
  translate([0, -7.4, 19]) scale([1.2, 0.7, 1.2]) sphere(1, $fn = 14);
  translate([0, -7.2, 15]) sphere(0.15, $fn = 8);
}
color(gold) translate([0, -7.2, 20]) sphere(0.7, $fn = 12);
// Little gold skull charms and a gold ring.
mirror_x() {
  color(gold) translate([4, -7.3, 18.6]) scale([1, 0.7, 1]) sphere(1.1, $fn = 14);
  mirror_x() ell([0.25, 0.2, 0.3], [0.4, -8.1, 18.8], [0.35, 0.22, 0.05]);
}
color(gold) translate([-4, -7.4, 18.6]) rotate([90, 0, 0]) rotate_extrude($fn = 20) translate([1, 0]) circle(0.35, $fn = 8);
color(crystal) translate([2, -7.4, 19]) scale([0.6, 0.4, 1.2]) sphere(1, $fn = 10);

// Back: the same chain shows over the shoulders.
for (t = [-1 : 0.15 : 1.01]) color(gold) translate([6 * t, 6.4 - 1.2 * t * t, 25 - 2.5 * (1 - t * t)]) sphere(0.45, $fn = 10);
color(crystal) hull() {
  translate([0, 7, 22.4]) scale([0.9, 0.6, 0.9]) sphere(1, $fn = 12);
  translate([0, 7, 19.5]) sphere(0.15, $fn = 8);
}

// Legs: dark scaly shanks under the cloak, splayed three-toed feet.
mirror_x() {
  limb([3.5, 1, 8], [3.8, 0, 1], 1.1, 0.9, leg);
  for (a = [-35, 0, 35]) {
    limb([3.8, 0, 0.8], [3.8 + sin(a) * 3.4, -cos(a) * 3.4, 0.6], 0.7, 0.5, leg);
    spike([3.8 + sin(a) * 3.6, -cos(a) * 3.6, 0.6], [sin(a) * 0.8, -cos(a) * 0.8, -0.4], 0.45, 0.05, [0.3, 0.3, 0.32]);
  }
  limb([3.8, 0, 0.8], [3.8, 2.8, 0.6], 0.6, 0.5, leg);
}
