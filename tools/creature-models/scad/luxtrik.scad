// Luxtrik: a crouched olive mantis-locust overgrown with moss. Checklist from the sprite (sheet x, z):
// - head: a small wedge face pointing down-forward at (-11..-3, 10..19), turned to the creature's right; one big round
//   dark olive compound eye on its side at (-5.2, 13.6) with a pale highlight (the far eye hidden behind the face),
//   a lighter forehead, two short palps pointing down under the face (-10, 9) and (-7, 8.5).
// - two long arching twig antennae (bark brown) with tiny leaves and pink buds: peaks near (-13, 27.5), tips (-22, 21)
//   and (-19, 13).
// - body: a plated thorax (-4..6, 13..24) with moss knobs on top, a long segmented abdomen behind (the back art shows
//   it as stacked plates), dark brown underside showing in every gap.
// - wings: two pairs of big translucent yellow-green leaf wings with dark veins, raised and spread: forewing tips
//   (-11, 40) far and (21, 38) near, hindwing tip (22, 28) near (the far hindwing behind the far forewing).
// - forelegs: thick segmented mantis arms with three-pronged claws; the near one braced on the ground (claw -4..2,
//   z 0..6), the far one raised forward (claw -21..-16, z 4..9). Small spines with pink buds.
// - middle legs: thin dark twig legs under the body (9..15, 8..13).
// - hind legs: big spiky segmented clubs swept back, the near one (5..20, 8..20) ending in a point (19.5, 9).
// - moss sprouts with buds rising off the back between the wings (-2..13, 27..37).
include <lib.scad>

olive = [0.51, 0.48, 0.19];
oliveLight = [0.66, 0.63, 0.23, NOGLOW];
oliveDark = [0.36, 0.35, 0.16];
under = [0.21, 0.18, 0.14];
bark = [0.29, 0.24, 0.17];
wingC = [0.74, 0.72, 0.26, NOGLOW];
veinC = [0.29, 0.26, 0.06];
leafC = [0.59, 0.57, 0.18, NOGLOW];
bud = [0.86, 0.62, 0.5, NOGLOW];
eyeC = [0.42, 0.55, 0.15];
eyeRim = [0.12, 0.1, 0.06];
faceC = [0.57, 0.55, 0.2];

// Ellipsoid with its own resolution (small parts stay cheap).
module e(r, p, c, fn = 14) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
// A lobed segment between two points: an ellipsoid along a -> b, so the creases between segments read as plates.
module seg(a, b, r, c, fn = 16) {
  d = b - a;
  color(c) translate((a + b) / 2) rotate(_dir_rot(d)) scale([r, r, norm(d) / 2 + 0.5]) sphere(1, $fn = fn);
}
module leaf(p, d, w, c = leafC) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) translate([0, 0, l / 2]) scale([w, w * 0.35, l / 2]) sphere(1, $fn = 8);
}
module budAt(p, r = 0.5) { color(bud) translate(p) sphere(r, $fn = 8); }
// Moss knob with a pink bud.
module nub(p, r = 1.3) {
  e([r, r, r * 0.8], p, oliveLight, 10);
  budAt(p + [0, 0, r * 0.75], 0.42);
}
// A spine with a pink bud at its tip.
module spine(p, d, r = 0.55) {
  spike(p, d, r, 0.15, oliveDark);
  budAt(p + d, 0.38);
}

// ---- Body.
// Dark core: the underside and every crease between plates.
e([4.3, 4.6, 4.2], [0, -3, 16.4], under, 18);
limb([0, -0.5, 15.8], [0, 16.8, 10.6], 2.2, 1.0, under);
// Thorax plates (pronotum and the wing-bearing plate).
e([5.2, 3.6, 4.6], [0, -4.4, 17.6], olive, 22);
e([5.3, 3.4, 4.6], [0, -0.8, 18.2], olive, 22);
// Abdomen: five plates tapering back and down.
for (s = [[3.4, 16.8, 4.9, 2.9, 4.3], [6.8, 15.9, 4.7, 2.8, 4.0], [10.2, 14.5, 4.2, 2.6, 3.6], [13.4, 12.8, 3.4, 2.4, 3.0], [16.3, 10.9, 2.5, 2.0, 2.2]])
  e([s[2], s[3], s[4]], [0, s[0], s[1]], olive, 20);
// Moss knobs over the thorax and the first plates.
for (p = [[-2.2, -4.6, 21.8], [2.4, -3.6, 21.9], [0, -0.8, 22.4], [-3.4, 1, 21.4], [3.4, 2.6, 21], [0, 6, 20.6], [-2.8, 9.4, 18.2], [2.6, 12.2, 15.8], [4.6, -1.5, 19.4], [-4.8, -2, 19.2]])
  nub(p);

// Moss sprouts on the back: twigs with leaves and pink buds.
module sprout(pts, rs) {
  chain(pts, rs, bark);
  n = len(pts);
  for (i = [1 : n - 2]) leaf(pts[i], [(i % 2 == 0 ? 1.4 : -1.4), 0.3, 1.2], 0.55);
  budAt(pts[n - 1], 0.6);
  leaf(pts[n - 1], [0.8, -0.3, 1.4], 0.6);
}
sprout([[-0.5, -2.5, 21], [-1.2, -1.8, 26], [-0.4, -1.5, 30], [-1.5, -1, 32.5]], [0.45, 0.4, 0.32, 0.28]);
sprout([[1.2, 2.4, 20.8], [2.2, 4.4, 26], [2.8, 5.8, 30.5], [3.2, 6.2, 33.2]], [0.45, 0.4, 0.32, 0.28]);
sprout([[2, 7.8, 19.2], [3.6, 9.8, 25], [5, 11.4, 30], [5.8, 12, 33.6]], [0.42, 0.38, 0.3, 0.26]);

// ---- Head: turned 35 degrees to the creature's right (-X), the face pointing down-forward.
NECK = [0, -6, 16.6];
HEADYAW = -35;
EYE = [2.7, -4.9, 0.2];
// the antennae: the far (-X) one arches out to the side, the near one forward and drooping (as drawn)
ANT_R = [[-1.3, -5.8, 4.0], [-2.4, -8.8, 8.8], [-5, -12, 11.5], [-8.5, -14.5, 10], [-11, -15.5, 5.5], [-12, -15, 1.5]];
ANT_L = [[1.3, -5.8, 4.0], [2, -9, 7.5], [2.8, -13, 8], [3, -16.5, 4.5], [2.6, -18, -0.5]];
translate(NECK) rotate([0, 0, HEADYAW]) {
  e([3.4, 3.4, 3.4], [0, 0, 0.6], olive, 16);
  blob([[[4.0, 3.8, 3.9], [0, -2.8, 1.8]], [[3.0, 2.6, 2.8], [0, -6.0, -1.8]], [[1.6, 1.6, 1.6], [0, -7.8, -5.6]]], faceC);
  // lighter forehead
  e([3.1, 2.9, 1.7], [0, -3.6, 4.7], oliveLight, 16);
  // palps under the face
  mirror_x() spike([1, -7.5, -6.3], [0.25, -0.6, -2.4], 0.6, 0.12, oliveLight);
  // big compound eyes, olive with a dark rim and a highlight
  mirror_x() eye(EYE, 2.2, iris = eyeC, sclera = eyeRim, pupil = eyeC, yaw = 42, flat = 0.55, shine = true);
  // twig antennae with tiny leaves and buds
  antenna(ANT_R, [0.45, 0.42, 0.38, 0.34, 0.3, 0.26]);
  antenna(ANT_L, [0.45, 0.42, 0.38, 0.32, 0.26]);
}
module antenna(P, rs) {
  chain(P, rs, bark);
  for (i = [1 : len(P) - 1]) {
    sx = P[i][0] > 0 ? 1 : -1;
    leaf(P[i], [sx * (i % 2 == 0 ? 1.3 : -0.6), -0.6, (i % 2 == 0 ? 1.1 : -1.2)], 0.55);
    if (i % 2 == 1) budAt(P[i] + [0, 0, 0.45], 0.4);
  }
}

// ---- Wings: two pairs of big veined leaf wings, raised and spread. Each is a plate in its own frame: the root at the
// origin, the leaf along +Z, its width along X.
FORE = [for (p = [[0, 0], [2.4, 1.6], [4.4, 5.5], [5.4, 10.5], [5.2, 15], [4, 19.5], [1.8, 23], [0, 24.8], [-1.4, 23], [-3.2, 19.5],
  [-4.4, 14.5], [-4.6, 9.5], [-3.8, 4.5], [-2, 1.2]]) [p[0] * 1.1, p[1]]];
HIND = [[0, 0], [2.4, 1.5], [4.6, 5], [5.2, 9.5], [4.6, 14], [3, 17.6], [0, 20.4], [-2, 18], [-3.6, 14], [-4.2, 9.5],
  [-3.6, 5], [-2, 1.4]];
module vein(a, b) { color(veinC) hull() { translate(a) scale([0.24, 0.5, 0.24]) sphere(1, $fn = 6); translate(b) scale([0.18, 0.5, 0.18]) sphere(1, $fn = 6); } }
module wing(pts, l) {
  plate(pts, 0.7, 0.4, wingC);
  vein([0, 0, 0.6], [0, 0, l - 1.2]);
  for (k = [0.2, 0.36, 0.52, 0.68, 0.82]) {
    z = l * k;
    w = 4.4 * sin(180 * min(0.95, k + 0.08));
    vein([0, 0, z], [w * 0.9, 0, z + w * 0.8]);
    vein([0, 0, z], [-w * 0.85, 0, z + w * 0.7]);
  }
}
FORE_AT = [2.2, 0, 21.5];
FORE_ROT = [0, 47, 31.5];
HIND_AT = [2.6, 3, 20.5];
HIND_ROT = [0, 63, 36.8];
mirror_x() {
  translate(FORE_AT) rotate([0, 0, FORE_ROT[2]]) rotate([0, FORE_ROT[1], 0]) wing(FORE, 24.8);
  translate(HIND_AT) rotate([0, 0, HIND_ROT[2]]) rotate([0, HIND_ROT[1], 0]) wing(HIND, 20);
}

// ---- Forelegs: thick segmented mantis arms with three-pronged claws. The near (+X) one is braced on the ground, the
// far one raised forward, as drawn.
// [shoulder, elbow, wrist, hand, claw tip drop]
ARM_L = [[3.8, -6, 14.5], [8, -7.5, 9.5], [6.6, -12.4, 5.8], [6.4, -13.2, 4.4]];
ARM_R = [[-3.8, -6, 14.5], [-8.8, -9, 13], [-12.8, -12, 9.6], [-14, -13, 7.8]];
module arm(A, drop) {
  e([2.1, 2.1, 2.1], A[0], under, 12);
  e([1.9, 1.9, 1.9], A[1], under, 12);
  e([1.7, 1.7, 1.7], A[2], under, 12);
  seg(A[0], A[1], 2.9, olive);
  seg(A[1], A[2], 2.6, olive);
  e([2.5, 2.6, 2.1], A[3], olive, 16);
  // three curved prongs, spread across the view
  for (k = [-1.4, 0, 1.4]) {
    b = A[3] + [0.87 * k, 0.5 * k - 0.8, -0.6];
    m = b + [0.15 * k, -1.4, -drop * 0.55];
    t = b + [0.25 * k, -1.2, -drop];
    color(oliveLight) { hull() { translate(b) sphere(1, $fn = 10); translate(m) sphere(0.7, $fn = 8); } hull() { translate(m) sphere(0.7, $fn = 8); translate(t) sphere(0.18, $fn = 6); } }
  }
}
arm(ARM_L, 4.2);
arm(ARM_R, 3.4);
spine(ARM_L[0] + [1.6, -0.3, 1.2], [0.6, 0.4, 1.6]);
spine((ARM_L[0] + ARM_L[1]) / 2 + [2, 0, 0.6], [1.4, 0.2, 0.8]);
spine(ARM_R[0] + [-1.2, -0.6, 1.8], [-0.5, 0, 1.6]);
spine((ARM_R[0] + ARM_R[1]) / 2 + [-1, -0.6, 2], [-0.4, -0.4, 1.5]);

// ---- Middle legs: thin twig legs.
MID = [[3.6, -1, 13], [9.5, 0, 14], [12, 2, 5], [12.8, 1, 0.4]];
mirror_x() {
  chain(MID, [0.8, 0.65, 0.55, 0.4], bark);
  spike(MID[3], [0.6, -1, -0.2], 0.4, 0.08, bark);
}

// ---- Hind legs: big spiky segmented clubs swept back, ending in a point.
HL = [[4.2, 6, 16], [8.5, 10, 13.4], [11, 13.5, 10], [12.5, 16.5, 6.4]];
mirror_x() {
  e([2.4, 2.4, 2.4], HL[1], under, 12);
  e([2, 2, 2], HL[2], under, 12);
  seg(HL[0], HL[1], 3.4, olive, 18);
  seg(HL[1], HL[2], 2.9, olive, 18);
  limb(HL[2], HL[3], 1.9, 0.15, oliveDark);
  spine(HL[0] + [1.4, 1.6, 2.4], [0.2, 0.8, 1.8], 0.6);
  spine(HL[1] + [0.6, 0.4, 2.4], [0.3, 1, 1.7], 0.55);
  spine(HL[2] + [0.4, 0.6, 2], [0.3, 1.2, 1.4], 0.5);
  spine(HL[1] + [2.2, 0.8, -0.6], [1.4, 0.6, -0.4], 0.45);
}
