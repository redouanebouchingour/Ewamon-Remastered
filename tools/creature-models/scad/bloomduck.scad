// Bloomduck: a plump green duck with a yellow-green chest, a scowl under a pink hibiscus worn on the head (yellow
// stamens, stink squiggles above), a wide red-orange bill, dark teal wings (the left one lying over its flank and
// sticking out behind, the right one drooping behind the belly), a spray of leafy green tail feathers to the
// left-rear, and orange webbed feet.
//
// Checklist (sheet frame: height 40, feet z = 0, x = art centre; sheet x ~ 0.866 x + 0.5 y at the 30 deg camera):
//   body        M0 green [0.47, 0.65, 0.18] egg, sheet x -14.1..5, z 4..18, widest z 9..12; thick neck into a round
//               head x -13..-2, z 16..26 (top under the flower at ~27)
//   chest       yellow-green [0.76, 0.83, 0.20] patch on the lower-left of the body, x -14..-3, z 5..16
//   cheek spot  dark green [0.23, 0.43, 0.16] at sheet (-2, 18.5)
//   bill        wide flat duck bill in profile, x -16..-4.3, z 15.9..21: upper mandible orange M4 [0.94, 0.41, 0.20]
//               (glows), lower mandible / mouth line red-pink [0.80, 0.21, 0.35]
//   eyes        big angry eyes under dark slanted brows: near eye sheet (-10.5, 22), far eye (-5.2, 21), 3.5 wide,
//               light-blue whites, black pupils with a highlight
//   flower      six pink M1 [0.98, 0.39, 0.54] hibiscus petals round a dark-teal centre at sheet (-3.2, 28):
//               far-left tip (-15.2, 27.6), lower-left (-8.5, 23) over the brow, upper-left (-5.5, 33.9) behind the
//               stamens, upper-right (2, 32.6), right (7.7, 27), lower-right (1.5, 21.7); petal undersides dark red
//               [0.57, 0.06, 0.18] (what the back view shows); three yellow-green stamens to z 33.9, beige tips
//   stink       four tan zigzags above: x -11.4..-8.8 z 32.8..38.1; -6.1..-2.8 z 34.1..39.9; -0.6..1.2 z 33.9..39;
//               4.3..6.6 z 30.6..36.3 (their colour is not in the sheet's palette: ~[0.80, 0.70, 0.36])
//   left wing   M2 teal [0.05, 0.28, 0.22] lying over the flank from sheet x -4.4 to 10.6, z 7.2..17.8, pointed
//               feather tips at the lower right; lighter coverts [0.07, 0.43, 0.38] along its top
//   right wing  drooping tip behind the belly, sheet x -18.6..-12.1, z 7.8..17
//   tail        8 pointed leaf feathers fanning from the rump (4, 10) to tips (8.1, 17.4) .. (18.6, 5) .. (9, 3.4),
//               greens [0.47, 0.65, 0.18] / [0.37, 0.58, 0.20] / dark [0.23, 0.43, 0.16]
//   feet        orange M4 webbed feet pointing forward, near x -15.9..-6.3, far x -2.5..5.2, z 0..4
//   back        the flower from behind (dark red petals, yellow stamens), the wings out, the tail to the left
//   not made    the back sprite's fully spread 20-unit wings and its tail dragging to the ground (different drawing)
include <lib.scad>

green = [0.47, 0.65, 0.18];
greenLt = [0.76, 0.83, 0.20];
greenMid = [0.37, 0.58, 0.20];
greenDk = [0.23, 0.43, 0.16];
teal = [0.05, 0.28, 0.22];
tealLt = [0.07, 0.43, 0.38];
pink = [0.98, 0.39, 0.54, NOGLOW];      // bright, but the sprite's petals do not glow
pinkDk = [0.80, 0.21, 0.35];
red = [0.57, 0.06, 0.18];
orange = [0.94, 0.41, 0.20, GLOW];      // the sheet: #ef6933 GLOWS
beige = [0.93, 0.87, 0.62];
stink = [0.80, 0.70, 0.36];
eyeWhite = [0.80, 0.92, 0.95];
ink = [0.05, 0.04, 0.06];

// Picture plane: a part drawn at its sheet [x, z] sits in the plane the front camera sees face-on; `t` moves it away
// from the camera along the view direction, which keeps its sheet position.
module pp(t = 0) { translate([-0.5 * t, 0.866 * t, 0]) rotate([0, 0, 30]) children(); }

// The point on ellipsoid (centre c, radii r) that the front camera sees at sheet [u, z], pushed `out` off the surface
// (clamped to the silhouette), and the outward normal there.
function surfE(c, r, u, z, out = 0.25) =
  let(f = sqrt(max(0.02, 1 - pow((z - c[2]) / r[2], 2))),
      rx = r[0] * f + out, ry = r[1] * f + out,
      hx = 0.866, hy = 0.5, dx = -0.5, dy = 0.866,
      du = u - (hx * c[0] + hy * c[1]),
      A = pow(dx / rx, 2) + pow(dy / ry, 2),
      B = 2 * du * (hx * dx / (rx * rx) + hy * dy / (ry * ry)),
      C = du * du * (pow(hx / rx, 2) + pow(hy / ry, 2)) - 1,
      D = B * B - 4 * A * C,
      v = D > 0 ? (-B - sqrt(D)) / (2 * A) : -B / (2 * A))
  [c[0] + hx * du + dx * v, c[1] + hy * du + dy * v, z];
function normE(c, r, p) = let(n = [(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]) n / norm(n);
// Flat patch of colour col lying on ellipsoid (c, r) where the camera sees sheet [u, z]: a disc sx by sy, `th` thick.
module patchE(c, r, u, z, sx, sy, col, th = 0.9) {
  p = surfE(c, r, u, z, 0.1);
  color(col) translate(p) rotate(_dir_rot(normE(c, r, p))) scale([sx, sy, th]) sphere(1, $fn = 20);
}

// ---- body: a plump egg, a thick neck and a round head
bc = [-5.6, 0.5, 11.2];
bR = [9.6, 10.8, 7.4];
hc = [-5.9, -4, 21.3];
hR = [6.0, 6.0, 5.9];
color(green) hull() {
  translate(bc) scale(bR) sphere(1, $fn = 32);
  translate([bc[0], 0.5, 4.6]) scale([7.6, 8.4, 1.0]) sphere(1, $fn = 24);   // the flat underside the art sits on
}
blob([[hR, hc], [[5.5, 5.5, 4.7], [-5.8, -2, 16.4]]], green);
// the breast bulging forward-left under the chest patch
ell([4.8, 4.8, 4.4], [-8.2, -4.8, 8.6], greenLt);
// crown under the flower
ell([4.2, 3.6, 2.6], [-4.6, -3.2, 26.3], green);
// the dark cheek spot
patchE(hc, hR, -2.0, 18.5, 1.3, 1.1, greenDk, 0.6);

// ---- bill: a wide flat duck bill pointing forward (turned 8 deg towards the camera), the upper mandible orange,
// the lower red-pink, the mouth line drooping into a frown
translate(hc) rotate([0, 0, 8]) translate(-hc) {
  color(orange) hull() {
    translate([hc[0] + 0.5, -8.3, 19.9]) scale([3.9, 3.2, 2.1]) sphere(1, $fn = 20);
    translate([hc[0] - 0.6, -18.8, 18.9]) scale([3.2, 2.4, 1.5]) sphere(1, $fn = 20);
  }
  color(pinkDk) hull() {
    translate([hc[0] + 0.5, -8.3, 17.9]) scale([3.7, 3.2, 1.7]) sphere(1, $fn = 20);
    translate([hc[0] - 0.6, -18.4, 17.3]) scale([3.0, 2.4, 1.3]) sphere(1, $fn = 20);
  }
  color(red) hull() {
    translate([hc[0] + 0.5, -9.0, 18.3]) scale([4.0, 2.2, 0.45]) sphere(1, $fn = 16);
    translate([hc[0] - 0.6, -17.4, 17.9]) scale([3.2, 1.6, 0.4]) sphere(1, $fn = 16);
  }
}

// ---- eyes: a sidelong glare. The art centres both eyes on the head while the bill stays in profile, so the eye
// pair is turned 25 deg towards the camera; both lids slope down towards the creature's right (the viewer's left),
// the pupils sit in the right half of each eye, the far eye has a highlight.
translate(hc) rotate([0, 0, 25]) translate(-hc) translate([hc[0], hc[1], 0]) for (s = [-1, 1]) {
  a = 32 * s;
  translate([5.4 * sin(a), -5.4 * cos(a), 22.0]) rotate([0, 0, a]) {
    color(eyeWhite) scale([1.75, 0.8, 1.3]) sphere(1, $fn = 18);
    color(ink) translate([0.5, -0.65, -0.1]) scale([0.7, 0.4, 0.75]) sphere(1, $fn = 12);
    if (s > 0) color("white") translate([1.0, -1.0, 0.45]) sphere(0.3, $fn = 8);
    // lid: a dark bar across the top, low at the -X end
    color(ink) translate([0, -0.25, 0.95]) rotate([0, -26, 0]) scale([2.2, 0.85, 0.55]) sphere(1, $fn = 14);
  }
}

// ---- flower: a hibiscus worn on the head, its disc facing the camera and tipped back 20 deg
function lobe(L, W) = [for (t = [0 : 15 : 345]) [0.5 * L + 0.5 * L * cos(t), 0.5 * W * sin(t) * (0.6 + 0.2 * (1 + cos(t)))]];
module petal2(phi, L, W) {
  rotate([0, -phi, 0]) {
    slab(lobe(L, W), 2.4, pink, 0.9);
    translate([0, 1.3, 0]) plate(lobe(L * 0.95, W * 0.95), 1.0, 0.6, red);
  }
}
fc = [-3.7, 0, 27.8];
pp(-2.2) translate(fc) rotate([-12, 0, 0]) {
  petal2(182, 11.0, 8.5);
  petal2(226, 9.5, 7.0);
  petal2(116, 6.9, 5.0);
  petal2(36, 8.6, 6.5);
  petal2(-8, 11.6, 8.5);
  petal2(-50, 8.0, 6);
  // centre and stamens
  ell([1.7, 1.3, 1.5], [0, -0.9, 0.2], teal);
  for (tip = [[-2.6, 4.8], [-0.4, 5.9], [2.0, 4.4]]) {
    limb([0, -1.2, 0.5], [tip[0], -1.4, tip[1]], 0.5, 0.4, greenLt);
    ell([0.7, 0.6, 0.8], [tip[0], -1.4, tip[1] + 0.4], beige);
  }
}

// ---- stink squiggles above the flower
module zig(pts) { chain([for (p = pts) [p[0], 0, p[1]]], [for (p = pts) 0.42], stink); }
pp(-1) {
  zig([[-10.3, 32.8], [-9.3, 34.5], [-10.6, 35.9], [-9.0, 37.3], [-10.1, 38.1]]);
  zig([[-4.3, 34.2], [-3.1, 35.5], [-5.4, 37.8], [-3.9, 39.6]]);
  zig([[0.6, 34.2], [1.0, 35.4], [-0.5, 36.6], [0.9, 37.7], [-0.1, 39.0]]);
  zig([[5.6, 30.8], [6.4, 32.5], [4.6, 33.9], [6.2, 35.0], [4.9, 36.2]]);
}

// ---- left wing: lies over the flank (a curved patch on the body) and sticks out behind it (a slab through the
// body's mid-plane, which emerges at the silhouette); lighter coverts along its top
wingPts = [[-4.4, 12.0], [-3.0, 10.1], [-1.4, 8.5], [1.2, 7.2], [3.0, 7.2], [3.3, 8.6], [5.0, 7.6], [6.6, 7.4],
           [7.0, 7.9], [7.5, 7.2], [8.3, 8.5], [8.4, 9.4], [9.4, 10.1], [10.4, 7.8], [10.3, 10.2], [10.6, 10.5],
           [9.0, 11.6], [9.2, 13.2], [8.4, 13.9], [6.1, 15.0], [5.5, 15.9], [3.7, 16.5], [5.5, 17.6], [6.6, 17.6],
           [5.4, 17.8], [0.3, 17.4], [-4.4, 14.7]];
covertPts = [[-4.3, 14.6], [-3.4, 12.2], [-1.0, 10.6], [2.4, 10.8], [5.4, 12.4], [6.2, 15.0], [4.0, 16.6],
             [0.3, 17.0], [-3.0, 16.4]];
// yellow-green chest: a curved patch flush with the belly, its outline as the art draws it
chestPts = [[-8.4, 16.2], [-5.4, 15.2], [-3.4, 12.8], [-3.2, 9.6], [-4.6, 6.4], [-7.6, 4.9], [-11.0, 5.3],
            [-13.4, 7.4], [-14.2, 10.4], [-13.6, 13.4], [-11.4, 15.6]];
module shell(c, r, out, inn) {
  translate(c) difference() {
    scale(r + [out, out, out]) sphere(1, $fn = 40);
    scale(r + [inn, inn, inn]) sphere(1, $fn = 40);
  }
}
// outline extruded from the body's mid-plane towards the camera
module prism(pts) { pp(0) rotate([90, 0, 0]) linear_extrude(height = 30) polygon(pts); }
color(greenLt) intersection() { shell(bc, bR, 0.35, -0.5); prism(chestPts); }
color(teal) intersection() { shell(bc, bR, 0.8, -0.4); prism(wingPts); }
color(tealLt) intersection() { shell(bc, bR, 1.2, 0.5); prism(covertPts); }
pp(0) slab(wingPts, 2.4, teal, 0.8);

// ---- right wing: a drooping tip showing behind the belly on the viewer's left
rwPts = [[-9, 17.2], [-9, 12.5], [-12.5, 11.2], [-13.5, 7.8], [-17.8, 9.3], [-18.6, 11.5], [-18.4, 13.2],
         [-14.0, 16.6]];
pp(-0.5) slab(rwPts, 2.2, teal, 0.7);

// ---- tail: pointed leaf feathers fanning from the rump to the lower right, behind the body
function blade(L, W) = [[0, 0], [0.3 * L, W * 0.5], [0.78 * L, W * 0.38], [L, W * 0.1], [L, -W * 0.1], [0.78 * L, -W * 0.38], [0.3 * L, -W * 0.5]];
tailRoot = [4, 0, 9.2];
feathers = [[59, 9.2, 3.2, greenMid], [38, 9.0, 3.2, greenDk], [17, 11.3, 3.6, green], [8, 11.5, 3.4, greenLt],
            [2, 12.2, 3.6, green], [-6, 12.0, 3.2, greenDk], [-14, 12.4, 3.4, greenMid], [-20, 15.4, 3.8, green],
            [-30, 12.8, 3.2, greenDk], [-40, 11.5, 3.4, greenMid], [-52, 8.6, 3.0, greenDk], [-60, 7.5, 3.2, green]];
pp(4) translate(tailRoot) for (i = [0 : len(feathers) - 1]) {
  f = feathers[i];
  translate([0, (i % 2) * 1.2 - 0.6, 0]) rotate([0, -f[0], 0]) slab(blade(f[1], f[2]), 1.8, f[3], 0.6);
}
// the rump the feathers grow from
ell([3.6, 3.4, 3.2], [1.2, 6.5, 9.5], greenMid);

// ---- legs and orange webbed feet pointing forward
module foot(c) {
  color(c) hull() {
    translate([0, 1.2, 1.0]) scale([2.2, 2.0, 1.0]) sphere(1, $fn = 14);
    for (a = [-33, 0, 33]) translate([sin(a) * 3.0, -1 - cos(a) * 4.4, 0.75]) scale([0.9, 0.9, 0.75]) sphere(1, $fn = 10);
  }
}
for (x = [bc[0] - 6.8, bc[0] + 7.4]) {
  limb([x, -2, 5.5], [x, -2.4, 1.5], 1.3, 1.1, orange);
  translate([x, -2.4, 0]) foot(orange);
}
