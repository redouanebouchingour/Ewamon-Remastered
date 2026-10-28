// Moblaze: Moflame grown into a burly fire hound, a deeper orange coat with dark stripes and glowing ember marks on
// the legs, a big shaggy cream mane over chest and neck, a crown of fire blazing up from its head with a streamer
// behind, a huge fanned tail of flame feathers, and loose embers floating around it.
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

coat = [0.82, 0.45, 0.25];
coatDk = [0.68, 0.3, 0.16];
cream = [0.9, 0.78, 0.58];
creamDk = [0.78, 0.64, 0.44];
stripe = [0.3, 0.16, 0.08];
ember = [1, 0.55, 0.12];
crest = [0.55, 0.4, 0.18];
flameRed = [0.9, 0.15, 0.08];
flameOrange = [1, 0.5, 0.1, GLOW];
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
  limb([x, y, 9], [x * 1.05, y - 0.5, 2.5], 2.7, 2.1, coat);
  color(ember) translate([x * 1.25, y - 1.6, 7]) rotate([0, 0, x > 0 ? -20 : 20]) scale([0.8, 0.6, 1.4]) sphere(1, $fn = 10);
  color(stripe) translate([x * 1.05, y - 0.3, 5.5]) scale([2.2, 2.2, 0.35]) sphere(1, $fn = 14);
  blob([[[1.8, 2.4, 1.3], [x * 1.08, y - 1.2, 1.3]]], cream);
  for (dx = [-0.8, 0, 0.8]) ell([0.5, 0.5, 0.4], [x * 1.08 + dx, y - 3.4, 0.6], creamDk);
}
leg(3.2, -6.5); leg(-3.2, -6.5); leg(3.4, 4.5); leg(-3.4, 4.5);

translate([0, 0, -2]) {
// Body: long torso along Y (head at -Y), chest raised.
blob([[[6.2, 7.5, 6], [0, 0, 13]], [[5.8, 5, 6], [0, -6, 14.5]]], coat);
ell([4.6, 5.5, 3], [0, 0, 9.6], cream);
// Black tiger stripes over the back and flanks.
for (y = [-4, -1, 2, 5]) color(stripe) translate([0, y, 13.5]) rotate([0, 0, y * 2]) rotate([12, 0, 0])
  scale([6.45, 0.55, 6.2]) difference() { sphere(1, $fn = 28); translate([0, 0, -0.85]) cube([2.5, 2.5, 2.2], center = true); }


// Shaggy cream chest ruff.
for (a = [-90 : 30 : 90]) color(a % 60 == 0 ? cream : creamDk) translate([0, -8.5, 16.5]) rotate([0, a, 0]) hull() {
  scale([3, 2.2, 3.2]) sphere(1, $fn = 12);
  translate([0, -2, -7]) sphere(0.5, $fn = 8);
}
blob([[[5.6, 3.6, 5.4], [0, -8.5, 17]], [[4.6, 3, 4], [0, -6, 19.5]]], cream);
// Mane tufts down the back of the neck.
for (y = [-6, -3.5, -1]) spike([0, y, 18 - (y + 6) * 0.3], [0, 2.5, 2.6], 1.6, 0.1, cream);

// Head: a short muzzle, cream cheeks.
blob([[[3.8, 3.8, 3.6], [0, -11, 20]], [[2.3, 2.6, 1.9], [0, -14.5, 18.6]]], coat);
mirror_x() ell([1.7, 1.6, 1.5], [2.6, -12.8, 18.3], cream);
color(stripe) translate([0, -16.9, 19.2]) scale([0.9, 0.6, 0.6]) sphere(1, $fn = 12);
mirror_x() {
  eye([1.95, -13.6, 20.8], 1.35, iris = [1, 0.62, 0.12], pupil = [0.12, 0.05, 0.02], sclera = [1, 0.9, 0.6], yaw = 10, lid = 0.48, lid_tilt = 32, lid_c = stripe, slit = 0.35);
  brow([1.95, -13.6, 20.8], 1.35, 0.6, coatDk, 10);
}
// Ears, pointed and swept back.
mirror_x() spike([2.6, -10.5, 22.6], [1.4, 1.6, 3.4], 1.1, 0.1, coat);
// Brown horn-like crest locks and a crown of fire blazing up between them.
mirror_x() spike([1.4, -12, 23], [0.8, 1.2, 4], 0.9, 0.1, crest);
translate([0, -11.5, 23]) {
  spike([0, 0, 0], [0, -0.5, 7.5], 2, 0.1, flameRed);
  spike([0, -0.3, 0.5], [0, -0.3, 5.5], 1.4, 0.1, flameOrange);
  spike([0, -0.6, 0.6], [0, 0, 3.2], 0.8, 0.1, flameCore);
  spike([-1, 0.5, 0], [-1.6, 0.6, 5.5], 1.3, 0.1, flameRed);
  spike([1, 0.5, 0], [1.6, 0.6, 5], 1.3, 0.1, flameOrange);
}

// Flame streaming back from the crest.
flame([[0, -10, 24], [0.5, -6, 25.5], [0.6, -2, 26], [0, 2, 25.5], [0, 5, 26.5]], [2.2, 2.6, 2.2, 1.5, 0.6]);
// Huge fanned tail: flame feathers spreading back from the rump.
for (f = [[-10, -6, 1.15], [10, 8, 1.4], [30, -7, 1.45], [52, 4, 1.2]]) {
  translate([0, 6, 14]) rotate([0, 0, f[1]]) rotate([f[0], 0, 0])
    flame([[0, 0, 0], [0, 4, 0.5], [0, 8, 1.2], [0, 12, 2.5], [0, 15, 4.5]] * f[2], [2, 2.8, 2.6, 1.8, 0.5] * f[2]);
}
// Loose embers.
for (e = [[5, 18, 27, 0.9], [-4, 24, 24, 0.7], [7, 26, 16, 0.8], [-6, 8, 28, 0.6], [3, -5, 30, 0.6]]) {
  color(flameRed) translate([e[0], e[1], e[2]]) sphere(e[3], $fn = 12);
  color(flameCore) translate([e[0], e[1] - e[3] * 0.4, e[2]]) sphere(e[3] * 0.6, $fn = 10);
}
}
