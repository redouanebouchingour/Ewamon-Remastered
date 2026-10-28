// Blighthex: Hexroach grown into a hulking blight beetle. A high spiked carapace of black-violet plates, glossy
// yellow-green venom orbs swelling out of its back, burning orange eyes under a horned shield, a fringe of yellow
// fangs, long arching antennae, and huge scythe forearms ending in yellow talons.
include <lib.scad>

shell = [0.17, 0.12, 0.22];
shellHi = [0.32, 0.2, 0.42];
violet = [0.6, 0.22, 0.82];
orb = [0.76, 0.86, 0.22];
orbHi = [0.95, 1, 0.6];
eyeC = [1, 0.42, 0.08];
hook = [0.9, 0.88, 0.3];

// Carapace: a tall domed shell of overlapping plates with violet seams, a row of spines down the middle.
plates = [[-5, 10, 8, 8], [0, 11, 8.6, 9.6], [5, 10.6, 8.2, 9.2], [9.5, 9, 7, 7.6], [13, 7, 5.4, 5.6]];
for (i = [0 : len(plates) - 1]) {
  pl = plates[i];
  color(i % 2 == 0 ? shell : shellHi) translate([0, pl[0], 10]) scale([pl[1], pl[2], pl[3]]) sphere(1, $fn = 30);
  if (i > 0) color(violet) translate([0, pl[0] - pl[2] * 0.55, 10.2]) rotate([90, 0, 0])
    scale([pl[1] * 0.97, pl[3] * 0.97, 1]) cylinder(h = 0.5, r = 1, center = true, $fn = 30);
  spike([0, pl[0] + 1, 10 + pl[3] * 0.95], [0, 1.4, 2.6], 1.1, 0.05, shellHi);
  mirror_x() spike([pl[1] * 0.75, pl[0], 10 + pl[3] * 0.55], [1.8, 0.6, 1.8], 0.9, 0.05, shellHi);
}
// Jagged violet markings over the plates.
for (pt = [[-6, -6, 16.4], [6, -6, 16.4], [-8.5, 0, 15], [8.5, 0.5, 15], [-8, 6, 14.4], [8, 6.5, 14.4]])
  color(violet) translate(pt) rotate([0, pt[0] > 0 ? 40 : -40, pt[0] * 4]) scale([0.5, 3, 0.6]) sphere(1, $fn = 10);
// Belly.
ell([8, 13, 4], [0, 2, 6], shell);

// Venom orbs: big glossy spheres bulging from the back and flanks, each with a highlight.
orbs = [[-5.5, 2, 18.6, 4], [5.5, 3, 18.4, 3.8], [0, 8, 18, 4.2], [-8.5, 9, 12.6, 3], [8.5, 9.5, 12.4, 3.2],
        [0, 13.5, 13, 2.8], [-3, -3.5, 19.2, 2.6], [3.5, -3, 19, 2.4]];
for (o = orbs) {
  color(orb) translate([o[0], o[1], o[2]]) sphere(o[3], $fn = 22);
  color(orbHi) translate([o[0] - o[3] * 0.3, o[1] - o[3] * 0.45, o[2] + o[3] * 0.55]) sphere(o[3] * 0.32, $fn = 10);
}

// Head: a horned wedge under the front shield, low and forward.
blob([[[6.4, 5, 5], [0, -11, 9]], [[4.6, 3.8, 3.6], [0, -15, 8]]], shell);
color(shellHi) translate([0, -12, 13]) rotate([-25, 0, 0]) scale([7, 4.4, 2]) sphere(1, $fn = 20);
mirror_x() {
  // Swept horns off the shield.
  chain([[3.6, -12, 13.6], [6, -12, 16.6], [8, -9, 18.4]], [1.2, 0.8, 0.1], shellHi);
  spike([5.4, -11.5, 10], [3.6, 0.5, 1], 1.1, 0.1, shellHi);
  color(eyeC) translate([2.8, -17.6, 10.2]) rotate([0, -25, -30]) scale([1.9, 0.9, 0.75]) sphere(1, $fn = 14);
  color([1, 0.85, 0.3]) translate([2.6, -18.4, 10.3]) scale([1, 1, 0.7]) sphere(0.5, $fn = 8);
  color(violet) translate([3.4, -17.2, 11.6]) rotate([0, -25, -30]) scale([1.6, 0.5, 0.35]) sphere(1, $fn = 10);
  // Fangs hanging from the jaw.
  for (x = [1, 2.8, 4.4]) spike([x, -17.4 + x * 0.4, 7.2], [x * 0.2, -1, -4 + x * 0.3], 0.8, 0.05, hook);
  // Antennae: long arching whips over the back.
  chain([[1.4, -17, 12], [3, -20, 19], [6, -17, 26], [10, -10, 29], [12, -4, 27]], [0.5, 0.45, 0.35, 0.25, 0.1], violet);
}

// Scythe forearms: thick, spiked, raised, ending in yellow talons.
mirror_x() {
  limb([7, -8, 10], [12, -13, 13], 2.8, 2.6, shellHi);
  limb([12, -13, 13], [14, -18, 5], 2.8, 2.2, shell);
  for (i = [0 : 2]) spike([12.6 + i * 0.6, -14 - i * 1.5, 12 - i * 2.6], [1.6, 0.6, 1.4], 0.7, 0.05, shellHi);
  ell([2.4, 2.4, 2], [14, -18.5, 4], shell);
  for (a = [-35, 0, 35]) chain([[14 + sin(a) * 1.6, -20, 4], [14 + sin(a) * 2.6, -22.5, 2.6], [14 + sin(a) * 2.4, -22.6, 0.4]],
                              [0.8, 0.5, 0.08], hook);
}

// Back legs: thick, jointed, spiny, a yellow claw on each foot.
module leg(hip, knee, foot, r) {
  limb(hip, knee, r * 1.4, r * 1.1, shellHi);
  limb(knee, foot, r * 1.1, r * 0.6, shell);
  spike(knee, [0, 0, 2], r * 0.6, 0.05, shellHi);
  spike((knee + foot) / 2, [1, 0, 1.2], r * 0.4, 0.05, violet);
  spike(foot, [0, -1.4, -foot[2] + 0.05], r * 0.5, 0.05, hook);
}
mirror_x() {
  leg([8, 1, 7], [13, 1.5, 10], [14.5, 0, 0.8], 1.8);
  leg([7.5, 8, 7], [12, 11, 9.5], [13, 14, 0.8], 1.7);
}
