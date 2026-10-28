// Wickling: a little candle ghost of pale wax with one big blue eye, tan wax drips running down from its rim, stubby
// arms, a wavy hem, and a blue-violet ghost flame burning from the wick on top.
include <lib.scad>

wax = [0.88, 0.94, 0.95];
waxShade = [0.72, 0.8, 0.84];
drip = [0.82, 0.72, 0.56];
dripLight = [0.92, 0.84, 0.7];
eyeRing = [0.45, 0.52, 0.66];
iris = [0.3, 0.38, 0.55];
flameViolet = [0.45, 0.3, 0.85];
flameBlue = [0.3, 0.55, 0.95];
flameCyan = [0.4, 0.9, 0.95];
flameCore = [0.8, 1, 1];
shard = [0.5, 0.75, 0.95];

// Body: a squat dome over a skirt that flares slightly, bottom hem of rounded lobes.
blob([[[11.4, 10.8, 11], [0, 0, 14]], [[9.6, 9, 3], [0, 0, 6]]], wax);
for (a = [0 : 40 : 359]) ell([3.2, 3, 3], [9 * sin(a), -8.4 * cos(a), 4.6 + (a % 80 == 0 ? -0.9 : 0.5)], a > 100 && a < 260 ? waxShade : wax);
// Flat wax top with a recessed pool and the wick.
ell([7.6, 7.2, 1.6], [0, 0, 24.6], wax);
ell([5.4, 5, 0.8], [0, 0, 25.6], waxShade);
limb([0, 0, 25], [0, 0, 27.5], 0.5, 0.4, [0.2, 0.2, 0.25]);

// Drips: a rim band with runs down the sides, longer at the front.
color(drip) translate([0, 0, 23.6]) scale([8.8, 8.4, 2]) sphere(1, $fn = 32);
// Each drip hugs the dome: [azimuth, length in degrees of elevation].
function dome(az, el) = [11.6 * cos(el) * sin(az), -11 * cos(el) * cos(az), 14 + 11.2 * sin(el)];
for (d = [[-75, 30], [10, 26], [55, 40], [-125, 22], [100, 18], [-170, 30], [150, 22]]) {
  az = d[0]; len = d[1];
  color(drip) hull() { translate(dome(az, 55)) sphere(2.4, $fn = 10); translate(dome(az, 55 - len)) sphere(1.6, $fn = 10); }
  color(dripLight) translate(dome(az, 55 - len) + [0, 0, -0.5]) sphere(1.7, $fn = 10);
}

// One big eye on the front, slightly to the viewer's left.
translate([-5.8, -9.4, 15]) rotate([0, 0, -32]) {
  color(eyeRing) scale([4.8, 1.6, 4.8]) sphere(1, $fn = 28);
  color([0.95, 0.97, 1]) translate([0, -0.4, 0]) scale([4.1, 1.5, 4.1]) sphere(1, $fn = 28);
  color(iris) translate([0, -0.9, 0]) scale([3.1, 1.3, 3.1]) sphere(1, $fn = 24);
  color([0.08, 0.1, 0.18]) translate([0, -1.4, 0]) scale([1.8, 1, 1.8]) sphere(1, $fn = 18);
  color("white") translate([-1.1, -2.1, 1.1]) sphere(0.75, $fn = 10);
  color("white") translate([1, -2, -1]) sphere(0.35, $fn = 8);
}

// Stubby rounded arms.
mirror_x() limb([10, 0, 13], [14, -0.5, 10.5], 2.4, 1.9, wax);

// Ghost flame: layered tongues, violet outside, cyan inside, leaning back and to the right.
module tongue(p, d, r, c) {
  color(c) hull() { translate(p) sphere(r, $fn = 14); translate(p + d) sphere(0.2, $fn = 8); }
}
F = [0, 0, 27.5];
// A flame tongue that curls: chain through points with shrinking radii.
module curl(pts, r0, c) { chain(pts, [for (i = [0 : len(pts) - 1]) r0 * (1 - i / len(pts)) + 0.15], c); }
ell([4.6, 4.2, 3.4], F + [0, 0, 1.5], flameViolet);
curl([F + [0, 0, 2], F + [1, 0.5, 7], F + [3, 1, 11], F + [2, 1, 15]], 4.2, flameViolet);
curl([F + [2.5, 0, 1.5], F + [6, 0.5, 5], F + [8, 1, 9], F + [7, 1, 12]], 2.6, flameViolet);
curl([F + [-2.5, 0, 1.5], F + [-5, 0.5, 5], F + [-5.5, 1, 9], F + [-4, 1, 11]], 2.6, flameViolet);
curl([F + [0, 1.5, 2], F + [-1, 3, 7], F + [-3, 4, 11]], 2.6, flameViolet);
curl([F + [-1, -1.6, 1.6], F + [-0.5, -2, 6], F + [1, -1.8, 10], F + [0, -1.5, 13]], 3, flameBlue);
curl([F + [-2.2, -2.2, 1.4], F + [-3, -2.4, 5], F + [-2.2, -2.2, 9]], 2.4, flameCyan);
curl([F + [-2.4, -3.2, 1.4], F + [-2.2, -3.4, 4.5], F + [-2.6, -3.2, 7]], 1.6, flameCore);
// Sparks drifting off the flame.
for (p = [[7, -1, 40], [-6, -1, 37], [5, 2, 44], [-3, 2, 43]]) color(flameViolet) translate(p) scale([0.6, 0.5, 1.1]) sphere(1, $fn = 8);

// Ice-blue shards and wax droplets swirling around the hem.
for (i = [0 : 9]) {
  a = i * 36 + 10;
  color(i % 3 == 0 ? dripLight : shard) translate([15 * sin(a), -14 * cos(a), 4 + (i % 4) * 3])
    rotate([20, 30, a]) scale([0.6, 0.5, 1.3]) sphere(1, $fn = 6);
}
