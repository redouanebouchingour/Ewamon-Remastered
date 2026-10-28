// Zenryu (Majin): the powered-up form. The white mane turns into a towering golden spiked mane, the tail tuft goes
// gold, a red mark glows on the brow, both fists clench low and cyan sparks crackle instead of wind rings.
include <lib.scad>

fur = [0.9, 0.92, 0.96];
furShade = [0.7, 0.76, 0.88];
mane = [1, 0.85, 0.2, GLOW];
maneShade = [0.95, 0.68, 0.12];
gi = [0.2, 0.32, 0.62];
giDark = [0.14, 0.22, 0.46];
orange = [0.95, 0.5, 0.12, NOGLOW];
gold = [0.5, 0.32, 0.15];
wind = [0.3, 0.85, 0.9];
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

// Arms: both fists clenched low and out from the hips, orange forearm wraps.
mirror_x() {
  ell([3, 3, 2.8], [6.6, 0, 25], fur);
  limb([7, 0, 24.5], [9.5, -1, 19.5], 2.3, 2, fur);
  limb([9.5, -1, 19.5], [10.6, -2.5, 15.5], 2, 1.8, orange);
  ell([2, 2, 2], [10.9, -3, 14.3], fur);
}

// Head: dragon face with a short muzzle, red eyes under a frown, golden crest.
translate([0, -0.6, 30]) scale(1.2) {
  blob([[[3.6, 3.4, 3.4], [0, 0, 0]], [[2.2, 2.4, 1.6], [0, -3.8, -1]]], fur);
  ell([1.8, 1, 1], [0, -5.4, -0.6], [0.96, 0.97, 1]);
  mirror_x() ell([0.3, 0.25, 0.25], [0.6, -6.3, -0.3], [0.3, 0.3, 0.4]);
  color([0.3, 0.3, 0.4]) translate([0, -5.6, -1.6]) scale([1.4, 0.4, 0.2]) sphere(1, $fn = 10);
  // Eyes sunk in dark sockets under a hard white brow that scowls down to the snout.
  mirror_x() {
    ell([1.5, 0.45, 1.35], [1.65, -2.6, 0.45], [0.2, 0.22, 0.32]);
    eye([1.7, -3, 0.4], 1.3, iris = [0.15, 0.95, 0.7, GLOW], pupil = [0.12, 0, 0], sclera = [0.25, 0.25, 0.32], yaw = -14, flat = 0.4,
        lid = 0.42, lid_tilt = 32, lid_c = furShade, slit = 0.4, squint = 0.1);
    color(fur) hull() {
      translate([0.45, -3.5, 1.05]) scale([0.45, 0.45, 0.38]) sphere(1, $fn = 12);
      translate([1.7, -3.25, 1.7]) scale([0.85, 0.55, 0.42]) sphere(1, $fn = 12);
      translate([2.9, -2.2, 2.1]) scale([0.55, 0.55, 0.42]) sphere(1, $fn = 12);
    }
    // a fang off the upper jaw
    spike([0.9, -5.4, -1.4], [0, -0.1, -0.9], 0.25, 0.04, claw);
  }
  // Red brow mark.
  color([0.85, 0.12, 0.12]) translate([0, -3.2, 1.9]) rotate([-60, 0, 0]) difference() { cylinder(h = 0.4, r = 0.75, center = true, $fn = 16); cylinder(h = 1, r = 0.4, center = true, $fn = 12); }
  // Golden crest: a tiara band with three points and two swept horns.
  color(gold) translate([0, -0.6, 2.4]) rotate([-15, 0, 0]) scale([3.4, 3.2, 1]) difference() {
    cylinder(h = 1, r = 1, center = true, $fn = 24);
    cylinder(h = 2, r = 0.8, center = true, $fn = 24);
  }
  for (x = [-1.2, 0, 1.2]) spike([x, -3, 3], [x * 0.3, 0.4, 2.2 - abs(x) * 0.4], 0.55, 0.05, gold);
  mirror_x() chain([[2.6, -1, 2.6], [3.6, 0.5, 4.6], [4, 2, 6.2]], [0.6, 0.45, 0.1], gold);
}
// The mane: a towering mass of long golden spikes sweeping up and back, falling down the back.
module mane_lock(p, d, r, c) { color(c) hull() { translate(p) sphere(r, $fn = 12); translate(p + d) sphere(0.15, $fn = 6); } }
for (k = [0 : 10]) let(a = -150 + k * 30)
  mane_lock([3 * sin(a), 1 + 1.5 * abs(cos(a)), 32.5 + 2 * cos(a)], [6 * sin(a), 3.5, 6 + 4 * cos(a)], 2.2, k % 2 == 0 ? mane : maneShade);
for (k = [0 : 8]) let(a = -80 + k * 20)
  mane_lock([3 * sin(a), 3, 33], [6.5 * sin(a), 7, 3 + (k % 3) * 2], 2.6, k % 2 == 0 ? mane : maneShade);
for (k = [0 : 9]) let(a = -90 + k * 20)
  mane_lock([4.5 * sin(a), 3.5, 28], [6 * sin(a), 5, -12 + (k % 2) * 3], 2.8, k % 2 == 0 ? maneShade : mane);
// Cheek fluff framing the face.
mirror_x() for (i = [0 : 2]) mane_lock([3.2, -2 + i, 30.5 - i * 1.2], [3.2, -1, -1.5 - i * 0.5], 1.5, i % 2 == 0 ? mane : maneShade);
// Shaggy side tufts over the shoulders.
mirror_x() for (i = [0 : 2]) mane_lock([4, 0.5 + i, 28 - i * 1.5], [4.5, -1 + i, -2], 1.8, i % 2 == 0 ? mane : maneShade);

// Thick tail curling out to the viewer's right and up, ending in a fluffy tuft.
chain([[0, 3.5, 12], [5, 6.5, 7], [11, 5, 4.5], [16, 2.5, 8], [17, 1.5, 14], [15.5, 1.5, 19]], [3, 2.8, 2.4, 2, 1.6, 1.3], fur);
for (d = [[0, 0, 4.5], [2.5, 0, 3.5], [-2, 0.5, 3.5], [1, 1.5, 4], [3.5, -0.5, 1.5]]) mane_lock([15.5, 1.5, 19], d * 1.4, 2.2, mane);

// Tail detail: a shaggy crest of fur tufts along its top and pale-blue belly plates underneath.
tailPts = [[0, 3.5, 12], [5, 6.5, 7], [11, 5, 4.5], [16, 2.5, 8], [17, 1.5, 14]];
tailR = [3, 2.8, 2.4, 2, 1.6];
for (i = [0 : 3]) for (f = [0.25, 0.75]) let(t = tailPts[i] * (1 - f) + tailPts[i + 1] * f, r = tailR[i] * (1 - f) + tailR[i + 1] * f)
  mane_lock(t + [0, r * 0.75, r * 0.45], [0.4, 2, 1.3], r * 0.45, f < 0.5 ? furShade : fur);
for (i = [0 : 3]) let(t = (tailPts[i] + tailPts[i + 1]) / 2, r = (tailR[i] + tailR[i + 1]) / 2)
  color(furShade) translate(t + [0, -r * 0.55, -r * 0.45]) scale([r * 0.75, r * 0.6, r * 0.55]) sphere(1, $fn = 10);
// Gi trouser creases and claws on the fists.
mirror_x() for (i = [0 : 2]) color(giDark) translate([4.2 + i * 0.6, -3.3 + i * 0.1, 8.5 + i * 1.6]) rotate([0, 25 - i * 10, 20]) scale([1.6, 0.25, 0.25]) sphere(1, $fn = 8);
// Cyan sparks crackling around the body.
for (p = [[-12, -1, 24], [12, -1, 22], [-11, 0, 12], [9, -3, 8], [-6, -5, 30], [6, 4, 30]])
  chain([p, p + [0.8, 0, 1.2], p + [-0.3, 0, 2], p + [0.6, 0, 3.2]], [0.25, 0.25, 0.25, 0.1], wind);
