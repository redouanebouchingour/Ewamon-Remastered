// Rambull: a buff cream ram standing on two legs like a bodybuilder (sprite-match 2026-11-04).
// Checklist (front sheet, 40 units tall):
// - head small on a huge body: long pink-cream sheep face, snout down-left at sheet (-10, 28.5), one half-closed smug
//   eye at (-3, 32) (dark heavy lid), pink nostrils, a smirk curling up the near cheek at z 27.5;
//   wool fringe over the brow and two wool puffs on top over the horn roots (sheet -10..-7 and -2..4, z 36..40)
// - great grey ram horns: the near one a full curl facing the viewer, centre (3.5, 32.7), outer x -1.5..8, z 27..38,
//   the far one seen edge-on left of the head (x -11.5..-9, z 33..37) with its tip flaring out to x -15.6 at z 29;
//   a drooping tan ear with a pink inside lies in each curl
// - torso: barrel chest x -11..12, z 10..30, a fluffy light wool bib in a V down the front (collar to z 15), muscular
//   pecs, a round belly; wool on the shoulders and a shag down the back; round glutes on the back view
// - arms: huge deltoids, biceps and forearms hanging out wide, dark hoof hands at z 8..12
// - legs: cream thighs, tan shins, dark hooves; the -X leg planted (sheet x -6), the +X leg stepping with the knee
//   forward (knee sheet (1.5, 5.5), hoof (3.5, 2)). The art draws a third hoofed leg under the near arm (sheet
//   x 13..16); a biped has two, so it is left out.
include <lib.scad>

wool = [0.93, 0.83, 0.65];
muscle = [0.84, 0.69, 0.5];
shin = [0.76, 0.6, 0.44];
hoof = [0.35, 0.25, 0.19];
face = [0.95, 0.83, 0.72];
nose = [0.62, 0.38, 0.35];
earC = [0.72, 0.55, 0.41];
earIn = [0.88, 0.62, 0.55];
horn = [0.38, 0.36, 0.32];
ridge = [0.28, 0.26, 0.23];
ink = [0.12, 0.08, 0.07];

// A soft wool lobe: a flattened sphere pressed onto a surface, its flat side along the normal n.
module puff(p, r, n = [0, -1, 0], k = 0.6, c = wool) {
  color(c) translate(p) rotate(_dir_rot(n)) scale([r, r, r * k]) sphere(1, $fn = 16);
}
// The ink line along the edge of eye()'s lid (same numbers as the eye() call, an eye on the +X side).
module lashLine(p, size, yaw, lid, lid_tilt) {
  color(ink) translate(p) rotate([0, 0, yaw]) intersection() {
    scale([1.16, 0.92, 1.17]) sphere(size, $fn = 20);
    rotate([12, -lid_tilt * 1.25, 0]) translate([-3 * size, -3 * size, size * (1.15 - 2.3 * lid) - 0.14]) cube([6 * size, 6 * size, 0.3]);
  }
}
EYE = [2.65, -3.75, 1];
// A wool lock: a long flattened round-ended pad hanging from p on a surface whose outward normal is n (horizontal),
// its top sunk in the surface and its lower end tipped a little outward. Overlapping, they make a shingled ragged
// wool edge. Low-poly: there are dozens.
module lock(p, n, len, w) {
  color(wool) translate(p) rotate([0, 0, atan2(n[1], n[0]) - 90]) rotate([15, 0, 0]) translate([0, 0, -0.4 * len])
    scale([w, 0.5 * w, 0.6 * len]) sphere(1, $fn = 12);
}
// Locks round a vertical axis at (c.x, c.y): radius r, height z, at the azimuths azs (0 = +X, 90 = +Y back); every
// other one sits a little higher and shorter so the edge is ragged, not a row of teeth.
function ring(c, r, z, azs, len, w) = [for (i = [0 : len(azs) - 1]) let(a = azs[i], k = i % 2)
  [[c[0] + r * cos(a), c[1] + r * sin(a), z + 0.7 * k], [cos(a), sin(a), 0], len * (1 - 0.2 * k), w * (1 - 0.1 * k)]];
// A cheaper ellipsoid for the mostly hidden muscle masses.
module ell2(r, p, c, fn = 18) color(c) translate(p) scale(r) sphere(1, $fn = fn);
// A point on an ellipsoid's surface in the direction d (ellipsoid-space).
function onE(r, c, d) = let(u = d / norm(d)) c + [r[0] * u[0], r[1] * u[1], r[2] * u[2]];

// ---- Torso: barrel chest, round belly, traps (muscle); the wool is painted onto it flush.
TORSO = [[[10.5, 7.5, 7], [0, 0, 22]], [[9.8, 8, 6.5], [0, 0.4, 15.5]], [[8, 5, 4], [0, 2, 28.5]]];
PEC = [[5.2, 1.8, 3.4], [4.6, -5.9, 23.2]];
module torso(g = 0) blob([for (e = TORSO) [e[0] + [g, g, g], e[1]]], muscle);
module pecs(g = 0) mirror_x() ell2(PEC[0] + [g, g, g], PEC[1], muscle);
torso();
pecs();
// Glutes (the back view's round rump).
mirror_x() ell2([5.4, 3.4, 5], [3.6, 5.2, 14], muscle, 22);
// Wool bib: a ragged V from the collar down the chest (front sheet outline), painted on the chest and pecs.
BIB = [[-11.5, 27], [-8, 30], [-2, 30], [4, 29.5], [7, 27.5], [5.6, 25.5], [6.2, 24.2], [4.4, 22.6], [5, 21.2],
  [3.2, 19.8], [3.6, 18.2], [1.8, 17.2], [1.6, 15.4], [0, 14.6], [-1.2, 12.8], [-2.4, 14.8], [-4.2, 14.6], [-4.6, 16.6],
  [-6.8, 16.8], [-7, 18.8], [-9.2, 19.4], [-9.4, 21.4], [-11.5, 22.2]];
color(wool) intersection() {
  union() { torso(0.35); pecs(0.35); }
  prism(BIB);
  translate([-30, -30, 0]) cube([60, 30, 40]);
}
// Wool over the traps and the upper back, its lower edge scalloped.
color(wool) intersection() {
  torso(0.35);
  union() {
    translate([-30, -1.5, 24.5]) cube([60, 30, 20]);
    for (x = [-9 : 3.6 : 9]) translate([x, 7, 24.5]) sphere(2.4, $fn = 16);
  }
}
// The fluffy ruff under the chin, with locks hanging off it.
RUFF = [[6.6, 3, 2.2], [-1, -4.8, 27.4]];
ell2(RUFF[0], RUFF[1], wool);
// Locks: the chin ruff, the bib's ragged V edge down the chest, the mantle's edge on the back.
BODY_LOCKS = concat(
  ring([-1, -4.8], 3.2, 26.8, [-150, -120, -90, -60, -30], 3.2, 2.2),
  [for (d = [[-0.8, -1, 0.3], [-0.55, -1, -0.05], [-0.3, -1, -0.45], [0.3, -1, -0.45], [0.5, -1, -0.05], [0.7, -1, 0.3]])
    [onE(TORSO[0][0] + [-0.3, -0.3, -0.3], TORSO[0][1], d), [d[0], d[1], 0], 3.6, 2.2]],
  ring([0, 1], 7.2, 25.4, [35, 60, 90, 120, 145], 3.6, 2.4));
for (l = BODY_LOCKS) lock(l[0], l[1], l[2], l[3]);

// ---- Arms: deltoid, biceps, forearm, dark hoof hand.
// Shoulder, biceps and forearm as separate bulges, a wool cap on the shoulder and locks hanging over each mass.
ARM_LOCKS = concat(
  ring([12.4, 0.5], 4.2, 24.6, [-120, -75, -30, 15, 60, 105], 4.5, 2.2),
  ring([14.6, -1], 3.2, 19.4, [-100, -50, 0, 50], 3.6, 1.9),
  ring([15.4, -1.6], 3.1, 15.4, [-70, -15, 40], 3, 1.6));
mirror_x() {
  ell2([4.4, 4.4, 4], [12.4, 0.5, 25], wool);
  ell2([3.6, 3.7, 4], [14.6, -1.4, 20.3], wool);
  limb([12.6, 0.5, 24], [14.6, -0.8, 18.5], 3.3, 3, wool, $fn = 18);
  ell2([3.5, 3.3, 3.6], [15.6, -1.4, 15.2], wool);
  limb([15, -1, 17], [14.8, -3, 12], 2.9, 2.3, wool, $fn = 18);
  ell([4.7, 4.7, 3.4], [12.4, 0.6, 25.8], wool);
  for (l = ARM_LOCKS) lock(l[0], l[1], l[2], l[3]);
  ell([2.7, 2.6, 2.2], [14.7, -3.2, 11], hoof);
  color(hoof) translate([14.7, -3.2, 8.4]) cylinder(h = 2.6, r1 = 2.4, r2 = 2.6, $fn = 18);
}

// ---- Legs: the -X one planted, the +X one stepping with its knee forward.
ell2([4.8, 5, 5.5], [-5.8, 0.5, 12], muscle, 22);
limb([-6.6, 0.5, 8.5], [-7.4, -0.2, 2.4], 2.5, 1.8, shin);
color(hoof) translate([-7.4, -0.3, 0]) cylinder(h = 2.4, r1 = 2.2, r2 = 1.9, $fn = 18);
ell2([4.8, 5, 5.5], [5.5, 0, 12], muscle, 22);
limb([5.5, -0.5, 11], [4.6, -5, 6], 3.8, 2.6, muscle);
limb([4.6, -5, 6], [5.6, -3, 2.4], 2.3, 1.8, shin);
color(hoof) translate([5.7, -3, 0]) cylinder(h = 2.4, r1 = 2.2, r2 = 1.9, $fn = 18);

// ---- Head (local frame: centre of the skull, facing -Y), tipped snout-down and turned a little to -X.
HP = [-0.6, -4.6, 33.4];
HR = [3, 0, -15];
HK = 1.28;
cran = [[3.4, 3.8, 3.6], [0, 0.5, 0.6]];
mid = [[3.3, 3, 3.2], [0, -3.5, -0.7]];
muz = [[2.5, 3, 2.5], [0, -7.2, -2.7]];
// The horn coil: centre C, axis A (outward and forward), plane S (outward-back) x U (up).
HC = [6.6, 2.4, -0.5];
HA = [cos(-30), sin(-30), 0];
HS = [sin(30), cos(30), 0];
function hornPt(t) = let(th = 140 - 320 * t, r = 4.3 - 1.4 * t, w = -3.4 + 3.6 * t + 4 * pow(t, 5))
  HC + r * (cos(th) * HS + sin(th) * [0, 0, 1]) + w * HA;
HN = 16;
hornPts = [for (i = [0 : HN]) hornPt(i / HN)];
hornRs = [for (i = [0 : HN]) 2.05 - 1.5 * pow(i / HN, 1.4)];

translate(HP) rotate(HR) scale(HK) {
  blob([cran, mid, muz], face);
  // Nostrils and the smirk (curling up towards the near cheek).
  mirror_x() color(nose) translate(onE(muz[0], muz[1], [0.35, -0.9, 0.12])) scale([0.38, 0.3, 0.3]) sphere(1, $fn = 12);
  chain([for (d = [[-0.4, -0.8, -0.55], [0.05, -0.85, -0.6], [0.45, -0.72, -0.5], [0.75, -0.48, -0.32]]) onE(muz[0] * 0.99, muz[1], d)],
    [0.2, 0.22, 0.22, 0.18], ink);
  // Half-closed smug eyes under a dark heavy lid.
  mirror_x() {
    eye(EYE, 0.95, sclera = [0.9, 0.88, 0.84], iris = [0.32, 0.27, 0.24], pupil = [0.05, 0.04, 0.04], yaw = 34, flat = 0.6,
      lid = 0.5, lid_tilt = 14, lid_c = face, shine = true);
    lashLine(EYE, 0.95, 34, 0.5, 14);
  }
  // Wool: a low flat cap on the crown with a ragged fringe of small lobes over the brow, the back of the head.
  ell([3.3, 3.4, 1.4], [0, -0.4, 3.7], wool);
  for (p = [[-2.3, -2.9, 3.3], [0, -3.4, 3.4], [2.3, -2.9, 3.3]]) ell2([1.4, 1.1, 0.9], p, wool, 14);
  ell2([3.2, 2.4, 3], [0, 3, 1], wool);
  mirror_x() {
    // Drooping ear inside the curl.
    petal([1.9, 0.55, 0.85], [4.2, 2, -0.5], [0, 15, 40], earC);
    petal([1.4, 0.3, 0.55], [4.45, 1.7, -0.5], [0, 15, 40], earIn);
    // The horn and its ridges.
    chain(hornPts, hornRs, horn, $fn = 14);
    for (i = [1 : 2 : HN - 3]) color(ridge) translate(hornPts[i]) sphere(hornRs[i] * 1.05, $fn = 10);
  }
}
