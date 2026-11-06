// Rimeidol: a pale periwinkle frost ghost made of drifting wisps. A bone-white skull mask set in a horned hood that
// flows back into long, wide, wavy ribbons of frost (flat bands that taper to a point, layered, periwinkle to white),
// a soft cloak body that frays into wisps and specks behind it, two clawed hands, no legs.
// ground: -1.5
//
// Checklist (front sheet, x = sheet x, z up; 40 units tall):
// - skull mask x -15..-3.8, z 15..26.6: round cranium, narrower jaw, a crack on the top right, the far side of it
//   turned to the viewer (the head is turned 22 deg towards the camera; the nose reads 0.7 left of the skull centre)
// - eyes: two big dark violet almond sockets x -14.3..-10.6 and -8.6..-3.8, z 18.8..23, the top edge sloping down
//   to the nose (a cold glare), a small pale-blue upright glint on the inner side; a dark slash nose at -10.1, 17.5;
//   tooth gaps on the jaw's lower edge
// - hood round the skull x -16.5..-1, top z 33, a dark shadow ring between hood and skull; two hood horns, tips at
//   (-11.5, 35.7) and (-4.3, 35.3)
// - streamer A from the hood top up to z 38 and away right, a wave peak at (13, 39.5), the tip at (19.5, 34); a paler
//   band layered under it
// - streamer B from the hood back right along z 28..31 to x 17, curling down to a tip at (18, 17)
// - the hood's drape flowing down and right behind the head (x -5..8, z 14..29): two wide wavy bands
// - far hand (creature -X) reaching out to x -22..-13, z 7..15.6, five claws hanging down
// - near hand (creature +X) under the body at x -2.7..5.5, z 4..11.5, four claws hanging down
// - the right side dissolves: pale strands fraying into specks x 5..21, z 5..20
// - bottom: a near dangling tip (1.5, 0..4) and a far tendril tip (-12, 3..5)
// - back: hood with the two horns, strands flowing from the hood's crown down the back, one curling out to the
//   creature's -X at the bottom
include <lib.scad>

robe = [0.61, 0.64, 0.90, NOGLOW];
robeLt = [0.71, 0.76, 0.95, NOGLOW];
robeHi = [0.83, 0.86, 0.98, NOGLOW];
wispW = [0.88, 0.92, 1.00, NOGLOW];
shadow = [0.26, 0.26, 0.51, NOGLOW];
skull = [0.93, 0.91, 0.87, NOGLOW];
skullSh = [0.78, 0.74, 0.77, NOGLOW];
socket = [0.16, 0.11, 0.26];
glint = [0.72, 0.84, 1.00, NOGLOW];
frost = [0.92, 0.96, 0.98, NOGLOW];

// A scad point for a point read off the front sheet at depth y, with the camera's 10 deg tilt taken out (parts
// further back read higher on the sheet).
function W(s, z, y) = let(x = (s - 0.5 * y) / 0.866) [x, y, z - 0.17 * (-0.5 * x + 0.866 * y)];

// ---- Ribbons: a smooth Catmull-Rom curve through control points P, swept by thin flat ellipses (width Wv[i] at
// each control point, tapering to a point at the last), hulled in short steps. The band's face looks along N (the
// camera for the streamers seen from the front, +Y for the strands down the back), so it is broad where the art draws
// it broad and still a slab a unit or so deep from the side. rigs/rimeidol.mjs repeats this maths.
CAM = [0.5, -0.866, 0];
BACK = [0, 1, 0];
RK = 3;   // hull steps per control segment
function _cr(P, s) = let(n = len(P), i = min(floor(s), n - 2), t = s - i,
  p0 = P[max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[min(i + 2, n - 1)])
  0.5 * ((2 * p1) + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
function _lin(V, s) = let(n = len(V), i = min(floor(s), n - 2), t = s - i) V[i] * (1 - t) + V[i + 1] * t;
function _unit(v) = v / norm(v);
module _rstep(P, Wv, N, th, s) {
  n = len(P);
  p = _cr(P, s);
  T = _unit(_cr(P, min(s + 0.05, n - 1)) - _cr(P, max(s - 0.05, 0)));
  wd = _unit(cross(N, T));
  nn = cross(T, wd);
  w = _lin(Wv, s);
  t = max(0.16, th * min(1, w / 1.4));
  multmatrix([[T[0] * 0.35, wd[0] * w, nn[0] * t, p[0]], [T[1] * 0.35, wd[1] * w, nn[1] * t, p[1]],
              [T[2] * 0.35, wd[2] * w, nn[2] * t, p[2]], [0, 0, 0, 1]]) sphere(1, $fn = 8);
}
module ribbon(P, Wv, N, th, c) {
  m = (len(P) - 1) * RK;
  color(c) for (j = [0 : m - 1]) hull() { _rstep(P, Wv, N, th, j / RK); _rstep(P, Wv, N, th, (j + 1) / RK); }
}

// ---- Head: the skull mask in its hood, turned HY towards the camera.
H = W(-8.4, 21, -12);
HY = 22;
module headLocal() {
  // Hood: a big rounded cowl whose front opening is a soft rim round the mask; a dark shadow ring inside it.
  color(robe) hull() {
    translate([-0.4, 4.4, 2.8]) scale([8.6, 7.4, 8]) sphere(1, $fn = 32);
    for (a = [0 : 30 : 359]) translate([6.7 * sin(a), -2.8, 0.8 + 6.9 * cos(a)]) sphere(1.4, $fn = 12);
  }
  ell([6.3, 1.4, 6.5], [0, -3.2, 0.6], shadow);
  // Hood horns.
  mirror_x() spike([3.9, 2.2, 9.4], [1.1, -0.2, 5.6], 2.1, 0.25, robeLt);
  // Skull mask: cranium and jaw.
  blob([[[5.9, 3.4, 5.1], [0, -3.4, 1.1]], [[4.2, 2.8, 2.6], [0, -3.6, -3.1]]], skull);
  // Eye sockets: dark almonds, the top edge sloping down to the nose, a pale glint on the inner side.
  mirror_x() {
    color(socket) intersection() {
      translate([3.2, -5.2, 0]) rotate([0, 0, 24]) scale([2.7, 1.3, 2.3]) sphere(1, $fn = 20);
      translate([3.2, -5.2, 2.1]) rotate([0, -28, 0]) translate([-10, -10, -20]) cube(20);
    }
    translate([2.5, -6.25, -0.3]) rotate([0, 0, 20]) ell([0.34, 0.3, 0.75], [0, 0, 0], glint);
  }
  // Nose slash and the tooth gaps.
  color(socket) translate([-0.25, -6.45, -3.3]) rotate([0, -25, 0]) scale([0.45, 0.4, 0.85]) sphere(1, $fn = 10);
  for (x = [-1.4, 0, 1.4]) color(socket) translate([x, -5.6, -4.7]) cube([0.28, 1.2, 0.9], center = true);
  // Crack on the cranium.
  color(skullSh) translate([1.6, -6.15, 4.1]) rotate([0, -35, 0]) cube([0.28, 0.6, 1.8], center = true);
}
translate(H) rotate([0, 0, HY]) headLocal();

// ---- Body: a soft cloak mass under the hood (the strands below carry it back and down).
blob([
  [[5.8, 5.4, 5.2], [-1.6, -7.5, 15.5]],   // chest under the hood
  [[6.4, 6, 4.4], [0, -3.5, 10.5]],        // middle
  [[4.2, 4.6, 2.6], [0.5, -1.5, 5.8]],     // hem
], robe);
// The hem flowing forward-left under the far arm.
ell([4.4, 3.6, 3.2], [-6.5, -6, 6.5], robe);

// ---- Arms: draped sleeves with clawed hands. The far one (-X) reaches out; the near one hangs under the body.
// far
limb([-5.2, -6.5, 15], [-15.5, -7.5, 12.4], 2.6, 2, robe);
ell([2.7, 2.2, 2], [-16.8, -7.6, 11.8], robeLt);
for (k = [0 : 4]) let(x = -19.2 + 1.25 * k)
  chain([[x + 0.9, -8, 11], [x, -8.4, 8.8], [x - 0.3, -8.6, 7]], [0.62, 0.42, 0.14], frost);
// near
limb([4.6, -6.5, 13.5], [5.8, -8.4, 9.8], 2.5, 1.9, robe);
ell([2.1, 1.8, 1.6], [5.8, -8.6, 8.8], robeLt);
for (k = [0 : 3]) let(x = 4.3 + 1.1 * k)
  chain([[x, -9.2, 8], [x + 0.1, -9.6, 6], [x + 0.2, -9.6, 4.6]], [0.58, 0.4, 0.14], frost);

// ---- Streamers off the hood, flowing back and up (rows: points, widths; rigs/rimeidol.mjs copies them).
RA = [W(-4, 31.5, -8), W(-1.5, 35.8, -4), W(2.5, 37.4, 0), W(6.5, 36.3, 4), W(10.5, 37, 7.5), W(13.5, 38.6, 10),
      W(16.8, 36.6, 12), W(19.8, 34, 13.5)];
WA = [1.8, 2.3, 2.5, 2.6, 2.4, 2.1, 1.7, 0.3];
RC = [W(-2.5, 33, -6), W(2, 34.6, -1), W(6.5, 34, 3.5), W(10.5, 34.8, 7), W(14.5, 33.4, 9.5)];
WC = [1.5, 1.9, 1.9, 1.6, 0.3];
RB = [W(-1.5, 28.8, -7), W(3, 29.4, -2), W(7, 29.7, 2), W(11, 30.1, 6), W(15, 29.5, 9), W(18.3, 27.2, 11),
      W(19.2, 23, 11.5), W(18.3, 18.6, 11), W(16.8, 16, 10.5)];
WB = [2, 2.5, 2.6, 2.6, 2.4, 2.1, 1.8, 1.3, 0.3];
// The hood's drape: two wide wavy bands flowing back and down under B.
RD1 = [W(-3.5, 26, -4), W(1.5, 25, 0.5), W(6.5, 23.4, 4.5), W(10.5, 23.2, 7.5), W(14.5, 21.4, 10), W(17, 20.2, 11.5)];
WD1 = [3, 3.4, 3.4, 3, 2.2, 0.3];
RD2 = [W(-2.5, 20.5, -2), W(3, 19.6, 2), W(8, 18, 6), W(12.5, 17, 9), W(16.6, 17.6, 11)];
WD2 = [3, 3.4, 3.2, 2.4, 0.3];
// The cloak fraying into wisps behind the lower body.
RL1 = [W(0, 13.8, 0), W(5, 12.6, 4), W(10, 11.8, 7), W(14.6, 10.8, 9.5), W(17.6, 12.8, 11)];
WL1 = [3, 3.2, 2.8, 1.9, 0.3];
RL2 = [W(-1.5, 8.6, -1), W(3, 7.4, 2), W(8, 6.6, 5), W(11.6, 5, 7), W(13.2, 2.6, 8)];
WL2 = [2.8, 2.9, 2.5, 1.6, 0.3];
// Strands from the hood's crown down the back (four, so the back reads as strands, not a ball): one curls out to
// -X at the bottom, one hangs as the back tip.
RE1 = [[-6, -4, 31], [-6.8, -0.6, 26], [-5.5, 4.5, 18], [-6, 6.5, 10], [-10, 4, 4.5], [-14, 0.5, 4], [-16.2, -1.5, 6.2]];
WE1 = [2.4, 3, 3.2, 3, 2.4, 1.6, 0.3];
RE2 = [[-2.5, -4.2, 31.5], [-1.8, -0.4, 25.5], [0.3, 5, 18], [1.5, 7.4, 10], [0.6, 6.4, 4], [-1.2, 4.6, 0.6]];
WE2 = [2.2, 2.8, 3.2, 3, 2, 0.3];
RE3 = [[-10, -6.5, 28], [-11.5, -3, 22], [-10.5, 1, 15], [-11, 1.5, 9], [-12.5, -0.5, 5.5]];
WE3 = [2.2, 2.8, 3, 2.4, 0.3];
RE4 = [[0.5, -6, 29.5], [2.5, -2, 23.5], [3.5, 2.5, 16], [4, 4, 9], [3.2, 3, 3.5]];
WE4 = [2, 2.6, 2.8, 2.2, 0.3];
// Layered strands between those, a little further back and darker, so the drape reads as one drifting mass of
// overlapping bands with no gaps.
RM1 = [W(-1, 23.4, -1), W(4, 22.2, 3), W(9, 21, 7), W(12.6, 19.8, 10), W(14.6, 17.4, 12)];
WM1 = [2.6, 3, 2.8, 1.9, 0.3];
RM2 = [W(0, 17, 0), W(5, 16, 4.5), W(10, 14.8, 8), W(13.4, 13.2, 10.5), W(15, 11.2, 12)];
WM2 = [2.6, 3, 2.6, 1.6, 0.3];
RM3 = [W(0.5, 11, 0.5), W(5, 9.8, 4.5), W(9.5, 8.8, 7.5), W(12.6, 7.6, 9.5)];
WM3 = [2.4, 2.6, 2, 0.3];
// The near dangling tip under the body.
RF = [[3.4, -4, 6.4], [3.8, -5.6, 3], [4.4, -6.4, 0.3]];
WF = [2.6, 2.2, 0.4];

ribbon(RA, WA, CAM, 0.8, robeLt);
ribbon(RC, WC, CAM, 0.6, wispW);
ribbon(RB, WB, CAM, 0.8, robe);
ribbon(RD1, WD1, CAM, 0.9, robeLt);
ribbon(RD2, WD2, CAM, 0.8, robeHi);
ribbon(RL1, WL1, CAM, 0.8, robeHi);
ribbon(RL2, WL2, CAM, 0.8, wispW);
ribbon(RM1, WM1, CAM, 0.8, robe);
ribbon(RM2, WM2, CAM, 0.8, robeLt);
ribbon(RM3, WM3, CAM, 0.8, robe);
ribbon(RE1, WE1, BACK, 0.8, robe);
ribbon(RE2, WE2, BACK, 0.8, robeLt);
ribbon(RE3, WE3, BACK, 0.8, robeLt);
ribbon(RE4, WE4, BACK, 0.8, robe);
ribbon(RF, WF, CAM, 0.8, robeLt);

// ---- Frost specks drifting off the frayed ends.
MOTES = [W(20, 28.5, 12), W(21.5, 31, 14), W(18.5, 13.5, 10), W(14, 7.5, 7), W(20.5, 21.5, 12), W(12, 3.2, 5),
         W(17.5, 8.5, 9), W(19.5, 17, 11), W(16, 5.5, 8), W(21, 25, 13), W(10, 1.2, 4)];
for (p = MOTES) color(frost) translate(p) rotate([45, 35, 0]) cube(0.8, center = true);
