// Resilith: Resilian grown into a hunter. Bigger veined leaf wings, red thorns down its segmented abdomen, a brown
// mask with glaring red eyes, heavier red-clawed legs, and the cotton tufts have hardened into sprigs of pale-green
// crystal leaves.
include <lib.scad>

green = [0.45, 0.6, 0.22];
greenHi = [0.6, 0.75, 0.32];
greenDk = [0.3, 0.42, 0.15];
leaf = [0.7, 0.88, 0.5];
crystal = [0.62, 0.92, 0.66];
crystalHi = [0.85, 1, 0.85];
brown = [0.42, 0.28, 0.2];
rim = [0.82, 0.3, 0.35];
red = [0.85, 0.18, 0.25];
orange = [0.85, 0.5, 0.2];
orangeDk = [0.55, 0.28, 0.12];
legC = [0.2, 0.2, 0.26];
tuft = [0.95, 0.95, 0.93];

// Head: a round green helmet with an orange band across the face.
ell([5.6, 5.4, 5], [0, -9, 9], green);
// Brown mask with orange cheek plates and glaring red eyes.
color(brown) translate([0, -11.2, 7.6]) scale([4.2, 3.6, 3.6]) sphere(1, $fn = 24);
mirror_x() color(orange) translate([3, -12.4, 7.8]) rotate([0, 0, -25]) scale([1.8, 1.2, 1.6]) sphere(1, $fn = 14);
mirror_x() {
  // Glowing red eyes sunk into the mask under a hard brow that slants down to the mandibles.
  eye([2.1, -13.6, 8.6], 1.5, iris = [1, 0.16, 0.12, GLOW], sclera = [0.95, 0.45, 0.15], pupil = [0.3, 0, 0], yaw = 12,
      flat = 0.5, lid = 0.46, lid_tilt = 32, lid_c = greenDk, slit = 0.4);
  color(greenDk) hull() {
    translate([3.6, -12.8, 10.7]) scale([1.3, 1.1, 0.7]) sphere(1, $fn = 10);
    translate([0.8, -14.4, 10]) scale([0.8, 0.8, 0.5]) sphere(1, $fn = 10);
  }
}
mirror_x() spike([1, -14.4, 5.6], [0.3, -0.4, -1.6], 0.45, 0.05, [0.95, 0.9, 0.8]);  // mandibles
// Dark seam across the top of the head and two whisker antennae.
color(greenDk) translate([0, -9.6, 13.2]) scale([0.5, 3.8, 1]) sphere(1, $fn = 10);
mirror_x() chain([[1.6, -12, 12.5], [3, -14, 15], [5, -15, 16]], [0.25, 0.2, 0.12], legC);

// Abdomen: a chain of segments rising up and back from the head, each with a red square marking on its back.
segs = [[0, -4.5, 11, 4.2], [0, -1, 13, 3.7], [0, 2.5, 15.3, 3.3], [0, 5.6, 17.8, 3], [0, 8.4, 20.4, 2.7], [0, 10.8, 23, 2.4]];
for (i = [0 : len(segs) - 1]) {
  s = segs[i];
  ell([s[3], s[3] * 0.95, s[3] * 0.9], [s[0], s[1], s[2]], i % 2 == 0 ? green : greenHi);
  // Red square marking on the up-facing (front-up) side and one on the back.
  for (sy = [-1, 1]) color(red) translate([0, s[1] + sy * s[3] * 0.62, s[2] + s[3] * 0.62]) rotate([sy * 45, 0, 0])
    difference() { cube([s[3] * 0.9, s[3] * 0.9, 0.6], center = true); cube([s[3] * 0.4, s[3] * 0.4, 1], center = true); }
  mirror_x() spike([s[3] * 0.7, s[1], s[2] + s[3] * 0.5], [s[3] * 0.25, 0.3, s[3] * 0.55], 0.55, 0.05, red);
}
// Two forked stalks ending in pale cotton tufts.
mirror_x() {
  chain([[0.6, 11.5, 24.5], [2, 12.5, 27], [3.6, 13.5, 29]], [0.8, 0.6, 0.45], greenDk);
  chain([[3.6, 13.5, 29], [4.2, 14, 34]], [0.45, 0.3], greenDk);
  for (k = [0 : 3]) for (sx = [-1, 1]) {
    b = [3.6 + k * 0.15, 13.6 + k * 0.12, 29.5 + k * 1.4];
    color(crystal) translate(b + [sx * 1.3, 0, 0.6]) rotate([0, sx * -40, 0]) scale([1.1, 0.7, 1.7]) sphere(1, $fn = 6);
  }
  color(crystalHi) translate([4.3, 14.1, 35.2]) scale([0.8, 0.6, 1.4]) sphere(1, $fn = 6);
}

// Four leafy wings from the thorax: angular blades, red rim around a pale-green vane with a dark midrib.
module wing(p, rot, len, w) {
  P = [[0, 0], [len * 0.35, w], [len * 0.8, w * 1.05], [len, w * 0.5], [len * 0.92, -w * 0.25], [len * 0.4, -w * 0.5]];
  translate(p) rotate(rot) {
    color(rim) linear_extrude(0.4, center = true) polygon(P);
    color(leaf) linear_extrude(0.7, center = true) offset(delta = -0.55) polygon(P);
    for (v = [[len * 0.9, w * 0.45], [len * 0.6, w * 0.95], [len * 0.85, -w * 0.15]])
      color(rim) linear_extrude(0.9, center = true) polygon([[0.5, -0.12], v, v + [0, 0.25], [0.5, 0.12]]);
  }
}
mirror_x() {
  wing([2.5, -3, 14.5], [70, -35, 8], 18, 6.5);  // front pair: up and out
  wing([2.5, -1, 13.5], [70, 0, 28], 16, 6);      // rear pair: flatter, swept back
}

// Six dark legs hanging under the thorax, red tips.
mirror_x() for (i = [0 : 2]) {
  b = [2.6, -6 + i * 2.6, 8.5];
  k = b + [5, -1 + (i - 1) * 1.2, -1.5];
  t = k + [1.6, -1.2, -5.5];
  chain([b, k, t], [0.9, 0.8, 0.6], legC);
  ell([1.3, 1.3, 1.6], k + [0.2, -0.2, -1.2], green);  // green armour plate on the shin
  spike(t, [0.3, -0.8, -2.2], 0.7, 0.05, red);
}
