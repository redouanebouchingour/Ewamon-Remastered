// Blizzhowl: Shiveruff grown into a lean white fox with a bristling ice-blue ruff, frosted ears,
// a fan of seven feathery blue tails and navy socks.
include <lib.scad>

fur = [0.93, 0.95, 1];
furBlue = [0.72, 0.8, 0.97];
tailBlue = [0.45, 0.58, 0.94];
tailPale = [0.7, 0.78, 0.98];
ruff = [0.45, 0.78, 0.96];
ruffDark = [0.25, 0.6, 0.92];
ice = [0.55, 0.82, 0.98];
paw = [0.13, 0.17, 0.5];
mouth = [0.75, 0.15, 0.2];
nose = [0.1, 0.12, 0.25];

// Body: longer and leaner than the pup.
blob([[[5.6, 6, 5.8], [0, -3, 12]], [[5.2, 6, 5.2], [0, 6, 11.5]]], fur);
ell([4.8, 8, 3], [0, 1, 7.5], furBlue);

// Long legs with navy socks and fur flicks.
module leg(x, y) {
  limb([x, y, 11], [x, y - 0.4, 5], 2.3, 1.9, fur);
  limb([x, y - 0.4, 5.6], [x, y - 0.8, 1.2], 2.1, 2.1, paw);
  ell([2.3, 3, 1.3], [x, y - 1.5, 1.3], paw);
  spike([x, y - 2, 6.4], [0, -0.3, -1.8], 1, 0.1, fur);
}
mirror_x() { leg(3.4, -5.5); leg(3.4, 9.5); }

module tail(yaw, pitch, len, c) {
  translate([0, 11, 17]) rotate([0, 0, yaw]) rotate([pitch, 0, 0]) {
    color(c) hull() {
      translate([0, 3, 0]) scale([2.2, 2.6, 2]) sphere(1, $fn = 16);
      translate([0, len * 0.55, 0]) scale([5, 5, 3.2]) sphere(1, $fn = 18);
      translate([0, len, 0]) sphere(0.3);
    }
    spike([0, len * 0.7, 2.4], [0, len * 0.3, -1.6], 2.2, 0.1, fur);
  }
}

// Everything above the legs sits 3 lower (shorter legs).
translate([0, 0, -3]) {

// Ruff: a thick bristling collar.
ell([7, 6, 5], [0, -6.5, 20], ruff);
ell([5.5, 3.5, 5.5], [0, -10, 17.5], ruff);
for (a = [0 : 22.5 : 359]) {
  d = [cos(a), sin(a) * 0.85, 0];
  spike([0, -6.5, 20] + d * 5.8, d * 3.6 + [0, 0, -2.8], 1.9, 0.15, (a / 22.5) % 2 == 0 ? ruff : ruffDark);
}
for (x = [-4.5 : 2.25 : 4.5]) spike([x, -11.5, 16], [x * 0.15, -1, -4.2], 1.5, 0.15, round(x / 2.25) % 2 == 0 ? ruffDark : ruff);

// Head: a fox head with a pointed muzzle.
ell([7.2, 6.6, 6.4], [0, -9, 27], fur);
blob([[[3.4, 2.6, 2.6], [0, -13, 25.6]], [[1.6, 1.6, 1.5], [0, -17, 25.4]]], fur);
ell([1, 0.7, 0.8], [0, -18.4, 25.9], nose);
color(mouth) translate([0, -16, 23.9]) scale([1.8, 2, 0.9]) sphere(1, $fn = 18);
mirror_x() spike([0.9, -17.3, 24.5], [0, 0, -0.8], 0.3, 0.05, "white");
// Narrowed blue eyes.
mirror_x() {
  eye([3.1, -14.9, 27.6], 1.8, iris = [0.2, 0.5, 0.92], pupil = [0.05, 0.1, 0.3], yaw = -24, flat = 0.4);
  color(fur) translate([3.1, -15.3, 29.3]) rotate([0, -15, -24]) scale([2.1, 0.6, 0.45]) sphere(1, $fn = 14);
}
// Cheek tufts.
mirror_x() for (z = [24, 26.5]) spike([5.4, -10, z], [3, 0.5, -0.6], 1.5, 0.1, fur);

// Tall ears, blue frosted rims with ice tufts.
mirror_x() {
  color(fur) hull() {
    translate([3.6, -8, 31]) scale([1.2, 0.7, 1]) sphere(2.6);
    translate([5, -8, 39.5]) sphere(0.4);
  }
  color(ruffDark) hull() {
    translate([3.7, -9.6, 31.5]) scale([0.7, 0.3, 0.8]) sphere(1.8);
    translate([4.9, -8.6, 37.5]) sphere(0.3);
  }
  spike([5.6, -7.5, 31], [3.5, 1, 3], 1.1, 0.1, ice);
  spike([5.8, -7, 29.5], [4, 1.5, 1], 1, 0.1, ruff);
}
// Crown tuft.
spike([0, -11.5, 32], [0, -1.5, 2.6], 1.4, 0.1, fur);

// Seven feathery tails fanned out behind and up: white roots, blue bodies, pale tips.
tail(0, 62, 22, tailBlue);
tail(-30, 50, 21, tailPale);
tail(30, 50, 21, tailPale);
tail(-55, 30, 20, tailBlue);
tail(55, 30, 20, tailBlue);
tail(-78, 6, 17, tailPale);
tail(78, 6, 17, tailPale);
ell([3.2, 3.2, 3], [0, 11.5, 17], fur);
}
