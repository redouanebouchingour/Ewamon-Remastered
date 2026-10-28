// Hoarfrowl: a standing snowy owl. White plumage with icy-blue chevron bands on chest and back, amber eyes ringed in
// frost-blue, tufted ears, a navy beak and talons, long folded wings with blue diamond spots and blue flight feathers,
// and a puff of frosty breath at its side.
include <lib.scad>

white = [0.94, 0.96, 1];
ice = [0.72, 0.84, 0.95];
iceDk = [0.45, 0.62, 0.85];
amber = [0.92, 0.62, 0.1];
navy = [0.18, 0.24, 0.42];

// Body: a big upright egg.
blob([[[9, 8, 10], [0, 0.5, 13]], [[7.5, 7, 6], [0, 0, 6]]], white);
// Chevron bands (zig-zag rows of little blue points) across chest and back.
// Surface of the body egg at (x, z) on the front (dir 1) or back (dir -1).
function surf(x, z, dir) = -dir * 8 * sqrt(max(0.02, 1 - pow(x / 9, 2) - pow((z - 13) / 10, 2)));
module chevrons(z, dir) {
  for (x = [-6 : 2 : 6]) {
    y = surf(x, z, dir) - dir * 0.15;
    color(iceDk) hull() {
      translate([x - 1, y, z + 0.5]) sphere(0.3, $fn = 8);
      translate([x + 1, surf(x + 1, z, dir) - dir * 0.15, z + 0.5]) sphere(0.3, $fn = 8);
      translate([x, y, z - 1.1]) sphere(0.25, $fn = 8);
    }
  }
}
chevrons(17.0, 1);
chevrons(12, 1);
chevrons(16.2, -1);
chevrons(10.5, -1);

// Head: broad and round, sitting low on the shoulders.
blob([[[8, 7.2, 6.8], [0, 0, 25.5]], [[8.2, 7.4, 4.5], [0, 0.4, 19.5]]], white);
// Facial disc: two pale ice cups for the eyes.
mirror_x() {
  color(ice) translate([3.4, -6, 25.6]) rotate([0, 0, -20]) scale([3.3, 1.2, 3.3]) sphere(1, $fn = 24);
  color(white) translate([3.4, -6.4, 25.6]) rotate([0, 0, -20]) scale([2.7, 1.2, 2.7]) sphere(1, $fn = 24);
  eye([3.4, -7.0, 25.6], 1.9, iris = amber, pupil = [0.08, 0.06, 0.04], sclera = iceDk, yaw = -20);
  // Frowning brow ridge.
  color(ice) translate([3.2, -7, 28.4]) rotate([0, -18, -20]) scale([2.6, 0.8, 0.6]) sphere(1, $fn = 14);
}
// Frost-blue V mark on the forehead.
color(iceDk) translate([0, -6.9, 28.4]) rotate([90, 0, 0]) linear_extrude(0.6, center = true) polygon([[-2.2, 1], [0, -1.4], [2.2, 1], [1.4, 1], [0, -0.3], [-1.4, 1]]);
// Hooked navy beak.
color(navy) hull() {
  translate([0, -7.4, 24.4]) scale([0.9, 0.8, 1]) sphere(1, $fn = 12);
  translate([0, -8.6, 22.6]) sphere(0.3, $fn = 8);
}
// Ear tufts: feathered horns, white with blue cores.
mirror_x() {
  color(white) hull() {
    translate([4.8, 0, 29.8]) scale([2.6, 1.0, 1.6]) sphere(1, $fn = 14);
    translate([7.4, 0.3, 35.5]) scale([0.4, 0.3, 0.4]) sphere(1, $fn = 8);
    translate([5.4, 0.2, 33]) scale([0.4, 0.3, 0.4]) sphere(1, $fn = 8);
  }
  color(ice) hull() {
    translate([5.4, -0.8, 30.5]) scale([1.2, 0.4, 1]) sphere(1, $fn = 10);
    translate([6.8, -0.5, 34]) sphere(0.2, $fn = 8);
  }
}

// Wings: folded long down the sides, white coverts with blue diamond spots and blue-edged flight feathers.
module wing() {
  petal([3.2, 5.5, 9], [8.6, 1.5, 14], [0, -8, 0], white);
  for (q = [[11.3, -1.5, 17], [11.6, 1, 16.5], [11.5, 3.5, 15.5], [11.6, 0, 13.5], [11.4, -2.5, 14]])
    color(iceDk) translate(q) rotate([0, 82, 0]) scale([1.0, 0.6, 0.4]) rotate([0, 0, 45]) cube(1.6, center = true);
  for (i = [0 : 4]) {
    petal([1.4, 1.6, 6], [9.2 + i * 0.25, -1.5 + i * 1.6, 6.5 - i * 0.4], [0, -8 - i * 2, 0], i % 2 == 0 ? ice : white);
    spike([9.6 + i * 0.25, -1.5 + i * 1.6, 2.8 - i * 0.4], [0.3, 0, -2.2], 0.9, 0.1, iceDk);
  }
}
mirror_x() wing();
// Tail: short blue-tipped fan at the back.
for (a = [-25, 0, 25]) {
  petal([1.6, 0.9, 4], [sin(a) * 2.2, 7.5, 4.5], [-50, a, 0], white);
  spike([sin(a) * 3.2, 10, 2.2], [sin(a) * 0.5, 1.2, -1.6], 0.9, 0.1, iceDk);
}

// Feathered legs, navy talons.
mirror_x() {
  ell([2.6, 2.8, 2.4], [3.6, -1.6, 2.4], white);
  for (a = [-30, 0, 30])
    spike([3.6 + sin(a) * 1.6, -3.8, 1.1], [sin(a) * 0.9, -1.8, -1], 0.6, 0.05, navy);
}

// Frosty breath puff curling off the beak to the viewer's left.
breath = [[-4.5, -9.5, 23.8, 0.9], [-7.5, -10, 24.5, 1.3], [-10.2, -9.5, 26.5, 1.2], [-11.4, -8.8, 29, 1.0], [-10.6, -8.2, 31, 0.7]];
for (i = [0 : len(breath) - 2]) color(ice) hull() {
  translate([breath[i][0], breath[i][1], breath[i][2]]) sphere(breath[i][3], $fn = 12);
  translate([breath[i + 1][0], breath[i + 1][1], breath[i + 1][2]]) sphere(breath[i + 1][3], $fn = 12);
}
color(white) translate([-12.6, -9, 32.4]) sphere(0.45, $fn = 8);
color(white) translate([-9, -10.5, 30.6]) sphere(0.35, $fn = 8);
