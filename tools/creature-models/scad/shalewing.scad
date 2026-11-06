// Shalewing: a slate-grey baby pterosaur hatching from a speckled tan egg, the egg's top shell on its head, remodelled
// to its sprite (2026-11-06). Petraptor (its evolution) shares the slate and the tan.
// Checklist (front sheet, 40 units tall):
//   head  drawn in profile, the beak to the viewer's left: the head is turned 45 deg towards the creature's right
//         (headFrame) and authored in its own frame with S() (y = sheet x). Round slate cranium (-5..7, 22..34) with
//         a forehead bulging forward to the beak (-9, 28..32). ONE big round eye showing (-2.9..2.8, 24.4..29.8):
//         cream sclera at the back, orange iris and a big dark pupil looking forward, a big white glint upper front.
//         The far eye is hidden behind the head (still modelled).
//   beak  big orange hooked wedge from the face (-5.4, 27.2)..(-1.5, 23.3) to its tip (-10.9, 19.3), a dark nostril
//         (-6.3, 24.9), a white tooth under it (-6.8, 20.5); the lower bill hangs open (-1, 22.6)..(-5.6, 17.9) with
//         a dark mouth inside.
//   cap   the egg's top: a tan dome over the head (-10.2..8.4, 27.4..39.5), the jagged rim higher at the front (35)
//         than the back (27.4); two dark spots (0.7, 36.3) and (5.6, 33.8).
//   egg   lower shell (-10.2..10, 1.4..15.4), a jagged rim of big teeth (tips 13..15.4, notches 9.6..11.4), three
//         dark spots (-7.4, 8.3) (0, 6.4) (4.4, 7.8); the slate chest fills the opening up to the neck (z 22).
//   wings spread wide: slate arm up from the shoulder to the wrist (12, 25.6) with a tan thumb claw on top, the slate
//         finger down the outer edge to the tip (18.3, 9.3), a tan membrane between with a scalloped trailing edge.
//         The far wing mirrors it (art: wrist -13, 25; tip -18.6, 10.3).
//   feet  slate toes poking out under the egg at both sides (6, 3.5) and (-8.1, 3.6), three tan claws each.
//   back  the cap's rim zigzag all round, the slate back of the head and neck, the egg with its spots, the beak tip
//         showing on the creature's right.
include <lib.scad>

slate = [0.4, 0.41, 0.47];
shell = [0.7, 0.58, 0.41];
spotC = [0.5, 0.4, 0.3];
membrane = [0.65, 0.53, 0.38];
claw = [0.79, 0.65, 0.47];
beak = [0.9, 0.57, 0.2, NOGLOW];
jawC = [0.81, 0.49, 0.17, NOGLOW];
mouth = [0.5, 0.27, 0.1];
ink = [0.12, 0.11, 0.12];
iris = [0.82, 0.45, 0.13, NOGLOW];
sclera = [0.96, 0.89, 0.76];

// ---------- helpers
function ellPts(cx, cz, rx, rz, n = 14) = [for (i = [0 : n - 1]) [cx + rx * cos(i * 360 / n), cz + rz * sin(i * 360 / n)]];
// The near half (towards the front camera) of the space, cut through a point at view depth d (= -0.5 x + 0.866 y).
module frontHalf(d) { pp(d) translate([-60, -120, -60]) cube([120, 120, 120]); }
// The back camera (build.mjs: rz -150) sees screen x along (-0.866, -0.5); depth d = 0.5 x - 0.866 y.
module backFrame(d = 0) { rotate([0, 0, 210]) translate([0, d, 0]) children(); }
module backHalf(d) { backFrame(d) translate([-60, -120, -60]) cube([120, 120, 120]); }
module prismB(pts) { backFrame(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) polygon(pts); }
// Zigzag cutter: convex wedges round the Z axis between z = far and a rim of 2n points alternating hi / lo (+ jitter).
module zig(n, R, hi, lo, far, jit = [0]) {
  hc = (hi + lo) / 2;
  for (k = [0 : 2 * n - 1]) {
    a0 = k * 180 / n; a1 = (k + 1) * 180 / n;
    h0 = (k % 2 == 0 ? hi : lo) + jit[k % len(jit)];
    h1 = ((k + 1) % 2 == 0 ? hi : lo) + jit[((k + 1) % (2 * n)) % len(jit)];
    hull() for (p = [[0, 0, far], [0, 0, hc], [R * cos(a0), R * sin(a0), far], [R * cos(a1), R * sin(a1), far],
                     [R * cos(a0), R * sin(a0), h0], [R * cos(a1), R * sin(a1), h1]])
      translate(p) cube(0.02, center = true);
  }
}

// ---------- the lower egg: a hollow shell with a jagged rim, the chick's chest filling it
eggProf = [[3.2, 1.3], [5.8, 2.9], [7.6, 4.8], [9, 6.6], [9.9, 8.5], [10.2, 11], [10.1, 13.5], [9.7, 16]];
module eggSolid(g = 0) {
  pr = [for (p = eggProf) [p[0] + g, p[1] - (p[1] < 2 ? g : 0)]];
  rotate_extrude($fn = 40) polygon(concat([[0, pr[0][1]]], pr, [[0, pr[len(pr) - 1][1]]]));
}
module eggCut() { rotate([0, 0, 8]) zig(8, 12, 14.8, 10.6, -5, [0.4, -0.3, -0.5, 0.6, 0.2, 0.3, -0.4, -0.6, 0.5, 0.1, -0.2, 0.7, 0, -0.4, 0.3, 0.2]); }
color(shell) intersection() {
  difference() { eggSolid(); translate([0, 0, 0.9]) eggSolid(-0.9); }
  eggCut();
}
// Dark spots laid flush on the shell (front and back art).
for (s = [[-7.35, 8.25, 0.8, 0.8], [-0.1, 6.4, 0.85, 0.8], [4.4, 7.75, 1.15, 1.2]])
  color(spotC) intersection() { eggSolid(0.15); eggCut(); prism(ellPts(s[0], s[1], s[2], s[3])); frontHalf(0); }
for (s = [[-7.55, 8.25, 0.8, 0.8], [3.8, 7.9, 1.1, 1.1], [0, 6.25, 0.8, 0.8]])
  color(spotC) intersection() { eggSolid(0.15); eggCut(); prismB(ellPts(s[0], s[1], s[2], s[3])); backHalf(0); }

// Chest filling the egg up to the neck.
// Chest filling the egg, broad up to the head (the art's chest is as wide as the head).
CHEST = [[[9.3, 9.1, 6.6], [0, 0, 11]], [[6.8, 5.6, 5], [0, 0, 18]], [[4.8, 4.4, 3], [0, -0.8, 23]]];
blob(CHEST, slate);

// ---------- feet poking out under the egg, three tan claws each
module foot() {
  limb([4.6, -0.8, 5], [7.4, -2.4, 2.6], 1.8, 1.6, slate);
  ell([2.3, 2.7, 1.5], [7.6, -2.8, 2], slate);
  for (k = [-1, 0, 1]) spike([7.6 + k * 1.3, -4.8 + abs(k) * 0.5, 1.5], [k * 0.4 + 0.1, -1, -1.1], 0.62, 0.15, claw);
}
mirror_x() foot();

// ---------- wings (near +X side, mirrored). W() reads a sheet point at depth y.
function W(sx, z, y) = [(sx - 0.5 * y) / 0.866, y, z];
WY = -1;
SH = W(3.5, 18.5, 0);
WR = W(11.8, 25.6, WY);
FING = [WR, W(14.4, 23.4, WY), W(16.6, 20.4, WY), W(18.1, 16.6, WY), W(18.5, 12.6, WY), W(18.2, 9.4, WY)];
FING_R = [1.15, 1, 0.9, 0.8, 0.65, 0.35];
memb = [[4.9, 17.4], [4.9, 16.1], [6.7, 14.5], [7.6, 15.9], [8.4, 16.1], [10, 14.7], [10.2, 13.6], [11.1, 13.8],
        [11.8, 15.2], [13.3, 15.8], [16.5, 13.4], [17.6, 11.2], [18, 12.5], [17.9, 16], [16.8, 19.6], [14.6, 22.8],
        [12, 24.6], [10.6, 24], [8.2, 21.4], [5.6, 19.4]];
module wing() {
  // tan membrane: a thin pillow in the wing's plane (y = WY), its outline the art's
  translate([0, WY, 0]) slab([for (p = memb) [(p[0] - 0.5 * WY) / 0.866, p[1]]], 1.5, membrane, inset = 0.5);
  // slate arm up to the wrist, the finger down the leading edge, a tan thumb claw on the wrist
  limb(SH, WR, 1.5, 1.15, slate);
  chain(FING, FING_R, slate);
  spike(WR + [0.2, -0.2, 0.6], [0.4, -0.2, 1.6], 0.7, 0.3, claw);
}
mirror_x() wing();

// ---------- head (its own frame: x = side, y = back, z = up; sheet x = -0.5 + 0.5 x + 0.866 y), turned 30 deg
// towards the creature's right, so the beak points to the viewer's left and the far eye hides behind the face.
HEAD_YAW = -30;
function S(sx, z, x = 0) = [x, (sx + 0.5 - 0.5 * x) / 0.866, z];
module headFrame() { translate([0, -1, 0]) rotate([0, 0, HEAD_YAW]) children(); }

CAP_C = S(-0.9, 30);
CAP_R = [8.6, 9.3, 9.5];
// the cap's rim: a zigzag in a plane tipped back 16 deg (higher at the face, lower at the back of the head)
module capCut() {
  translate([0, CAP_C[1], 31]) rotate([-16, 0, 0]) rotate([0, 0, 5])
    zig(9, 11, 1.7, -1.7, 40, [0.3, -0.2, 0.5, 0.2, -0.4, 0.1, 0.4, -0.3, -0.1, 0.3, 0.2, -0.5, 0.1, 0.4, -0.2, 0, 0.3, -0.3]);
}
module capShape(g = 0) { intersection() { translate(CAP_C) scale(CAP_R + [g, g, g]) sphere(1, $fn = 40); capCut(); } }

// The eye: lib.scad eye()'s sclera, facing the camera (yaw 60 in the head = 30 in the world), with the iris, pupil
// and glint turned `look` degrees forward inside it: the art's eye looks towards the beak, cream at its back.
EYE = [5.59, -2.62, 27.2];
EYE_S = 2.6;
EYE_YAW = 60;
EYE_FLAT = 0.55;
GAPE = [4.6, -3.4, 23];
module bigEye(p, size, yaw, flat, look) {
  translate(p) rotate([0, 0, yaw]) {
    color(sclera) scale([1, flat, 1.15]) sphere(size, $fn = 22);
    rotate([0, 0, look]) {
      color(iris) translate([0, -size * flat * 0.62, -size * 0.05]) scale([0.76, 0.5, 0.88]) sphere(size, $fn = 18);
      color(ink) translate([0, -size * (flat * 0.62 + 0.25), -size * 0.12]) scale([0.42, 0.3, 0.56]) sphere(size, $fn = 14);
      color("white") translate([-size * 0.3, -size * (flat * 0.62 + 0.4), size * 0.3]) scale([0.26, 0.2, 0.28]) sphere(size, $fn = 10);
    }
  }
}

module headParts() {
  // cranium and the forehead bulging forward over the beak
  blob([[[7, 6.8, 6.6], S(0, 28)], [[3.8, 3.6, 3.8], S(-5.6, 30)]], slate);
  // the egg's top shell
  color(shell) capShape();
  // upper beak: a broad hooked wedge, with a dark nostril and a little white tooth on each side
  // (its gape runs back under the eyes, so the bill wraps the front of the face like the art's)
  color(beak) hull() {
    translate(S(-5.2, 26.2)) scale([2.7, 1.6, 1.6]) sphere(1, $fn = 18);
    for (sx = [-1, 1]) translate([sx * GAPE[0], GAPE[1], GAPE[2] + 0.4]) scale([0.8, 1, 0.9]) sphere(1, $fn = 12);
    translate(S(-9.6, 22.5)) scale([1.2, 1, 1]) sphere(1, $fn = 12);
    translate(S(-10.4, 19.7)) sphere(0.45, $fn = 8);
  }
  mirror_x() {
    color(ink) translate(S(-6.4, 24.9, 1.85)) scale([0.3, 0.8, 0.3]) sphere(1, $fn = 8);
    spike(S(-6.8, 21.8, 1.1), [0, 0, -1.4], 0.45, 0.06, "white");
    bigEye(EYE, EYE_S, EYE_YAW, EYE_FLAT, -55);
  }
  // the lower bill hanging open, a dark mouth inside
  color(jawC) hull() {
    for (sx = [-1, 1]) translate([sx * (GAPE[0] - 0.3), GAPE[1] + 0.2, GAPE[2] - 0.6]) scale([0.7, 0.9, 0.7]) sphere(1, $fn = 12);
    translate(S(-5.9, 21.2)) scale([1.8, 0.7, 0.8]) sphere(1, $fn = 10);
    translate(S(-5.9, 18.2)) scale([0.9, 0.6, 0.55]) sphere(1, $fn = 8);
  }
  color(mouth) translate(S(-3.6, 22.4)) scale([3, 2.6, 0.75]) sphere(1, $fn = 16);
}
headFrame() headParts();
// Spots on the cap, laid flush (cap centre in the world: (-0.23, -1.4, 30)).
for (s = [[0.65, 36.25, 0.8, 0.6], [5.55, 33.75, 0.7, 0.95]])
  color(spotC) intersection() { headFrame() capShape(0.15); prism(ellPts(s[0], s[1], s[2], s[3])); frontHalf(-1.1); }
for (s = [[-4.7, 35.75, 0.85, 0.8], [0.9, 34.25, 0.8, 0.75]])
  color(spotC) intersection() { headFrame() capShape(0.15); prismB(ellPts(s[0], s[1], s[2], s[3])); backHalf(1.1); }
