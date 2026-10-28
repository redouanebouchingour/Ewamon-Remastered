// Umbrit: a small hooded shade, a charcoal cloak with a floppy pointed hood, a black void face with two round white
// eyes, thin twig arms, and a ragged hem that frays into wisps; it floats just off the ground.
include <lib.scad>

cloak = [0.3, 0.28, 0.34];
cloakLt = [0.4, 0.38, 0.45];
cloakDk = [0.18, 0.16, 0.22];
void = [0.06, 0.04, 0.09];
eyeW = [0.88, 0.92, 0.92];

// Cloak body: a bell widening to the hem.
color(cloak) hull() {
  translate([0, 0.3, 25]) scale([7.6, 7.1, 3]) sphere(1, $fn = 28);
  translate([0, 0, 8]) scale([9, 8.5, 1]) sphere(1, $fn = 32);
}
// Fold ridges down the cloak.
for (a = [-60, -25, 15, 50, 120, 160, 200, 250]) {
  color(cloakDk) rotate([0, 0, a - 90]) hull() {
    translate([7.3, 0, 22]) sphere(0.5, $fn = 8);
    translate([8.6, 0, 8.5]) sphere(0.7, $fn = 8);
  }
}
// Ragged hem: drooping triangular tatters, some reaching the floor.
for (i = [0 : 13]) {
  a = i * 360 / 14;
  l = (i % 3 == 0) ? 7.5 : (i % 2 == 0 ? 5.5 : 4);
  color(i % 2 == 0 ? cloak : cloakDk) rotate([0, 0, a]) hull() {
    translate([8.2, 0, 8.4]) scale([0.6, 2.2, 0.8]) sphere(1, $fn = 10);
    translate([8.8 + l * 0.2, 0, 8.4 - l]) sphere(0.25, $fn = 6);
  }
}
// Wisps fraying off the hem.
for (w = [[6, -6, 1.5], [-7, -3, 2], [3, 8, 1], [-4, 7, 2.2], [9, 2, 2.6]]) ell([0.9, 0.9, 0.6], w, cloakDk);

// Hood: a big rounded cowl with a floppy tip falling back to the viewer's right.
color(cloakLt) difference() {
  translate([0, 0.3, 30]) scale([8, 7.5, 7.5]) sphere(1, $fn = 36);
  // Face opening.
  translate([0, -7.6, 29]) scale([5.6, 4, 5.8]) sphere(1, $fn = 28);
}
chain([[0, 2, 36], [2.5, 4.5, 38], [5.5, 6.5, 37], [7.5, 7.5, 35]], [3.2, 2.4, 1.6, 0.8], cloakLt);
// Hood rim.
color(cloakDk) translate([0, -5.8, 29]) rotate([90, 0, 0]) scale([5.8, 6, 1]) rotate_extrude($fn = 32) translate([1, 0]) circle(r = 0.13, $fn = 8);
// Void face inside the hood.
ell([5.2, 3, 5.4], [0, -3.8, 29], void);
// Two round white eyes.
mirror_x() {
  color(eyeW) translate([2.1, -6.6, 29.5]) scale([1.35, 0.6, 1.5]) sphere(1, $fn = 18);
  color([1, 1, 1]) translate([2.4, -7.1, 30]) sphere(0.4, $fn = 10);
}

// Thin twig arms with three-fingered hands.
mirror_x() {
  chain([[6.5, 0, 22], [10, -0.5, 19], [11, -1, 15]], [0.45, 0.4, 0.35], cloakDk);
  for (f = [[-0.8, 0, -2], [0, -0.5, -2.4], [0.8, 0, -2]]) limb([11, -1, 15], [11, -1, 15] + f, 0.3, 0.15, cloakDk);
}
