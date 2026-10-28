// Berkest: Fennorange grown into a lanky street juggler. A tan fennec in a maroon fez with a green star, tall ears with
// orange insides, a green vest trimmed in red and gold over a plaid scarf with flapping ends, orange-gloved hands
// tossing four oranges in an arc around it, and a big bushy tail.
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

fur = [0.84, 0.72, 0.48];
furDk = [0.7, 0.57, 0.36];
cream = [0.95, 0.87, 0.68];
earIn = [1, 0.58, 0.14, NOGLOW];
fez = [0.5, 0.08, 0.1];
fezTop = [0.42, 0.06, 0.08];
star = [0.15, 0.45, 0.2];
vest = [0.2, 0.4, 0.18];
vestDk = [0.14, 0.3, 0.13];
trimR = [0.65, 0.16, 0.12];
trimY = [0.85, 0.65, 0.2];
scarfR = [0.6, 0.15, 0.12];
scarfG = [0.25, 0.42, 0.2];
glove = [0.93, 0.45, 0.12, NOGLOW];
orange = [0.96, 0.5, 0.1];
orangeHi = [1, 0.66, 0.25];
leafC = [0.3, 0.55, 0.2];
nose = [0.25, 0.15, 0.12];
swoosh = [0.95, 0.6, 0.2];

module ear(p, d, w, inner, tip, outer) {
  color(outer) hull() {
    translate(p) scale([w, w * 0.4, w * 0.8]) sphere(1, $fn = 18);
    translate(p + d * 0.45) scale([w * 0.85, w * 0.3, w * 0.85]) sphere(1, $fn = 14);
  }
  color(tip) hull() {
    translate(p + d * 0.45) scale([w * 0.84, w * 0.29, w * 0.84]) sphere(1, $fn = 14);
    translate(p + d) sphere(0.4, $fn = 8);
  }
  color(inner) hull() {
    translate(p + [0, -w * 0.4, 0.8]) scale([w * 0.6, w * 0.2, w * 0.55]) sphere(1, $fn = 14);
    translate(p + d * 0.45 + [0, -w * 0.32, 0]) scale([w * 0.55, w * 0.15, w * 0.55]) sphere(1, $fn = 12);
    translate(p + d * 0.85 + [0, -0.9, 0]) sphere(0.3, $fn = 8);
  }
}

module fruit(p, r) {
  ell([r, r, r * 0.92], p, orange);
  ell([r * 0.4, r * 0.2, r * 0.4], p + [-r * 0.3, -r * 0.82, r * 0.3], orangeHi);
  limb(p + [0, 0, r * 0.85], p + [0, 0, r * 1.15], r * 0.12, r * 0.1, leafC);
  petal([r * 0.55, r * 0.22, r * 0.1], p + [r * 0.45, 0, r * 1.1], [0, -20, 20], leafC);
}

module fezHat(p, tilt) {
  translate(p) rotate([0, tilt, 0]) {
    color(fez) cylinder(h = 4, r1 = 3, r2 = 2.5, $fn = 24);
    color(fezTop) translate([0, 0, 4]) cylinder(h = 0.3, r = 2.5, $fn = 24);
    color(star) translate([0, -2.8, 2]) rotate([90 - 7, 0, 0]) linear_extrude(0.5, center = true)
      polygon([for (i = [0 : 9]) let(r = i % 2 == 0 ? 1.1 : 0.45, a = 90 + i * 36) [r * cos(a), r * sin(a)]]);
  }
}

// Legs: long, slightly bent digitigrade legs.
mirror_x() {
  limb([2.6, 0.5, 12], [3.4, 1.4, 6], 1.8, 1.3, fur);
  limb([3.4, 1.4, 6], [3.4, 0.6, 1.4], 1.3, 1.1, fur);
  ell([1.5, 2.6, 1.1], [3.4, -1, 1.1], furDk);
}

// Torso: slim, with a cream chest and the green vest wrapped round it.
blob([[[4.4, 3.4, 3.6], [0, 0.4, 13]], [[4.6, 3.6, 4.2], [0, 0, 19]]], fur);
// Vest: open at the front so the cream chest shows.
color(vest) difference() {
  hull() {
    translate([0, 0.4, 13.4]) scale([4.8, 3.8, 3.6]) sphere(1, $fn = 26);
    translate([0, 0, 19]) scale([5, 4, 4.4]) sphere(1, $fn = 26);
  }
  translate([0, -5, 17]) scale([1.6, 3, 7]) sphere(1, $fn = 16);
}
ell([1.8, 1.2, 5], [0, -3.3, 17.5], cream);
// Red + gold trim along the hem.
color(trimR) translate([0, 0.4, 11.4]) scale([4.6, 3.6, 0.9]) sphere(1, $fn = 26);
color(trimY) translate([0, 0.4, 12.4]) scale([4.85, 3.85, 0.45]) sphere(1, $fn = 26);
// Gold embroidery on the back.
for (x = [-2, 0, 2]) for (z = [15, 17.5]) color(trimY) translate([x, 3.9, z]) scale([0.6, 0.3, 0.6]) sphere(1, $fn = 8);

// Plaid scarf with two flapping ends trailing to either side.
color(scarfR) translate([0, 0, 22.6]) scale([3.8, 3.4, 1.4]) sphere(1, $fn = 24);
for (dz = [-0.6, 0.6]) color(scarfG) translate([0, 0, 22.6 + dz]) scale([3.65, 3.25, 0.28]) sphere(1, $fn = 24);
mirror_x() {
  color(scarfR) hull() {
    translate([3, -1.5, 22]) sphere(0.8, $fn = 10);
    translate([8, -2.4, 19.5]) scale([1.4, 0.4, 1]) sphere(1, $fn = 10);
  }
  color(scarfG) translate([6.8, -2.4, 20.1]) rotate([0, 26, 0]) scale([0.4, 0.5, 1.1]) sphere(1, $fn = 8);
}

// Head: a narrower fox head with a pointed cream muzzle and a sly grin.
blob([[[5.2, 4.6, 4.6], [0, -0.3, 27.6]], [[3.6, 3.6, 3.2], [0, -2, 26.4]]], fur);
mirror_x() spike([4.4, -0.6, 26], [2, 0.4, -1.4], 1.3, 0.1, fur);
blob([[[2.4, 2, 1.8], [0, -4, 26]], [[1, 1.2, 0.9], [0, -7, 26.4]]], cream);
ell([0.65, 0.5, 0.5], [0, -8, 26.8], nose);
color(nose) translate([0.4, -6.5, 25.3]) rotate([90, 0, 10]) scale([1.4, 0.3, 1]) cylinder(h = 0.4, r = 1, center = true, $fn = 12);
mirror_x() {
  eye([2.2, -3.55, 28.6], 1.55, iris = [0.88, 0.16, 0.1], pupil = [0.2, 0.03, 0.03], yaw = 8, flat = 0.42, lid = 0.46, lid_tilt = 20, lid_c = furDk, slit = 0.4);
  brow([2.2, -3.55, 28.6], 1.55, 0.42, fur, 8);
}

// Tall ears and the fez between them.
mirror_x() ear([3.2, 0.4, 30.5], [5, 2.5, 11.5], 3, earIn, fur, fur);
fezHat([0.2, 0, 31.4], 5);

// Arms held out to the sides, orange-gloved hands palm up.
mirror_x() {
  limb([4.4, 0, 20.5], [7.6, -1, 16.5], 1.2, 1, fur);
  limb([7.6, -1, 16.5], [10.4, -3, 16], 1, 0.9, fur);
  ell([1.4, 1.5, 0.9], [11.2, -3.4, 15.9], glove);
  for (a = [-30, 0, 30]) limb([11.2, -3.6, 16.2], [11.2 + sin(a) * 1.8, -3.6 - cos(a) * 1.6, 16.8], 0.35, 0.3, glove);
}

// Four oranges juggled in an arc around it, with motion swooshes.
fruit([-12, -3, 25], 1.9);
fruit([-13, -3, 19.5], 1.8);
fruit([11, -3, 23.5], 1.8);
fruit([6, -4, 31.5], 1.6);
module swooshArc(c, r, a0, a1, z0) {
  for (a = [a0 : 12 : a1 - 12]) limb(c + [r * cos(a), 0, r * sin(a)], c + [r * cos(a + 12), 0, r * sin(a + 12)], 0.3, 0.3, swoosh);
}
swooshArc([-10, -3, 22], 5.5, 120, 228, 0);
swooshArc([10, -3, 22], 5.5, -40, 60, 0);

// Big bushy tail curving out to the viewer's right.
blob([[[1.4, 1.4, 1.4], [1.2, 3.4, 11]], [[3.6, 3.2, 3.4], [6, 6, 7.5]], [[4.6, 3.6, 4.6], [11, 6, 10]]], fur);
blob([[[4.4, 3.4, 4], [11.8, 6, 12]], [[1.8, 1.6, 2], [13, 5.5, 18]]], [0.9, 0.79, 0.56]);
