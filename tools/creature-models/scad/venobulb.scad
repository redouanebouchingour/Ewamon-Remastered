// Venobulb: Snapling grown into a hulking dark-green brute, purple veins over its hide, a huge fanged maw in its chest,
// clusters of small flytraps sprouting from its shoulders, a long tail studded with purple thorns, dripping venom.
include <lib.scad>
$fa = 12;
$fs = 1.1;

skin = [0.2, 0.42, 0.22];
skinHi = [0.32, 0.58, 0.3];
skinDark = [0.12, 0.28, 0.14];
mouthIn = [0.1, 0.24, 0.12];
throat = [0.06, 0.1, 0.06];
fang = [0.97, 0.92, 0.75];
leaf = [0.42, 0.7, 0.25];
vein = [0.55, 0.22, 0.75];
trapIn = [0.6, 0.35, 0.4];
slime = [0.75, 0.95, 0.3];

// Half of a hollow ellipsoid (a bowl opening downward), green outside, dark inside, fangs on the rim pointing down.
module jaw(r, nTeeth, toothLen, fn = 24, c = undef) {
  color(c == undef ? skin : c) difference() {
    scale(r) sphere(1, $fn = fn);
    scale(r * 0.86) sphere(1, $fn = fn);
    translate([0, 0, -r[2] * 1.5]) cube([r[0] * 3, r[1] * 3, r[2] * 3], center = true);
  }
  color(mouthIn) difference() {
    scale(r * 0.86) sphere(1, $fn = fn * 0.75);
    scale(r * 0.8) sphere(1, $fn = fn * 0.75);
    translate([0, 0, -r[2] * 1.5]) cube([r[0] * 3, r[1] * 3, r[2] * 3], center = true);
  }
  // Lip rim.
  color(skinHi) scale([r[0], r[1], 0.6]) difference() {
    cylinder(h = 1, r = 1, center = true, $fn = fn);
    cylinder(h = 2, r = 0.86, center = true, $fn = fn);
  }
  // Fangs around the front three quarters of the rim.
  for (i = [0 : nTeeth - 1]) let(a = -20 - i * 220 / (nTeeth - 1))
    spike([r[0] * 0.93 * cos(a), r[1] * 0.93 * sin(a), 0], [0, 0, -toothLen * (0.8 + 0.4 * (i % 2))], toothLen * 0.25, 0.05, fang);
}

// Hulking body: big humped shoulders over a lower rump.
blob([[[10, 9, 9], [0, -2, 15]], [[8, 8, 7], [0, 7, 12]]], skin);
ell([7, 6, 5], [0, -6, 9], skinHi);

// The maw in the front of the body: jaws hinged deep in the chest, gaping wide.
HEAD = [0, -6, 15];
JR = [7.5, 8, 5];
translate(HEAD) rotate([-30, 0, 0]) translate([0, -JR[1] * 0.75, 0]) jaw(JR, 12, 2.6, 20);
translate(HEAD) rotate([16, 0, 0]) translate([0, -JR[1] * 0.75, 0]) mirror([0, 0, 1]) jaw(JR * 0.95, 11, 2.4, 20);
ell([3.6, 1.4, 3.4], HEAD + [0, -2.6, 0.4], throat);
// Tongue lolling out of the bottom jaw.
blob([[[2.4, 3, 1], HEAD + [0, -6, -2.6]], [[1.8, 2, 0.8], HEAD + [0, -10, -3.4]]], [0.3, 0.5, 0.3]);
// Venom drips off the fangs.
for (p = [[-3.5, -16.5, 13], [2.8, -17.5, 12], [5.4, -14, 13], [-5.6, -13.5, 12.5]]) chain([p, p + [0, 0, -2], p + [0, 0, -3.4]], [0.35, 0.3, 0.5], slime);

// Purple veins branching over the hide.
module veinline(pts) chain(pts, [for (p = pts) 0.65], vein);
function onBody(az, el) = [10.9 * cos(el) * cos(az), -2 + 9.9 * cos(el) * sin(az), 15 + 9.9 * sin(el)];
for (v = [[20, 60, -20], [60, 50, 20], [110, 55, -15], [160, 45, 15], [200, 50, -10], [-20, 30, 20], [140, 20, -20], [40, 15, 15], [180, 10, 10], [0, 70, 30], [70, 25, -25], [100, 30, 25], [30, 5, 20], [150, 5, -20], [90, 0, 15], [-30, 15, -15], [210, 15, 15]])
  veinline([for (k = [0 : 5]) onBody(v[0] + v[2] * sin(k * 36), v[1] - k * 7)]);

// Flytrap clusters on the shoulders: little open traps with fangs and a ring of leaves.
module trap(p, pitch, yaw, s = 1) {
  r = [2.2, 2.4, 1.4];
  translate(p) rotate([0, 0, yaw]) rotate([pitch, 0, 0]) scale(s) {
    rotate([-40, 0, 0]) translate([0, -r[1] * 0.7, 0]) jaw(r, 4, 0.9, 10, leaf);
    rotate([30, 0, 0]) translate([0, -r[1] * 0.7, 0]) mirror([0, 0, 1]) jaw(r, 4, 0.9, 10, leaf);
    color(trapIn) translate([0, -1, 0]) scale([1.2, 0.6, 1]) sphere(1, $fn = 10);
  }
}
mirror_x() {
  for (l = [0 : 4]) let(a = l * 72) petal([4, 1.5, 0.5], [7 + 3 * cos(a), -1 + 3 * sin(a), 22.8], [0, -20, a], leaf);
  trap([7, -2, 26], -50, 0, 1.4);
  trap([10.4, 0.5, 24.5], -40, 70, 1.15);
  trap([4.6, 2, 25], -40, -60, 1.15);
}
// Back: a third cluster leaf crown on the rump.
for (l = [0 : 4]) let(a = l * 72 + 20) petal([2.6, 1, 0.4], [0, 7 + 2 * sin(a), 19 + 0.0 + 0 * cos(a)] + [2 * cos(a), 0, 0], [0, -15, a], leaf);

// Thick arms planted wide, heavy hind legs, clawed feet.
module foot(p) {
  blob([[[2.6, 3, 1.3], p], [[2, 1.8, 1.3], p + [0, 1.6, 0.4]]], skin);
  for (a = [-35, 0, 35]) spike(p + [sin(a) * 2, -cos(a) * 2.6, -0.2], [sin(a) * 0.5, -1.2, -0.6], 0.5, 0.05, skinHi);
}
mirror_x() {
  limb([8.5, -4, 17], [12, -7, 8], 3.6, 2.8, skin);
  limb([12, -7, 8], [12.4, -8.5, 1.6], 2.8, 2.2, skin);
  veinline([[9.5, -5.6, 17.5], [11.5, -8.4, 11], [12.4, -9.8, 6]]);
  foot([12.4, -9.5, 1.3]);
  ell([4.4, 5, 5.4], [6.8, 8, 9.5], skin);
  veinline([[10.6, 6, 12], [11.2, 9, 9.5], [10.2, 11, 6.5], [9, 9, 4]]);
  veinline([[9, 4, 14.5], [8.4, 9, 14.6], [6.5, 12.6, 12]]);
  limb([7.4, 9, 7], [8.4, 7, 1.6], 2.8, 2.2, skin);
  foot([8.4, 6.2, 1.3]);
}

// Long tail sweeping back and round to the viewer's right, studded with purple thorns.
tail = [[0, 13, 10], [3, 19, 7], [9, 22, 4], [15, 19, 2.5], [18, 13, 1.8], [17.5, 8, 1.4]];
trs = [4, 3.2, 2.5, 1.9, 1.4, 0.7];
chain(tail, trs, skin);
for (i = [0 : len(tail) - 2], f = [0.5]) let(p = tail[i] * (1 - f) + tail[i + 1] * f, r = trs[i] * (1 - f) + trs[i + 1] * f)
  for (sd = [-1, 0, 1]) spike(p + [sd * r * 0.6, 0, r * 0.75], [sd * 1.2, 0, 1.6], 0.5, 0.05, vein);
