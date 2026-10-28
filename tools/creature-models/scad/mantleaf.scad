// Mantleaf: a leaf mantis. A triangular green head with big yellow eyes and antennae, ringed by a crown of pink lotus
// petals; raised serrated scythe arms, four stilt legs and a plump abdomen covered by mottled leaf wings.
include <lib.scad>

green = [0.45, 0.62, 0.18];
greenLt = [0.62, 0.76, 0.26];
greenDk = [0.3, 0.45, 0.11];
camo = [0.55, 0.7, 0.24];
pink = [1, 0.56, 0.6];
pinkDk = [0.9, 0.42, 0.48];
eyeY = [0.98, 0.8, 0.15];

// Abdomen: a fat leaf-shaped body behind, low to the ground.
blob([[[7.5, 9, 6], [0, 9, 12]], [[5, 6, 4.5], [0, 15, 10]]], greenDk);
// Leaf wings folded over the abdomen: two big leaves each side with a vein and mottled patches.
module wingleaf(p, rot, s) {
  translate(p) rotate(rot) {
    color(green) scale(s) sphere(1, $fn = 28);
    color(greenDk) translate([0, 0, s[2] * 0.6]) scale([0.25, s[1] * 0.92, 0.25]) sphere(1, $fn = 10);
    for (q = [[0.45, 0.3], [-0.4, -0.2], [0.35, -0.55], [-0.45, 0.45], [0.1, 0.65]])
      color(camo) translate([s[0] * q[0], s[1] * q[1], s[2] * 0.3]) scale([s[0] * 0.28, s[1] * 0.18, s[2] * 0.62]) sphere(1, $fn = 12);
  }
}
mirror_x() {
  wingleaf([4, 9, 17], [28, 22, 6], [5, 10, 1.8]);
  wingleaf([7, 8, 13], [22, 50, 10], [4.5, 9, 1.6]);
}

// Thorax: a slim upright segmented neck from abdomen to head, pale belly segments.
chain([[0, 3, 12], [0, 0, 17], [0, -1.5, 22]], [2.8, 2.4, 2.2], green);
for (z = [13.5 : 2 : 20]) color(greenLt) translate([0, -1.1 - (z - 13) * 0.18, z]) scale([1.9, 1.2, 0.8]) sphere(1, $fn = 14);

// Head: a rounded triangle, wide at the eyes, narrowing to the mouth.
color(green) hull() {
  translate([0, -2, 28.5]) scale([5, 3.2, 2.8]) sphere(1, $fn = 24);
  translate([0, -3.5, 24]) scale([1.4, 1.4, 1.2]) sphere(1, $fn = 14);
}
// Face ridge.
color(greenLt) hull() {
  translate([0, -5, 29]) sphere(0.6, $fn = 8);
  translate([0, -4.8, 25]) sphere(0.5, $fn = 8);
}
// Big almond yellow eyes.
mirror_x() {
  color(greenDk) translate([3.2, -3.4, 28]) rotate([0, -20, -25]) scale([2.4, 1.1, 1.8]) sphere(1, $fn = 18);
  color(eyeY) translate([3.2, -3.9, 28]) rotate([0, -20, -25]) scale([2.1, 1, 1.5]) sphere(1, $fn = 18);
  color([0.2, 0.15, 0.02]) translate([2.8, -4.85, 27.8]) scale([0.4, 0.2, 0.7]) sphere(1, $fn = 10);
  color("white") translate([3.6, -4.8, 28.6]) sphere(0.35, $fn = 8);
}
// Antennae curving up and out between the petals.
mirror_x() chain([[1, -3.5, 30.5], [2, -3, 34], [3.5, -2.5, 37], [5, -3, 38.5]], [0.35, 0.3, 0.25, 0.2], greenDk);

// Lotus crown: pointed pink petals fanning around and behind the head.
for (a = [-75, -38, 0, 38, 75]) {
  color(pink) hull() {
    translate([2.5 * sin(a), 0.8, 28 + 2.5 * cos(a)]) scale([1.5, 0.7, 1.5]) sphere(1, $fn = 12);
    translate([6 * sin(a), 1, 28.2 + 6 * cos(a)]) rotate([0, a, 0]) scale([3, 0.8, 2.6]) sphere(1, $fn = 18);
    translate([10.5 * sin(a), 1.2, 28.5 + 10.5 * cos(a)]) sphere(0.25, $fn = 8);
  }
}
for (a = [-57, -19, 19, 57]) color(pinkDk) hull() {
  translate([2.5 * sin(a), 2, 28 + 2.5 * cos(a)]) scale([1.4, 0.7, 1.4]) sphere(1, $fn = 12);
  translate([5.5 * sin(a), 2.2, 28.2 + 5.5 * cos(a)]) rotate([0, a, 0]) scale([2.6, 0.7, 2.2]) sphere(1, $fn = 16);
  translate([9 * sin(a), 2.4, 28.5 + 9 * cos(a)]) sphere(0.25, $fn = 8);
}

// Scythe arms: upper arm out and up, forearm hanging down with a serrated blade edge.
mirror_x() {
  limb([2, -2, 21], [7, -4.5, 25], 1.2, 1.0, green);
  limb([7, -4.5, 25], [8.5, -5.5, 15], 1.3, 0.7, green);
  // Blade plate along the forearm.
  color(greenLt) hull() {
    translate([8.6, -5.2, 24]) scale([0.5, 1.6, 1]) sphere(1, $fn = 10);
    translate([9.4, -5.8, 15]) sphere(0.3, $fn = 8);
  }
  for (i = [0 : 3]) spike([8.9 + i * 0.12, -5.5, 22 - i * 2], [1.6, -0.2, -0.6], 0.5, 0.05, greenDk);
}

// Four stilt legs: thigh up and out, shin down to a pointed foot.
mirror_x() {
  limb([3, 3, 11], [8, -1, 12], 1.2, 1.0, green);
  limb([8, -1, 12], [9.5, -4, 0.8], 1.0, 0.6, green);
  limb([3, 8, 10], [8, 11, 11], 1.2, 1.0, green);
  limb([8, 11, 11], [9.5, 14, 0.8], 1.0, 0.6, green);
  ell([1.2, 1.8, 0.6], [9.5, -4.6, 0.6], greenDk);
  ell([1.2, 1.8, 0.6], [9.5, 14.4, 0.6], greenDk);
}
