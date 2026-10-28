// Lithokrysm: Pebblit evolved into a hunched stone warrior. A dark slate helm with gold seams and red eyes under a
// crown of amethyst and smoky quartz, a banded sandstone torso, two huge layered-rock shield arms fringed with
// amethyst, grey cobbled limbs and stump boots with claws.
include <lib.scad>

slate = [0.33, 0.31, 0.29];
slateHi = [0.46, 0.44, 0.41];
stone = [0.52, 0.53, 0.5];
stoneHi = [0.64, 0.64, 0.6];
sand = [0.74, 0.55, 0.38];
sandDark = [0.55, 0.36, 0.22];
rust = [0.72, 0.36, 0.16];
gold = [0.95, 0.75, 0.18];
amethyst = [0.36, 0.24, 0.42];
amethystLight = [0.72, 0.62, 0.78];
smoky = [0.6, 0.55, 0.5];
bark = [0.3, 0.25, 0.2];
clawC = [0.55, 0.3, 0.2];
red = [0.95, 0.2, 0.1];

module crystal(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.75, r = r, $fn = 6);
    translate([0, 0, l * 0.75]) cylinder(h = l * 0.25, r1 = r, r2 = 0.05, $fn = 6);
  }
}

// Torso: banded sandstone, narrow waist.
blob([[[6, 4.6, 4.2], [0, 0, 24]], [[4.2, 3.6, 3], [0, 0.5, 17.5]]], sand);
for (z = [18.5, 21, 23.5, 26]) color(sandDark) translate([0, 0, z]) scale([1, 0.86, 1]) rotate_extrude($fn = 28) translate([z > 22 ? 5.4 : 4.3, 0]) circle(0.45, $fn = 8);
// Back: a column of grey cobbles.
for (z = [17, 20, 23, 26]) ell([2.6, 1.6, 1.6], [0, 4, z], stoneHi);
// Hips.
ell([5, 3.6, 2.8], [0, 0.5, 15], stone);

// Shoulders: grey boulders.
mirror_x() ell([3.6, 3.4, 3.2], [6.5, 0, 26.5], stone);

// Head: a slate helm thrust forward, a beaked visor.
blob([[[6.4, 6.4, 5], [0, -3, 30]], [[3.8, 3.2, 3.2], [0, -8.5, 28]]], slate);
ell([4.8, 4.6, 3.4], [0, -2, 26.8], sand);
// Gold seams over the helm.
module seam(pts) { chain(pts, [for (p = pts) 0.4], gold); }
mirror_x() seam([[0.6, -11.4, 28.6], [1.8, -9.6, 31.8], [3.8, -7.4, 33.6], [5.6, -4, 34]]);
seam([[0, -9.2, 33.2], [0, -6.4, 35], [0, -2, 35.4]]);
// Red eyes glowing under the helm rim, gold lining around them.
mirror_x() {
  color(gold) translate([3.9, -7.9, 28.4]) rotate([0, 0, -25]) scale([1.6, 0.7, 1]) sphere(1, $fn = 14);
  color(red) translate([4, -8.4, 28.4]) rotate([0, 0, -25]) scale([1.1, 0.6, 0.75]) sphere(1, $fn = 14);
  color([1, 0.85, 0.5]) translate([3.8, -9, 28.6]) sphere(0.3, $fn = 8);
}
// Rock knobs around the crown.
for (a = [10 : 30 : 170]) ell([1.8, 1.6, 1.4], [5.8 * cos(a), -1 + 3.8 * sin(a) * 0.4, 33 + 1.2 * sin(a)], slateHi);

// Crown of crystals: amethyst and smoky quartz, fanning up and back.
crystal([0, -1, 33.5], [0, 0.6, 9.5], 1.5, amethyst);
mirror_x() {
  crystal([2.4, -2, 33.5], [0.8, 0.2, 8], 1.3, smoky);
  crystal([4.4, -1, 33], [2, 0.8, 8], 1.3, amethyst);
  crystal([5.6, 0.5, 32], [3.8, 1.2, 6.5], 1.2, smoky);
  crystal([6.2, 2, 30.5], [5.2, 1.5, 4], 1.1, amethyst);
  crystal([1.8, 1.5, 33], [0.6, 1.4, 6.5], 1.1, amethystLight);
}

// Shield arms: a short grey upper arm into a huge layered stone shield with an amethyst fringe hanging below.
module shield() {
  translate([12.5, -3, 19]) rotate([0, 0, -20]) rotate([0, -14, 0]) {
    color(slate) scale([7, 3, 10]) sphere(1, $fn = 28);
    color(rust) translate([0.5, -0.4, -0.6]) scale([5.6, 3.1, 8.2]) sphere(1, $fn = 26);
    color(bark) translate([0.9, -0.6, -0.6]) scale([4.6, 3.15, 6.8]) sphere(1, $fn = 26);
    color(slateHi) translate([1.4, -0.8, -0.2]) scale([3, 3.1, 4.6]) sphere(1, $fn = 22);
    color(sandDark) translate([1.9, -1, 0.4]) scale([1.4, 3, 2.4]) sphere(1, $fn = 16);
    // Amethyst fringe along the lower and outer edge.
    for (i = [0 : 7]) {
      t = -40 + i * 20;
      p = [7 * sin(t) * 0.85, 0, -10 * cos(t) * 0.82];
      crystal(p, [sin(t) * 4.5, 0, -6 + abs(t) / 25], 1.3, i % 3 == 0 ? amethyst : amethystLight);
    }
  }
}
mirror_x() {
  limb([7, 0, 26], [10.5, -1, 23], 2.2, 2, stone);
  shield();
}

// Legs: grey cobbled thighs and shins, dark stump boots, rust claws.
mirror_x() {
  ell([2.8, 3, 3.4], [4.2, 0, 12.5], stone);
  limb([4.4, 0, 11], [5.6, -1.5, 7], 2.4, 2.2, stoneHi);
  ell([1.6, 1.4, 1.4], [5.6, -2.8, 8.6], stone);
  color(bark) translate([5.8, -1.2, 0]) cylinder(h = 6.5, r1 = 2.7, r2 = 2.3, $fn = 7);
  color(slateHi) translate([5.8, -1.2, 6.2]) cylinder(h = 0.8, r = 2.4, $fn = 7);
  for (a = [-35, 0, 35]) spike([5.8 + sin(a) * 1.6, -3.4, 0.7], [sin(a) * 0.8, -1.8, -0.5], 0.6, 0.05, clawC);
}
