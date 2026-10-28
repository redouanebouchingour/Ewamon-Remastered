// Voltaura: a slender navy-blue electric humanoid with long golden antenna-horns, pale yellow lightning-bolt wings,
// a gold bolt across its chest, a crackling gold orb in one hand and a whip tail ending in a blue spark bulb.
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

blue = [0.08, 0.22, 0.6];
blueHi = [0.16, 0.36, 0.78];
gold = [0.95, 0.78, 0.15, GLOW];
goldDark = [0.72, 0.55, 0.1];
wingY = [1, 1, 0.78];
wingEdge = [0.55, 0.85, 1];
spark = [0.55, 0.85, 1];
eyeC = [1, 0.9, 0.2];

// Lightning-bolt wing outline in its own XY plane (x outward, y up), extruded thin.
module bolt_wing(s = 1) {
  pts = [[0, 0], [10, 1], [7, 3.5], [16, 6], [11, 8], [19, 14], [12.5, 13.5], [16, 21], [9, 14], [8, 17], [4, 9], [2, 10], [1, 4]];
  scale([s, s, 1]) {
    color(wingEdge) linear_extrude(height = 0.5, center = true) offset(r = 0.6) polygon(pts);
    color(wingY) translate([0, 0, 0]) linear_extrude(height = 0.8, center = true) polygon(pts);
  }
}

// Legs: digitigrade, thighs, backward knee, thin shins, clawed feet with gold claws.
mirror_x() {
  limb([2.8, 0, 15], [3.8, -2, 10], 2.4, 1.8, blue);
  limb([3.8, -2, 10], [4.2, 1, 5], 1.6, 1.1, blue);
  limb([4.2, 1, 5], [4.4, -0.5, 1.2], 1.0, 0.9, blue);
  blob([[[1.4, 2.4, 0.9], [4.4, -1.5, 0.9]]], blue);
  for (a = [-30, 0, 30]) spike([4.4 + sin(a) * 1, -3.6, 0.7], [sin(a) * 0.5, -1.2, -0.3], 0.35, 0.05, gold);
  // knee gold bands
  color(gold) translate([3.8, -2.3, 10.2]) scale([1.6, 1.2, 0.6]) sphere(1, $fn = 14);
}

// Pelvis and narrow waist.
blob([[[4.6, 3.2, 2.8], [0, 0, 15.5]], [[3, 2.4, 2.4], [0, 0, 19]]], blue);
// Chest: V-shaped torso.
blob([[[4.8, 3.2, 3.6], [0, 0, 23]], [[2.8, 2.4, 2.4], [0, 0, 19.5]]], blue);
// Gold lightning bolt on the chest.
color(gold) translate([0, -3, 21.5]) rotate([90, 0, 0]) linear_extrude(height = 0.9, center = true)
  polygon([[-3.2, 3.6], [3.2, 3.6], [0.6, 0.6], [2.4, 0.6], [-1.2, -3.6], [-0.4, -0.6], [-2, -0.6]]);
// Gold collar plates.
mirror_x() petal([2.2, 1.0, 0.8], [2.6, -1.6, 25.6], [0, 10, -20], gold);

// Neck and long, narrow horse-like head.
limb([0, -0.4, 25], [0, -1.5, 29.5], 1.5, 1.3, blue);
blob([[[2.2, 2.4, 2.4], [0, -1.6, 31]], [[1.3, 1.8, 1.3], [0, -4.8, 29.6]]], blue);
// Gold face stripe and bright eyes.
color(gold) translate([0, -3.3, 31.8]) rotate([-30, 0, 0]) scale([0.5, 2.2, 0.4]) sphere(1, $fn = 12);
mirror_x() {
  eye([1.45, -3.0, 31.2], 1.25, iris = [1, 0.9, 0.2, GLOW], pupil = [0.1, 0.1, 0.2], sclera = [1, 1, 0.7], yaw = 22,
      lid = 0.48, lid_tilt = 30, lid_c = [0.03, 0.08, 0.25], slit = 0.3);
  brow([1.45, -3.0, 31.2], 1.25, 0.55, blue, 22);
}
// Long golden antenna-horns sweeping up and back, with spark tips.
mirror_x() {
  chain([[1, -1, 32.6], [2.4, -0.5, 35.5], [3.6, 0.6, 38.5], [5.4, 2.5, 40], [6.6, 3.8, 39.6]], [0.9, 0.85, 0.7, 0.45, 0.25], gold);
  ell([0.7, 0.7, 0.7], [6.8, 4, 39.6], spark);
}

// Arms: thin, gold shoulder bands; the viewer-left hand holds the orb out.
mirror_x() {
  ell([1.8, 1.6, 1.6], [5, 0, 24.8], blueHi);
  color(gold) translate([5.3, 0, 24]) rotate([0, 50, 0]) scale([1.8, 1.8, 0.5]) sphere(1, $fn = 14);
}
// Viewer-right arm hangs down, clawed.
limb([5, 0, 24.5], [7, -1, 19], 1.2, 1, blue);
limb([7, -1, 19], [7.6, -2.4, 14.5], 1, 0.8, blue);
color(gold) translate([7.2, -1.5, 17.5]) scale([1.2, 1.2, 1.5]) sphere(1, $fn = 12);
for (a = [-30, 0, 30]) spike([7.6 + sin(a) * 0.6, -2.6, 13.8], [sin(a) * 0.6, -0.6, -1.6], 0.3, 0.05, gold);
// Viewer-left arm raised out to the side holding the orb.
limb([-5, 0, 24.5], [-8.5, -1.5, 22], 1.2, 1, blue);
limb([-8.5, -1.5, 22], [-11, -3, 23.5], 1, 0.9, blue);
color(gold) translate([-9.8, -2.2, 22.7]) scale([1.2, 1.2, 1.2]) sphere(1, $fn = 12);
ell([1.3, 1.2, 0.9], [-11.4, -3.2, 23.6], blue);
// The orb: gold sphere with a cross seam and a pale spark halo.
color(gold) translate([-11.6, -3.6, 26.6]) sphere(2.2, $fn = 24);
color(goldDark) translate([-11.6, -3.6, 26.6]) {
  rotate([90, 0, 0]) rotate_extrude($fn = 24) translate([2.2, 0]) circle(0.22, $fn = 6);
  rotate([0, 90, 0]) rotate_extrude($fn = 24) translate([2.2, 0]) circle(0.22, $fn = 6);
}

for (a = [-30, 30]) spike([-11.4 + sin(a), -3.6, 24.2], [sin(a) * 0.4, -0.3, 1.4], 0.3, 0.05, gold);

// Lightning wings on the back, angled outward and back.
translate([1.2, 2.4, 22]) rotate([0, 0, 18]) rotate([62, 0, 0]) rotate([0, 0, -18]) bolt_wing(0.8);
translate([-1.2, 2.4, 22]) mirror([1, 0, 0]) rotate([0, 0, 18]) rotate([62, 0, 0]) rotate([0, 0, -18]) bolt_wing(0.8);

// Whip tail curling out to the viewer's right, gold-banded, ending in a blue spark bulb.
chain([[0, 2.6, 15], [3, 6, 11], [7, 8, 5], [12, 7, 2.5], [15.5, 4, 4], [16, 1.5, 9], [14.5, 1, 12.5]],
      [1.4, 1.1, 0.8, 0.65, 0.55, 0.5, 0.45], gold);
ell([1.2, 1.2, 1.7], [14.2, 0.8, 13.8], spark);
ell([0.6, 0.6, 0.9], [14.2, 0.2, 14], [0.9, 0.97, 1]);
