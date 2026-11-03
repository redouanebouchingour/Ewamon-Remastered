// Briarvaunt: Nettlewisp grown into a great spectral forest lion-stag, drawn in speckled translucent teal and moss.
// Checklist (front sheet, 40 units tall, feet on z 0):
// - body plan: a heavy lion on four thick legs, the body long along Y (chest sheet x -12, rump x 13, z 9..21),
//   walking: the far front leg reaches forward (paw sheet -17..-11), the near legs under the body (paws on z 0 here).
// - head: a lion's face turned a little towards the viewer, centre sheet (-5.6, 26), skull x -10..-1.5, z 22..30.5,
//   green brow, a pale mint face mask, two glowing teal almond eyes (x -7.5 and -3.8, z 26) with dark pupils under a
//   heavy slanted brow, a glowing teal nose (-5, 24.5), a dark mouth line with two small white fangs (z 22.7), dark
//   teal cheek ruff, a dark teal curling wisp crest on top (x -7..-5, z 30..34.6), leafy ears by the antler roots.
// - antlers: wide branching grey wood (sheet x -18.5..5.5, z 29..40), hung with glowing orbs (blue, lilac, cyan,
//   mint) and small leaves.
// - mane: big shaggy dark teal mane round the neck (x -14..5, z 17..30), soft lobes, lilac tips at both sides,
//   a green moss bib under the chin.
// - chest: a brown bark shield (x -12..-2, z 11..20.6) set with two mint gems and a big glowing cyan core.
// - body: teal with green moss leaf plates over the back, glowing cyan vein lines radiating over the shoulders
//   (strong on the back art), grey vine lines on the flanks.
// - legs: thick, blue-grey lower legs with pale glowing stripes curling round them, big paws with pale lilac claws.
// - tail: a big leafy plume curling up and back to the viewer's right (x 8..19.6, z 11..30), its tip curling inward.
// - motes: drifting orbs, pale cyan wisps and leaves around it.
// - back: the vein lines over the back, the tail root, the mane from behind.
include <lib.scad>

// the head block: translate(HC) rotate([0, 0, HY]), the face inside it scale(HS)
HC = [1.4, -12.5, 26.3];
HY = 20;
HS = 1.15;
EYE = [2.0, -4.1, -0.1];

teal = [0.39, 0.53, 0.53];
tealDark = [0.30, 0.44, 0.47];
tealDeep = [0.25, 0.37, 0.37];
legBlue = [0.46, 0.60, 0.64];
paleBlue = [0.56, 0.67, 0.74];
moss = [0.47, 0.67, 0.51];
mossPale = [0.56, 0.71, 0.62];
muzzleC = [0.62, 0.78, 0.68];
lilac = [0.69, 0.74, 0.87];
wood = [0.50, 0.52, 0.46];
vine = [0.41, 0.49, 0.40];
bark = [0.36, 0.27, 0.21];
ink = [0.06, 0.2, 0.19];
fang = [0.94, 0.97, 0.95];
leafC = [0.42, 0.66, 0.33, NOGLOW];
leafBrown = [0.62, 0.45, 0.25, NOGLOW];
eyeGlow = [0.3, 0.85, 0.76, GLOW];
irisGlow = [0.45, 0.96, 0.9, GLOW];
noseGlow = [0.28, 0.86, 0.74, GLOW];
veinC = [0.55, 0.92, 0.95, GLOW];
coreC = [0.5, 0.95, 1, GLOW];
gemC = [0.5, 0.95, 0.72, GLOW];
orbBlue = [0.5, 0.75, 1, GLOW];
orbLilac = [0.75, 0.66, 0.95, GLOW];
orbCyan = [0.55, 0.93, 0.95, GLOW];
orbMint = [0.62, 0.93, 0.74, GLOW];
wispC = [0.66, 0.88, 0.95, GLOW];

// A soft lobe / leaf: an ellipsoid from p along d, w wide, th thin (across the lobe), l long.
module lobe(p, d, l, w, th, c, fn = 12) {
  color(c) translate(p) rotate(_dir_rot(d)) translate([0, 0, l * 0.5]) scale([w, th, l * 0.5]) sphere(1, $fn = fn);
}
// A leaf / petal plate on a surface: rooted at p, lying across the normal n, its long axis running along f (projected
// onto the surface), its tip lifted `lift` degrees off it, l long, w wide, th thin.
module shingle(p, n, f, l, w, th, c, lift = 12, fn = 8) {
  nn = n / norm(n);
  f0 = f - (f * nn) * nn;
  ff = f0 / norm(f0);
  xx = cross(ff, nn);
  color(c) multmatrix([[xx[0], ff[0], nn[0], p[0]], [xx[1], ff[1], nn[1], p[1]], [xx[2], ff[2], nn[2], p[2]], [0, 0, 0, 1]])
    rotate([lift, 0, 0]) translate([0, l * 0.45, 0]) scale([w, l * 0.55, th]) sphere(1, $fn = fn);
}
// An ellipsoid with its own facet count (lib.scad's ell() is fixed at 28).
module el(r, p, c, fn = 18) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
// Glowing vein / stripe line.
module vein(pts, r = 0.36, c = veinC) { chain(pts, [for (p = pts) r], c); }

// ---- torso: a point on its surface at depth yy, `ang` round from the top towards +X
function torsoPt(yy, ang, k = 1.02) = [6.6 * k * sin(ang), yy, 15.2 + 6.3 * k * cos(ang)];
module leafOn(yy, ang, l, w, c) {
  color(c) translate(torsoPt(yy, ang, 0.97)) rotate([0, ang, 0]) rotate([8, 0, 0]) scale([w, l, 0.55]) sphere(1, $fn = 12);
}

// hull of ellipsoids at a lower facet count than lib.scad's blob()
module hullEl(parts, fn = 24) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn);
module torso(g = 0) hullEl([[[6.3 + g, 6 + g, 6.3 + g], [0, -11, 15.5]], [[6.6 + g, 7 + g, 6.2 + g], [0, -1, 15.2]], [[6.2 + g, 6.5 + g, 6 + g], [0, 9.5, 14.8]]]);
module mossCap(g = 0) hullEl([[[5.3 + g, 6 + g, 6.5 + g], [0, -11, 15.8]], [[5.7 + g, 7 + g, 6.5 + g], [0, -1, 15.5]], [[5.3 + g, 6.5 + g, 6.3 + g], [0, 9.5, 15.0]]]);
color(teal) torso();
// Moss over the back: a green cap on the torso's top, a few soft leaf plates along its edge.
color(moss) mossCap();
mirror_x() for (i = [0 : 3]) leafOn(-8 + i * 6, 46 + (i % 2) * 8, 3.2, 2.2, i % 2 == 0 ? mossPale : moss);
// Glowing veins: flush stripes where tilted thin slabs cut the body's skin, chevrons running back and down from the
// mane over the shoulders, back and haunches (the back art's willow streaks).
mirror_x() color(veinC) intersection() {
  union() { torso(0.3); mossCap(0.3); }
  union() for (c0 = [7, 9.4, 11.8, 14.2]) rotate([40, 0, 0]) translate([0, c0, 0]) cube([40, 0.42, 60], center = true);
  translate([10.3, 0, 22]) cube([20, 60, 20], center = true);
}

// ---- legs: [shoulder / hip, wrist / hock, paw]; the far front leg (-X) reaches forward
LEGS = [
  [[4.3, -10, 14], [4.5, -11, 6], [4.5, -11.4, 1.9]],
  [[-4.3, -10, 14], [-5.5, -14.8, 6], [-5.8, -16.6, 1.9]],
  [[4.6, 9, 14], [5, 12.5, 6.5], [5, 10.6, 1.9]],
  [[-4.6, 9, 14], [-5, 12.5, 6.5], [-5, 10.6, 1.9]],
];
function legAxis(L, z) = z > L[1][2] ? L[1] + (L[0] - L[1]) * ((z - L[1][2]) / (L[0][2] - L[1][2]))
  : L[2] + (L[1] - L[2]) * ((z - L[2][2]) / (L[1][2] - L[2][2]));
function legR(L, z) = z > L[1][2] ? 2.7 + 0.7 * (z - L[1][2]) / (L[0][2] - L[1][2]) : 2.5 + 0.2 * (z - L[2][2]) / (L[1][2] - L[2][2]);
module leg(L) {
  h = L[0]; k = L[1]; f = L[2];
  limb(h, k, 3.7, 2.9, teal, $fn = 16);
  limb(k, f, 2.9, 2.7, legBlue, $fn = 16);
  el([3.3, 3.9, 1.9], [f[0], f[1] - 0.7, f[2]], legBlue, 16);
  // pale claws on four toes
  for (t = [-1.5, -0.5, 0.5, 1.5]) color(lilac) translate([f[0] + t * 1.3, f[1] - 3.8 - (abs(t) < 1 ? 0.3 : 0), 0.7]) scale([0.55, 0.8, 0.6]) sphere(1, $fn = 10);
  // thin glowing teal vein lines running down the leg, flush on its skin
  color(veinC) intersection() {
    union() { limb(h, k, 3.92, 3.12, $fn = 16); limb(k, f, 3.12, 2.92, $fn = 16); }
    union() for (t = [28, -28]) translate(k) rotate([0, 0, t]) cube([0.34, 40, 40], center = true);
    translate([k[0], k[1], (h[2] - 2.5) / 2 + 1]) cube([14, 14, h[2] - 2.5], center = true);
  }
}
for (L = LEGS) leg(L);

// ---- mane: one big soft mass flowing from behind the head down over the shoulders, covered in overlapping leaf
// plates that hang down and back, lighter green on top, teal lower down, a few lilac tips at the sides
MANE_E = [[[9.0, 7.0, 7.0], [0, -8, 23.2]], [[8.8, 6.2, 5.4], [0, -4.5, 18.6]]];
MANE_ROWS = [[0, 72], [0, 48], [0, 24], [0, 0], [0, -24], [1, 0], [1, -26]];
color(moss) hullEl(MANE_E, 22);
function manePt(E, e, a) = E[1] + [E[0][0] * cos(e) * sin(a), -E[0][1] * cos(e) * cos(a), E[0][2] * sin(e)];
function maneN(E, e, a) = [cos(e) * sin(a) / E[0][0], -cos(e) * cos(a) / E[0][1], sin(e) / E[0][2]];
for (ri = [0 : len(MANE_ROWS) - 1], j = [0 : 11]) {
  E = MANE_E[MANE_ROWS[ri][0]];
  e = MANE_ROWS[ri][1];
  a = j * 30 + (ri % 2) * 15;
  p = manePt(E, e, a);
  n = maneN(E, e, a);
  if (norm(p - HC) > 6.2 && !(MANE_ROWS[ri][0] == 1 && cos(a) > 0.6))
    shingle(p - 0.3 * n / norm(n), n, [0, 0.35, -1], 4.6, 2.4, 0.55,
      e >= 48 ? (j % 2 == 0 ? mossPale : moss) : e >= 0 ? (abs(sin(a)) > 0.9 && e == 0 && j % 2 == 1 ? lilac : (j % 2 == 0 ? moss : teal))
        : (j % 2 == 0 ? teal : tealDark), 14);
}
// green moss bib under the chin, above the chest shield
el([5, 3.2, 3.6], [0.8, -13.6, 20.2], moss, 16);
for (x = [-3, 0, 3]) lobe([x + 0.8, -15.6, 19.5], [x * 0.15, -0.6, -1], 2.4, 1.5, 0.7, x == 0 ? mossPale : moss);

// ---- chest: the bark shield laid on the chest, the glowing core and two gems
SHIELD = [[-11.6, 20.2], [-7, 20.8], [-2.4, 20.2], [-2, 17], [-3.4, 13.5], [-5.5, 11.8], [-7.2, 11.3], [-9, 11.8], [-11, 13.5], [-12.2, 17]];
color(bark) intersection() { ell([7.0, 6.7, 7.0], [0, -11, 15.5]); prism(SHIELD); }
// The chest ell in sheet coordinates: centre (-5.5, depth -9.53, 15.5); a point on the shield's face.
function onShield(sx, z) = let(dx = sx + 5.5, dz = z - 15.5) [sx, -9.53 - 6.9 * sqrt(max(0.05, 1 - (dx * dx + dz * dz) / 49)), z];
pp(0) {
  color(coreC) translate(onShield(-7.3, 16.3)) scale([1.25, 0.8, 1.35]) sphere(1, $fn = 14);
  for (r = [0 : 90 : 270]) color(coreC) translate(onShield(-7.3 + 1.6 * cos(r), 16.3 + 1.6 * sin(r))) scale([cos(r) == 0 ? 0.25 : 0.6, 0.3, cos(r) == 0 ? 0.6 : 0.25]) sphere(1, $fn = 8);
  color(gemC) translate(onShield(-10.1, 18.1)) scale([0.8, 0.6, 0.9]) sphere(1, $fn = 12);
  color(gemC) translate(onShield(-4.9, 18.1)) scale([0.8, 0.6, 0.9]) sphere(1, $fn = 12);
}

// ---- head: a block turned HY towards the viewer, its own frame facing -Y
module antler() {
  A = [[2.6, 0.6, 4.1], [5.0, 1.0, 5.2], [8.0, 1.4, 6.8], [10.8, 1.4, 8.6], [12.6, 1.2, 11.2]];
  chain(A, [1.2, 1.05, 0.85, 0.65, 0.4], wood);
  chain([A[1], [5.4, 0.6, 8.8], [6.0, 0.2, 11.6]], [0.7, 0.55, 0.35], wood);
  chain([A[2], [8.6, 1.2, 10.0], [9.0, 0.8, 12.4]], [0.65, 0.5, 0.32], wood);
  chain([A[3], [12.8, 1.6, 7.8], [14.0, 1.6, 8.6]], [0.55, 0.42, 0.28], wood);
  chain([A[1], [3.8, 0.8, 8.0], [3.6, 0.6, 9.8]], [0.6, 0.45, 0.3], wood);
  color(orbBlue) translate([6.2, 0, 12.5]) sphere(0.85, $fn = 10);
  color(orbCyan) translate([12.9, 1.0, 12.1]) sphere(0.75, $fn = 10);
  color(orbLilac) translate([4.4, 0.2, 4.0]) sphere(0.9, $fn = 10);
  color(orbLilac) translate([14.5, 1.6, 9.4]) sphere(0.7, $fn = 10);
  color(orbCyan) translate([10.4, 0.4, 7.4]) sphere(0.75, $fn = 10);
  color(orbMint) translate([9.2, 0.6, 13.2]) sphere(0.65, $fn = 10);
  color(orbCyan) translate([7.4, 0.6, 5.6]) sphere(0.95, $fn = 10);
  color(orbBlue) translate([3.5, 0.4, 10.6]) sphere(0.6, $fn = 10);
  lobe([6.8, 1.2, 6.4], [0.2, -0.6, 1], 1.6, 0.7, 0.25, leafC, 10);
  lobe([8.8, 1.1, 10.4], [-0.8, -0.4, 0.6], 1.5, 0.6, 0.25, leafC, 10);
  lobe([11.6, 1.4, 8.8], [0.4, -0.6, 1], 1.4, 0.6, 0.25, leafC, 10);
  lobe([5.3, 0.8, 8.2], [0.9, -0.5, 0.4], 1.4, 0.6, 0.25, leafC, 10);
  lobe([12.2, 1.2, 11.0], [-0.6, -0.4, 0.8], 1.3, 0.55, 0.25, leafC, 10);
  lobe([3.8, 0.8, 7.2], [-0.9, -0.5, 0.4], 1.3, 0.55, 0.25, leafC, 10);
}
translate(HC) rotate([0, 0, HY]) {
 scale(HS) {
  // a broad lion skull in green-teal fur, a strong brow, a straight nose bridge and a firm, longer muzzle
  el([4.9, 4.3, 4.3], [0, 0, 0], moss, 24);
  mirror_x() color(moss) translate([1.9, -3.75, 0.95]) rotate([0, -18, 12]) scale([1.9, 1.0, 0.7]) sphere(1, $fn = 14);
  limb([0, -3.6, 0.6], [0, -6.2, -1.3], 1.0, 0.85, mossPale, $fn = 14);
  el([2.2, 2.4, 1.7], [0, -4.6, -2.4], mossPale, 18);
  el([1.5, 1.7, 0.9], [0, -4.8, -3.9], muzzleC, 14);
  // dark nose, a dark mouth line and two small fangs
  color(ink) translate([0, -6.95, -1.5]) rotate([-20, 0, 0]) scale([0.85, 0.5, 0.5]) sphere(1, $fn = 12);
  color(ink) translate([0, -6.6, -3.35]) scale([1.3, 0.35, 0.2]) sphere(1, $fn = 12);
  mirror_x() spike([0.8, -6.5, -3.2], [0, -0.1, -0.85], 0.28, 0.05, fang);
  // fierce almond eyes under dark slanted brows
  mirror_x() eye(EYE, 0.9, iris = irisGlow, sclera = eyeGlow, pupil = ink, yaw = 14, lid = 0.3, lid_tilt = 24, lid_c = tealDeep, slit = 0.55, shine = false);
  // dark teal cheek ruff framing the face
  mirror_x() {
    lobe([4.0, -1.8, -1.0], [1, 0.1, -0.4], 3.0, 2.0, 0.8, mossPale);
    lobe([3.4, -2.4, -2.8], [0.7, 0, -1], 2.8, 1.8, 0.8, moss);
    lobe([4.4, -0.4, 1.0], [1, 0.3, 0.2], 2.8, 1.8, 0.8, moss);
  }
  // the dark teal curling wisp crest
  chain([[0, -1.0, 3.8], [0.2, -0.8, 5.6], [-0.3, -0.6, 6.8], [-1.2, -0.4, 7.6], [-1.8, -0.4, 7.3]], [0.95, 0.75, 0.55, 0.4, 0.28], tealDeep);
  // leafy ears below the antler roots
  mirror_x() lobe([4.2, 0.4, 2.4], [1, 0.45, 0.5], 2.6, 1.3, 0.5, moss);
 }
  mirror_x() antler();
}

// ---- tail: a big leafy plume curling up and back to the creature's left, the tip curling inward
TAIL = [[1.7, 14, 16.5], [5.2, 16, 12.8], [8.6, 17.5, 12.2], [10.2, 18, 15.4], [10.3, 18, 19.4], [9.3, 18, 23.4], [7.3, 17.5, 25.2],
  [4.8, 17, 24.4], [4.2, 16.5, 21.2], [6.0, 16.5, 19.6]];
TAIL_R = [1.8, 2.2, 2.6, 2.9, 3.0, 2.8, 2.4, 1.9, 1.4, 1.0];
// a slim core under a broad plume of thick leaf plates fanning along the curve, flat in the tail's plane (normal TN)
TN = [-0.375, 0.927, 0];
TC = [7.2, 17.2, 18.8];
chain(TAIL, [for (r = TAIL_R) r * 0.6], legBlue, $fn = 10);
for (i = [0 : 8], j = [0 : 4]) {
  p = TAIL[i];
  tg0 = TAIL[i + 1] - TAIL[max(i - 1, 0)];
  tg = tg0 / norm(tg0);
  o0 = (p - TC) - ((p - TC) * tg) * tg;
  o1 = o0 - (o0 * TN) * TN;
  o = o1 / norm(o1);
  phi = [-55, -22, 10, 40, 70][j];
  shingle(p + TN * (j % 2 == 0 ? -0.45 : 0.45), TN, tg * cos(phi) + o * sin(phi), 3.4 + TAIL_R[i] * 0.9, 0.9 + TAIL_R[i] * 0.35, 0.85,
    (i + j) % 4 == 0 ? moss : ((i + j) % 4 == 1 ? paleBlue : ((i + j) % 4 == 2 ? legBlue : mossPale)), 6);
}
lobe(TAIL[2] + [0, -1, -1.8], [0.4, -0.5, -1], 1.6, 0.7, 0.25, leafC, 10);
lobe(TAIL[5] + [0, -1, 2], [-0.3, -0.5, 1], 1.6, 0.7, 0.25, leafC, 10);

// ---- motes: drifting orbs, pale wisps and leaves (their own joint in the rig)
color(orbLilac) translate([10.4, -2, 29.5]) sphere(1.0, $fn = 10);
color(orbBlue) translate([6.9, -2, 34.3]) sphere(0.75, $fn = 10);
color(orbBlue) translate([-13.3, -14, 22]) sphere(0.6, $fn = 10);
color(wispC) translate([-14.2, -12, 14]) scale([0.9, 0.7, 1.6]) sphere(1, $fn = 10);
color(wispC) translate([-10, -15, 12.5]) scale([0.7, 0.6, 1.2]) sphere(1, $fn = 10);
color(wispC) translate([16.2, 4, 9.5]) scale([0.7, 0.6, 1.3]) sphere(1, $fn = 10);
lobe([-12.7, -10, 9.4], [0.5, 0, 1], 1.6, 0.8, 0.3, leafC, 10);
lobe([15, 2, 8.2], [0.6, 0, 1], 1.6, 0.7, 0.3, leafBrown, 10);
lobe([16.4, -4, 2.2], [1, 0, 0.4], 1.6, 0.8, 0.3, leafC, 10);
