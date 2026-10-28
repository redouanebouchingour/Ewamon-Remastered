// Vysion: a floating red-and-green synthezoid spirit. A gold gem on its brow and chest, green fins sweeping off its
// head, a golden cape spilling off the shoulders in long ribbons, green clawed hands, and no legs: the waist tapers
// into a curling green wisp tail scattering gold sparks.
include <lib.scad>

red = [0.62, 0.1, 0.18];
redHi = [0.78, 0.2, 0.26];
green = [0.18, 0.4, 0.22];
greenHi = [0.3, 0.55, 0.32];
greenDark = [0.1, 0.24, 0.15];
gold = [1, 0.88, 0.4];
goldDark = [0.96, 0.74, 0.28];
gem = [1, 0.92, 0.45];
claw = [0.62, 0.7, 0.66];

// Torso: V-shaped red chest, green ribbed abdomen, red hips.
blob([[[6.5, 3.8, 4], [0, 0, 31]], [[4, 3, 3], [0, 0, 26]]], red);
color(green) translate([0, -2.4, 25.5]) scale([3, 1.2, 3.2]) sphere(1, $fn = 20);
for (z = [24, 26, 28]) mirror_x() ell([1.2, 0.6, 0.8], [1.3, -3.2, z], greenHi);
mirror_x() blob([[[1.4, 1, 3.6], [4.3, -2.2, 31]], [[1, 0.8, 2], [3, -2.8, 27]]], green);
// Chest gem.
color(gold) translate([0, -3.8, 31.5]) rotate([90, 0, 0]) scale([1, 1.5, 1]) cylinder(h = 0.8, r = 1.1, $fn = 4, center = true);
color(gem) translate([0, -4.3, 31.5]) scale([0.5, 0.4, 0.7]) sphere(1, $fn = 10);
// Hips and the tapering wisp tail.
blob([[[4, 3, 2.6], [0, 0.3, 21]]], red);
blob([[[3.2, 2.6, 3], [0, 0.5, 17]], [[2.2, 2, 2.5], [0.5, 0.6, 13]]], green);
mirror_x() ell([1.3, 1, 2], [1.8, -1.4, 19], red);
chain([[0.5, 0.6, 13], [1.5, 0.2, 9], [0.5, -0.5, 5.5], [-1.5, 0.5, 3], [-3, 1, 3], [-3.5, 1, 5]], [2.2, 1.8, 1.4, 1, 0.7, 0.3], green);
chain([[1, 0.6, 9], [3, 0.2, 6.5], [4.4, 0.5, 6]], [1, 0.6, 0.2], greenHi);
for (sp = [[-5, -1, 3], [4, 0, 2], [6, -1, 4.5], [-6, 0, 7], [-1, -1, 0.6], [2, 1, 1], [5.5, 0, 8], [-4.5, 1, 1.2]])
  color(gold) translate(sp) rotate([30, 20, sp[0] * 13]) cube(0.75, center = true);

// Arms: green upper arms, red shoulders, hanging out to the sides with spread claws.
mirror_x() {
  ell([2.6, 2.4, 2.2], [7, 0, 32.5], red);
  limb([7.5, 0, 31], [9.5, -1, 25], 1.6, 1.4, green);
  ell([1.6, 1.6, 1.6], [9.5, -1, 25], greenDark);
  limb([9.5, -1, 25], [10.5, -2.5, 19], 1.4, 1.3, red);
  color(gold) translate([10.3, -2.3, 20.5]) scale([1.5, 1.5, 0.5]) sphere(1, $fn = 12);
  ell([1.4, 1.2, 1.4], [10.8, -2.8, 18], green);
  for (a = [-40, -15, 10, 35]) chain([[10.8 + sin(a) * 1, -3, 17], [10.8 + sin(a) * 2, -3.6, 15], [10.8 + sin(a) * 2.2, -4.6, 13.2]], [0.45, 0.35, 0.08], claw);
}

// Golden cape: off the shoulders into two broad sweeping wings and long ribbons hanging down the back and sides.
module ribbon(pts, rs, c) {
  for (i = [0 : len(pts) - 2]) color(c) hull() {
    translate(pts[i]) scale([rs[i], 0.35, 1]) sphere(1, $fn = 12);
    translate(pts[i + 1]) scale([rs[i + 1], 0.35, 1]) sphere(1, $fn = 12);
  }
}
mirror_x() {
  // Collar sweep over the shoulder.
  color(gold) hull() {
    translate([4.5, 1, 34.5]) sphere(1.4, $fn = 12);
    translate([10, 1.5, 33]) sphere(1.4, $fn = 12);
    translate([15, 3.5, 28]) sphere(0.6, $fn = 8);
  }
  // Wing-like outer drape.
  ribbon([[10, 2, 33], [15, 3.5, 27], [17, 4.5, 20], [16.5, 5, 13], [15, 5.5, 8]], [2.8, 3, 2.8, 2, 0.6], gold);
  ribbon([[8, 3, 32], [12, 4.5, 24], [12.5, 5.5, 16], [11, 6, 10]], [2.4, 2.6, 2, 0.5], goldDark);
  // Inner back panel.
  ribbon([[3.5, 4, 32], [5, 5.5, 24], [5.5, 6.5, 15], [4.5, 7, 9]], [2.6, 2.8, 2.2, 0.5], gold);
}
ribbon([[0, 4.5, 31], [0, 6, 22], [0.5, 7, 14]], [3, 3, 0.8], goldDark);

// Head: smooth red cowl with a green face plate, gold forehead gem, fins sweeping up and back.
blob([[[3.4, 3.4, 4], [0, -0.5, 39.5]]], red);
color(green) translate([0, -2.4, 38.6]) scale([2.4, 1.6, 2.8]) sphere(1, $fn = 20);
color(red) translate([0, -3.1, 39.6]) scale([1.6, 1, 2.2]) sphere(1, $fn = 16);
color(gold) translate([0, -3.9, 41.4]) rotate([90, 0, 0]) scale([0.9, 1.3, 1]) cylinder(h = 0.7, r = 1, $fn = 4, center = true);
color(gem) translate([0, -4.3, 41.4]) scale([0.4, 0.3, 0.6]) sphere(1, $fn = 10);
// Narrow pale eyes.
mirror_x() color([1, 0.95, 0.75]) translate([1.2, -3.6, 39.8]) rotate([0, -12, -15]) scale([0.75, 0.3, 0.3]) sphere(1, $fn = 10);
// Head fins.
mirror_x() {
  color(green) hull() {
    translate([2.8, -0.5, 40.5]) scale([0.5, 1.4, 1.6]) sphere(1, $fn = 10);
    translate([5.2, 1.5, 45.5]) sphere(0.2, $fn = 6);
  }
  color(greenHi) translate([3.3, -0.4, 41.8]) rotate([0, 25, 0]) scale([0.4, 0.8, 1.6]) sphere(1, $fn = 10);
}
color(green) translate([0, -1.4, 43.2]) rotate([10, 0, 0]) scale([0.9, 1.8, 0.8]) sphere(1, $fn = 12);
// Neck.
limb([0, 0, 35], [0, -0.5, 37], 1.6, 1.6, green);
