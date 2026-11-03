// Snowlet: a round puff of white snow-owl fluff seen from the front, two HUGE round golden eyes side by side on
// its face, a tiny round blue beak between and below them, a ragged fluffy outline on a smooth round body, pale-blue fluff
// underneath and two small white wings sticking out at the sides, tips up. No feet.
//
// Checklist (front sheet, x = sheet x, z = sheet z):
// - body: a fluff ball, x -18.5..15, z 1..39 with the tufts; the ball itself about z 3.5..35. Its centre reads
//   1.7 left of the art's centre (the wings are symmetric about 0, the ball is not): wing outlines shift for it.
// - face: turned towards the viewer more than the 30° view (beak at sheet -5.8 on a ball centred at -1.7), so the
//   face block is turned FACE degrees towards +X.
// - eyes: near (viewer's right) x -1.7..8.2, z 14..24.9; far x -15.9..-8.6, z 14.6..24.9. Navy ring, gold disc
//   (#fbd848), a big amber iris (#c28012) up and in, a square white highlight top-left on BOTH eyes (same side).
// - beak: x -8.2..-3.4, z 11.6..17.2, round, mid blue, a small point at the bottom.
// - body: SMOOTH and plain white; the fur shows only as a ragged edge on the outline (to z 1 at the bottom).
// - crown: a few soft flame tufts on top (to z 39).
// - underside: pale blue on the lower third (front z ~7 at the middle rising to ~14 at the sides).
// - wings: near x 15..26.3, z 12..25.3, small rounded fans, tips up and out, white with a pale-blue lower band;
//   far wing x -26.2..-19, the same mirrored, its root hidden by the ball.
// - back: a plain white ball, blue underneath, the wings out at the sides.
include <lib.scad>

white = [0.97, 0.99, 0.99];
ice = [0.64, 0.81, 0.89];
navy = [0.10, 0.16, 0.29, NOGLOW];
gold = [0.93, 0.70, 0.16, NOGLOW];   // deeper than the sheet's #fbd848 (it renders lemon); flagged GLOWS, but lit it washes out
amber = [0.70, 0.42, 0.05, NOGLOW];
beakC = [0.23, 0.44, 0.64, NOGLOW];

FACE = 15;                 // the face's turn towards +X (degrees about Z)
BC = [0, 0, 19];           // ball centre
BR = [16, 15.5, 15.5];     // ball radii

// ---- The ball.
color(white) translate(BC) scale(BR) sphere(1, $fn = 48);

// Pale-blue underside: the ball's shell below a soft wavy line on the lower third, rising a little towards the
// flanks (front z ~9 at the middle, ~13 at the sides), its waves broad scallops, not teeth.
module underRegion() {
  rotate_extrude($fn = 40) polygon([[0, -5], [0, 9.5], [8, 10], [12, 11], [15, 12.5], [30, 13], [30, -5]]);
  for (i = [0 : 17]) {
    a = i * 20 + 5;
    translate([15.5 * sin(a), -15.2 * cos(a), 12.2 + (i % 2) * 1.2]) scale([3.4, 3.4, 1.8]) sphere(1, $fn = 14);
  }
}
color(ice) intersection() {
  translate(BC) scale(BR + [0.2, 0.2, 0.2]) sphere(1, $fn = 48);
  underRegion();
}

// ---- The ragged rim: rings of low, wide, blunt lobes of fluff (flattened ellipsoids lying flat on the ball, the
// lower rings a little combed down) round the widest part and the lower rim, so the outline is fluffy from every side while the faces
// of the ball stay clean. RIM rings: [elevation, count, azimuth offset, colour index (0 white, 1 ice)]; the face is
// left free. A lobe is LOBE radii across / down the ball / out, its centre on the surface, sticking out ~1.3.
RIM = [[2, 24, 0, 0], [-36, 18, 10, 1], [-62, 10, 5, 1]];
LOBE = [3.8, 3.0, 1.3];
function tuftN(e, az) = [cos(e) * sin(az), -cos(e) * cos(az), sin(e)];
function faceOff(e, az) = let(n = tuftN(e, az), f = tuftN(4, FACE)) acos(max(-1, min(1, n * f)));
function onBall(n, k) = BC + [n[0] * BR[0], n[1] * BR[1], n[2] * BR[2]] * k;
function downAt(e, az) = [-sin(e) * sin(az), sin(e) * cos(az), -cos(e)];   // the tangent pointing down the ball
function westAt(az) = [-cos(az), -sin(az), 0];
module lobe(e, az, r, c, droop = 0) {
  n = tuftN(e, az);
  d = downAt(e, az);
  w = westAt(az);
  p = onBall(n, 0.985);
  color(c) multmatrix([[w[0], d[0], n[0], p[0]], [w[1], d[1], n[1], p[1]], [w[2], d[2], n[2], p[2]], [0, 0, 0, 1]])
    rotate([-droop, 0, 0]) scale(r) sphere(1, $fn = 16);
}
// The lobes overlap and step up and down a little (`stag`), so the rim reads as one soft ragged ruff, not beads.
function stag(i) = [0, 5, -3, 3, -5, 1][i % 6];
for (ring = RIM) for (i = [0 : ring[1] - 1]) {
  az = i * 360 / ring[1] + ring[2];
  e = ring[0] + stag(i);
  k = 0.85 + 0.1 * ((i * 7) % 4);   // a little uneven, so the rim reads ragged, not machined
  if (faceOff(e, az) > 52) lobe(e, az, [LOBE[0], LOBE[1], LOBE[2] * k], ring[3] == 1 ? ice : white, ring[0] < 0 ? 14 : 0);
}

// ---- The crown: CROWN_N soft curved flame tufts on top, as drawn (the tallest at the middle to z ~39). Each is a
// three-ball chain: a fat base sunk in the ball, a middle point out along the normal, a tip curling outward.
// [elevation, azimuth, length]
CROWN = [[90, 0, 5.0], [70, -30, 4.4], [70, 60, 4.0], [70, 150, 4.2], [70, 240, 4.0]];
function crownPts(c) = let(n = tuftN(c[0], c[1]), o = c[0] > 85 ? [0, 0.4, 0] : [n[0], n[1], 0] / norm([n[0], n[1], 0]),
                           p0 = onBall(n, 0.92), p1 = p0 + n * (0.5 * c[2] + 1.4) + o * 0.6,
                           p2 = p1 + [0, 0, 0.4 * c[2]] + o * 0.6 * c[2]) [p0, p1, p2];
module crownTuft(c) {
  q = crownPts(c);
  color(white) {
    hull() { translate(q[0]) sphere(3.0, $fn = 16); translate(q[1]) sphere(1.9, $fn = 14); }
    hull() { translate(q[1]) sphere(1.9, $fn = 14); translate(q[2]) sphere(1.0, $fn = 10); }
  }
}
for (c = CROWN) crownTuft(c);

// ---- The face, turned FACE degrees towards +X.
// Eye: an upright oval (taller than wide, as drawn): navy ring, gold disc, amber iris (offset `ix` towards the nose, up a little), a square white highlight on the
// upper `hx` side. Looks along -Y, turned `yaw` about Z. s = the ring's radius.
module owlEye(p, s, yaw, ix, hx) {
  translate(p) rotate([0, 0, yaw]) {
    color(navy) scale([s, 0.42 * s, 1.16 * s]) sphere(1, $fn = 28);
    color(gold) translate([0, -0.12 * s, 0]) scale([0.86 * s, 0.4 * s, 1.02 * s]) sphere(1, $fn = 28);
    color(amber) translate([ix * s, -0.24 * s, 0.1 * s]) scale([0.52 * s, 0.3 * s, 0.76 * s]) sphere(1, $fn = 22);
    color("white") translate([hx * s, -0.46 * s, 0.5 * s]) scale([0.3 * s, 0.1 * s, 0.3 * s]) sphere(1, $fn = 12);
  }
}
EYE = [7.3, -13.6, 21.5];  // the near (+X) eye inside the face block
ES = 5.3;
EYAW = 22;
rotate([0, 0, FACE]) {
  owlEye(EYE, ES, EYAW, -0.12, -0.36);
  owlEye([-EYE[0], EYE[1], EYE[2]], ES, -EYAW, 0.12, -0.36);
  // the beak: a round blue drop with a small point at the bottom, between and below the eyes
  color(beakC) hull() {
    translate([0, -15.1, 18.6]) scale([2.3, 1.6, 2.4]) sphere(1, $fn = 18);
    translate([0, -15.6, 16.5]) sphere(0.4, $fn = 8);
  }
}

// ---- Wings: small rounded feathered fans low on the sides (about the eye line), four rounded feather tips fanned
// out and up, white with the two lower feathers and the fan's base pale blue. FEATHERS: [root, tip] in sheet x, z
// with root and tip radii (the near wing); a sheet x becomes scad x for a wing standing at depth WY.
WY = 2;
WT = 2.0;                  // the wing's half-thickness at the root
function wsx(sx) = (sx + 1.7 - 0.5 * WY) / 0.866;
FEATHERS = [[[12, 19.5], [21.2, 23.0], 2.9, 2.1], [[12, 18.5], [22.4, 20.0], 2.9, 2.1],
            [[12, 17.5], [21.8, 16.8], 2.7, 1.9], [[12, 16.5], [19.8, 14.3], 2.5, 1.7]];
WROOT = [12, 18];
function along(f, t) = f[0] + (f[1] - f[0]) * t;
mirror_x() translate([0, WY, 0]) {
  // the fan: root and every feather pulled back from its tip, so the tips stand out as rounded lobes
  color(white) hull() {
    translate([wsx(WROOT[0]), 0, WROOT[1]]) scale([3.2, WT, 3.8]) sphere(1, $fn = 18);
    for (k = [0 : 1]) let(q = along(FEATHERS[k], 0.9)) translate([wsx(q[0]), 0, q[1]]) scale([2.0, WT * 0.75, 2.0]) sphere(1, $fn = 12);
  }
  color(ice) hull() {
    translate([wsx(WROOT[0]), 0.2, WROOT[1] - 1.2]) scale([3.0, WT * 0.95, 2.8]) sphere(1, $fn = 16);
    for (k = [2 : 3]) let(q = along(FEATHERS[k], 0.88)) translate([wsx(q[0]), 0.2, q[1]]) scale([1.7, WT * 0.7, 1.7]) sphere(1, $fn = 12);
  }
  for (k = [0 : 3]) {
    f = FEATHERS[k];
    color(k < 2 ? white : ice) hull() {
      translate([wsx(f[0][0]), 0.15 * k, f[0][1]]) scale([f[2], WT * 0.9, f[2]]) sphere(1, $fn = 14);
      translate([wsx(f[1][0]), 0.15 * k, f[1][1]]) scale([f[3], WT * 0.7, f[3]]) sphere(1, $fn = 12);
    }
  }
}
