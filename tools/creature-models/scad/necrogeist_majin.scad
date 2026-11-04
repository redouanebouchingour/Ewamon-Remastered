// Necrogeist Majin: the wraith gone feral, one big cracked indigo egg of a ghost (head and body in one) with two
// little horns, blood-red slanted eyes and a wide open red maw with two dark fangs, a glossy red orb in its belly,
// red cracks all over, short clawed arms, four torn bat wings (big upper ones, smaller hind ones) veined in red with
// a pale cyan rim, a curly ghost tail, a spiked crimson crown floating over its head and a broken red ring above that.
// Built from Necrogeist's scad (decals, wing plates in a plane behind the back, the tail chain), changed per the art.
// Checklist (front sheet, 40 units; art sheet x, z; the body's axis sits at art x -2.5):
//   body   an egg x -9.5..4.6, z 7..28.5, widest at z 17, the top flat between the horns
//   horns  two short cones at the top corners, tips (-8.6, 31) and (4, 31.5), curving out
//   eyes   red slanted almonds, inner corners low: far x -7.9..-5.9, near x -3.25..0.4, z 22..24.9
//   mouth  a wide open red maw x -8.5..1.25, z 18.4..23, darker red at the top, two dark fangs from the upper lip
//   orb    a glossy red sphere in a dark socket, centre (-3.85, 13.9), r 2.3, a pink highlight top left
//   cracks red lines from the orb over the belly and on the forehead; the back is cracked too
//   arms   short arms out to clawed hands, far hand x -17..-14 z 13..16.5 (the near one folds in front of the belly)
//   wings  upper: root at the shoulders, tips (-22.4, 36.6) / (22.7, 37.1), scalloped trailing edge with three spurs,
//          a hole or two; hind: x 5..15.3 / -16..-5, z 6.9..18, three points down. Purple membrane, darker near
//          the leading edge, red veins, pale cyan rim
//   tail   from the bottom of the egg curling down to the viewer's right, an S-curl ending at (9.6, 1.6)
//   crown  floating over the head x -8..2.8, z 29.5..35.5, a red band with alternating spikes, white inside
//   ring   a broken red ring standing over the crown at z 36.4..39.9, open top and bottom
include <lib.scad>

body = [0.23, 0.12, 0.34];
bodyHi = [0.34, 0.22, 0.46];
memb = [0.29, 0.04, 0.38];
membDk = [0.17, 0.03, 0.25];
rim = [0.73, 0.87, 0.88, NOGLOW];
vein = [0.87, 0.05, 0.26, NOGLOW];
crack = [0.8, 0.06, 0.2, NOGLOW];
eyeC = [1, 0.15, 0.3, GLOW];
mawC = [0.92, 0.1, 0.32, NOGLOW];
mawDk = [0.55, 0.04, 0.15];
orbC = [0.85, 0.02, 0.18, GLOW];
orbHi = [1, 0.6, 0.7, NOGLOW];
socket = [0.3, 0.02, 0.1];
crownC = [0.78, 0.1, 0.25, NOGLOW];
ringC = [0.68, 0.05, 0.18, NOGLOW];
white = [0.98, 0.95, 0.98, NOGLOW];

// ---- decal helpers (as in necrogeist.scad)
module decal(o, back = false) {
  intersection() {
    children(0);
    translate([o[0], 0, o[1]]) rotate([back ? -90 : 90, 0, 0]) linear_extrude(30) children(1);
  }
}
module line2(pts, w = 0.5) {
  for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) circle(w / 2, $fn = 8); translate(pts[i + 1]) circle(w / 2, $fn = 8); }
}

// ---- the egg: head and body in one, the top flatter
EGG = [[[6.6, 5.8, 7], [0, 0, 15]], [[7, 6, 5.5], [0, 0, 22.5]]];
module egg(k = 1) { hull() for (e = EGG) translate(e[1]) scale(e[0] * k) sphere(1, $fn = 40); }
module eggShell(g = 0.04) { difference() { egg(1 + g); egg(0.96); } }
color(body) egg();
// The tail: from the bottom of the egg down and out to the viewer's right in an S-curl.
TAIL = [[0, 0.5, 11.5], [2.9, 1, 7.6], [6.6, 1.5, 5.4], [8.1, 4, 3.8], [8.1, 5, 2], [7.5, 5, 0.9], [9.3, 5.5, 0.8], [10.5, 6, 1.7]];
TAIL_R = [4.2, 3, 1.9, 1.3, 1.0, 0.75, 0.55, 0.2];
chain(TAIL, TAIL_R, body);

// Horns at the top corners.
mirror_x() chain([[4.9, 0.5, 25.8], [6.3, 0.5, 28.8], [7.3, 0.8, 31.3]], [2, 1.1, 0.12], body);

// Eyes: red slanted almonds, inner corners low by the nose.
color(eyeC) mirror_x() decal([0, 0]) { eggShell(0.05); offset(r = 0.25) polygon([[1.0, 23.4], [4.6, 25.4], [4.5, 23.6], [3.6, 22.8], [2.0, 22.8]]); }
// Maw: dark red top, bright red below, two dark fangs from the upper lip.
MAW = concat([for (t = [-1 : 0.125 : 1]) [5.2 * t, 18.4 + 3.6 * t * t]], [for (t = [1 : -0.125 : -1]) [4.9 * t, 20.4 + 1.6 * t * t]]);
color(mawDk) decal([0, 0]) { eggShell(0.05); polygon(MAW); }
color(mawC) decal([0, 0]) {
  eggShell(0.07);
  difference() {
    intersection() { polygon(MAW); translate([-6, 15]) square([12, 4.9]); }
    mirror_x() translate([1.7, 20.6]) polygon([[-0.6, 0.4], [0.6, 0.4], [0, -1.3]]);
  }
}
color(body) decal([0, 0]) { eggShell(0.075); mirror_x() translate([1.7, 20.7]) polygon([[-0.6, 0.4], [0.6, 0.4], [0, -1.3]]); }

// Belly orb: a glossy red sphere in a dark socket.
ell([2.7, 1.4, 2.7], [0, -5.1, 13.9], socket);
ell([2.3, 1.8, 2.3], [0, -5.4, 13.9], orbC);
ell([0.7, 0.4, 0.55], [-0.9, -7.1, 15], orbHi);

// Red cracks: from the orb over the belly, on the forehead, and down the back.
CRACKS = [[[-2.2, 15], [-3.6, 17], [-5, 17.4], [-5.4, 19]], [[2, 15.6], [3.4, 17.4], [3.8, 19.6], [5, 21]],
          [[3.4, 17.4], [5, 16.6], [5.3, 15]], [[1.5, 12], [3.4, 10.8], [4.8, 10.8]], [[-1.8, 12], [-3, 10.4], [-3.4, 9]],
          [[0.8, 28], [0, 26.3], [-1.2, 25.6]], [[0, 26.3], [0.9, 25.2]], [[-4.6, 15.6], [-5.2, 13]]];
color(crack) for (l = CRACKS) decal([0, 0]) { eggShell(0.05); line2(l, 0.42); }
BACK = [[[0.5, 28.3], [-0.6, 25], [0.8, 22], [-0.8, 18.5], [1.2, 15], [-0.5, 11]], [[0.8, 22], [3.5, 20.5], [5.5, 21]],
        [[-0.8, 18.5], [-3.8, 17.5], [-5.5, 15]], [[1.2, 15], [4, 13.2], [4.8, 10.5]], [[-0.5, 25.5], [-2.5, 26.5]]];
color(crack) for (l = BACK) decal([0, 0], back = true) { eggShell(0.05); line2(l, 0.45); }

// ---- arms: short, out from the sides to clawed hands, three claws hanging down
ARM = [[6.4, -1, 18.5], [10, -2, 18.5], [11.8, -3, 16], [12, -3.4, 15]];
ARM_R = [1.7, 1.4, 1.1, 1.3];
mirror_x() {
  chain(ARM, ARM_R, body);
  for (dx = [-0.9, 0, 0.9]) chain([[12 + dx, -3.6, 14.4], [12.2 + dx * 1.3, -4.2, 13.3], [11.8 + dx * 1.3, -4.6, 12.4]], [0.5, 0.35, 0.08], body);
}

// ---- crown floating over the head, and a broken red ring above it
color(white) translate([0, 0, 30.2]) rotate_extrude($fn = 40) translate([4.4, 0]) scale([1, 0.6]) circle(0.6, $fn = 8);
color(crownC) translate([0, 0, 29.6]) difference() {
  cylinder(h = 2, r1 = 4.9, r2 = 5.3, $fn = 36);
  translate([0, 0, -1]) cylinder(h = 4, r1 = 4.1, r2 = 4.5, $fn = 36);
}
for (i = [0 : 9]) let(a = i * 36 + 18, h = i % 2 == 0 ? 3.8 : 2.4)
  color(crownC) translate([4.9 * cos(a), 4.9 * sin(a), 31.4]) rotate([0, 0, a]) scale([0.45, 1, 1]) cylinder(h = h, r1 = 1.2, r2 = 0.08, $fn = 4);
color(ringC) translate([0, 0, 38.2]) rotate([90, 0, 30]) difference() {
  cylinder(h = 0.9, r = 1.9, center = true, $fn = 24);
  cylinder(h = 2, r = 1.2, center = true, $fn = 24);
  cube([0.9, 5, 2], center = true);
}

// ---- wings: big upper bat wings and smaller hind wings, in a plane behind the back (y = 5.3). Outlines read off
// the near wings on the sheet (art x, z) and turned into scad x for that depth.
function conv(p) = [(p[0] - 0.15) / 0.866, p[1] - 0.8];
UP = [[2, 24.5], [4.7, 24.1], [7.3, 29.2], [10.7, 32.9], [14.1, 35.1], [17.6, 36.6], [20.3, 37.1], [22.7, 37.1], [21, 34.6],
      [18.9, 31.2], [16.9, 29.7], [19.1, 30.3], [20.6, 28], [17.6, 26.1], [17.4, 24.1], [15.2, 23.5], [16.5, 19.6],
      [13.6, 19.5], [13.6, 18.1], [10.7, 18.8], [7.8, 18.6], [5.9, 18.4], [2, 19]];
HIND = [[2, 18.2], [6.4, 18.1], [9.8, 17.3], [12.6, 15], [13.6, 12.5], [12.6, 11.1], [15.3, 6.9], [11.6, 9.1], [9.7, 6.9],
        [7.5, 9.4], [5.4, 13.3], [2, 14]];
UPDK = [[2, 23.5], [4.7, 23.2], [7.3, 28.2], [10.7, 31.8], [14.1, 33.9], [17.6, 35.5], [16.5, 33.6], [12, 28], [8, 23.5], [4, 21]];
HOLES = [[12, 20.9, 0.55], [17.2, 25.3, 0.4]];
UPV = [[[3.5, 21.8], [9.5, 25.5], [12, 29], [15, 32.5], [16.5, 34.5]], [[9.5, 25.5], [12.4, 32.2]],
       [[3.5, 21.5], [10, 25], [14.5, 26.5], [17.7, 27.7]], [[3.5, 20.5], [10.5, 22], [14, 21.8]], [[12, 29], [18, 33.2]]];
HINDV = [[[4, 16.5], [9, 13], [9, 8.5]], [[4, 16.8], [11.2, 15], [12.2, 13.5]], [[9.8, 15.5], [11.5, 9.8]]];
module membrane(pts, holes = []) {
  difference() {
    polygon([for (p = pts) conv(p)]);
    for (h = holes) translate(conv(h)) circle(h[2], $fn = 10);
  }
}
module wing() {
  translate([0, 5.3, 0]) rotate([90, 0, 0]) {
    color(rim) linear_extrude(0.7, center = true) offset(r = 0.4) membrane(UP, HOLES);
    color(memb) linear_extrude(1.1, center = true) offset(r = -0.15) membrane(UP, HOLES);
    color(membDk) linear_extrude(1.2, center = true) intersection() { membrane(UP, HOLES); polygon([for (p = UPDK) conv(p)]); }
    color(vein) for (l = UPV) linear_extrude(1.35, center = true) line2([for (p = l) conv(p)], 0.4);
  }
  translate([0, 4.5, 0]) rotate([90, 0, 0]) {
    color(rim) linear_extrude(0.6, center = true) offset(r = 0.4) membrane(HIND);
    color(memb) linear_extrude(1.0, center = true) offset(r = -0.15) membrane(HIND);
    color(vein) for (l = HINDV) linear_extrude(1.25, center = true) line2([for (p = l) conv(p)], 0.38);
  }
}
mirror_x() wing();
