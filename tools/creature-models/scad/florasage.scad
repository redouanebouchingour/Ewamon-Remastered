// Florasage: the final bloom of the Budwing line. An upright green dragon speckled with glowing spots, a spiky bark
// ridge down its spine, great many-tined antlers, huge wings of broad leaves set with orange sunflowers, red eyes and
// a long tail that sweeps round behind it and ends in a sunflower.
include <lib.scad>
$fs = 1.0;

green = [0.27, 0.5, 0.22];
greenHi = [0.4, 0.62, 0.3];
greenDk = [0.18, 0.36, 0.16];
leaf = [0.32, 0.58, 0.26];
leafHi = [0.45, 0.7, 0.32];
glow = [0.55, 0.95, 0.45];
bark = [0.45, 0.3, 0.18];
antler = [0.5, 0.35, 0.22];
claw = [0.75, 0.3, 0.2];
petalO = [1, 0.62, 0.12];
petalR = [0.98, 0.45, 0.1];
seed = [0.4, 0.24, 0.1];

module ell16(r, p, c) { color(c) translate(p) scale(r) sphere(1, $fn = 14); }

// Sunflower facing +Z (rotate it into place): petals ring around a seed disc.
module sunflower(s = 1) {
  scale(s) {
    for (i = [0 : 9]) color(i % 2 == 0 ? petalO : petalR) rotate([0, 0, i * 36]) translate([2.6, 0, -(i % 2) * 0.2]) scale([1.7, 1.1, 0.35]) sphere(1, $fn = 7);
    color(seed) scale([1.5, 1.5, 0.7]) sphere(1, $fn = 10);
  }
}

module antler(p, s) {
  a = p + [s * 2.2, 0.8, 5];
  b = a + [s * 2.6, 0.6, 4];
  c = b + [s * 1.6, 0.4, 3.5];
  limb(p, a, 0.8, 0.65, antler);
  limb(a, b, 0.65, 0.5, antler);
  limb(b, c, 0.5, 0.32, antler);
  limb(a, a + [-s * 1.4, 0.2, 4], 0.45, 0.28, antler);
  limb(b, b + [-s * 0.8, 0, 3.6], 0.4, 0.28, antler);
  limb(b, b + [s * 3, 0, 0.8], 0.4, 0.28, antler);
  limb(c, c + [s * 2, 0, 0.6], 0.32, 0.22, antler);
  limb(c, c + [-s * 0.6, 0, 2.2], 0.32, 0.22, antler);
}

// Torso: upright, slim waist, deep chest.
blob([[[5.6, 5, 5], [0, 1, 11]], [[5, 4.8, 5.5], [0, -0.5, 18]], [[4.2, 4.2, 4], [0, -1.2, 23]]], green);
// Pale scaled belly plates.
ell([3.4, 2.4, 6.5], [0, -2.9, 16.5], [0.5, 0.74, 0.36]);
for (z = [12, 15, 18, 21]) color(green) translate([0, -4.6 - (z - 16.5) * 0 + (abs(z - 16.5) * abs(z - 16.5)) * 0.04, z]) scale([2.8, 0.3, 0.2]) sphere(1, $fn = 10);

// Neck and head.
chain([[0, -1, 23], [0, -2.2, 27], [0, -3, 30]], [3.6, 3.1, 2.9], green);
blob([[[5, 4.8, 4.2], [0, -3.2, 31.5]], [[3.6, 3.8, 2.8], [0, -7.8, 30.6]]], green);
color(greenDk) translate([0, -10.3, 29.6]) scale([2.9, 1.2, 0.3]) sphere(1, $fn = 12);
mirror_x() {
  eye([3.0, -7.2, 32.6], 1.45, iris = [0.85, 0.12, 0.08], pupil = [0.25, 0.02, 0.02], sclera = [0.95, 0.75, 0.5], yaw = -30, flat = 0.4);
  color(greenDk) translate([3.0, -7.7, 34]) rotate([0, 16, -30]) scale([1.8, 0.6, 0.4]) sphere(1, $fn = 10);
  // Little cheek frills.
  spike([3.4, -2.6, 31], [2.2, 1.6, -0.6], 0.8, 0.1, greenHi);
}
mirror_x() antler([1.8, -2.5, 34], 1, $fn = 8);

// Glowing speckles over the body and neck: [x, y, z] surface points.
for (p = [[4.6, -1.5, 13], [-4.2, -2, 15], [3.5, -3.6, 19], [-3, -3.6, 21], [4.8, 1, 17], [-5, 1, 11], [2.6, -3.6, 25],
          [-2.4, -3.2, 27], [5, 2.5, 9], [-4.6, 3, 16], [2, 3.8, 22]])
  ell16([0.8, 0.8, 1.1], p, glow);

// Spiky bark ridge down the spine and on along the tail.
for (i = [0 : 7]) {
  z = 30 - i * 3;
  y = (z > 20 ? 1 + (30 - z) * 0.25 : 3.6 + (20 - z) * 0.2) + 0.2;
  spike([0, y, z], [0, 1.6, 0.7], 0.8, 0.1, bark);
}

// Arms: small, held in front with clawed hands.
mirror_x() {
  limb([4.2, -1, 21], [5.6, -3.4, 17], 1.4, 1.1, green);
  limb([5.6, -3.4, 17], [4.4, -5.6, 15.8], 1.1, 0.9, green);
  for (a = [-30, 0, 30]) spike([4.4 + sin(a) * 0.6, -6.2, 15.6], [sin(a) * 0.3, -0.8, -0.5], 0.3, 0.05, claw);
}

// Hind legs: bent thighs, long feet with red claws.
mirror_x() {
  ell([3.2, 4, 4.6], [4.6, 0.8, 8.5], green);
  limb([5.2, 1.6, 6], [5.6, 2.2, 1.6], 1.8, 1.4, green);
  blob([[[1.8, 3.6, 1.2], [5.8, -0.6, 1.2]], [[1.4, 1.4, 1.2], [5.8, 2, 1.2]]], green);
  for (a = [-25, 0, 25]) spike([5.8 + sin(a) * 1.1, -4, 0.8], [sin(a) * 0.4, -1, -0.3], 0.4, 0.05, claw);
}

// Tail: sweeps back, coils round behind on the viewer's right, then swings out to the left and lifts a sunflower.
tailPts = [[0, 4, 7], [3, 9, 4], [9, 12, 3], [14, 9, 3], [14, 4, 4.5], [10, 3, 6], [7, 6, 4], [2, 12, 2.6],
           [-6, 13, 2.4], [-12, 9, 2.6], [-15, 3, 4], [-15, -1, 7], [-14, -2, 10]];
tailR = [3.6, 3.2, 2.8, 2.4, 2.1, 1.8, 1.7, 1.6, 1.4, 1.2, 1, 0.8, 0.7];
chain(tailPts, tailR, green, $fn = 14);
for (i = [1 : 2 : 9]) spike(tailPts[i] + [0, 0, tailR[i] * 0.7], [0, 0, 1.4], 0.6, 0.1, bark);
for (i = [2 : 3 : 9]) ell16([0.5, 0.5, 0.6], tailPts[i] + [0, -tailR[i] * 0.8, tailR[i] * 0.3], glow);
petal([1.6, 0.4, 0.7], [-13.6, -1.6, 8.5], [0, -20, 0], leafHi);
translate([-14, -2.6, 12.8]) rotate([75, 0, -25]) sunflower(1.3);

// Wings: two great fans of broad leaves rising behind the shoulders, sunflowers set in each.
mirror_x() translate([3.5, 4, 24]) rotate([0, 0, 15]) rotate([0, 10, 0]) {
  limb([0, 0, 0], [12, 0, 7], 1, 0.6, greenDk);
  for (k = [0 : 6]) {
    a = 15 + k * 14;
    l = 8 + (3 - abs(k - 3)) * 1.4;
    o = [12 * (k / 6), 0, 7 * (k / 6)] * 0.6;
    color(k % 2 == 0 ? leaf : leafHi) translate(o) rotate([0, a, 0]) translate([0, 0, l]) scale([2.8, 0.5, l]) sphere(1, $fn = 12);
    color(greenDk) translate(o) rotate([0, a, 0]) translate([0, -0.2, l]) scale([0.25, 0.5, l * 0.95]) sphere(1, $fn = 6);
  }
  translate([7, -1, 10]) rotate([90, 0, 0]) sunflower(1.0);
  translate([11, -1, 5]) rotate([90, 0, 0]) sunflower(0.8);
  translate([4, -1, 5]) rotate([90, 0, 0]) sunflower(0.7);
  translate([7, 1, 10]) rotate([-90, 0, 0]) sunflower(1.0);
  translate([11, 1, 5]) rotate([-90, 0, 0]) sunflower(0.8);
}
