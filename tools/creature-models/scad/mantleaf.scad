// Mantleaf: a leaf mantis drawn three-quarter, its face turned to the viewer.
// Checklist (front sheet, x / z):
//   head: an inverted green triangle x -10.7..-0.2, z 20.6..30.7, two pointed top corners, a dark green diamond on
//     the forehead; big yellow almond eyes slanted up and out (far -9.4, near -2.8, z 24.2), a dark upper lid on the
//     inner side, a white shine, no pupil; no mouth drawn.
//   two thin green antennae from the notch between the top corners, curving out to z 36.
//   lotus crown: six pink petals fanned behind the head (tips -12.3/34.5, -4.6/39.7, -1/35, 3.6/35.6, 5.3/29.3, a low
//     one to -13.9/29); from behind the crown is green (sepals with a dark centre).
//   thorax: an upright pale segmented column under the chin, x -6..-1, z 8..21.
//   raptorial arms: far one zig-zags out (shoulder, elbow -10/15, knee -13.5/22.5) to a broad serrated blade hanging to
//     -17.8/7; near one folds down in front of the body, its blade hanging to 0/3.
//   leaf wings: two big mottled dark leaves fanned out to the right (tips 16.8/20 and 18.4/13.5), a third smaller one
//     below; light camo blotches, a dark midrib. The dark abdomen under them, x 0..14, z 4.5..12.
//   four legs: front pair splayed wide (feet -14/1.3 and 10.5/0), back pair (feet -6.5/4 and 12.5/3.5), thick thighs.
//   back: the leaves fan to the viewer's left (the creature's +X), the green sepals of the crown.
// The pose is lopsided as drawn (the leaves fan to +X); the sheet's depth pitch is folded into P().
include <lib.scad>

skin = [0.55, 0.67, 0.15];
skinDk = [0.44, 0.56, 0.12];
belly = [0.64, 0.75, 0.23];
ring = [0.4, 0.53, 0.11];
leafC = [0.33, 0.46, 0.1];
spotC = [0.62, 0.73, 0.2];
ribC = [0.2, 0.32, 0.1];
mark = [0.36, 0.5, 0.1];
pink = [0.88, 0.39, 0.44, NOGLOW];
pinkDk = [0.76, 0.3, 0.36, NOGLOW];
sepal = [0.47, 0.6, 0.13];
eyeY = [0.97, 0.84, 0.31, NOGLOW];
eyeO = [0.93, 0.7, 0.17, NOGLOW];
ink = [0.06, 0.2, 0.18];

// A point that lands on the front sheet at (sx, sz) at picture-plane depth d (the 10 degree pitch folded in).
function P(sx, sz, d) = [sx * cos(VIEW) - d * sin(VIEW), sx * sin(VIEW) + d * cos(VIEW), sz - 0.17 * (d + 10)];
// Picture-plane frame at depth d with the same pitch correction (outlines traced from the front sheet).
module ppz(d) { pp(d) translate([0, 0, -0.17 * (d + 10)]) children(); }

H = [0, -11.5, 25.5];
HY = 28;
module headFrame() { translate(H) rotate([0, 0, HY]) children(); }

// ---- Head (local frame: facing -Y, centre at the eyes' middle height + 1.3)
headFrame() {
  // two halves hulled apart, so the top keeps the drawing's notch between the corners
  color(skin) mirror_x() hull() {
    translate([3.2, 0, 3.0]) scale([2.2, 2.3, 1.8]) sphere(1, $fn = 24);
    translate([3.5, -0.2, 0.2]) scale([1.7, 2.3, 1.7]) sphere(1, $fn = 24);
    translate([0, -0.3, 0.6]) scale([1.4, 2.4, 1.8]) sphere(1, $fn = 20);
    translate([0, -0.6, -4.2]) scale([0.8, 1.2, 0.8]) sphere(1, $fn = 16);
  }
  // pointed top corners
  mirror_x() spike([3.1, 0, 3.8], [0.8, 0, 1.9], 1.4, 0.12, skin);
  // dark forehead diamond
  color(mark) hull() {
    translate([0, -2.45, 1.9]) scale([1.2, 0.3, 0.6]) sphere(1, $fn = 12);
    translate([0, -2.45, -1.3]) scale([0.3, 0.3, 0.3]) sphere(1, $fn = 8);
  }
  // big almond eyes, slanted up and out, dark upper lid on the inner side, no pupil
  mirror_x() translate([2.9, -1.85, -1.1]) rotate([0, -52, 18]) scale([1.4, 1, 0.72])
  {
    eye([0, 0, 0], 1.95, iris = eyeO, sclera = eyeY, pupil = eyeO, shine = true);
    // the dark rim over the upper, inner edge (the drawing's heavy upper lid line)
    color(ink) intersection() {
      scale([1.06, 0.4, 1.17]) sphere(1.95, $fn = 20);
      rotate([0, -18, 0]) translate([-6, -6, 0.9]) cube(12);
    }
  }
  // antennae
  mirror_x() chain([[0.7, 0.3, 4.3], [1.8, 0.6, 7.5], [3.5, 0.8, 10], [5, 0.5, 11]], [0.38, 0.32, 0.26, 0.2], skinDk);
}

// ---- Lotus crown: pink petals fanned behind the head, green sepals behind each (the back view is green)
module petal(b, t, w, th = 0.55) {
  ax = t - b;
  L = norm(ax);
  a = atan2(ax[0], ax[1]);
  hull() {
    translate([b[0], 0, b[1]]) scale([w * 0.22, th, w * 0.22]) sphere(1, $fn = 12);
    translate([b[0] + ax[0] * 0.5, -0.4, b[1] + ax[1] * 0.5]) rotate([0, a, 0]) scale([w / 2, th, L * 0.3]) sphere(1, $fn = 20);
    translate([t[0], -1.2, t[1]]) sphere(0.22, $fn = 8);
  }
}
PETALS = [
  [[-7, 26.5], [-14.2, 28.6], 4.8, pinkDk],
  [[-7, 28], [-12.4, 34.6], 6.2, pink],
  [[-6, 29], [-4.6, 39.4], 6.4, pink],
  [[-4.5, 28.5], [-0.8, 35.2], 5.0, pinkDk],
  [[-4, 28], [3.6, 35.6], 6.4, pink],
  [[-3.5, 26.5], [5.4, 29.2], 5.2, pink],
];
ppz(-7.6) for (p = PETALS) {
  color(p[3]) petal(p[0], p[1], p[2]);
  color(sepal) translate([0, 0.9, 0]) petal(p[0], p[0] + (p[1] - p[0]) * 0.96, p[2] * 0.9);
}
// the crown's dark centre seen from behind
color(leafC) ppz(-6.4) translate([-5.6, 0, 28]) scale([2.6, 1, 2.4]) sphere(1, $fn = 16);

// ---- Thorax: an upright pale segmented column, a neck up to the chin
TH = [[0, -5, 7.5], [0, -7, 13.5], [0, -9, 19.5]];
chain(TH, [2.6, 2.5, 2.0], skin);
color(belly) for (i = [0 : 3]) let(k = 0.12 + i * 0.22, p = TH[0] + (TH[2] - TH[0]) * k)
  translate(p + [0, -0.5, 0]) rotate([-18, 0, 0]) scale([2.35 - i * 0.12, 2.2 - i * 0.1, 0.9]) sphere(1, $fn = 18);
color(ring) for (i = [0 : 3]) let(k = 0.23 + i * 0.22, p = TH[0] + (TH[2] - TH[0]) * k)
  translate(p) rotate([-18, 0, 0]) scale([2.6 - i * 0.14, 2.45 - i * 0.12, 0.22]) sphere(1, $fn = 18);
limb([0, -9, 19.5], [0, -10.6, 21.8], 1.7, 1.4, skin);
// wing base on the back of the thorax
ell([2.4, 3.2, 2.6], [1.6, -5.4, 17.5], skin);

// ---- Abdomen: dark, broad and flat under the leaves, swung out to +X as drawn
blob([[[4, 4.5, 3.4], [2, 1, 9.5]], [[5, 4.6, 3.2], [6.5, 5, 8]], [[2.6, 2.4, 2.2], [9, 6.5, 9.8]]], leafC);

// ---- Leaf wings (traced off the front sheet), fanned out from the wing base, tipped back so they read from above
module leaf(pts, spots, rib, d, root, yaw, tilt, depth = 1.7) {
  ppz(d) translate([root[0], 0, root[1]]) rotate([0, 0, yaw]) rotate([tilt, 0, 0]) translate([-root[0], 0, -root[1]]) {
    slab(pts, depth, leafC, inset = 2.2);
    color(spotC) for (s = spots) intersection() {
      slab(pts, depth + 0.35, leafC, inset = 2.2, grow = 0.3);
      rotate([90, 0, 0]) linear_extrude(height = 10, center = true) polygon(s);
    }
    color(ribC) intersection() {
      slab(pts, depth + 0.4, leafC, inset = 2.2, grow = 0.3);
      rotate([90, 0, 0]) linear_extrude(height = 10, center = true) polygon(rib);
    }
  }
}
LEAF1 = [[0.3, 21.8], [2.5, 23.8], [5, 24.8], [8, 25.1], [11, 24.4], [13.8, 22.9], [16.8, 20.3], [13.5, 18.8],
         [10, 18.4], [6.5, 18.8], [3.5, 19.8]];
LEAF2 = [[1.5, 18.6], [4.5, 19.8], [8, 20.1], [11.5, 19.9], [14.5, 19], [17, 17], [18.6, 13.6], [16, 12], [12.5, 11.2],
         [9, 11.5], [5.5, 12.8], [3, 15]];
LEAF3 = [[1, 18], [3.5, 17.4], [6, 15.5], [8.5, 12], [10, 9.2], [7, 9.8], [4.5, 11.5], [2.5, 14]];
leaf(LEAF3, [[[5, 14.5], [6.5, 13.8], [6, 12.4], [4.6, 13]]],
     [[1.3, 17.7], [5.5, 14.2], [9.6, 9.6], [9.3, 9.4], [5.2, 13.8], [1.1, 17.4]], -3.5, [1.2, 17.5], -12, -12, 1.5);
leaf(LEAF2, [[[7, 18.7], [9.5, 19.2], [10.5, 17.7], [8.5, 16.4], [6.8, 17.2]],
             [[12, 17.7], [14.5, 17.7], [15, 16], [13, 15.2], [11.5, 16.2]],
             [[9.5, 14.6], [12, 14.9], [12.5, 13.1], [10, 12.4]],
             [[15, 14.6], [17, 14.9], [17.2, 13.3], [15.5, 12.9]],
             [[4.5, 16.5], [6, 16.3], [5.8, 14.8], [4.4, 15.4]]],
     [[2, 17.3], [10, 16.1], [18.2, 13.8], [18.2, 13.4], [10, 15.7], [2, 16.9]], -5.2, [2, 17.2], -15, -18);
leaf(LEAF1, [[[6, 24], [8, 24.4], [9.5, 23.2], [8.5, 21.8], [6.5, 22.2]],
             [[11, 23], [13, 22.5], [13.5, 21], [11.5, 20.7], [10.5, 21.7]],
             [[3.5, 21.7], [5, 22.7], [6, 21.2], [4.5, 20.2]],
             [[14.2, 21], [15.6, 20.6], [14.6, 19.6], [13.6, 20]]],
     [[0.8, 22], [8, 21.9], [16.4, 20.4], [16.4, 20.1], [8, 21.4], [0.8, 21.6]], -6.4, [0.8, 21.7], -15, -22);

// ---- Raptorial arms (posed as drawn: the far one spread wide, the near one folded in front of the body)
FS = P(-6, 18.5, -6);    FE = P(-10, 14.8, -4.5);  FK = P(-13.2, 22.4, -4.5);
NS = P(-2, 18.5, -9.5);  NE = P(5.2, 10.2, -11.5); NK = P(1, 20.6, -12);
limb(FS, FE, 1.25, 1.35, skin);
limb(FE, FK, 1.5, 1.15, skin);
limb(NS, NE, 1.1, 1.2, skin);
limb(NE, NK, 1.3, 1.0, skin);
// broad serrated blades (tibiae), flat as drawn
FAR_BLADE = [[-13.8, 23.4], [-12.4, 22.6], [-12.6, 20], [-13.8, 17.2], [-14.3, 15.6], [-14.0, 14.6], [-15.1, 13.8],
             [-15.3, 12.0], [-16.0, 11.2], [-16.4, 9.0], [-17.6, 6.6], [-18.5, 9.5], [-18.5, 13.5], [-17.2, 18],
             [-15.3, 21.5]];
NEAR_BLADE = [[0.1, 21.2], [1.6, 20.4], [1.2, 15], [0.9, 9], [0.4, 3.4], [-0.3, 2.6], [-1.3, 6.5], [-1.9, 11.5],
              [-1.7, 16.5], [-1.1, 20]];
ppz(-4.5) plate(FAR_BLADE, 1.2, 0.4, skin);
ppz(-12.3) plate(NEAR_BLADE, 1.2, 0.4, skin);
// blade ridges in the darker green
ppz(-4.5) translate([0, -0.62, 0]) plate([[-13.6, 22.6], [-13.2, 22.2], [-17.6, 8], [-17.9, 8.4]], 0.15, 0.1, skinDk, 0.1);
ppz(-12.3) translate([0, -0.62, 0]) plate([[-0.1, 20.5], [0.4, 20.4], [-0.2, 3.6], [-0.5, 3.8]], 0.15, 0.1, skinDk, 0.1);

// ---- Four legs: thick thighs up and out, shins down to small pointed feet
mirror_x() {
  limb([2, -3, 9.5], [9, -5, 11.5], 1.6, 1.35, skin);
  limb([9, -5, 11.5], [14.1, -3.5, 0.6], 1.35, 0.55, skin);
  ell([0.7, 1.4, 0.42], [14.4, -4.3, 0.42], skinDk);
  limb([2.5, 2, 9], [10, 3, 10.5], 1.5, 1.25, skin);
  limb([10, 3, 10.5], [11, 6, 0.6], 1.25, 0.55, skin);
  ell([0.7, 1.4, 0.42], [11.2, 5.2, 0.42], skinDk);
}
