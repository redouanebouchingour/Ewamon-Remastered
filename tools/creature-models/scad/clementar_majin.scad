// Clementar Majin: Clementar corrupted (a copy of scad/clementar.scad, changed where the majin art changes it). A
// hunched, feral dark-russet fennec: huge pointed ears with red insides, glowing red angry eyes over a fanged open
// snarl, the cracked maroon fez kept, a ragged dark-green robe veined with glowing red cracks and a red sigil on the
// chest, thorny brown vines coiled round the skirt, arms, legs and tail, the woven sash, and a cluster of three
// split blood-orange (pomegranate) fruits held up in each clawed hand. A big bushy tail rises behind its left side.
//
// Checklist (sheet frame: height 40, feet z = 0, x = art centre; sheet x = 0.866 x + 0.5 y at the 30 deg camera):
//   head      dark russet [0.40, 0.22, 0.13], hunched forward and low: skull x -9.3..1.7, z 21..30, the muzzle pointing
//             down-left, nose at (-7.3, 24.3); lighter fur [0.56, 0.33, 0.19] on the muzzle and under the eyes
//   eyes      two glowing red slanted almonds with hot pale centres: near x -3.8..-2.0, z 25.9..27.3, far x -7.9..-6.9,
//             z 25.7..26.7 (a full eye on the model); dark lids and brows slanting down to the nose (a glare)
//   mouth     open snarl x -7.3..-3.6, z 21.8..24.4: dark red inside, white fangs top and bottom, chin at z 21
//   ears      huge pointed plates, ragged: far tip (-13.9, 40), root (-6.4..-8.6, 29..33); near tip (8.9, 39.6), root
//             (-0.4..5.6, 29..33.4); dark red insides [0.56, 0.10, 0.05] with a bright red streak [0.82, 0.16, 0.07]
//   fez       maroon [0.44, 0.08, 0.05] x -7..-0.5, z 30.1..36.8, a jagged black crack edged red down its near
//             side (-2.2..-3.2), the green star outline at (-5, 32.4)
//   robe      dark green [0.29, 0.27, 0.14], shoulders x -10..6.6 at z 24, a high ragged collar behind the head to
//             (5.2, 28.8), the waist x -6.4..5.6 at z 15, flaring to the torn hem x -11.9..8.4 at z 4..6.6
//   sigil     a glowing red ring on the chest, centre (-2.85, 18.25), radii 2.3 x 2.55, dark inside, a zigzag crack
//   cracks    glowing red zigzag lines all over the robe (front and back)
//   sash      woven gold / red / green check band z 14.3..16.9; its end hangs down-left to the fringe (-13.7, 9.6)
//   sleeves   ragged green, from the shoulders to the elbows (near (9.3, 17.5), far (-11.5, 17.5)), tatters below
//   arms      brown forearms rising from the sleeves to the hands: near hand x 9.1..13.6, z 22.6..26.3; far hand
//             x -16.3..-10.8, z 21..23.4; each wrapped in a thorny vine
//   fruit     three per hand, r ~2.1, orange-red [0.78, 0.30, 0.11] with a pale-rimmed red seed window on the front:
//             near (12.4, 30.3), (10.5, 27.5), (15.8, 27.5); far (-13.9, 27.5), (-18.2, 25.2), (-13.9, 24.2);
//             dark green leaves on top
//   tail      huge bushy brown tail behind the near side: from the hip (5.5, 10.5) down to (13.8, 9.4), up to the
//             tip (19, 22.4); x 11..20.9, z 5..22.4; two thorny vine rings round it
//   legs      furry brown legs below the hem with vines: far foot x -13.9..-5.2 (toes out left), near foot
//             x 7.1..12.7 (toes out right)
//   back      cracked robe, the sash and its end on the creature's right, the tail on its left, ears and fez
include <lib.scad>

fur = [0.40, 0.22, 0.13];
furLt = [0.56, 0.33, 0.19];
furDk = [0.22, 0.12, 0.07];
tailC = [0.38, 0.21, 0.12];
ink = [0.07, 0.04, 0.03];
robeC = [0.29, 0.27, 0.14];
robeLt = [0.36, 0.35, 0.18];
earIn = [0.56, 0.10, 0.05, NOGLOW];
earHi = [0.80, 0.17, 0.07, NOGLOW];
rune = [0.92, 0.26, 0.10, GLOW];
runeIn = [0.24, 0.09, 0.05];
eyeRed = [0.78, 0.07, 0.04, GLOW];
eyeIris = [0.95, 0.24, 0.10, GLOW];
eyeHot = [1.0, 0.72, 0.45, GLOW];
fang = [0.93, 0.89, 0.80];
mouthC = [0.42, 0.06, 0.04];
noseC = [0.16, 0.09, 0.07];
fezC = [0.44, 0.08, 0.05];
fezDk = [0.30, 0.05, 0.03];
star = [0.24, 0.48, 0.24, NOGLOW];
gold = [0.86, 0.60, 0.20, NOGLOW];
sashR = [0.60, 0.12, 0.07];
sashG = [0.30, 0.45, 0.20, NOGLOW];
fruitC = [0.78, 0.30, 0.11, NOGLOW];
fruitRim = [0.94, 0.60, 0.33, NOGLOW];
fruitIn = [0.70, 0.09, 0.05];
fruitSeed = [0.92, 0.20, 0.08, GLOW];
leaf = [0.25, 0.40, 0.18, NOGLOW];
vineC = [0.46, 0.27, 0.16];
thornC = [0.58, 0.36, 0.21];

// The half-space in front of depth d0 (pp frame): a marking cut with it only shows on the camera-facing surface.
module front(d0 = 0) { pp(0) translate([-60, d0 - 120, -60]) cube(120); }
// Lay the children (a body part grown a little) flush on the surface where the camera sees the sheet outline pts.
module mark(pts, d0 = 0) { intersection() { union() children(); prism(pts); front(d0); } }
// A straight bar of width w between two sheet points, as a prism through the model along the view.
module bar(a, b, w) {
  d = b - a;
  n = [-d[1], d[0]] / norm(d) * w / 2;
  prism([a + n, b + n, b - n, a - n]);
}
module crackLine(pts, w = 0.36) { for (i = [0 : len(pts) - 2]) bar(pts[i], pts[i + 1], w); }

// ---- thorny vines: a chain of thin capsules with a thorn at every other point, pointing outward
function nrm(v) = v / norm(v);
function perp(d) = nrm(abs(nrm(d)[2]) < 0.9 ? cross(d, [0, 0, 1]) : cross(d, [1, 0, 0]));
// a helix round the segment a -> b: [point, outward direction] pairs, radius r0 -> r1
function helix(a, b, r0, r1, turns, ph, n) = let(d = b - a, u = perp(d), w = cross(nrm(d), u))
  [for (i = [0 : n]) let(t = i / n, g = ph + 360 * turns * t, o = u * cos(g) + w * sin(g)) [a + d * t + (r0 + (r1 - r0) * t) * o, o]];
module vine(pv, r = 0.42) {
  for (i = [0 : len(pv) - 2]) limb(pv[i][0], pv[i + 1][0], r, r, vineC);
  for (i = [1 : 2 : len(pv) - 1]) let(d = pv[i][1] * 0.9 + [0, 0, 0.2])
    color(thornC) translate(pv[i][0] + pv[i][1] * r * 0.6) rotate(_dir_rot(d)) cylinder(h = norm(d), r1 = 0.26, r2 = 0.03, $fn = 4);
}

// ---- robe: a ragged djellaba, a hull of flattened ellipsoids cut to the sheet outline. Rings [z, rx, ry, cx, cy, rz]
ROBE = [[5.6, 11.0, 7.8, -1.6, 0.6, 1.2], [10, 9.4, 7.0, -1.2, 0.4, 1.2], [14.8, 6.0, 4.8, -0.4, 0, 1.0],
        [19, 6.8, 5.2, -0.5, 0, 1.2], [23, 8.0, 5.6, -1.0, 0.3, 1.5], [26.8, 5.6, 4.2, 0.4, 1.2, 1.4]];
robePts = [[-11.9, 6.6], [-9.5, 5.4], [-7.0, 5.8], [-4.5, 4.8], [-1.8, 3.6], [0.6, 4.8], [3.0, 4.4], [5.6, 5.4],
           [8.4, 5.6], [8.6, 8.5], [7.6, 12.0], [5.6, 14.2], [5.0, 17.0], [5.6, 20.0], [6.6, 23.0], [6.8, 26.0],
           [5.2, 28.8], [2.0, 28.5], [-1.0, 27.0], [-6.0, 25.5], [-9.5, 24.6], [-10.2, 22.5], [-8.2, 20.0],
           [-6.6, 17.0], [-6.4, 14.4], [-8.4, 12.4], [-10.6, 10.0], [-11.8, 8.2]];
module robeHull(g = 0) {
  hull() for (q = ROBE) translate([q[3], q[4], q[0]]) scale([q[1] + g, q[2] + g, q[5]]) sphere(1, $fn = 22);
}
module robeCut(g = 0) { intersection() { robeHull(g); prism(robePts); } }
color(robeC) robeCut();
// lighter fold streaks down the skirt
color(robeLt) intersection() {
  robeCut(0.2);
  union() for (a = [10 : 40 : 350]) rotate([0, 0, a]) translate([-0.35, 0, 4]) cube([0.7, 30, 10]);
}
// the torn hem: blunt flattened tatters hanging round the skirt's lower edge
function robeAt(z) = [for (k = [1 : 4]) lookup(z, [for (q = ROBE) [q[0], q[k]]])];
for (a = [0 : 30 : 330]) let(q = robeAt(5.6), p = [q[2] + q[0] * 0.9 * sin(a), q[3] - q[1] * 0.9 * cos(a), 4.8])
  color(robeC) translate(p) rotate([0, 0, -a]) rotate([0, (a % 60 == 0 ? 12 : -10), 0]) scale([1.4, 0.45, 1.9]) sphere(1, $fn = 8);

// glowing red cracks all over the robe (the prism runs through, so the back gets them too)
CRACKS = [
  [[-5.0, 13.0], [-4.5, 10.6], [-5.5, 8.0], [-5.0, 6.4]],
  [[-1.5, 13.6], [-1.0, 11.2], [-0.2, 10.4], [-1.1, 9.4], [-2.0, 8.0], [-2.7, 6.8]],
  [[-1.1, 9.4], [0.9, 8.0], [2.4, 6.9]],
  [[1.5, 13.6], [2.8, 12.0], [2.4, 10.8]],
  [[5.4, 9.4], [6.6, 8.2], [8.0, 7.0]],
  [[-5.0, 18.6], [-6.6, 19.8], [-7.6, 21.4], [-9.0, 22.6]],
  [[-5.0, 17.2], [-6.2, 16.0], [-6.0, 14.6]],
  [[-0.6, 18.0], [1.4, 18.6], [3.0, 17.6], [4.4, 18.4]],
  [[-0.7, 19.6], [1.4, 20.6], [2.4, 22.2], [4.0, 23.4]],
  [[-4.4, 21.4], [-5.2, 23.0], [-4.6, 24.4]],
  [[-9.6, 13.8], [-9.0, 11.6], [-10.2, 9.2]],
];
color(rune) intersection() { robeCut(0.22); union() for (c = CRACKS) crackLine(c); }
// the chest sigil: a glowing ring, its middle dark with a zigzag crack
SIG = [-2.85, 18.25];
function ring(rx, rz, n = 28) = [for (i = [0 : n - 1]) SIG + [rx * cos(360 * i / n), rz * sin(360 * i / n)]];
color(runeIn) mark(ring(2.0, 2.2), -4) robeHull(0.3);
color(rune) intersection() {
  robeHull(0.42);
  difference() { prism(ring(2.4, 2.65)); prism(ring(1.9, 2.15)); }
  front(-4);
}
color(rune) intersection() {
  robeHull(0.5);
  crackLine([[-2.6, 20.4], [-3.2, 19.3], [-2.4, 18.4], [-3.1, 17.2], [-2.7, 16.2]], 0.32);
  front(-4);
}

// ---- the woven sash: three-colour checks in two rows round the waist
for (row = [0, 1]) for (i = [0 : 15]) {
  c = [gold, sashR, sashG][(i + row) % 3];
  color(c) intersection() {
    robeCut(0.5);
    translate([-30, -30, 14.3 + row * 1.3]) cube([60, 60, 1.3]);
    rotate([0, 0, i * 22.5]) linear_extrude(height = 40) polygon([[0, 0], [30, 0], [30 * cos(22.5), 30 * sin(22.5)]]);
  }
}
// its end hanging down the creature's right side, checked gold / red / green
sashEndPts = [[-5.2, 15.8], [-7.5, 13.4], [-10.0, 11.6], [-12.4, 10.5], [-13.7, 9.6], [-13.0, 8.8], [-11.3, 9.0],
              [-9.5, 9.6], [-8.6, 8.6], [-7.8, 7.4], [-6.8, 7.6], [-6.6, 9.6], [-5.6, 11.6], [-4.4, 13.4], [-3.8, 14.8]];
SASH_D = -2.6;
pp(SASH_D) {
  plate(sashEndPts, 1.0, 0.25, gold);
  for (i = [0 : 15]) for (j = [0 : 10]) if ((i + j) % 3 != 0) {
    color((i + j) % 3 == 1 ? sashR : sashG) intersection() {
      plate(sashEndPts, 1.2, 0.25, sashR, grow = 0.4);
      translate([-14.5 + i * 0.75, -1, 6.5 + j * 0.85]) cube([0.75, 2, 0.85]);
    }
  }
}

// ---- head: hunched forward and low, the snout pointing down-left. Built in Clementar's head frame, then moved:
// headT() = translate(NECK + HT) rotate(HR) translate(-NECK)
NECK = [0, -2, 26.5];
HT = [0, -3.4, -2.2];
HR = [12, 0, 0];
module headT() { translate(NECK + HT) rotate(HR) translate(-NECK) children(); }
SKULL = [[0, -2.8, 30.0], [4.8, 4.2, 3.5]];
JAW = [[0, -4.6, 27.3], [3.0, 2.9, 2.2]];
RUFF = [[3.6, -3.6, 27.8], [1.9, 1.7, 1.6]];
MUZ1 = [[0, -6.0, 28.3], [2.4, 2.3, 1.95]];
MUZ2 = [[0, -9.4, 28.1], [1.15, 1.1, 0.9]];
NOSE = [[0, -10.4, 28.3], [0.75, 0.6, 0.55]];
LJAW = [[0, -5.2, 26.1], [0, -8.6, 24.7], 1.35, 0.75];
module skull(g = 0) {
  hull() {
    translate(SKULL[0]) scale(SKULL[1] + [g, g, g]) sphere(1, $fn = 26);
    translate(JAW[0]) scale(JAW[1] + [g, g, g]) sphere(1, $fn = 20);
  }
}
module muzzle(g = 0) {
  hull() {
    translate(MUZ1[0]) scale(MUZ1[1] + [g, g, g]) sphere(1, $fn = 18);
    translate(MUZ2[0]) scale(MUZ2[1] + [g, g, g]) sphere(1, $fn = 14);
  }
}
module ruffs(g = 0) { mirror_x() translate(RUFF[0]) scale(RUFF[1] + [g, g, g]) sphere(1, $fn = 20); }
module ljaw(g = 0) { limb(LJAW[0], LJAW[1], LJAW[2] + g, LJAW[3] + g); }
headT() {
  color(fur) skull();
  color(fur) muzzle();
  color(fur) ruffs();
  color(furLt) ljaw();
  // the mouth inside, dark red between the upper muzzle and the dropped jaw
  color(mouthC) hull() { translate([0, -6.4, 26.6]) scale([1.3, 1.4, 1.0]) sphere(1, $fn = 14); translate([0, -8.9, 26.0]) scale([0.85, 0.8, 0.75]) sphere(1, $fn = 10); }
  ell(NOSE[1], NOSE[0], noseC);
  // fangs: two long and two short above, two below
  mirror_x() {
    spike([0.7, -9.1, 27.4], [0, -0.15, -1.15], 0.3, 0.04, fang);
    spike([1.05, -7.6, 27.1], [0.05, -0.1, -0.8], 0.24, 0.04, fang);
    spike([0.55, -8.3, 25.2], [0, -0.15, 0.9], 0.24, 0.04, fang);
  }
  // cheek tufts: flattened lobes flaring out and down past the ruffs
  mirror_x() {
    petal([1.9, 0.55, 0.8], [4.7, -3.6, 27.3], [0, 35, -25], fur);
    petal([1.5, 0.5, 0.65], [3.9, -3.2, 25.8], [0, 55, -20], fur);
  }
  // eyes: glowing red slanted almonds, a hot pale centre, dark lids hooding them into a glare
  mirror_x() translate(EYE) scale(EYE_SQ) translate(-EYE)
    eye(EYE, EYE_S, iris = eyeIris, sclera = eyeRed, yaw = EYE_YAW, pupil = eyeHot, slit = 0.8, flat = 0.5, lid = 0.2, lid_tilt = 18,
        lid_c = furDk, squint = 0.15);
  // brows: dark ridges dropping towards the nose
  mirror_x() limb([0.9, -6.95, 31.05], [3.0, -5.95, 31.8], 0.38, 0.3, furDk);
}
EYE = [2.35, -6.0, 30.2];
EYE_S = 1.3;
EYE_YAW = 24;
EYE_SQ = [1.2, 1, 0.8];
// the lighter fur on the muzzle and under the eyes, on the camera-facing side
lightPts = [[-9.0, 25.6], [-6.6, 25.3], [-4.2, 25.4], [-2.0, 25.6], [0.4, 26.2], [1.6, 25.0], [-1.4, 24.2],
            [-3.4, 23.2], [-5.6, 24.0], [-8.4, 24.2]];
color(furLt) mark(lightPts, -6) headT() { skull(0.25); muzzle(0.25); ruffs(0.25); }
// a neck under the jaw, into the collar
ell([2.6, 2.4, 2.6], [0, -5.0, 23.6], fur);

// ---- ears: huge pointed plates traced off the sheet, each in the picture plane turned about its root (the far one
// turned to face forward, its outline pre-stretched so it still covers the art). Dark red inside, a bright streak.
module earAt(d, root, a, pts, inPts, hiPts) {
  pp(d) translate(root) rotate([0, 0, a]) scale([1 / cos(a), 1, 1]) translate(-root) {
    plate(pts, 1.0, 0.1, fur, grow = 0.3);
    translate([0, -0.45, 0]) plate(inPts, 0.3, 0.3, earIn, grow = 0.1);
    translate([0, -0.62, 0]) plate(hiPts, 0.3, 0.2, earHi, grow = 0);
    translate([0, 0.45, 0]) plate(inPts, 0.3, 0.3, [0.32, 0.07, 0.04], grow = -0.3);
  }
}
NEAR_EAR = [[-0.4, 33.4], [2.0, 35.6], [4.5, 37.4], [6.6, 38.6], [8.9, 39.6], [8.8, 37.5], [8.3, 35.4], [8.4, 34.0],
            [7.6, 32.6], [7.2, 31.2], [6.0, 30.2], [5.6, 29.0], [4.0, 29.4], [2.0, 30.6], [0.5, 31.8]];
NEAR_IN = [[1.8, 33.4], [4.2, 35.6], [7.6, 38.3], [7.4, 35.5], [6.8, 33.0], [5.4, 31.0], [3.8, 31.3]];
NEAR_HI = [[3.4, 33.4], [7.1, 37.3], [6.5, 34.0], [5.2, 32.3]];
FAR_EAR = [[-13.9, 40.0], [-11.6, 38.0], [-9.2, 36.0], [-7.0, 33.6], [-6.4, 32.0], [-7.0, 30.4], [-8.6, 28.8],
           [-9.6, 29.6], [-10.6, 31.0], [-11.8, 32.6], [-12.7, 34.6], [-13.2, 37.0]];
FAR_IN = [[-12.8, 38.4], [-10.6, 36.6], [-8.4, 34.4], [-7.6, 32.5], [-8.8, 30.6], [-10.2, 31.4], [-11.6, 33.6], [-12.4, 36.0]];
FAR_HI = [[-12.2, 37.6], [-9.4, 34.6], [-9.2, 32.4], [-10.6, 33.2]];
NEAR_ROOT = [2.6, 0, 31.0];
FAR_ROOT = [-7.6, 0, 31.0];
NEAR_D = -6.8;
FAR_D = -3.4;
NEAR_A = 15;
FAR_A = -38;
earAt(NEAR_D, NEAR_ROOT, NEAR_A, NEAR_EAR, NEAR_IN, NEAR_HI);
earAt(FAR_D, FAR_ROOT, FAR_A, FAR_EAR, FAR_IN, FAR_HI);

// ---- fez: upright on the crown (it does not nod with the head), a dark band, a jagged black crack edged in red
// down its near side and the green star outline on the front
FEZ = [-0.8, -6.0, 30.0];
module fez(g = 0) { translate(FEZ) rotate([-4, 0, 0]) cylinder(h = 6.6, r1 = 3.15 + g, r2 = 2.7 + g, $fn = 24); }
color(fezC) fez();
color(fezDk) translate(FEZ) rotate([-4, 0, 0]) cylinder(h = 0.6, r = 3.25, $fn = 24);
color(fezDk) translate(FEZ) rotate([-4, 0, 0]) translate([0, 0, 6.55]) cylinder(h = 0.15, r = 2.6, $fn = 24);
FEZ_CRACK = [[-2.2, 37.0], [-2.9, 35.6], [-2.3, 34.4], [-3.2, 33.0], [-2.6, 31.8], [-3.0, 30.3]];
color(rune) intersection() { fez(0.1); crackLine(FEZ_CRACK, 0.6); front(-6); }
color(ink) intersection() { fez(0.2); crackLine(FEZ_CRACK, 0.3); front(-6); }
STAR_C = [-5.0, 32.5];
STAR_R = 1.1;
function starP(i) = STAR_C + STAR_R * [cos(90 + 72 * i), sin(90 + 72 * i)];
color(star) intersection() { fez(0.15); union() for (i = [0 : 4]) bar(starP(i), starP(i + 2), 0.3); front(-6); }

// ---- arms: ragged green sleeves to the elbow, a bare furry forearm rising to the hand, a thorny vine round it.
// [shoulder, elbow, wrist, drape corners] per side; the far arm hangs lower and less far out (not a mirror).
ARM_L = [[6.5, -0.5, 22.2], [11.6, -1.5, 17.8], [15.0, -3.6, 22.8], [11.2, -1.3, 15.6], [7.4, -0.5, 16.4]];
ARM_R = [[-7.5, -0.5, 22.2], [-12.4, -1.5, 17.8], [-13.6, -3.2, 21.4], [-13.8, -1.5, 15.0], [-8.6, -0.5, 15.4]];
module sleeve(A) {
  color(robeC) hull() {
    translate(A[0]) sphere(3.0, $fn = 18);
    translate(A[1]) sphere(2.4, $fn = 16);
    translate(A[3]) sphere(1.0, $fn = 10);
    translate(A[4]) sphere(1.0, $fn = 10);
  }
  // tatters hanging off the cuff
  for (k = [0 : 2]) let(p = A[3] + (A[4] - A[3]) * (0.15 + 0.35 * k), s = A[1][0] > 0 ? 1 : -1)
    color(robeC) translate(p + [0, 0, -0.9]) rotate([0, s * (10 - 12 * k), 0]) scale([1.1, 0.5, 1.7]) sphere(1, $fn = 10);
}
module forearm(A) { limb(A[1] + [0, -0.2, 0.4], A[2], 1.35, 1.15, fur); }
// the hand: a palm cupped under the cluster, three fingers curling up the front of the fruit, a thumb
module hand(A, s) {
  w = A[2];
  color(fur) translate(w + [0, -0.4, 1.0]) scale([2.0, 1.8, 1.3]) sphere(1, $fn = 16);
  for (f = [[-1.4, -1.6, 2.6], [0, -2.0, 2.9], [1.4, -1.6, 2.6]]) limb(w + [s * f[0] * 0.6, -0.8, 1.2], w + [s * f[0], f[1], f[2]], 0.6, 0.45, fur);
  limb(w + [-s * 1.4, -0.6, 1.2], w + [-s * 2.0, -1.4, 2.4], 0.6, 0.45, fur);
}
module fruitAt(r, p) {
  color(fruitC) translate(p) sphere(r, $fn = 14);
  // the split: a pale-rimmed red window on the camera-facing side, a glowing seed in it
  translate(p) rotate([0, 0, 30]) {
    color(fruitRim) translate([0, -r * 0.82, 0.1]) scale([r * 0.6, r * 0.3, r * 0.68]) sphere(1, $fn = 12);
    color(fruitIn) translate([0, -r * 0.9, 0.1]) scale([r * 0.47, r * 0.25, r * 0.55]) sphere(1, $fn = 12);
    color(fruitSeed) translate([0, -r * 1.05, 0.1]) scale([r * 0.17, r * 0.12, r * 0.2]) sphere(1, $fn = 8);
  }
}
module leafAt(r, p, rot) { color(leaf) translate(p) rotate(rot) scale(r) sphere(1, $fn = 8); }
FRUIT_L = [[2.05, fromSheet(12.5, 30.2, -4.4)], [2.2, fromSheet(10.6, 27.4, -4.6)], [2.35, fromSheet(15.4, 27.4, -4.2)]];
FRUIT_R = [[2.15, fromSheet(-13.9, 27.6, -3.6)], [2.2, fromSheet(-18.1, 25.3, -3.0)], [2.2, fromSheet(-13.9, 24.4, -4.6)]];
LEAF_L = [[fromSheet(13.2, 32.6, -4.4), [0, -35, 30]], [fromSheet(15.0, 32.4, -4.2), [0, 30, 30]],
          [fromSheet(16.9, 30.0, -4.2), [0, 25, 30]], [fromSheet(11.6, 32.4, -4.4), [0, -60, 30]]];
LEAF_R = [[fromSheet(-17.2, 29.8, -3.2), [0, -30, 30]], [fromSheet(-15.4, 30.2, -3.4), [0, 35, 30]],
          [fromSheet(-13.9, 30.4, -3.6), [0, 60, 30]]];
module arm(A, F, L, s) {
  sleeve(A);
  forearm(A);
  hand(A, s);
  for (f = F) fruitAt(f[0], f[1]);
  for (l = L) leafAt([1.4, 0.4, 0.6], l[0], l[1]);
  vine(helix(A[1] + [0, -0.2, 0.6], A[2] + [0, 0, 0.6], 1.55, 1.4, 1.6, 40, 9));
}
arm(ARM_L, FRUIT_L, LEAF_L, 1);
arm(ARM_R, FRUIT_R, LEAF_R, -1);

// ---- legs and feet: thick furry legs below the hem, the far foot stepped out left, the near one out right
module foot(ankle, toe, hip) {
  color(fur) hull() {
    translate(ankle + [0, 0, 2.3]) sphere(2.0, $fn = 14);
    translate(toe + [0, 0, 1.2]) scale([1.8, 1.5, 1.2]) sphere(1, $fn = 14);
  }
  d = toe - ankle;
  side = [-d[1], d[0], 0] / norm([d[0], d[1], 0]);
  for (s = [-1, 0, 1]) color(furLt) translate(toe + nrm([d[0], d[1], 0]) * 0.6 + side * s * 1.2 + [0, 0, 0.8]) sphere(0.85, $fn = 8);
  limb(ankle + [0, 0, 2.4], hip, 2.1, 2.5, fur);
}
LEG_L = [[8.4, 1.5, 0], [11.6, -1.8, 0], [5.4, 0.6, 9.0]];
LEG_R = [[-7.0, -2.0, 0], [-11.4, -4.6, 0], [-4.4, -1.0, 9.0]];
foot(LEG_L[0], LEG_L[1], LEG_L[2]);
foot(LEG_R[0], LEG_R[1], LEG_R[2]);
vine(helix(LEG_L[0] + [0, 0, 2.0], LEG_L[2] + [0, 0, -2.5], 2.45, 2.6, 1.3, 70, 7));
vine(helix(LEG_R[0] + [0, 0, 2.0], LEG_R[2] + [0, 0, -2.5], 2.45, 2.6, 1.3, 200, 7));

// ---- the skirt vine: a thorny coil climbing round the robe from the near leg to the sash
function robeVine(n) = [for (i = [0 : n]) let(t = i / n, z = 5.6 + 8.4 * t, q = robeAt(z), g = -20 + 430 * t,
  o = [sin(g), -cos(g), 0]) [[q[2] + (q[0] + 0.35) * sin(g), q[3] - (q[1] + 0.35) * cos(g), z], o]];
vine(robeVine(18), 0.48);

// ---- tail: a huge bushy tail rising behind the creature's left side. A chain of round segments on the art's spine
// (sheet x, sheet z, depth, radius), 1.3 low for the camera's downward look; ragged lobes at the tip and outer edge.
TAIL = [[5.5, 10.5, 4.5, 3.0], [9.5, 8.9, 6.0, 3.9], [13.8, 9.8, 7.0, 4.5], [16.6, 12.6, 7.4, 4.2],
        [17.3, 15.9, 7.4, 3.5], [17.8, 18.8, 7.2, 2.7], [18.5, 21.2, 7.0, 1.6], [19.0, 22.6, 7.0, 0.7]];
function tailP(t) = fromSheet(t[0], t[1] - 1.3, t[2]);
module tailBody(g = 0) {
  for (i = [0 : len(TAIL) - 2]) hull() for (j = [i, i + 1])
    translate(tailP(TAIL[j])) scale([1, 0.9, 1]) sphere(TAIL[j][3] + g, $fn = 14);
}
color(tailC) tailBody();
TUFTS = [[[18.6, 21.6], [1.9, 1.2, 0.7], [0, -60, 30]], [[19.8, 19.4], [1.8, 1.4, 0.7], [0, -20, 30]],
         [[20.4, 15.4], [2.0, 1.6, 0.8], [0, 10, 30]], [[20.4, 11.6], [2.0, 1.6, 0.8], [0, 25, 30]],
         [[19.0, 7.4], [2.0, 1.6, 0.8], [0, 60, 30]], [[14.8, 5.8], [2.0, 1.6, 0.8], [0, 95, 30]],
         [[16.4, 21.4], [1.5, 1.1, 0.6], [0, -110, 30]], [[14.6, 18.0], [1.6, 1.3, 0.7], [0, -150, 30]]];
for (t = TUFTS) color(tailC) translate(fromSheet(t[0][0] - 1.0, t[0][1] - 1.3, 7.2)) rotate(t[2]) scale(t[1]) sphere(1, $fn = 8);
// two thorny vine rings round the tail
vine(helix(tailP(TAIL[1]) + [-0.6, 0, 0], tailP(TAIL[2]) + [0.6, 0, 0], 4.15, 4.6, 1.0, 0, 11));
vine(helix(tailP(TAIL[3]), tailP(TAIL[4]), 4.05, 3.45, 1.0, 90, 9));
