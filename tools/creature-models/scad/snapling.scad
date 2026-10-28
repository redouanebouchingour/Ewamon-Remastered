// Snapling: a lime-green lizard whose head is a gaping flytrap full of cream fangs, leaves at its neck, its tail
// curling up into a purple star-shaped bud.
include <lib.scad>
$fa = 12;
$fs = 1.1;

skin = [0.5, 0.8, 0.2];
skinHi = [0.66, 0.9, 0.3];
skinDark = [0.3, 0.55, 0.12];
mouthIn = [0.12, 0.35, 0.12];
throat = [0.05, 0.15, 0.06];
fang = [0.97, 0.92, 0.75];
leaf = [0.4, 0.72, 0.18];
bud = [0.35, 0.18, 0.45];
budHi = [0.55, 0.35, 0.68];

// Half of a hollow ellipsoid (a bowl opening downward), green outside, dark inside, fangs on the rim pointing down.
module jaw(r, nTeeth, toothLen) {
  color(skin) difference() {
    scale(r) sphere(1, $fn = 24);
    scale(r * 0.86) sphere(1, $fn = 24);
    translate([0, 0, -r[2] * 1.5]) cube([r[0] * 3, r[1] * 3, r[2] * 3], center = true);
  }
  color(mouthIn) difference() {
    scale(r * 0.86) sphere(1, $fn = 18);
    scale(r * 0.8) sphere(1, $fn = 18);
    translate([0, 0, -r[2] * 1.5]) cube([r[0] * 3, r[1] * 3, r[2] * 3], center = true);
  }
  // Lip rim.
  color(skinHi) scale([r[0], r[1], 0.6]) difference() {
    cylinder(h = 1, r = 1, center = true, $fn = 28);
    cylinder(h = 2, r = 0.86, center = true, $fn = 28);
  }
  // Fangs around the front three quarters of the rim.
  for (i = [0 : nTeeth - 1]) let(a = -20 - i * 220 / (nTeeth - 1))
    spike([r[0] * 0.93 * cos(a), r[1] * 0.93 * sin(a), 0], [0, 0, -toothLen * (0.8 + 0.4 * (i % 2))], 0.55, 0.05, fang);
}

HEAD = [0, -9, 15];   // hinge of the jaws (back of the head)
JR = [7, 8.5, 4.8];
// Upper jaw, swung open up and back.
translate(HEAD) rotate([-38, 0, 0]) translate([0, -JR[1] * 0.75, 0]) jaw(JR, 11, 2.2);
// Lower jaw, dropped down.
translate(HEAD) rotate([14, 0, 0]) translate([0, -JR[1] * 0.75, 0]) mirror([0, 0, 1]) jaw(JR * 0.95, 10, 2);
// Throat in the back of the mouth.
ell([3, 1.4, 3], HEAD + [0, -2.4, 0.4], throat);
// Neck joining the head to the body.
limb(HEAD + [0, 1, 0], [0, -4, 13], 4.2, 4.6, skin);
// Leaf collar at the neck.
for (s = [[1, 25], [-1, 25], [1, -10], [-1, -10]])
  petal([4.2, 1, 2.2], [s[0] * 5, -5.5, 14 + s[1] * 0.05], [0, s[0] * -s[1], s[0] * 50], leaf);
mirror_x() petal([3.4, 0.9, 1.8], [3.8, -4.4, 18.2], [0, -40, 30], skinHi);

// Body, a long low lizard torso.
blob([[[5.4, 6, 5], [0, -2, 12]], [[5.2, 6, 4.6], [0, 6, 11.4]]], skin);
ell([3.6, 7.5, 2.4], [0, 2, 8], skinHi);
// Leafy scale pattern on the back.
for (p = [[2.6, -1, 16.2], [-2.6, -1, 16.2], [0, 3, 16.7], [2.6, 7, 15.4], [-2.6, 7, 15.4]]) color(skinHi) translate(p) scale([1.6, 2, 0.5]) sphere(1, $fn = 12);

// Legs, splayed, with three stubby toes.
module foot(p) {
  blob([[[1.8, 2.2, 1], p], [[1.4, 1.2, 1], p + [0, 1.2, 0.3]]], skin);
  for (a = [-35, 0, 35]) ell([0.55, 0.9, 0.55], p + [sin(a) * 1.6, -cos(a) * 1.9, -0.2], skinHi);
}
mirror_x() {
  limb([4.2, -3, 11], [7, -4.5, 6], 2.4, 1.8, skin);
  limb([7, -4.5, 6], [7.4, -5.5, 1.2], 1.8, 1.5, skin);
  foot([7.4, -6, 1]);
  ell([3, 4, 4.4], [4.6, 7.5, 10], skin);
  limb([5.2, 8.5, 8], [6.4, 7, 1.2], 2, 1.5, skin);
  foot([6.4, 6, 1]);
}

// Tail: sweeps back, then curls high up over the body, ending in a purple star bud.
tail = [[0, 11, 11], [2, 16, 11], [4, 20, 15], [4.5, 20.5, 21], [3.5, 17, 25], [3, 13, 26.5], [3.5, 10.5, 29]];
chain(tail, [3.2, 2.7, 2.3, 1.9, 1.6, 1.3, 1], skin);
translate([3.5, 10, 30.4]) rotate([-25, 0, 20]) scale(1.5) {
  for (i = [0 : 4]) let(a = i * 72) color(i % 2 == 0 ? bud : budHi) hull() {
    scale([1, 1, 0.5]) sphere(1.8, $fn = 12);
    translate([4.2 * cos(a), 4.2 * sin(a), 0.4]) sphere(0.15, $fn = 6);
  }
  color(budHi) translate([0, 0, 0.9]) scale([1.3, 1.3, 0.9]) sphere(1, $fn = 12);
  for (a = [36, 180, 300]) color(skinHi) translate([1.6 * cos(a), 1.6 * sin(a), 1.2]) sphere(0.35, $fn = 8);
}
// Spores drifting around the bud.
for (p = [[8, 7, 34], [1, 9, 34.5], [9, 11, 28]]) ell([0.4, 0.4, 0.4], p, skinHi);
