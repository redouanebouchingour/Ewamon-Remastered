// Stellaria: Lumistar ascended. A chibi celestial sea-spirit girl: a big round pale mint face with a teal diamond on the
// brow, big violet-ringed eyes with a thick dark lash line, a tiny smile; purple starry hair on top falling to dark
// teal locks that flow out wide with flicked tips (longer on her left, +X); a tiara ring of cream stars framing the
// face; a mint bow with a star at the throat; thin mint arms held out and down with spread fingers; a navy starry
// gown that flares into a wide cape with a teal lining and mint-edged wavy tails, open at the front over the dress
// with its gold constellation; slender mint legs tapering to points (no feet).
//
// Checklist (front sheet x, z; the body axis sits at sheet x 0):
//   head / hair ball   x -6.5..7.5, z 25.5..38.5  purple top, navy-teal sides; head turned 14 deg towards the viewer
//   face               x -5.4..3.6, z 25.7..33.6  mint; teal diamond on the brow (-1.9, 31..35.6)
//   eyes               near (1.0, 29.7) 3 x 2.6, far (-4.2, 29.7); white core, violet ring, black lash line on top
//   mouth              (-1.9, 27.0) tiny teal smile
//   crown              nine cream stars on a ring framing the face: top (-0.7, 38.3), low sides (4.6, 27.8) / (-6.6, 28.2)
//   locks              near flicks to (12.3, 27.5) and (11.8, 22); far flick to (-9.3, 25.8); back hair down to z 21.5
//   bow                (-2.2, 23), loops x -5..4
//   arms               near hand (9.4, 19); far hand (-13.4, 21), fingers spread
//   gown               bodice z 17..23, cape flaring to x +-14 at z 8..16, wavy mint-edged tails z 4..9, teal lining
//   dress / slit       front panel x -6..5 with the constellation; mint leg through the slit to z 0.5
//   back               the big hair mass with flicks, the cape's back panel with a constellation, mint panel lines
include <lib.scad>

skin = [0.79, 0.93, 0.80, NOGLOW];
mint = [0.59, 0.82, 0.74, NOGLOW];
teal = [0.39, 0.71, 0.70, NOGLOW];
tealHi = [0.62, 0.88, 0.84, NOGLOW];
lining = [0.33, 0.62, 0.66];
tealDeep = [0.23, 0.46, 0.59];
navy = [0.17, 0.27, 0.48];
navyDeep = [0.13, 0.22, 0.42];
hairTop = [0.32, 0.22, 0.46];
hairBack = [0.16, 0.26, 0.47];
lockA = [0.17, 0.32, 0.50];
lockB = [0.21, 0.41, 0.56];
cream = [0.98, 0.93, 0.78, NOGLOW];
gold = [0.96, 0.86, 0.62, NOGLOW];
peach = [0.96, 0.72, 0.58, NOGLOW];
violet = [0.55, 0.13, 0.6];
eyeCore = [0.99, 0.96, 0.98, NOGLOW];
eyePink = [0.96, 0.74, 0.8, NOGLOW];
ink = [0.09, 0.07, 0.15];

// ---- helpers
// five-point star with bevelled faces, lying in the XZ plane facing -Y
module star5(r, th, c) {
  color(c) rotate([90, 0, 0]) for (s = [-1, 1]) scale([1, 1, s])
    linear_extrude(height = th / 2, scale = 0.35) polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = i % 2 == 0 ? r : r * 0.52) [rr * cos(a), rr * sin(a)]]);
}
// four-point sparkle in the XZ plane, turned by rz about Z
module sparkle(p, s, c, rz = 0) {
  color(c) translate(p) rotate([0, 0, rz]) {
    scale([s, 0.14, s * 0.26]) sphere(1, $fn = 6);
    scale([s * 0.26, 0.14, s]) sphere(1, $fn = 6);
  }
}
// flat tapered ribbon (a hair lock): width ws[i] in the XZ plane, 2 t thick
module ribbon(pts, ws, t, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() {
    translate(pts[i]) scale([ws[i], t, ws[i]]) sphere(1, $fn = 10);
    translate(pts[i + 1]) scale([ws[i + 1], t, ws[i + 1]]) sphere(1, $fn = 10);
  }
}
// angle a on an ellipse (rx cos a, cy + ry sin a) whose view-sheet x is s: front (sin a < 0) or back
function solveA(s, A, B, front) = let(R = sqrt(A * A + B * B), ph = atan2(B, A), d = acos(max(-1, min(1, s / R))), a1 = ph - d, a2 = ph + d)
  ((sin(a1) < 0) == front) ? a1 : a2;

// ---- head (turned HY towards the viewer)
HC = [-0.2, -0.3, 31.2];
HY = 14;
module headF() { translate(HC) rotate([0, 0, HY]) children(); }
HAIR = [[6.0, 5.6, 5.9], [0, 0.9, 0.9]];
FACE = [[4.5, 4.1, 4.4], [0, -1.7, -1.2]];
EYE = [2.8, -4.5, -1.4];
headF() {
  color(hairTop) difference() {
    ell(HAIR[0], HAIR[1]);
    translate([0, -1, FACE[1][2]]) rotate([90, 0, 0]) cylinder(h = 10, r = 4.3, $fn = 32);
  }
  ell(FACE[0], FACE[1], skin);
  // eyes: white core in a violet ring, a thick dark lash line along the top, a pink glint
  mirror_x() {
    eye(EYE, 1.6, iris = eyeCore, sclera = violet, pupil = eyePink, yaw = 20, flat = 0.5,
        lid = 0.15, lid_tilt = 0, lid_c = ink, squint = 0, slit = 1, shine = true);
    // the lash flick at the outer corner
    color(ink) translate(EYE + [1.2, 0.25, 1.15]) rotate([0, 0, 20]) rotate([0, -30, 0]) scale([0.75, 0.3, 0.24]) sphere(1, $fn = 8);
  }
  // tiny smile
  color(teal) translate([-0.3, -4.62, -4.0]) rotate([0, 0, 0]) rotate([70, 0, 0]) intersection() {
    rotate_extrude($fn = 20) translate([0.75, 0]) circle(0.14, $fn = 6);
    translate([-2, -2.3, -1]) cube([4, 2, 2]);
  }
  // locks framing the cheeks
  mirror_x() chain([[4.5, -0.6, 1.4], [5.0, -1.3, -1.6], [4.6, -1.6, -4.4], [3.9, -1.2, -6.2]], [1.5, 1.35, 1.1, 0.6], lockA);
}
// teal diamond on the brow, painted over the face and the hairline (front sheet outline)
GEM = [[-1.9, 35.9], [-3.8, 33.2], [-1.8, 30.7], [0.0, 33.4]];
GEMHI = [[-1.9, 35.3], [-2.4, 34.4], [-1.9, 33.5], [-1.4, 34.4]];
color(teal) intersection() {
  headF() { ell(HAIR[0] + [0.2, 0.2, 0.2], HAIR[1]); ell(FACE[0] + [0.2, 0.2, 0.2], FACE[1]); }
  prism(GEM);
  translate([0, -21, 30]) cube(40, center = true);
}
color(tealHi) intersection() {
  headF() { ell(HAIR[0] + [0.32, 0.32, 0.32], HAIR[1]); ell(FACE[0] + [0.32, 0.32, 0.32], FACE[1]); }
  prism(GEMHI);
  translate([0, -21, 30]) cube(40, center = true);
}
// sparkles in the hair (peach on the purple, cream lower down)
headF() for (q = [[40, 35, 0.45, peach], [125, 30, 0.4, peach], [70, 55, 0.4, cream], [160, 10, 0.35, cream], [20, 10, 0.35, peach], [100, -5, 0.4, cream]])
  let(az = q[0], el = q[1], p = HAIR[1] + [HAIR[0][0] * cos(el) * cos(az), HAIR[0][1] * cos(el) * sin(az), HAIR[0][2] * sin(el)] * 1.02)
    sparkle(p, q[2], q[3], az - 90);

// crown: a ring of cream stars framing the face (in the head frame)
CROWN = [[-125, 1.6], [-92, 1.6], [-60, 1.5], [-30, 1.6], [0, 2.0], [30, 1.6], [60, 1.5], [92, 1.6], [125, 1.6]];
headF() for (s = CROWN) let(t = s[0], R = 6.7, y = -1.2 + 1.2 * cos(t) - 0.3 * abs(sin(t)))
  translate([R * sin(t), y, 0.4 + R * cos(t)]) rotate([0, 0, 0.35 * t]) rotate([0, t, 0]) star5(s[1], 1.5, cream);

// ---- back hair: a big mass behind the head falling to z 21.5 with a wavy edge
color(hairBack) hull() {
  translate([-0.2, 2.4, 30.8]) scale([5.8, 3.6, 4.8]) sphere(1, $fn = 24);
  translate([-0.2, 4.0, 23.6]) scale([6.6, 2.4, 1.8]) sphere(1, $fn = 24);
}
// soft lobes along the bottom edge, a couple ending in points
for (q = [[-5.0, 22.2, 1.9], [-2.0, 21.0, 2.0], [1.2, 21.4, 2.0], [4.4, 21.8, 1.9]]) color(hairBack) hull() {
  translate([q[0], 4.2, 24.4]) scale([q[2], 1.8, 1.4]) sphere(1, $fn = 14);
  translate([q[0] * 1.06, 4.8, q[1]]) scale([q[2] * 0.6, 1.0, 1.0]) sphere(1, $fn = 10);
}
for (x = [-2.0, 4.4]) chain([[x * 1.06, 4.9, 21.6], [x * 1.1 + 0.5, 5.3, 19.6]], [0.9, 0.15], hairBack);
for (p = [[-3.2, 6.1, 30], [2.2, 6.0, 33], [3.6, 5.9, 27], [-1, 6.4, 26.5], [-4.6, 5.0, 25], [0.8, 6.5, 30], [4.4, 5.4, 31.5], [-2.4, 5.6, 34]])
  sparkle(p, 0.42, p[2] > 31 ? peach : cream, 180);

// ---- the long locks flowing out wide with flicked tips (longer on her left, +X)
// the soft hair masses the locks flow out of (a thick fall on each side, fuller on her left)
color(lockA) hull() {
  translate([4.6, 1.4, 31.0]) scale([2.6, 2.8, 3.6]) sphere(1, $fn = 16);
  translate([8.4, 2.2, 25.0]) scale([2.4, 2.2, 3.4]) sphere(1, $fn = 16);
  translate([6.4, 3.6, 21.6]) scale([2.4, 1.8, 1.6]) sphere(1, $fn = 16);
}
color(lockA) hull() {
  translate([-4.6, 1.4, 30.0]) scale([2.4, 2.6, 3.4]) sphere(1, $fn = 16);
  translate([-7.0, 2.4, 24.6]) scale([2.2, 2.0, 3.0]) sphere(1, $fn = 16);
  translate([-5.6, 3.6, 21.6]) scale([2.2, 1.8, 1.4]) sphere(1, $fn = 16);
}
LOCKS = [
  [[[5.6, 0.8, 32.6], [8.4, 1.2, 30.4], [10.6, 1.0, 28.8], [12.2, 0.6, 27.6], [13.6, 0.0, 28.4]], [2.4, 2.4, 1.8, 1.0, 0.25], lockA],
  [[[7.6, 1.8, 28.0], [9.6, 2.0, 25.6], [10.6, 1.8, 23.6], [11.8, 1.4, 22.2], [13.2, 0.8, 22.8]], [2.4, 2.2, 1.6, 0.9, 0.2], lockB],
  [[[6.4, 3.4, 24.6], [8.6, 3.8, 21.8], [9.8, 3.8, 20.2], [11.0, 3.4, 19.4]], [2.2, 1.8, 1.1, 0.2], lockA],
  [[[-4.8, 0.2, 32.5], [-6.6, 0.2, 29.8], [-8.0, 0.0, 27.4], [-9.4, -0.4, 26.0], [-10.8, -0.8, 26.6]], [2.2, 2.0, 1.6, 0.9, 0.2], lockA],
  [[[-6.0, 2.0, 26.6], [-7.6, 2.4, 24.4], [-8.8, 2.2, 22.8], [-10.4, 1.6, 22.8]], [2.2, 1.8, 1.0, 0.2], lockB],
  [[[-4.8, 3.6, 23.6], [-6.6, 4.2, 21.2], [-7.6, 4.2, 20.0], [-8.8, 3.8, 19.8]], [2.0, 1.5, 1.0, 0.2], lockA],
];
for (L = LOCKS) ribbon(L[0], L[1], 1.2, L[2]);
for (p = [[8.4, -0.3, 30.4], [9.2, 0.4, 25.8], [-6.8, -1.0, 29.4], [10.8, -0.3, 28.4], [6.6, -0.6, 27.0]]) sparkle(p, 0.4, cream, 0);

// ---- neck, bodice and bow
limb([-0.1, -0.5, 24.6], [-0.1, -0.9, 27.2], 0.95, 0.9, skin);
blob([[[3.0, 2.3, 1.8], [0, -0.2, 22.4]], [[2.5, 2.0, 2.0], [0, 0, 19.0]]], navy);
BOW = [-0.5, -2.7, 24.4];
translate(BOW) rotate([0, 0, 14]) {
  mirror_x() {
    color(mint) translate([1.5, 0.3, 0.25]) rotate([0, -18, 0]) scale([1.6, 0.75, 1.0]) sphere(1, $fn = 14);
    color(teal) translate([0.9, 0.2, -1.0]) rotate([0, 30, 0]) scale([0.45, 0.4, 1.1]) sphere(1, $fn = 10);
  }
  translate([0, -0.5, 0]) star5(1.35, 0.9, cream);
}

// ---- arms held out and down, fingers spread (the far one reaches further forward, as drawn)
SHL = [2.4, -0.3, 22.2]; ELL = [5.8, -1.0, 20.5]; HAL = [9.6, -1.4, 18.9];
SHR = [-2.4, -0.3, 22.2]; ELR = [-6.3, -1.7, 21.5]; HAR = [-10.8, -3.5, 21.3];
module arm(sh, el, ha, s) {
  limb(sh, el, 0.72, 0.6, skin);
  limb(el, ha, 0.6, 0.5, skin);
  d = ha - el; u = d / norm(d);
  translate(ha + u * 0.5) {
    color(skin) rotate([0, 0, atan2(u[1], u[0])]) scale([0.9, 0.45, 0.75]) sphere(1, $fn = 12);
    for (f = [-40, -12, 15, 42]) let(a = atan2(u[2], norm([u[0], u[1]])) + f * s, h = atan2(u[1], u[0]))
      limb([0, 0, 0], [1.6 * cos(a) * cos(h), 1.6 * cos(a) * sin(h), 1.6 * sin(a)], 0.24, 0.16, skin);
  }
}
arm(SHL, ELL, HAL, 1);
arm(SHR, ELR, HAR, 1);

// ---- the gown: an inner dress (seen through the slit) and the flared cape round it
DRESS = [[22.4, 2.5], [19, 3.0], [15, 4.0], [11, 5.2], [7.5, 6.0], [5.4, 5.8]];
function dressR(z) = lookup(z, [for (i = [len(DRESS) - 1 : -1 : 0]) DRESS[i]]);
DSY = 0.85;
// the slit in the dress's front, over the leg: a wedge narrow at the top, wide at the hem
module slit() hull() {
  translate([0, 0, 13.5]) linear_extrude(0.1) polygon([[0, 0], [9 * cos(-93), 9 * sin(-93)], [9 * cos(-85), 9 * sin(-85)]]);
  translate([0, 0, 2.5]) linear_extrude(0.1) polygon([[0, 0], [9 * cos(-118), 9 * sin(-118)], [9 * cos(-70), 9 * sin(-70)]]);
}
difference() { scale([1, DSY, 1]) lathe([[4.0, 4.9], [5.8, 5.4], [6.0, 7.5], [5.2, 11], [4.0, 15], [3.0, 19], [2.4, 22.6]], navy, 40); color(navy) slit(); }
// a teal-lined lower band on the dress
difference() { scale([1, DSY, 1]) lathe([[4.1, 4.7], [5.95, 5.3], [6.15, 7.4], [5.9, 8.4]], lining, 40); color(lining) slit(); }

// the cape: a cloth sheet from rings round the bodice down a soft flare to the wavy hem, fluted into six folds that
// end in tails flaring out (the two by the slit hang lowest); the front is open between GAP0 and GAP1 over the dress
CY = 0.4;
RINGS = [[3.1, 2.7, 22.6], [6.0, 4.0, 21.0], [9.2, 5.6, 18.8], [12.2, 7.0, 16.4], [14.4, 8.0, 13.8], [15.0, 8.4, 11.2], [13.8, 8.0, 8.0]];
NR = len(RINGS);
GAP0 = -102; GAP1 = -52;
NSEG = 36;
function fold(a) = cos(6 * (a + 82));   // -1 at the tails
function hemW(a) = 1.6 * cos(2 * a) + 2.0 * fold(a) - 3.5 * exp(-pow((a + 52) / 12, 2)) - 1.5 * exp(-pow((a - 258) / 12, 2));
function capeP(i, a, d = 0) = let(R = RINGS[i], t = i / (NR - 1), k = 1 - 0.09 * pow(t, 1.5) * fold(a) + d / R[0])
  [R[0] * k * cos(a), CY + R[1] * k * sin(a), R[2] + pow(t, 3) * hemW(a)];
function segA(j) = GAP1 + j * (360 - (GAP1 - GAP0)) / NSEG;
// a closed sheet over rings i0..i1, between the radial offsets d0 (outside) and d1 (inside)
module capeSheet(i0, i1, d0, d1, c) {
  NI = i1 - i0 + 1; NJ = NSEG + 1;
  pts = concat([for (i = [0 : NI - 1], j = [0 : NJ - 1]) capeP(i0 + i, segA(j), d0)], [for (i = [0 : NI - 1], j = [0 : NJ - 1]) capeP(i0 + i, segA(j), d1)]);
  function O(i, j) = i * NJ + j;
  function I(i, j) = NI * NJ + i * NJ + j;
  faces = [for (i = [0 : NI - 2], j = [0 : NJ - 2]) let(q = [O(i + 1, j), O(i + 1, j + 1), I(i + 1, j + 1), I(i + 1, j), O(i, j), O(i, j + 1), I(i, j + 1), I(i, j)])
    each concat([[q[4], q[5], q[1], q[0]], [q[6], q[7], q[3], q[2]]],
      i == NI - 2 ? [[q[0], q[1], q[2], q[3]]] : [], i == 0 ? [[q[7], q[6], q[5], q[4]]] : [],
      j == NJ - 2 ? [[q[5], q[6], q[2], q[1]]] : [], j == 0 ? [[q[7], q[4], q[0], q[3]]] : [])];
  color(c) polyhedron(pts, faces);
}
capeSheet(0, 4, 0.3, -0.4, navy);
capeSheet(4, NR - 1, 0.3, -0.4, tealDeep);
capeSheet(2, NR - 1, -0.35, -0.9, lining);
// mint edges: the wavy hem and the two front edges of the slit
color(mint) for (j = [0 : NSEG - 1]) hull() { translate(capeP(NR - 1, segA(j), -0.1)) sphere(0.6, $fn = 8); translate(capeP(NR - 1, segA(j + 1), -0.1)) sphere(0.6, $fn = 8); }
for (a = [GAP0, GAP1]) chain([for (i = [0 : NR - 1]) capeP(i, a, -0.1)], [for (i = [0 : NR - 1]) 0.4 + 0.2 * i / (NR - 1)], mint);
// the back panel's edges
for (a = [64, 116]) chain([for (i = [0 : NR - 2]) capeP(i, a, 0.35)], [for (i = [0 : NR - 2]) 0.3], mint);

// cape radius at a height (ignoring the hem wave): [rx, ry]
function capeR(z) = [lookup(z, [for (i = [NR - 1 : -1 : 0]) [RINGS[i][2], RINGS[i][0]]]), lookup(z, [for (i = [NR - 1 : -1 : 0]) [RINGS[i][2], RINGS[i][1]]])];
function inGap(a) = let(b = (a + 540) % 360 - 180) b > GAP0 && b < GAP1;
// a point on the visible gown surface for a front-sheet point (sx, z), pushed out by o, with its normal's angle
function frontHit(sx, z, o) = let(cr = capeR(z), ac = solveA(sx - 0.5 * CY, 0.866 * cr[0], 0.5 * cr[1], true))
  inGap(ac) ? let(r = dressR(z), ad = solveA(sx, 0.866 * r, 0.5 * r * DSY, true)) [[(r + o) * cos(ad), DSY * (r + o) * sin(ad), z], ad]
            : [[(cr[0] + o) * cos(ac), CY + (cr[1] + o) * sin(ac), z], ac];
// the same for a back-sheet point (back screen x = -0.866 x - 0.5 y)
function backHit(sx, z, o) = let(cr = capeR(z), ac = solveA(sx + 0.5 * CY, -0.866 * cr[0], -0.5 * cr[1], false))
  [[(cr[0] + o) * cos(ac), CY + (cr[1] + o) * sin(ac), z], ac];

// the gold constellation: stars on the gown, joined by thin lines painted along the view onto the gown's skin (so a
// line crossing the slit breaks there instead of bridging the air)
module gownSkin() {
  capeSheet(0, NR - 1, 0.45, 0.2, undef);
  difference() { scale([1, DSY, 1]) lathe([[4.15, 4.9], [5.95, 5.4], [6.15, 7.5], [5.35, 11], [4.15, 15], [3.15, 19], [2.55, 22.6]], undef, 40); slit(); }
}
module lines2d(pts, lines) { for (l = lines) hull() { translate(pts[l[0]]) circle(0.17, $fn = 6); translate(pts[l[1]]) circle(0.17, $fn = 6); } }
module constellation(pts, lines, big, back) {
  H = [for (p = pts) back ? backHit(p[0], p[1], 0.3) : frontHit(p[0], p[1], 0.3)];
  if (back) color(gold) intersection() {
    gownSkin();
    rotate([0, 0, 180 + VIEW]) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) lines2d(pts, lines);   // the back sheet as backHit() reads it
    rotate([0, 0, 180 + VIEW]) translate([-50, -60, -5]) cube([100, 60, 60]);
  } else color(gold) intersection() {
    gownSkin();
    pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) lines2d(pts, lines);
    pp(0) translate([-50, -60, -5]) cube([100, 60, 60]);
  }
  for (i = [0 : len(H) - 1]) sparkle(H[i][0], big[i], cream, H[i][1] + 90);
}
constellation([[-1.8, 17.8], [-5.3, 15.3], [-8.2, 14.0], [2.5, 13.2], [5.3, 12.0], [2.0, 11.2], [-3.2, 13.6]],
  [[0, 1], [1, 2], [0, 3], [3, 4], [3, 5], [1, 6]], [1.0, 1.0, 0.8, 1.0, 0.8, 0.8, 0.7], false);
constellation([[0.4, 18.4], [-4.4, 14.5], [-7.4, 13.4], [2.2, 13.4], [0.4, 10.6], [4.3, 10.2]],
  [[0, 1], [1, 2], [0, 3], [3, 4], [3, 5]], [1.0, 1.0, 0.8, 0.9, 0.8, 0.8], true);
// scattered tiny stars in the navy
for (q = [[-160, 12], [-20, 15], [10, 10], [40, 13], [150, 16], [-140, 9.5], [-30, 9], [170, 11], [80, 16], [100, 9.5]])
  let(cr = capeR(q[1])) sparkle([(cr[0] + 0.3) * cos(q[0]), CY + (cr[1] + 0.3) * sin(q[0]), q[1]], 0.38, cream, q[0] + 90);

// ---- slender mint legs tapering to points
chain([[-1.1, -0.4, 13.0], [-1.0, -1.6, 7.0], [-1.3, -2.2, 0.3]], [1.9, 1.35, 0.2], skin);
chain([[1.3, 0, 12.5], [1.5, -0.4, 6.5], [1.9, -0.6, 0.9]], [1.5, 1.0, 0.18], skin);
