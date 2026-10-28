// Caldermole: Coalette grown into an upright magma kaiju. Charcoal plated hide split by glowing lava cracks, a molten
// heart blazing through its chest, a mane of flames down its back and on its brow, heavy clawed arms, pillar legs and
// a long segmented tail curling up into a tall flame.
include <lib.scad>

coal = [0.22, 0.19, 0.23];
coalHi = [0.33, 0.29, 0.34];
crack = [1, 0.62, 0.1];
crackRed = [0.95, 0.32, 0.05];
coreHi = [1, 0.88, 0.45];
flameRed = [0.9, 0.22, 0.05];
flameOrange = [1, 0.55, 0.08];
flameCore = [1, 0.88, 0.35];
claw = [0.88, 0.78, 0.6];

module flame(p, d, r) {
  side = [d[1], -d[0], 0] / max(norm([d[0], d[1]]), 0.001);
  sd = norm([d[0], d[1]]) < 0.3 ? [1, 0, 0] : side;
  color(flameCore) translate(p + d * 0.08) sphere(r * 1.02, $fn = 12);
  color(flameOrange) hull() { translate(p + d * 0.15) sphere(r * 0.9, $fn = 10); translate(p + d * 0.8) sphere(0.15, $fn = 6); }
  color(flameRed) hull() { translate(p + d * 0.45) sphere(r * 0.55, $fn = 8); translate(p + d) sphere(0.12, $fn = 6); }
  for (s = [-1, 1]) color(s > 0 ? flameRed : flameOrange) hull() {
    translate(p + d * 0.2 + sd * s * r * 0.5) sphere(r * 0.55, $fn = 8);
    translate(p + d * 0.6 + sd * s * r * 1.3) sphere(0.1, $fn = 6);
  }
}
// A glowing lava crack along a polyline.
module crackline(pts, r = 0.32) {
  for (i = [0 : len(pts) - 2]) color(crack) hull() { translate(pts[i]) sphere(r, $fn = 6); translate(pts[i + 1]) sphere(r, $fn = 6); }
}

// Torso: a tall pear, broad belly, leaning slightly forward.
blob([[[8.5, 7.5, 8], [0, 1, 13]], [[7, 6.2, 6.5], [0, -0.5, 21]]], coal);
// Molten heart: a branching glow on the chest.
color(crackRed) translate([0, -6.4, 19.5]) rotate([10, 0, 0]) scale([2.6, 1.4, 4.6]) sphere(1, $fn = 16);
color(crack) translate([0, -7.1, 19.5]) rotate([10, 0, 0]) scale([1.7, 1, 3.4]) sphere(1, $fn = 14);
color(coreHi) translate([0, -7.7, 19.6]) scale([0.9, 0.6, 1.8]) sphere(1, $fn = 12);
mirror_x() for (b = [[[1, -7.6, 22], [2.6, -7.4, 23.4], [3, -7.2, 25]], [[1.2, -7.6, 18], [2.6, -7.5, 17], [3.4, -7.3, 18.6]],
                     [[1, -7.6, 16.5], [1.8, -7.4, 14.6], [3.2, -7.2, 14]]]) crackline(b, 0.42);
mirror_x() {
  crackline([[1.5, -7.6, 21.5], [3.4, -7, 24], [5.2, -5.8, 25]]);
  crackline([[2, -7.6, 17], [4.5, -7, 15.5], [6.5, -5.4, 13]]);
  crackline([[2.6, -7.6, 19], [5.5, -6.6, 19.5], [7.2, -4.4, 20.5]]);
  // Belly plates: horizontal seams.
  crackline([[0.5, -7.6, 12], [4, -6.6, 11.4], [7, -4, 10.8]], 0.25);
  crackline([[0.5, -7.1, 8.5], [4, -6.2, 8.2], [6.6, -3.6, 7.8]], 0.25);
  // Back cracks.
  crackline([[2, 7.4, 20], [4.5, 6.6, 16], [5, 7, 12], [3, 8, 8.5]]);
  crackline([[6.5, 2, 23], [8, 3, 18]], 0.28);
}

// Neck and head: a blunt kaiju head held forward, orange eyes under a heavy brow, a flame crest.
limb([0, -1, 24], [0, -3, 27.5], 4.6, 4, coal);
blob([[[4.6, 4.8, 3.8], [0, -4, 29.5]], [[3.6, 4, 2.8], [0, -8, 28.4]]], coal);
color(coalHi) translate([0, -7, 31]) rotate([-8, 0, 0]) scale([4.4, 3.4, 1.2]) sphere(1, $fn = 16);
color([0.1, 0.07, 0.08]) translate([0, -10.4, 27.4]) rotate([90, 0, 0]) scale([2.8, 0.5, 0.4]) cylinder(h = 0.6, r = 1, center = true, $fn = 16);
mirror_x() {
  color([0.08, 0.06, 0.07]) translate([1, -11.6, 28.8]) scale([0.4, 0.3, 0.35]) sphere(1, $fn = 8);
  color(crackRed) translate([3, -7.6, 30.2]) rotate([0, -15, -30]) scale([1.4, 0.7, 0.8]) sphere(1, $fn = 12);
  color(coreHi) translate([3, -8.2, 30.3]) rotate([0, 0, -30]) scale([0.8, 0.4, 0.5]) sphere(1, $fn = 10);
  crackline([[3.8, -4, 30.5], [4.4, -1, 29], [4, 0, 26.5]], 0.25);
}
flame([0, -4.5, 32.6], [0, 2.5, 6], 1.9);
mirror_x() flame([2.4, -2.5, 32], [1.4, 2.5, 5], 1.5);

// Dorsal flames: a blazing mane down the back, tallest at the shoulders.
for (i = [0 : 5]) {
  y = 4.5 + i * 1.4; z = 26 - i * 3.4; h = 8 - abs(i - 1) * 0.9;
  flame([0, y, z], [0, 2.4, h], 2.2 - i * 0.12);
  if (i % 2 == 0) mirror_x() flame([3, y - 0.5, z - 0.5], [1.6, 2, h * 0.75], 1.7 - i * 0.1);
}

// Arms: thick, held forward, plated, with pale claws.
mirror_x() {
  limb([7, -1, 22], [10, -3.5, 17.5], 3.3, 2.9, coal);
  limb([10, -3.5, 17.5], [11, -7, 14.5], 2.9, 2.5, coalHi);
  crackline([[9, -4.4, 20], [10.6, -5.6, 17], [11.6, -7.4, 15]], 0.26);
  ell([2.6, 2.6, 2], [11.2, -7.9, 13.6], coal);
  for (a = [-35, 0, 35]) chain([[11.2 + sin(a) * 1.5, -9.4, 13.4], [11.2 + sin(a) * 1.8, -10.6, 12.4], [11.2 + sin(a) * 1.8, -10.4, 11.2]],
                              [0.55, 0.4, 0.06], claw);
}

// Legs: massive thighs and pillar shins, big clawed feet, cracks running down.
mirror_x() {
  ell([4.6, 5, 5.4], [5.8, 0, 8.5], coal);
  limb([6, -0.5, 6], [6.4, -1, 2.4], 3.6, 3.4, coal);
  blob([[[3.6, 4.6, 1.8], [6.4, -2.6, 1.8]], [[3, 2.6, 1.6], [6.4, 0.8, 1.7]]], coalHi);
  for (a = [-30, 0, 30]) spike([6.4 + sin(a) * 2, -6.8, 1.2], [sin(a) * 0.6, -1.6, -0.6], 0.6, 0.05, claw);
  crackline([[9.8, -2, 10], [10.2, -1.6, 6.5], [9.6, -2.2, 3.5]], 0.28);
  crackline([[6, -5, 11], [7.5, -4.6, 8]], 0.26);
}

// Tail: long, thick, segmented, sweeping back and curling up to the viewer's right into a tall flame.
tail = [[1.5, 6.5, 8], [5, 13, 5], [11, 16, 5], [16, 14, 8], [18.5, 10, 13], [19, 7, 18.5], [18.5, 6, 22]];
chain(tail, [4.8, 4, 3.4, 2.8, 2.2, 1.7, 1.3], coal);
// Segment rings glowing between the tail plates.
for (i = [1 : 5]) {
  a = tail[i]; b = tail[i + 1];
  d = b - a;
  color(crack) translate(a) rotate(_dir_rot(d)) scale([1, 1, 0.12]) sphere([0, 4.1, 3.5, 2.9, 2.3, 1.8][i], $fn = 16);
}
// Small flames riding the top of the tail.
flame([5, 13, 8.6], [0, 1, 4], 1.4);
flame([11, 16, 8], [0.5, 1, 4], 1.3);
flame([16, 14, 10.6], [1, 0.5, 3.6], 1.2);
flame([18.5, 6, 23], [0, -0.5, 14], 3.8);
flame([20, 6.4, 22.5], [3, 0.5, 7.5], 2);
flame([17, 6, 22.5], [-3, 0.5, 7.5], 2);
