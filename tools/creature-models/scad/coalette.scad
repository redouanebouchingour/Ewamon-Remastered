// Coalette: a chubby lump-of-coal lizard. Charcoal hide, a glowing ember core in its belly, amber eyes, a row of
// small flames burning along its head and spine and a thick tail that curls up behind it into a tall flame.
include <lib.scad>

coal = [0.24, 0.2, 0.23];
coalHi = [0.36, 0.3, 0.33];
crack = [0.95, 0.42, 0.08];
core = [1, 0.62, 0.12];
coreHi = [1, 0.88, 0.45];
flameRed = [0.9, 0.22, 0.05];
flameOrange = [1, 0.55, 0.08];
flameCore = [1, 0.88, 0.35];
claw = [0.85, 0.7, 0.45];

// A flame: three tongues of red, orange and a yellow heart, pointing along d.
module flame(p, d, r) {
  side = [d[1], -d[0], 0] / max(norm([d[0], d[1]]), 0.001);
  sd = norm([d[0], d[1]]) < 0.3 ? [1, 0, 0] : side;
  color(flameCore) translate(p + d * 0.08) sphere(r * 1.02, $fn = 12);
  color(flameOrange) hull() { translate(p + d * 0.15) sphere(r * 0.9, $fn = 10); translate(p + d * 0.8) sphere(0.15, $fn = 6); }
  color(flameRed) hull() { translate(p + d * 0.45) sphere(r * 0.55, $fn = 8); translate(p + d) sphere(0.12, $fn = 6); }
  for (s = [-1, 1]) color(s > 0 ? flameRed : flameOrange) hull() {
    translate(p + d * 0.2 + sd * s * r * 0.5) sphere(r * 0.55, $fn = 8);
    translate(p + d * 0.6 + sd * s * r * 1.3) sphere(0.1, $fn = 6);
  }
}

// Body: a squat pear, wide hips.
blob([[[8.5, 7.5, 7.5], [0, 0.5, 9.5]], [[6.8, 6, 6], [0, -0.5, 16.5]]], coal);
// Ember core: a glowing ring with a dark heart on the belly.
color(crack) translate([0, -6.2, 11.5]) scale([4.8, 2.2, 5]) sphere(1, $fn = 24);
color(core) translate([0, -7.2, 11.5]) scale([3.8, 1.6, 4]) sphere(1, $fn = 22);
color(coreHi) translate([0, -8.1, 11.5]) scale([2.3, 1, 2.5]) sphere(1, $fn = 18);
color([0.35, 0.08, 0.02]) translate([0, -8.8, 11.5]) scale([0.9, 0.5, 1]) sphere(1, $fn = 12);

// Head: a broad lizard head with a blunt snout and a little grin.
blob([[[6.4, 5.8, 5.2], [0, -1.5, 23]], [[4.6, 4.2, 3.4], [0, -6, 22]]], coal);
color(coalHi) translate([0, -7, 24.2]) scale([4, 3, 1.4]) sphere(1, $fn = 16);
mirror_x() color([0.08, 0.06, 0.07]) translate([1.1, -10, 22.6]) scale([0.4, 0.3, 0.35]) sphere(1, $fn = 8);
color([0.1, 0.07, 0.08]) translate([0, -9.4, 20.6]) rotate([90, 0, 0]) scale([3, 0.6, 0.4]) cylinder(h = 0.6, r = 1, center = true, $fn = 16);
mirror_x() {
  eye([3.2, -8.3, 24.2], 1.6, iris = [1, 0.62, 0.08], pupil = [0.15, 0.05, 0.02], sclera = [1, 0.85, 0.4], yaw = -22);
  color(coalHi) translate([3.2, -8.4, 26]) rotate([0, -15, -20]) scale([2, 0.9, 0.6]) sphere(1, $fn = 12);
}
// Head flames: a crest of little flames from the brow back over the crown.
flame([0, -3, 27.6], [0, 1, 5], 1.6);
mirror_x() {
  flame([2.6, -2.5, 27.2], [0.8, 1, 4], 1.3);
  flame([4.6, -0.5, 26], [1.2, 1.4, 3.4], 1.1);
}

// Back flames: a row down the spine.
for (i = [0 : 3]) flame([0, 3.5 + i * 1.6, 21 - i * 3.2], [0, 2, 6 - i * 0.5], 1.9 - i * 0.15);
mirror_x() for (i = [0 : 2]) flame([3, 3.5 + i * 1.4, 19.5 - i * 3.4], [1.2, 1.6, 4], 1.3);
// Ember cracks on the shoulders and back.
mirror_x() for (c = [[5.5, 2.5, 19, 30], [6.5, 4, 13, 70], [4, 6.2, 16, 110]])
  color(crack) translate([c[0], c[1], c[2]]) rotate([0, 0, c[3]]) scale([0.4, 1.6, 0.3]) sphere(1, $fn = 8);

// Arms: stubby, held out, with pale claws.
mirror_x() {
  limb([6, -1.5, 16], [9.6, -4.5, 13.5], 2, 1.6, coal);
  ell([1.8, 1.7, 1.4], [10, -5, 13], coalHi);
  for (a = [-30, 0, 30]) spike([10 + sin(a) * 1.1, -6.4, 12.6], [sin(a) * 0.6, -1.1, -0.6], 0.4, 0.05, claw);
}

// Legs: fat thighs and flat feet with claws.
mirror_x() {
  ell([3.6, 3.8, 3.8], [5, -0.5, 5], coal);
  blob([[[2.8, 4, 1.6], [5.3, -2.4, 1.6]], [[2.3, 2, 1.4], [5.3, 0.6, 1.5]]], coal);
  for (a = [-28, 0, 28]) spike([5.3 + sin(a) * 1.5, -5.8, 1.0], [sin(a) * 0.5, -1.2, -0.4], 0.45, 0.05, claw);
}

// Tail: thick, sweeping back and curling up to the viewer's right, flames along its top and a big flame at the tip.
tail = [[2, 5.5, 6], [6, 10, 4.5], [11, 11, 6], [14, 8.5, 10], [15, 6, 15], [14.5, 5, 19]];
chain(tail, [3.8, 3.2, 2.7, 2.2, 1.8, 1.4], coal);
for (i = [1 : 4]) color(crack) translate(tail[i] + [0, 0, -1]) rotate([0, 0, 40 * i]) scale([0.35, 1.6, 0.3]) sphere(1, $fn = 8);
flame([6, 10, 7.5], [0, 0.6, 3.4], 1.2);
flame([11, 11, 8.5], [0.5, 0.4, 3.4], 1.2);
flame([14.4, 8.6, 12], [1.2, 0.5, 3], 1.1);
flame([14.5, 5, 20], [0, -0.5, 13], 3.4);
flame([16, 5.4, 19.5], [3, 0.5, 8], 2.2);
flame([13, 5, 19.5], [-3, 0.5, 8], 2.2);
