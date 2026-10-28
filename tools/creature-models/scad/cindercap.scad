// Cindercap: a charcoal lizard under a glowing ember-spotted mushroom cap, a flame on its tail tip.
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

// Flat colour patch lying on the ellipsoid (radii r, centre c) at azimuth az (0 = straight back, +Y) and elevation el.
module patchOn(r, c, az, el, s, col) {
  color(col) translate(c + [r[0] * sin(az) * cos(el), r[1] * cos(az) * cos(el), r[2] * sin(el)])
    rotate([0, 0, -az]) rotate([el, 0, 0]) scale([s, s * 0.3, s * 0.8]) sphere(1, $fn = 14);
}

body = [0.2, 0.2, 0.23];
bodyHi = [0.3, 0.3, 0.34];
capRed = [0.86, 0.22, 0.06];
capOrange = [0.96, 0.45, 0.08];
ember = [1, 0.8, 0.25];
gill = [0.5, 0.33, 0.18];
belly = [1, 0.62, 0.15];
bellyCore = [1, 0.88, 0.45];
flameRed = [0.93, 0.2, 0.05];
flameOrange = [1, 0.55, 0.08];
flameCore = [1, 0.9, 0.4];
claw = [0.92, 0.92, 0.9];

// Ashy scale patches and a glowing crack down the back.
for (m = [[-25, 15, 2.2], [30, 35, 1.8], [10, -10, 2.4], [-40, -25, 1.6]]) patchOn([8, 7, 7], [0, 0, 9], m[0], m[1], m[2], bodyHi);
for (m = [[-20, 20, 2], [35, 5, 1.6]]) patchOn([7.5, 6.8, 6.2], [0, -1, 23.5], m[0], m[1], m[2], bodyHi);
chain([[0.6, 7.6, 15.5], [-0.5, 7.4, 12], [0.8, 7.6, 8.5], [-0.2, 7.4, 5.5]], [0.32, 0.3, 0.28, 0.22], [1, 0.45, 0.08]);
// Torso, a pear: wide hips, narrower chest.
blob([[[8, 7, 7], [0, 0, 9]], [[6.5, 6, 6], [0, -0.5, 16]]], body);
// Belly glow.
ell([4.6, 2.2, 5.6], [0, -5.6, 11.5], belly);
ell([2.6, 1.4, 3.2], [0, -7, 12.5], bellyCore);

// Head.
blob([[[7.5, 6.8, 6.2], [0, -1, 23.5]], [[5.2, 5, 4.4], [0, -5.5, 22]]], body);
// Snout ridge and nostrils.
ell([3.6, 2.4, 2.4], [0, -9, 21.3], body);
mirror_x() ell([0.35, 0.3, 0.35], [1.1, -11.2, 22], [0.08, 0.08, 0.1]);
// Mouth line.
color([0.08, 0.08, 0.1]) translate([0, -10.1, 20.1]) rotate([90, 0, 0]) scale([2.6, 0.6, 0.4]) cylinder(h = 0.6, r = 1, center = true, $fn = 16);
// Angry ember eyes under heavy brows.
mirror_x() {
  eye([3.5, -7.25, 23.0], 2.5, iris = [1, 0.42, 0.05, GLOW], pupil = [0.1, 0.02, 0.02], sclera = [1, 0.72, 0.25], yaw = 6, lid = 0.4, lid_tilt = 30, lid_c = [0.1, 0.1, 0.12], slit = 0.35);
  brow([3.5, -7.25, 23.0], 2.5, 0.45, bodyHi, 6);
}

// Mushroom cap: a squashed dome with a brown gill skirt underneath, ember spots on top; tipped back off the face.
translate([0, 1.5, 28.5]) rotate([-12, 0, 0]) translate([0, 0, -28]) {
color(capRed) translate([0, 0, 28]) scale([15, 14, 7.5]) difference() {
  sphere(1, $fn = 48);
  translate([0, 0, -1.2]) cube(2.4, center = true);
}
color(capOrange) translate([0, 0, 28.6]) scale([12, 11.2, 6.6]) difference() {
  sphere(1, $fn = 40);
  translate([0, 0, -1.2]) cube(2.4, center = true);
}
color(gill) translate([0, 0, 27.4]) scale([14.6, 13.6, 1.4]) sphere(1, $fn = 48);
// Ember spots scattered over the dome: [azimuth, elevation, size].
spots = [[0, 25, 1.6], [40, 30, 1.3], [80, 22, 1.5], [120, 35, 1.2], [160, 20, 1.6], [200, 30, 1.4], [240, 24, 1.5],
         [280, 32, 1.3], [320, 20, 1.6], [20, 55, 1.2], [100, 55, 1.4], [180, 58, 1.2], [260, 55, 1.3], [340, 60, 1.1],
         [60, 8, 1.1], [140, 8, 1.2], [220, 8, 1.1], [300, 8, 1.2], [0, 85, 1.4], [-60, 45, 1.0]];
for (s = spots) {
  az = s[0]; el = s[1]; r = s[2];
  p = [15 * cos(el) * cos(az), 14 * cos(el) * sin(az), 28 + 7.5 * sin(el)];
  color(ember) translate(p) rotate([0, 90 - el, az]) scale([1, 1, 0.35]) sphere(r, $fn = 14);
}
}

// Arms, held forward, with white claws.
mirror_x() {
  limb([5.2, -2.5, 17], [7.4, -5.5, 13.5], 1.9, 1.5, body);
  ell([1.7, 1.6, 1.4], [7.6, -6, 13], body);
  for (a = [-30, 0, 30]) spike([7.6 + sin(a) * 1.1, -7.2, 12.6], [sin(a) * 0.6, -1.2, -0.5], 0.4, 0.05, claw);
}

// Legs: thick thighs, flat feet with three toe claws.
mirror_x() {
  ell([3.4, 3.6, 3.8], [4.6, -0.5, 5.2], body);
  blob([[[2.6, 4, 1.6], [4.8, -2.2, 1.6]], [[2.2, 2, 1.4], [4.8, 0.6, 1.5]]], body);
  for (a = [-28, 0, 28]) spike([4.8 + sin(a) * 1.5, -5.6, 1.0], [sin(a) * 0.5, -1.3, -0.4], 0.45, 0.05, claw);
}

// Tail sweeping out to the viewer's right and up, ending in a flame.
chain([[2.5, 4.5, 6], [8, 7, 4.5], [13, 6.5, 6], [16, 4, 10], [17, 2, 14]], [3.4, 2.8, 2.1, 1.6, 1.3], body);
// Flame: a cluster of tongues around the tail tip.
module tongue(p, d, r, c) {
  color(c) hull() {
    translate(p) sphere(r);
    translate(p + d) sphere(0.15);
  }
}
tongue([17, 2, 14.5], [0, -0.5, 9], 2.6, flameRed);
tongue([17.5, 2, 14.5], [4, 0, 6], 2, flameRed);
tongue([16.4, 2, 14.5], [-3.5, 0.5, 6], 2, flameRed);
tongue([17.4, 1, 14.5], [1.8, -1.5, 7], 1.8, flameOrange);
tongue([16.8, 3, 14.5], [-1, 1.5, 6], 1.6, flameOrange);
ell([1.6, 1.6, 2.2], [17, 1.2, 15.8], flameCore);
