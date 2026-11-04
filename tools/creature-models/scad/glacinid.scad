// Glacinid: a pale ice serpent-dragon in a W: its chubby neck rears up at the front (viewer's left) under a spiky
// frost-maned head with a violet crystal crown and two big coral antlers, the body runs low along the ground, a coral
// fan grows off its middle and the tail climbs at the back right into a tall branching frost-coral tree.
//
// Checklist (front sheet, units; scad built off it with fromSheet):
// - head: small round dragon face at sheet (-17, 24), ringed by a mane of flat ice shards (x -24..-9.5, z 19..31)
// - face: one narrow almond eye drawn at (-16, 23.7), pale with a blue iris, a fierce slant; short snout. Two eyes here.
// - crown: violet crystal cluster x -20..-13.5, z 28.5..37.5, the middle one tallest
// - antlers: two branching coral antlers off the crown, the near one to (-8.5, 39.4), the far one to (-20, 39.4)
// - neck / chest: a chubby bulb x -22.6..-11.4, z 3..22, pale lavender patches on its front
// - body: runs right low, bottom z 5..8, to the far end at x 20.7, z 5..17, then the tail rises back up-left to (9, 34)
// - coral: the tail tree fills x 4..25, z 20..40; a coral fan + pale shards on the middle of the back (x -5..6,
//   z 14..31); fronds along the body top pointing back; little coral sprigs under the body like feet
// - colour: pale ice blue everywhere, coral a touch paler, shards near white; lavender only on the chest and belly
// - back: the same coral seen from behind, lavender underbelly along the bottom
include <lib.scad>

ice = [0.75, 0.87, 0.93, NOGLOW];
scaleLo = [0.65, 0.78, 0.9, NOGLOW];   // the plates' shaded rows
scaleHi = [0.84, 0.93, 0.96, NOGLOW];
coralC = [0.8, 0.9, 0.95, NOGLOW];
CR = 1.4;   // coral thickness on the body
shardC = [0.84, 0.93, 0.96, NOGLOW];
lav = [0.72, 0.72, 0.92, NOGLOW];
violet = [0.36, 0.22, 0.54, NOGLOW];
violetHi = [0.5, 0.38, 0.68, NOGLOW];
eyeIris = [0.3, 0.5, 0.82, NOGLOW];
eyeWhite = [0.88, 0.94, 0.97, NOGLOW];
eyeInk = [0.1, 0.14, 0.26];

function nrm(v) = v / norm(v);
// Sheet direction (dsx, dz) with depth dy -> scad direction.
function sd(dsx, dz, dy = 0) = [(dsx - 0.5 * dy) / 0.866, dy, dz];
function S(sx, z, y) = fromSheet(sx, z, y);

// ---- Branching frost coral. A segment from p along d forks into a near-straight main branch and a side branch, the
// fork in the picture plane (turned out of it by `spin`, alternating per level), `depth` times. Blunt rounded tips.
// The rig (rigs/glacinid.mjs) regenerates the same segments: keep the two in step.
NV = [0.5, -0.866, 0];   // towards the sprite camera
function side(d) = let(c = cross(d, NV)) norm(c) < 0.01 * norm(d) ? [0, 0, 1] : nrm(c);
function coralSegs(p, d, r, depth, spin, sg) =
  let(q = p + d, L = norm(d), u = nrm(d), s0 = side(d), w = cross(u, s0), sv = s0 * cos(spin) + w * sin(spin),
      dm = (u * cos(20) + sv * sg * sin(20)) * L * 0.78,
      ds = (u * cos(50) - sv * sg * sin(50)) * L * 0.55)
  concat([[p, q, r, r * 0.92]],
         depth > 0 ? concat(coralSegs(q, dm, r * 0.88, depth - 1, -spin, -sg), coralSegs(q, ds, r * 0.78, depth - 1, -spin, -sg)) : []);
module coral(p, d, r, depth, spin = 25, sg = 1, c = coralC) {
  for (s = coralSegs(p, d, r, depth, spin, sg)) color(c) hull() {
    translate(s[0]) sphere(s[2], $fn = 5);
    translate(s[1]) sphere(s[3], $fn = 5);
  }
}

module shard(p, d, w, t = 0.55, c = shardC) {
  color(c) hull() { translate(p) sphere(t, $fn = 6); translate(p + d * 0.4) rotate(_dir_rot(d)) scale([w, t, 0.3]) sphere(1, $fn = 8);
                    translate(p + d) sphere(0.12, $fn = 4); }
}
MANE = [[10, 7], [34, 7.8], [58, 8.5], [82, 8.7], [106, 8.2], [130, 7.3], [155, 6.4]];   // angle from straight up (towards +X), length
module crystal(p, d, r, c = violet) {
  color(c) hull() { translate(p) rotate(_dir_rot(d)) cylinder(h = 0.1, r = r * 0.85, $fn = 6);
                    translate(p + d * 0.62) rotate(_dir_rot(d)) cylinder(h = 0.1, r = r, $fn = 6);
                    translate(p + d) sphere(0.1, $fn = 4); }
}

// ---- Body: one chain from the neck down into the chest bulb, low along the ground, up into the tail trunk.
// [sheet x, z, depth y, radius]
BODY = [[-16.8, 20.5, -3.5, 4.2], [-17, 16, -3, 5.4], [-17.3, 10.2, -2, 6.4], [-11.5, 8.5, 0, 5], [-5, 11, 2, 4.4], [2, 12, 4, 4.3],
        [9, 12.3, 5, 4.5], [15.5, 12, 5, 4.8], [16, 17, 4, 4.4], [13, 22, 3, 4.1], [10, 27, 3, 3.6], [8.5, 31.5, 3, 2.9],
        [8, 34.5, 3, 2.0]];
PTS = [for (b = BODY) S(b[0], b[1], b[2])];
RS = [for (b = BODY) b[3]];
let($fn = 14) chain(PTS, RS, ice);
// Lavender underbelly: an inset chain below the coil, showing as a stripe on its underside, and a patch on the chest.
let($fn = 10) chain([for (i = [1 : 8]) PTS[i] + [0, -0.4, -1.3]], [for (i = [1 : 8]) RS[i] - 0.8], lav);
color(lav) translate(PTS[2] + [-0.6, -1.4, 0.4]) scale([5.4, 5.4, 5.6]) sphere(1, $fn = 22);

// Ice plates shingled over the back and flanks: flattened scales on the coil's skin in rows, light and shaded rows in
// turn, so the body reads plated like the art and not as a smooth tube. The underside stays bare (the lavender belly).
module scaleOn(c, u, n, a, b, col) {
  t = cross(n, u);
  // tipped 14 degrees so the rear edge (towards the tail) lifts off the skin like a shingle
  ua = u * cos(14) + n * sin(14); na = n * cos(14) - u * sin(14);
  color(col) multmatrix([[ua[0] * a, t[0] * b, na[0] * 0.42, c[0]], [ua[1] * a, t[1] * b, na[1] * 0.42, c[1]],
                         [ua[2] * a, t[2] * b, na[2] * 0.42, c[2]], [0, 0, 0, 1]]) sphere(1, $fn = 5);
}
for (i = [0 : len(PTS) - 3]) let(k = i % 2) let(a = PTS[i], b = PTS[i + 1], tt = 0.5, ctr = a + (b - a) * tt,
                                                    r = RS[i] + (RS[i + 1] - RS[i]) * tt, u = nrm(b - a),
                                                    c0 = cross(u, [0, 0, 1]), sv = norm(c0) < 0.3 ? [0, -1, 0] : nrm(c0),
                                                    up = nrm(cross(sv, u)), vert = norm(c0) < 0.3)
  for (th = vert ? [0, 72, 144, 216, 288] : [10, 60, 115, 165]) let(th2 = th + k * (vert ? 36 : 25), n = sv * cos(th2) + up * sin(th2))
    scaleOn(ctr + n * (r - 0.15), u, n, max(r * 0.75, norm(b - a) * 0.6), r * 0.5, i % 2 ? scaleHi : scaleLo);

// ---- Head (HC is its centre): a round skull, a short blunt snout, the eyes, the crown, the antlers, the shard mane.
HC = S(-16.8, 24.2, -4.5);
HS = 1.35;   // the head block's scale
translate(HC) scale(HS) {
  color(ice) hull() {
    scale([4.0, 3.8, 3.6]) sphere(1, $fn = 18);
    translate([0, -3.7, -1.1]) scale([2.4, 2.3, 1.9]) sphere(1, $fn = 16);
  }
  // Nostrils.
  mirror_x() ell([0.32, 0.2, 0.24], [0.85, -5.9, -0.7], eyeInk);
  // Narrow almond eyes, pale with a blue iris and a fierce slant, under a short brow.
  mirror_x() {
    eye([2.1, -2.95, 0.6], 1.15, iris = eyeIris, sclera = eyeWhite, pupil = eyeInk, yaw = 28, flat = 0.35,
        lid = 0.3, lid_tilt = 26, lid_c = ice, squint = 0.2, shine = true);
    // A heavy brow ridge, low over the nose and lifting to the outer corner.
    color(ice) hull() { translate([0.7, -3.8, 1.85]) sphere(0.6, $fn = 8); translate([2.4, -3.0, 2.5]) sphere(0.65, $fn = 8);
                        translate([3.6, -1.6, 3.0]) sphere(0.6, $fn = 8); }
  }
  // Jaw line: a dark band round the snout where the upper jaw meets the lower, and a lower jaw under it.
  color(eyeInk) translate([0, -3.6, -2.15]) scale([2.2, 2.1, 0.15]) sphere(1, $fn = 16);
  color(ice) translate([0, -3.0, -2.6]) scale([2.1, 2.4, 1.0]) sphere(1, $fn = 14);
  // The shard mane: flat ice blades fanning out round the face, a little behind it and swept back.
  mirror_x() for (m = MANE) let(a = m[0]) shard([0, -0.8, 0], [sin(a) * m[1] * 0.88, 1.5, cos(a) * m[1]], 2.5, 0.55);
  shard([0, -1.0, -2.6], [0, -0.6, -3.6], 1.4);   // chin blade
  // Violet crystal crown: a tall middle crystal and four smaller ones round it.
  crystal([0, 0.6, 2.8], [0, 0.4, 7.2], 1.7);
  crystal([-1.4, 0.2, 2.8], [-1.0, -0.4, 5.0], 1.15, violetHi);
  crystal([1.4, 0.2, 2.8], [1.1, -0.4, 5.2], 1.15, violetHi);
  crystal([-0.8, 1.6, 2.6], [-0.4, 0.7, 4.8], 1.05);
  crystal([0.9, 1.6, 2.6], [0.5, 0.7, 4.5], 1.05);
  // Coral antlers branching up and out of the crown.
  mirror_x() coral([2.2, 1.2, 2.6], [1.2, 0.8, 2.1], 0.7, 3, 20, -1);
}

// ---- Coral on the body.
// [base sheet x, z, depth y,  sheet dx, dz, dy,  radius, depth, spin, hand]
CORAL = [
  // the tail tree
  [9, 32.5, 3,     0, 2.7, 0.3,     1.0, 3, 25, 1],
  [10.5, 29.5, 3,  2.7, 3.7, 0.4,   1.0, 3, -25, -1],
  [12, 26, 3,      3.8, 2.9, 0.4,   1.0, 3, 30, 1],
  [14.5, 21.5, 3.5, 3.7, 2.9, 0.3,  0.9, 2, -30, -1],
  [18, 16.5, 4,    2.4, 1.8, 0.3,   0.85, 2, 25, 1],
  [8, 29, 3,      -1.6, 2.9, 0.3,   0.8, 2, 30, 1],
  [11, 31, 3.5,    1.5, 3, 1.5,     0.9, 3, 35, 1],
  [9.5, 34, 2,     1.2, 2.4, -1,    0.85, 3, -35, 1],
  [12.5, 28, 4.5,  3.2, 2.2, 1,     0.9, 3, 40, -1],
  [14, 23, 1.5,    3.6, 2, -1,      0.85, 2, -40, 1],
  [13, 24, 2,      3, 3.5, -1,      0.9, 3, -35, -1],
  [15.5, 19, 4,    3.2, 1.4, 1,     0.85, 2, 30, 1],
  [17.5, 13.5, 6,  3, 2.5, 1,       0.8, 2, -30, 1],
  [19.5, 12, 5,    1.9, -1.1, 0.3,  0.75, 1, 20, 1],
  // the fan on the middle of the back
  [-1.5, 14, 4,    0.5, 5.9, 0.4,   1.1, 3, 30, 1],
  [-5, 13, 2,      0, 5.0, 0.4,     0.9, 2, -30, -1],
  [3, 14.5, 5,     1, 4.7, 0.4,     0.9, 2, 30, -1],
  [0, 14, 2.5,    -1.5, 5, -0.5,    1.0, 3, -35, -1],
  [-3, 13.5, 4,    1.5, 5.5, 0.6,   1.0, 3, 35, -1],
  [5.5, 14.5, 5,   2, 3.5, 0.5,     0.8, 2, 20, 1],
  [-4, 14, 5.5,   -0.5, 4.6, 1,     0.9, 3, -40, 1],
  [1.5, 14.5, 2,   0.8, 4.8, -1,    0.9, 3, 40, -1],
  [-10, 15, -1,    1.6, 4.4, 0.5,   0.9, 3, -30, 1],
  [-7.5, 13.5, 0.5, 0.8, 4.2, 0.5,  0.9, 2, 30, -1],
  // fronds lying back along the top of the body
  [-8, 13, 1,      3.3, 1.6, 0.6,   0.7, 2, 35, 1],
  [3, 14, 5.5,     3.7, 1.2, 0.6,   0.7, 2, -35, -1],
  [10, 14.5, 6,    3.9, 1.9, 0.4,   0.7, 1, 30, 1],
  [-2, 12.5, 6,    4, 1, 0.5,       0.75, 2, 30, -1],
  [6, 13, 7,       4, 1.5, 0.3,     0.7, 2, -30, 1],
  // fronds lying back along the near flank, so the coil reads woven of coral like the art
  [-10, 9.5, -3.5, 4.2, 0.8, 0.6,   0.6, 1, 8, 1],
  [-4, 11.5, -2,   4.2, 0.6, 0.6,   0.6, 1, -8, -1],
  [2, 10, 0,       4.2, 0.5, 0.4,   0.6, 1, 8, 1],
  [8, 11.5, 1,     4.2, 0.6, 0.2,   0.6, 1, -8, -1],
  [12.5, 8.5, 1,   4, 1.6, 0,       0.6, 1, 8, 1],
  // sprigs under the body, like little feet
  [-20, 5.5, -2,  -1.1, -1.7, 0,    0.7, 1, 20, 1],
  [-12, 4.5, 0,    0.5, -2.3, 0,    0.7, 1, 20, -1],
  [-5.5, 6.5, 1.5, -0.2, -3.2, 0,   0.7, 1, 20, 1],
  [10, 7.5, 5,     0.2, -2.4, 0,    0.65, 1, 20, -1],
  [17, 7.5, 5,     0.5, -1.7, 0,    0.65, 1, 20, 1],
  [-22.5, 10, -2, -1.2, 0.3, 0,     0.6, 1, 20, 1],
];
for (k = CORAL) coral(S(k[0], k[1], k[2]), sd(k[3], k[4], k[5]), k[6] * CR, k[7], k[8], k[9]);
// Pale crystal shards standing on the middle of the back, pointing up and back.
for (s = [[-9.5, 16, -1.5, 0.8, 7], [0.5, 14, 4.5, 1, 9], [3.5, 14.5, 5, 2.2, 10], [6.5, 14.5, 5.5, 2, 6.5], [-3.5, 13.5, 3.5, 0.2, 6], [-7.5, 12.5, 1.5, -0.6, 5]])
  shard(S(s[0], s[1], s[2]), sd(s[3], s[4], 0.5), 1.1, 0.6);
// Ice plates down the front of the neck.
for (i = [0 : 2]) shard(S(-18.5 + i * 0.2, 19.5 - i * 4, -7.2 + i * 0.6), sd(-0.6, -2.6, -0.4), 1.6, 0.5);
