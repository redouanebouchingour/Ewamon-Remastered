// Joeyjab: a young kangaroo boxer: tan fur, cream belly and muzzle, a white headband knotted at the side and two
// big red boxing gloves held up in guard.
include <lib.scad>

fur = [0.8, 0.52, 0.24];
furDk = [0.66, 0.4, 0.17];
cream = [0.98, 0.88, 0.62];
earIn = [0.98, 0.8, 0.6];
band = [0.97, 0.96, 0.92];
glove = [0.82, 0.14, 0.1];
gloveHi = [0.92, 0.25, 0.18];
nose = [0.1, 0.07, 0.06];

// Torso: a pear leaning slightly forward, cream belly.
blob([[[6.2, 5.6, 6.5], [0, 0.5, 12.5]], [[4.6, 4.2, 4.6], [0, -0.4, 19.5]]], fur);
blob([[[4.4, 3, 5.4], [0, -2.8, 12.5]], [[3, 2.6, 3.4], [0, -2.8, 18.5]]], cream);

// Head: big and round with a pointed muzzle.
ell([6.2, 5.6, 5.6], [0, -1, 26.5], fur);
blob([[[3.4, 3, 2.6], [0, -5, 24.8]], [[1.6, 1.6, 1.4], [0, -8, 24.6]]], fur);
blob([[[3, 2.4, 1.8], [0, -5.6, 23.6]], [[1.4, 1.4, 1], [0, -7.6, 23.8]]], cream);
ell([1, 0.8, 0.7], [0, -9.3, 25.2], nose);
// Smile.
color(nose) translate([0, -7.6, 23.2]) rotate([0, 90, 0]) rotate_extrude(angle = 360, $fn = 6) translate([1.2, 0]) circle(0.14, $fn = 4);
// Big shiny eyes.
mirror_x() eye([3, -5.2, 27.2], 1.6, iris = [0.12, 0.08, 0.06], yaw = -28);

// Long upright ears.
mirror_x() {
  petal([2.2, 1.1, 5.8], [3.4, 0.4, 35], [0, 14, 0], fur);
  petal([1.1, 0.6, 4.2], [3.5, -0.4, 35], [0, 14, 0], earIn);
}

// White headband round the forehead, knot and two tails on the viewer's right.
color(band) translate([0, -1, 29.2]) rotate([-8, 0, 0]) scale([5.75, 5.25, 1]) cylinder(h = 2, r1 = 1.04, r2 = 0.94, center = true, $fn = 32);
ell([1.2, 1, 1.1], [5.6, -0.6, 29.4], band);
color(band) hull() { translate([6.6, -0.6, 29.6]) sphere(0.6, $fn = 8); translate([10, 0.4, 31]) scale([0.4, 0.4, 1]) sphere(1, $fn = 8); }
color(band) hull() { translate([6.6, -0.6, 29.6]) sphere(0.6, $fn = 8); translate([10.2, 0.6, 27.6]) scale([0.4, 0.4, 1]) sphere(1, $fn = 8); }

// Arms up in guard, ending in big red gloves in front of the chest.
mirror_x() {
  limb([4.4, 0, 19.5], [5.6, -3.5, 16], 1.4, 1.2, fur);
  limb([5.6, -3.5, 16], [5, -6.5, 20], 1.2, 1.1, fur);
  color(band) translate([5, -6.6, 20]) rotate([-60, 0, 0]) cylinder(h = 1.2, r = 1.6, center = true, $fn = 16);
  ell([3.2, 3, 3.3], [5.2, -8.4, 21.6], glove);
  ell([1.3, 1.3, 1.2], [3.2, -9.4, 21], gloveHi);
}

// Legs: big kangaroo haunches, long cream-tipped feet.
mirror_x() {
  ell([3.4, 4.6, 5], [4.6, 1.2, 8], fur);
  limb([4.8, 2, 5], [5, 1.4, 1.6], 1.6, 1.3, fur);
  blob([[[1.8, 3.6, 1.2], [5, -1.6, 1.2]], [[1.4, 1.4, 1.2], [5, 1, 1.4]]], fur);
  ell([1.7, 1.6, 1.1], [5, -4.4, 1.1], cream);
}

// Thick tail curving out behind and up.
chain([[0, 4.5, 9], [2, 9, 5.5], [6, 12, 6.5], [9, 12.5, 10], [10, 11.5, 15]], [3.2, 2.6, 2, 1.4, 0.7], fur);
