// Fennorange: a little tan fennec fox kit in a maroon fez with a green star, huge orange-flamed ears, a red-and-green
// plaid scarf, hugging a big orange to its side, its fluffy tail tipped in orange.
include <lib.scad>

fur = [0.86, 0.73, 0.48];
furDk = [0.72, 0.58, 0.36];
cream = [0.96, 0.88, 0.68];
earOut = [0.93, 0.5, 0.12];
earIn = [1, 0.58, 0.12, NOGLOW];
earGreen = [0.45, 0.6, 0.25];
fez = [0.5, 0.08, 0.1];
fezTop = [0.42, 0.06, 0.08];
star = [0.15, 0.45, 0.2];
scarfR = [0.6, 0.15, 0.12];
scarfG = [0.25, 0.42, 0.2];
orange = [0.96, 0.52, 0.1];
orangeHi = [1, 0.66, 0.25];
leafC = [0.3, 0.55, 0.2];
nose = [0.25, 0.15, 0.12];

// Big fennec ear from base p, pointing along d: a broad leaf of fur with a coloured inner face toward -Y and a
// coloured tip.
module ear(p, d, w, inner, tip, outer) {
  color(outer) hull() {
    translate(p) scale([w, w * 0.4, w * 0.8]) sphere(1, $fn = 18);
    translate(p + d * 0.45) scale([w * 0.95, w * 0.3, w * 0.95]) sphere(1, $fn = 14);
  }
  color(tip) hull() {
    translate(p + d * 0.45) scale([w * 0.94, w * 0.29, w * 0.94]) sphere(1, $fn = 14);
    translate(p + d) sphere(0.4, $fn = 8);
  }
  color(inner) hull() {
    translate(p + [0, -w * 0.4, 0.8]) scale([w * 0.65, w * 0.2, w * 0.55]) sphere(1, $fn = 14);
    translate(p + d * 0.45 + [0, -w * 0.32, 0]) scale([w * 0.6, w * 0.15, w * 0.6]) sphere(1, $fn = 12);
    translate(p + d * 0.85 + [0, -0.9, 0]) sphere(0.3, $fn = 8);
  }
}

// Orange fruit with a leaf.
module fruit(p, r) {
  ell([r, r, r * 0.92], p, orange);
  ell([r * 0.45, r * 0.2, r * 0.45], p + [-r * 0.3, -r * 0.82, r * 0.3], orangeHi);
  limb(p + [0, 0, r * 0.85], p + [0, 0, r * 1.1], r * 0.12, r * 0.1, leafC);
  petal([r * 0.5, r * 0.22, r * 0.08], p + [r * 0.4, 0, r * 1.05], [0, -20, 20], leafC);
}

// Body: small upright pear, cream belly.
blob([[[5.6, 4.8, 5], [0, 0.5, 9]], [[4.4, 3.8, 4], [0, 0, 14.5]]], fur);
ell([3.6, 2.2, 4.5], [0, -3.1, 10], cream);

// Plaid scarf: a red ring with green bands and a hanging end.
color(scarfR) translate([0, 0, 16.8]) scale([4.8, 4.4, 1.6]) sphere(1, $fn = 24);
for (dz = [-0.7, 0.7]) color(scarfG) translate([0, 0, 16.8 + dz]) scale([4.62, 4.22, 0.3]) sphere(1, $fn = 24);
color(scarfR) translate([2.4, -3.6, 14.2]) rotate([0, -12, 0]) scale([1.3, 0.6, 2.6]) sphere(1, $fn = 12);
color(scarfG) translate([2.6, -4.1, 13.8]) rotate([0, -12, 0]) scale([1.32, 0.3, 0.4]) sphere(1, $fn = 8);

// Head: round with a cream muzzle and cheek tufts.
ell([7.2, 6.2, 6], [0, -0.5, 23], fur);
mirror_x() spike([5.6, -1, 21.5], [2.2, 0, -1.4], 1.6, 0.1, fur);
blob([[[3.4, 2.4, 2.4], [0, -5, 21.6]], [[1.8, 1.8, 1.4], [0, -7, 21.8]]], cream);
ell([0.8, 0.6, 0.6], [0, -8.7, 22.3], nose);
// Smile.
color(nose) translate([0, -7.9, 20.6]) rotate([90, 0, 0]) scale([1.4, 0.35, 1]) cylinder(h = 0.4, r = 1, center = true, $fn = 12);
mirror_x() eye([2.8, -5.1, 24.6], 1.75, iris = [0.62, 0.15, 0.12], pupil = [0.2, 0.04, 0.04], yaw = -24, flat = 0.42);

// Ears.
mirror_x() ear([4.4, 0, 27], [8.5, 3, 9.5], 3.9, earIn, earOut, fur);

// Fez, tipped slightly.
translate([0.4, 0, 28.6]) rotate([0, 6, 0]) {
  color(fez) cylinder(h = 4.2, r1 = 3.3, r2 = 2.7, $fn = 24);
  color(fezTop) translate([0, 0, 4.2]) cylinder(h = 0.3, r = 2.7, $fn = 24);
  color(star) translate([0, -3.05, 2]) rotate([90 - 8, 0, 0]) linear_extrude(0.5, center = true)
    polygon([for (i = [0 : 9]) let(r = i % 2 == 0 ? 1.2 : 0.5, a = 90 + i * 36) [r * cos(a), r * sin(a)]]);
}

// Arms hugging the orange on the viewer's left; the other arm rests on it from the front.
fruit([-5.2, -4, 11.5], 4);
limb([-3.8, -0.5, 15], [-4.6, -4.4, 14], 1.3, 1.1, fur);
limb([3.8, -0.5, 15], [0, -5, 12.2], 1.3, 1.1, fur);
ell([1.3, 1.2, 1.1], [-0.6, -5.4, 12], fur);

// Legs and feet.
mirror_x() {
  ell([2.6, 2.8, 3.2], [3, 0.2, 5.2], fur);
  limb([3, 0, 4], [3, -0.5, 1.4], 1.8, 1.5, fur);
  ell([1.8, 2.6, 1.2], [3, -1.6, 1.2], furDk);
}

// Big fluffy tail on the viewer's right, rising with an orange tip.
blob([[[1.6, 1.6, 1.6], [1.5, 4, 6]], [[3.4, 3, 3.4], [7, 6.5, 7]], [[3.6, 3.2, 3.6], [9.5, 6.5, 11]]], fur);
blob([[[3.4, 3, 2.6], [9.8, 6.5, 13.4]], [[1.2, 1.2, 1.4], [10.2, 6, 18]]], earOut);
