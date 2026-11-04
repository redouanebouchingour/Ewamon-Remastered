// Fedoraith: Nerohat grown into a scarecrow wraith. A big round grey stone face with a jagged gold grin and angry
// red eyes under a blue cowboy hat, a navy shroud whose tattered streamers fan out wide to both sides like a cloak
// thrown open, thin dark arms reaching out to spidery clawed hands, the bottom dissolving into ragged wisps.
//
// Checklist (front sheet, 68 x 40, wide rather than tall):
// - face: grey ellipsoid, sheet x -13.8..6, z 11.3..29.4 (a disc in front of the shroud), colour #605861-ish
// - eyes: two angry slanted eyes at sheet (-10.5, 22.2) and (-1.1, 22.2), ~3.5 x 4: gold rim, red iris, black slit,
//   lid sloping down towards the nose (V brows)
// - grin: gold zig-zag band from x -13.8 to 4.6, ends curling up to z 20.5, bottom at z 15
// - hat: blue cowboy hat, brim x -13..11 z 30..32 with both sides curled up to z 35..37, crown x -5.6..3.6 to z 39.8,
//   a pinched top and a dark band
// - shroud: navy mass behind the head z 12..31; upper streamers fan up and out to (+-28..34, 36.7), lower ones to
//   (30, 31), (25, 27), (21, 23); the bottom a skirt of ragged wisps to the ground, x -16..21
// - arms: thin dark arms out from behind the face at z 18, dipping to z 15, up to the hands at (+-27.5, 19.5);
//   hands: spidery fingers spreading up, out and down (z 13.4..25.5)
// - back: the shroud covers everything but the hat; streaked tatters, the arms and hands to the sides
include <lib.scad>

face = [0.36, 0.33, 0.37];
gold = [0.85, 0.69, 0.23, NOGLOW];
ink = [0.15, 0.13, 0.2];
red = [0.92, 0.16, 0.1, NOGLOW];
shroud = [0.23, 0.22, 0.36];
shroudHi = [0.28, 0.27, 0.44];
shroudLt = [0.34, 0.35, 0.53];
shroudDk = [0.17, 0.15, 0.26];
hat = [0.23, 0.34, 0.58];
hatDk = [0.12, 0.13, 0.22];
hand = [0.21, 0.2, 0.26];

H = [0, -6.5, 20.3];     // head centre
HR = [10.4, 7.5, 9.2];   // head radii

// A tattered ribbon: hull of flattened spheres through pts with widths ws, flattened to `fl` along local y, the
// flat face turned by `rz` about Z.
module ribbon(pts, ws, c, fl = 0.5, rz = 0) {
  for (i = [0 : len(pts) - 2]) color(c) hull() {
    translate(pts[i]) rotate([0, 0, rz]) scale([1, fl, 1]) sphere(ws[i], $fn = 12);
    translate(pts[i + 1]) rotate([0, 0, rz]) scale([1, fl, 1]) sphere(ws[i + 1], $fn = 12);
  }
}

// ---- The shroud: a dark mass behind the head, tapering down.
blob([[[11, 6.5, 6], [0, 2, 25]], [[12, 6.5, 5.5], [0, 2, 16]], [[9, 5.5, 4], [0, 2.5, 10]]], shroud);
// a hood rising behind the hat brim
ell([7, 5, 3.4], [0, 1, 28.5], shroudDk);

// ---- The skirt: a curtain of ragged wisps hanging from the shroud to the ground; the side ones stream outwards.
skirt = [
  // [azimuth, end radius, end z, base width, colour index, sway (deg)]
  [-90, 10, 0, 3.4, 1, 4], [-70, 12, 0.2, 3.2, 0, -6], [-110, 12, 0.4, 3.2, 2, 6], [-50, 14, 1, 3, 1, -8],
  [-130, 14, 1.2, 3, 0, 8], [-28, 16, 2.5, 2.8, 2, -6], [-152, 16, 3, 2.8, 1, 6], [-8, 17.5, 5, 2.4, 0, -4],
  [-172, 17, 4.5, 2.4, 2, 4], [15, 16, 2.5, 2.8, 1, 6], [165, 16, 2.5, 2.8, 0, -6], [40, 13, 0.6, 3, 2, 6],
  [140, 13, 0.6, 3, 1, -6], [65, 11, 0.4, 3.2, 0, 4], [115, 11, 0.4, 3.2, 2, -4], [90, 10, 0.2, 3.4, 1, 0],
  [-80, 8.5, 2, 2.8, 3, 0], [-100, 8.5, 1.8, 2.8, 3, 0], [-60, 10, 3.5, 2.6, 2, 0], [-120, 10, 3.5, 2.6, 2, 0],
];
skirtC = [shroud, shroudHi, shroudLt, shroudDk];
function hemPt(a, r, z) = [r * cos(a), 2.5 + r * 0.72 * sin(a), z];
for (s = skirt) {
  a = s[0]; r = s[1]; ze = s[2]; w = s[3]; sw = s[5];
  ribbon([hemPt(a, 8, 12.5), hemPt(a, 0.55 * 8 + 0.45 * r, 7.5), hemPt(a + sw * 0.5, r * 0.88, ze + 2.4), hemPt(a + sw, r, ze)],
    [w, w * 0.85, w * 0.45, 0.25], skirtC[s[4]], 0.45, a - 90);
}

// ---- The wings of the shroud: tattered streamers fanning up and out from each shoulder, swept a little back.
// Wing frame: u outwards along local x from the shoulder, z absolute, local y the thickness.
WING_T = [5, 2, 0];
WING_A = 3;
wingStreamers = [
  // [points [u, y, z], widths, colour]
  [[[0, 0, 26], [10, 0.3, 29.5], [19, 0.8, 32.4], [25.5, 1, 34.6], [30, 1, 36.6]], [4.2, 3.6, 2.6, 1.3, 0.25], shroud],
  [[[0, -0.5, 27], [7, -0.3, 30], [14, 0, 32.5], [19.5, 0.5, 35]], [3.6, 3, 1.6, 0.25], shroudHi],
  [[[0, -0.8, 28], [4, -0.8, 31], [7.5, -0.6, 34]], [2.8, 1.9, 0.25], shroudHi],
  [[[0, 0.5, 24], [10, 0.8, 26], [20, 1, 28.5], [28, 1.2, 31.4]], [4, 3.2, 1.9, 0.25], shroudLt],
  [[[0, 0.3, 22.5], [9, 0.3, 23.5], [17, 0.5, 25], [23.5, 0.6, 27]], [3.6, 2.8, 1.6, 0.25], shroud],
  [[[0, 0, 21], [8, -0.2, 21.4], [16.5, -0.2, 22.6]], [3.2, 2.3, 0.25], shroudDk],
  [[[4, 0.6, 27], [14, 0.8, 30], [23, 1, 33.4]], [3.2, 2.2, 0.25], shroudDk],
  [[[4, 0.8, 25], [15, 1, 26.8], [25, 1.1, 29.4]], [3, 2.2, 0.25], shroudHi],
];
mirror_x() translate(WING_T) rotate([0, 0, WING_A]) {
  for (s = wingStreamers) ribbon(s[0], s[1], s[2], 0.5);
  // the web joining the streamers near the shoulder
  color(shroud) translate([7, 0.3, 26.5]) scale([10, 2.4, 5.5]) sphere(1, $fn = 20);
  color(shroud) translate([15, 0.6, 27.5]) scale([8, 1.9, 3.6]) sphere(1, $fn = 20);
}

// ---- Head: a big round grey stone face.
ell(HR, H, face);
module headShell(k) translate(H) scale(HR * k) sphere(1, $fn = 44);

// Angry slanted eyes: gold rim, red iris, black slit, the grey lid sloping down to the nose.
EYE = [5.4, -12.3, 22.3];
mirror_x() eye(EYE, 2.4, iris = red, sclera = gold, yaw = 22, pupil = "black", lid = 0.32, lid_tilt = 32, lid_c = face,
  squint = 0.12, slit = 0.35);

// Jagged grin: a gold zig-zag band painted round the lower face, in a dark outline.
GN = 14;
function grinZ(x) = 15.3 + 5.2 * pow(abs(x) / 9.2, 2.5);
function grinX(i) = -9.2 + i * 18.4 / GN;
function zig(i) = (i % 2 == 0 ? 0.55 : -0.55);
grinPts = concat([for (i = [0 : GN]) [grinX(i), grinZ(grinX(i)) + 0.65 + zig(i)]],
                 [for (i = [GN : -1 : 0]) [grinX(i), grinZ(grinX(i)) - 0.65 + zig(i)]]);
module grinPrism(o) rotate([90, 0, 0]) linear_extrude(20) offset(r = o) polygon(grinPts);
color(ink) intersection() { headShell(1.012); grinPrism(0.4); }
color(gold) intersection() { headShell(1.026); grinPrism(0); }

// ---- Cowboy hat on top, the brim's sides curled up, a pinched crown and a dark band.
HAT = [0, -4.5, 29.4];
translate(HAT) rotate([-6, 0, 0]) {
  // brim
  color(hat) scale([13.6, 9.4, 1]) cylinder(h = 0.9, r = 1, $fn = 40);
  // the brim's curled-up sides
  mirror_x() color(hat) translate([12.4, 0, 2.1]) rotate([0, -50, 0]) scale([3.9, 7.8, 0.8]) sphere(1, $fn = 20);
  // crown, narrowing up to a pinched top with a shallow dent
  color(hat) hull() {
    translate([0, 0, 0.8]) scale([5.8, 4.6, 1]) sphere(1, $fn = 24);
    translate([0, 0, 6]) scale([4, 3.2, 1.4]) sphere(1, $fn = 20);
    mirror_x() translate([1.9, 0, 8.6]) scale([1.9, 2.5, 1.2]) sphere(1, $fn = 14);
  }
  // hat band
  color(hatDk) translate([0, 0, 1.5]) scale([5.15, 4.35, 1]) cylinder(h = 1.1, r = 1, $fn = 28);
}

// ---- Thin dark arms reaching out from behind the face, dipping, up to spidery clawed hands.
ARM = [[8, -1, 18.5], [18, -2.5, 14.8], [28.5, -3, 18.8]];
PALM = [31, -3, 19.5];
FINGERS = [[88, 6.8], [55, 7], [22, 6.6], [-12, 6.4], [-48, 7], [-80, 6.6]];   // [angle up from +x, length]
function fpt(a, l, k, f) = PALM + [cos(a) * l * k, -1.6 * pow(k, 2) - 0.2, sin(a) * l * k] + f;
mirror_x() {
  chain(ARM, [0.55, 0.5, 0.5], hand);
  ell([2, 1.4, 2.2], PALM, hand);
  for (fg = FINGERS) {
    a = fg[0]; l = fg[1];
    // each finger bows outwards and its claw hooks back towards the palm's line
    chain([fpt(a, l, 0.2, [0, 0, 0]), fpt(a, l, 0.55, [0, 0, 0]),
           fpt(a, l, 0.85, [cos(a - 90) * 0.6, 0, sin(a - 90) * 0.6]), fpt(a, l, 1, [cos(a - 90) * 1.6, 0, sin(a - 90) * 1.6])],
      [0.62, 0.52, 0.38, 0.14], hand);
  }
}
