// Ravatar: Katamute's final form, a hunched tan werewolf warrior in a wide brawler's stance.
// Checklist (front sheet, 40 units; the body's axis reads at sheet x -2.25):
//   - head z 22.5..32.5, low between the shoulders; a short muzzle (nose sheet -5, 25), a smirking mouth (z 23.5),
//     narrow slanted fierce eyes, grey-blue irises, near eye sheet (-2.2, 27), far eye (-6.1, 27); dark brows
//   - blue-grey arrow tattoo: point between the eyes (z 27.5), wings at z 29.3, shaft up the forehead into the mane;
//     on the back it runs as a wavy stripe from the nape down the spine to the belt (back sheet z 14..31)
//   - wild dark mane: a mass on the crown with locks swept up and out, sheet x -7..+7, top z 40
//   - short dark antlers beside the mane (sheet -7..-6 and +3..+4, z 30..37), small tan ears
//   - cream ruff on the upper chest with a ragged V edge (z 19..26), cream cheek fluff
//   - broad muscled torso: pecs with eye-shaped swirl tattoos (sheet -6.8 / -1.8, z 20.5), abs, swirls on the
//     shoulders and the shoulder blades, tiger stripes on the arms
//   - long arms out to the sides: shoulders z 22, elbows z 17, big clawed hands at z 9..15 (sheet -16 / +9.5)
//   - wide stance: thighs under bark / rock plates pointing up, rock greaves, splayed clawed feet (sheet -12 / +5.5)
//   - bark skirt: a belt at z 15.6 and pointed plates hanging to z 7 at the front
//   - big bushy tail: grey over a cream outer edge, from the lower back out along +X, down to z 4 and up to a dark
//     tip at sheet (15, 23)
// Forms copy this file: the colours are the constants below, the shared numbers are named, every part is a module.
include <lib.scad>

fur = [0.74, 0.56, 0.37];
furLight = [0.84, 0.68, 0.48];
cream = [0.9, 0.79, 0.58, NOGLOW];
mane = [0.3, 0.27, 0.25];
maneHi = [0.42, 0.39, 0.35];
antler = [0.4, 0.33, 0.28];
mark = [0.3, 0.36, 0.42];
tat = [0.31, 0.27, 0.25];
bark = [0.43, 0.36, 0.32];
barkHi = [0.55, 0.45, 0.37];
barkDark = [0.29, 0.24, 0.22];
tailGrey = [0.4, 0.38, 0.35];
tailCream = [0.8, 0.75, 0.62, NOGLOW];
claw = [0.3, 0.24, 0.22];
toeClaw = [0.55, 0.45, 0.36];
paw = fur;
limbFn = 18;   // the arm / thigh capsules' facets
ink = [0.16, 0.13, 0.13];
iris = [0.42, 0.53, 0.6];
sclera = [0.95, 0.91, 0.78, NOGLOW];
pupilC = ink;

// ---- Shapes shared by several parts (the rig file copies these numbers).
HEAD = [[[4.3, 3.8, 3.8], [0, -0.6, 26.8]], [[3.4, 3.1, 2.8], [0, -0.3, 30]]];
TORSO = [[[3.8, 3, 2.5], [0, 0.2, 15.5]], [[6.2, 3.9, 3.6], [0, -0.2, 20]], [[5.6, 3.6, 2.6], [0, 0.6, 23]]];
RUFF = [[[5.8, 3.4, 2.6], [0, -0.6, 24]], [[4.2, 2.6, 2], [0, -2.2, 22.2]]];
MANE = [[[3.6, 2.4, 2.4], [0, 2.2, 29.4]], [[4.4, 3.6, 2.6], [0, 1.4, 32]], [[4.6, 3.4, 2.6], [1.2, 1.8, 35]],
        [[3.2, 2.6, 1.8], [2, 2.2, 37.8]]];
SHOULDER = [8.3, 0, 21.8];
ELBOW = [11.5, -2.4, 17];
WRIST = [14.2, -2.3, 14.4];
HAND = [14.6, -2.4, 12.6];
HIP = [4.2, 0.3, 13.2];
KNEE = [7.6, -1.2, 8.2];
ANKLE = [9.6, -1.4, 3.2];
FOOT = [9.8, -1.6, 0];
TAIL = [[1, 3.2, 11.5], [6, 6, 7.4], [11, 6, 7.2], [16, 4.5, 10.2], [17, 3, 15.4], [18, 2, 20], [18.6, 1.6, 23.4]];
TAIL_R = [2, 3.3, 4.2, 4.6, 4.2, 3, 0.6];
CREAM = [[6, 5.4, 5.4], [11.6, 5.4, 4.9], [18.3, 3.9, 9.2], [19.8, 2.4, 15.4], [20, 1.6, 19.5]];
CREAM_R = [2.4, 3.2, 3.5, 3, 1.8];
EYE = [2.4, -3.45, 27.3];
// mane locks: [root, d1, d2, d3, root radius, highlight]
LOCKS = [[[0, 1.4, 38.5], [-0.6, 0.4, 1.4], [-0.6, 0.6, 1], [-0.4, 0.6, 0.6], 1.6, 0],
         [[1.4, 1.4, 38], [1, 0.6, 1.4], [1.4, 0.8, 0.8], [1.4, 0.8, 0.2], 1.5, 1],
         [[2.8, 1.4, 36], [1.8, 0.4, 0.9], [2, 0.6, 0.4], [1.6, 0.8, -0.2], 1.6, 0],
         [[3.2, 1.8, 33.6], [2, 0.4, 0.2], [1.8, 0.8, -0.4], [1.4, 1, -0.8], 1.5, 1],
         [[-1.6, 1.2, 37.8], [-0.8, 0.4, 1.4], [-1, 0.6, 0.8], [-0.8, 0.8, 0.4], 1.5, 1],
         [[-3, 1.4, 35.8], [-1.8, 0.4, 0.8], [-1.6, 0.8, 0.4], [-1.2, 0.8, 0], 1.6, 0],
         [[-3.2, 1.8, 33.4], [-1.8, 0.6, -0.2], [-1.4, 1, -0.6], [-1, 1, -0.8], 1.4, 0],
         [[0.5, 3.6, 36.4], [0.2, 1.2, 1.6], [0.3, 1, 1.4], [0.2, 0.8, 0.8], 1.6, 0],
         [[2.2, 3.6, 34.4], [1.2, 1.2, 1], [1.4, 0.8, 0.8], [1, 0.6, 0.4], 1.4, 1],
         [[-2, 3.6, 34.2], [-1.2, 1.2, 0.8], [-1.2, 0.8, 0.8], [-0.8, 0.6, 0.4], 1.4, 0],
         [[0, 3.8, 32.4], [0, 1.6, -0.8], [0, 1.2, -1.6], [0, 0.6, -1.4], 1.5, 0]];
ANTLER = [[3.6, 0, 29.6], [5.4, 0.2, 32.2], [6.6, 0.4, 35], [6.3, 0.6, 37.2]];
ANTLER_R = [1.1, 0.9, 0.6, 0.15];

// Low-poly ellipsoid / petal for the many small parts (lib's ell and petal are 28 / 24 sided).
module oval(r, p, c, fn = 12) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
module leaf(r, p, rot, c, fn = 10) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
module blobN(parts, c, fn = 14) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }
module grownBlob(parts, g) { hull() for (e = parts) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 28); }
module stroke(pts, r, c) { chain(pts, [for (p = pts) r], c); }
// Swirl tattoo in the XZ plane facing yaw (0 = -Y), radius R.
module tswirl(p, R, yaw = 0, c = tat) {
  n = 12;
  translate(p) rotate([0, 0, yaw])
    chain([for (i = [0 : n]) let(t = i / n, a = t * 500, rr = R * (0.2 + 0.8 * t)) [rr * cos(a), 0, rr * sin(a)]],
          [for (i = [0 : n]) 0.28], c, $fn = 6);
}
// A pointed bark / rock plate: a flat oval base w x t with a ridge down its face, its point h along +Z.
module shard(p, rot, w, t, h, c) {
  color(c) translate(p) rotate(rot) hull() {
    scale([w, t, 0.3]) sphere(1, $fn = 10);
    translate([0, -t * 0.7, h * 0.4]) sphere(t * 0.5, $fn = 6);
    translate([0, 0, h]) sphere(0.1, $fn = 6);
  }
}
// A hair lock: a tapering capsule chain from p along d1, d2, d3.
module lock(p, d1, d2, d3, r, c) { chain([p, p + d1, p + d1 + d2, p + d1 + d2 + d3], [r, r * 0.75, r * 0.45, 0.1], c, $fn = 10); }
// A soft pointed fur tuft: a flattened ball at p drawn out to a point along d.
module tuft(p, d, w, c) { color(c) hull() { translate(p) scale([w, w * 0.7, w]) sphere(1, $fn = 10); translate(p + d) sphere(0.15, $fn = 6); } }
// A painted band across a limb: the limb grown a hair, cut by a thin slab across it at C, on the side facing `out`.
module band(p1, p2, r1, r2, C, out, c = tat) {
  d = p2 - p1;
  color(c) intersection() {
    hull() { translate(p1) sphere(r1 + 0.12, $fn = 16); translate(p2) sphere(r2 + 0.12, $fn = 16); }
    translate(C) rotate(_dir_rot(d)) rotate([12, 0, 0]) cube([9, 9, 0.5], center = true);
    translate(C + out * 2.3) sphere(2.6, $fn = 12);
  }
}

// ---- Legs: thighs under bark plates, rock greaves, splayed clawed feet.
module legs() mirror_x() {
  limb(HIP, KNEE, 3, 2.4, barkDark, $fn = limbFn);
  ell([2.1, 2, 1.8], KNEE + [0, -0.6, 0.6], fur);   // the knee shows between the plates
  limb(KNEE, ANKLE, 2.3, 1.8, fur, $fn = 16);
  // thigh plates, pointing up like scales
  shard([5.9, -2.8, 7.8], [-15, -8, 0], 2.5, 0.9, 7, bark);
  shard([8.1, -1.2, 8.4], [-10, 22, 0], 2.2, 0.85, 6.2, barkHi);
  shard([4.4, -2.5, 10.4], [-18, -16, 0], 1.9, 0.8, 5, barkHi);
  shard([8.4, 0.8, 8.6], [10, 24, 0], 1.8, 0.75, 4.8, bark);
  shard([6.2, 2.2, 9.6], [18, 8, 0], 1.8, 0.75, 4.6, barkDark);
  // greave: a rock cuff with plates round it
  oval([2.6, 2.6, 2.5], [8.8, -1.4, 5], barkDark, 16);
  for (a = [-50, 10, 70, 140, 210]) translate([8.8, -1.4, 4]) rotate([0, 0, a]) translate([0, -2.2, 0])
    shard([0, 0, 0], [16, 0, 0], 1.55, 0.7, 4, (a % 120 == 10) ? barkHi : bark);
  // paw
  translate(FOOT) rotate([0, 0, 18]) {
    blobN([[[1.9, 1.7, 1.3], [0, 0.4, 1.4]], [[2, 1.6, 1.1], [0, -1.8, 1.1]]], paw);
    for (dx = [-1.15, 0, 1.15]) {
      oval([0.65, 0.9, 0.6], [dx, -3.1, 0.75], paw);
      spike([dx, -3.8, 0.7], [dx * 0.25, -1.1, -0.55], 0.42, 0.05, toeClaw);
    }
  }
}

// ---- Bark skirt: belt, plates hanging at the front, back and hips.
module skirt() {
  oval([4.1, 3.3, 2], [0, 0.3, 13.4], barkDark, 20);
  oval([4.25, 3.55, 0.9], [0, 0.2, 15.6], barkDark, 24);
  shard([0, -3.3, 15.4], [180, 0, 0], 2.6, 0.8, 8.6, bark);
  mirror_x() shard([2.3, -2.9, 15.2], [182, -12, 0], 1.8, 0.7, 6.6, barkHi);
  shard([0, 3.6, 15.4], [178, 0, 0], 2.2, 0.8, 6.8, bark);
  mirror_x() {
    shard([2.6, 3, 15.2], [178, -12, 0], 1.7, 0.7, 5.6, barkDark);
    shard([3.9, -1.4, 15.4], [178, -28, 0], 1.8, 0.7, 5.2, bark);
    shard([3.9, 1.4, 15.4], [178, -28, 0], 1.7, 0.7, 4.8, barkHi);
  }
}

// ---- Torso: broad and muscled; cream ruff on the upper chest; tattoos.
module torso() {
  blob(TORSO, fur);
  mirror_x() {
    oval([2.7, 1.3, 1.9], [2.7, -3, 20.6], fur, 18);   // pecs
    for (z = [16.4, 17.8]) oval([1.05, 0.7, 0.62], [1.05, -2.95 - (z - 16.4) * 0.12, z], furLight, 10);   // abs
    // eye-shaped swirl tattoo on the pec
    translate([2.7, -4.05, 20.5]) rotate([0, 0, 18]) {
      color(tat) scale([1.75, 0.4, 0.92]) sphere(1, $fn = 14);
      color(cream) translate([0, -0.12, 0]) scale([1.15, 0.36, 0.52]) sphere(1, $fn = 12);
      color(tat) translate([0, -0.24, 0]) scale([0.42, 0.3, 0.42]) sphere(1, $fn = 8);
    }
    tswirl([3.5, 3.45, 20.4], 1.5, 180);   // shoulder blades
  }
  // ruff: a cream collar round the neck and over the upper chest, a ragged V edge below
  blobN(RUFF, cream, 20);
  for (s = [[0, 19.6, 0, 2], [1.8, 20.2, -18, 1.8], [-1.8, 20.2, 18, 1.8], [3.6, 21, -32, 1.6], [-3.6, 21, 32, 1.6],
            [5.2, 22, -50, 1.4], [-5.2, 22, 50, 1.4]])
    leaf([1.2, 0.55, s[3]], [s[0], -4.3 + abs(s[0]) * 0.25, s[1] + s[3] * 0.6], [-8, s[2], 0], cream);
  // spine stripe: the arrow's tail down the back
  color(mark) intersection() {
    grownBlob(TORSO, 0.12);
    mirror([0, 1, 0]) rotate([90, 0, 0]) linear_extrude(12)
      polygon([[0.85, 31], [1.4, 27], [1.8, 23], [1.2, 18.5], [0.3, 14.2], [-0.4, 14.2], [-0.4, 18.5], [0.2, 23],
               [-0.2, 27], [-0.85, 31]]);
  }
}

// ---- Arms: long, out to the sides, big clawed hands; a swirl on each shoulder, stripes down the arm.
// One arm (the creature's left numbers): shoulder S, elbow E, wrist W, hand H.
module arm(S, E, W, H) {
  oval([2.8, 2.8, 2.6], S, fur, 20);
  limb(S, E, 2.5, 2.2, fur, $fn = limbFn);
  limb(E, W, 2.2, 2.1, fur, $fn = limbFn);
  tswirl([8.6, -2.5, 22.9], 1.2, 30);
  tswirl([9.3, 2.3, 22.6], 1.1, 150);
  band(S, E, 2.5, 2.2, S + (E - S) * 0.62, [0.8, 0, 0.2]);
  for (t = [0.3, 0.62]) band(E, W, 2.2, 2.1, E + (W - E) * t, [0.6, -0.5, 0.5]);
  oval([2.4, 2.1, 2.5], H, fur, 20);
  for (dx = [-1.3, -0.45, 0.45, 1.3]) {
    limb(H + [dx, -0.7, -1.5], H + [dx * 1.25, -1.5, -2.8], 0.65, 0.55, fur);
    spike(H + [dx * 1.25, -1.6, -3], [dx * 0.2, -0.5, -1.4], 0.5, 0.05, claw);
  }
}
module arms() mirror_x() arm(SHOULDER, ELBOW, WRIST, HAND);

// ---- Bushy tail: grey over a cream outer edge, ragged lobes on the silhouette, a dark point.
module tail() {
  for (i = [0 : len(TAIL) - 2])
    blobN([[[TAIL_R[i], TAIL_R[i] * 0.8, TAIL_R[i]], TAIL[i]], [[TAIL_R[i + 1], TAIL_R[i + 1] * 0.8, TAIL_R[i + 1]], TAIL[i + 1]]], tailGrey);
  for (i = [0 : len(CREAM) - 2])
    blobN([[[CREAM_R[i], CREAM_R[i] * 0.85, CREAM_R[i]], CREAM[i]], [[CREAM_R[i + 1], CREAM_R[i + 1] * 0.85, CREAM_R[i + 1]], CREAM[i + 1]]], tailCream);
  for (t = [[[9.6, 5, 4], [3.4, -0.4, -1.2], 1.7, tailCream], [[14.8, 3.8, 5], [3.8, -0.4, -0.2], 1.8, tailCream],
            [[20, 2.6, 9.8], [1.8, -0.4, 3.2], 1.7, tailCream], [[20.6, 1.6, 13.6], [1, -0.2, 3.6], 1.6, tailCream],
            [[20, 1.2, 18.2], [0.3, 0, 3.4], 1.4, tailCream], [[12.4, 6.6, 11.2], [-1, 0, 3.6], 1.7, tailGrey],
            [[14.2, 5, 15], [-1.2, 0, 3.6], 1.6, tailGrey], [[11, 8.4, 8.8], [3, 0.8, 0.6], 1.7, tailGrey],
            [[16.6, 6.8, 12.4], [0.6, 0.6, 3.2], 1.6, tailGrey], [[5.6, 7.6, 9.4], [3, 0.6, -0.6], 1.5, tailGrey]])
    tuft(t[0], t[1], t[2], t[3]);
  tuft([18, 1.8, 21.2], [-0.9, 0, 3.6], 1.9, tailGrey);   // the dark point
}

// ---- Head: a lion-wolf face, short muzzle, fierce slanted eyes, a smirk.
module head() {
  blob(HEAD, fur);
  oval([2.1, 1.9, 1.5], [0, -3.9, 24.4], furLight, 20);   // muzzle
  oval([1.6, 1.4, 0.9], [0, -3.6, 23.1], fur, 16);   // chin
  oval([0.9, 0.55, 0.52], [0, -5.65, 25.3], ink, 14);   // nose
  stroke([[0, -5.75, 24.9], [0, -5.45, 23.7]], 0.15, ink);
  stroke([[-1.35, -4.85, 23.75], [-0.5, -5.35, 23.45], [0.5, -5.35, 23.5], [1.4, -4.9, 23.95]], 0.18, ink);
  mirror_x() spike([0.75, -5.25, 23.6], [0.05, -0.1, -0.55], 0.2, 0.03, cream);   // fangs
  mirror_x() {
    // cheek fluff
    leaf([3, 1, 1.7], [4.6, -1.4, 25.2], [0, 28, 25], cream);
    leaf([2.4, 0.9, 1.3], [4.2, -2.2, 23.4], [0, 42, 20], cream);
    // ears
    leaf([0.85, 0.5, 1.7], [3.4, 0.2, 30.6], [0, 25, 0], fur);
    // eyes under a dark brow slanting down to the nose
    eye(EYE, 0.9, iris = iris, sclera = sclera, pupil = pupilC, yaw = 22, lid = 0.45, lid_tilt = 28, lid_c = fur,
        slit = 0.4, squint = 0.2);
    stroke([[0.9, -4.05, 27.9], [2.4, -3.8, 28.35], [3.6, -2.95, 28.8]], 0.2, ink);
  }
  // arrow tattoo on the forehead, its shaft running up under the mane
  color(mark) intersection() {
    grownBlob(HEAD, 0.12);
    rotate([90, 0, 0]) linear_extrude(12)
      polygon([[0, 27.5], [-2.1, 29.3], [-1, 29.15], [-1.05, 34], [1.05, 34], [1, 29.15], [2.1, 29.3]]);
  }
}

// ---- Wild mane: a mass on the crown and locks swept up, out and back; antlers beside it.
module maneHair() {
  blobN(MANE, mane, 20);
  for (l = LOCKS) lock(l[0], l[1], l[2], l[3], l[4], l[5] == 1 ? maneHi : mane);
}
module antlers() mirror_x() {
  chain(ANTLER, ANTLER_R, antler);
  limb([5.45, 0.2, 32.4], [7.3, -0.1, 33.6], 0.6, 0.15, antler);
}

module ravatar() {
  legs();
  skirt();
  torso();
  arms();
  tail();
  head();
  maneHair();
  antlers();
}

ravatar();
