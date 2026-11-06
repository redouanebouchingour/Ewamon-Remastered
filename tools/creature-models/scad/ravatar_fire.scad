// Ravatar (fire relic): Ravatar (scad/ravatar.scad) in spiky black obsidian armour set with glowing ember gems, its
// arrow and eyes burning, both fists ablaze, its tail darkened with a great flame rising off it, fire at its feet.
// Checklist (front sheet, 40 units, the same frame as the base; the body's axis reads at sheet x -2.5):
//   - head, mane, antlers, ears, cheeks, muzzle and smirk as the base; the face a pale tan
//   - arrow: red with a yellow star core, point between the eyes (z 27.5), wings z 29.5, shaft up into the mane;
//     red streaks frame each eye (a brow streak from the arrow's wing, a streak under the outer corner); the eyes
//     burn yellow in an orange rim, no pupil
//   - obsidian armour (#2e2328 / #4a3b3a): spiky pauldrons on both shoulders (spikes up to z 31), a gorget under the
//     chin, pec plates each set with a big eye-shaped ember gem (red rim, orange, yellow core) at z 20.5, the pale fur
//     sternum showing between them (z 17..19), a belly plate with a vertical gem, a bark skirt turned obsidian,
//     obsidian thigh plates and greaves; bracers on the forearms; the upper arms and paws stay tan
//   - fists: each hand wrapped in flame tongues rising to z 20 (near sheet 6..14, far -20..-12)
//   - tail: the base tail's lower sweep in dark brown with an ember-brown outer edge; from its up-curl a great flame
//     rises and leans out (sheet x 10..23, z 10..36)
//   - fire licks round both feet on the ground (far side sheet -21..-12, z 0..8)
//   - back: a great obsidian back plate (z 15..29) set with six ember gems, a red stripe on the nape above it
// Flames: bright orange tongues with a yellow core, red only at the tips (no dark crimson).
include <lib.scad>

fur = [0.75, 0.56, 0.41];
furLight = [0.86, 0.72, 0.54];
cream = [0.91, 0.8, 0.63, NOGLOW];
mane = [0.3, 0.26, 0.25];
maneHi = [0.43, 0.38, 0.35];
antler = [0.4, 0.3, 0.26];
obsidian = [0.18, 0.14, 0.16];
obsHi = [0.29, 0.23, 0.23];
tailBrown = [0.42, 0.24, 0.19];
tailEmber = [0.7, 0.34, 0.2];
claw = [0.3, 0.24, 0.22];
toeClaw = [0.91, 0.8, 0.63, NOGLOW];
paw = fur;
limbFn = 12;   // the arm / thigh capsules' facets
ink = [0.16, 0.13, 0.13];
markRed = [0.92, 0.2, 0.05, NOGLOW];
markCore = [0.99, 0.85, 0.32, GLOW];
gemRed = [0.86, 0.16, 0.05, NOGLOW];
gemOrange = [0.98, 0.6, 0.14, NOGLOW];
gemCore = [1, 0.88, 0.4, GLOW];
iris = [1, 0.86, 0.35, GLOW];
sclera = [0.98, 0.52, 0.1, NOGLOW];
pupilC = iris;
flameO = [0.97, 0.45, 0.1, NOGLOW];
flameY = [0.99, 0.8, 0.28, GLOW];
flameTip = [0.94, 0.26, 0.07, NOGLOW];

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
// the base tail up to its up-curl (the flame takes over from TAIL[4])
TAIL = [[1, 3.2, 11.5], [6, 6, 7.4], [11, 6, 7.2], [16, 4.5, 10.2], [17, 3, 15.4]];
TAIL_R = [2, 3.3, 4.2, 4.6, 3.2];
CREAM = [[6, 5.4, 5.4], [11.6, 5.4, 4.9], [18.3, 3.9, 9.2], [19.4, 2.8, 13.4]];
CREAM_R = [2.4, 3.2, 3.5, 2.4];
EYE = [2.4, -3.45, 27.3];
BACKPLATE = [[[5.8, 1.8, 4.5], [0, 3.4, 23.5]], [[4.4, 1.5, 3], [0, 3, 17.6]]];
// fire: soft bodies [points, radii] and tongues [base, direction, width, bend (, tail link)]; the fist's numbers are
// relative to the hand
FIST_BODY = [[[0.2, -0.2, 0.8], [0.4, -0.3, 3.4]], [3, 2.5]];
FIST_FL = [[[0, -0.2, 1.6], [0.8, -0.4, 6.6], 2, [0.9, 0, 0]], [[1.4, 0.2, 0.8], [2.8, 0.2, 5.2], 1.7, [0.6, 0, 0.4]],
           [[-1.2, -0.4, 1.2], [-1.6, -0.4, 4.8], 1.5, [-0.6, 0, 0]], [[1.4, -0.6, -0.6], [4, -0.6, 1.4], 1.4, [0, 0, -1.2]],
           [[0.2, 1, 1], [0.4, 1.4, 4.8], 1.5, [0.5, 0.3, 0]], [[-0.4, -1.4, -1.4], [2.4, -1.2, -2.2], 1.2, [0.8, 0, -0.6]]];
TAIL_BODY = [[[15.6, 3.6, 11.5], [18.6, 2.8, 16.5], [20.4, 2.4, 22.5], [21, 2.2, 26]], [4.4, 4.8, 3.8, 2.2]];
TAIL_FL = [[[20, 2.4, 19], [2, -0.4, 16], 3.6, [-1.8, 0, 0], 5], [[21, 2.4, 15], [6, 0, 12], 2.9, [1, 0, 0.6], 5],
           [[17.4, 3, 16], [-1.8, 0, 13], 2.7, [-1, 0, 0], 5], [[20, 2.6, 10.5], [6.5, -0.4, 6], 2.4, [0, 0, 1.2], 4],
           [[14, 4.6, 9], [-0.4, 0.4, 9.5], 2.6, [-0.8, 0, 0], 3], [[16.5, 5.4, 9], [0.6, 1.8, 11], 2.6, [0.8, 0, 0], 4],
           [[9.5, 3.6, 1.2], [2.5, -0.6, 6.5], 2.2, [0.8, 0, 0], 2], [[15, 3, 1.4], [3, -0.6, 6], 2, [0.6, 0, 0.6], 3]];
FOOT_FL = [[[12.2, -1.6, 0.4], [5.4, -1, 6.6], 2.2, [0.8, 0, -1.4]], [[11, -4.4, 0.4], [1.8, -2.2, 4], 1.4, [0.6, 0, 0]],
           [[12, 1.4, 0.4], [2.4, 1.6, 4.2], 1.5, [0.6, 0, 0]], [[6.6, -2.4, 0.4], [-2.4, -0.6, 4.2], 1.6, [-0.6, 0, 0]]];

// Low-poly ellipsoid / petal for the many small parts (lib's ell and petal are 28 / 24 sided).
module oval(r, p, c, fn = 12) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
module leaf(r, p, rot, c, fn = 10) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
module blobN(parts, c, fn = 14) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }
module grownBlob(parts, g) { hull() for (e = parts) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 28); }
module stroke(pts, r, c) { chain(pts, [for (p = pts) r], c); }
// A pointed armour plate: a flat oval base w x t with a ridge down its face, its point h along +Z.
module shard(p, rot, w, t, h, c) {
  color(c) translate(p) rotate(rot) hull() {
    scale([w, t, 0.3]) sphere(1, $fn = 10);
    translate([0, -t * 0.7, h * 0.4]) sphere(t * 0.5, $fn = 6);
    translate([0, 0, h]) sphere(0.1, $fn = 6);
  }
}
// A hair lock: a tapering capsule chain from p along d1, d2, d3.
module lock(p, d1, d2, d3, r, c) { chain([p, p + d1, p + d1 + d2, p + d1 + d2 + d3], [r, r * 0.75, r * 0.45, 0.1], c, $fn = 8); }
// A soft pointed fur tuft: a flattened ball at p drawn out to a point along d.
module tuft(p, d, w, c) { color(c) hull() { translate(p) scale([w, w * 0.7, w]) sphere(1, $fn = 10); translate(p + d) sphere(0.15, $fn = 6); } }
// An eye-shaped ember gem facing yaw (0 = -Y): a red rim, an orange eye, a yellow core.
module gem(p, rot, s) {
  translate(p) rotate(rot) {
    color(gemRed) scale([s[0], 0.42, s[1]]) sphere(1, $fn = 10);
    color(gemOrange) translate([0, -0.14, 0]) scale([s[0] * 0.72, 0.4, s[1] * 0.62]) sphere(1, $fn = 8);
    color(gemCore) translate([0, -0.26, 0]) scale([s[0] * 0.32, 0.32, s[1] * 0.36]) sphere(1, $fn = 6);
  }
}

// A soft flame tongue from p along d, swaying in an S (`bend` out at a third, half of it back at two thirds), w wide
// at its swelling and k * w deep: a teardrop that swells from its root and draws out to a point, an orange body, a
// yellow heart showing front and back low down, a red tip.
FL_R = [0.85, 1, 0.78, 0.45, 0.1];
function cb(a, b, c, e, t) = pow(1 - t, 3) * a + 3 * t * pow(1 - t, 2) * b + 3 * t * t * (1 - t) * c + pow(t, 3) * e;
module flame(p, d, w, bend = [0, 0, 0], k = 0.62) {
  n = 4;
  pts = [for (i = [0 : n]) cb(p, p + d / 3 + bend, p + d * 2 / 3 - bend * 0.5, p + d, i / n)];
  rs = [for (i = [0 : n]) w * FL_R[i]];
  for (i = [0 : n - 1]) color(i == n - 1 ? flameTip : flameO) hull() for (j = [i, i + 1])
    translate(pts[j]) scale([rs[j], rs[j] * k, rs[j]]) sphere(1, $fn = w >= 2.4 ? 10 : 8);
  for (i = [0 : 1]) color(flameY) hull() for (j = [i, i + 1])
    translate(pts[j]) scale(j == 2 ? [0.3, 0.3 * k, 0.3] * rs[j] : [0.58, 1.2 * k, 0.58] * rs[j]) sphere(1, $fn = 6);
}
// A soft body of fire along pts (radii rs): orange, its yellow heart showing front and back.
module fireBody(pts, rs, k = 0.6) {
  for (i = [0 : len(pts) - 2]) {
    color(flameO) hull() for (j = [i, i + 1]) translate(pts[j]) scale([rs[j], rs[j] * k, rs[j]]) sphere(1, $fn = w >= 2.4 ? 10 : 8);
    color(flameY) hull() for (j = [i, i + 1]) translate(pts[j]) scale([rs[j] * 0.7, rs[j] * 0.75, rs[j] * 0.7]) sphere(1, $fn = 8);
  }
}

// ---- Legs: obsidian thigh plates and greaves, tan knees, shins and splayed clawed feet; fire at the feet.
module legs() mirror_x() {
  limb(HIP, KNEE, 3, 2.4, obsidian, $fn = limbFn);
  oval([2.1, 2, 1.8], KNEE + [0, -0.6, 0.6], fur, 12);   // the knee shows between the plates
  limb(KNEE, ANKLE, 2.3, 1.8, fur, $fn = 12);
  // thigh plates, pointing up like scales
  shard([5.9, -2.8, 7.8], [-15, -8, 0], 2.5, 0.9, 7, obsidian);
  shard([8.1, -1.2, 8.4], [-10, 22, 0], 2.2, 0.85, 6.2, obsHi);
  shard([4.4, -2.5, 10.4], [-18, -16, 0], 1.9, 0.8, 5, obsHi);
  shard([8.4, 0.8, 8.6], [10, 24, 0], 1.8, 0.75, 4.8, obsidian);
  shard([6.2, 2.2, 9.6], [18, 8, 0], 1.8, 0.75, 4.6, obsHi);
  // greave: an obsidian cuff with plates round it and an ember gem at the front
  oval([2.6, 2.6, 2.5], [8.8, -1.4, 5], obsidian, 12);
  for (a = [-50, 10, 70, 140, 210]) translate([8.8, -1.4, 4]) rotate([0, 0, a]) translate([0, -2.2, 0])
    shard([0, 0, 0], [16, 0, 0], 1.55, 0.7, 4, (a % 120 == 10) ? obsHi : obsidian);
  gem([8.6, -4.1, 5.4], [0, 0, 10], [0.55, 0.9]);
  // paw
  translate(FOOT) rotate([0, 0, 18]) {
    blobN([[[1.9, 1.7, 1.3], [0, 0.4, 1.4]], [[2, 1.6, 1.1], [0, -1.8, 1.1]]], paw);
    for (dx = [-1.15, 0, 1.15]) {
      oval([0.65, 0.9, 0.6], [dx, -3.1, 0.75], paw, 8);
      spike([dx, -3.8, 0.7], [dx * 0.25, -1.1, -0.55], 0.42, 0.05, toeClaw, $fn = 6);
    }
  }
}
module footFire() mirror_x() for (f = FOOT_FL) flame(f[0], f[1], f[2], f[3]);

// ---- Obsidian skirt: belt, plates hanging at the front, back and hips.
module skirt() {
  oval([4.1, 3.3, 2], [0, 0.3, 13.4], obsidian, 14);
  oval([4.25, 3.55, 0.9], [0, 0.2, 15.6], obsHi, 18);
  shard([0, -3.3, 15.4], [180, 0, 0], 2.6, 0.8, 8.6, obsidian);
  mirror_x() shard([2.3, -2.9, 15.2], [182, -12, 0], 1.8, 0.7, 6.6, obsHi);
  shard([0, 3.6, 15.4], [178, 0, 0], 2.2, 0.8, 6.8, obsidian);
  mirror_x() {
    shard([2.6, 3, 15.2], [178, -12, 0], 1.7, 0.7, 5.6, obsHi);
    shard([3.9, -1.4, 15.4], [178, -28, 0], 1.8, 0.7, 5.2, obsidian);
    shard([3.9, 1.4, 15.4], [178, -28, 0], 1.7, 0.7, 4.8, obsHi);
  }
}

// ---- Torso: tan, under an obsidian gorget, pec plates with ember gems, a belly plate and a great back plate.
module torso() {
  blobN(TORSO, fur, 20);
  for (z = [17.8]) mirror_x() oval([1.05, 0.7, 0.62], [1.05, -2.95 - (z - 16.4) * 0.12, z], furLight, 10);   // sternum fur
  // gorget round the neck, a ragged edge of plates below
  blobN(RUFF, obsidian, 16);
  for (s = [[1.8, 20.6, -18, 1.4], [-1.8, 20.6, 18, 1.4], [5.2, 22, -50, 1.4], [-5.2, 22, 50, 1.4]])
    leaf([1.2, 0.55, s[3]], [s[0], -4.3 + abs(s[0]) * 0.25, s[1] + s[3] * 0.6], [-8, s[2], 0], obsHi);
  mirror_x() {
    oval([3, 1.45, 2.15], [2.8, -3.05, 20.6], obsidian, 14);   // pec plate
    gem([2.75, -4.25, 20.6], [0, 0, 18], [2.2, 1.15]);
  }
  // belly plate with a vertical gem
  oval([2.4, 1.05, 2.2], [0, -2.75, 15.6], obsidian, 16);
  gem([0, -3.75, 15.6], [0, 0, 0], [0.6, 1.4]);
  // back plate with six ember gems and two spikes on its top edge
  blobN(BACKPLATE, obsidian, 18);
  for (g = [[1.3, 4.5, 26.9, 25], [3.3, 4.75, 24.6, 50], [2.6, 4.75, 21.4, -30]]) mirror_x()
    gem([g[0], g[1], g[2]], [0, g[3], 180], [0.45, 1.2]);
  mirror_x() shard([3.6, 3.7, 26.6], [-25, 15, 0], 1.1, 0.5, 3.2, obsHi);
}

// ---- Arms: tan upper arms under spiky obsidian pauldrons, obsidian bracers, fists ablaze.
// One arm (the creature's left numbers): shoulder S, elbow E, wrist W, hand H.
module arm(S, E, W, H) {
  oval([2.8, 2.8, 2.6], S, fur, 14);
  limb(S, E, 2.5, 2.2, fur, $fn = limbFn);
  limb(E, W, 2.2, 2.1, fur, $fn = limbFn);
  // pauldron: a dome over the shoulder, spikes raking up and out, an ember gem at the front
  oval([3.3, 3.2, 2.3], S + [0.3, 0, 1.8], obsidian, 16);
  shard(S + [0.6, -1.3, 3.2], [12, 18, 0], 1.3, 0.6, 5.6, obsidian);
  shard(S + [0.4, 1.2, 3.2], [-12, 15, 0], 1.2, 0.55, 5, obsHi);
  shard(S + [2.1, 0, 2.8], [0, 38, 0], 1.2, 0.55, 4.4, obsidian);
  shard(S + [2.8, -1.4, 1.6], [15, 62, 0], 1, 0.5, 3.4, obsHi);
  gem(S + [1, -3.05, 1.8], [0, 0, 25], [0.8, 0.55]);
  // bracer: an obsidian cuff on the forearm with a spike on its outer side
  color(obsidian) hull() { translate(E + (W - E) * 0.2) sphere(2.45, $fn = 12); translate(E + (W - E) * 0.75) sphere(2.35, $fn = 12); }
  shard(E + (W - E) * 0.45 + [1.8, 0.4, 0], [0, 70, 15], 0.9, 0.45, 3.2, obsHi);
  oval([2.4, 2.1, 2.5], H, fur, 12);
  for (dx = [-1.3, -0.45, 0.45, 1.3]) {
    limb(H + [dx, -0.7, -1.5], H + [dx * 1.25, -1.5, -2.8], 0.65, 0.55, fur, $fn = 8);
    spike(H + [dx * 1.25, -1.6, -3], [dx * 0.2, -0.5, -1.4], 0.5, 0.05, claw, $fn = 6);
  }
}
module fistFire(H) {
  fireBody([for (q = FIST_BODY[0]) H + q], FIST_BODY[1]);
  for (f = FIST_FL) flame(H + f[0], f[1], f[2], f[3]);
}
module arms() mirror_x() { arm(SHOULDER, ELBOW, WRIST, HAND); fistFire(HAND); }

// ---- Tail: the base tail's sweep in dark brown over an ember-brown edge, a great flame rising off its up-curl.
module tail() {
  for (i = [0 : len(TAIL) - 2])
    blobN([[[TAIL_R[i], TAIL_R[i] * 0.8, TAIL_R[i]], TAIL[i]], [[TAIL_R[i + 1], TAIL_R[i + 1] * 0.8, TAIL_R[i + 1]], TAIL[i + 1]]], tailBrown);
  for (i = [0 : len(CREAM) - 2])
    blobN([[[CREAM_R[i], CREAM_R[i] * 0.85, CREAM_R[i]], CREAM[i]], [[CREAM_R[i + 1], CREAM_R[i + 1] * 0.85, CREAM_R[i + 1]], CREAM[i + 1]]], tailEmber);
  for (t = [[[9.6, 5, 4], [3.4, -0.4, -1.2], 1.7, tailEmber], [[14.8, 3.8, 5], [3.8, -0.4, -0.2], 1.8, tailEmber],
            [[12.4, 6.6, 11.2], [-1, 0, 3.6], 1.7, tailBrown], [[11, 8.4, 8.8], [3, 0.8, 0.6], 1.7, tailBrown],
            [[5.6, 7.6, 9.4], [3, 0.6, -0.6], 1.5, tailBrown]])
    tuft(t[0], t[1], t[2], t[3]);
  fireBody(TAIL_BODY[0], TAIL_BODY[1]);
  for (f = TAIL_FL) flame(f[0], f[1], f[2], f[3]);
}

// ---- Head: the base face, its arrow and the streaks round its eyes burning, the eyes glowing.
module head() {
  blob(HEAD, fur);
  oval([2.1, 1.9, 1.5], [0, -3.9, 24.4], furLight, 16);   // muzzle
  oval([1.6, 1.4, 0.9], [0, -3.6, 23.1], fur, 12);   // chin
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
    // burning eyes under a red streak slanting down to the nose, a red streak under the outer corner
    eye(EYE, 0.9, iris = iris, sclera = sclera, pupil = pupilC, yaw = 22, lid = 0.45, lid_tilt = 28, lid_c = fur,
        squint = 0.2);
    stroke([[0.9, -4.05, 27.9], [2.4, -3.8, 28.35], [3.6, -2.95, 28.8]], 0.24, markRed);
    stroke([[1.9, -3.95, 26.35], [3.1, -3.45, 26.5], [3.9, -2.55, 27.3]], 0.18, markRed);
  }
  // burning arrow on the forehead: red, a yellow star core, its shaft running up under the mane
  color(markRed) intersection() {
    grownBlob(HEAD, 0.12);
    rotate([90, 0, 0]) linear_extrude(12)
      polygon([[0, 27.3], [-2.5, 29.4], [-1.1, 29.3], [-1.15, 34], [1.15, 34], [1.1, 29.3], [2.5, 29.4]]);
  }
  color(markCore) intersection() {
    grownBlob(HEAD, 0.24);
    rotate([90, 0, 0]) linear_extrude(12)
      polygon([[0, 28.3], [-1.4, 29.6], [-0.45, 29.75], [0, 31.6], [0.45, 29.75], [1.4, 29.6]]);
  }
  // the red stripe down the nape
  color(markRed) intersection() {
    grownBlob(HEAD, 0.12);
    mirror([0, 1, 0]) rotate([90, 0, 0]) linear_extrude(12) polygon([[0.7, 31], [0.6, 24.5], [-0.6, 24.5], [-0.7, 31]]);
  }
}

// ---- Wild mane: a mass on the crown and locks swept up, out and back; antlers beside it.
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
module maneHair() {
  blobN(MANE, mane, 20);
  for (l = LOCKS) lock(l[0], l[1], l[2], l[3], l[4], l[5] == 1 ? maneHi : mane);
}
module antlers() mirror_x() {
  chain(ANTLER, ANTLER_R, antler);
  limb([5.45, 0.2, 32.4], [7.3, -0.1, 33.6], 0.6, 0.15, antler);
}

module ravatar_fire() {
  legs();
  footFire();
  skirt();
  torso();
  arms();
  tail();
  head();
  maneHair();
  antlers();
}

ravatar_fire();
