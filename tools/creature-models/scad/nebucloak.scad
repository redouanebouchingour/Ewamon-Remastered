// Nebucloak: a small mint imp in a huge round purple hood (its tip flopping to the creature's left, +X) and a short
// lavender cape lined magenta that flares out from the shoulders, a magenta gem clasp on a pointed purple capelet.
//
// Checklist (front sheet; the body's axis reads at sheet x -2, so x' = sheet x + 2):
// - hood: x' -9.6..9.8, z 20..40, deep and round; the tip a lobe out to x' 9.8 at z 35..39.5 (back: up and to +X)
// - face inside the hood: x' -7.4..5.2, z 22..33.5; cream lower mask, teal top with a teal V point down between the
//   eyes to z 28.3; the head turned a little towards +X (the eyes sit right of where a straight round head puts them)
// - eyes: two big glowing magenta almonds, flat bottoms, the top edge sloping down to the nose (sly), z 25..29,
//   near x' -0.6..4.1, far x' -6.7..-3.5; a pink vertical highlight in each; a small smirk at z 23.4, rising to +X
// - capelet / collar z 16.7..22 with points on its hem, the magenta gem at z 17..19.5 on the front
// - body: cream belly and inner thighs, teal V on the chest from the collar to z 12.6, teal shoulders, arms, shins
// - arms short and raised to the sides, pale clawed hands at z 16..23, x' -11..12, claws up, dark claw tips
// - legs dangling: the near one nearly straight (knee x' 5.2), the far one bent with the knee out (x' -4.5) and the
//   shin angling back in; small pointed feet, cream toe tips
// - cape: lavender outside, magenta lining seen at the open front's sides (z 8..13.5), hem at z 8..10, flared wider on
//   the +X side (x' -9.9..15.9); the back shows a wide lavender trapezoid
// - wind: thin pale blue crescents round it, two by the head (x' -15..16, z 23..34) and two by the legs plus short
//   strokes in front of the feet (z 2..6)
include <lib.scad>

skin = [0.45, 0.69, 0.65];
cream = [0.9, 0.9, 0.73];
pale = [0.85, 0.9, 0.82];
hood = [0.25, 0.14, 0.41];
cape = [0.46, 0.34, 0.67];
lining = [0.6, 0.18, 0.58];
gem = [0.78, 0.12, 0.66, GLOW];
eyeDark = [0.5, 0.06, 0.5];
eyeGlow = [0.9, 0.2, 0.85, GLOW];
eyeShine = [1, 0.72, 1, NOGLOW];
ink = [0.14, 0.12, 0.2];
wind = [0.64, 0.84, 0.9, NOGLOW];

// ---- Legs (not mirrored: the drawn pose). Near (+X): nearly straight. Far (-X): knee out, shin back in.
LEG_N = [[2.2, -0.3, 9.2], [5.4, -0.6, 5.6], [6.0, -0.6, 2.2], [5.6, -1.6, 0.4]];
LEG_F = [[-2.2, -0.3, 9.2], [-5.8, -0.6, 6.3], [-1.6, -0.9, 2.4], [-1.2, -1.9, 0.4]];
LEG_R = [2.3, 1.6, 1.15, 0.45];
module leg(P) {
  limb(P[0], P[1], LEG_R[0], LEG_R[1], skin);
  limb(P[1], P[2], LEG_R[1], LEG_R[2], skin);
  limb(P[2], P[3], LEG_R[2], LEG_R[3], skin);
  ell([0.55, 0.6, 0.5], P[3] + [0, -0.1, 0.25], cream);   // the toe tip
}
leg(LEG_N);
leg(LEG_F);

// ---- Torso: teal, the cream belly and inner thighs laid on from the art's outline (front half only).
BODY = [[[4.2, 3.6, 3.4], [0, 0, 10]], [[3.4, 3, 3], [0, 0, 15.5]]];
blob(BODY, skin);
BELLY = [[-1.1, 15.7], [0.5, 14.1], [2.4, 9.2], [2.2, 7.1], [1.4, 6.4], [0.5, 6.4], [-0.2, 6.8], [-1.9, 9.7], [-5.1, 10.3],
         [-3.9, 7.7], [-5.7, 6.8], [-7, 8.1], [-7, 9.3], [-5.3, 14.5], [-5, 15], [-4.2, 13.2], [-3.1, 12.4]];
module prismG(pts) pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) translate([2, 0]) offset(r = 0.45) polygon(pts);
color(cream) intersection() {
  union() {
    blob([for (e = BODY) [e[0] + [0.25, 0.25, 0.25], e[1]]]);
    for (P = [LEG_N, LEG_F]) limb(P[0], P[1], LEG_R[0] + 0.25, LEG_R[1] + 0.25);
  }
  prismG(BELLY);
  translate([-50, -100, -1]) cube([100, 99.8, 60]);
}

// ---- Arms raised to the sides, pale clawed hands (mirrored).
ARM = [[3.6, -1, 16.8], [7.4, -1, 15.4], [10.2, -1.6, 18]];
HAND = [10.9, -1.8, 19.2];
FINGERS = [[-0.95, [-0.55, -0.1, 1.9]], [0.05, [0.05, -0.3, 2.1]], [1.0, [0.75, -0.1, 1.8]]];
mirror_x() {
  chain(ARM, [1.55, 1.35, 1.15], skin);
  ell([1.9, 1.5, 1.75], HAND, pale);
  for (f = FINGERS) {
    b = HAND + [f[0], -0.1, 1.0];
    spike(b, f[1], 0.62, 0.3, pale);
    spike(b + f[1], f[1] * 0.45, 0.32, 0.04, ink);
  }
  spike(HAND + [-1.5, -0.4, 0.1], [-1.2, -0.5, 0.8], 0.55, 0.25, pale);   // the thumb, inwards
  spike(HAND + [-1.5, -0.4, 0.1] + [-1.2, -0.5, 0.8], [-0.5, -0.2, 0.35], 0.28, 0.04, ink);
}

// ---- Cape: a flared shell from the shoulders, open at the front, the +X side blown wider, the front corners lifted.
function capeTh(t) = 6 - 14 * t;                    // the +X front edge (degrees): blown back, the lining shows
function capeTh1(t) = 172 + 43 * t;                 // the -X front edge
function capeRh(a) = 11.5 + 2.6 * cos(a);
function capeZh(a) = 8.6 + 1.6 * max(0, -sin(a));
function capeP(i, j, dr, N, M) = let(t = j / M, a0 = capeTh(t), a = a0 + (capeTh1(t) - a0) * i / N,
  r = 4.4 + (capeRh(a) - 4.4) * pow(t, 1.25) + dr, z = 19.8 - (19.8 - capeZh(a)) * t + pow(t, 3) * 0.45 * sin(7 * a))
  [r * cos(a), 1 + 0.92 * r * sin(a), z];
module capeShell(d0, d1, N = 30, M = 8) {
  O = function(i, j) j * (N + 1) + i;
  I = function(i, j) (N + 1) * (M + 1) + j * (N + 1) + i;
  polyhedron(
    points = concat([for (j = [0 : M], i = [0 : N]) capeP(i, j, d1, N, M)], [for (j = [0 : M], i = [0 : N]) capeP(i, j, d0, N, M)]),
    faces = concat(
      [for (j = [0 : M - 1], i = [0 : N - 1]) [O(i, j), O(i + 1, j), O(i + 1, j + 1), O(i, j + 1)]],
      [for (j = [0 : M - 1], i = [0 : N - 1]) [I(i, j), I(i, j + 1), I(i + 1, j + 1), I(i + 1, j)]],
      [for (i = [0 : N - 1]) [I(i, 0), I(i + 1, 0), O(i + 1, 0), O(i, 0)]],
      [for (i = [0 : N - 1]) [O(i, M), O(i + 1, M), I(i + 1, M), I(i, M)]],
      [for (j = [0 : M - 1]) [O(0, j), O(0, j + 1), I(0, j + 1), I(0, j)]],
      [for (j = [0 : M - 1]) [I(N, j), I(N, j + 1), O(N, j + 1), O(N, j)]]));
}
color(cape) capeShell(-0.05, 0.3);
color(lining) capeShell(-0.3, 0.0);

// ---- Capelet with pointed hem and the gem clasp.
ell([5.8, 5.0, 2.4], [0, 0.3, 19.6], hood);
for (a = [0 : 40 : 359]) spike([5 * cos(a), 0.3 + 4.3 * sin(a), 18.6], [0.6 * cos(a), 0.6 * sin(a), -1.9], 1.1, 0.1, hood);
ell([0.85, 0.55, 1.25], [0, -4.75, 18.5], gem);
ell([0.25, 0.2, 0.45], [-0.25, -5.25, 18.9], eyeShine);

// ---- Head group: the head, face, eyes, mouth and hood, turned 10 degrees towards +X.
HEAD_T = [0, -0.5, 27.8];
HEAD_R = 10;
HEAD = [7.7, 5.7, 6.8];
HEAD_C = [0, -1, 0];
// the hood: a round lower bowl and a narrower crown, hulled into a teardrop
HOOD_A = [[9.7, 9.4, 8.0], [0, 1.6, 0.6]];
HOOD_B = [[6.2, 6.4, 3.2], [0.8, 2.2, 8.8]];
HOOD_TH = 1.1;
OPEN = [7.2, 6.5];
TIP = [[2.5, 3, 9.4], [5.4, 4, 9.8], [8.4, 4.6, 9.2], [10.8, 5, 7.6]];
TIP_R = [3.2, 2.4, 1.4, 0.35];
EYE = [4.15, -5.4, -1.0];
EYE_S = 2.3;
EYE_F = 0.42;
EYE_YAW = 24;
MASK = [[-4.5, -8], [4.5, -8], [6, -3.3], [6.2, 1.6], [5, 2.6], [2.8, 3.4], [0, 0.4], [-2.8, 3.4], [-5, 2.6], [-6.2, 1.6], [-6, -3.3]];
// The eye: a magenta almond with a flat bottom, its top edge sloping down to the nose, a dark rim round a glowing
// middle and a pink highlight on the inner side. It fits inside lib.scad eye()'s envelope (the rig's lids close over it).
module almond(s, f, k = 1) intersection() {
  scale([1.05 * s, f * s, 1.15 * s] * k) sphere(1, $fn = 24);
  translate([0, 0, 1.08 * s * k]) rotate([0, -40, 0]) translate([-5 * s, -5 * s, -10 * s]) cube(10 * s);
  translate([-5 * s, -5 * s, -0.85 * s * k]) cube(10 * s);
}
module neye(s, f) {
  color(eyeDark) almond(s, f);
  color(eyeGlow) translate([0.03 * s, -0.16 * f * s, -0.06 * s]) almond(s, f, 0.9);
  color(eyeShine) translate([-0.3 * s, -0.86 * f * s, 0.02 * s]) scale([0.24, 0.12, 0.5] * s) sphere(1, $fn = 12);
  color("white") translate([-0.24 * s, -0.8 * f * s, 0.48 * s]) sphere(0.13 * s, $fn = 8);
}
translate(HEAD_T) rotate([0, 0, HEAD_R]) {
  ell(HEAD, HEAD_C, skin);
  // the cream mask over the lower face; the teal V points down between the eyes
  color(cream) intersection() {
    translate(HEAD_C) scale(HEAD + [0.2, 0.2, 0.2]) sphere(1, $fn = 28);
    translate([0, -1, 0]) rotate([90, 0, 0]) linear_extrude(height = 20) polygon(MASK);
  }
  mirror_x() translate(EYE) rotate([0, 0, EYE_YAW]) neye(EYE_S, EYE_F);
  // the smirk, rising to +X
  chain([[-1.25, -5.1, -4.3], [0.1, -5.3, -4.65], [1.25, -5.1, -4.05]], [0.24, 0.26, 0.2], ink);
  // the hood: a thick round shell open over the face, the face set deep inside
  color(hood) difference() {
    hull() for (e = [HOOD_A, HOOD_B]) translate(e[1]) scale(e[0]) sphere(1, $fn = 40);
    hull() for (e = [HOOD_A, HOOD_B]) translate(e[1]) scale(e[0] - [HOOD_TH, HOOD_TH, HOOD_TH]) sphere(1, $fn = 32);
    translate([0, -1, -0.2]) rotate([90, 0, 0]) scale([OPEN[0], OPEN[1], 1]) cylinder(h = 20, r = 1, $fn = 40);
  }
  chain(TIP, TIP_R, hood);
}

// ---- Wind: thin crescents on two rings round it, each a helix arc swelling in the middle.
module wisp(R, a0, a1, z0, z1, w, c = [0, 1]) {
  N = 9;
  P = function(i) let(t = i / N, a = a0 + (a1 - a0) * t) [c[0] + R * cos(a), c[1] + R * sin(a), z0 + (z1 - z0) * t];
  W = function(i) max(0.12, w * sin(180 * i / N));
  for (i = [0 : N - 1]) limb(P(i), P(i + 1), W(i), W(i + 1), wind);
}
wisp(14.5, -12, 72, 25.5, 31, 0.6);      // by the head, right ")"
wisp(14.5, 250, 172, 23.5, 28.5, 0.6);   // by the head, left "("
wisp(13.5, 200, 150, 31.5, 32.8, 0.4);
wisp(13.5, -30, 40, 33.6, 33, 0.4);
wisp(15, 250, 170, 5, 11, 0.6, [1, 1]);    // by the legs, left
wisp(16.5, -20, 60, 8, 12.5, 0.6, [1, 1]); // by the legs, right
wisp(14, 235, 275, 3.8, 2.8, 0.4, [1, 1]); // in front of the feet
wisp(15, 290, 340, 1.8, 4.6, 0.45, [1, 1]);
