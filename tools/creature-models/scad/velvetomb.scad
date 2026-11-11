// Velvetomb: a ghostly dark-violet shadow mass. A small white mask (cat-eye slant, a dark widow's peak with a mauve
// gem) set in a tall dark hood with one horn and a long peak curling at its tip, a white smoky crown, a white V
// collar, wavy smoke ribbons streaming back off the crown and shoulders with curled tips, a soft drifting cloak of
// layered drapes tapering into wispy points over big billowing clouds, a glowing pale orb before its chest, a sleeve reaching out
// with a grey clawed hand, a grey crescent claw on the near side and two small talon feet under the smoke.
//
// Checklist (front sheet, x = sheet x, z up; 40 units tall):
// - mask x -8..-3.2, z 28.3..33.1, a pointed chin at (-6.2, 28.2); the hood's dark V cuts down into the brow to
//   (-5.8, 31.4) with a mauve diamond at (-6.4, 33.2); eyes: two dark slanted almonds, far (-7.5, 30.6), near
//   (-5, 30.8), a small lilac pupil, the lids sloping down to the nose (a sly glare); a short mouth line at z 28.8
// - hood: a dark horn at (-7.5, 36.8), the hood peak rising up-right to a hook at (2.5, 39.6); a white smoky crown
//   x -8..2, z 33.5..38.5 that runs into the top stream; a dark cowl point out to (-10.6, 32.2)
// - collar: a white V under the mask, arms from (-10, 30) and (0, 29) to a point at (-7.6, 22.5), dark inside
// - streams (all to the viewer's right, flowing back): A lilac-white along z 37..39 to a hook at (13, 37.6) with a
//   lilac spiral under it at (10, 35.3); B mid purple z 29..33 to a hook at (15.8, 33); C dark z 26..28 to a hook at
//   (17.6, 27) with a lilac spiral at (13.5, 26); D a lilac swirl at (8.5..12, 22..25)
// - body: a dark violet cloak mass x -14.5..13, z 4..27, folds, a ragged hem that frays into smoke puffs
//   (white / lilac / mauve) along z 3..11 and a big white cloud on the right x 6..15, z 4..16
// - far arm (creature -X): sleeve out to a lilac cuff at (-15..-12.5, 17.5..24), a dark grey claw fist at
//   (-18..-15.3, 19.3..24) with curled claws
// - near hand (+X): a grey crescent claw at (3.4..7.9, 15.6..18.4) over a dark hand
// - orb: glowing pale lilac at (-7.6, 19), r 1.8 core, r 2.5 halo
// - talons: far (-14..-11.3, 1.4..4.6), near (0..3.2, 0..3.7), three toes each
// - back: the dark cloak with a violet glow at its middle (the orb through it), the streams to the +X side, a white
//   S tendril with spiral curls down the +X flank, the hood horn and mask peeking at the top right
include <lib.scad>

ink = [0.08, 0.03, 0.14];
dark = [0.15, 0.06, 0.24];
robe = [0.28, 0.14, 0.34];
robeMid = [0.40, 0.28, 0.46];
mauve = [0.56, 0.45, 0.62, NOGLOW];
lilac = [0.80, 0.72, 0.83, NOGLOW];
pale = [0.91, 0.85, 0.94, NOGLOW];
white = [0.97, 0.95, 0.97, NOGLOW];
mask = [0.97, 0.95, 0.98, NOGLOW];
gem = [0.62, 0.48, 0.74, NOGLOW];
pupil = [0.80, 0.68, 0.92, NOGLOW];
claw = [0.40, 0.36, 0.44];
clawLt = [0.68, 0.63, 0.64, NOGLOW];
talon = [0.66, 0.58, 0.72, NOGLOW];
orbC = [0.88, 0.82, 1.00, GLOW];
orbCore = [1.00, 0.99, 1.00, GLOW];
backGlow = [0.46, 0.32, 0.72, GLOW];

// A scad point for a point read off the front sheet at depth y, with the camera's 10 deg tilt taken out.
function W(s, z, y) = let(x = (s - 0.5 * y) / 0.866) [x, y, z - 0.17 * (-0.5 * x + 0.866 * y)];

// ---- Ribbons (as in rimeidol.scad): a Catmull-Rom curve through P swept by thin flat ellipses, width Wv[i] at each
// control point, the band's face looking along N, hulled in short steps. rigs/velvetomb.mjs repeats this maths.
CAM = [0.5, -0.866, 0];
CAMB = [0.5, 0.866, 0];
RK = 3;
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
module ribbon(P, Wv, N, th, c, rk = RK) {
  m = (len(P) - 1) * rk;
  color(c) for (j = [0 : m - 1]) hull() { _rstep(P, Wv, N, th, j / rk); _rstep(P, Wv, N, th, (j + 1) / rk); }
}

// A low-poly ellipsoid for the small parts (lib ell() is 28 segments).
module e(r, p, c, fn = 14) color(c) translate(p) scale(r) sphere(1, $fn = fn);

// ---- Head: the mask in its hood, turned HY towards the camera.
H = W(-4.8, 30.5, -4);
HY = 20;
module headLocal() {
  // Hood: a rounded cowl, its front opening a soft rim round the mask.
  color(robe) hull() {
    translate([0, 1, 1.2]) scale([3.3, 3.6, 4.1]) sphere(1, $fn = 24);
    for (a = [0 : 30 : 359]) translate([2.9 * sin(a), -2.5, 0.5 + 3.3 * cos(a)]) sphere(0.9, $fn = 10);
  }
  // Hood horn on the far (-X) side.
  spike([-2.2, -0.9, 3.8], [-1, 0, 3.6], 1.2, 0.15, robe);
  // Mask: a broad brow narrowing to a pointed chin.
  color(mask) hull() {
    translate([0, -3.2, 1.0]) scale([2.45, 1.25, 1.55]) sphere(1, $fn = 24);
    translate([0, -3.3, -0.7]) scale([1.6, 1.05, 1]) sphere(1, $fn = 16);
    translate([0, -3.4, -2.2]) sphere(0.45, $fn = 10);
  }
  // The hood's dark widow's peak down into the brow, a mauve diamond on it.
  color(robe) hull() {
    translate([-2.3, -3.85, 2.45]) scale([0.4, 0.3, 0.3]) sphere(1, $fn = 8);
    translate([2.3, -3.85, 2.45]) scale([0.4, 0.3, 0.3]) sphere(1, $fn = 8);
    translate([0, -4.45, 0.75]) scale([0.3, 0.3, 0.3]) sphere(1, $fn = 8);
  }
  color(gem) translate([0, -4.55, 1.85]) rotate([0, 45, 0]) scale([0.42, 0.25, 0.42]) cube(1, center = true);
  // Eyes: dark slanted almonds with a small lilac pupil, the lids sloping down to the nose.
  mirror_x() eye([1.22, -4.0, 0.1], 0.7, iris = ink, sclera = ink, pupil = pupil, yaw = 14, lid = 0.3,
                 lid_tilt = 24, lid_c = mask, squint = 0.1, slit = 0.9);
  // Short mouth line over the chin.
  color(ink) translate([0.15, -4.3, -1.35]) rotate([0, 8, 0]) scale([0.55, 0.2, 0.09]) sphere(1, $fn = 8);
}
translate(H) rotate([0, 0, HY]) headLocal();

// ---- Body: a soft cloak mass (the drapes and smoke below carry its edge).
BODY = [
  [[6, 5, 3.5], [-2.5, 0, 24.5]],
  [[7.6, 6.4, 4], [-1, 0.5, 16]],
  [[9, 7.4, 3], [0.8, 1.6, 9.5]],
];
blob(BODY, robe);
// The violet glow of the orb through the back of the cloak.
e([3.4, 1.2, 3.6], [1.2, 6.9, 19], backGlow, 16);
// Drapes: folds of smoke hanging from the waist, twisting round the body as they flare out, each tapering to a ragged
// wispy point at its own length; the lower points drift to +X (and back), so the mass leans and flows to the right
// like the art instead of standing as a cone.
function rad(a) = [sin(a), -cos(a), 0];
DLO = [2.2, 5.6, 3, 6.6, 4.2, 1.6, 5, 2.6, 6.2, 3.8];
LEAN = [2.6, 1.5, 0];
DRAPES = [for (k = [0 : 9]) let(a = k * 36 + 10, lo = DLO[k], sw = k % 2 == 0 ? 12 : -10)
  [[rad(a) * 5.6 + [0, 0, 22], rad(a + 9) * 8.4 + LEAN * 0.3 + [0, 0, 15], rad(a + 20) * 10.6 + LEAN * 0.6 + [0, 0, 9.5],
    rad(a + 28) * 11.4 + LEAN * 0.85 + [0, 0, lo + 2.4], rad(a + 28 + sw) * 12.6 + LEAN + [0, 0, lo]], rad(a + 12), k]];
for (D = DRAPES) ribbon(D[0], [3, 4, 3.2, 1.7, 0.15], D[1], 1.3, D[2] % 3 == 0 ? dark : (D[2] % 3 == 1 ? robe : robeMid), 2);
// The cloak's far edge under the reaching arm, sweeping down and out.
ribbon([W(-8.4, 23, -2), W(-11.6, 18, -2), W(-14, 13.4, -1.5), W(-15, 9.6, -1)], [2.4, 2.8, 2.4, 0.6], CAM, 0.9, robe);
// Dark cowl point off the far shoulder.
spike(W(-8.6, 28, -3), [-1.6, 0.6, 4.4], 1.4, 0.15, robe);

// ---- White V collar under the mask (two lapels meeting in a point, dark between them).
color(white) hull() for (p = [W(-10, 29.6, -3), W(-8.9, 26.4, -6.6), W(-7.6, 22.8, -8.2), W(-7.6, 27.4, -7)])
  translate(p) scale([0.8, 0.5, 0.8]) sphere(1, $fn = 10);
color(white) hull() for (p = [W(-1.2, 29, -4.5), W(-3.6, 27, -7.2), W(-7.6, 22.8, -8.2), W(-3, 29.2, -5.8)])
  translate(p) scale([0.8, 0.5, 0.8]) sphere(1, $fn = 10);

// ---- Far arm (-X): a sleeve reaching out, a smoky lilac cuff, a dark grey claw fist with curled claws.
limb([-6, 0, 25], [-13.4, -2.4, 21.8], 2.0, 2.6, robe);
e([1.6, 2.9, 3], [-14.4, -2.8, 21.6], lilac, 16);
e([1.2, 1.8, 1.6], [-14.2, -3.6, 19.6], pale);
e([1.6, 1.5, 1.6], [-16.4, -3, 22], claw);
for (k = [0 : 2]) let(y = -4.1 + 1.1 * k)
  chain([[-16.8, y, 23.3], [-18.2, y, 23], [-18.7, y, 21.6], [-17.9, y, 20.6]], [0.6, 0.5, 0.32, 0.12], claw);

// ---- Near arm (+X): a dark sleeve down the front, a dark hand under a grey crescent claw.
limb([5.4, -3.4, 21.4], [8.4, -5.4, 18.2], 2.1, 1.8, robe);
e([1.7, 1.5, 1.5], [9.3, -6.6, 16.8], dark);
pp(-11.2) translate([5.6, 0, 16.5]) rotate([90, 0, 0]) rotate([0, 0, 15]) color(clawLt)
  rotate_extrude(angle = 150, $fn = 24) translate([1.8, 0]) scale([1, 1.4]) circle(0.42, $fn = 8);

// ---- The orb before the chest: a pale lilac halo round a white core.
ORB = W(-7.6, 19, -9.6);
e([2.4, 2.4, 2.4], ORB, orbC, 22);
e([1.5, 1.5, 1.5], ORB + [0.3, -1.2, 0.1], orbCore, 16);

// ---- Talon feet under the smoke: a dark shank out of the cloak, three pale talons.
module foot(p) {
  limb(p + [0, 0.6, 5.6], p + [0, 0, 1.6], 1, 0.85, dark);
  for (t = [-35, 0, 35]) spike(p + [0, -0.3, 1.2], [1.6 * sin(t), -1.8 * cos(t), -1.4], 0.42, 0.05, talon);
}
foot([5.4, -5.2, 0]);
foot([-10, -4, 0]);

// ---- Smoke: three big soft billowing clouds (a white hull of a few flattened spheres, lilac shade lumps under it,
// white lumps on top): the large one on the lower +X side, one under the front of the body, a small one far -X.
module cloud(core, lumps) {
  color(white) hull() for (q = core) translate(q[0]) scale(q[1]) sphere(1, $fn = 14);
  for (q = lumps) color(q[2]) translate(q[0]) scale(q[1]) sphere(1, $fn = 12);
}
CLOUD_R = [[W(10.6, 9, -2), [3.6, 3, 2.6]], [W(12.6, 13, 0.5), [2.8, 2.4, 2.2]], [W(8.4, 5.4, -3), [2.8, 2.4, 2]], [W(13.2, 6.2, 2.5), [2.8, 2.4, 2]]];
LUMPS_R = [[W(9.6, 4.6, -1), [2.6, 2.2, 1.6], lilac], [W(13, 4.8, 3), [2.4, 2, 1.6], lilac], [W(11.6, 15.6, 1), [2.2, 1.9, 1.7], white],
           [W(8, 11.8, -4.2), [2.2, 1.9, 1.8], pale], [W(13.9, 10.4, 1.5), [2.1, 1.8, 1.7], white], [W(10.2, 7.8, -5.4), [2.3, 1.6, 1.9], white],
           [W(14.8, 7.4, 4), [1.8, 1.6, 1.5], pale], [W(12, 11.6, -3.2), [1.7, 1.4, 1.5], pale]];
CLOUD_U = [[W(-6, 6.6, -10.5), [2.6, 2.1, 2]], [W(-2.2, 8, -10.8), [2.2, 1.9, 1.7]], [W(-1, 5, -10.8), [2.4, 2, 1.8]]];
LUMPS_U = [[W(-3, 3.8, -9.4), [2.2, 1.8, 1.3], lilac], [W(-7.8, 8.4, -9.6), [1.8, 1.5, 1.4], white],
           [W(-3.6, 9.8, -10.6), [1.6, 1.4, 1.3], pale], [W(-4.4, 5.6, -12.2), [1.8, 1.2, 1.4], white], [W(0.6, 7.4, -11.6), [1.5, 1.3, 1.3], pale]];
CLOUD_L = [[W(-15.6, 8.4, -3), [2.4, 2, 2]], [W(-14.4, 10.8, -2), [1.8, 1.6, 1.5]], [W(-16, 5.8, 0), [1.9, 1.7, 1.5]]];
LUMPS_L = [[W(-13.4, 5.6, -5), [1.8, 1.6, 1.3], lilac], [W(-16.6, 9.8, -2), [1.5, 1.3, 1.3], pale], [W(-14.6, 7.2, -5.4), [1.5, 1.2, 1.3], white]];
cloud(CLOUD_R, LUMPS_R);
cloud(CLOUD_U, LUMPS_U);
cloud(CLOUD_L, LUMPS_L);
// Mauve wisps under the streams on the right flank.
module puff(p, r, c) color(c) translate(p) scale([r, r * 0.85, r * 0.75]) sphere(1, $fn = 12);
puff(W(12.6, 20.6, 3), 2.4, mauve);
puff(W(14.2, 17.6, 4), 2.2, robeMid);

// ---- Smoke streams off the crown and shoulders, flowing back to +X with curled tips.
// Hood peak: up and right to a hook.
RH = [W(-5.2, 33.6, -1), W(-2.4, 36, 0.5), W(0.2, 38.4, 2), W(2.4, 39.7, 3), W(3.6, 39.2, 3.2), W(2.8, 38.5, 3.2)];
WH = [2.8, 2.2, 1.5, 1, 0.6, 0.15];
// A: the white crown running into the top stream.
RA = [W(-8.2, 34.2, -5), W(-5.6, 36.8, -4.4), W(-2, 37.8, -1.5), W(2, 36.8, 2), W(6, 37.4, 5), W(9.6, 37, 7), W(11.9, 38.6, 8),
      W(13.2, 37.6, 8.4), W(12.5, 36.9, 8.4)];
WA = [1.6, 2.4, 2.5, 2.2, 2, 1.6, 1.1, 0.6, 0.15];
// A2: the lilac spiral under A.
RA2 = [W(0.5, 34.2, 3), W(5, 34.2, 5), W(8.6, 33.6, 7), W(10.9, 34.6, 8), W(10.5, 36, 8), W(9.4, 35.3, 8)];
WA2 = [2.2, 2.2, 1.9, 1.3, 0.8, 0.15];
// B: mid purple to a hook at the top right.
RB = [W(-1, 31, 1.5), W(4.5, 32.2, 4), W(9.4, 29.8, 6.5), W(13, 31.4, 8.5), W(15.4, 32.6, 9.5), W(15.2, 33.6, 10), W(14.4, 32.9, 10)];
WB = [2.8, 2.6, 2.2, 1.8, 1.1, 0.6, 0.15];
// C: dark, low, to a hook at the far right.
RC = [W(1.5, 27.4, 1.5), W(7, 26.6, 4.5), W(11, 28.2, 7), W(14.6, 27.4, 9), W(16.8, 28, 10), W(17.7, 26.9, 10.5), W(16.9, 26.2, 10.5)];
WC = [3, 2.6, 2.2, 1.6, 1.1, 0.6, 0.15];
// C2: the lilac spiral on C.
RC2 = [W(10.6, 25, 6.5), W(13.2, 24.6, 8), W(14.6, 25.9, 8.5), W(13.7, 27, 8.5), W(12.9, 26.2, 8.5)];
WC2 = [1.8, 1.5, 1.1, 0.7, 0.15];
// D: the lilac swirl over the right flank.
RD = [W(3.5, 23.4, 2.5), W(7.6, 24.2, 5), W(10.8, 23.8, 6.5), W(11.8, 22.4, 7), W(10.6, 21.8, 7)];
WD = [2.6, 2.2, 1.6, 0.8, 0.15];
// E: the white S tendril down the +X flank at the back, curling at its end.
RE = [[7, 4, 22], [11, 4.5, 19.5], [13.6, 4.5, 16], [13.8, 5, 12.4], [11.6, 6, 10], [12.6, 6.6, 8], [14.4, 5.6, 8.6]];
WE = [1.6, 1.8, 1.8, 1.6, 1.3, 0.8, 0.15];

ribbon(RH, WH, CAM, 0.9, robe);
ribbon(RA, WA, CAM, 0.9, pale);
ribbon(RA2, WA2, CAM, 0.8, mauve);
ribbon(RB, WB, CAM, 0.9, robeMid);
ribbon(RC, WC, CAM, 0.9, robe);
ribbon(RC2, WC2, CAM, 0.7, lilac);
ribbon(RD, WD, CAM, 0.8, mauve);
ribbon(RE, WE, CAMB, 0.8, pale);
