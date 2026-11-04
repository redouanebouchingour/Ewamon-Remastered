// Frofloe, rebuilt from the measurement sheet (front height 40, feet z = 0): Slushpup grown into a big crystal ice wolf.
//
// Checklist (front sheet x, z):
// - Body plan: a long muscular ice wolf in a low, aggressive stalking crouch, the body running from the head (left)
//   back to the rump (right, x 16), the head low and turned to stare straight at the viewer, long legs splayed wide.
// - Head: BIG, a broad wolf face seen face-on, x -12.6..-0.8, z 12.4..27, centre (-6.7, 20.5): a mid-blue brow with a
//   white blaze, white cheeks, jowls and muzzle, pointed ears at the top corners (tips (-12, 29), (-1.5, 29)).
// - Eyes: narrow slanted angry eyes, black almond with a bright cyan iris, inner corners down under white brow tufts:
//   (-9.2, 19.7) and (-4.2, 19.8), about 3 wide and 1.5 tall.
// - Nose: a broad black nose (-6.5, 16); a snarl under it: a row of bared white teeth (z 14.3) over a black mouth line
//   (z 13.7, x -8..-5), the chin below to z 12.4.
// - Mane: a dense collar of big flat pale-blue ice shards round the face, tallest on the crown (to z 38.5), short at
//   the sides (to x -17), over the shoulders to the right (to x 7), a bib under the jaw (to z 10). The back view shows
//   it running over the neck and shoulders down to mid-flank.
// - Body: pale icy fur, deep chest, tucked waist (belly z 19 at x 10), the back at z 27, a rounded rump to x 16.
// - Legs: long, muscular; near front (-X far side) splayed far forward-left, paw (-18, 4); near front (+X) under the
//   chest, paw (7.5, 1); far hind dark under the chest (0, 8); near hind stretched back, paw (16.5, 6). Big paws, dark
//   claws, an ice spur on each elbow and hock.
// - Tail: a big bushy plume of ice feathers rising from the rump (14, 26), curling up and over to the left, the tip at
//   (5.5, 37): a thick band about 6 wide, jagged feathers on its outer edge.
// - Loose ice crystals floating round it (-13, 35.5), (-16.5, 13.5), (10, 34.5), (10.5, 11.5).
// - Back: the shard mane over the neck and shoulders, the darker blue haunches and hind legs, the tail curl.
// - Glow: nothing glows on the sheet; the pale colours are NOGLOW.
include <lib.scad>

// coarser limb spheres than lib's default: the budget goes to the shards
$fs = 0.95;

fur     = [0.76, 0.89, 0.95, NOGLOW];
furMid  = [0.55, 0.76, 0.86];
furDk   = [0.39, 0.59, 0.72];
navy    = [0.22, 0.36, 0.52];
mask    = [0.9, 0.97, 0.99, NOGLOW];
brow    = [0.6, 0.8, 0.9];
iceHi   = [0.88, 0.97, 0.99, NOGLOW];
ice     = [0.66, 0.84, 0.92, NOGLOW];
iceMid  = [0.47, 0.69, 0.82];
iceDeep = [0.33, 0.53, 0.68];
ink     = [0.04, 0.06, 0.1];
iris    = [0.28, 0.7, 0.96, NOGLOW];
claw    = [0.17, 0.31, 0.45];
fang    = [0.96, 0.98, 1.0, NOGLOW];
tailC   = [0.51, 0.72, 0.86];

// Low-poly ellipsoid for small details.
module bead(r, p, rot = [0, 0, 0], c, fn = 10) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }

// Orthonormal frame: local z along d, local x along w (made perpendicular), local y their cross.
function _n(v) = v / norm(v);
function _cr(a, b) = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
module frame(p, d, w) {
  u = _n(d);
  v = _n(w - (w * u) * u);
  t = _cr(u, v);
  multmatrix([[v[0], t[0], u[0], p[0]], [v[1], t[1], u[1], p[1]], [v[2], t[2], u[2], p[2]], [0, 0, 0, 1]]) children();
}

// A big flat faceted ice shard from p along d, half-width r across w, `th` x r thick: a diamond section widening to
// 1.25 r at 40 % of its length, then a point. One half light, the other its darker colour (the sprite's facets).
module shard(p, d, r, w = [1, 0, 0], c1 = iceHi, c2 = ice, th = 0.42) {
  L = norm(d);
  module pt(q) translate(q) cube(0.02, center = true);
  frame(p, d, w) {
    color(c1) hull() { pt([r, 0, 0]); pt([0, r * th, 0]); pt([0, -r * th, 0]); pt([r * 1.25, 0, L * 0.4]);
      pt([0, r * th * 1.2, L * 0.4]); pt([0, -r * th * 1.2, L * 0.4]); pt([0, 0, L]); }
    color(c2) hull() { pt([-r, 0, 0]); pt([0, r * th, 0]); pt([0, -r * th, 0]); pt([-r * 1.25, 0, L * 0.4]);
      pt([0, r * th * 1.2, L * 0.4]); pt([0, -r * th * 1.2, L * 0.4]); pt([0, 0, L]); }
  }
}

// ---- Head, in its own frame: centre HC, turned HY towards +X so the face stares straight at the viewer, scaled HS.
HC = [0, -14, 20.5];
HY = 30;
HS = 1.1;
module headAt() { translate(HC) rotate([0, 0, HY]) scale(HS) children(); }

EYE = [2.5, -3.3, -0.8];
EYE_SIZE = 1.45;
EYE_YAW = 14;

headAt() {
  // cranium (mid-blue brow) and the white jowls and cheeks under it
  ell([5, 4.6, 5], [0, 0.5, 1.5], brow);
  ell([5.6, 3.8, 3.6], [0, -0.8, -2.4], mask);
  // the white blaze up the forehead between the eyes
  shard([0, -4.05, 0.6], [0, 0.9, 4.6], 1.1, [1, 0, 0], mask, mask, 0.35);
  // muzzle: short and broad, seen end-on; the nose on its tip
  blob([[[2.9, 2.6, 2.3], [0, -3.2, -3.4]], [[1.9, 1.7, 1.5], [0, -6.3, -4.3]]], mask);
  ell([1.25, 0.8, 0.85], [0, -7.75, -4.1], ink);
  // the snarl: a black mouth slit, a row of bared teeth over it, two fangs, the chin under it
  color(ink) hull() {
    translate([0, -6.2, -5.95]) scale([1.6, 0.9, 0.3]) sphere(1, $fn = 12);
    translate([0, -3.6, -5.9]) scale([2.6, 1, 0.35]) sphere(1, $fn = 12);
  }
  color(fang) hull() {
    translate([0, -6.5, -5.55]) scale([1.3, 0.6, 0.3]) sphere(1, $fn = 10);
    translate([0, -4.2, -5.5]) scale([2.3, 0.7, 0.3]) sphere(1, $fn = 10);
  }
  mirror_x() spike([1.15, -6.25, -5.4], [0.05, -0.1, -1.25], 0.34, 0.04, fang);
  blob([[[2.6, 2.3, 1.3], [0, -3, -6.7]], [[1.5, 1.3, 0.9], [0, -5.6, -7.1]]], mask);
  // eyes: narrow angry almonds under white brow tufts that slant down to the nose
  mirror_x() {
    ell([1.9, 0.7, 1.2], [EYE[0] + 0.1, EYE[1] + 0.35, EYE[2]], ink);
    eye(EYE, EYE_SIZE, iris = iris, sclera = ink, yaw = EYE_YAW, pupil = ink, shine = true, flat = 0.5, lid = 0.42,
        lid_tilt = 26, lid_c = mask, slit = 0.45);
    color(mask) hull() {
      translate([0.7, -4.1, 0.75]) scale([0.6, 0.7, 0.45]) sphere(1, $fn = 10);
      translate([3.9, -2.9, 1.9]) scale([1.1, 0.8, 0.55]) sphere(1, $fn = 10);
    }
    // a dark streak from the outer eye corner back to the ear
    bead([0.45, 0.4, 1.5], [4.1, -2.5, 1.8], [0, 40, 0], navy, 10);
  }
  // ears: tall pointed, mid-blue with a dark inner facet, at the top corners of the head
  mirror_x() {
    color(brow) hull() {
      translate([3.3, 0.6, 4.4]) scale([2.2, 1.1, 1.8]) sphere(1, $fn = 12);
      translate([5.5, 0.3, 8.6]) sphere(0.3, $fn = 6);
    }
    color(navy) hull() {
      translate([3.4, -0.4, 4.7]) scale([1.1, 0.4, 1.1]) sphere(1, $fn = 10);
      translate([5.2, -0.1, 7.8]) sphere(0.2, $fn = 6);
    }
  }
  // cheek ruffs: white jagged fur flaring out and down off the jowls
  mirror_x() {
    shard([4.4, -1.4, -1.2], [2.8, 0.6, 0.2], 1.1, [0, 0, 1], mask, ice, 0.4);
    shard([4.6, -1.2, -2.9], [2.6, 0.6, -1.2], 1.1, [0, 0, 1], mask, ice, 0.4);
    shard([3.8, -1.6, -4.6], [1.9, 0.4, -2.1], 1.0, [0, 0, 1], mask, ice, 0.4);
  }
}

// ---- Mane round the face: shards radiating in the face's plane, leaning back; [angle (0 = the face's right, 90 =
// up), length]. Tall on the crown, short at the sides and under the jaw, long towards the shoulders on the right.
MC = [0, 2.6, 0.8];
module maneShard(a, l, r, back, ring, k) {
  d = [cos(a), back, sin(a) * 1.02];
  headAt() shard(MC + [cos(a) * (5.6 - ring), ring * 1.4, sin(a) * (5.8 - ring)], d * l * 1.05, r, [-sin(a), 0, cos(a)],
                 k % 3 == 0 ? iceHi : k % 3 == 1 ? ice : iceHi, k % 2 == 0 ? iceMid : ice, 0.42);
}
// outer ring: [angle, length, half-width]
for (s = [[-20, 8.5, 3.2], [0, 9.5, 3.3], [20, 10.5, 3.3], [40, 11.5, 3.3], [58, 12.5, 3.2], [74, 12.5, 3.1], [90, 13, 3.2],
          [106, 13, 3.1], [122, 12, 3.1], [140, 9.5, 2.9], [158, 6.5, 2.5], [178, 5.5, 2.5], [198, 5, 2.4],
          [218, 4.5, 2.4], [-40, 7, 2.8]])
  maneShard(s[0], s[1], s[2], 0.45, 0, round(s[0] / 18));
// inner ring, in the gaps, closer to the face
for (s = [[-30, 6, 2.6], [10, 7, 2.6], [30, 8, 2.6], [49, 9, 2.6], [66, 9.5, 2.5], [82, 10, 2.5], [98, 9, 2.5],
          [114, 10, 2.1], [131, 8.5, 2.1], [149, 6.5, 2], [168, 4.6, 2], [188, 4.2, 2], [208, 3.8, 1.9]])
  maneShard(s[0], s[1], s[2], 0.25, 1.2, round(s[0] / 18) + 1);
// bib under the jaw, pointing down and forward
for (s = [[-3.4, 1.6], [-1.2, 1.8], [1.2, 1.8], [3.4, 1.6]])
  headAt() shard([s[0], -1.6, -6.4], [s[0] * 0.35, -1.2, -4.6], s[1], [1, 0, 0], s[0] < 0 ? iceHi : ice, iceMid, 0.42);

// ---- Shoulder mane: big shards over the neck and shoulders, pointing up, out and back (the back view's collar).
SC = [0, -5.5, 23.5];
SR = [6.2, 5.5, 5];
for (s = [[20, 20, 8], [20, 55, 9], [20, 90, 9.5], [20, 125, 9], [20, 160, 8], [45, 40, 9], [45, 75, 10], [45, 105, 10],
          [45, 140, 9], [70, 90, 9], [0, 60, 7.5], [0, 120, 7.5], [-15, 45, 6.5], [-15, 135, 6.5]])
  mirror_x() let(lat = s[0], lon = s[1], n = [cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)],
                 d = _n(n * 0.8 + [0, 0.45, 0.55]))
    shard(SC + [SR[0] * n[0], SR[1] * n[1], SR[2] * n[2]] * 0.85, d * s[2], 2.7, _cr(d, [0, 0, 1]) + [0, 0.01, 0],
          lon % 70 < 35 ? iceHi : ice, iceMid, 0.42);

// ---- Body: deep chest, tucked waist, a rounded rump; a neck under the mane.
blob([[[4.8, 4, 5.2], [0, -11, 21]], [[6.6, 6.5, 7.5], [0, -6.5, 19.5]]], fur);
blob([[[6.6, 6.5, 7.5], [0, -6.5, 19.5]], [[5.4, 6, 4.8], [0, 6, 23.4]]], fur);
blob([[[5.4, 6, 4.8], [0, 6, 23.4]], [[6, 6, 6.2], [0, 18, 22]]], fur);
// haunches: big muscles, darker blue streaks over them (the back view)
mirror_x() {
  ell([3.6, 6, 6], [4.6, 18, 20.2], fur);
  for (s = [[6.6, 15, 22, 30], [6.9, 18.5, 19.5, 20], [6.4, 21, 22.5, 40], [5.4, 9, 24.5, 15]])
    bead([0.5, 2.6, 0.55], [s[0], s[1], s[2]], [s[3], 0, 0], furDk, 10);
}

// ---- Legs.
// Big paw at p (sole on z = 0) turned by yaw: a pad, four splayed toes, dark claws.
module paw(p, yaw = 0, s = 1, c = fur) {
  translate(p) rotate([0, 0, yaw]) scale(s) {
    color(c) hull() for (e = [[[2.1, 2.4, 1.2], [0, 0, 1.1]], [[1.6, 1.5, 1.4], [0, 1.1, 1.7]]]) translate(e[1]) scale(e[0]) sphere(1, $fn = 16);
    for (x = [-1.45, -0.5, 0.5, 1.45]) {
      bead([0.7, 0.9, 0.72], [x * 1.1, -2, 0.75], c = c);
      color(claw) translate([x * 1.2, -2.7, 0.65]) rotate(_dir_rot([x * 0.3, -1.1, -0.6])) cylinder(h = 1.3, r1 = 0.32, r2 = 0.04, $fn = 6);
    }
  }
}
// a front leg: shoulder ball, upper arm out to the elbow, forearm down to the wrist, the paw
module foreleg(sh, el, wr, pw, yaw, c) {
  ell([3.4, 3.9, 4.4], sh, fur);
  limb(sh + [0, 0, -1], el, 3.3, 2.6, fur);
  limb(el, wr, 2.6, 2.0, c);
  paw(pw, yaw, 1.6, c);
  shard(el + [0, 1.2, 0.4], [0, 2.4, 1.6] + (el - sh) * 0.15, 0.8, [0, 0, 1], ice, iceMid);
}
// a hind leg: haunch, thigh forward to the stifle, gaskin back to the hock, the foot down
module hindleg(hp, st, hk, pw, yaw, c) {
  limb(hp, st, 3.8, 2.8, fur);
  limb(st, hk, 2.7, 1.9, c);
  limb(hk, pw + [0, 0, 1.4], 1.9, 1.8, c);
  paw(pw, yaw, 1.45, c);
  shard(hk + [0, 0.8, 0.4], [0, 2.6, 1.4], 0.7, [1, 0, 0], ice, iceMid);
}
foreleg([5, -7, 18], [9.2, -4, 10], [11, -3.6, 3], [11.5, -4.4, 0], -12, fur);        // near front (+X), under the chest
foreleg([-5, -7, 18], [-10, -10, 10], [-12.8, -13.3, 3.2], [-13.3, -14.8, 0], 30, fur);  // far front, reaching out
hindleg([5, 18, 20], [6.5, 16, 12.5], [7, 25, 6.5], [7.4, 24.2, 0], -8, furMid);      // near hind, stretched back
hindleg([-5, 18, 20], [-7, 13, 12.5], [-9, 19.5, 6.5], [-9.5, 17.5, 0], 10, furMid);    // far hind

// ---- Tail: a thick plume of ice feathers in a plane turned TA from +Y towards +X, rising from the rump and curling
// up and over to the left. Points are read off the sheet (x, z) and stood in that plane.
TA = 40;
TR = [1.5, 22.5, 24.5];
TU = [sin(TA), cos(TA), 0];
TK = 0.866 * sin(TA) + 0.5 * cos(TA);
TS0 = 0.866 * TR[0] + 0.5 * TR[1];
// TZ: the tail sits about 25 units behind the front paws, which the camera's 10 degree tilt lifts by about 4.
TZ = -3.8;
function tp(sx, z) = [TR[0], TR[1], 0] + TU * ((sx - TS0) / TK) + [0, 0, z + TZ];
TP = [[13, 25], [17, 26.8], [18.6, 30], [18, 33.8], [15, 36.8], [11, 37.8], [7.5, 37.6], [5, 36.8]];
TW = [2.6, 3, 3.4, 3.6, 3.6, 3.3, 2.6, 1.6];
TN = [cos(TA), -sin(TA), 0];
// the core: a chain of flattened ellipsoids (TW in the plane, 2.3 deep)
for (i = [0 : len(TP) - 2]) color(tailC) hull() for (j = [i, i + 1])
  translate(tp(TP[j][0], TP[j][1])) rotate([0, 0, -TA]) scale([min(2.7, TW[j]), TW[j], TW[j]]) sphere(1, $fn = 14);
// feathers: flat shards in the tail's plane, flicking out from the curl's outer edge and swept along it
function tpt(i) = _n(tp(TP[min(i + 1, len(TP) - 1)][0], TP[min(i + 1, len(TP) - 1)][1]) - tp(TP[max(i - 1, 0)][0], TP[max(i - 1, 0)][1]));
TCEN = tp(12.5, 31.5);
for (i = [1 : len(TP) - 1]) let(p = tp(TP[i][0], TP[i][1]), t = tpt(i), o0 = p - TCEN, o = _n(o0 - (o0 * TN) * TN))
  for (k = [0, 1]) let(d = _n(o * (k == 0 ? 0.6 : 0.35) + t * (k == 0 ? 0.8 : 0.95)))
    shard(p + o * TW[i] * 0.45 + TN * (k == 0 ? -0.6 : 0.6), d * (3.4 + TW[i] * 0.7 - k * 0.5), 1.3 + TW[i] * 0.28,
          _cr(d, TN), (i + k) % 2 == 0 ? ice : iceHi, iceMid, 0.45);
// the tip: three feather fingers sweeping down to the left
for (k = [0 : 2]) let(p = tp(6.5, 37.2 - k * 0.3), d = _n(TU * (-1) + [0, 0, -0.25 - k * 0.35]))
  shard(p, d * (3.6 - k * 0.5), 1.0, _cr(d, TN), k == 1 ? iceHi : ice, iceMid, 0.45);
// the fluffy base: plumes hanging off the root beside the rump
for (k = [0 : 2]) let(p = tp(16, 26), d = _n(TU * (1 - k * 0.2) + [0, 0, -0.1 - k * 0.45]))
  shard(p, d * 4.2, 1.4, _cr(d, TN), k == 1 ? iceHi : ice, iceMid, 0.45);

// ---- Loose ice crystals floating round it.
for (c = [[-13, 35.5, -12], [-16.5, 13.5, -12], [10, 34.5, 2], [10.5, 11.5, -8]])
  shard(fromSheet(c[0], c[1], c[2]), [0.2, 0, 1.6], 0.5, [1, 0, 0], iceHi, ice);
