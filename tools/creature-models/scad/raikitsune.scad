// Raikitsune: an upright orange thunder fox with a cream chest, a cyan scarf over its muzzle, a cyan medallion,
// black stockinged legs, a crackling blue orb in one paw and nine black-tipped tails fanned out behind it.
include <lib.scad>

fur = [0.92, 0.42, 0.1];
furHi = [1, 0.6, 0.22];
cream = [0.98, 0.86, 0.66];
black = [0.12, 0.12, 0.16];
cyan = [0.25, 0.75, 0.85];
cyanHi = [0.6, 0.95, 1];
claw = [0.85, 0.88, 0.92];
eyeC = [0.2, 0.75, 0.95];

// Legs: orange thighs, black shins and paws.
mirror_x() {
  limb([3.4, 0, 12], [4.4, -1.5, 7.5], 2.8, 2.2, fur);
  limb([4.4, -1.5, 7.5], [4.6, 0.5, 3], 1.9, 1.5, black);
  blob([[[2, 2.8, 1.3], [4.8, -1.4, 1.3]]], black);
  for (a = [-30, 0, 30]) spike([4.8 + sin(a) * 1.2, -4, 0.9], [sin(a) * 0.5, -1.1, -0.4], 0.4, 0.05, claw);
}

// Torso: slim, cream chest and belly.
blob([[[5, 4, 4.5], [0, 0, 20]], [[4, 3.4, 3.6], [0, 0, 14]]], fur);
blob([[[3, 1.6, 4.2], [0, -2.8, 19]], [[2.2, 1.4, 3], [0, -2.6, 14]]], cream);
// Medallion on the chest.
color(cyan) translate([0, -4.4, 21]) rotate([90, 0, 0]) cylinder(h = 0.6, r = 1.5, center = true, $fn = 20);
color(cyanHi) translate([0, -4.75, 21]) rotate([90, 0, 0]) cylinder(h = 0.4, r = 0.8, center = true, $fn = 16);

// Arms: the viewer-right arm hangs, the viewer-left paw holds the thunder orb out.
limb([4.6, 0, 22.5], [6.5, -1.5, 17.5], 1.5, 1.2, fur);
limb([6.5, -1.5, 17.5], [6.8, -2.8, 14], 1.2, 1.1, black);
for (a = [-30, 0, 30]) spike([6.8 + sin(a) * 0.6, -3, 13.4], [sin(a) * 0.5, -0.6, -1.2], 0.28, 0.05, claw);
limb([-4.6, 0, 22.5], [-7.5, -2, 20], 1.5, 1.2, fur);
limb([-7.5, -2, 20], [-10, -4, 21], 1.2, 1.1, black);
color(cyanHi) translate([-11, -5, 23.5]) sphere(2.6, $fn = 24);
color([0.9, 1, 1]) translate([-11, -5.6, 23.8]) sphere(1.6, $fn = 18);
// Crackles around the orb.
for (a = [0 : 72 : 288]) color(cyan) let(p = [-11, -5, 23.5])
  hull() { translate(p + 2.4 * [cos(a), 0.3, sin(a)]) sphere(0.25, $fn = 6); translate(p + 4.2 * [cos(a + 20), 0.2, sin(a + 20)]) sphere(0.1, $fn = 6); }

// Head: fox face pointing -Y, long snout, big black-tipped ears.
translate([0, -0.5, 27]) {
  blob([[[3.6, 3.4, 3.2], [0, 0, 0]], [[1.4, 2.2, 1.2], [0, -4.6, -0.8]]], fur);
  mirror_x() ell([2, 1.5, 1.5], [2.4, -1.6, -1.2], cream);
  ell([0.6, 0.5, 0.5], [0, -6.6, -0.6], black);
  // The scarf mask over the lower muzzle.
  color(cyan) hull() { translate([0, -1, -2]) scale([3.6, 3.4, 1.2]) sphere(1, $fn = 20); translate([0, -4.5, -1.6]) scale([1.6, 1.6, 0.9]) sphere(1, $fn = 14); }
  // Sharp eyes.
  mirror_x() {
    eye([1.6, -3, 0.9], 0.8, iris = eyeC, pupil = black, sclera = [1, 1, 0.95], yaw = -30, flat = 0.35);
    color(black) translate([1.8, -3.2, 1.7]) rotate([0, -20, -30]) scale([1.3, 0.4, 0.25]) sphere(1, $fn = 10);
  }
  // Ears.
  mirror_x() {
    color(fur) hull() { translate([2, 0.5, 2.2]) scale([1.4, 0.8, 1]) sphere(1, $fn = 14); translate([3.2, 1, 7]) sphere(0.3, $fn = 8); }
    color(black) hull() { translate([2.9, 0.9, 5.5]) scale([0.75, 0.5, 0.5]) sphere(1, $fn = 10); translate([3.2, 1.05, 7.2]) sphere(0.3, $fn = 8); }
    ell([0.8, 0.3, 1.4], [2.2, -0.2, 3.6], cream);
  }
}
// Scarf around the neck with two tails streaming to the viewer's right.
color(cyan) translate([0, -0.3, 24]) scale([4.2, 4, 1.4]) sphere(1, $fn = 24);
chain([[3, -2.5, 24.5], [6, -3.5, 25.5], [9, -2.5, 27], [11.5, -3, 26]], [1.1, 1, 0.8, 0.4], cyan);
chain([[3, -2.5, 24], [6, -3, 23], [8.5, -2, 22.5]], [1, 0.8, 0.4], cyan);

// Nine tails fanned behind, each orange with a cream inner tuft and a black tip.
module tail(a, len = 13) {
  dir = [sin(a), 0.3, cos(a)];
  base = [0, 3.5, 14];
  mid = base + dir * len * 0.5 + [0, 1.5, 0];
  m2 = base + dir * len * 0.78 + [0, 2.2, 0];
  tip = base + dir * len + [0, 2.6, 0];
  color(fur) hull() { translate(base) sphere(1.5, $fn = 14); translate(mid) sphere(3.6, $fn = 18); }
  color(fur) hull() { translate(mid) sphere(3.6, $fn = 18); translate(m2) sphere(2.2, $fn = 16); }
  color(black) hull() { translate(m2 + dir * 0.4) sphere(1.95, $fn = 16); translate(tip) sphere(0.3, $fn = 8); }
  color(furHi) translate(mid + [0, -0.8, 0]) scale([2, 1, 2.2]) sphere(1.3, $fn = 14);
}
for (a = [-110, -80, -52, -26, 0, 26, 52, 80, 110]) tail(a, 17 - abs(a) * 0.02);
// A few lightning zigzags crackling over the tails.
for (s = [[-1, 1], [1, 1], [-1, 0], [1, 0]]) color(cyan) let(x = s[0] * (s[1] == 1 ? 8 : 12), z = s[1] == 1 ? 24 : 12)
  chain([[x, 7.5, z], [x + 1.2, 7.8, z + 1.6], [x - 0.4, 8, z + 2.6], [x + 1, 8.2, z + 4.2]], [0.25, 0.25, 0.25, 0.1], cyan);
