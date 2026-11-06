// Snapling: a green lizard on four short splayed legs whose head is a huge venus-flytrap gaping wide open: two deep
// bowl-shaped jaws hinged at the back, bright lime lips, rows of cream fangs, a dark green mouth with a black throat.
// A pair of big pointed leaves (and a small pair under them) grow at the neck; the thick tail rises off the rump,
// swings out to its left and curls forward, ending in a dark purple star-shaped bud.
//
// Checklist (front sheet, sheet z; the art's feet stand on sheet z 5.7, so scad z = sheet z - 5.7):
//   head: sheet x -18.6..-2, z 10.5..32.8 (half the creature). Hinge / throat at (-3.5, 21). Upper jaw tip (-18.5, 28),
//     lower jaw tip (-17, 15). No eyes in the art. Lime lip band round both rims, ~10 fangs per jaw, 1.5..2.3 long.
//   body: x -2..15, z 12.5..25 (hunched at the shoulders, lower at the rump). Same green all over.
//   legs: near front foot x -1..6, far front foot x -15.5..-11 (reaches forward under the jaw), near hind foot
//     x 10..14, far hind foot x -4..3; stocky, 3 pointed toes each.
//   leaves: big one (0.7..5.5, z 21..30.4) rising up and back from the neck, small one (1..3.3, 19..21) under it;
//     the back view shows the far pair the same way.
//   tail: thick, off the rump at (15, 18..24), up to (16, 28), curls left to (9.5, 31), the bud on its tip.
//   bud: dark purple 5-point star x 6.5..16, z 32.3..39.1, a lighter midrib.
include <lib.scad>
$fa = 10;
$fs = 0.9;

G = 5.7;   // the art's foot line on the sheet

skin = [0.45, 0.73, 0.11];
lip = [0.63, 0.95, 0.16, NOGLOW];
mouthIn = [0.16, 0.37, 0.17];
throat = [0.03, 0.07, 0.04];
fang = [0.93, 0.88, 0.68];
skinHi = [0.58, 0.88, 0.15, NOGLOW];   // the lighter leaf-vein / scale pattern
leafC = [0.47, 0.76, 0.12];
vein = [0.66, 0.95, 0.2, NOGLOW];
claw = [0.63, 0.95, 0.16, NOGLOW];
bud = [0.38, 0.24, 0.46];
budHi = [0.6, 0.45, 0.7];

// ---- Head: two deep bowl jaws (half ellipsoid shells) hinged at H.
H = [0, -7.5, 15.6];
YAW = 18;          // the head turned towards the creature's right, as drawn
UA = 50;           // upper jaw raised
LA = 26;           // lower jaw dropped
RU = [8, 10, 8.8];
RL = [7.6, 9.2, 7.8];
F = 0.85;          // the bowl's centre sits F * ry in front of the hinge
K = 0.84;          // inner shell scale

// One jaw, opening downwards onto z = 0 (the rim), bowl up; the hinge at the origin, the jaw reaching along -Y.
module jaw(r, nT, tl) {
  c = [0, -F * r[1], 0];
  module outer() translate(c) scale(r) sphere(1, $fn = 40);
  module inner() translate(c) scale(r * K) sphere(1, $fn = 32);
  // green back of the jaw
  color(skin) difference() {
    outer();
    inner();
    translate([0, 0, -50 + 1.7]) cube(100, center = true);
  }
  // lime lip band along the rim
  color(lip) intersection() {
    difference() { outer(); inner(); }
    translate([-20, -40, 0]) cube([40, 60, 1.7]);
  }
  // dark green lining of the mouth
  color(mouthIn) difference() {
    inner();
    translate(c) scale(r * K - [0.5, 0.5, 0.5]) sphere(1, $fn = 32);
    translate([0, 0, -50]) cube(100, center = true);
  }
  // fangs round the rim (not behind the hinge), pointing out of the bowl into the mouth
  for (i = [0 : nT - 1]) let(t = -232 + i * 282 / (nT - 1), q = (1 + K) / 2,
                              p = c + [q * r[0] * cos(t), q * r[1] * sin(t), 0.1])
    spike(p, [-0.3 * cos(t), -0.3 * sin(t), -1] * tl * (0.8 + 0.35 * (i % 2)), 0.72, 0.05, fang);
}

translate(H) rotate([0, 0, -YAW]) {
  rotate([-UA, 0, 0]) jaw(RU, 13, 2.6);
  rotate([LA, 0, 0]) mirror([0, 0, 1]) jaw(RL, 12, 2.4);
  // black throat at the back of the mouth
  ell([5.6, 2.6, 5.4], [0, 1.2, 0.2], mouthIn);
  ell([3.4, 1.4, 3], [0, -0.9, 0.4], throat);
}
// Neck: the back of the head flowing into the shoulders.
limb([0, -2.6, 15.2], [0, 1, 12.8], 5.4, 6, skin);

// ---- Body: a hunched lizard torso, high at the shoulders, lower at the rump.
BF = [[6.2, 5.6, 6.4], [0, 1, 12.2]];    // front (shoulder) ellipsoid: radii, centre
BR = [[5.6, 6.6, 5.4], [0, 9.5, 11.4]];  // rear ellipsoid
blob([BF, BR], skin);

// A flush patch (a flattened ellipsoid half sunk into the surface) on ellipsoid e at azimuth az / elevation el,
// size [a, b] along the surface, turned `spin` about the normal.
module patchOn(e, az, el, a, b, c, spin = 0) {
  r = e[0];
  d = [cos(el) * cos(az), cos(el) * sin(az), sin(el)];
  s = e[1] + [r[0] * d[0], r[1] * d[1], r[2] * d[2]];
  n = [d[0] / r[0], d[1] / r[1], d[2] / r[2]];
  color(c) translate(s - n / norm(n) * 0.15) rotate(_dir_rot(n)) rotate([0, 0, spin]) scale([a, b, 0.42]) sphere(1, $fn = 8);
}
BM = [[5.9, 6, 5.9], [0, 5.25, 11.8]];  // stand-in for the hull's middle (the patches between the two ellipsoids)
// Scales of the lighter net pattern over the back and flanks (both sides).
mirror_x() {
  for (i = [0 : 2], j = [0 : 2]) {
    patchOn(BF, -50 + 25 * i, 14 + 23 * j + 8 * (i % 2), 1.15, 0.9, skinHi, 30 * i + 20 * j);
    patchOn(BM, -20 + 20 * i, 8 + 23 * j + 8 * (i % 2), 1.15, 0.9, skinHi, 30 * i + 20 * j);
    patchOn(BR, 10 + 30 * i, 14 + 23 * j + 8 * (i % 2), 1.15, 0.9, skinHi, 30 * i + 20 * j);
  }
}
// Ridge of scutes along the spine, from the neck to the rump.
for (y = [-1.5 : 1.9 : 13.5]) let(z = y < 1 ? 12.2 + 6.4 * sqrt(1 - pow((y - 1) / 5.6, 2))
                                  : y < 9.5 ? 18.6 - (y - 1) / 8.5 * 1.8
                                  : 11.4 + 5.4 * sqrt(1 - pow((y - 9.5) / 6.6, 2)))
  color(skinHi) translate([0, y, z - 0.25]) rotate([-12, 0, 0]) scale([0.75, 1.05, 0.8]) sphere(1, $fn = 10);

// ---- Leaves at the neck: a big pair rising up and back, a small pair under them pointing out and down.
// A broad flat leaf `len` long, `w` wide, `t` thick: an almond blade on a short stalk, a light midrib and side veins
// proud of both faces.
module leaf(len, w, t) {
  color(leafC) hull() {
    sphere(t * 0.45, $fn = 8);
    translate([0, 0, len * 0.46]) scale([w / 2, t / 2, len * 0.38]) sphere(1, $fn = 24);
    translate([0, 0, len]) scale([0.2, t * 0.3, 0.2]) sphere(1, $fn = 6);
  }
  color(vein) {
    hull() {
      translate([0, 0, len * 0.06]) scale([0.32, t / 2 + 0.14, 0.3]) sphere(1, $fn = 8);
      translate([0, 0, len * 0.9]) scale([0.14, t * 0.2 + 0.1, 0.14]) sphere(1, $fn = 6);
    }
    for (k = [0.32, 0.5, 0.68]) mirror_x() hull() {
      translate([0, 0, len * k]) scale([0.16, t / 2 * 0.75 + 0.1, 0.16]) sphere(1, $fn = 6);
      translate([w * 0.3 * (1.1 - k), 0, len * (k + 0.13)]) scale([0.12, t / 2 * 0.5 + 0.08, 0.12]) sphere(1, $fn = 6);
    }
  }
}
mirror_x() {
  translate([4, -1.2, 17]) rotate([0, 0, 35]) rotate([-24, 26, 0]) leaf(12, 8.4, 1.4);
  translate([5.4, 1.4, 12.6]) rotate([0, 0, 30]) rotate([-50, 115, 0]) leaf(6.5, 4.4, 1.1);
}

// ---- Legs: short, thick, sprawled lizard legs: the upper leg out sideways to a bent elbow / knee, a short shin
// down to a big splayed foot with four clawed toes. A lighter leaf-vein patch on each shoulder and thigh.
module foot(p, yaw) {
  translate(p) rotate([0, 0, yaw]) {
    color(skin) scale([2.6, 2.6, 1.2]) sphere(1, $fn = 16);
    for (a = [-48, -16, 16, 48]) {
      limb([0, -0.6, 0.2], [sin(a) * 3.6, -cos(a) * 3.6 - 0.6, -0.35], 0.9, 0.55, skin);
      spike([sin(a) * 3.6, -cos(a) * 3.6 - 0.6, -0.35], [sin(a) * 1.0, -cos(a) * 1.0, -0.2], 0.45, 0.05, claw);
    }
  }
}
FS = [[3.4, 3.8, 3.8], [4.8, -0.5, 9]];   // front shoulder
HT = [[3.8, 5, 4.6], [5, 12.2, 8.6]];    // hind thigh
mirror_x() {
  // front leg: shoulder, upper arm out to the elbow, forearm straight down, the foot turned out
  ell(FS[0], FS[1], skin);
  limb([5, -0.5, 8.5], [8.6, -2.2, 6.2], 2.9, 2.5, skin);
  limb([8.6, -2.2, 6.2], [8.8, -3.6, 1.8], 2.5, 2.0, skin);
  foot([9, -4.6, 1.2], -25);
  patchOn(FS, -40, 10, 2.2, 1.6, skinHi, 70);
  // hind leg: thigh, the knee forward and out, the shin down to the foot
  ell(HT[0], HT[1], skin);
  limb([5.6, 11.6, 7.8], [8.2, 10.8, 6.4], 2.9, 2.6, skin);
  limb([8.2, 10.8, 6.4], [8.4, 12.8, 1.8], 2.6, 2.0, skin);
  foot([8.4, 13.4, 1.2], -10);
  patchOn(HT, -30, 15, 2.4, 1.8, skinHi, 80);
}

// ---- Tail: off the rump, up the creature's left side, curling forward to the bud.
TAIL = [[0, 12, 11], [4.2, 15, 10.9], [7.6, 17, 11.8], [10, 17.8, 13.4], [11, 18, 15.6], [11.3, 17.6, 17.8], [11, 17, 19.8],
        [10.2, 16, 21.8], [8.8, 15, 23.4], [7.4, 14, 24.6], [6, 13, 25.5], [5, 12.4, 26.6], [4.6, 12, 28]];
TAIL_R = [4, 3.7, 3.4, 3.25, 3.1, 2.9, 2.7, 2.45, 2.2, 1.95, 1.7, 1.5, 1.3];
chain(TAIL, TAIL_R, skin);
// the scale pattern carries on along the tail: lighter scales on its outer side and top
for (i = [1 : 10]) let(p = TAIL[i], r = TAIL_R[i]) {
  color(skinHi) translate(p + [r * 0.86, 0, r * 0.42]) scale([0.4, 0.9, 0.8] * r * 0.42) sphere(1, $fn = 8);
  color(skinHi) translate(p + [r * 0.3, i % 2 ? 0.5 : -0.5, r * 0.9]) scale([0.9, 0.9, 0.4] * r * 0.4) sphere(1, $fn = 8);
}

// ---- Bud: the art's star outline as a pillow, at the tail tip's depth, with a lighter midrib.
BUD = [[11.7, 39.1], [12.5, 39.1], [12.1, 37.4], [13.7, 37.6], [13.9, 36.8], [15.4, 36.8], [14.7, 35.4], [15.4, 34.7],
       [16, 32.3], [14.1, 33.1], [13.9, 33.9], [13.7, 33.1], [11.3, 33.1], [11.7, 33.7], [10.4, 34.5], [10.8, 35.2],
       [9.8, 35.8], [9.8, 36.4], [7.8, 36.4], [8.2, 37], [6.5, 38], [6.9, 38.5], [11.7, 38.9]];
BUD_D = 8;   // pp depth of the tail tip (scad [4.6, 12, 28])
pp(BUD_D) translate([0, 0, -G]) {
  plate(BUD, 1.4, 0.15, bud, grow = 0.3);
  translate([11.8, 0, 35.6]) rotate([0, 28, 0]) scale([2.6, 1.0, 1.4]) color(bud) sphere(1, $fn = 16);
}
pp(BUD_D) translate([0, 0, -G]) color(budHi) hull() {
  translate([8.6, 0, 37.4]) scale([0.35, 1.45, 0.35]) sphere(1, $fn = 8);
  translate([14.6, 0, 34.2]) scale([0.3, 1.2, 0.3]) sphere(1, $fn = 8);
}
