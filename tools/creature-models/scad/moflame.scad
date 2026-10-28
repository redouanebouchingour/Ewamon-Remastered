// Moflame: a lean fire pup, orange-red coat with black tiger stripes, a shaggy cream ruff on the chest and cream
// paws, a spiky brown crest on its head, a streamer of flame blowing back from the crest and a long flame tail.
include <lib.scad>

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

coat = [0.86, 0.42, 0.22];
coatDk = [0.68, 0.3, 0.16];
cream = [0.9, 0.78, 0.58];
creamDk = [0.78, 0.64, 0.44];
stripe = [0.12, 0.08, 0.06];
crest = [0.55, 0.4, 0.18];
flameRed = [0.9, 0.15, 0.08];
flameOrange = [1, 0.5, 0.1];
flameCore = [1, 0.82, 0.35];

// A streamer of fire: a chain of shrinking hulls in three layers, red outside and a hot core.
module flame(pts, rs) {
  chain(pts, rs, flameRed);
  chain([for (i = [0 : len(pts) - 2]) pts[i] + [0, 0, rs[i] * 0.35]], [for (i = [0 : len(rs) - 2]) rs[i] * 0.8], flameOrange);
  chain([for (i = [0 : len(pts) - 3]) pts[i] + [0, -rs[i] * 0.3, rs[i] * 0.5]], [for (i = [0 : len(rs) - 3]) rs[i] * 0.45], flameCore);
  // Flickering tongues licking up and back off the streamer.
  for (i = [1 : len(pts) - 2]) {
    spike(pts[i] + [0, 0, rs[i] * 0.5], [0.4 * (i % 2 == 0 ? 1 : -1), rs[i] * 0.9, rs[i] * 1.3], rs[i] * 0.55, 0.05, i % 2 == 0 ? flameOrange : flameRed);
    spike(pts[i] + [rs[i] * 0.4, 0, 0], [rs[i] * 0.7, rs[i] * 0.8, rs[i] * 0.4], rs[i] * 0.45, 0.05, flameRed);
    spike(pts[i] + [-rs[i] * 0.4, 0, 0], [-rs[i] * 0.7, rs[i] * 0.8, rs[i] * 0.4], rs[i] * 0.45, 0.05, flameRed);
  }
}

// Legs: coat upper, cream paws with toe nubs.
module leg(x, y) {
  limb([x, y, 9], [x * 1.05, y - 0.5, 2.5], 2.4, 1.9, coat);
  color(stripe) translate([x * 1.05, y - 0.3, 5.5]) scale([2.2, 2.2, 0.35]) sphere(1, $fn = 14);
  blob([[[1.8, 2.4, 1.3], [x * 1.08, y - 1.2, 1.3]]], cream);
  for (dx = [-0.8, 0, 0.8]) ell([0.5, 0.5, 0.4], [x * 1.08 + dx, y - 3.4, 0.6], creamDk);
}
leg(3.2, -6.5); leg(-3.2, -6.5); leg(3.4, 4.5); leg(-3.4, 4.5);

translate([0, 0, -2]) {
// Body: long torso along Y (head at -Y), chest raised.
blob([[[5.5, 7, 5.5], [0, 0, 13]], [[5, 4.5, 5.5], [0, -6, 14.5]]], coat);
ell([4.6, 5.5, 3], [0, 0, 9.6], cream);
// Black tiger stripes over the back and flanks.
for (y = [-4, -1, 2, 5]) color(stripe) translate([0, y, 13.5]) rotate([0, 0, y * 2]) rotate([12, 0, 0])
  scale([5.75, 0.55, 5.7]) difference() { sphere(1, $fn = 28); translate([0, 0, -0.85]) cube([2.5, 2.5, 2.2], center = true); }


// Shaggy cream chest ruff.
for (a = [-60 : 30 : 60]) color(a == 0 ? cream : creamDk) translate([0, -9.5, 15]) rotate([0, a, 0]) hull() {
  translate([0, 0, 0]) scale([2.2, 1.5, 2.6]) sphere(1, $fn = 12);
  translate([0, -1.5, -5]) sphere(0.4, $fn = 8);
}
ell([4, 2.5, 4], [0, -9, 16], cream);

// Head: a short muzzle, cream cheeks.
blob([[[3.8, 3.8, 3.6], [0, -11, 20]], [[2.3, 2.6, 1.9], [0, -14.5, 18.6]]], coat);
mirror_x() ell([1.7, 1.6, 1.5], [2.6, -12.8, 18.3], cream);
color(stripe) translate([0, -16.9, 19.2]) scale([0.9, 0.6, 0.6]) sphere(1, $fn = 12);
mirror_x() {
  eye([1.95, -13.6, 20.8], 1.3, iris = [0.45, 0.24, 0.08], pupil = [0.08, 0.04, 0.02], yaw = 10, lid = 0.44, lid_tilt = 28, lid_c = stripe, slit = 0.6);
  brow([1.95, -13.6, 20.8], 1.3, 0.48, coatDk, 10);
}
// Ears, pointed and swept back.
mirror_x() spike([2.6, -10.5, 22.6], [1.4, 1.6, 3.4], 1.1, 0.1, coat);
// Spiky brown crest fanning up and back.
for (s = [[0, -12.5, 23, [0, -1, 4.5]], [-1, -11.5, 23, [-1.5, 1, 4]], [1, -11.5, 23, [1.5, 1, 4]],
          [0, -10.5, 23, [0, 2.5, 4]]]) spike([s[0], s[1], s[2]], s[3], 1.1, 0.1, crest);

// Flame streaming back from the crest.
flame([[0, -10, 24], [0.5, -6, 25.5], [0.6, -2, 26], [0, 2, 25.5], [0, 5, 26.5]], [2.2, 2.6, 2.2, 1.5, 0.6]);
// Long flame tail sweeping back and up.
flame([[0, 6, 15], [0.3, 10, 17], [0.5, 14, 19], [0.2, 18, 20.5], [0, 22, 22.5], [0, 25, 24]], [2.2, 3, 3.2, 2.8, 2, 0.7]);
}
