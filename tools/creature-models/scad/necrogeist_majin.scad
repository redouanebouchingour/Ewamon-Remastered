// Necrogeist Majin: the wraith gone feral, a cracked indigo egg of a ghost with blood-red eyes and fanged maw,
// torn bat wings veined in red, a red gem in its chest and a crimson crown under a pale halo.
include <lib.scad>

body = [0.22, 0.13, 0.34];
bodyHi = [0.32, 0.2, 0.48];
wingDk = [0.22, 0.12, 0.34];
wingMid = [0.45, 0.25, 0.62];
rim = [0.55, 0.85, 0.85];
red = [0.9, 0.08, 0.2];
redDk = [0.55, 0.04, 0.12];
crown = [0.85, 0.12, 0.25];
halo = [0.98, 0.95, 0.98];
eyeRed = [1, 0.2, 0.25];
fang = [1, 0.95, 0.95];

module paint(r, c, o, grow = 0.05, back = false) {
  intersection() {
    translate(c) difference() { scale(r * (1 + grow)) sphere(1, $fn = 40); scale(r * 0.97) sphere(1, $fn = 40); }
    translate([o[0], c[1], o[1]]) rotate([back ? -90 : 90, 0, 0]) linear_extrude(r[1] * 2) children();
  }
}
// 2D polyline of thickness w.
module line2(pts, w = 0.5) {
  for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) circle(w / 2, $fn = 6); translate(pts[i + 1]) circle(w / 2, $fn = 6); }
}

// Wispy tail curling to the ground.
chain([[0, 0, 15], [0.5, 0.5, 10], [2.5, 1, 6], [4.5, 1.5, 3], [6.5, 1, 1.2], [8, 0.5, 1.6], [8.4, 0, 3.4]],
      [7, 5.4, 3.6, 2.3, 1.4, 0.8, 0.5], body);
// Body: a fat egg, belly below a wide head.
belly = [8.5, 7.5, 8];
bellyC = [0, 0, 20];
head = [9.5, 8.5, 9];
headC = [0, 0, 32];
ell(belly, bellyC, body);
ell(head, headC, body);
color(body) hull() { translate([0, 0, 24]) scale([7, 6.5, 3]) sphere(1, $fn = 28); }
ell([4.5, 3, 3.5], [-3, -2, 38.5], bodyHi);
// Little horns.
mirror_x() limb([6, 0, 38], [8, 0.5, 42.5], 1.9, 0.25, body);

// Red cracks over the body, front and back.
color(red) paint(head, headC, [4.5, 32]) line2([[-2, 4], [0, 1], [2, 0], [3, -3]]);
color(red) paint(belly, bellyC, [-5, 18]) line2([[-4, 4], [-2, 1], [-3, -2], [-1, -5]]);
color(red) paint(belly, bellyC, [4.5, 16.5]) line2([[0, 2], [2, 0], [1, -3], [3, -5]]);
color(red) paint(head, headC, [0, 32], back = true) line2([[-1, 7], [1, 3], [-1, 0], [1, -4], [0, -8]], 0.6);
color(red) paint(belly, bellyC, [0, 20], back = true) line2([[1, 6], [-2, 2], [0, -1], [-3, -5]], 0.6);
color(red) paint(belly, bellyC, [0, 20], back = true) line2([[0, -1], [4, -3]], 0.6);

// Chest gem: a glossy red orb in a dark socket.
ell([2.8, 1.6, 2.8], [0, -7.1, 21], redDk);
ell([2.2, 1.6, 2.2], [0, -7.6, 21], red);
color("white") translate([-0.7, -9, 21.8]) sphere(0.45, $fn = 8);

// Angry red eyes with white pupils, under a heavy brow.
mirror_x() {
  color(eyeRed) paint(head, headC, [3.4, 34.2], grow = 0.07) rotate(22) scale([1.4, 0.9])
    difference() { circle(2.2, $fn = 24); translate([0, 2.4]) square(4.4, center = true); }
  color("white") paint(head, headC, [3.2, 33.5], grow = 0.09) circle(0.45, $fn = 8);
}
// Fanged open maw.
color(redDk) paint(head, headC, [0, 28.8], grow = 0.06) scale([1.5, 1])
  difference() { circle(3.2, $fn = 28); translate([0, 3.6]) square(6.4, center = true); }
color(red) paint(head, headC, [0, 28.1], grow = 0.07) scale([1.4, 0.6]) circle(1.8, $fn = 20);
color(fang) mirror_x() for (f = [[2.2, 29.1], [-0.9, 29.1], [3.5, 28.6]])
  paint(head, headC, [f[0], f[1]], grow = 0.08) polygon([[-0.5, 0.4], [0.5, 0.4], [0, -1.1]]);
color(fang) mirror_x() paint(head, headC, [1.3, 26.4], grow = 0.08) polygon([[-0.4, -0.3], [0.4, -0.3], [0, 0.8]]);

// Clawed arms reaching forward.
mirror_x() {
  chain([[7, -1, 24], [10.5, -3, 21], [12, -5, 18]], [2.4, 2, 1.9], body);
  for (a = [-40, -10, 20]) chain([[12, -5, 18], [12 + sin(a) * 2, -7, 17], [12 + sin(a) * 2.8, -8, 15.2]], [0.9, 0.55, 0.12], body);
}

// Crimson crown on a white halo, a broken red ring floating above.
color(halo) translate([0, 0, 41.5]) rotate_extrude($fn = 40) translate([4.8, 0]) scale([1, 0.5]) circle(0.7, $fn = 8);
color(crown) translate([0, 0, 42]) difference() {
  cylinder(h = 2, r = 4.6, $fn = 32);
  translate([0, 0, -1]) cylinder(h = 4, r = 3.8, $fn = 32);
}
for (i = [0 : 7]) let(a = i * 45, h = i % 2 == 0 ? 3.6 : 2.4)
  color(crown) translate([4.2 * cos(a), 4.2 * sin(a), 43.8]) rotate([0, 0, a]) scale([0.5, 1, 1]) cylinder(h = h, r1 = 1.1, r2 = 0.1, $fn = 4);
color(crown) translate([0, 0, 52]) rotate([90, 0, 0]) difference() {
  cylinder(h = 0.8, r = 1.8, center = true, $fn = 20);
  cylinder(h = 2, r = 1.1, center = true, $fn = 20);
  cube([0.8, 5, 2], center = true);
}

// Torn bat wings with red veins and a pale rim.
wingShape = [[0, -6], [0, 6], [6, 12], [14, 17], [23, 21], [20, 15], [22, 10], [17.5, 9], [19, 3], [14, 3], [15, -3],
             [10.5, -2], [11, -8], [7, -6], [5, -11], [2, -8]];
module wing2() {
  difference() {
    polygon(wingShape);
    for (h = [[18, 13, 0.7], [12, 0, 0.55], [8, -4, 0.5]]) translate([h[0], h[1]]) circle(h[2], $fn = 8);
  }
}
mirror_x() translate([6, 3, 28]) rotate([0, 0, 14]) rotate([90, 0, 0]) {
  color(rim) linear_extrude(0.6, center = true) offset(r = 0.5) wing2();
  color(wingMid) linear_extrude(1.0, center = true) wing2();
  color(wingDk) linear_extrude(1.2, center = true) offset(r = -2.5) wing2();
  color(red) linear_extrude(1.5, center = true) {
    line2([[1, 2], [8, 9], [14, 14], [22, 20]], 0.45);
    line2([[8, 9], [10, 13]], 0.35);
    line2([[2, 1], [10, 4], [17, 5]], 0.45);
    line2([[10, 4], [13, 8]], 0.35);
    line2([[2, -1], [8, -3], [10, -6]], 0.4);
    line2([[3, -2], [4, -8]], 0.35);
  }
  // Wing bone along the top edge.
  color(body) linear_extrude(1.8, center = true) line2([[0, 5], [6, 11], [14, 16], [22.5, 20.5]], 1.0);
}
