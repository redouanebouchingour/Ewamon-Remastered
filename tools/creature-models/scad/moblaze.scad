// Moblaze, rebuilt from the measurement sheet (front height 40, feet z = 0). Moflame grown into a fire hound.
//
// Checklist (front sheet x, z; the scad's x = 0 reads about -8 on the sheet, see S()):
// - Body plan: a lean long fire dog seen side-on, face to the viewer's left, the head turned to look at the viewer.
//   Torso long along Y (chest y -9, rump y 8), which the 30 degree view halves; the neck turned towards the
//   creature's right, the flame tail fanned out to its left so both read as wide as the art.
// - Head x -26..-12, z 17..33: a broad dog head with a short muzzle, tan shaggy cheeks; turned 15 degrees towards
//   the viewer (the nose a little left of the eyes' middle).
// - Eyes: two narrow fierce slanted eyes, amber iris, a white glint, a dark brow slanting down to the nose:
//   near (-17.2, 24.2), far (-23.1, 23.7).
// - Nose: a big black nose (-21.6, 21); a closed smirk below it (-22.5..-19, 19.5); tan chin.
// - Ears: pointed, flaring out sideways, brown with an orange inside: near tip (-11.5, 31), far tip (-27, 30).
// - Two brown horn-like fur locks flanking the crest: tips (-24.2, 33.5) and (-15.5, 33).
// - Crest: a tall candle flame from the forehead (-19, 25) to its tip (-16, 40), cream core, orange, red rim.
// - Streamer: a billowing flame banner from the crest back over the body to (3, 37), licks on top, red underside.
// - Ruff: a big shaggy tan ruff over the chest and under the head, x -26..-10, z 8..24, ragged lower edge.
// - Torso: orange-brown, back line z 23..24, belly z 9..10, a black harness band behind the shoulder, ring marks.
// - Legs: thick brown legs, near front (-13), far front (-19), far back (-6.5), near back (+2); glowing ember
//   diamonds on the front legs at z 10 and on the shoulder and haunch.
// - Tail: a cream bushy tail curling up behind the near hind leg (0..6, 8..16).
// - Flame tail: a huge fan of flame tongues streaming right from the rump top (0, 21): tips (21, 39) (16.5, 36)
//   (26.5, 27) (23, 22) (23, 14.6) (20, 13.4) (16, 10.5) (13, 9.7); orange and yellow, red only at the tips
//   and edges, a pale core near the root, the tongues wavy and merging into one soft mass.
// - Embers: (8, 35), (21.5, 29.5), (22.5, 18.5), (12, 9.5).
// - Back: dark stripes over the back and flanks, the fan's root over the rump, the tan belly.
// - Glow: the sprite's orange (#f79011) glows; here the flames' pale cores and the embers' hearts glow (see below).
include <lib.scad>

fur     = [0.61, 0.36, 0.24];
coat    = [0.82, 0.45, 0.25];
furDk   = [0.44, 0.32, 0.23];
tan     = [0.69, 0.54, 0.38];
cream   = [0.85, 0.74, 0.53];
ink     = [0.15, 0.09, 0.07];
earIn   = [0.89, 0.61, 0.31, NOGLOW];
iris    = [0.97, 0.57, 0.07, NOGLOW];
sclera  = [0.99, 0.93, 0.72, NOGLOW];
red     = [0.73, 0.11, 0.05, NOGLOW];   // only the flames' tips and edges
// Glow: a glowing orange washes out to pale lemon in game, so the flames' orange and yellow stay unlit and their
// pale hot core near the root glows (the brightest part, as in the art); the embers' small orange hearts glow.
orange  = [0.97, 0.57, 0.07, NOGLOW];
yellow  = [1, 0.8, 0.24, NOGLOW];
hotO    = [0.97, 0.57, 0.07, GLOW];
core    = [0.99, 0.93, 0.72, GLOW];

// The art's sheet x of the scad origin: S(sx, z, y) is the scad point read off the sheet at depth y.
OFF = -8;
function S(sx, z, y) = fromSheet(sx - OFF, z, y);

// ell() with its own $fn, for the small ellipsoids.
module elf(r, p, c, fn) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// A blunt fur lobe from p along d, w wide and a third as thick (ruff and cheek fringes; not spikes).
module lobe(p, d, w, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    translate([0, 0, l * 0.3]) scale([w, w * 0.45, l * 0.35]) sphere(1, $fn = 10);
    translate([0, 0, l * 0.8]) scale([w * 0.5, w * 0.3, l * 0.2]) sphere(1, $fn = 8);
  }
}

// A glowing ember diamond on a surface at p, facing yaw (deg about Z from -Y), s tall.
module emberMark(p, s, yaw = 30) {
  translate(p) rotate([0, 0, yaw]) {
    color(red) scale([s * 0.45, s * 0.25, s]) sphere(1, $fn = 6);
    color(hotO) translate([0, -s * 0.12, -s * 0.1]) scale([s * 0.28, s * 0.2, s * 0.6]) sphere(1, $fn = 6);
  }
}

// ---- Flame tongue: a soft tapered pillow in a vertical plane turned `yaw` from +X, through points `pts` ([dx, dz]
// from `root`: read off the front sheet when `sheet`, else plain in-plane units) with half-widths `ws`, thick at the
// root and narrowing to a point; the inner points nudged sideways (`wav`) so it waves. Layers, each thicker than the
// last so it shows through: a red rim (seen only at the tip and the edges), the orange body, a yellow heart and
// near the root a pale glowing core.
function proj(yaw) = cos(VIEW) * cos(yaw) + sin(VIEW) * sin(yaw);
// (the view looks 10 degrees down, so a point further back reads higher: its z is lowered by 0.17 per unit of depth)
function tp(root, yaw, q) = let(l = q[0] / proj(yaw))
  root + [cos(yaw), sin(yaw), 0] * l + [0, 0, q[1] - 0.17 * l * (cos(VIEW) * sin(yaw) - sin(VIEW) * cos(yaw))];
function fp(root, yaw, q, sheet) = sheet ? tp(root, yaw, q) : root + [cos(yaw), sin(yaw), 0] * q[0] + [0, 0, q[1]];
function nrm2(d) = [-d[1], d[0]] / max(0.001, norm(d));
function wavy(q, ws, wav) = [for (i = [0 : len(q) - 1])
  (i == 0 || i == len(q) - 1) ? q[i] : q[i] + nrm2(q[i + 1] - q[i - 1]) * wav * ws[i] * (i % 2 == 0 ? 1 : -1)];
module layer(root, yaw, P, W, k, th, c, m, sheet, fn = 10) {
  color(c) for (i = [0 : m - 2]) hull() for (j = [i, i + 1])
    translate(fp(root, yaw, P[j], sheet)) rotate([0, 0, yaw]) scale([W[j] * k, th, W[j] * k]) sphere(1, $fn = fn);
}
// hot: 0 mostly red and orange, 0.5 a small yellow heart, 1 a yellow heart, 2 a big yellow heart and a glowing
// core, 3 yellow almost to the tip
module flame(root, yaw, pts, ws, hot = 1, sheet = true, t = 1, wav = 0.25) {
  P = wavy(pts, ws, wav);
  n = len(P);
  layer(root, yaw, P, ws, 1, 1.1 * t, red, n, sheet);
  layer(root, yaw, P, ws, 0.9, 1.5 * t, orange, max(2, n - 1), sheet);
  if (hot > 0) layer(root, yaw, P, ws, 0.56, 2.2 * t, yellow, max(2, round(n * (hot > 2 ? 0.7 : hot > 1 ? 0.6 : 0.45))), sheet, 8);
  if (hot > 1) layer(root, yaw, P, ws, 0.3, 3 * t, core, 2, sheet, 8);
}

// ---- Legs: sturdy brown legs with a paw, three toes and a fluffy cream tuft over the paw.
module leg(hip, knee, foot, r = 2.5) {
  limb(hip, knee, r * 1.05, r * 0.9, fur, $fn = 16);
  limb(knee, foot + [0, 0, 1.3], r * 0.9, r * 0.75, fur, $fn = 16);
  color(fur) translate(foot + [0, -0.7, 0.75]) scale([r * 0.85, r * 1.1, 0.95]) sphere(1, $fn = 16);
  for (dx = [-0.75, 0, 0.75]) color(furDk) translate(foot + [dx * r * 0.6, -0.7 - r * 0.95, 0.5]) scale([0.5, 0.55, 0.45]) sphere(1, $fn = 8);
  for (a = [-140, -90, -40, 20, 160]) lobe(foot + [cos(a) * r * 0.6, sin(a) * r * 0.6 - 0.4, 3.8], [cos(a) * 0.9, sin(a) * 0.9, -1.8], 1.9, cream);
}
FL = [[4.2, -10, 14], [4.4, -12.5, 7], [4.5, -14.5, 0]];   // near front
BL = [[4.3, 9, 14], [4.6, 12, 6], [4.5, 11, 0]];           // near back
leg(FL[0], FL[1], FL[2], 3.7);
leg([-FL[0][0], FL[0][1], FL[0][2]], [-4.5, -14, 7], [-4.7, -16.5, 0], 3.7);   // far front, reaching forward
leg(BL[0], BL[1], BL[2], 3.5);
leg([-BL[0][0], BL[0][1], BL[0][2]], [-4.6, 11, 6], [-4.5, 9.5, 0], 3.5);     // far back
// ember diamonds on the front legs, facing the viewer
emberMark([6.2, -15.5, 10], 1.3);
emberMark([-2.7, -17, 10], 1.2);
emberMark([6.1, -17.3, 6.4], 0.7);

// ---- Torso: lean and long, orange-brown, a tan belly
TORSO = [[[5.8, 6.4, 7.4], [0, -8.5, 16]], [[5.6, 6.2, 6.8], [0, 8, 16.4]]];
blob(TORSO, coat);
ell([4.3, 11, 3], [0, -0.5, 10.6], tan);
// haunches
mirror_x() ell([3.2, 5.2, 5.8], [3.2, 8.5, 14.5], coat);
// the black harness band behind the shoulder and dark stripes over the back, laid flush on the body
module band(y, w, tilt, zmin, c = furDk, xmax = 20) color(c) intersection() {
  hull() for (e = TORSO) translate(e[1]) scale(e[0] + [0.3, 0.3, 0.3]) sphere(1, $fn = 28);
  translate([0, y, 16]) rotate([tilt, 0, 0]) cube([20, w, 24], center = true);
  translate([0, 0, zmin + 15]) cube([20, 40, 30], center = true);
  translate([xmax - 10, 0, 16]) cube([20, 40, 30], center = true);
}
band(-5.5, 2, -12, 9.5, ink);
// (the stripes over the back and the far flank only: the near flank in the front art is plain)
for (s = [[0, 1, -14, 15], [4, 0.9, -12, 15.5], [8, 0.9, -10, 16]]) band(s[0], s[1], s[2], s[3], furDk, 1.5);
// ember marks on the shoulder and the haunch
emberMark([5.2, -10, 19.5], 1.1);
emberMark([6.3, 5.5, 16], 1);
emberMark([6.1, 6.5, 13.6], 0.7);

// ---- Bushy cream tail curling up behind the near hind leg
chain([[1.5, 13.5, 15.5], [3.5, 17, 12.5], [5.2, 19, 13.5], [6, 19.5, 15.5]], [2.4, 2.6, 2, 1], tan, $fn = 14);
lobe([4.5, 18, 14.5], [0.5, 0.8, 2.6], 1.1, tan);
lobe([2.5, 16, 14.5], [0, 0.5, 2.4], 1.1, tan);

// ---- Neck and ruff: a big shaggy tan ruff under the head and over the chest, ragged lower edge
NECK = [-1.6, -14, 20];
blob([[[4.6, 4.2, 4.6], [0, -10.5, 19]], [[4.2, 4, 4.4], NECK]], fur);
RUFF = [-1.8, -15.8, 15.5];
ell([6.4, 5.4, 7], RUFF, tan);
ell([5.4, 4.6, 5], RUFF + [0, 0.5, 5], tan);
// ragged lobes round the lower and front edge (blunt, flattened)
for (a = [-90 : 45 : 270]) let(d = [cos(a), sin(a) * 0.85, 0])
  lobe(RUFF + [d[0] * 4.4, d[1] * 3.7, -4.2], [d[0] * 1.4, d[1] * 1.2, -2.6], 2.8, tan);
for (a = [-45 : 45 : 225]) let(d = [cos(a), sin(a) * 0.85, 0])
  lobe(RUFF + [d[0] * 5.6, d[1] * 4.6, 1.5], [d[0] * 1.8, d[1] * 1.5, -1], 2.8, a % 90 == 0 ? tan : cream);

// ---- Head, in its own frame: centre HC, turned HY (towards the viewer)
HC = [-3.8, -19, 23.4];
HY = 15;
EYE = [3.0, -3.35, 0.6];
EYE_S = 1.15;
EYE_YAW = 28;
EYE_TILT = -12;
// A fierce eye in the head frame: a dark almond outline, an amber iris with a slit pupil and a white glint, and a
// thick dark brow over its top sloping down to the nose; the whole eye tilted `tilt` (outer corner up), turned `yaw`.
module fierceEye(p, s, yaw, tilt) translate(p) rotate([0, tilt, yaw]) {
  color(ink) scale([1.25, 0.44, 0.7] * s) sphere(1, $fn = 18);
  color(iris) translate([0.1 * s, -0.18 * s, -0.08 * s]) scale([0.9, 0.36, 0.52] * s) sphere(1, $fn = 16);
  color(ink) translate([0.12 * s, -0.36 * s, -0.08 * s]) scale([0.16, 0.2, 0.44] * s) sphere(1, $fn = 10);
  color("white") translate([0.45 * s, -0.44 * s, 0.12 * s]) sphere(0.15 * s, $fn = 8);
  color(ink) hull() {
    translate([1.25 * s, -0.12 * s, 0.6 * s]) sphere(0.26 * s, $fn = 8);
    translate([-1.2 * s, -0.36 * s, 0.22 * s]) sphere(0.32 * s, $fn = 8);
  }
  // the fur lid above the brow, so the eye reads narrow
  color(fur) hull() {
    translate([1.2 * s, 0.05 * s, 0.85 * s]) sphere(0.3 * s, $fn = 8);
    translate([-1.2 * s, -0.12 * s, 0.5 * s]) sphere(0.3 * s, $fn = 8);
    translate([0, 0.1 * s, 0.9 * s]) scale([1.1, 0.35, 0.3] * s) sphere(1, $fn = 10);
  }
}
HS = 1.25;
module headAt() { translate(HC) rotate([0, 0, HY]) scale(HS) children(); }
headAt() {
  // skull, muzzle, tan chin
  ell([4.4, 4.2, 4.4], [0, 0, 0.7], fur);
  color(fur) hull() {
    translate([0, -3.2, -1.9]) scale([2.7, 2.3, 1.9]) sphere(1, $fn = 18);
    translate([0, -5.4, -2.3]) scale([1.6, 1.3, 1.25]) sphere(1, $fn = 14);
  }
  color(tan) hull() {
    translate([0, -2.8, -3.4]) scale([2.5, 2, 1.3]) sphere(1, $fn = 16);
    translate([0, -4.9, -3.4]) scale([1.4, 1.1, 0.95]) sphere(1, $fn = 12);
  }
  // big black nose and a closed smirk
  elf([1.35, 0.85, 0.75], [0, -6.4, -2.1], ink, 14);
  color(ink) for (s = [[-1.5, -4.95, -3.75], [0, -5.75, -3.85], [1.3, -5.15, -3.5]]) hull() {
    translate([0, -5.75, -3.85]) sphere(0.2, $fn = 6);
    translate(s) sphere(0.2, $fn = 6);
  }
  // forehead stripe down from the crest
  color(furDk) intersection() {
    translate([0, 0, 0.7]) scale([4.55, 4.35, 4.55]) sphere(1, $fn = 28);
    translate([0, -3, 3.4]) cube([1.3, 6, 4], center = true);
  }
  // fierce slanted eyes with a glint, and dark brows sloping down to the nose
  mirror_x() {
    fierceEye(EYE, EYE_S, EYE_YAW, EYE_TILT);
  }
  // shaggy tan cheeks flaring out and down
  mirror_x() {
    lobe([3.4, -1.6, -2.2], [3.4, 0.4, -1.4], 1.8, tan);
    lobe([4, 0.2, -0.6], [3, 0.8, -0.2], 1.6, tan);
    lobe([3, -2.6, -3.4], [2.2, -0.2, -2.6], 1.6, cream);
  }
  // ears flaring out sideways, orange inside
  mirror_x() {
    color(fur) hull() {
      translate([3.4, 0.6, 2.8]) scale([2.3, 1.1, 2]) sphere(1, $fn = 14);
      translate([7.4, 1.2, 7.6]) sphere(0.3, $fn = 8);
    }
    color(earIn) hull() {
      translate([3.7, -0.3, 3.3]) scale([1.4, 0.5, 1.3]) sphere(1, $fn = 10);
      translate([6.7, 0.5, 6.9]) sphere(0.2, $fn = 6);
    }
  }
  // brown horn-like fur locks flanking the crest
  mirror_x() color(fur) hull() {
    translate([2.2, -0.4, 3.8]) scale([1.2, 0.8, 1.4]) sphere(1, $fn = 12);
    translate([3.2, 0.3, 10]) sphere(0.3, $fn = 8);
  }
  // crest: one soft bright flame rising from the forehead and curling back at the tip, two licks off its sides,
  // in a plane facing the viewer
  flame([0, -0.7, 3.4], HY, [[0, 0], [0.2, 3.2], [-0.2, 6.6], [0.7, 9.8], [1.8, 13]], [2.3, 3.5, 3.3, 2.1, 0.4], 2, false, 0.85, 0.2);
  flame([-1, -0.5, 5.5], HY, [[0, 0], [-1.6, 2.6], [-2.6, 5.2]], [1.5, 1.2, 0.3], 0.5, false, 0.7, 0);
  flame([1.2, -0.5, 6.5], HY, [[0, 0], [1.4, 2.4], [2.6, 4.4]], [1.4, 1.1, 0.3], 0.5, false, 0.7, 0);
}

// ---- Streamer: a flame banner blown back from behind the crest over the body: flame tongues like the tail's in a
// plane running back along the spine, a ragged top of licks and a red underside
SROOT = [-3.4, -17.5, 29.5];
function sheetOf(p) = [0.866 * p[0] + 0.5 * p[1] + OFF, p[2]];
function relTo(pts, r) = [for (q = pts) q == "R" ? [0, 0] : q - sheetOf(r)];
STREAM = [
  [76, ["R", [-9, 33.2], [-4, 34.6], [0, 35.6], [3.2, 37.6]], [3, 4.2, 4, 2.8, 0.5], 3],
  [72, ["R", [-10, 31], [-5, 31.4], [-0.5, 32.2]], [2.4, 2.6, 2.2, 0.4], 1],
  [80, [[-12, 33.5], [-10.5, 36.4], [-8.5, 38]], [2, 1.5, 0.3], 2],
  [74, [[-6, 35], [-4, 37.4], [-2.4, 38.8]], [1.9, 1.4, 0.3], 2],
  [78, [[-1, 36], [1, 38.2], [2.6, 39.2]], [1.7, 1.2, 0.3], 1],
];
for (t = STREAM) flame(SROOT, t[0], relTo(t[1], SROOT), t[2], t[3]);

// ---- Flame tail: a fan of tongues streaming back and out from the rump top
ROOT = [1.5, 12.5, 20.5];
RS = [0.866 * ROOT[0] + 0.5 * ROOT[1] + OFF, ROOT[2]];   // the root on the sheet
// [yaw from +X, [sheet points, absolute], [half-widths], hot]; the first point "R" is the root
R = RS;
TONGUES = [
  [62, [R, [7, 25], [13, 28.5], [18, 32.4], [21, 37.6]], [4.2, 5.2, 4.8, 3, 0.5], 3],    // big upper tongue
  [54, [R, [8, 23.2], [15, 25.2], [21, 26.6], [26.5, 27.2]], [4.4, 5.4, 4.8, 2.8, 0.5], 3], // middle, the longest
  [44, [R, [8, 20.3], [14, 20.8], [19.5, 21.6], [23, 22.2]], [4, 4.4, 3.6, 2.2, 0.4], 2],
  [66, [R, [7, 17.4], [13, 15.4], [18.5, 14.2], [23.3, 14.8]], [3.8, 4.2, 3.4, 2.2, 0.4], 2],
  [72, [R, [7, 15], [14, 12], [21, 11.4]], [3.2, 3.4, 2.4, 0.4], 1],
  [40, [R, [5, 16], [9.5, 12.5], [13, 9.9]], [3, 2.8, 1.8, 0.4], 0.5],
];
LICKS = [
  [50, [[5, 26], [10, 31], [16.5, 36.2]], [2.8, 2, 0.4], 1],      // small lick on the upper tongue's top
  [58, [[11, 27], [17, 29.5], [22.8, 31.2]], [3, 2.2, 0.4], 1],   // and one off its lower edge
  [48, [[9, 16], [15, 13.6], [20.2, 13.2]], [2.6, 2, 0.4], 1],
];
function rel(pts) = [for (q = pts) q - RS];
for (t = concat(TONGUES, LICKS)) flame(ROOT, t[0], rel(t[1]), t[2], t[3]);
// webs between neighbouring tongues, so the inner fan is one mass and only the tips part
module web(i, k, th, c) color(c) hull() {
  translate(ROOT) rotate([0, 0, 55]) scale([4 * k, th, 4 * k]) sphere(1, $fn = 10);
  for (j = [i, i + 1]) let(t = TONGUES[j]) translate(tp(ROOT, t[0], rel(t[1])[1] * 0.9)) rotate([0, 0, t[0]])
    scale([t[2][1] * k, th, t[2][1] * k]) sphere(1, $fn = 10);
}
for (i = [0 : len(TONGUES) - 2]) web(i, 0.95, 1.5, orange);
for (i = [0 : 3]) web(i, 0.62, 2.2, yellow);
// the fan's hot root over the rump
elf([2.8, 3, 2.8], ROOT + [0, -0.5, 0], yellow, 12);
elf([2, 2.4, 2.2], ROOT + [0.6, -1.2, 0.6], core, 12);

// ---- Loose embers
for (e = [[8, 35, 9], [21.5, 29.5, 16], [22.5, 18.5, 14], [12, 9.5, 12]]) let(p = S(e[0], e[1], e[2]))
  {
    color(red) translate(p) sphere(e[0] == 12 ? 0.6 : 1.1, $fn = 10);
    color(hotO) translate(p + [0.2, -0.45, 0.1]) sphere(e[0] == 12 ? 0.4 : 0.75, $fn = 8);
  }
