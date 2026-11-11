// Voidraith: a tall grim reaper hunched forward in a long dark purple robe. A pale skull deep in a tall rounded hood,
// a draped cowl round the neck, long ragged sleeves with black bony clawed hands reaching out to both sides, the robe
// flowing down in folds to a tattered hem that streams back and out to one side, torn pale patches, purple wisps.
//
// Checklist (front sheet, x = sheet x, z up; 40 units tall):
// - hood: tall rounded cowl x -7.6..0.5, z 29..40, light purple on top, a deep dark opening facing forward-down
// - skull: x -6..-2, z 31.4..35.5, pale bone, two black sockets (no glowing eyes), a dark nose hole, a jaw with teeth
// - cowl: lighter purple drapes round the neck and in a V over the chest down to z 24, dark lines between the loops
// - robe: x -9..8 at z 13, the left edge nearly straight down to (-7, 1); the hem streams out to the right to
//   (18, 2) and (17, 8) as long tatters; vertical folds (light ridges, dark grooves); ragged hem points z 0..4
// - torn pale patches: a sliver at (-5.5, 11.5..15), a diagonal slash at (3.5..6.5, 10.5..15.5), grey slashes on
//   the hem at (8..14, 4..6), a pale bone glint on the near sleeve (8.5..10, 23.5..26) and shoulder (6, 31.5)
// - far arm (creature -X): sleeve out to a ragged cuff at (-11, 21..24), rags hanging under it to z 19, a black
//   bony hand with five long splayed claws to (-18, 20.5) .. (-11.8, 17)
// - near arm (+X): shoulder (5, 29), elbow (9, 26), sleeve flaring to a ragged cuff (10..16, 20..23), a black hand
//   with five long claws hanging to z 14.5 over x 8..14
// - wisps: purple smoke over the far hand (-14..-12, 22..27), behind the near shoulder (3..6, 33..38) and down the
//   near side by the hem (10..15, 8..16)
// - back: the hood and the robe's back with the cowl's light folds, the hem streaming to the viewer's left (the
//   creature's +X and back), the near arm's claws low on the left
include <lib.scad>

robe = [0.18, 0.13, 0.20];
robeLt = [0.31, 0.24, 0.34];
robeMd = [0.25, 0.19, 0.29];
robeDk = [0.09, 0.07, 0.11];
hoodC = [0.33, 0.26, 0.37];
void = [0.03, 0.02, 0.04];
bone = [0.85, 0.83, 0.77, NOGLOW];
boneDk = [0.55, 0.51, 0.49];
grey = [0.72, 0.72, 0.72, NOGLOW];
claw = [0.07, 0.05, 0.08];
magic = [0.37, 0.22, 0.45, NOGLOW];

// A scad point for a point read off the front sheet at depth y, with the camera's 10 deg tilt taken out.
function W(s, z, y) = let(x = (s - 0.5 * y) / 0.866) [x, y, z - 0.17 * (-0.5 * x + 0.866 * y)];

// ---- Ribbons (as in velvetomb.scad): a Catmull-Rom curve through P swept by thin flat ellipses, half-width Wv[i] at
// each control point, the band's face looking along N, hulled in short steps. rigs/voidraith.mjs repeats this maths.
CAM = [0.5, -0.866, 0];
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
module ribbon(P, Wv, N, th, c, rk = 2) {
  m = (len(P) - 1) * rk;
  color(c) for (j = [0 : m - 1]) hull() { _rstep(P, Wv, N, th, j / rk); _rstep(P, Wv, N, th, (j + 1) / rk); }
}
module e(r, p, c, fn = 14) color(c) translate(p) scale(r) sphere(1, $fn = fn);

// ---- Robe: a loft of tilted ellipses (centre, half-length along the trailing direction +X+Y, half-width across).
// The upper robe hangs straight under the shoulders; lower down it leans and stretches back and to +X, so the hem
// streams out to one side like the art.
SL = [
  [[0.6, 0.3, 30.6], 4.6, 4.2],
  [[0.4, 0.4, 25.5], 5.5, 5.0],
  [[0, 0.7, 19], 6.8, 6.2],
  [[-0.8, 1.2, 13], 8.4, 7.2],
  [[1.3, 2.6, 7.5], 10.6, 8],
  [[3.0, 4.6, 3.6], 12.4, 8.6],
];
function r45(v) = [0.7071 * (v[0] - v[1]), 0.7071 * (v[0] + v[1])];
// The robe surface at parametric angle t on slice i (k scales out from the centre) and its outward normal.
function sp(i, t, k = 1) = let(s = SL[i], l = r45([s[1] * cos(t) * k, s[2] * sin(t) * k])) [s[0][0] + l[0], s[0][1] + l[1], s[0][2]];
function sn(i, t) = let(s = SL[i], n = r45([cos(t) / s[1], sin(t) / s[2]])) _unit([n[0], n[1], 0]);
// ... and at any height z (linear between the two slices around it).
function _si(z) = z >= SL[1][0][2] ? 1 : z >= SL[2][0][2] ? 2 : z >= SL[3][0][2] ? 3 : z >= SL[4][0][2] ? 4 : 5;
function surf(t, z) = let(i = _si(z), f = (SL[i - 1][0][2] - z) / (SL[i - 1][0][2] - SL[i][0][2]),
  a = sp(i - 1, t), b = sp(i, t)) [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, z];
function surfN(t, z) = let(i = _si(z)) _unit(sn(i - 1, t) + sn(i, t));

module disc(s) translate(s[0]) rotate([0, 0, 45]) scale([s[1], s[2], 1]) cylinder(r = 1, h = 0.05, $fn = 30);
color(robe) for (i = [0 : len(SL) - 2]) hull() { disc(SL[i]); disc(SL[i + 1]); }

// A flat mark lying on the robe at (t, z): w wide, h tall, turned `tilt` in the surface plane, `o` proud.
module mark(t, z, w, h, tilt, c, o = 0.55) {
  p = surf(t, z);
  n = surfN(t, z);
  color(c) translate(p + n * o) rotate([0, 0, atan2(n[1], n[0])]) rotate([tilt, 0, 0]) scale([0.3, w, h]) sphere(1, $fn = 10);
}

// Folds running down the robe into the ragged hem: each a band on the surface (light ridge or dark groove) that
// leaves the hem as a tatter, the trailing ones (t near 0, +X+Y) long and streaming out low, the front ones short.
// [t, start slice, tip reach, tip z, colour 0 robe / 1 light / 2 dark]
FOLDS = [
  [0, 1, 1.16, 0.3, 0], [20, 2, 1.14, 0.6, 2], [40, 1, 1.1, 0.2, 1], [60, 2, 1.08, 1.0, 0], [80, 2, 1.07, 0.4, 2],
  [100, 1, 1.05, 1.2, 0], [120, 2, 1.04, 0.5, 1], [140, 2, 1.03, 1.4, 2], [160, 1, 1.03, 0.3, 0], [180, 2, 1.02, 1.1, 1],
  [198, 2, 1.03, 0.2, 2], [214, 1, 1.02, 1.0, 1], [230, 2, 1.03, 0.3, 0], [246, 2, 1.03, 1.3, 2], [262, 1, 1.05, 0.2, 1],
  [280, 2, 1.1, 0.9, 0], [298, 1, 1.12, 0.3, 2], [316, 2, 1.14, 1.1, 1], [336, 1, 1.16, 0.2, 0],
];
FC = [robe, robeLt, robeDk];
for (F = FOLDS) let(t = F[0], i0 = F[1], k = F[2], lean = 0.5 + 0.5 * cos(t),
  P = concat([for (i = [i0 : 5]) sp(i, t, 1.015) + [0, 0, i == 5 ? 0.6 : 0]],
             [sp(5, t, 1 + (k - 1) * 0.5) + [lean * 0.5, lean * 0.5, -1.6 - F[3] * 0.3],
              sp(5, t + (t < 180 ? -6 : 6) * lean, k) + [lean * 0.9, lean * 0.9, F[3] - 3.6]]),
  Wv = concat([for (i = [i0 : 5]) i == 1 ? 0.7 : i == 2 ? 1.2 : 0.8 + 0.25 * i], [1.1, 0.12]))
  ribbon(P, Wv, sn(5, t), 0.5, FC[F[4]]);

// Long tatters fluttering out from the trailing side above the hem (the art's streaks to (17, 8) and (16.7, 5.4)).
ribbon([sp(4, 330, 0.98), sp(4, 330, 1.06) + [1, 0.4, -0.6], sp(4, 340, 1.1) + [1.8, 0.8, -0.8], sp(4, 345, 1.12) + [2.6, 1, -0.2]],
       [1.4, 1.2, 0.7, 0.1], [0, 0, 1], 0.45, robeDk);
ribbon([sp(4, 350, 0.98) + [0, 0, -2], sp(4, 350, 1.05) + [0.6, 0.6, -3], sp(4, 355, 1.08) + [1.4, 1.2, -3.8], sp(4, 0, 1.1) + [2.2, 1.6, -3.6]],
       [1.4, 1.2, 0.7, 0.1], [0, 0, 1], 0.45, robeMd);

// Torn patches: pale cloth / bone showing through.
mark(215, 13.2, 0.7, 2.0, -8, bone);
mark(296, 13, 0.65, 2.7, -32, bone);
mark(300, 12.2, 0.4, 1.8, -32, boneDk, 0.6);
mark(290, 5.4, 0.4, 1.6, 70, grey, 0.7);
mark(310, 5.0, 0.4, 1.3, 75, grey, 0.7);
mark(55, 5.2, 0.4, 1.3, 75, grey, 0.7);

// ---- Cowl: lighter purple drapes round the neck and loops hanging over the chest.
e([5.8, 5, 2.3], [0.4, -0.2, 28.6], robeMd, 28);
ribbon([[-4.2, -2.8, 29.4], [-2.4, -5.0, 27.2], [0.4, -5.6, 26], [3.0, -4.6, 27.4], [4.6, -2.2, 29.4]], [1.1, 1.4, 1.5, 1.4, 1.1],
       [0, -1, 0.15], 0.7, robeLt, 3);
ribbon([[-3.2, -4.0, 27], [-1.4, -5.6, 24.8], [0.6, -5.8, 24], [2.2, -5.4, 25.2], [3.6, -4.2, 27]], [0.9, 1.2, 1.2, 1.1, 0.8],
       [0, -1, 0.1], 0.6, robeLt, 3);
color(robeDk) hull() { translate([-1.2, -5.9, 25.6]) sphere(0.3, $fn = 6); translate([1.8, -5.9, 25.6]) sphere(0.3, $fn = 6); }

// ---- Hood: a tall rounded cowl merging into the shoulders, a deep dark opening, the skull inside.
H = W(-2.9, 35.2, -4.5);
color(hoodC) difference() {
  hull() {
    translate(H) scale([3.8, 4.8, 4.7]) sphere(1, $fn = 30);
    translate([0.6, 0.8, 31.4]) scale([4.6, 4, 2]) sphere(1, $fn = 20);
  }
  translate(H + [0, -4.9, -1.3]) scale([2.9, 3.2, 3.5]) sphere(1, $fn = 26);
}
e([3.0, 2.6, 3.4], H + [0, -1.9, -1.0], void, 22);

// Skull: facing forward, tipped down a little, set deep in the hood.
SK = W(-3.8, 33.4, -7.4);
translate(SK) rotate([-10, 0, 0]) scale(1.15) {
  e([1.6, 1.75, 1.85], [0, 0, 0.5], bone, 22);                     // cranium and brow
  e([1.25, 1.3, 0.9], [0, -0.5, -1.0], bone, 18);                  // cheekbones and upper jaw
  e([0.9, 0.95, 0.7], [0, -0.55, -2.0], boneDk, 14);               // jaw, in the hood's shadow
  mirror_x() e([0.62, 0.42, 0.66], [0.72, -1.52, 0.05], void, 14); // sockets
  e([0.24, 0.24, 0.34], [0, -1.86, -0.75], void, 8);               // nose
  color(void) for (x = [-0.6 : 0.4 : 0.6]) translate([x * 0.85, -1.36, -1.6]) cube([0.11, 0.3, 0.55], center = true);
}

// ---- Arms: long ragged sleeves, black bony hands with long splayed claws.
// A children's +Z axis laid along p1 -> p2.
module along(p1, p2) let(d = p2 - p1) translate(p1) rotate([0, acos(d[2] / norm(d)), atan2(d[1], d[0])]) children();
// Sleeve: the upper arm a capsule, the forearm a bell flaring to an open cuff (dark inside) past cu.
module sleeve(sh, el, cu, rs, c = robe) {
  limb(sh, el, rs[0], rs[1], c);
  L = norm(cu - el) * 1.12;
  along(el, cu) {
    color(c) difference() {
      cylinder(h = L, r1 = rs[1], r2 = rs[2], $fn = 18);
      translate([0, 0, L * 0.5]) cylinder(h = L, r1 = rs[1] * 0.45, r2 = rs[2] * 0.86, $fn = 18);
    }
    color(robeDk) translate([0, 0, L * 0.52]) cylinder(h = 0.05, r = rs[1] * 0.7, $fn = 14);
  }
}
module fingers(base, tips) for (q = tips) chain([base, base + (q - base) * 0.45 + [0, 0, 0.4], q], [0.42, 0.3, 0.07], claw);

// Far arm (-X): reaching out to the side.
SHR = [-4.4, -0.6, 27.4];
ELR = [-8.6, -2.8, 23.2];
CUR = [-10.6, -4.0, 21.2];
HR = [-12.4, -4.8, 21.0];
sleeve(SHR, ELR, CUR, [2.2, 1.9, 2.6]);
color(robeLt) hull() { translate(SHR + [0, 0, 1.2]) sphere(1.2, $fn = 10); translate(ELR + [0, 0, 1.2]) sphere(0.9, $fn = 10); }
for (q = [[0, 0.8, 3.4], [0.6, -0.4, 2.8], [1.6, 0.6, 3.8], [2.6, 0.2, 3.2]])
  ribbon([CUR + [q[0], q[1], -1.2], CUR + [q[0] + 0.2, q[1] - 0.3, -1.2 - q[2] * 0.55], CUR + [q[0] + 0.5, q[1] - 0.2, -1.2 - q[2]]],
         [0.9, 0.6, 0.1], CAM, 0.4, robeDk);
limb(CUR + (ELR - CUR) * 0.3, HR, 0.75, 0.6, claw);
e([1.1, 0.9, 0.95], HR, claw, 10);
fingers(HR, [W(-18, 20.4, -5.4), W(-17.4, 18.4, -5.6), W(-15.6, 16.4, -6.2), W(-13.6, 15.6, -6.0), W(-11.8, 17.0, -5.4)]);
// Near arm (+X): shoulder out, elbow bent, the forearm hanging down and out.
SHL = [5.6, 0.4, 30.2];
ELL = [11.6, -0.8, 27.8];
CUL = [14.8, -1.6, 24.2];
HL = [14.6, -3.2, 20.2];
sleeve(SHL, ELL, CUL, [2.5, 2.1, 3.3]);
color(robeLt) hull() { translate(SHL + [0, 0, 1.3]) sphere(1.2, $fn = 10); translate(ELL + [0, 0, 1.2]) sphere(0.9, $fn = 10); }
for (q = [[1.8, -0.4, [1.8, 0, -2.6]], [1.4, 1.0, [1.6, 0.6, -3.8]], [-0.2, -0.6, [0.4, 0, -3.4]], [-1.6, 0.2, [-0.6, 0, -2.8]]])
  ribbon([CUL + [q[0], q[1], -0.6], CUL + [q[0], q[1], -0.6] + q[2] * 0.5 + [0, 0, 0.3], CUL + [q[0], q[1], -0.6] + q[2]],
         [0.9, 0.6, 0.1], CAM, 0.4, robeDk);
e([0.5, 1.4, 0.4], [12.8, -3.0, 26.2], boneDk, 10);                // bone glint on the sleeve
e([0.45, 0.9, 0.35], [13.0, -3.3, 25.8], bone, 10);
e([0.55, 0.5, 0.4], [6.2, -1.8, 32.4], bone, 10);                  // shoulder bone
limb(CUL + (ELL - CUL) * 0.3, HL, 0.75, 0.6, claw);
e([1.0, 0.9, 1.1], HL, claw, 10);
fingers(HL, [W(8.0, 17.0, -4.6), W(9.6, 15.2, -4.8), W(11.2, 14.5, -4.8), W(12.9, 15.4, -4.4), W(14.4, 17.2, -4)]);

// ---- Purple wisps: thin smoke curls with a few motes.
module wisp(P, wd) ribbon(P, wd, CAM, 0.35, magic, 3);
wisp([W(-13.2, 22.2, -4.6), W(-14.2, 24, -4.6), W(-12.8, 25.6, -4.6), W(-13.6, 27, -4.6)], [0.55, 0.5, 0.35, 0.1]);
wisp([W(2.6, 31.4, 2), W(4.4, 33.6, 2.4), W(3.6, 35.8, 2.6), W(5.2, 37.8, 2.8)], [0.6, 0.55, 0.4, 0.1]);
wisp([W(9.6, 8.8, -1), W(11.4, 9.6, -1), W(12.4, 10.8, -1), W(12.8, 12.4, -1)], [0.55, 0.5, 0.35, 0.1]);
wisp([W(13.4, 13.4, -1), W(14.2, 14.6, -1), W(14.6, 16, -1)], [0.35, 0.3, 0.08]);
for (m = [[-15.6, 23.4, -4], [-11.6, 26.4, -4.4], [-16.4, 21.8, -5], [5.8, 38.6, 3], [3.4, 37.4, 2.4], [15.4, 13.2, -1],
          [13.4, 16.6, -1.4], [15.8, 9.8, 0]])
  color(magic) translate(W(m[0], m[1], m[2])) rotate([20, 30, 10]) cube(0.55, center = true);
