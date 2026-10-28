// Cindercap: a charcoal lizard under a glowing ember-spotted mushroom cap, a flame on its tail tip.
include <lib.scad>

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
  eye([3.4, -7.4, 23.4], 1.8, iris = [0.95, 0.35, 0.05], pupil = [0.1, 0.02, 0.02], sclera = [1, 0.7, 0.3], yaw = -18);
  color(bodyHi) translate([3.4, -8, 25.4]) rotate([0, -18, -18]) scale([2.2, 0.9, 0.7]) sphere(1, $fn = 16);
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
