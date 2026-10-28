// Roobrawler: Joeyjab grown into a muscled kangaroo fighter: red hand wraps raised in guard, a gold champion's belt,
// a cream six-pack and a thick tail bound in white bandages.
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

fur = [0.8, 0.52, 0.24];
furDk = [0.66, 0.4, 0.17];
cream = [0.98, 0.88, 0.62];
creamDk = [0.88, 0.74, 0.48];
earIn = [0.98, 0.8, 0.6];
wrap = [0.8, 0.15, 0.1];
wrapDk = [0.55, 0.08, 0.06];
gold = [0.98, 0.78, 0.12];
goldHi = [1, 0.92, 0.4];
bandage = [0.94, 0.92, 0.86];
bandageDk = [0.75, 0.72, 0.66];
nose = [0.1, 0.07, 0.06];
claw = [0.97, 0.9, 0.7];

// Torso: broad chest, narrow waist.
blob([[[5.4, 4.6, 5], [0, 0.6, 15]], [[7.6, 5.6, 5], [0, 0, 22]]], fur);
// Cream chest and abs.
blob([[[4.2, 2.6, 4], [0, -3.4, 15]], [[5.2, 3, 3.4], [0, -3.6, 21.5]]], cream);
mirror_x() ell([2.4, 1, 1.8], [2.2, -6.2, 22], creamDk);
for (z = [15.6, 18.4]) mirror_x() ell([1.3, 0.6, 1], [1.4, -5.9, z], creamDk);
// Shoulder and pec bulk.
mirror_x() ell([3.4, 3.4, 3.2], [7, 0, 23.2], fur);

// Back muscles: shoulder blades and lats either side of a darker spine groove.
mirror_x() {
  color(furDk) translate([3.2, 4.7, 22.4]) rotate([0, -14, 0]) scale([2.4, 1, 2.8]) sphere(1, $fn = 16);
  color(fur) translate([3.4, 4.9, 22.8]) rotate([0, -14, 0]) scale([2.1, 1, 2.4]) sphere(1, $fn = 16);
  color(furDk) translate([3.6, 4.1, 17.8]) rotate([0, 20, 0]) scale([1.8, 0.8, 3]) sphere(1, $fn = 14);
}
limb([0, 5.3, 25], [0, 4.8, 14.5], 0.45, 0.35, furDk);

// Gold championship belt with a round buckle plate.
color(gold) translate([0, 0.6, 12.6]) scale([7.4, 6.2, 1]) cylinder(h = 2.4, r = 1, center = true, $fn = 32);
color(gold) translate([0, -5.8, 12.6]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 2.6, center = true, $fn = 24);
color(goldHi) translate([0, -6.3, 12.6]) rotate([90, 0, 0]) cylinder(h = 0.6, r = 1.6, center = true, $fn = 20);

// Head: a longer, leaner head with a pointed muzzle.
ell([4.8, 4.8, 4.8], [0, -0.6, 30], fur);
blob([[[3.2, 3, 2.4], [0, -4.4, 28.6]], [[1.4, 1.4, 1.2], [0, -8.2, 28.4]]], fur);
blob([[[2.6, 2.2, 1.6], [0, -4.8, 27.4]], [[1.2, 1.2, 0.9], [0, -7.8, 27.6]]], cream);
ell([0.9, 0.7, 0.6], [0, -9.4, 28.9], nose);
// Narrow, determined eyes under hooded lids.
mirror_x() {
  eye([2.5, -4.1, 30.5], 1.5, iris = [0.5, 0.26, 0.1], pupil = [0.1, 0.05, 0.03], yaw = 8, flat = 0.4,
      lid = 0.46, lid_tilt = 28, lid_c = [0.3, 0.17, 0.08], slit = 0.5);
  brow([2.5, -4.1, 30.5], 1.5, 0.5, furDk, 8);
}
// Long ears.
mirror_x() {
  petal([1.8, 1, 5.4], [2.8, 0.6, 37.5], [0, 12, 0], fur);
  petal([1, 0.5, 4], [2.9, -0.2, 37.5], [0, 12, 0], earIn);
}

// Arms raised in guard: muscled upper arms, fists wrapped in red tape up near the chin.
mirror_x() {
  limb([8.2, 0, 23], [9.4, -3, 17.5], 2.4, 2, fur);
  limb([9.4, -3, 17.5], [6.4, -6.5, 24], 1.9, 1.6, fur);
  color(wrap) hull() {
    translate([6.4, -6.6, 24]) sphere(1.7, $fn = 12);
    translate([5.6, -7.6, 26.4]) scale([1.4, 1.3, 1.4]) sphere(1.6, $fn = 12);
  }
  // Tape lines.
  for (z = [24.4, 25.6]) color(wrapDk) translate([6, -7.2, z]) rotate([-30, 0, 0]) scale([1, 1, 0.18]) sphere(2.15, $fn = 14);
}

// Legs: powerful haunches, long feet with cream toe claws.
mirror_x() {
  ell([4, 5, 5.4], [4.8, 1.4, 8.4], fur);
  limb([5, 2.6, 5], [5.2, 2, 1.6], 1.8, 1.4, fur);
  blob([[[2, 4.2, 1.3], [5.2, -1.6, 1.3]], [[1.6, 1.6, 1.3], [5.2, 1.4, 1.5]]], fur);
  for (a = [-25, 0, 25]) spike([5.2 + sin(a) * 1.2, -5.2, 0.9], [sin(a) * 0.5, -1.5, -0.4], 0.55, 0.06, claw);
}

// Thick tail out behind to the viewer's right, bound in white bandages.
tpts = [[0, 4.5, 10], [4, 8.5, 6], [10, 9, 5.5], [15, 7, 9], [17, 4.5, 15]];
trs = [3.6, 3.2, 2.8, 2.2, 1.2];
chain([tpts[0], tpts[1]], [trs[0], trs[1]], fur);
chain([tpts[3], tpts[4]], [trs[3], trs[4]], fur);
chain([tpts[1], tpts[2], tpts[3]], [trs[1] * 1.08, trs[2] * 1.08, trs[3] * 1.08], bandage);
// Bandage wrap ridges.
for (t = [0.15 : 0.22 : 0.95]) {
  p = t < 0.5 ? tpts[1] + (tpts[2] - tpts[1]) * t * 2 : tpts[2] + (tpts[3] - tpts[2]) * (t - 0.5) * 2;
  r = t < 0.5 ? trs[1] + (trs[2] - trs[1]) * t * 2 : trs[2] + (trs[3] - trs[2]) * (t - 0.5) * 2;
  d = t < 0.5 ? tpts[2] - tpts[1] : tpts[3] - tpts[2];
  color(bandageDk) translate(p) rotate(_dir_rot(d)) scale([1, 1, 0.12]) sphere(r * 1.12, $fn = 18);
}
