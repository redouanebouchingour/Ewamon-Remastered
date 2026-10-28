// Pyremoth: Kindlegrub's moth form: a fluffy ash-tan body with a dark masked face, feathered antennae and four
// flame-edged orange wings with yellow eyespots, shedding embers below.
include <lib.scad>

tan = [0.66, 0.6, 0.48];
tanLo = [0.55, 0.49, 0.38];
dark = [0.2, 0.19, 0.2];
grey = [0.3, 0.3, 0.32];
wingRed = [0.9, 0.3, 0.1];
wingOrange = [1, 0.58, 0.16];
eyeRing = [0.45, 0.22, 0.1];
spot = [1, 0.75, 0.15];
ember = [1, 0.6, 0.15];
glow = [1, 0.72, 0.1];
plum = [0.45, 0.2, 0.3];

// A wing: a flat leaf in the XZ plane, pointing at `ang` (degrees from +X towards +Z), with flame tongues on its outer
// edge and an eyespot on both faces.
module wing(base, len, wid, ang) {
  translate(base) rotate([-28, 0, 12]) rotate([0, -ang, 0]) {
    color(wingRed) translate([len * 0.5, 0, 0]) scale([len * 0.55, 1.2, wid]) sphere(1, $fn = 28);
    // Flame tongues on the outer edge.
    color(wingRed) for (a = [-50 : 25 : 50]) hull() {
      translate([len * 0.75 + len * 0.2 * cos(a), 0, wid * 0.75 * sin(a)]) sphere(1.2, $fn = 8);
      translate([len * 1.12 + len * 0.1 * cos(a), 0, wid * 1.0 * sin(a) + 1.6]) sphere(0.2, $fn = 6);
    }
    color(wingOrange) translate([len * 0.5, 0, 0]) scale([len * 0.47, 1.5, wid * 0.8]) sphere(1, $fn = 28);
    for (sy = [-1, 1]) {
      color(eyeRing) translate([len * 0.58, 0, 0]) scale([len * 0.2, 1.65, wid * 0.42]) sphere(1, $fn = 20);
      color(spot) translate([len * 0.58, sy * 0.15, 0]) scale([len * 0.15, 1.65, wid * 0.32]) sphere(1, $fn = 18);
    }
  }
}

// Wings: two big upper ones raised high, two smaller lower ones, all set behind the body.
mirror_x() {
  wing([3, 3.5, 22], 21, 9.5, 48);
  wing([3, 3.5, 15], 16, 6.5, -38);
}

// Body: a fluffy tan pear with a dark segmented chest stripe.
blob([[[8, 6.4, 7.5], [0, 0, 12.5]], [[7, 6, 5.5], [0, 0, 19.5]]], tan);
// Fluffy tufts along the lower edge.
color(tan) for (a = [0 : 40 : 359]) hull() {
  translate([cos(a) * 6.4, sin(a) * 5, 8]) sphere(1.8, $fn = 8);
  translate([cos(a) * 6.8, sin(a) * 5.4, 4.4]) sphere(0.3, $fn = 6);
}
// Dark chevrons down the chest.
color(dark) for (i = [0 : 2]) mirror_x() hull() {
  translate([0, -6.3 + i * 0.1, 19 - i * 3.6]) sphere(0.9, $fn = 8);
  translate([3.4 - i * 0.6, -5.2 + i * 0.1, 20.6 - i * 3.6]) sphere(0.7, $fn = 8);
}
// Plum tail tuft trailing behind.
color(plum) hull() {
  translate([1, 3, 8]) sphere(2, $fn = 10);
  translate([2.5, 5, 3]) sphere(0.3, $fn = 8);
}

// Head: a tan ball with a dark mask and big glowing yellow eyes.
ell([7.6, 6.4, 6.4], [0, -0.6, 28.5], tan);
// Fluffy collar ruff.
color(tan) for (a = [0 : 30 : 359]) translate([cos(a) * 7, sin(a) * 5.8 - 0.4, 23.5]) scale([1.8, 1.8, 2.2]) sphere(1, $fn = 10);
// Dark V mask.
mirror_x() color(dark) hull() {
  translate([0, -6.5, 25.6]) sphere(1, $fn = 10);
  translate([4.6, -5.4, 30.2]) scale([1.4, 1, 1.6]) sphere(1, $fn = 10);
  translate([1.2, -6.6, 29]) sphere(1, $fn = 10);
}
mirror_x() {
  color(glow) translate([3.1, -6.7, 29.6]) rotate([0, -25, -22]) scale([2, 0.9, 1.3]) sphere(1, $fn = 14);
  color([1, 0.93, 0.6]) translate([3.2, -7.4, 29.9]) scale([0.7, 0.4, 0.5]) sphere(1, $fn = 8);
}

// Feathered antennae: dark grey leaf shapes rising from the head.
mirror_x() {
  color(grey) translate([3.6, 0, 37.5]) rotate([0, 28, 0]) scale([2.3, 1.1, 6]) sphere(1, $fn = 16);
  color(dark) translate([3.6, 0, 37.5]) rotate([0, 28, 0]) scale([0.4, 1.3, 5.8]) sphere(1, $fn = 10);
  limb([2, -0.4, 33.5], [3, 0, 34.5], 0.6, 0.6, dark);
}

// Little dark arms with orange claws, held in front.
mirror_x() {
  limb([6.4, -3, 20], [7.6, -5, 16], 1.4, 1.2, dark);
  for (a = [-25, 25]) spike([7.6 + sin(a), -5.6, 15.4], [sin(a) * 0.5, -0.6, -1.2], 0.4, 0.05, ember);
}

// Short dark legs with orange claws.
mirror_x() {
  limb([2.6, 0, 6], [3, -0.5, 1.6], 1.5, 1.3, dark);
  for (a = [-25, 25]) spike([3 + sin(a), -1.6, 0.8], [sin(a) * 0.5, -1.2, -0.4], 0.45, 0.05, ember);
}

// Falling embers.
for (e = [[-8, -3, 2], [-4, -5, 0.4], [5, -4, 1], [9, -1, 3], [0, -6, 0.2], [12, 0, 0.6], [-11, 1, 0.8]])
  color(ember) translate(e) rotate([20, 30, e[0] * 10]) scale([0.6, 0.4, 1.2]) sphere(1, $fn = 8);
