// Ultraze: a hunched gunmetal war robot. Skull face with a molten orange maw and red eyes under swept-back crests,
// a red core in its chest, red seams glowing between the plates, huge rounded pauldrons, clawed hands (the right one
// behind an armoured forearm shield) and exhaust stacks on its back puffing red smoke.
include <lib.scad>

metal = [0.42, 0.43, 0.48];
metalHi = [0.64, 0.65, 0.7];
metalDark = [0.2, 0.2, 0.24];
seam = [0.85, 0.1, 0.1];
core = [1, 0.15, 0.2];
coreHot = [1, 0.6, 0.6];
maw = [1, 0.45, 0.1];
smoke = [0.75, 0.12, 0.08];

// A glowing seam line between two points.
module seamLine(a, b, r = 0.35) { limb(a, b, r, r, seam); }

// Pelvis and waist.
blob([[[6, 4.5, 3.5], [0, 1, 17]]], metalDark);
ell([5.5, 4, 2.4], [0, 0.5, 17.5], metal);
// Torso: a broad chest plate over a narrow ribbed abdomen.
blob([[[4, 3.4, 4], [0, 1, 21]]], metalDark);
for (z = [19.5, 21.5, 23.5]) color(metal) translate([0, -1, z]) scale([3.6, 2.8, 0.8]) sphere(1, $fn = 18);
for (z = [20.5, 22.5]) seamLine([-3, -3.3, z], [3, -3.3, z], 0.25);
blob([[[9, 6, 5], [0, 2, 29]], [[7, 5, 3], [0, 1, 25.5]]], metal);
color(metalHi) translate([0, -2.4, 29]) scale([6.5, 2.4, 3.6]) sphere(1, $fn = 24);
// Chest core with a red halo.
ell([2, 1, 2], [0, -4.9, 28.2], seam);
ell([1.4, 0.9, 1.4], [0, -5.6, 28.2], core);
ell([0.6, 0.5, 0.6], [0.3, -6.3, 28.5], coreHot);
mirror_x() {
  seamLine([2.2, -4.4, 29], [6.5, -2.4, 31]);
  seamLine([2, -4.2, 27], [5.5, -3, 25]);
  seamLine([1.2, -3.6, 25.5], [1.2, -3, 19]);
}

// Exhaust stacks on the back, smoking red.
for (st = [[-3, 6.5, 30, 7], [0.5, 7.5, 31, 9], [4, 6.5, 30, 6]]) {
  color(metalDark) translate([st[0], st[1], st[2]]) cylinder(h = st[3], r = 1.3, $fn = 14);
  color(metalHi) translate([st[0], st[1], st[2] + st[3]]) cylinder(h = 0.6, r = 1.6, $fn = 14);
  color(seam) translate([st[0], st[1], st[2] + st[3] + 0.4]) cylinder(h = 0.3, r = 1, $fn = 12);
}
// Red smoke curling up off two stacks.
module puff(p, d, r) { color(smoke) hull() { translate(p) sphere(r, $fn = 10); translate(p + d) sphere(0.15, $fn = 6); } }
puff([0.5, 7.5, 40.5], [1.5, 0, 4], 1.2);
puff([2, 7.5, 43.5], [2.5, 0, 2.5], 0.9);
puff([-3, 6.5, 37.5], [-1, 0, 3.5], 1);
puff([-4, 6.5, 40.5], [-2, 0, 2], 0.7);
color(smoke) translate([4.5, 7.5, 46]) cube(0.8, center = true);
color(smoke) translate([-6, 6.5, 43]) cube(0.6, center = true);
// Back plating with spine seam.
blob([[[7, 3, 5], [0, 5, 27]]], metalDark);
seamLine([0, 8.1, 31], [0, 8.1, 23]);

// Legs: thick thighs, knee joints, shins back, clawed feet; wide crouched stance.
mirror_x() {
  limb([3.5, 1, 16], [7.5, -2, 10.5], 3.2, 2.6, metal);
  ell([2.2, 2.2, 2.2], [7.5, -2.4, 10.5], metalHi);
  color(seam) translate([7.5, -4.5, 10.5]) rotate([90, 0, 0]) cylinder(h = 0.4, r = 1, $fn = 12);
  limb([7.5, -2, 10.5], [8, 1.5, 4], 2.2, 1.7, metalDark);
  color(metal) translate([7.6, -1.5, 8]) rotate([-20, 0, 0]) scale([2, 1.2, 3]) sphere(1, $fn = 16);
  seamLine([7.5, -2.6, 7.5], [7.9, -1.2, 4.5], 0.25);
  blob([[[2.6, 3.4, 1.6], [8.2, -1.5, 1.6]]], metal);
  for (a = [-30, 0, 30]) spike([8.2 + sin(a) * 1.8, -4.5, 1.2], [sin(a) * 0.6, -2, -0.9], 0.6, 0.05, metalHi);
  spike([8.2, 1.5, 1.4], [0, 1.8, -1], 0.6, 0.05, metalHi);
}

// Pauldrons: huge rounded shells with a seam ring.
mirror_x() {
  color(metal) translate([10.5, 1, 31]) scale([5, 5, 4.4]) sphere(1, $fn = 28);
  color(metalHi) translate([10.8, -0.2, 32.6]) scale([3.8, 3.8, 2.6]) sphere(1, $fn = 24);
  color(seam) translate([10.5, 1, 29.8]) scale([5.1, 5.1, 0.3]) sphere(1, $fn = 24);
}

// Left arm (-X): raised, claws spread.
limb([-11, 0, 29], [-15, -2, 23], 2.4, 2, metalDark);
color(metal) translate([-14.6, -2.4, 24.6]) rotate([0, 30, 0]) scale([2.6, 2.6, 3.2]) sphere(1, $fn = 18);
limb([-15, -2, 23], [-16, -4, 30], 2, 1.8, metal);
seamLine([-15.4, -5, 24], [-16, -5.6, 28.5], 0.25);
ell([2.2, 1.6, 2], [-16.2, -4.4, 31], metalDark);
for (a = [-45, -18, 9, 36]) chain([[-16.2 + sin(a) * 1.6, -4.6, 32], [-16.2 + sin(a) * 2.8, -5.2, 35], [-16.2 + sin(a) * 3.2, -6.6, 36.5]], [0.6, 0.45, 0.1], metalHi);
// Right arm (+X): hanging, with a big forearm shield and long claws.
limb([11, 0, 29], [14, -1, 21], 2.4, 2, metalDark);
ell([2.2, 2.2, 2.2], [14, -1, 21], metalHi);
limb([14, -1, 21], [14.5, -4, 14], 2.2, 2, metal);
color(metal) translate([16.2, -2.6, 17]) rotate([-20, 0, 0]) scale([1.8, 4.2, 6]) sphere(1, $fn = 20);
color(metalHi) translate([17.4, -2.6, 17.4]) rotate([-20, 0, 0]) scale([0.8, 3.2, 4.8]) sphere(1, $fn = 16);
seamLine([17.6, -5.5, 14], [17.6, -3, 21], 0.25);
ell([2, 1.8, 1.8], [14.5, -4.6, 13], metalDark);
for (a = [-35, -10, 15, 40]) chain([[14.5 + sin(a) * 1.4, -5.4, 12.5], [14.5 + sin(a) * 2.2, -7, 10.5], [14.5 + sin(a) * 2.4, -7.2, 8]], [0.6, 0.45, 0.1], metalHi);

translate([0, -2, 33]) scale(1.3) translate([0, 0, -33]) {
// Head: a skull helm thrust forward from between the shoulders.
blob([[[3.6, 3.8, 4], [0, -2.5, 36]], [[2.6, 2.6, 2.4], [0, -4.6, 33]]], metal);
color(metalHi) translate([0, -4.6, 37]) scale([2.8, 2.2, 2.2]) sphere(1, $fn = 20);
// Molten maw.
color(maw) translate([0, -6.4, 33]) scale([2.4, 1, 1.8]) sphere(1, $fn = 18);
for (x = [-1.4, -0.5, 0.5, 1.4]) {
  color(metalHi) translate([x, -7.2, 34.3]) cube([0.6, 0.6, 1.2], center = true);
  color(metalHi) translate([x, -7.1, 31.8]) cube([0.6, 0.6, 1.1], center = true);
}
// Red slanted eyes with dark sockets.
mirror_x() {
  color(metalDark) translate([1.4, -6, 36]) rotate([0, -20, 0]) scale([1.3, 0.7, 0.8]) sphere(1, $fn = 12);
  color(seam) translate([1.4, -6.5, 36]) rotate([0, -20, 0]) scale([1, 0.5, 0.45]) sphere(1, $fn = 12);
  seamLine([1, -6.6, 37.6], [2.2, -5.8, 39], 0.2);
}
// Swept-back crests.
mirror_x() {
  chain([[3, -3, 38], [4.4, -1, 40.5], [4.6, 2, 42]], [0.9, 0.7, 0.15], metalHi);
  chain([[2.6, -1, 39], [3.4, 1.5, 40], [3.2, 4, 40.4]], [0.7, 0.5, 0.15], metal);
}
}
