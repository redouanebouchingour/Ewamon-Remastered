// Gnashfin: a stubby blue shark pup standing upright, a huge toothy grin, a purple X scar, dorsal fin and tail fin.
include <lib.scad>

navy = [0.13, 0.22, 0.45];
navyHi = [0.18, 0.3, 0.56];
blue = [0.24, 0.5, 0.85];
cream = [0.97, 0.93, 0.72];
mouthDark = [0.12, 0.08, 0.15];
scar = [0.55, 0.22, 0.5];
irisC = [0.15, 0.5, 0.9];

// Head surface helper: front of the head ellipsoid (rx 11, ry 10) at height z near the mouth.
hx = 11.5; hy = 10.5; hc = [0, -1, 25];
function front_y(x, sq = 1) = hc[1] - hy * sqrt(max(0, 1 - pow(x / hx, 2))) * sq;

// Torso: navy back, blue belly.
blob([[[8, 7, 7], [0, 0, 9]], [[7, 6.5, 6], [0, 0, 15]]], navy);
blob([[[6, 3.5, 6], [0, -4.2, 10]], [[5, 3, 4], [0, -4, 15]]], blue);

// Head: navy dome with a pale blue jaw and cheeks below.
ell([hx, hy, 9.5], hc, navy);
blob([[[10.6, 9.4, 4.5], [0, -1.6, 20.5]], [[8, 7, 3], [0, -2, 18.5]]], blue);
// Snout ridge.
ell([6, 4, 3.5], [0, -8.2, 28], navy);

// The grin: a dark mouth slab across the front with big cream teeth top and bottom.
function my(x) = -11.6 + 0.055 * x * x;
color(mouthDark) hull() for (x = [-10.5 : 1.5 : 10.5]) translate([x, my(x) + 0.9, 22.6]) scale([1, 0.6, 2.2]) sphere(1.6, $fn = 10);
module teeth_row(z0, dz, w) {
  for (x = [-9.6 : w : 9.7]) {
    y = my(x) - 0.2;
    color(cream) translate([x, y, z0]) hull() {
      translate([-w / 2, 0.3, 0]) sphere(0.75, $fn = 8);
      translate([w / 2, 0.3, 0]) sphere(0.75, $fn = 8);
      translate([0, -0.2, dz]) sphere(0.3, $fn = 6);
    }
  }
}
// Gum bands so the teeth read as a solid white grin.
color(cream) hull() for (x = [-10.4 : 1.3 : 10.4]) translate([x, my(x) + 0.1, 26.2]) scale([1, 1, 0.8]) sphere(0.9, $fn = 8);
color(cream) hull() for (x = [-9.6 : 1.2 : 9.6]) translate([x, my(x) + 0.2, 19.2]) scale([1, 1, 0.8]) sphere(0.8, $fn = 8);
teeth_row(25.6, -3.6, 2.4);
teeth_row(19.7, 3.2, 2.1);

// Eyes: blue, mean, under a heavy brow; set high on the head.
mirror_x() {
  eye([4.8, -10.2, 29.6], 2.1, iris = irisC, pupil = [0.05, 0.1, 0.2], yaw = -22);
  color(navyHi) translate([4.6, -10.8, 31.8]) rotate([0, 18, -22]) scale([2.8, 1, 0.7]) sphere(1, $fn = 14);
}
// Purple X scar over the viewer's left brow.
color(scar) for (a = [38, -38]) translate([-5.6, -10.6, 32]) rotate([0, a, -22]) scale([0.45, 0.45, 3]) sphere(1, $fn = 10);

// Dorsal fin on the crown, swept back, with a notched edge.
color(navy) hull() {
  translate([0, 0, 32]) scale([1.6, 6, 1]) sphere(1, $fn = 14);
  translate([0, 7, 44]) sphere(0.6, $fn = 8);
}
color(navy) hull() {
  translate([0, 5, 36]) sphere(1, $fn = 8);
  translate([0, 10, 38]) sphere(0.5, $fn = 8);
}

// Pectoral fins as arms, flaring out sideways and down.
mirror_x() color(navy) hull() {
  translate([6.5, -1, 16]) scale([1.2, 3, 2.4]) sphere(1, $fn = 12);
  translate([15, -2.5, 8.5]) sphere(0.6, $fn = 8);
  translate([11.5, 1.5, 7.5]) sphere(0.5, $fn = 8);
}
mirror_x() color(blue) hull() {
  translate([6.8, -2.4, 15]) sphere(1, $fn = 10);
  translate([12, -2.6, 10.5]) sphere(0.4, $fn = 8);
}

// Stubby legs with pale blue feet.
mirror_x() {
  ell([3.4, 3.4, 3.6], [4.3, 0, 4.4], navy);
  ell([3.2, 4.2, 1.8], [4.6, -1.6, 1.8], blue);
}

// Shark tail behind, sweeping to the viewer's right, with a big forked fin.
chain([[1, 5, 7], [5, 9, 5.5], [10, 11, 6], [13, 11, 8]], [4.5, 3.4, 2.4, 1.8], navy);
color(navy) hull() {
  translate([13, 11, 8]) scale([1, 1.4, 2]) sphere(1.6, $fn = 10);
  translate([16, 13, 21]) sphere(0.5, $fn = 8);
  translate([15, 10.5, 16]) sphere(0.5, $fn = 8);
}
color(navy) hull() {
  translate([13, 11, 8]) sphere(1.4, $fn = 10);
  translate([18, 12, 3]) sphere(0.5, $fn = 8);
}
