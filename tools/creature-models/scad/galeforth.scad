// Galeforth: Gustling grown into a proud raptor, standing upright. Sprite-matched 2026-11-04.
// Checklist (front sheet; the art's body axis sits at sheet x -3, so a sheet x reads here as sx + OX):
//   head   x -10.5..1.5 z 26..37, turned to the viewer's left (near profile): tan skull, cream lower face, cream
//          forehead; one big fierce orange eye (x -7.5..-3.3, z 28..32) with a heavy slanted top lid, white glint;
//          the far eye a sliver past the beak; a cream swirl mark on the forehead (x -9.5..-6.5, z 31.5..35)
//   beak   orange, hooked, x -9.8..-6 z 26..29, the hook pointing down
//   crest  one long cream feather blade from the forehead up over the head and back, its tip hooking down (to x 9 z 33)
//   tufts  jagged cream feathers at the back of the head (x -2..1.5, z 32..36)
//   scarf  red: a bib under the beak (x -10.5..-1, z 20..27.5), a collar, two ribbon ends streaming to the viewer's
//          right (tips x 12.5 z 29.5 and x 10.5 z 25.5)
//   body   upright egg z 8..26, cream chest and belly (x -10..-1), tan flanks and back, a feathered fringe at z 8..10
//   wings  half open at the sides, broad: tan coverts, cream top edge, fanned primaries with a brown band (z 9..13)
//          and cream tips (down to z 4); far wing x -18..-10, near wing x -1..11
//   legs   orange shanks (z 2..9), three forward toes and a hind toe, dark talons; feet x -13..-6 and -1..5.5
//   tails  two thin cream streamers out to the viewer's right, each ending in a red curled tuft (x 15..18 z 13..17.5,
//          x 12.5..15.5 z 2.7..7.2)
//   back   all tan, the wings' brown band and cream tips, the scarf knot and ends, the tails.
include <lib.scad>

OX = 3;   // art sheet x -> this model's sheet x

tan = [0.88, 0.68, 0.35];
cream = [0.97, 0.9, 0.75];
band = [0.51, 0.37, 0.21];
red = [0.83, 0.31, 0.22, NOGLOW];
redDark = [0.68, 0.25, 0.17];
orange = [0.94, 0.55, 0.14, NOGLOW];
orangeDark = [0.79, 0.43, 0.1, NOGLOW];
talon = [0.22, 0.2, 0.22];
lidInk = [0.24, 0.13, 0.06];

function S(pts) = [for (p = pts) [p[0] + OX, p[1]]];
module front() { translate([-40, -41.5, -5]) cube([80, 40, 60]); }   // the scad's front half (y < -1.5)

// ---- Body: an upright egg with the chest pushed forward, cream chest and belly.
module bodyShape(k = 1) {
  hull() {
    translate([0, 0.5, 14]) scale([7.2, 6.5, 6.3] * k) sphere(1, $fn = 30);
    translate([0, -2, 17.5]) scale([5.4, 4.6, 6] * k) sphere(1, $fn = 24);
    translate([0, 0, 21.5]) scale([5.6, 5.2, 4.5] * k) sphere(1, $fn = 24);
    translate([0, -0.5, 25]) scale([4, 4, 3] * k) sphere(1, $fn = 20);
  }
}
color(tan) bodyShape();
CHEST = [[-10.5, 24], [-1, 24.5], [-0.5, 18], [-2, 14], [-2.5, 9], [-6, 7.5], [-9.5, 8.5], [-10.5, 14]];
color(cream) intersection() { bodyShape(1.015); prism(S(CHEST)); front(); }
// Feathered fringe at the bottom of the chest: low blunt lobes half sunk in the body, cream in front, tan at the sides.
for (a = [-100 : 25 : 100]) let(c = abs(a) < 40 ? cream : tan)
  color(c) translate([sin(a) * 5.2, -cos(a) * 4.9 + 0.5, 9.2]) rotate([0, 0, a]) rotate([25, 0, 0]) scale([1.9, 0.9, 1.6]) sphere(1, $fn = 10);

// ---- Legs: feathered thigh, orange shank, three forward toes and a hind toe, dark talons.
mirror_x() {
  ell([2.6, 2.8, 2.8], [5, 0.8, 9.5], tan);
  limb([5.2, 0.6, 9], [5.4, 0.4, 1.4], 1.1, 0.9, orange);
  for (a = [-45, 0, 45]) {
    tip = [5.4 + sin(a) * 3.6, 0.4 - cos(a) * 3.6, 0.7];
    limb([5.4, 0.4, 1.1], tip, 0.8, 0.55, orange);
    spike(tip, [sin(a) * 0.9, -cos(a) * 0.9, -0.75], 0.45, 0.05, talon);
  }
  limb([5.4, 0.4, 1.1], [5.4, 2.4, 0.7], 0.7, 0.5, orange);
  spike([5.4, 2.4, 0.7], [0, 0.8, -0.7], 0.4, 0.05, talon);
}

// ---- Wings: half open at the sides, a leaf-shaped fan traced off the far wing on the sheet (top x -13 z 25.2, outer
// edge x -18 z 10.7, lowest tip x -15.4 z 4.1, inner edge x -10.5): a rounded shoulder pillow widening down, then five
// separate pointed primaries (tan, a brown band, cream tips). In the wing's frame u (x) runs out from the root, z is
// the scad z, y the thickness; the wing hangs from the shoulder (WING_PIV) with its bottom swung out by WING_TILT.
WING_AT = [6, -3, 0];
WING_YAW = 10;
WING_PIV = 23;
WING_TILT = -6;
WING_UP = [[0.3, 22], [1, 24.4], [2.6, 25.4], [4.2, 24.8], [6.2, 22], [8.3, 18.5], [9.8, 15.5], [7.5, 14], [4, 13.8],
           [1, 15], [-0.3, 17.5]];
WING_UP_D = 2;
// primaries: [u at the root (z 18.5), u at the band (z 10.5), tip [u, z]]
FEATHERS = [[1.6, 1.3, [0.9, 7]], [3.4, 3.6, [3.8, 5]], [5.2, 5.9, [6.6, 3.8]], [7, 8.2, [9.3, 4]], [8.6, 10.2, [11.7, 6.2]]];
WING_COV_LINES = [[[2.2, 21.5], [3.6, 16.5]], [[4.4, 22], [6.4, 17]]];
lineC = [0.6, 0.43, 0.22];
module zBand(z0, z1) { translate([-5, -5, z0]) cube([20, 10, z1 - z0]); }
module feather(f, y) {
  r = [f[0], 18.5]; m = [f[1], 10.5]; t = f[2];
  // the colour breaks along the feather: band from z 12.4 to 9.2
  b0 = [r[0] + (m[0] - r[0]) * (18.5 - 12.4) / 8, 12.4];
  b1 = [m[0] + (t[0] - m[0]) * (10.5 - 9.2) / (10.5 - t[1]), 9.2];
  featherSeg(r, b0, 1.0, 1.4, y, tan);
  featherSeg(b0, m, 1.4, 1.45, y, band);
  featherSeg(m, b1, 1.45, 1.35, y, band);
  c = [b1[0] + (t[0] - b1[0]) * 0.55, b1[1] + (t[1] - b1[1]) * 0.55];
  featherSeg(b1, c, 1.35, 1.0, y, cream);
  featherSeg(c, t, 1.0, 0.3, y, cream);
}
module featherSeg(a, b, ra, rb, y, c) {
  color(c) hull() {
    translate([a[0], y, a[1]]) scale([ra, 0.45, ra]) sphere(1, $fn = 12);
    translate([b[0], y, b[1]]) scale([max(rb, 0.12), 0.45 * max(rb, 0.3) / max(ra, 0.3), max(rb, 0.12)]) sphere(1, $fn = 12);
  }
}
module wing() {
  translate(WING_AT + [0, 0, WING_PIV]) rotate([0, WING_TILT, WING_YAW]) translate([0, 0, -WING_PIV]) {
    color(tan) intersection() { slab(WING_UP, WING_UP_D, inset = 1.6); zBand(0, 23); }
    color(cream) intersection() { slab(WING_UP, WING_UP_D, inset = 1.6); zBand(23, 30); }
    for (i = [0 : len(FEATHERS) - 1]) feather(FEATHERS[i], 0.12 * (i - 2));
    for (l = WING_COV_LINES) for (y = [-1, 1]) limb([l[0][0], y * 0.92, l[0][1]], [l[1][0], y * 0.92, l[1][1]], 0.15, 0.15, lineC);
  }
}
mirror_x() wing();

// ---- Scarf: collar, the bib under the beak, a knot on the near shoulder and two ribbon ends streaming out.
color(red) translate([0, -0.3, 26.4]) scale([5.4, 5.2, 2.1]) sphere(1, $fn = 28);
BIB = [[-10.5, 27.5], [-1, 26.5], [-1.5, 24], [-5, 20], [-8.5, 21.5], [-10.5, 24]];
color(red) intersection() { bodyShape(1.07); prism(S(BIB)); front(); }
ell([1.6, 1.4, 1.5], [5, -2.6, 26], redDark);
SCARF_A = [[5.5, -2.6, 26.6], [9, -1.5, 28], [12.5, 0.5, 28.6], [16, 2, 29.6]];
SCARF_AW = [1.5, 1.8, 1.6, 1.3];
SCARF_B = [[5.5, -2.6, 25.6], [8.5, -1.5, 24.8], [11.5, 0, 25.2], [15, 1.5, 25.6]];
SCARF_BW = [1.4, 1.6, 1.5, 1.2];
module ribbon(pts, ws) {
  for (i = [0 : len(pts) - 2]) color(red) hull() {
    translate(pts[i]) scale([0.5, 0.25, ws[i]]) sphere(1, $fn = 10);
    translate(pts[i + 1]) scale([0.5, 0.25, ws[i + 1]]) sphere(1, $fn = 10);
  }
  // a notched end: two flat points
  e = pts[len(pts) - 1];
  w = ws[len(ws) - 1];
  for (dz = [-w * 0.55, w * 0.55]) color(red) hull() {
    translate([e[0], e[1], e[2] + dz * 0.6]) scale([0.4, 0.22, w * 0.5]) sphere(1, $fn = 8);
    translate([e[0] + 1.8, e[1] + 0.5, e[2] + dz * 1.3]) sphere(0.12, $fn = 6);
  }
}
ribbon(SCARF_A, SCARF_AW);
ribbon(SCARF_B, SCARF_BW);

// ---- Head (turned 25 deg to the creature's right, so the beak points to the viewer's left as drawn).
HEAD_T = [0, -2, 0];
HEAD_YAW = -25;
EYE = [2.7, -4.1, 30.3];
EYE_S = 1.75;
EYE_YAW = 30;
SWIRL = [1.9, -3.45, 34.6];
module headShape(k = 1) {
  hull() {
    translate([0, 0.3, 31.6]) scale([5, 5.6, 5.3] * k) sphere(1, $fn = 30);
    translate([0, -2.4, 30]) scale([3.7, 3.4, 3.3] * k) sphere(1, $fn = 22);
  }
}
CREST = [[0, -3, 35.6], [0.3, 1, 37.1], [1.2, 5.3, 38.4], [2.5, 9.2, 37.9], [3.3, 11.5, 36.4], [3.8, 12.5, 34.1], [4, 12.6, 32.6]];
CREST_W = [2.1, 1.9, 1.7, 1.45, 1.15, 0.75, 0.25];
CREST_T = [0.9, 0.8, 0.7, 0.62, 0.52, 0.4, 0.2];
translate(HEAD_T) rotate([0, 0, HEAD_YAW]) {
  color(tan) headShape();
  // cream lower face and cream forehead (the crest's root)
  color(cream) intersection() { headShape(1.02); translate([0, -3.2, 28.4]) scale([4.6, 3.6, 2.4]) sphere(1, $fn = 20); }
  color(cream) intersection() { headShape(1.02); translate([0, -2.2, 36.2]) scale([4, 4.8, 2.7]) sphere(1, $fn = 20); }
  // the swirl mark on the forehead: a cream disc ringed in brown
  translate(SWIRL) rotate([0, 0, 33]) rotate([-35, 0, 0]) {
    color(cream) scale([1.4, 0.25, 1.4]) sphere(1, $fn = 16);
    color(band) translate([0, -0.12, 0]) rotate([90, 0, 0]) rotate_extrude(angle = 290, $fn = 18) translate([1.05, 0]) circle(0.17, $fn = 6);
  }
  // eyes: big, orange, a heavy slanted dark top lid (the scowl), a glint
  mirror_x() {
    eye(EYE, EYE_S, iris = orange, pupil = [0.12, 0.05, 0.02], sclera = [0.99, 0.96, 0.86], yaw = EYE_YAW, flat = 0.5,
        lid = 0.36, lid_tilt = 30, lid_c = lidInk, squint = 0.1, shine = true);
  }
  // hooked beak: upper mandible out and down to the hook, a darker lower mandible under it
  color(orange) hull() {
    translate([0, -4.9, 29.9]) scale([1.5, 1.3, 1.25]) sphere(1, $fn = 14);
    translate([0, -6.9, 29.5]) scale([0.85, 0.8, 0.8]) sphere(1, $fn = 12);
  }
  color(orange) hull() {
    translate([0, -6.9, 29.5]) scale([0.85, 0.8, 0.8]) sphere(1, $fn = 12);
    translate([0, -7.5, 28.1]) sphere(0.3, $fn = 8);
  }
  color(orangeDark) hull() {
    translate([0, -5, 28.6]) scale([1.1, 0.9, 0.7]) sphere(1, $fn = 10);
    translate([0, -6.4, 28.3]) sphere(0.4, $fn = 8);
  }
  // jagged feathers at the back of the head, flattened lobes pointing back
  for (t = [[-1.6, 34.4, cream], [1.6, 34.4, cream], [0, 32.4, tan], [0, 35.8, cream]])
    petal([0.9, 2.3, 0.6], [t[0], 5.3, t[1]], [-18, 0, 0], t[2]);
  // the crest: a long feather blade, broad in its own plane, thin sideways
  for (i = [0 : len(CREST) - 2]) color(cream) hull() {
    translate(CREST[i]) scale([CREST_T[i], CREST_W[i], CREST_W[i]]) sphere(1, $fn = 12);
    translate(CREST[i + 1]) scale([CREST_T[i + 1], CREST_W[i + 1], CREST_W[i + 1]]) sphere(1, $fn = 12);
  }
}

// ---- Tails: two thin cream streamers from the back of the body, each ending in a curled red tuft.
TAIL_A = [[3, 5.5, 12], [8.4, 7.5, 15.1], [10.7, 8.5, 16.7], [13.3, 9, 17.1], [15, 9, 16.75]];
TAIL_AR = [0.8, 0.65, 0.6, 0.6, 0.6];
TUFT_A = [[15, 9, 16.75], [16.8, 9, 16.6], [17.7, 9, 15.4], [17.3, 9, 14], [16.4, 9, 13.6]];
TUFT_AR = [0.8, 1.45, 1.4, 0.95, 0.35];
TAIL_B = [[2.5, 5.5, 10.5], [9.8, 8, 12.7], [12.7, 8, 11.7], [16.2, 8, 11.2], [17.9, 8, 9.3], [16.7, 8, 7.4]];
TAIL_BR = [0.8, 0.65, 0.6, 0.6, 0.6, 0.65];
TUFT_B = [[16.7, 8, 7.4], [15.7, 8, 5.6], [15.3, 8, 3.9], [15.9, 8, 3]];
TUFT_BR = [1.0, 1.6, 1.2, 0.35];
chain(TAIL_A, TAIL_AR, cream);
chain(TUFT_A, TUFT_AR, red);
chain(TAIL_B, TAIL_BR, cream);
chain(TUFT_B, TUFT_BR, red);
