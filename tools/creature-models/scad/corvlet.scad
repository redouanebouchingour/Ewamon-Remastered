// Corvlet: a round black raven chick with a big hooded head, one huge violet eye per side, a short beak holding a
// gold ring, purple-tipped wings and purple legs; a few loose violet feathers drift around it.
include <lib.scad>

black = [0.13, 0.12, 0.15];
blackHi = [0.2, 0.19, 0.23];
purple = [0.36, 0.2, 0.48];
purpleDk = [0.25, 0.14, 0.34];
leg = [0.32, 0.24, 0.42];
talon = [0.85, 0.8, 0.9];
beak = [0.33, 0.27, 0.4];
gold = [0.95, 0.72, 0.18];
goldDk = [0.7, 0.48, 0.1];

// Body: a round fluffy ball.
blob([[[8.5, 7.5, 8], [0, 1, 13]], [[7, 6.5, 5.5], [0, 0, 8]]], black);
// Feather ruff around the neck: a ring of jagged points pointing down.
for (a = [0 : 30 : 359]) {
  color(blackHi) hull() {
    translate([6 * sin(a), 0.5 - 5.6 * cos(a), 19]) scale([1.8, 1, 1]) rotate([0, 0, -a]) sphere(1.2, $fn = 12);
    translate([8 * sin(a), 0.5 - 7.4 * cos(a), 14.5]) sphere(0.3, $fn = 8);
  }
}

// Head: a big round hood.
blob([[[9, 8.5, 8.5], [0, 0, 26]], [[7, 6.5, 6], [0, -2, 23]]], black);
// Hood point sweeping up and back, with two smaller tufts.
color(black) hull() {
  translate([0, 1, 30]) scale([5, 5, 3]) sphere(1, $fn = 20);
  translate([0, 6, 39]) sphere(0.4, $fn = 8);
}
spike([1.5, 4, 32], [3, 6, 3], 1.8, 0.2, black);
spike([-1.5, 4, 32], [-3, 6, 3], 1.8, 0.2, black);
// Hood rim: a slightly lighter face disc so the eyes read.
ell([7, 2.2, 6], [0, -6.3, 24], blackHi);

// Big violet eyes.
mirror_x() eye([3.6, -7.8, 25], 2.6, iris = [0.55, 0.3, 0.85], pupil = [0.2, 0.05, 0.3], sclera = [0.95, 0.94, 0.98], yaw = -22);

// Short hooked beak.
color(beak) hull() {
  translate([0, -8.5, 22.2]) scale([1.8, 1.2, 1.4]) sphere(1, $fn = 16);
  translate([0, -12.6, 21]) sphere(0.4, $fn = 10);
}
color(purpleDk) hull() {
  translate([0, -8.5, 21]) scale([1.3, 1, 0.8]) sphere(1, $fn = 14);
  translate([0, -11, 20.6]) sphere(0.3, $fn = 10);
}
// The gold ring it carries in its beak, plus a little chain.
color(gold) translate([0, -11.2, 18.6]) rotate([90, 0, 0]) rotate_extrude($fn = 28) translate([2, 0]) circle(0.6, $fn = 10);
color(goldDk) translate([0, -11.2, 18.6]) rotate([90, 0, 0]) cylinder(h = 0.5, r = 1.2, center = true, $fn = 16);
color(gold) for (i = [0 : 3]) translate([2.4 + i * 0.8, -9.8 + i * 0.6, 20.4 - i * 0.6]) sphere(0.45, $fn = 10);

// Wings: layered feathers, black at the shoulder, purple at the tips, held out a little to the sides.
module wing() {
  petal([3.5, 1.6, 7], [8.2, 0.5, 13], [10, -25, 0], black);
  for (i = [0 : 3]) {
    petal([1.5, 0.8, 4.2], [9.5 + i * 0.5, -1.5 + i * 1.3, 7.8 - i * 0.2], [0, -38 - i * 6, 0], purple);
  }
  petal([1.2, 0.6, 3.2], [10.8, -1.5, 6.2], [0, -55, 0], purpleDk);
}
mirror_x() wing();
// Short tail fan at the back.
for (a = [-20, 0, 20]) petal([1.6, 0.8, 4.5], [sin(a) * 2, 7.5, 6.5], [-60, a, 0], a == 0 ? purpleDk : purple);

// Legs and three-toed feet with pale talons.
mirror_x() {
  limb([3.2, 0, 6], [3.6, -0.5, 1], 1.1, 0.9, leg);
  for (a = [-35, 0, 35]) {
    limb([3.6, -0.5, 0.8], [3.6 + sin(a) * 3, -0.5 - cos(a) * 3, 0.6], 0.7, 0.55, leg);
    spike([3.6 + sin(a) * 3.2, -0.5 - cos(a) * 3.2, 0.6], [sin(a) * 0.8, -cos(a) * 0.8, -0.4], 0.45, 0.05, talon);
  }
  limb([3.6, -0.5, 0.8], [3.6, 2.2, 0.6], 0.6, 0.5, leg);
}

// Loose feathers drifting around it.
petal([0.9, 0.35, 3], [-14, -2, 22], [0, 30, 20], purple);
petal([0.9, 0.35, 3], [14, 0, 21], [0, -25, -10], purple);
petal([0.8, 0.3, 2.4], [15, 3, 12], [0, -50, 0], purpleDk);
petal([0.8, 0.3, 2.4], [-13, 4, 10], [0, 50, 0], purpleDk);
