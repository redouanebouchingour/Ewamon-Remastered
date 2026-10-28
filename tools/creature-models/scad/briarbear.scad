// Briarbear: a hulking moss-green bear with bark pauldrons studded with berries and thorns, a leafy collar and a
// vine tail ending in a berry bud.
include <lib.scad>

green = [0.16, 0.42, 0.18];
greenDk = [0.1, 0.3, 0.12];
leaf = [0.5, 0.76, 0.22];
leafDk = [0.3, 0.58, 0.16];
cream = [0.96, 0.92, 0.76];
bark = [0.52, 0.32, 0.16];
barkDk = [0.36, 0.21, 0.1];
berry = [0.9, 0.2, 0.1];
dark = [0.06, 0.06, 0.05];

// Torso: broad and heavy, hunched forward.
blob([[[11, 9, 8], [0, 0.5, 10]], [[11.5, 9, 7.5], [0, 0, 18]]], green);
// Cream belly, and a cream band across the upper back.
ell([7, 3.4, 7], [0, -7.2, 12], cream);
ell([10.5, 5, 3.4], [0, 4.5, 21], cream);

// Head, set low and forward.
blob([[[7.5, 6.8, 6.5], [0, -4, 27]], [[6, 6, 5], [0, -2, 30]]], green);
// Cream crown patch (seen from behind) and muzzle.
ell([5, 4.5, 3], [0, -0.5, 32.5], cream);
blob([[[4.6, 3.2, 3], [0, -9.5, 25]], [[3.2, 3, 2.4], [0, -11, 26]]], cream);
ell([1.4, 1, 1], [0, -13.8, 26.6], dark);
color(dark) translate([0, -13, 24]) rotate([90, 0, 0]) scale([1.8, 0.4, 0.4]) cylinder(h = 0.6, r = 1, center = true, $fn = 12);
// Calm white eyes with dark pupils.
mirror_x() {
  eye([3.4, -9.8, 28.6], 1.5, iris = dark, sclera = cream, yaw = -22);
  color(greenDk) translate([3.4, -10.3, 30.2]) rotate([0, -12, -22]) scale([2, 0.7, 0.5]) sphere(1, $fn = 12);
}
// Round ears with brown inner.
mirror_x() {
  ell([2.4, 1.4, 2.4], [5.5, -2, 34], green);
  ell([1.4, 0.6, 1.4], [5.5, -3.2, 34], bark);
}

// Leafy collar around the neck.
for (i = [0 : 9]) {
  a = i * 360 / 10;
  petal([2.4, 1, 5.5], [8.5 * sin(a), -1 - 7 * cos(a), 24.5], [-50 * cos(a), 50 * sin(a), 0], i % 2 == 0 ? leaf : leafDk);
}
// Leaves sprouting up the back of the head.
for (p = [[-3.5, 5, 25, 20], [3.5, 5, 25, -20], [0, 6, 24, 0]]) {
  petal([1.8, 0.8, 4.5], [p[0], p[1], p[2]], [-35, p[3], 0], leaf);
}
// Leafy bib hanging down the chest.
for (p = [[-2.5, -8.5, 20, 20], [2.5, -8.5, 20, -20], [0, -9, 19, 0]]) {
  petal([1.8, 0.8, 4], [p[0], p[1], p[2]], [15, p[3], 0], leaf);
}

// Bark pauldrons: rough shells over each shoulder with a thorn and berries.
mirror_x() {
  color(bark) translate([11, 0, 21]) rotate([0, 30, 0]) scale([6, 7.5, 4.5]) difference() {
    sphere(1, $fn = 24);
    translate([0, 0, -1.3]) cube(2.4, center = true);
  }
  for (k = [-3 : 3 : 3]) color(barkDk) translate([11 + 0.1 * k, k, 21.2]) rotate([0, 30, 0]) scale([5.6, 0.35, 4.6]) sphere(1, $fn = 14);
  spike([13.5, 1, 24], [3.5, 1, 5], 1.4, 0.1, barkDk);
  spike([10.5, -3.5, 24.5], [0.5, -1, 4], 0.9, 0.1, leaf);
  ell([1.3, 1.3, 1.3], [9.5, -5.5, 23.5], berry);
  ell([1.3, 1.3, 1.3], [13, 3.5, 24], berry);
}

// Arms: heavy, with bark gauntlets and cream claws.
mirror_x() {
  limb([12, -1, 18], [13.5, -4, 10], 3.6, 3.4, green);
  blob([[[3.9, 4, 3], [13.6, -4.5, 9]], [[3.5, 3.5, 2.5], [13.8, -5, 5.5]]], bark);
  for (k = [-1 : 1]) ell([3.9, 0.3, 0.3], [13.6, -4.5 + k * 1.5, 8.4 + k], barkDk);
  for (a = [-30, 0, 30]) spike([13.8 + sin(a) * 2, -8, 4], [sin(a) * 0.5, -1.4, -0.6], 0.7, 0.1, cream);
}

// Legs: short trunks with bark boots and cream toes.
mirror_x() {
  ell([4.5, 4.8, 5], [6.5, 0, 5.5], green);
  blob([[[3.8, 4.5, 2], [6.8, -1.5, 2]], [[3.6, 3.6, 2.4], [6.8, 0.5, 3]]], barkDk);
  for (a = [-25, 0, 25]) ell([0.9, 1.2, 0.8], [6.8 + sin(a) * 2.6, -5.6, 0.9], cream);
}

// Vine tail curling out to the right, ending in a green bud with a red berry tip.
chain([[3, 8, 8], [9, 12, 6], [15, 12, 7], [18, 9, 10], [18, 7, 14]], [1.5, 1.3, 1.1, 1, 0.9], leafDk);
ell([2.6, 2.6, 2.8], [18, 7, 16.5], leaf);
ell([1.4, 1.4, 1.1], [18, 6.6, 19], berry);
