// Gustling: Puffinch grown upright. A round head with a cream face and a curled cream crest plume, a jagged red ruff,
// a cream belly between folded wings with brown-banded tips, orange legs, and two tail streamers ending in red tufts.
include <lib.scad>

tan = [0.8, 0.62, 0.36];
tanDark = [0.62, 0.45, 0.26];
band = [0.45, 0.25, 0.15];
cream = [0.97, 0.9, 0.7];
red = [0.8, 0.28, 0.14];
beak = [0.95, 0.5, 0.15, NOGLOW];
foot = [0.98, 0.55, 0.15, NOGLOW];
iris = [0.3, 0.18, 0.1];

// Body: a pear, cream belly flush on its front.
module bodyShape(k = 1) { translate([0, 0, 13]) scale([10, 9, 11] * k) sphere(1, $fn = 36); }
color(tan) bodyShape();
color(cream) intersection() { bodyShape(1.015); translate([0, -9, 11]) scale([6, 5, 9]) sphere(1, $fn = 20); }

// Head.
module headShape(k = 1) { translate([0, -0.5, 28]) scale([7, 6.5, 6.5] * k) sphere(1, $fn = 32); }
color(tan) headShape();
color(cream) intersection() {
  headShape(1.02);
  union() mirror_x() translate([2.6, -6, 28]) scale([3.6, 4, 4]) sphere(1, $fn = 16);
}
mirror_x() eye([2.7, -6.3, 28.6], 1.9, iris = iris, pupil = [0.08, 0.05, 0.03], yaw = -20, flat = 0.45);
color(beak) hull() {
  translate([0, -6.6, 26.2]) scale([1.3, 0.8, 0.9]) sphere(1, $fn = 12);
  translate([0, -8.6, 25.4]) sphere(0.2, $fn = 8);
}
// Curled crest plume: up from the crown and hooking over.
chain([[0, 0, 33.5], [-0.5, 0, 37], [0, 0.3, 40.5], [2.5, 0.5, 42.8], [5.5, 0.6, 42.6], [7.4, 0.5, 40.6], [7.2, 0.3, 38.2], [5.8, 0.2, 37.4]],
      [1.4, 1.5, 1.6, 1.6, 1.5, 1.3, 0.9, 0.4], cream);

// Ruff: a ring of red points around the neck.
color(red) translate([0, -0.3, 22.5]) scale([7.5, 7, 1.6]) sphere(1, $fn = 24);
for (a = [0 : 24 : 359]) spike([7 * sin(a), -0.3 - 6.6 * cos(a), 22.5], [sin(a) * 2.6, -cos(a) * 2.6, -2.2], 1.4, 0.1, red);

// Folded wings at the sides, brown band near the tip.
mirror_x() {
  color(tan) translate([9, 1, 13]) rotate([0, 8, 8]) scale([2.6, 6.5, 9.5]) sphere(1, $fn = 24);
  color(band) intersection() {
    translate([9, 1, 13]) rotate([0, 8, 8]) scale([2.7, 6.6, 9.6]) sphere(1, $fn = 24);
    translate([9, 1, 7.5]) cube([8, 16, 2.4], center = true);
  }
  for (i = [0 : 3]) color(tanDark) translate([9.4 + i * 0.1, -3 + i * 2.2, 3.5 + i * 0.4]) rotate([0, 10, 0]) scale([1.2, 1.1, 2.2]) sphere(1, $fn = 10);
}

// Legs and feet.
mirror_x() {
  limb([4, 0, 4], [4.2, -1, 0.8], 0.9, 0.7, foot);
  for (a = [-30, 0, 30]) limb([4.2, -1, 0.7], [4.2 + sin(a) * 3, -1 - cos(a) * 3, 0.5], 0.7, 0.45, foot);
  limb([4.2, -1, 0.7], [4.2, 1.5, 0.5], 0.6, 0.4, foot);
}

// Two tail streamers sweeping out to the viewer's right, each ending in a red tuft.
chain([[5, 7, 8], [11, 8, 11], [17, 7, 12], [21, 6, 11]], [1, 0.9, 0.8, 0.8], tan);
petal([2.8, 1.3, 1.8], [22.5, 5.8, 10.6], [0, -20, 0], red);
chain([[4, 7, 7], [9, 8.5, 6], [14, 8, 5], [17, 7, 2.5]], [1, 0.9, 0.8, 0.8], tan);
petal([1.6, 1.3, 2.8], [17.4, 7, 1.6], [0, 15, 0], red);
