// Stormchick: a static-charged chick that is one big spiky ball of yellow down: huge round startled eyes, a little
// open orange beak, a lightning mark on the brow, zigzag lightning-bolt tail feathers and stubby orange feet.
include <lib.scad>

down = [0.98, 0.82, 0.3];
downHi = [1, 0.9, 0.48];
downDark = [0.9, 0.68, 0.2];
beak = [0.95, 0.5, 0.2, NOGLOW];
mouthIn = [0.6, 0.18, 0.12];
bolt = [1, 0.86, 0.25];
spark = [0.65, 0.85, 1];

c = [0, 0, 14.5];
R = 11.5;

// Core ball of down.
color(down) translate(c) sphere(R, $fn = 40);

// Spiky down radiating out in every direction (golden-angle spread), skipping the face.
N = 150;
for (i = [0 : N - 1]) {
  z = 1 - 2 * (i + 0.5) / N;
  rr = sqrt(1 - z * z);
  th = i * 137.508;
  d = [rr * cos(th), rr * sin(th), z];
  face = d[1] < -0.55 && abs(d[0]) < 0.75 && d[2] > -0.45 && d[2] < 0.75;
  if (!face && d[2] > -0.85) {
    len = 3.4 + (i % 3) * 1.3;
    spike(c + d * (R - 1.6), d * len, 3.1, 0.15, i % 4 == 0 ? downDark : (i % 4 == 1 ? downHi : down));
  }
}

// Huge round eyes.
// Huge round eyes: white discs with a small black pupil.
mirror_x() translate([4.4, -9.4, 17.4]) rotate([0, 0, -16]) {
  color("white") scale([1, 0.45, 1.05]) sphere(3.3, $fn = 24);
  color([0.05, 0.05, 0.08]) translate([0, -1.45, 0]) scale([1, 0.3, 1.1]) sphere(1.35, $fn = 16);
}
// Open beak.
color(beak) translate([0, -11.4, 13.6]) rotate([90, 0, 0]) cylinder(h = 3.8, r1 = 2.2, r2 = 0.5, $fn = 16);
color(beak) translate([0, -11.2, 12]) rotate([105, 0, 0]) cylinder(h = 2.6, r1 = 1.6, r2 = 0.4, $fn = 14);
color(mouthIn) translate([0, -11.6, 12.8]) scale([1.4, 1, 0.7]) sphere(1, $fn = 12);

// A flat zigzag lightning bolt (2D outline) extruded to thickness t.
module bolt2d() polygon([[0, 0], [2.6, 0], [1.4, 3.4], [4.4, 3.4], [0.6, 11], [1.6, 5.6], [-1, 5.6]]);
module bolt3d(t, col) color(col) linear_extrude(height = t, center = true) bolt2d();

// Lightning mark on the brow.
translate([-0.4, -11, 20.4]) rotate([70, 0, 8]) scale(0.55) translate([-1.6, 0, 0]) bolt3d(2, [0.88, 0.58, 0.15]);

// Lightning-bolt tail feathers fanning up out of the back.
for (k = [[42, 1.6, 18], [66, 1.9, 15], [90, 1.6, 12]])
  translate([9, 4, k[2]]) rotate([0, 0, 30]) rotate([0, k[0], 0]) rotate([90, 0, 0]) scale(k[1])
    translate([-1, 0, 0]) bolt3d(1.6, bolt);

// Stubby orange feet with three toes.
mirror_x() {
  limb([4, -3, 4], [4.4, -4, 1.2], 1.2, 1, beak);
  for (a = [-30, 0, 30]) limb([4.4, -4, 0.9], [4.4 + sin(a) * 2.4, -4 - cos(a) * 2.4, 0.7], 0.6, 0.5, beak);
}

// A few static sparks floating close by.
for (s = [[-13, -4, 24], [12, -6, 26], [-15, 3, 10], [14, 2, 8], [3, -4, 30]])
  translate(s) rotate([90, 0, s[0] > 0 ? 20 : -20]) scale(0.35) bolt3d(1, spark);
