// Glimp: a pearly soap-bubble sprite, remodelled on its sprite (2026-11-03).
// Checklist (front sheet, art x shifted by -0.55 so the body is centred on x = 0):
//   body   one wide bubble, sheet x -13.8..14.9, z 5.7..31: ellipsoid 14.6 x 13.6 x 12.6 at z 18.3. Light sky blue,
//          a big pink face zone over the front-left (sheet x -13.7..9.4, z 10.6..31.4), white gloss top-left,
//          a lilac-grey band over the back, white gloss high on the back's +X side.
//   face   turned about 10 deg towards the viewer as drawn: two big tall oval eyes (4.3 x 4.8), all dark violet with
//          a lighter violet lower half and a big white glint towards the nose, centres sheet x -8.5 / 1.1, z 19.5.
//          A small U smile between and under them (sheet x -6.4..-2.2, z 15..16.5), purple-grey ink.
//   crown  a ring of small bubbles on top (big one front-left, small middle, one on the +X side, two at the back).
//   wick   a thin blue stalk from the crown's middle leaning to +X, ending in a soft feather wisp, pink at its root
//          and pale gold at its broad rounded tip (sheet x 5.7..10.5, z 36..40).
//   arms   one small bubble each side, low (sheet z 9..16), the near one pinkish.
//   feet   two round bubble feet under the body, each with a little toe bubble on its outer side.
//   back   no face; the blue bubble with its lilac band, the crown and the wick.
include <lib.scad>

blue = [0.84, 0.92, 0.99, NOGLOW];
pink = [0.99, 0.86, 0.94, NOGLOW];
lilac = [0.91, 0.9, 0.98, NOGLOW];
bubbleC = [0.9, 0.95, 1, NOGLOW];
shine = [1, 1, 1, NOGLOW];
stalkC = [0.66, 0.76, 0.93];
wispRoot = [0.94, 0.81, 0.86, NOGLOW];
wispTip = [0.97, 0.88, 0.72, NOGLOW];
wispHi = [0.99, 0.95, 0.82, NOGLOW];
eyeDark = [0.2, 0.1, 0.38];
eyeMid = [0.27, 0.15, 0.49];
eyeLow = [0.47, 0.36, 0.76];
inkC = [0.3, 0.24, 0.45];

// Body ellipsoid.
B = [14.6, 13.6, 12.6];
BZ = 18.3;
// The face sits a little lower on the sheet than on the model: the camera looks 10 deg down on the front.
FDZ = 1.6;
// A point on the body surface at heading psi (deg from -Y towards +X), height z, `out` units off the surface.
function onBody(psi, z, out = 0) =
  let(k = sqrt(max(0, 1 - pow((z - BZ) / B[2], 2))), d = [sin(psi), -cos(psi), 0])
  [B[0] * k * sin(psi) + out * d[0], -B[1] * k * cos(psi) + out * d[1], z];

// A tint: the body's shell grown by `d`, clipped to the children's volume, so it lies flush on the bubble.
module tint(c, d = 0.08) {
  color(c) intersection() {
    translate([0, 0, BZ]) scale(B + [d, d, d]) sphere(1, $fn = 56);
    children();
  }
}
// Only the half of space on the viewer's side of the front picture plane.
module viewerSide() { pp(0) translate([-60, -60, -10]) cube([120, 60, 60]); }

// ---- Body
color(blue) translate([0, 0, BZ]) scale(B) sphere(1, $fn = 56);
// pink face zone, traced from the front art (the M1 region), on the viewer's side only
tint(pink) intersection() {
  viewerSide();
  translate([-0.55, 0, FDZ]) prism([[-4.4, 31.4], [-2.1, 29.6], [1.1, 27.6], [4, 26.6], [5.7, 25.3], [7.7, 23.9],
    [9.4, 20.9], [8.5, 16.3], [7.4, 16.3], [5, 13.2], [5.1, 10.8], [2.2, 11.3], [-0.8, 10.6], [-5.2, 10.6],
    [-8.3, 11.3], [-12.2, 15.9], [-13.7, 20.2], [-12.6, 24.5], [-10.4, 27.4], [-8.4, 29.4]]);
}
// lilac-grey band over the back and the underside
tint(lilac) translate([0, 15, 15]) scale([12, 9, 9]) sphere(1, $fn = 24);
tint(lilac) translate([4, 4, 5]) scale([10, 10, 4]) sphere(1, $fn = 24);
// white gloss: a big soft one top-left of the face, a speck beside it, one high on the back's +X side
tint(shine, 0.14) translate(onBody(-38, 26.5, 1)) scale([2.6, 2.6, 1.9]) sphere(1, $fn = 16);
tint(shine, 0.14) translate(onBody(-22, 28.6, 1)) scale([1, 1, 0.8]) sphere(1, $fn = 10);
tint(shine, 0.14) translate(onBody(160, 25, 1)) scale([2.8, 2.8, 2.4]) sphere(1, $fn = 16);
tint(shine, 0.14) translate(onBody(62, 22, 1)) scale([0.9, 0.9, 1.6]) sphere(1, $fn = 10);

// ---- Face (turned 10 deg towards the viewer, as drawn)
EYE = 2.3;
EZ = 19.5 + FDZ;
EPSI = [30.5, -10.9];   // the near (+X) eye and the far (-X) eye
module glimpEye(psi) {
  // all dark violet with a lighter lower half and a big glint towards the nose
  side = psi > 10 ? 1 : -1;
  translate(onBody(psi, EZ, -0.35)) rotate([0, 0, psi]) {
    eye([0, 0, 0], EYE, iris = eyeMid, sclera = eyeDark, pupil = eyeMid, shine = false, flat = 0.6);
    color(eyeLow) translate([0.08 * side * EYE, -0.66 * EYE, -0.42 * EYE]) scale([0.52, 0.2, 0.36] * EYE) sphere(1, $fn = 14);
    color(shine) translate([-0.22 * side * EYE, -0.8 * EYE, 0.32 * EYE]) scale([0.3, 0.1, 0.4] * EYE) sphere(1, $fn = 12);
  }
}
for (p = EPSI) glimpEye(p);
// the smile, traced from the art and laid on the face
tint(inkC, 0.16) intersection() {
  viewerSide();
  translate([-0.55, 0, FDZ]) prism([[-6.55, 16.65], [-5.35, 14.95], [-3.05, 14.95], [-2.0, 16.65], [-2.6, 16.65],
    [-3.45, 15.5], [-4.95, 15.5], [-5.95, 16.65]]);
}

// ---- Crown of small bubbles
ell([3, 2.8, 2.7], [-0.4, -1.4, 32.3], bubbleC);   // big, front-left
ell([1.8, 1.7, 1.7], [4.6, -2.2, 31.2], bubbleC);      // small, front middle
ell([2.3, 2.2, 2.3], [7.4, 0.6, 30.6], bubbleC);   // on the +X side
ell([2.6, 2.4, 2.4], [-1, 3.2, 31.8], bubbleC);    // back
ell([1.7, 1.6, 1.6], [-5.2, 1.4, 30.2], lilac);    // back-left
ell([1.6, 1.5, 1.5], [3.6, 3.4, 31.2], lilac);     // back-right
// glints on the crown bubbles
ell([0.8, 0.6, 0.6], [-1.6, -3.6, 33.6], shine);
ell([0.6, 0.5, 0.5], [6.6, -1.2, 32], shine);

// ---- Wick: a thin stalk leaning to +X and its feather wisp
chain([[2.4, 0.6, 31], [4.2, 0.6, 34], [5.4, 0.6, 35.8]], [0.85, 0.75, 0.72], stalkC);
color(wispRoot) hull() {
  translate([5.6, 0.6, 36.1]) sphere(0.9, $fn = 12);
  translate([7.1, 0.6, 37.3]) scale([1.4, 0.9, 1.2]) sphere(1, $fn = 14);
}
color(wispTip) hull() {
  translate([7.1, 0.6, 37.3]) scale([1.4, 0.9, 1.2]) sphere(1, $fn = 14);
  translate([9.4, 0.6, 38.8]) scale([2, 1.1, 1.45]) sphere(1, $fn = 16);
}
ell([0.9, 0.5, 0.6], [8.9, 0.2, 39.4], wispHi);

// ---- Arms: a small bubble each side, low
mirror_x() {
  ell([2.9, 2.6, 3], [15.4, -1.6, 12.8], pink);
  ell([0.7, 0.4, 0.8], [15.4, -4.1, 14], shine);
}

// ---- Feet: a round bubble foot and a toe bubble each
mirror_x() {
  ell([3.7, 3.9, 3.7], [6.6, -0.8, 3.7], bubbleC);
  ell([1.8, 1.8, 1.7], [10.2, -1.4, 1.9], bubbleC);
  ell([1.4, 0.6, 1], [6.2, -4.2, 3.6], pink);
  ell([0.6, 0.4, 0.5], [5.4, -4.4, 4.6], shine);
}
// a stray bubble by the near foot
ell([0.75, 0.75, 0.75], [17, -3, 1.1], bubbleC);
