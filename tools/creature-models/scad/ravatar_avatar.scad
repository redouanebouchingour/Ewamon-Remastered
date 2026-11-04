// Ravatar (avatar relic): all four relics at once. Ravatar's body (copied from scad/ravatar.scad) gone pale, its
// arrow, tattoos and eyes shining white-cyan, ringed by its elements: a great water wave arcing round its right side
// and over its head with a curl at its flank, its raised left fist wreathed in fire, a smoky starry cloud streaming
// from its crown in place of the mane and swelling where the tail was, floating boulders, icy glowing feet.
// Checklist (front sheet, 40 units with the ring; the art's feet stand on sheet z 2, so the model is 2 lower and
// compare runs with --ground 2; the body's axis reads at sheet x 0):
//   - body as the base, fur pale cream, ruff white, tattoos / arrow / spine stripe pale cyan, eyes glowing white slits
//   - water ring: a crescent round the viewer's left from sheet (-10, 6) up past (-21, 20) over the top (z 39) to
//     (12, 37); thick on the left (a wave face with a curl at (-13.5, 21)), thin over the top; a thin light streak down
//     the right (18, 26..36)
//   - fire: the near (left) arm raised out to the side, the fist at sheet (12, 19.5) in a blaze x 5..21, z 14..30
//   - starry cloud from the crown streaming up and right to (14, 31); a big starry cloud where the tail was
//     (sheet x 8..20, z 5..17)
//   - boulders floating round the ring; the ground rocks and splashes under the feet are not modelled
//   - antlers stay dark brown
include <lib.scad>

fur = [0.9, 0.79, 0.64];
furLight = [0.96, 0.9, 0.8];
cream = [0.97, 0.95, 0.9, NOGLOW];
cloudDark = [0.42, 0.44, 0.54];
cloudMid = [0.66, 0.64, 0.72];
cloudLight = [0.82, 0.83, 0.88, NOGLOW];
starDot = [1, 0.85, 0.5, GLOW];
waterDeep = [0.2, 0.36, 0.55];
water = [0.5, 0.67, 0.8];
waterLight = [0.78, 0.94, 0.98, NOGLOW];
flameRed = [0.72, 0.14, 0.04];
flameOrange = [0.95, 0.5, 0.15, GLOW];
flameCore = [1, 0.88, 0.55, GLOW];
rock = [0.4, 0.3, 0.26];
rockDark = [0.28, 0.21, 0.19];
antler = [0.4, 0.33, 0.28];
mark = [0.8, 0.96, 0.98, GLOW];
tat = [0.62, 0.86, 0.94, NOGLOW];
bark = [0.43, 0.36, 0.32];
barkHi = [0.55, 0.45, 0.37];
barkDark = [0.29, 0.24, 0.22];
claw = [0.3, 0.24, 0.22];
toeClaw = [0.94, 0.98, 0.97, NOGLOW];
paw = [0.72, 0.9, 0.96, NOGLOW];
limbFn = 12;   // the arm / thigh capsules' facets
ink = [0.16, 0.13, 0.13];
iris = [0.85, 1, 1, GLOW];
sclera = [0.85, 1, 1, GLOW];
pupilC = iris;

// ---- Shapes shared by several parts (the rig file copies these numbers).
HEAD = [[[4.3, 3.8, 3.8], [0, -0.6, 26.8]], [[3.4, 3.1, 2.8], [0, -0.3, 30]]];
TORSO = [[[3.8, 3, 2.5], [0, 0.2, 15.5]], [[6.2, 3.9, 3.6], [0, -0.2, 20]], [[5.6, 3.6, 2.6], [0, 0.6, 23]]];
RUFF = [[[5.8, 3.4, 2.6], [0, -0.6, 24]], [[4.2, 2.6, 2], [0, -2.2, 22.2]]];
SHOULDER = [8.3, 0, 21.8];
ELBOW = [11.5, -2.4, 17];
WRIST = [14.2, -2.3, 14.4];
HAND = [14.6, -2.4, 12.6];
HIP = [4.2, 0.3, 13.2];
KNEE = [7.6, -1.2, 8.2];
ANKLE = [9.6, -1.4, 3.2];
FOOT = [9.8, -1.6, 0];
TAIL = [[1, 3.2, 11.5], [6, 6, 7.4], [11, 6, 7.2], [16, 4.5, 10.2], [17, 3, 15.4], [18, 2, 20], [18.6, 1.6, 23.4]];
EYE = [2.4, -3.45, 27.3];
// the raised left arm
ELBOW_A = [13.2, -2.4, 19.8];
WRIST_A = [16.8, -4.6, 18.8];
HAND_A = [17.8, -5.6, 18.4];
// the cloud tail along the base tail's first links: [point, radius]
CLOUD_TAIL = [[[2, 3.6, 10.8], 2.4], [[6, 6, 7.4], 3.4], [[11, 6, 7], 4], [[16, 4.5, 9.6], 4], [[17, 3, 13.4], 2.6]];
// art frame: the avatar art's feet stand on sheet z 2; pp() children below take art x, art z - GROUND
GROUND = 2;
WAVE_C = [-1, 21];
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

// ---- Starry cloud tail: lumpy puffs along the tail's path, light swirls, stars.
module puff(p, r, c) {
  color(c) hull() {
    translate(p) scale([r, r * 0.85, r * 0.8]) sphere(1, $fn = 10);
    translate(p + [r * 0.5, 0, r * 0.3]) scale([r * 0.7, r * 0.6, r * 0.6]) sphere(1, $fn = 8);
  }
}
module cloudTail() {
  for (i = [0 : len(CLOUD_TAIL) - 2])
    blobN([[[1, 0.85, 0.8] * CLOUD_TAIL[i][1], CLOUD_TAIL[i][0]], [[1, 0.85, 0.8] * CLOUD_TAIL[i + 1][1], CLOUD_TAIL[i + 1][0]]], cloudDark, 10);
  for (p = [[[8.4, 4.2, 10], 2.4, cloudMid], [[13, 3.4, 10.6], 2.6, cloudMid], [[17.6, 2.6, 11.2], 2.2, cloudMid],
            [[19.4, 4, 7.4], 2, cloudDark], [[12, 8.6, 9.6], 2.6, cloudMid], [[7, 8.4, 8.8], 2.2, cloudDark],
            [[15.6, 7.4, 6.4], 2.4, cloudMid], [[10.6, 4.4, 3.8], 2.2, cloudDark]])
    puff(p[0], p[1], p[2]);
  // light swirls over the front and the back
  for (s = [[[6, 2.8, 8.8], 1], [[12.4, 2.4, 7.6], -1], [[18, 1.2, 10.4], 1], [[10, 9.8, 8], 1], [[15, 8.8, 9.6], -1]])
    stroke([for (i = [0 : 6]) s[0] + [i * 0.6, 0, s[1] * 0.9 * sin(i * 60)]], 0.3, cloudLight);
  for (p = [[9, 2.4, 9.4], [14.5, 2.2, 6.6], [17.4, 0.9, 12.2], [11.4, 10, 10.6], [5.6, 9.2, 6.6], [19.8, 2.6, 8.6]])
    color(starDot) translate(p) sphere(0.3, $fn = 6);
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

// ---- Starry cloud from the crown, streaming up and to the viewer's right (authored on the art, behind the face).
module headCloud() pp(1.5) translate([0, 0, -GROUND]) {
  for (q = [[[-1.5, 0, 36], 3.6, [2.5, 0.4, 37.6], 3.4, cloudDark], [[2.5, 0.4, 37.6], 3.4, [6.5, 0.4, 37], 3.2, cloudMid],
            [[6.5, 0.4, 37], 3.2, [10, 0.6, 35.4], 3, cloudMid], [[10, 0.6, 35.4], 3, [13, 0.6, 33], 2.4, cloudDark],
            [[13, 0.6, 33], 2.4, [14.8, 0.4, 30.4], 1.5, cloudMid], [[-1, 2.6, 34.6], 3, [5, 2.8, 35.4], 2.8, cloudDark]])
    blobN([[[1.1, 0.9, 0.8] * q[1], q[0]], [[1.1, 0.9, 0.8] * q[3], q[2]]], q[4], 10);
  for (s = [[[-3.4, -2.8, 36.6], 1], [[2, -2.6, 38.2], -1], [[7.4, -2.4, 36.6], 1], [[11, -2, 34], -1]])
    stroke([for (i = [0 : 5]) s[0] + [i * 0.75, 0, s[1] * 0.8 * sin(i * 72)]], 0.3, cloudLight);
  oval([1.6, 1.2, 1.3], [13.4, -1.4, 31.6], flameOrange, 10);   // the fire's glow in the cloud
  for (p = [[0, -3.4, 37.8], [3.6, -3.2, 37], [7, -3, 38.4], [10.2, -2.8, 35.2], [-2.6, -3.4, 34.6], [12.8, -2.2, 33.6]])
    color(starDot) translate(p) sphere(0.34, $fn = 6);
}
module antlers() mirror_x() {
  chain(ANTLER, ANTLER_R, antler);
  limb([5.45, 0.2, 32.4], [7.3, -0.1, 33.6], 0.6, 0.15, antler);
}

// ---- Fire wreathing the raised left fist and its forearm.
module tongue(p, d, r, c) { color(c) hull() { translate(p) scale([r, r * 0.8, r]) sphere(1, $fn = 8); translate(p + d) sphere(0.2, $fn = 6); } }
FIRE = [[[0, 0, 2], [1.6, -0.5, 9], 2.4, flameRed], [[1.8, 0, 1.4], [4.6, -1, 7.4], 2.4, flameRed],
        [[2.4, -0.5, -0.4], [6, -1, 3.6], 2.2, flameRed], [[2.4, -0.5, -2], [4.4, -0.5, -1], 1.8, flameRed],
        [[-1.4, 0, 2.2], [-0.6, -0.5, 6.4], 1.8, flameOrange], [[1.2, -1.6, 1.6], [2.6, -1.2, 5.6], 1.8, flameOrange],
        [[1.4, -1.8, -0.4], [4, -1, 1.4], 1.5, flameOrange], [[0.6, -2.4, 1], [1.4, -1, 4], 1.2, flameCore]];
module fireFist() {
  H = HAND_A;
  oval([3.8, 3.2, 3.8], H + [0.8, -0.2, 0.8], flameRed, 14);
  oval([3, 2.7, 3.2], H + [0.8, -1.2, 0.7], flameOrange, 14);
  oval([1.8, 1.6, 2], H + [0.5, -2.6, 0.5], flameCore, 12);
  for (t = FIRE) tongue(H + t[0], t[1] * 1.15, t[2] * 1.25, t[3]);
  tongue(WRIST_A + [-1.4, 1, 1.4], [-0.5, 0, 5.4], 1.8, flameRed);
  tongue(ELBOW_A + [1, -0.4, 1.6], [0, 0, 4.4], 1.4, flameOrange);
}

// ---- The water ring: a crescent wave round the right side and over the head, a curl at the flank, a light streak
// down the left side; authored on the art, 2 units behind the picture plane, thick enough to read from the side.
function wr(a) = lookup(a, [[55, 1], [75, 1.6], [95, 2], [115, 2.2], [135, 2.6], [155, 3.2], [175, 3.8], [195, 3.8], [215, 3], [235, 1.8]]);
WAVE_BODY = [[[4.6, 2.2, 7], [-16, 0, 21]], [[4, 2, 4], [-12.5, 0, 12]], [[3.6, 2, 4], [-12, 0, 29]]];
CURL = [-13.5, 21.5];
module waterRing() pp(2) translate([0, 0, -GROUND]) {
  R = 16.5;
  for (a = [55 : 20 : 215]) {
    p1 = WAVE_C + R * [cos(a), sin(a)];
    p2 = WAVE_C + R * [cos(a + 20), sin(a + 20)];
    color(water) hull() {
      translate([p1[0], 0, p1[1]]) scale([wr(a), max(1.2, wr(a) * 0.6), wr(a)]) sphere(1, $fn = 10);
      translate([p2[0], 0, p2[1]]) scale([wr(a + 20), max(1.2, wr(a + 20) * 0.6), wr(a + 20)]) sphere(1, $fn = 10);
    }
  }
  blobN(WAVE_BODY, water, 12);
  // foam along the outer rim
  stroke([for (a = [70 : 15 : 225]) let(p = WAVE_C + (R + wr(a) * 0.75) * [cos(a), sin(a)]) [p[0], -0.6, p[1]]], 0.45, waterLight);
  // the curl on the wall's face: a breaker rolling in on itself
  for (k = [[6, 0.9, waterDeep, -2], [4.6, 0.45, waterLight, -2.4]])
    chain([for (i = [0 : 14]) let(t = i / 14, a = 200 - t * 520, rr = k[0] * (1 - 0.8 * t)) [CURL[0] + rr * cos(a), k[3], CURL[1] + rr * sin(a)]],
          [for (i = [0 : 14]) k[1] * (1 - 0.5 * i / 14)], k[2], $fn = 6);
  // the light streak down the left side
  stroke([for (a = [12 : 8 : 52]) let(p = WAVE_C + 19.5 * [cos(a), sin(a)]) [p[0], 0, p[1]]], 0.5, waterLight);
}

// ---- Floating boulders round the ring (art x, art z, pp depth, size).
ROCKS = [[-16.5, 33.5, -1, 1.3], [-12, 36.5, 2, 0.9], [-19, 14, 1, 1.1], [-15, 9, -2, 1.6], [17.5, 13, -1, 1.1],
         [15, 8.5, 2, 1.2], [19, 4.5, -2, 1.4]];
module rocks() pp(0) for (b = ROCKS)
  color(b[3] > 1.2 ? rockDark : rock) translate([b[0], b[2], b[1] - GROUND]) rotate([b[0] * 10, b[1] * 7, 0]) scale([1.2, 0.9, 1]) sphere(b[3], $fn = 7);

module ravatar_avatar() {
  legs();
  skirt();
  torso();
  arm(SHOULDER, ELBOW_A, WRIST_A, HAND_A);
  mirror([1, 0, 0]) arm(SHOULDER, ELBOW, WRIST, HAND);
  fireFist();
  cloudTail();
  head();
  headCloud();
  antlers();
  waterRing();
  rocks();
}

ravatar_avatar();
