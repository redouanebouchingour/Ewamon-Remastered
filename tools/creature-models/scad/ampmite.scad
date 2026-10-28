// Ampmite: a low, armoured green beetle-mite. Big gold compound eyes, a segmented olive shell with rust underplates,
// two glowing gold glass capacitor bulbs on its back crackling with lightning, slate antennae that end in sparks,
// and six slate legs with rust claws.
include <lib.scad>

shell = [0.42, 0.52, 0.16];
shellLight = [0.58, 0.66, 0.24];
shellDark = [0.26, 0.34, 0.1];
rust = [0.72, 0.32, 0.12];
gold = [0.92, 0.68, 0.12];
goldLight = [1, 0.85, 0.35];
bolt = [1, 0.9, 0.3];
slate = [0.35, 0.33, 0.4];
slateDark = [0.24, 0.22, 0.28];
clawC = [0.62, 0.26, 0.12];

// Zig-zag lightning bolt through points (flat-ish capsules).
module zap(pts, r = 0.75) { chain(pts, [for (p = pts) r], bolt); }

// Shell segment: an ellipsoid plate with a lighter top and a rust lower rim.
module segment(p, r) {
  color(rust) translate(p + [0, 0, -r[2] * 0.25]) scale([r[0] * 1.04, r[1] * 0.96, r[2] * 0.8]) sphere(1, $fn = 24);
  color(shell) translate(p) scale(r) sphere(1, $fn = 24);
  color(shellLight) translate(p + [0, 0, r[2] * 0.35]) scale([r[0] * 0.7, r[1] * 0.7, r[2] * 0.7]) sphere(1, $fn = 20);
}

// Body: head, thorax and a long segmented abdomen behind.
segment([0, -4, 11], [6.5, 5.5, 4.6]);            // thorax
segment([0, 3, 11], [7, 4.5, 5]);
segment([0, 8.5, 10.5], [6.4, 4, 4.6]);
segment([0, 13.5, 9.8], [5.6, 3.8, 4]);
segment([0, 17.8, 9.2], [4.4, 3.2, 3.2]);
// Stud rivets along the back.
for (y = [-4, 3, 8.5, 13.5]) mirror_x() color(gold) translate([2.6, y, y < 0 ? 15.4 : 15.5 - y * 0.12]) sphere(0.6, $fn = 8);

// Head block, scaled up about the neck.
translate([0, -8, 10]) scale(1.45) translate([0, 8, -10]) {
// Head: armoured, lowered, with two huge gold compound eyes and rust mandibles.
color(shellDark) translate([0, -11, 9]) scale([5.4, 4.6, 4.2]) sphere(1, $fn = 24);
color(shell) translate([0, -11.6, 10.6]) scale([4, 3.6, 2.8]) sphere(1, $fn = 20);
mirror_x() {
  color(gold) translate([2.6, -14.4, 9.6]) rotate([0, 0, -35]) scale([2.3, 1.6, 2.4]) sphere(1, $fn = 18);
  color(goldLight) translate([2.2, -15.8, 10.4]) sphere(0.6, $fn = 10);
  color(rust) translate([3.4, -12.6, 6.8]) rotate([0, 0, -25]) scale([2.2, 1.2, 1]) sphere(1, $fn = 14);
  // Mandibles.
  chain([[1.6, -14.8, 6.6], [2.2, -17, 6], [1, -18.2, 6]], [0.8, 0.6, 0.25], rust);
}
}
// Antennae: slate stalks, branching spark tips.
mirror_x() {
  chain([[1.6, -13.5, 13.5], [3, -15.5, 17], [5, -16, 22], [6.6, -15.5, 26]], [0.55, 0.5, 0.45, 0.35], slate);
  zap([[6.6, -15.5, 26], [7.5, -15.5, 28.5], [6.4, -15.5, 29.5], [7.6, -15.5, 32]]);
  zap([[7.2, -15.5, 27.6], [9, -15.5, 28.6], [9.8, -15.5, 30.4] ], 0.55);
}

// Capacitor bulbs: gold glass spheres in slate cradles, with bolts arcing up from them.
module bulb(p, r) {
  color(gold) translate(p) sphere(r, $fn = 28);
  color(goldLight) translate(p + [-r * 0.35, -r * 0.45, r * 0.4]) sphere(r * 0.3, $fn = 12);
  color(slateDark) translate(p) rotate([90, 0, 0]) rotate_extrude($fn = 28) translate([r * 1.02, 0]) circle(0.45, $fn = 8);
  color(slateDark) translate(p) rotate([0, 90, 0]) rotate_extrude($fn = 28) translate([r * 1.02, 0]) circle(0.4, $fn = 8);
  color(slateDark) translate(p - [0, 0, r * 0.9]) cylinder(h = r * 0.5, r = r * 0.55, $fn = 16);
}
bulb([-4.4, -1.5, 19.5], 4.2);
bulb([4.8, 6, 19.5], 4.6);
// Lightning crackling above the bulbs.
zap([[-4.4, -1.5, 23.6], [-3.5, -2, 26], [-5, -2, 28], [-4, -2.5, 31]]);
zap([[-5, -2, 28], [-7.4, -2, 29.5], [-8.2, -2, 31.5]], 0.55);
zap([[4.8, 6, 24], [6, 5.5, 26.5], [4.6, 5.5, 28.5], [5.8, 5, 31.5]]);
zap([[4.6, 5.5, 28.5], [2.4, 5, 30], [2, 5, 32]], 0.55);
zap([[8.8, 6, 21], [11, 6, 23], [10.2, 6, 25], [12, 6, 27]], 0.55);
zap([[-1, 2, 22], [0.2, 2, 24.5], [-0.6, 2, 26.5]], 0.5);

// Legs: six slate legs splayed out, bent knees, rust claws.
module leg(y, splay, reach) {
  hip = [5, y, 8.5];
  knee = [5 + reach * 0.6, y + splay * 0.4, 10];
  foot = [5 + reach, y + splay, 1.2];
  limb(hip, knee, 1.6, 1.3, slate);
  limb(knee, foot, 1.3, 0.9, slateDark);
  color(slate) translate(knee) sphere(1.6, $fn = 10);
  for (a = [-30, 30]) spike(foot, [sin(a) * 1.4 + 0.4, -1.8, -1], 0.8, 0.05, clawC);
  color(clawC) translate(foot) sphere(0.8, $fn = 8);
}
mirror_x() {
  leg(-5, -5, 6);
  leg(2, 0, 6.5);
  leg(9, 5, 6);
}
