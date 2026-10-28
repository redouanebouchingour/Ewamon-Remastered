// Hexroach: a low, cursed cockroach. A segmented black carapace split by glowing violet seams, a cluster of
// sickly yellow-green blisters on its back, a burning orange eye, long antennae, yellow-tipped hooked mandibles and
// six spiny legs.
include <lib.scad>

shell = [0.16, 0.13, 0.2];
shellHi = [0.27, 0.22, 0.34];
violet = [0.58, 0.2, 0.8];
blister = [0.86, 0.86, 0.38];
blisterDk = [0.6, 0.66, 0.2];
moss = [0.4, 0.62, 0.18];
eyeC = [1, 0.42, 0.08];
hook = [0.9, 0.86, 0.28];

// Carapace: overlapping plates from the head shield back to the rump, violet seams between them.
plates = [[-6, 8.5, 6.5, 5.2], [-1.5, 9.5, 7.5, 6.6], [3.5, 9.6, 7.6, 6.8], [8, 8.6, 6.8, 6], [12, 6.8, 5.4, 4.6]];
for (i = [0 : len(plates) - 1]) {
  pl = plates[i];
  color(i % 2 == 0 ? shell : shellHi) translate([0, pl[0], 6.5]) scale([pl[1], pl[2], pl[3]]) sphere(1, $fn = 30);
  if (i > 0) color(violet) translate([0, pl[0] - pl[2] * 0.55, 6.6]) rotate([90, 0, 0])
    scale([pl[1] * 0.96, pl[3] * 0.96, 1]) cylinder(h = 0.5, r = 1, center = true, $fn = 30);
}
// Belly: low and dark, filling under the plates.
ell([7.5, 13, 3], [0, 2, 3.8], shell);
// Violet streaks down the flanks.
// Jagged violet markings over the plates.
for (pt = [[-5, -6, 11.4], [5, -6, 11.4], [-7, 0, 10.6], [7, 0.5, 10.6], [-6, 6, 10.4], [6, 6.5, 10.4], [0, -7.5, 11.6]])
  color(violet) translate(pt) rotate([0, 0, pt[0] * 6]) scale([0.5, 2.6, 0.6]) sphere(1, $fn = 10);
mirror_x() for (y = [-4, 1, 6]) color(violet) translate([8.6, y, 6.5]) rotate([0, 0, 0]) scale([0.6, 2.2, 0.5]) sphere(1, $fn = 10);

// Blisters: a lumpy cluster of yellow egg sacs on the back, mossy green patches on them.
bl = [[-3.5, 1, 12.6, 3.2], [3.2, 2, 12.6, 3], [0, 5.5, 13, 3.6], [-4.5, 7.5, 11.2, 2.6], [4.5, 8, 11, 2.6],
      [0, 10, 10.6, 2.4], [-1.5, -2.5, 12.6, 2.2], [2, -2.2, 12.4, 2]];
for (b = bl) color(blister) translate([b[0], b[1], b[2]]) sphere(b[3], $fn = 20);
for (b = [[-3.5, 1, 15.6], [0, 5.5, 16.4], [4.5, 8, 13.4], [3.2, 2, 15.4]])
  color(moss) translate(b) scale([1.3, 1.3, 0.5]) sphere(1, $fn = 12);
for (b = [[-4.5, 7.5, 13.6], [0, 10, 12.8]]) color(blisterDk) translate(b) scale([1, 1, 0.4]) sphere(1, $fn = 10);

// Head: a small wedge under the front shield with spiky cheek plates.
blob([[[6, 4.6, 4.4], [0, -11, 6.4]], [[4.2, 3.4, 3.2], [0, -14.5, 5.8]]], shell);
color(shellHi) translate([0, -10.5, 9.6]) rotate([-18, 0, 0]) scale([6.4, 3.4, 1.8]) sphere(1, $fn = 20);
// Violet jagged marking across the head shield.
for (x = [-2.5, 2.5]) spike([x, -13.4, 9.4], [x * 0.2, -2.2, -1.6], 0.6, 0.05, violet);
mirror_x() {
  spike([4.6, -11, 7], [3, 1.5, 1.5], 1, 0.1, shellHi);
  // Burning eyes under the shield.
  color(eyeC) translate([2.7, -16.4, 7.2]) rotate([0, 0, -30]) scale([1.6, 0.9, 1.1]) sphere(1, $fn = 14);
  color([1, 0.85, 0.3]) translate([2.6, -17.2, 7.4]) sphere(0.5, $fn = 8);
  // Violet mouthparts.
  limb([1.2, -17.4, 4.6], [1.5, -18.4, 3.2], 0.5, 0.3, violet);
  // Mandibles: dark bases, curving to yellow hooks.
  chain([[2.6, -15.5, 4.8], [5, -18.5, 4], [4.6, -21.5, 3.4]], [1.3, 1.1, 0.85], shell);
  chain([[4.6, -21.5, 3.4], [3, -23.6, 3], [0.8, -23.4, 2.8]], [0.9, 0.55, 0.1], hook);
  // Antennae: long whips sweeping up and back.
  chain([[1.4, -16, 8.6], [3.5, -18, 14], [6, -16, 20], [9, -11, 23]], [0.45, 0.4, 0.3, 0.12], shellHi);
}

// Six legs: dark, jointed, spiny, splayed out; the front pair ends in big yellow hooks.
module leg(hip, knee, foot, r, tipC) {
  limb(hip, knee, r * 1.4, r * 1.1, shellHi);
  limb(knee, foot, r * 1.1, r * 0.5, shell);
  spike((knee + foot) / 2, [0, 0, 1.4], r * 0.4, 0.05, violet);
  spike(knee, [0, 0, 1.8], r * 0.5, 0.05, shellHi);
  spike(foot, [0, -1, -foot[2] + 0.05], r * 0.4, 0.05, tipC);
}
mirror_x() {
  leg([6, -7, 4.5], [11, -11, 7], [12.5, -14, 0.6], 1.2, hook);
  chain([[12.5, -14, 2], [14, -16.5, 2.5], [13, -18.5, 1.4]], [0.9, 0.6, 0.1], hook);
  leg([7, 0, 4.5], [13, 0, 7.5], [16, -1, 0.6], 1.1, shell);
  leg([6.5, 7, 4.5], [12, 10, 7], [14.5, 14, 0.6], 1.1, shell);
}
