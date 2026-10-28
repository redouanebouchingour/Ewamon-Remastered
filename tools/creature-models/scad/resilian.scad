// Resilian: a leaf-green flying grub. A round head with an orange face band, a long segmented abdomen marked with red
// squares rising up behind it to two pale cotton-tuft tips, four leafy red-rimmed wings and dark red-tipped legs.
include <lib.scad>

green = [0.45, 0.6, 0.22];
greenHi = [0.6, 0.75, 0.32];
greenDk = [0.3, 0.42, 0.15];
leaf = [0.74, 0.92, 0.48];
rim = [0.82, 0.3, 0.35];
red = [0.85, 0.18, 0.25];
orange = [0.85, 0.5, 0.2];
orangeDk = [0.55, 0.28, 0.12];
legC = [0.2, 0.2, 0.26];
tuft = [0.95, 0.95, 0.93];

// Head: a round green helmet with an orange band across the face.
ell([5.6, 5.4, 5], [0, -9, 9], green);
color(orange) translate([0, -9, 7.6]) scale([5.8, 5.6, 2.6]) sphere(1, $fn = 28);
for (x = [-3.2, 0, 3.2]) color(orangeDk) translate([x, -14.2 + abs(x) * 0.35, 7.6]) scale([0.4, 0.4, 1.8]) sphere(1, $fn = 8);
// Eyes in the band.
mirror_x() eye([2.6, -13.5, 8.2], 1.3, iris = [0.25, 0.08, 0.05], sclera = [1, 0.85, 0.55], pupil = [0.05, 0.02, 0], yaw = -20, flat = 0.4);
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
}
// Two forked stalks ending in pale cotton tufts.
mirror_x() {
  chain([[0.6, 11.5, 24.5], [2, 12.5, 27], [3.6, 13.5, 29]], [0.8, 0.6, 0.45], greenDk);
  translate([4.4, 14.2, 31.8]) rotate([-25, 15, 0]) {
    color(tuft) scale([2.2, 1.1, 3.6]) sphere(1, $fn = 18);
    color(greenHi) for (y = [-1, 1]) translate([0, y * 0.9, 0]) scale([0.25, 0.3, 2.8]) sphere(1, $fn = 8);
  }
}

// Four leafy wings from the thorax: angular blades, red rim around a pale-green vane with a dark midrib.
module wing(p, rot, len, w) {
  P = [[0, 0], [len * 0.35, w], [len * 0.8, w * 1.05], [len, w * 0.5], [len * 0.92, -w * 0.25], [len * 0.4, -w * 0.5]];
  translate(p) rotate(rot) {
    color(rim) linear_extrude(0.4, center = true) polygon(P);
    color(leaf) linear_extrude(0.7, center = true) offset(delta = -0.55) polygon(P);
    color(greenDk) linear_extrude(0.9, center = true) polygon([[0.5, -0.15], [len * 0.9, w * 0.4], [len * 0.9, w * 0.5], [0.5, 0.25]]);
  }
}
mirror_x() {
  wing([2.5, -3, 14.5], [70, -28, 8], 15, 5.5);  // front pair: up and out
  wing([2.5, -1, 13.5], [70, 2, 28], 13.5, 5);    // rear pair: flatter, swept back
}

// Six dark legs hanging under the thorax, red tips.
mirror_x() for (i = [0 : 2]) {
  b = [2.6, -6 + i * 2.6, 8.5];
  k = b + [3, -0.5, -3];
  t = k + [0.4, -0.8, -4.2];
  chain([b, k, t], [0.8, 0.7, 0.55], legC);
  spike(t, [0.2, -0.6, -1.6], 0.55, 0.05, red);
}
