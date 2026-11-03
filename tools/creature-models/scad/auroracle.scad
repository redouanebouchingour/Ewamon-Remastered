// Auroracle, rebuilt from the measurement sheet (front height 40, feet z = 0): Blizzhowl's final form.
//
// Checklist (front sheet x, z; the art sits about 5 to the left of the scad's sheet x, art = sheet - 5):
// - Body plan: an elegant sky-blue crystal fox striding towards the viewer's left, the head turned to look at the
//   viewer, a huge mass of crystal-feather fur over the neck, chest and shoulders down to the front knees, and a fan
//   of nine soft crystal plumes spread up, back and down behind it.
// - Head: BIG (about a third of the height, as wide as the chest), x -17..-5, z 23..34 plus the ears: a wide skull,
//   wide jowls, a pointed wedge muzzle angled down and to the viewer's left, a pale face, huge feathered cheek fur
//   flaring out and down on both sides.
// - Eyes: calm almond fox eyes, a navy rim and lash line, grey-blue iris, a white glint, the outer corner a little up:
//   far (-14.5, 27.6), near (-9.6, 27.5), both full eyes.
// - Nose: a navy dot at (-12.8, 24.7).
// - Ears: tall, pointed, splayed in a V, with feathered outer edges and a dark blue inner facet: tips at (-15.7, 40)
//   far, (-3.8, 39.7) near. Crystal tufts on the crown between them.
// - Mane: a big soft mass of layered petal plates, x -19..-3, z 8..27, round the neck and over the chest and the
//   shoulders, hanging to the front knees; the body behind fluffy too.
// - Legs: slim (about 2 units thick at the top), feathered at the top, darker blue paws; near front (-10.5, 2.5),
//   far front reaching forward (-16, 0.5), far back (-6, 3.5), near back stretched back (6.5, 3).
// - Tails: nine soft plumes from the rump (art 0, 20), pale icy blue to white with mid-blue edges, broad, rounded,
//   each curling up at its tip like a flame. Tips: (6.4, 36.9) (17.8, 31.4) (19.1, 24.4) (19.2, 21) (19.3, 16)
//   (20, 12) (18.5, 6) (11, 3.6) and one hanging down behind the near back leg (-1.6, 6).
// - Ice shards: small faceted crystals floating round the head and the fan.
// - Back: the fan radiating from the rump, the head above it.
// - Glow: none (the sheet lists nothing glowing): the pale colours are NOGLOW.
include <lib.scad>

fur       = [0.50, 0.76, 0.93];
headFur   = [0.60, 0.82, 0.95];
furDeep   = [0.30, 0.58, 0.84];
plume     = [0.72, 0.89, 0.97, NOGLOW];
plumeHi   = [0.85, 0.98, 0.99, NOGLOW];
earIn     = [0.14, 0.41, 0.76];
paw       = [0.10, 0.34, 0.72];
tailRim   = [0.45, 0.70, 0.92];
tailPale  = [0.78, 0.93, 0.99, NOGLOW];
tailWhite = [0.94, 0.99, 1.00, NOGLOW];
shard     = [0.75, 0.90, 1.00, NOGLOW];
ink       = [0.01, 0.08, 0.32];
iris      = [0.30, 0.38, 0.62];
irisLow   = [0.55, 0.64, 0.84];
pupil     = [0.03, 0.05, 0.22];

// A crystal-feather plate: a flattened leaf from its base `p` along `d` (its length), `w` wide, a third as thick.
module tuft(p, d, w, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    translate([0, 0, l * 0.42]) scale([w * 0.34, w, l * 0.42]) sphere(1, $fn = 8);
    translate([0, 0, l * 0.97]) scale([w * 0.1, w * 0.14, 0.1]) sphere(1, $fn = 6);
  }
}

// Petal plates laid like shingles on an ellipsoid (centre C, radii R): rows of [latitude, count, length, width,
// phase], each plate from the surface pointing out and down; colours cycle through `cs`.
function _nrm(lat, lon) = [cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)];
function _petalDir(lat, lon, len) = let(n = _nrm(lat, lon), d = n * 0.55 + [0, 0, -1]) d / norm(d) * len;
module petals(C, R, rows, cs) {
  for (r = [0 : len(rows) - 1]) let(row = rows[r]) for (i = [0 : row[1] - 1]) let(lon = i * 360 / row[1] + row[4], n = _nrm(row[0], lon))
    tuft(C + [R[0] * n[0], R[1] * n[1], R[2] * n[2]] * 0.9, _petalDir(row[0], lon, row[2]), row[3], cs[(i + r) % len(cs)]);
}

// A flat leaf in the XZ plane (thin in Y), from `p` at `ang` degrees from +X (up > 0), `l` long, `w` half-wide: cheek
// fur and ear fringes, which must face the viewer rather than lie edge-on.
module leafXZ(p, ang, l, w, c) {
  color(c) translate(p) rotate([0, -ang, 0]) hull() {
    translate([l * 0.38, 0, 0]) scale([l * 0.4, 0.45, w]) sphere(1, $fn = 10);
    translate([l, 0, 0]) sphere(0.15, $fn = 4);
  }
}

// Faceted floating ice shard.
module iceShard(p, s, tilt) {
  color(shard) translate(p) rotate(tilt) scale([s, s, s * 1.6]) {
    cylinder(h = 0.6, r1 = 0.6, r2 = 0.6, $fn = 6, center = true);
    translate([0, 0, 0.3]) cylinder(h = 0.6, r1 = 0.6, r2 = 0.05, $fn = 6);
    mirror([0, 0, 1]) translate([0, 0, 0.3]) cylinder(h = 0.6, r1 = 0.6, r2 = 0.05, $fn = 6);
  }
}

// ---- Head, in its own frame: centre HC, turned HEAD_YAW towards +X (the viewer), the muzzle still angled to the
// viewer's left
HC = [0, -14.5, 29.9];
HEAD_YAW = 14;
HS = 1.2;   // the head block's scale
EYE = [2.15, -4.2, -1.67];
EYE_SIZE = 1.33;
EYE_YAW = 28;
EYE_TILT = -3;
// A calm almond fox eye: a navy rim, a grey-blue iris with a paler crescent low in it, a dark pupil, a glint and a
// lash line along the top, tilted `tilt` (outer corner up) and turned `yaw` outward.
module foxEye(p, s, yaw, tilt) {
  translate(p) rotate([0, tilt, yaw]) {
    color(ink) scale([1, 0.42, 0.68] * s) sphere(1, $fn = 20);
    color(iris) translate([0.05 * s, -0.2 * s, -0.04 * s]) scale([0.56, 0.34, 0.54] * s) sphere(1, $fn = 16);
    color(irisLow) translate([0.05 * s, -0.36 * s, -0.3 * s]) scale([0.34, 0.12, 0.13] * s) sphere(1, $fn = 10);
    color(pupil) translate([0.05 * s, -0.38 * s, 0]) scale([0.2, 0.2, 0.32] * s) sphere(1, $fn = 12);
    color("white") translate([-0.05 * s, -0.48 * s, 0.14 * s]) sphere(0.14 * s, $fn = 8);
    color(ink) translate([0, -0.1 * s, 0.5 * s]) scale([1.02, 0.36, 0.1] * s) sphere(1, $fn = 16);
  }
}
module headAt() { translate(HC) rotate([0, 0, HEAD_YAW]) scale(HS) children(); }

headAt() {
  // the head: a wide skull and wide jowls in one hull, narrowing to a wedge muzzle
  color(headFur) hull() {
    translate([0, 1, 0]) scale([5, 4.4, 4]) sphere(1, $fn = 24);
    translate([0, -0.8, -3]) scale([5.4, 3.6, 3]) sphere(1, $fn = 24);
    translate([0, -3.4, -3.4]) scale([3, 2.4, 2.2]) sphere(1, $fn = 16);
  }
  // the pale wedge muzzle and the lower jaw under it
  color(plumeHi) hull() {
    translate([0, -3.3, -3.2]) scale([2.9, 2.4, 2.2]) sphere(1, $fn = 18);
    translate([0, -6.6, -4.4]) scale([0.9, 0.8, 0.7]) sphere(1, $fn = 10);
  }
  color(plume) hull() {
    translate([0, -3, -4.8]) scale([2.4, 2, 1.4]) sphere(1, $fn = 14);
    translate([0, -5.7, -5.2]) scale([0.7, 0.6, 0.5]) sphere(1, $fn = 8);
  }
  ell([0.65, 0.5, 0.5], [0, -7.35, -4.2], ink);
  // a pale blaze up the forehead
  color(plumeHi) translate([0, -2.9, 1.4]) rotate([-25, 0, 0]) scale([1, 0.9, 2]) sphere(1, $fn = 10);
  // eyes
  foxEye(EYE, EYE_SIZE, EYE_YAW, EYE_TILT);
  foxEye([-EYE[0], EYE[1], EYE[2]], EYE_SIZE, -EYE_YAW, -EYE_TILT);
  // huge feathered cheek fur flaring out and down on both sides
  mirror_x() {
    // [base x, y, z, angle from +X (deg, up > 0), length, width, colour]
    for (f = [[4.4, -0.6, -0.6, 4, 4.4, 1.3, headFur], [4.6, -1.2, -2.2, -14, 5, 1.4, plumeHi], [4.4, -1.4, -3.6, -32, 5, 1.4, plume],
              [3.8, -1.8, -4.8, -50, 4.6, 1.3, plumeHi], [2.8, -2.4, -5.6, -68, 3.8, 1.2, plume], [5, 0.8, -1.6, -22, 4.4, 1.3, headFur],
              [4.6, 1, -3.4, -42, 4.2, 1.3, plume]])
      leafXZ([f[0], f[1], f[2]], f[3], f[4], f[5], f[6]);
  }
  // crown: crystal tufts between the ears
  tuft([-0.8, 0.6, 3.8], [-0.3, 0.2, 3.2], 1, plume);
  tuft([1, 0.8, 3.8], [0.4, 0.2, 2.6], 0.9, plumeHi);
  tuft([0, -0.6, 4], [0, -0.3, 2], 0.8, headFur);
  // ears: tall and pointed, splayed in a V, a dark blue inner facet and feathered outer edges
  mirror_x() {
    color(headFur) hull() {
      translate([3.6, 1.4, 3]) scale([2.9, 1.4, 2.8]) sphere(1, $fn = 18);
      translate([6.2, 2, 8.6]) sphere(0.35, $fn = 8);
    }
    color(earIn) hull() {
      translate([3.5, 0.3, 3.8]) scale([1.7, 0.5, 1.8]) sphere(1, $fn = 14);
      translate([5.8, 1.3, 7.6]) sphere(0.25, $fn = 8);
    }
    leafXZ([5.4, 1.6, 4.2], 28, 3, 0.8, plume);
    leafXZ([5.8, 1.8, 5.8], 40, 2.6, 0.7, plumeHi);
    leafXZ([4.6, 1.5, 2.6], 10, 2.8, 0.8, headFur);
    tuft([3.4, 0.4, 3.8], [0.6, 0, 2.8], 0.9, plumeHi);
  }
}

// ---- Mane: a big soft mass of layered petal plates over the neck, chest and shoulders, down to the front knees
RC = [0, -11.5, 17];
RR = [8.4, 7.6, 8.2];
ell(RR, RC, fur);
ell([4.6, 4.4, 4.6], [0, -13, 23], fur);           // the neck under the head
MANE = [[52, 10, 4.6, 2.2, 0], [26, 13, 5.2, 2.4, 14], [0, 14, 5.6, 2.5, 0], [-24, 13, 5.6, 2.5, 14], [-44, 11, 5.2, 2.3, 0]];
petals(RC, RR, MANE, [plume, plumeHi, fur, plume, plumeHi]);
// the front of the chest hanging lowest, between the front legs
for (x = [-4.5 : 3 : 4.5]) tuft([x, -17.6, 13], [x * 0.15, -0.5, -5.6], 2.2, abs(x) < 2 ? plumeHi : plume);

// ---- Body: fluffy, mostly under the mane and the fan
blob([[[6.4, 6.2, 6.4], [0, -6, 14.2]], [[6, 5.8, 5.8], [0, 6.5, 14.8]]], fur);
ell([4.2, 8.5, 2.4], [0, 0, 9.6], furDeep);
for (y = [-1, 4]) tuft([0, y, 20.2], [0, 3.6, -0.4], 2.8, y == 4 ? plumeHi : plume);
mirror_x() {
  for (y = [-1.5, 3]) tuft([4.6, y, 18], [1.6, 4, -1.6], 3, y == 3 ? fur : plume);
  for (y = [-0.5, 4]) tuft([6, y, 13.6], [1.6, 2.8, -3.6], 2.9, y == 4 ? plumeHi : plume);
  for (y = [-1, 4]) tuft([3.2, y, 9.6], [0.8, 1.2, -3], 2, plume);
  ell([3.6, 4.8, 4.8], [3.4, 7.5, 12.6], fur);       // haunch
  tuft([5.8, 9.5, 11], [0.6, 1.8, -3], 1.8, plume);
}

// ---- Legs: slim but not sticks, feathered at the top, darker blue paws
module leg(hip, knee, foot) {
  limb(hip, knee, 2.6, 1.9, fur);
  limb(knee, foot + [0, 0, 0.3], 1.75, 1.4, fur);
  color(paw) translate(foot + [0, -0.6, 0]) scale([2.1, 2.7, 1.3]) sphere(1, $fn = 16);
  for (a = [30 : 120 : 270]) tuft(knee + [cos(a) * 1.4, sin(a) * 1.4, 1.6], [cos(a) * 0.7, sin(a) * 0.7, -2.8], 1.4, plume);
}
LEGS = [
  [[3.4, -8, 12.5], [3.8, -11.5, 7.2], [4.2, -16, 1.3]],     // near front (+X)
  [[-3.4, -8, 12.5], [-4.4, -12.4, 7.4], [-5, -16.4, 1.3]],  // far front, reaching forward
  [[3.6, 6.5, 12.5], [4.2, 11, 7.6], [4.6, 14.5, 1.3]],      // near back, stretched back
  [[-3.6, 6.5, 12.5], [-4, 5.4, 7.4], [-4.4, 3.6, 1.3]],     // far back, stepped under
];
for (l = LEGS) leg(l[0], l[1], l[2]);

// ---- Tails: nine soft plumes radiating from the rump, each on its own direction: its horizontal part turned
// FAN_YAW (from +X) plus its YAWS offset, so neighbours sit at different depths, pitched to the sheet angle.
TAIL_ROOT = [0, 10.5, 18.5];
FAN_YAW = 50;
YAWS = [-22, 20, -8, 24, -18, 10, -24, 16, 0];   // per-tail yaw offsets: a bushy 3D fan, not a flat one
// [sheet angle (deg, 90 = up), sheet length, width]
TAILS = [[78, 18, 11], [24, 24.5, 12], [3, 24.5, 12], [-12, 24, 12], [-26, 24, 12], [-39, 24.5, 12], [-54, 24, 11.5],
  [-74, 21, 11], [-116, 15, 8]];
function tailYaw(i) = FAN_YAW + YAWS[i];
function tailProj(i) = cos(tailYaw(i)) * 0.866 + sin(tailYaw(i)) * 0.5;
function tailPitch(i) = atan2(sin(TAILS[i][0]), cos(TAILS[i][0]) / tailProj(i));
function tailLen(i) = TAILS[i][1] / norm([tailProj(i) * cos(tailPitch(i)), sin(tailPitch(i))]);
// one plume along +X, curving up (+Z) towards a tip that curls up and back like a flame: a soft pillow about 3 deep
// (Y), `w` wide (Z): a thin mid-blue edge, a pale icy body and a white centre.
BEND = 0.32;
TAIL_ROLL = 10;                // each plume rolled so its broad face looks a little up into the light
PT = [0.04, 0.36, 0.7, 0.9];    // spine stations (share of the length)
PW = [0.3, 0.5, 0.46, 0.28];    // half-widths there (share of w)
function sp(L, t) = [L * t, 0, BEND * L * t * t];
module tailShape(L, w) {
  // the mid-blue edge: a little wider and thinner than the pale body, so it shows only along the rims
  color(tailRim) for (k = [0 : 2]) hull() {
    translate(sp(L, PT[k])) scale([L * 0.15, 1.7, PW[k] * w]) sphere(1, $fn = 12);
    translate(sp(L, PT[k + 1])) scale([L * 0.15, 1.7, PW[k + 1] * w]) sphere(1, $fn = 12);
  }
  // the pale icy body, a soft round pillow
  color(tailPale) {
    for (k = [0 : 2]) hull() {
      translate(sp(L, PT[k]) + [0, 0, 0.03 * w]) scale([L * 0.14, 2.4, 0.86 * PW[k] * w]) sphere(1, $fn = 16);
      translate(sp(L, PT[k + 1]) + [0, 0, 0.03 * w]) scale([L * 0.14, 2.4, 0.86 * PW[k + 1] * w]) sphere(1, $fn = 16);
    }
    // the tip flicking up and back like a flame
    hull() {
      translate(sp(L, 0.88) + [0, 0, 0.06 * w]) scale([L * 0.09, 1.9, 0.26 * w]) sphere(1, $fn = 12);
      translate(sp(L, 0.98) + [0, 0, 0.44 * w]) scale([1.1, 1.1, 1.1]) sphere(1, $fn = 10);
    }
  }
  // the white centre
  color(tailWhite) hull() {
    translate(sp(L, 0.36) + [0, 0, 0.06 * w]) scale([L * 0.12, 2.52, 0.16 * w]) sphere(1, $fn = 10);
    translate(sp(L, 0.78) + [0, 0, 0.08 * w]) scale([L * 0.1, 2.3, 0.12 * w]) sphere(1, $fn = 10);
  }
}
for (i = [0 : len(TAILS) - 1])
  translate(TAIL_ROOT) rotate([0, -tailPitch(i), tailYaw(i)]) rotate([-TAIL_ROLL, 0, 0]) tailShape(tailLen(i), TAILS[i][2]);
// the root of the fan
ell([3.2, 3.2, 3.2], TAIL_ROOT, fur);

// ---- Ice shards drifting round the head and the fan
iceShard([6.4, -2, 35], 1.4, [10, 20, 0]);
iceShard([8.2, 2, 37], 1.3, [-15, 10, 30]);
iceShard([13.9, 14, 33.4], 1.5, [20, -10, 0]);
iceShard([17.7, 20, 23.4], 1.2, [0, 25, 40]);
iceShard([-8.5, -18, 20.5], 0.9, [30, 0, 10]);
