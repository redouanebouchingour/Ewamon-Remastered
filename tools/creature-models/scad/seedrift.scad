// Seedrift: a fluffy white dandelion puffball with big plum eyes, little feather wings, twig legs,
// and seed parachutes drifting around it.
include <lib.scad>

fluff = [0.95, 0.93, 0.86];
fluffShade = [0.84, 0.81, 0.72];
fluffCore = [1, 1, 0.97];
twig = [0.55, 0.38, 0.24];
plum = [0.45, 0.1, 0.3];
spark = [0.55, 0.9, 0.3];
purple = [0.6, 0.25, 0.65];

C = [0, 0, 24];
R = 13;

// Puff body: a core sphere studded with fluffy lumps.
ell([R + 0.6, R + 0.6, R + 0.6], C, fluff);
for (i = [0 : 109]) {
  // Fibonacci sphere distribution.
  z = 1 - (i + 0.5) / 55;
  r = sqrt(1 - z * z);
  a = i * 137.508;
  p = C + R * [r * cos(a), r * sin(a), z];
  color(z < -0.35 ? fluffShade : (i % 4 == 0 ? fluffShade : fluff)) translate(p) scale(2.6) sphere(1, $fn = 10);
}
// Back starburst (the dandelion centre seen from behind).
ell([2.6, 1, 2.6], C + [0, R + 2.4, 0], fluffCore);
for (a = [0 : 30 : 359]) color(fluffCore) translate(C + [0, R + 1.9, 0]) rotate([0, a, 0]) translate([0, 0, 4]) scale([0.9, 0.5, 3.6]) sphere(1, $fn = 8);

// Big plum eyes with green sparkles and lashes.
module bigeye(x) {
  translate([x, -R - 2.6, 25.5]) {
    color([0.15, 0.05, 0.1]) scale([3.6, 1.2, 3.6]) sphere(1, $fn = 20);
    color(plum) translate([0, -0.6, 0]) scale([3, 1, 3]) sphere(1, $fn = 20);
    color([0.25, 0.05, 0.15]) translate([0, -1.2, 0]) scale([1.4, 0.6, 1.4]) sphere(1, $fn = 14);
    color(spark) translate([0.9, -1.5, 0.9]) sphere(0.7, $fn = 10);
    color(spark) translate([-0.8, -1.4, -0.9]) sphere(0.45, $fn = 8);
    color("white") translate([-1, -1.5, 1.3]) sphere(0.45, $fn = 8);
  }
}
bigeye(-4.6);
bigeye(4.6);

// Feather wings on the sides.
mirror_x() {
  for (k = [0 : 3]) petal([5.5 - k * 0.7, 1, 1.4], [R + 4.5, -1, 23 + k * 1.6], [0, 25 - k * 18, 0], k % 2 == 1 ? fluffShade : fluff);
}

// Twig legs.
mirror_x() limb([3.2, 0, 12], [3.6, -0.5, 4], 0.8, 0.7, twig);

// Floating seed parachutes.
module seed(p, tilt) {
  translate(p) rotate(tilt) {
    color(twig) cylinder(h = 3, r = 0.35, $fn = 6);
    for (a = [-50 : 25 : 50]) color(fluff) translate([0, 0, 3]) rotate([0, a, 0]) cylinder(h = 2.5, r1 = 0.3, r2 = 0.5, $fn = 6);
  }
}
seed([-16, -2, 36], [0, -30, 0]);
seed([16, -2, 36], [0, 30, 0]);
seed([-15, -1, 12], [0, -150, 0]);
seed([15, -1, 12], [0, 150, 0]);
color(purple) for (p = [[-12, -3, 40], [13, -2, 10], [-17, 0, 20], [17, 0, 22]]) translate(p) sphere(0.8, $fn = 8);
