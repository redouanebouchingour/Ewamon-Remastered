// Flampling: a round orange fire chick hovering in the air, a flame crest on its head, burning wingtips,
// a scowling face with a tiny dark beak and a flame mark on its back.
include <lib.scad>
// ground: -1.43   (it hovers: the ground where its old blaze stood, so it floats as high as before)

// Brow ridge over an eye at p (size s, same yaw), overhanging its front; the inner end drops `drop` (share of s)
// towards the nose so the face itself scowls.
module brow(p, s, drop, c, yaw = 0) {
  color(c) translate(p) rotate([0, 0, yaw]) hull() {
    translate([s * 1.0, s * 0.1, s * 0.8]) scale([s * 0.55, s * 0.62, s * 0.42]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([-s * 0.8, -s * 0.12, s * (0.7 - drop)]) scale([s * 0.55, s * 0.62, s * 0.4]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    // Sealed back over the eye's top so no sclera shows above the ridge.
    translate([s * 0.1, s * 0.2, s * 0.95]) scale([s * 1.05, s * 0.75, s * 0.5]) rotate([0, 90, 0]) sphere(1, $fn = 12);
  }
}

body = [0.85, 0.42, 0.18];
bodyHi = [0.95, 0.55, 0.28];
bodyDk = [0.7, 0.3, 0.12];
flameRed = [0.93, 0.22, 0.05];
flameOrange = [1, 0.55, 0.08];
flameCore = [1, 0.9, 0.4];
beak = [0.22, 0.14, 0.12];
leg = [0.18, 0.15, 0.15];

// Teardrop flame tongue: a round base swelling up and narrowing to a curled point.
module tongue(p, d, r, c) {
  color(c) hull() {
    translate(p) sphere(r);
    translate(p + d * 0.45 + [d[0] * 0.2, 0, 0]) sphere(r * 0.7);
    translate(p + d) sphere(0.2);
  }
}
// A flame: a fat red teardrop with side tongues, an orange and a yellow layer showing on both faces (front and back).
module flame(p, s = 1, lean = [0, 0, 0]) {
  tongue(p, [0, 0, 7.5 * s] + lean, 3 * s, flameRed);
  tongue(p + [2 * s, 0, 0], [2.4 * s, 0, 4.5 * s] + lean, 1.9 * s, flameRed);
  tongue(p + [-2 * s, 0, 0], [-2.4 * s, 0, 4.5 * s] + lean, 1.9 * s, flameRed);
  for (y = [-1, 1]) {
    tongue(p + [0, y * 1.2 * s, -0.2 * s], [0.6 * s, 0, 5.5 * s] + lean * 0.8, 2.3 * s, flameOrange);
    tongue(p + [0, y * 2.1 * s, -0.5 * s], [0, 0, 3.2 * s] + lean * 0.6, 1.4 * s, flameCore);
  }
}

// Body: a plump egg.
ell([11, 9.5, 9.5], [0, 0, 21], body);
ell([7, 2.6, 5.5], [0, -6.6, 17.5], bodyHi);  // fluffy chest
for (x = [-4, 0, 4]) spike([x, -9, 14.5], [x * 0.1, -0.6, -1.6], 1.2, 0.1, bodyHi);

// Face: angry eyes, a little dark beak.
mirror_x() {
  eye([3.8, -7.7, 24.8], 2.1, iris = [0.9, 0.16, 0.04], sclera = [1, 0.88, 0.55], pupil = [0.1, 0.02, 0], yaw = 6, flat = 0.45, lid = 0.42, lid_tilt = 32, lid_c = [0.35, 0.12, 0.05], slit = 0.4);
  brow([3.8, -7.7, 24.8], 2.1, 0.6, bodyDk, 6);
}
color(beak) translate([0, -9.5, 22.4]) rotate([90, 0, 0]) cylinder(h = 2.4, r1 = 1.1, r2 = 0.1, $fn = 12);

// Flame crest on top of the head.
flame([0, 0, 29], 1.2, [1, 1, 0]);

// Little wings out to the sides with flame-tipped ends.
mirror_x() {
  petal([5, 1.6, 3], [11, 0, 20], [0, -20, -12], bodyDk);
  petal([4, 1.4, 2.4], [11.4, -0.4, 20.6], [0, -20, -12], body);
  for (i = [0 : 2]) petal([2.6, 0.8, 0.9], [12 + i * 0.4, 0.4, 18.6 + i * 1.3], [0, -20 - i * 6, -12], bodyHi);
  flame([15.5, -0.5, 22.5], 0.65, [0.6, 0, 0]);
}

// Flame mark on the back.
translate([0, 9.4, 17]) rotate([-80, 0, 0]) {
  color(flameRed) scale([2.8, 3.2, 0.6]) sphere(1, $fn = 16);
  color(flameOrange) translate([0, -0.6, 0.3]) scale([1.8, 2.2, 0.6]) sphere(1, $fn = 14);
  color(flameCore) translate([0, -1, 0.5]) scale([0.9, 1.2, 0.5]) sphere(1, $fn = 10);
}
spike([0, 9.4, 19], [0, 0.6, 3], 1.2, 0.05, flameRed);

// Dangling dark legs and toes.
mirror_x() {
  limb([3, -1, 11.6], [3.3, -1, 8.5], 0.7, 0.55, leg);
  for (a = [-30, 0, 30]) limb([3.3, -1, 8.5], [3.3 + sin(a) * 1.3, -1 - cos(a) * 1.3, 7.8], 0.4, 0.25, leg);
}

