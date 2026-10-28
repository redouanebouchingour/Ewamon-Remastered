// Rimeidol: a frosty lavender wraith in a hooded shroud, a bone-white skull for a face, small ice horns,
// clawed hands and long icy streamers trailing from the hood.
include <lib.scad>

robe = [0.66, 0.7, 0.93];
robeHi = [0.8, 0.83, 0.98];
robeDk = [0.42, 0.45, 0.78];
skull = [0.95, 0.92, 0.84];
skullSh = [0.78, 0.74, 0.66];
socket = [0.12, 0.1, 0.2];
frost = [0.86, 0.9, 1];

// Shroud body: a bell that widens to a ragged hem.
blob([[[7, 6.5, 6], [0, 0, 20]], [[10, 9, 4], [0, 1, 9]], [[8, 7, 2], [0, 1, 3.5]]], robe);
// Ragged hem tatters.
for (a = [0 : 30 : 359]) petal([2.4, 0.8, 3.6], [9.2 * sin(a), 1 + 8.2 * cos(a), 3.2], [-25 * cos(a), 25 * sin(a), -a], (a / 30) % 2 == 0 ? robeDk : robe);
// Feet poking out.
mirror_x() ell([2.2, 3, 1.6], [3.5, -2, 1.6], robeDk);
// Lighter front panel of the robe.
color(robeHi) hull() { translate([0, -6, 19]) scale([2.4, 0.5, 1]) sphere(1.4); translate([0, -8.8, 5]) scale([4.6, 0.5, 1]) sphere(1.6); }
// Hood folds down the back.
for (x = [-4.5, 0, 4.5]) color(robeDk) hull() { translate([x, 6.6, 23]) scale([0.6, 0.6, 1]) sphere(1.4); translate([x * 1.5, 9.4, 7]) scale([0.6, 0.6, 1]) sphere(1.6); }
// Jagged ice collar over the shoulders (the back's zig-zag).
for (a = [-80 : 32 : 80]) petal([2.6, 1, 3], [7.5 * sin(a), 7 * cos(a) + 0.5, 21], [0, 0, -a], robeHi);

// Hood: a big rounded cowl around the skull.
blob([[[8.5, 8, 8], [0, 1, 28]], [[7, 6, 5], [0, 2, 33]]], robe);
// Hood opening rim (darker inside).
color(robeDk) translate([0, -5, 27]) rotate([90, 0, 0]) scale([7.2, 7.6, 1]) cylinder(h = 2, r = 1, center = true, $fn = 32);
// Ice horns on the hood.
mirror_x() {
  spike([4, -0.5, 33.5], [1.6, -0.4, 6], 1.6, 0.2, robeHi);
  spike([6.5, 1, 31.5], [2.2, 0.3, 4], 1.1, 0.2, robe);
}

// Skull face.
blob([[[5.8, 3.4, 5.4], [0, -6.5, 27.5]], [[3.8, 2.8, 2.2], [0, -6.5, 23.2]]], skull);
ell([3.4, 2, 1.5], [0, -7.4, 23], skullSh);
// Eye sockets, big and dark, with a frosty glint.
mirror_x() {
  color(socket) translate([2.4, -9.3, 27.3]) rotate([0, 15, 0]) scale([2.1, 0.8, 2.3]) sphere(1, $fn = 18);
  ell([0.45, 0.3, 0.45], [2.8, -10, 28.2], frost);
}
// Nose and teeth.
color(socket) translate([0, -9.4, 24.9]) scale([0.6, 0.5, 0.8]) sphere(1, $fn = 12);
for (x = [-1.2, 0, 1.2]) color(socket) translate([x, -8.8, 22.6]) cube([0.25, 0.4, 1.2], center = true);
// Crack on the brow.
color(skullSh) translate([1.2, -9.25, 30.4]) rotate([0, 30, 0]) cube([0.3, 0.4, 2], center = true);

// Arms: draped sleeves ending in icy claws.
mirror_x() {
  limb([6, -1, 20], [10.5, -4, 13], 2.4, 2, robe);
  ell([2.2, 2, 1.8], [11, -4.6, 12], robeHi);
  for (a = [-35, -10, 15, 40]) chain([[11 + sin(a) * 1.6, -5.4, 11.5], [11.6 + sin(a) * 2.6, -6.8, 8.5], [11.8 + sin(a) * 2.8, -6.2, 6.5]], [0.8, 0.55, 0.25], frost);
}

// Streamers flowing from the hood, sweeping back and to the viewer's right.
chain([[3, 4, 34], [9, 6, 37], [15, 7, 36], [19, 9, 33], [21, 11, 29]], [1.8, 1.6, 1.4, 1.1, 0.7], robeHi);
chain([[4, 5, 30], [10, 8, 31], [15, 10, 28], [18, 11, 24], [17, 12, 19]], [1.7, 1.5, 1.2, 0.9, 0.6], robe);
chain([[-3, 5, 33], [-8, 8, 35], [-13, 10, 33], [-16, 11, 29]], [1.6, 1.4, 1.1, 0.7], robe);
// Frost motes.
for (p = [[22, 10, 26], [19, 13, 17], [-17, 12, 26], [13, 4, 16], [23, 8, 31]]) ell([0.6, 0.6, 0.6], p, frost);
