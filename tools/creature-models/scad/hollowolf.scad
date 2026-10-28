// Hollowolf: Veilpup grown into a lean, upright werewolf. Same navy fur, black blindfold with one glowing blue eye and
// wild white mane (now flowing down its back), a tall purple collar with a red gem, digitigrade legs, a big brush tail
// with a frosted white-blue tip, and three orbs (red, void purple, blue) circling its raised claw.
include <lib.scad>

fur = [0.15, 0.16, 0.28];
furHi = [0.22, 0.24, 0.4];
head = [0.28, 0.3, 0.4];
muzzle = [0.4, 0.42, 0.52];
mane = [0.92, 0.92, 0.98];
maneShade = [0.72, 0.72, 0.88];
mask = [0.08, 0.08, 0.12];
ruff = [0.3, 0.22, 0.46];
ruffDark = [0.2, 0.16, 0.34];
gem = [0.75, 0.1, 0.15];
glow = [0.2, 0.75, 1];
frost = [0.55, 0.8, 1];
orbRed = [0.6, 0.06, 0.12];
orbVoid = [0.35, 0.15, 0.6];
claw = [0.9, 0.9, 0.95];

module tuft(p, d, r, c) {
  m = p + d * 0.55;
  color(c) let($fn = 12) {
    hull() { translate(p) sphere(r); translate(m) sphere(r * 0.6); }
    hull() { translate(m) sphere(r * 0.6); translate(m + d * 0.45 + [0, 0, norm(d) * 0.18]) sphere(0.15); }
  }
}

// Torso: lean chest over a narrow waist and hips.
blob([[[5.5, 4.5, 4.5], [0, 0.5, 17]], [[6.5, 5, 5], [0, 0, 22]], [[7, 5.5, 4], [0, 0.5, 25]]], fur);
ell([4, 2, 4], [0, -4.4, 22], furHi);
blob([[[6, 5, 3.5], [0, 0.5, 15]]], fur);

// Digitigrade legs: thigh, shin back, long foot forward with claws.
mirror_x() {
  limb([4, 0.5, 14.5], [5.5, -2.5, 9], 3.2, 2.4, fur);
  limb([5.5, -2.5, 9], [6, 1.5, 4], 2.2, 1.6, fur);
  limb([6, 1.5, 4], [6.2, -1.5, 1.2], 1.6, 1.4, fur);
  blob([[[2.2, 3, 1.2], [6.2, -2.8, 1.2]]], fur);
  for (a = [-28, 0, 28]) spike([6.2 + sin(a) * 1.3, -5.5, 0.9], [sin(a) * 0.5, -1.3, -0.4], 0.4, 0.05, claw);
}

// Tall collar: a purple funnel with a jagged hem over the chest, and the red gem.
color(ruff) hull() {
  translate([0, 0.5, 30]) scale([4.4, 4, 1]) sphere(1, $fn = 24);
  translate([0, 0.5, 26]) scale([7.5, 6, 1.5]) sphere(1, $fn = 24);
}
for (a = [-160 : 20 : 160]) spike([7 * sin(a), 0.5 - 5.6 * cos(a), 25.5], [sin(a) * 1.5, -cos(a) * 1.5, -4.5], 1.8, 0.1, a % 40 == 0 ? ruff : ruffDark);
ell([1.4, 0.9, 1.4], [0, -6, 25.5], gem);

// Arms: the right (+X) hand rests on the hip, the left (-X) is raised with spread claws.
limb([6.5, 0.5, 26], [8.5, 0, 20], 2, 1.7, fur);
limb([8.5, 0, 20], [7, -2.5, 16.5], 1.7, 1.5, fur);
ell([1.8, 1.6, 1.6], [6.6, -3, 16], fur);
for (a = [-30, 0, 30]) spike([6.6 + sin(a) * 1.2, -4.4, 15.6], [sin(a) * 0.5, -1.2, -0.5], 0.4, 0.05, claw);
limb([-6.5, 0.5, 26], [-10.5, -1, 22], 2, 1.7, fur);
limb([-10.5, -1, 22], [-11.5, -3, 28], 1.7, 1.5, fur);
ell([1.8, 1.4, 2], [-11.6, -3.2, 29.5], fur);
for (a = [-40, -15, 10, 35]) spike([-11.6 + sin(a) * 1.4, -3.2, 31], [sin(a) * 1.4, -0.4, 3], 0.45, 0.05, claw);

// Orbs drifting beside the raised claw.
ell([1.8, 1.8, 1.8], [-15, -4, 31], orbRed);
ell([1.1, 1.1, 1.1], [-15, -4.8, 31.2], [0.85, 0.2, 0.25]);
ell([2, 2, 0.8], [-16, -4, 26.5], orbVoid);
ell([0.9, 0.9, 0.9], [-16, -4, 26.6], [0.05, 0.02, 0.1]);
ell([1.6, 1.6, 1.6], [-13.5, -5, 22.5], glow);
ell([0.9, 0.9, 0.9], [-13.5, -6, 22.8], [0.7, 0.95, 1]);

// Head: wolf skull with a long muzzle.
module skull(k = 1) {
  blob([[[5, 5, 4.6] * k, [0, -0.5, 35]], [[3.6, 3.8, 3.4] * k, [0, -4, 34]], [[2.4, 2.6, 2] * k, [0, -7.5, 33]]], head);
}
skull();
blob([[[2.4, 2.6, 1.8], [0, -7.8, 32.6]], [[1.8, 2, 1.4], [0, -10.6, 32.8]]], muzzle);
ell([1, 0.8, 0.8], [0, -12.6, 33.4], mask);
color(mask) translate([0, -11, 31.6]) scale([1.8, 1.2, 0.35]) sphere(1, $fn = 14);
mirror_x() spike([0.8, -11.4, 31.6], [0, 0, -1], 0.3, 0.05, claw);
// Blindfold.
color(mask) intersection() {
  skull(1.08);
  translate([0, -2, 35.6]) cube([20, 30, 2.6], center = true);
}
ell([1.6, 1.4, 1.4], [5, 2, 35.8], mask);
eye([-2.2, -6.2, 35.6], 1.4, iris = glow, sclera = [0.5, 0.9, 1], pupil = [0.05, 0.2, 0.4], yaw = 22);
// Tall pointed ears poking out of the mane.
mirror_x() {
  color(head) hull() { petal([1.6, 0.9, 1], [3.6, 0, 39], [0, 0, 0], head); spike([3.8, 0, 39], [1.6, 0.5, 6.5], 0.4, 0.05, head); }
  petal([0.8, 0.4, 2.4], [4.2, -0.8, 41], [0, -12, 0], mask);
}

// Mane: a crown over the skull, then a long white cascade down the back to the hips.
blob([[[5.5, 5, 4.5], [0, 2.5, 38]], [[7, 5, 6], [0, 5.5, 31]], [[6, 4, 6], [0, 6, 23]], [[3.5, 3, 3], [0, 6, 17]]], mane);
manes = [[0, 70, 9], [30, 60, 10], [-30, 60, 10], [65, 45, 11], [-65, 45, 11], [95, 30, 11], [-95, 30, 11],
         [125, 25, 11], [-125, 25, 11], [155, 35, 10], [-155, 35, 10], [180, 50, 10], [180, 15, 11],
         [110, 0, 10], [-110, 0, 10], [140, -5, 10], [-140, -5, 10]];
for (i = [0 : len(manes) - 1]) {
  m = manes[i];
  az = m[0]; el = m[1]; l = m[2];
  d = [sin(az) * cos(el), -cos(az) * cos(el), sin(el)] * l;
  tuft([0, 3, 36] + d * 0.3, d * 0.9, 2.3, i % 3 == 1 ? maneShade : mane);
}
// Locks flowing down the back.
for (i = [0 : 6]) {
  x = (i - 3) * 2.3;
  tuft([x, 8.5, 31 - abs(i - 3) * 0.8], [x * 0.6, 5, -11 - (i % 2) * 3], 2.4, i % 2 == 0 ? mane : maneShade);
  tuft([x * 0.8, 9.5, 24 - abs(i - 3) * 0.6], [x * 0.5, 4, -9], 2, i % 2 == 1 ? mane : maneShade);
}

// Brush tail: dark and bushy, sweeping out to the viewer's right and curling up into a frosted white-blue tip.
chain([[2.5, 5, 15], [9, 8, 9], [15, 9, 8], [21, 8, 12], [23, 7, 17]], [2.2, 3.4, 4, 4, 3.6], fur);
tuft([9, 8, 8], [3, 2, -4], 2.2, fur);
tuft([14, 9, 6.5], [4, 1, -3], 2.4, fur);
tuft([20, 8.5, 10], [4, 0.5, -2], 2.2, fur);
blob([[[3.8, 3.6, 3.6], [23.5, 7, 20.5]], [[2.6, 2.6, 3], [24, 7, 24]]], frost);
tuft([24, 7, 25], [0.5, 0, 7], 2.2, mane);
tuft([23, 7.5, 24], [-3.5, 0.5, 5.5], 1.9, mane);
tuft([25, 7.5, 23], [4.5, 0.5, 4], 1.9, frost);
tuft([25, 6.5, 21], [4.5, -0.5, 1], 1.7, mane);
