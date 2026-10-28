// Veilpup: a navy wolf pup with a wild white mane, a black blindfold over one glowing blue eye, a purple ruff with a
// red gem, and a white-tipped brush tail; red and blue wisps flicker at its claws.
include <lib.scad>

fur = [0.17, 0.19, 0.33];
furHi = [0.25, 0.27, 0.44];
head = [0.3, 0.32, 0.42];
mane = [0.92, 0.92, 0.98];
maneShade = [0.72, 0.72, 0.88];
mask = [0.08, 0.08, 0.12];
ruff = [0.33, 0.24, 0.48];
gem = [0.75, 0.1, 0.15];
glow = [0.2, 0.75, 1];
wispRed = [0.9, 0.2, 0.3];
claw = [0.9, 0.9, 0.95];

// Torso: pot belly, wide hips.
blob([[[8, 6.5, 7], [0, 0, 9]], [[6.5, 5.5, 5.5], [0, -0.5, 15]]], fur);
ell([5, 2.4, 5], [0, -5, 11], furHi);

// Legs with clawed feet.
mirror_x() {
  ell([3.6, 3.8, 4.2], [4.8, 0, 5], fur);
  blob([[[2.8, 4, 1.6], [5, -2.4, 1.6]], [[2.4, 2, 1.4], [5, 0.6, 1.5]]], fur);
  for (a = [-28, 0, 28]) spike([5 + sin(a) * 1.6, -6, 1], [sin(a) * 0.5, -1.3, -0.4], 0.45, 0.05, claw);
}

// Ruff collar with a red gem.
for (a = [-150 : 25 : 150]) spike([6 * sin(a), -5.5 * cos(a), 19], [sin(a) * 3, -cos(a) * 3, -4], 2.2, 0.1, ruff);
blob([[[7, 6, 2.4], [0, 0, 18.5]]], ruff);
ell([1.5, 1, 1.5], [0, -7.6, 16.8], gem);

// Arms held out, claws open, wisps over the paws.
mirror_x() {
  limb([5.5, -1, 17], [10, -4, 13], 2, 1.6, fur);
  ell([2, 1.8, 1.6], [10.6, -4.6, 12.6], fur);
  for (a = [-35, 0, 35]) spike([10.6 + sin(a) * 1.2, -6, 12.5], [sin(a) * 0.6, -1.2, 0.4], 0.4, 0.05, claw);
}
module wisp(p, c) {
  color(c) hull() { translate(p) sphere(0.6); translate(p + [0.3, 0, 3]) sphere(0.1); }
}
wisp([-11, -5, 14], wispRed); wisp([-10, -5.5, 14.5], glow); wisp([-12, -4.5, 14.3], glow);
wisp([11, -5, 14], glow); wisp([10, -5.5, 14.5], wispRed);

// Head: round skull with a short snout, tall pointed ears.
module skull(k = 1) {
  blob([[[6.5 * k, 6 * k, 5.8 * k], [0, -0.5, 24]], [[4.5 * k, 4.5 * k, 4.2 * k], [0, -4, 23]], [[3 * k, 3 * k, 2.3 * k], [0, -8, 21.8]]], head);
}
skull();
ell([1.1, 0.9, 0.9], [0, -13.2, 22.4], mask);
// Grin with a fang.
color(mask) translate([0, -11.5, 20.4]) scale([2.2, 1, 0.4]) sphere(1, $fn = 14);
spike([0.9, -12.1, 20.4], [0, 0, -1.1], 0.35, 0.05, claw);
// Blindfold: a band of the skull grown a little, between two heights.
color(mask) intersection() {
  skull(1.07);
  translate([0, -2, 24.8]) cube([20, 20, 3], center = true);
}
ell([2, 1.6, 1.6], [6.4, 2.5, 24.8], mask); // knot
mirror_x() petal([1, 2.6, 0.6], [6.6, 4.5, 23.5], [30, 0, 10], mask);
// The one eye glowing through the band.
eye([-2.6, -7.5, 24.8], 1.7, iris = glow, sclera = [0.5, 0.9, 1], pupil = [0.05, 0.2, 0.4], yaw = 20);
// Muzzle pushing out under the band.
blob([[[3, 3, 2.3], [0, -8, 21.6]], [[2.2, 2.4, 1.8], [0, -11, 21.6]]], [0.42, 0.44, 0.54]);
mirror_x() {
  color(head) hull() { petal([1.8, 0.9, 1], [5, 0, 29], [0, 0, 0], head); spike([5.4, 0, 29], [1.6, 0, 6], 0.4, 0.05, head); }
  petal([0.9, 0.4, 2.4], [5.4, -0.8, 31], [0, -10, 0], mask);
}

// Wild mane: a mass over and behind the skull, flame-like tufts sweeping up and back, a few down to the shoulders.
module tuft(p, d, r, c) {
  // Two capsules: out along d, then curling upward at the tip.
  m = p + d * 0.55;
  color(c) let($fn = 12) {
    hull() { translate(p) sphere(r); translate(m) sphere(r * 0.6); }
    hull() { translate(m) sphere(r * 0.6); translate(m + d * 0.45 + [0, 0, norm(d) * 0.18]) sphere(0.15); }
  }
}
blob([[[7, 6, 5.5], [0, 2.5, 28]], [[7.5, 5.5, 6], [0, 6, 22]], [[6, 4, 4], [0, 6, 17]]], mane);
manes = [[0, 70, 11], [30, 60, 12], [-30, 60, 12], [65, 45, 13], [-65, 45, 13], [95, 30, 13], [-95, 30, 13],
         [125, 25, 13], [-125, 25, 13], [155, 30, 12], [-155, 30, 12], [180, 45, 12], [180, 15, 12],
         [110, 0, 11], [-110, 0, 11], [140, -5, 11], [-140, -5, 11], [165, -15, 11], [-165, -15, 11],
         [120, -30, 9], [-120, -30, 9], [180, -35, 10], [45, 20, 10], [-45, 20, 10]];
for (i = [0 : len(manes) - 1]) {
  m = manes[i];
  az = m[0]; el = m[1]; l = m[2];
  d = [sin(az) * cos(el), -cos(az) * cos(el), sin(el)] * l;
  tuft([0, 3, 25] + d * 0.35, d * 0.9, 2.6, i % 3 == 1 ? maneShade : mane);
}

// Brush tail: dark base, white plume tip, curling up to the viewer's right.
chain([[3, 5, 7], [9, 9, 6], [13, 11, 9]], [2.4, 3.2, 3.6], fur);
tuft([10, 9.5, 6], [3, 2, -3], 2, fur);
tuft([12, 10.5, 8], [4, 1, -2], 2, fur);
blob([[[4, 4, 4], [14.5, 11.5, 13]], [[2.6, 2.6, 3], [15, 11, 17]]], mane);
tuft([15, 11, 17], [0.5, 0, 6], 2, mane);
tuft([14, 11.5, 16], [-3.5, 0.5, 4], 1.8, mane);
tuft([16, 11.5, 15], [4.5, 0.5, 2], 1.8, maneShade);
tuft([16.5, 11, 13], [4, 0, -1], 1.6, mane);
