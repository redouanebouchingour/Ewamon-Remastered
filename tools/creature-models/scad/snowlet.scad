// Snowlet: a round puff of white snow-owl fluff with two big amber eyes, a tiny navy beak, a spiky tuft on top,
// stubby icy-blue wings and a pale blue fringe of fur round its bottom.
include <lib.scad>

white = [0.95, 0.97, 1];
ice = [0.75, 0.86, 0.95];
iceDk = [0.55, 0.7, 0.86];
amber = [0.92, 0.62, 0.1];
navy = [0.2, 0.3, 0.55];

// The puffball body.
color(white) translate([0, 0, 12.5]) scale([12, 11, 11.5]) sphere(1, $fn = 44);
// Blue-tinted underside.
color(ice) intersection() {
  translate([0, 0, 12.5]) scale([12.15, 11.15, 11.65]) sphere(1, $fn = 44);
  translate([0, 0, 2]) cube([30, 30, 10], center = true);
}
// Fluffy fringe: soft scalloped lobes round the bottom edge and a few on the flanks.
for (i = [0 : 19]) {
  a = i * 18;
  color(i % 2 == 0 ? ice : white) translate([10.3 * sin(a), -9.4 * cos(a), 7.4]) rotate([0, 0, -a]) rotate([-25, 0, 0]) scale([2.4, 1, 2.2]) sphere(1, $fn = 12);
}
for (i = [2 : 9]) {
  a = i * 30 + 15;
  color(white) translate([11.4 * sin(a), -10.4 * cos(a), 12]) rotate([0, 0, -a]) scale([3, 1, 3]) sphere(1, $fn = 14);
}
// Spiky fluff tuft on top.
for (t = [[0, 0, 24, 0, 0, 4], [2.5, 0.5, 23.5, 1.5, 0, 3.5], [-2.5, 0.5, 23.5, -1.5, 0, 3.5], [4.8, 1, 22.6, 2.2, 0, 2.6],
          [-4.8, 1, 22.6, -2.2, 0, 2.6], [1.2, 3, 23.3, 0.5, 1.5, 3], [-1.2, 3, 23.3, -0.5, 1.5, 3]])
  spike([t[0], t[1], t[2]], [t[3], t[4], t[5]], 1.8, 0.1, white);

// Big amber eyes with a dark rim and bright highlights.
mirror_x() {
  color(navy) translate([4.6, -9.8, 14.8]) rotate([0, 0, -22]) scale([3, 1, 3.7]) sphere(1, $fn = 22);
  color(amber) translate([4.6, -10.2, 14.8]) rotate([0, 0, -22]) scale([2.7, 1, 3.4]) sphere(1, $fn = 22);
  color([0.6, 0.35, 0.05]) translate([4.9, -11.0, 14]) rotate([0, 0, -22]) scale([1.2, 0.5, 1.6]) sphere(1, $fn = 16);
  color("white") translate([4.2, -11.2, 15.9]) sphere(0.75, $fn = 10);
}
// Tiny round navy beak between and below the eyes.
color(navy) hull() {
  translate([0, -10.8, 12.3]) scale([1.3, 1, 1.2]) sphere(1, $fn = 14);
  translate([0, -11.6, 11.2]) sphere(0.4, $fn = 8);
}

// Stubby wings sticking out to the sides: white root, icy-blue feather tips.
mirror_x() {
  petal([4.5, 2.2, 3], [13, 0, 12.5], [0, -20, 0], white);
  for (i = [0 : 2]) petal([4.2, 1.4, 1.3], [15.5, -0.3 + i * 1.0, 13.6 - i * 1.7], [0, -20 + i * 12, 0], i == 1 ? ice : white);
}
