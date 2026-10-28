// Zenryu: a white-furred dragon martial artist in baggy blue gi trousers with an orange belt and wraps, a wild
// white mane under a golden crest, red eyes, a thick tail with a fluffy tip, wrapped in cyan wind rings.
include <lib.scad>

fur = [0.9, 0.92, 0.96];
furShade = [0.7, 0.76, 0.88];
mane = [0.94, 0.95, 1];
maneShade = [0.72, 0.78, 0.9];
gi = [0.2, 0.32, 0.62];
giDark = [0.14, 0.22, 0.46];
orange = [0.95, 0.5, 0.12, NOGLOW];
gold = [0.95, 0.75, 0.2];
wind = [0.3, 0.85, 0.9, GLOW];
claw = [0.95, 0.95, 0.95];
eyeC = [0.85, 0.08, 0.1];

// Legs: baggy blue trousers, orange ankle wraps, white clawed feet.
mirror_x() {
  blob([[[3.6, 3.6, 3.6], [3.8, 0, 12]], [[3.2, 3.2, 2.6], [5, -1, 6]]], gi);
  color(giDark) translate([5, -1, 4.2]) scale([2.6, 2.6, 0.8]) sphere(1, $fn = 18);
  color(orange) translate([5.2, -0.8, 3.2]) cylinder(h = 1.6, r = 2.1, center = true, $fn = 20);
  blob([[[2.4, 3.2, 1.4], [5.3, -1.6, 1.4]], [[2, 2, 1.4], [5.3, 0.6, 1.5]]], fur);
  for (a = [-30, 0, 30]) spike([5.3 + sin(a) * 1.4, -4.6, 1], [sin(a) * 0.5, -1.2, -0.4], 0.45, 0.05, claw);
}

// Torso: bare white muscular chest, belt.
blob([[[6.4, 4.4, 5], [0, 0, 22]], [[4.6, 3.6, 3.6], [0, 0, 16]]], fur);
mirror_x() ell([2.8, 1.3, 2.2], [2.4, -3.4, 22.5], [0.96, 0.97, 1]);
for (z = [16.5, 18.5]) mirror_x() ell([1.1, 0.7, 0.8], [1.2, -3.4, z], furShade);
color(orange) translate([0, 0, 15]) scale([5.2, 4.2, 1]) cylinder(h = 2, r = 1, center = true, $fn = 28);
// Belt knot and hanging ends.
ell([1.2, 0.8, 1], [-0.8, -4.3, 15], orange);
limb([-0.8, -4.5, 14.5], [-1.6, -4.8, 10.5], 0.6, 0.45, orange);
limb([-0.4, -4.5, 14.5], [0.4, -4.8, 11], 0.6, 0.45, orange);
// Gi waist top.
blob([[[4.8, 3.8, 1.8], [0, 0, 13]], [[4.4, 3.6, 1.6], [0, 0, 12]]], gi);

// Arms: the viewer-left fist raised to the chin, the viewer-right fist low; orange forearm wraps.
mirror_x() ell([3, 3, 2.8], [6.6, 0, 25], fur);
// raised guard arm (viewer left)
limb([-7, 0, 24.5], [-8.5, -3, 19.5], 2.3, 2, fur);
limb([-8.5, -3, 19.5], [-5.5, -6, 25], 2, 1.8, orange);
ell([2, 2, 2], [-4.8, -6.6, 26.2], fur);
// low arm (viewer right)
limb([7, 0, 24.5], [9, -1, 19], 2.3, 2, fur);
limb([9, -1, 19], [9.6, -3, 14.5], 2, 1.8, orange);
ell([1.9, 1.9, 1.9], [9.8, -3.6, 13.4], fur);

// Head: dragon face with a short muzzle, red eyes under a frown, golden crest.
translate([0, -0.6, 30]) scale(1.2) {
  blob([[[3.6, 3.4, 3.4], [0, 0, 0]], [[2.2, 2.4, 1.6], [0, -3.8, -1]]], fur);
  ell([1.8, 1, 1], [0, -5.4, -0.6], [0.96, 0.97, 1]);
  mirror_x() ell([0.3, 0.25, 0.25], [0.6, -6.3, -0.3], [0.3, 0.3, 0.4]);
  color([0.3, 0.3, 0.4]) translate([0, -5.6, -1.6]) scale([1.4, 0.4, 0.2]) sphere(1, $fn = 10);
  mirror_x() {
    eye([1.6, -2.9, 0.5], 1.0, iris = eyeC, pupil = [0.2, 0, 0], sclera = [1, 1, 1], yaw = -30, flat = 0.35);
    color(furShade) translate([1.8, -3.1, 1.6]) rotate([0, -22, -30]) scale([1.4, 0.5, 0.35]) sphere(1, $fn = 10);
  }
  // Golden crest: a tiara band with three points and two swept horns.
  color(gold) translate([0, -0.6, 2.4]) rotate([-15, 0, 0]) scale([3.4, 3.2, 1]) difference() {
    cylinder(h = 1, r = 1, center = true, $fn = 24);
    cylinder(h = 2, r = 0.8, center = true, $fn = 24);
  }
  for (x = [-1.2, 0, 1.2]) spike([x, -3, 3], [x * 0.3, 0.4, 2.2 - abs(x) * 0.4], 0.55, 0.05, gold);
  mirror_x() chain([[2.6, -1, 2.6], [3.6, 0.5, 4.6], [4, 2, 6.2]], [0.6, 0.45, 0.1], gold);
}
// The mane: a great shaggy white mass of spikes around and behind the head, down the back.
module mane_lock(p, d, r, c) { color(c) hull() { translate(p) sphere(r, $fn = 12); translate(p + d) sphere(0.15, $fn = 6); } }
for (k = [0 : 11]) let(a = -165 + k * 30)
  mane_lock([3 * sin(a), 0.8 + 1.5 * abs(cos(a)), 31.5 + 2.5 * cos(a)], [5.5 * sin(a), 3.5, 4 * cos(a) + 2], 2, k % 2 == 0 ? mane : maneShade);
for (k = [0 : 8]) let(a = -80 + k * 20)
  mane_lock([3 * sin(a), 2.5, 32], [6 * sin(a), 6, -1 + (k % 3)], 2.3, k % 2 == 0 ? mane : maneShade);
for (k = [0 : 7]) let(a = -70 + k * 20)
  mane_lock([4 * sin(a), 3.5, 26], [5 * sin(a), 4, -7], 2.4, k % 2 == 0 ? maneShade : mane);
// Cheek fluff framing the face.
mirror_x() for (i = [0 : 2]) mane_lock([3.2, -2 + i, 30.5 - i * 1.2], [3.2, -1, -1.5 - i * 0.5], 1.5, i % 2 == 0 ? mane : maneShade);
// Shaggy side tufts over the shoulders.
mirror_x() for (i = [0 : 2]) mane_lock([4, 0.5 + i, 28 - i * 1.5], [4.5, -1 + i, -2], 1.8, i % 2 == 0 ? mane : maneShade);

// Thick tail curling out to the viewer's right and up, ending in a fluffy tuft.
chain([[0, 3.5, 12], [5, 6.5, 7], [11, 5, 4.5], [16, 2.5, 8], [17, 1.5, 14], [15.5, 1.5, 19]], [3, 2.8, 2.4, 2, 1.6, 1.3], fur);
for (d = [[0, 0, 4.5], [2.5, 0, 3.5], [-2, 0.5, 3.5], [1, 1.5, 4], [3.5, -0.5, 1.5]]) mane_lock([15.5, 1.5, 19], d, 1.6, mane);

// Cyan wind rings swirling around the body.
for (r = [[22, 12.5, 8], [13, 13, -7], [5, 11.5, 5]])
  color(wind) translate([0, 0, r[0]]) rotate([r[2], 4, 0]) scale([1, 0.85, 1]) rotate_extrude($fn = 40) translate([r[1], 0]) scale([1, 0.4]) circle(1.2, $fn = 6);
