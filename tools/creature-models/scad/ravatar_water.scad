// Ravatar (water relic): Ravatar (scad/ravatar.scad) in pale aqua scale armour set with blue pearls, its mane gone
// deep blue, its arrow and eyes glowing blue, its tail turned into a great curling wave, water swirling round its
// hands and feet.
// Checklist (front sheet, 40 units, the same frame as the base; the body's axis reads at sheet x -2.5):
//   - head, muzzle, smirk, cheeks and ears as the base, the fur a pale greyish tan (#c5ad8b)
//   - arrow glowing blue with a cyan core, point between the eyes (z 27.5), shaft up into the mane; blue streaks
//     frame each eye; the eyes blue with a cyan glow, no dark pupil
//   - mane deep blue (#326891) with lighter locks; the antlers pale aqua like the armour
//   - pale aqua armour (#93c8e3): finned shell pauldrons sweeping up and out (near one to z 31), a collar with
//     pearls, pec plates with blue wave glyphs (z 21), a centre pearl (z 22.5), a ribbed abdomen plate, a belly
//     pearl (z 15.3); big finned gauntlets on the forearms with a pearl, dark blue bands at the elbows
//   - under it a dark blue suit: belt, a teal front flap, dark blue thighs and greaves under pale aqua fins; tan
//     knees and paws, blue claws
//   - tail: a great water wave, the base tail's sweep out to the right (sheet 2..18, z 5..15) rising in an S to a
//     crest that curls over to the right at z 31 (sheet 12..21), foam on its edge, a few drops
//   - water: a blue stream curling round each hand; a water whirl round each foot
//   - back: a pale aqua back plate with wave ribs and five pearls across the shoulders, a glowing cyan stripe on
//     the nape
include <lib.scad>

fur = [0.77, 0.68, 0.54];
furLight = [0.88, 0.8, 0.66];
cream = [0.92, 0.86, 0.72, NOGLOW];
mane = [0.2, 0.41, 0.57];
maneHi = [0.36, 0.58, 0.73];
antler = [0.62, 0.82, 0.92, NOGLOW];
aqua = [0.62, 0.82, 0.92, NOGLOW];
aquaMid = [0.46, 0.66, 0.8];
deep = [0.1, 0.26, 0.42];
teal = [0.09, 0.36, 0.56];
pearl = [0.14, 0.52, 0.88, NOGLOW];
water = [0.5, 0.72, 0.86];
waterDeep = [0.3, 0.52, 0.7];
waterLight = [0.84, 0.96, 0.99, NOGLOW];
stream = [0.22, 0.58, 0.98, NOGLOW];
claw = [0.12, 0.34, 0.6];
toeClaw = claw;
paw = fur;
limbFn = 12;   // the arm / thigh capsules' facets
ink = [0.16, 0.13, 0.13];
markBlue = [0.12, 0.42, 0.9, NOGLOW];
markCore = [0.5, 0.94, 1, GLOW];
nape = [0.68, 0.9, 0.97, GLOW];
iris = [0.5, 0.94, 1, GLOW];
sclera = [0.14, 0.46, 0.9, NOGLOW];
pupilC = iris;

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
// the wave: the base tail's sweep, then rising in an S to a crest curling over to the right
WAVE = [[1, 3.2, 11.5], [6, 6, 7.4], [11, 6, 7.2], [16, 4.5, 10.2], [18, 2.6, 14], [15.8, 2.6, 19.5], [14.6, 2.8, 25],
        [16.2, 2.6, 29], [19.6, 2.2, 30.6], [22.6, 2, 29.2], [23.2, 2, 26.6], [21.8, 2, 25.4]];
WAVE_R = [2, 3.3, 4.2, 4.6, 4.6, 4.4, 3.8, 3.4, 3, 2.4, 1.6, 0.6];
// foam along the wave's outer edge and its crest
FOAM = [[19.6, 1.4, 9.6], [21.4, 0.9, 13.4], [19.6, 0.6, 18], [18.2, 0.6, 23.4], [18.6, 0.4, 27.6], [20.6, 0.2, 29.4],
        [22.6, 0.4, 28.4]];
DROPS = [[25.4, 1.6, 31.4, 0.6], [24.8, 1, 27.6, 0.45], [20.4, 1.6, 33.2, 0.5], [26.2, 2, 25, 0.4], [13.6, 2, 31, 0.4]];
EYE = [2.4, -3.45, 27.3];
BACKPLATE = [[[5.8, 1.8, 4.5], [0, 3.4, 23.5]], [[4.4, 1.5, 3], [0, 3, 17.6]]];
ABPLATE = [[3.4, 1.6, 2.8], [0, -2.4, 17.4]];

// Low-poly ellipsoid / petal for the many small parts (lib's ell and petal are 28 / 24 sided).
module oval(r, p, c, fn = 12) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
module leaf(r, p, rot, c, fn = 10) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
module blobN(parts, c, fn = 14) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }
module grownBlob(parts, g) { hull() for (e = parts) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 28); }
module stroke(pts, r, c) { chain(pts, [for (p = pts) r], c); }
// Swirl glyph in the XZ plane facing yaw (0 = -Y), radius R.
module tswirl(p, R, yaw = 0, c = pearl) {
  n = 10;
  translate(p) rotate([0, 0, yaw])
    chain([for (i = [0 : n]) let(t = i / n, a = t * 500, rr = R * (0.2 + 0.8 * t)) [rr * cos(a), 0, rr * sin(a)]],
          [for (i = [0 : n]) 0.28], c, $fn = 6);
}
// A pointed armour plate / fin: a flat oval base w x t with a ridge down its face, its point h along +Z.
module shard(p, rot, w, t, h, c) {
  color(c) translate(p) rotate(rot) hull() {
    scale([w, t, 0.3]) sphere(1, $fn = 10);
    translate([0, -t * 0.7, h * 0.4]) sphere(t * 0.5, $fn = 6);
    translate([0, 0, h]) sphere(0.1, $fn = 6);
  }
}
// A hair lock: a tapering capsule chain from p along d1, d2, d3.
module lock(p, d1, d2, d3, r, c) { chain([p, p + d1, p + d1 + d2, p + d1 + d2 + d3], [r, r * 0.75, r * 0.45, 0.1], c, $fn = 8); }
module pearlAt(p, r) { oval([r, r * 0.8, r], p, pearl, 10); }
// A stream of water spiralling round the axis through c: radius R, from angle a0 to a1, rising dz, thinning out.
module spiral(c, R, a0, a1, z0, dz, r0, r1, col, n = 10, squash = 1) {
  chain([for (i = [0 : n]) let(t = i / n, a = a0 + (a1 - a0) * t, rr = R * (1 - 0.25 * t)) c + [rr * cos(a), rr * sin(a) * squash, z0 + dz * t]],
        [for (i = [0 : n]) r0 + (r1 - r0) * i / n], col, $fn = 6);
}

// ---- Legs: dark blue thighs under pale aqua fins, dark blue greaves, tan knees and paws, a water whirl at each foot.
module legs() mirror_x() {
  limb(HIP, KNEE, 3, 2.4, deep, $fn = limbFn);
  oval([2.1, 2, 1.8], KNEE + [0, -0.6, 0.6], fur, 12);   // the knee shows between the plates
  limb(KNEE, ANKLE, 2.3, 1.8, deep, $fn = 12);
  // thigh fins, pointing up like scales
  shard([5.9, -2.8, 7.8], [-15, -8, 0], 2.5, 0.9, 7, aqua);
  shard([8.1, -1.2, 8.4], [-10, 22, 0], 2.2, 0.85, 6.2, aquaMid);
  shard([4.4, -2.5, 10.4], [-18, -16, 0], 1.9, 0.8, 5, aquaMid);
  shard([8.4, 0.8, 8.6], [10, 24, 0], 1.8, 0.75, 4.8, aqua);
  shard([6.2, 2.2, 9.6], [18, 8, 0], 1.8, 0.75, 4.6, aquaMid);
  // greave: a dark blue cuff with pale fins round it
  oval([2.6, 2.6, 2.5], [8.8, -1.4, 5], deep, 12);
  for (a = [-50, 10, 70, 140, 210]) translate([8.8, -1.4, 4]) rotate([0, 0, a]) translate([0, -2.2, 0])
    shard([0, 0, 0], [16, 0, 0], 1.55, 0.7, 4, (a % 120 == 10) ? aqua : aquaMid);
  // paw
  translate(FOOT) rotate([0, 0, 18]) {
    blobN([[[1.9, 1.7, 1.3], [0, 0.4, 1.4]], [[2, 1.6, 1.1], [0, -1.8, 1.1]]], paw);
    for (dx = [-1.15, 0, 1.15]) {
      oval([0.65, 0.9, 0.6], [dx, -3.1, 0.75], paw, 8);
      spike([dx, -3.8, 0.7], [dx * 0.25, -1.1, -0.55], 0.42, 0.05, toeClaw, $fn = 6);
    }
  }
}
// a whirl of water round each foot, rising at the back
module footWhirl() mirror_x() {
  spiral(FOOT + [0.4, 0.4, 0], 6.4, -40, 290, 0.4, 3.6, 0.6, 0.15, water, 16);
  spiral(FOOT + [0.4, 0.4, 0], 4.6, 120, 420, 0.3, 1.4, 0.45, 0.12, waterLight, 12);
}

// ---- Skirt: a dark blue belt, a teal front flap, dark plates at the back and hips.
module skirt() {
  oval([4.1, 3.3, 2], [0, 0.3, 13.4], deep, 14);
  oval([4.25, 3.55, 0.9], [0, 0.2, 15.6], deep, 18);
  shard([0, -3.3, 15.4], [180, 0, 0], 2.6, 0.8, 8.6, teal);
  mirror_x() shard([2.3, -2.9, 15.2], [182, -12, 0], 1.8, 0.7, 6.6, aquaMid);
  shard([0, 3.6, 15.4], [178, 0, 0], 2.2, 0.8, 6.8, teal);
  mirror_x() {
    shard([2.6, 3, 15.2], [178, -12, 0], 1.7, 0.7, 5.6, deep);
    shard([3.9, -1.4, 15.4], [178, -28, 0], 1.8, 0.7, 5.2, teal);
    shard([3.9, 1.4, 15.4], [178, -28, 0], 1.7, 0.7, 4.8, deep);
  }
}

// ---- Torso: pale aqua armour over the tan body: collar, pec plates with wave glyphs, a ribbed abdomen, pearls, and
// a back plate with wave ribs.
module ribs(parts, zs, back) {
  for (z = zs) color(aquaMid) intersection() {
    grownBlob(parts, 0.12);
    translate([-7, back ? 0 : -8, z - 0.16]) cube([14, 8, 0.32]);
  }
}
module torso() {
  blobN(TORSO, fur, 20);
  // collar round the neck, a scaled edge below
  blobN(RUFF, aqua, 16);
  for (s = [[1.8, 20.6, -18, 1.4], [-1.8, 20.6, 18, 1.4], [5.2, 22, -50, 1.4], [-5.2, 22, 50, 1.4]])
    leaf([1.2, 0.55, s[3]], [s[0], -4.3 + abs(s[0]) * 0.25, s[1] + s[3] * 0.6], [-8, s[2], 0], aquaMid);
  mirror_x() {
    oval([3.1, 1.5, 2.3], [2.8, -3, 20.8], aqua, 14);   // pec plate
    tswirl([2.9, -4.5, 21], 1.15, 15);
    pearlAt([3.6, -3.4, 24.2], 0.55);
  }
  pearlAt([0, -4.75, 22.5], 0.75);
  // ribbed abdomen plate and the belly pearl
  oval(ABPLATE[0], ABPLATE[1], aqua, 16);
  ribs([ABPLATE], [16.2, 17.4, 18.6], false);
  pearlAt([0, -3.65, 15.4], 0.7);
  // back plate: wave ribs, five pearls across the shoulders
  blobN(BACKPLATE, aqua, 18);
  ribs(BACKPLATE, [18.4, 20.4, 26.2], true);
  for (p = [[0, 5.0, 23.4], [2.4, 4.85, 23.4], [-2.4, 4.85, 23.4], [4.4, 4.35, 23.2], [-4.4, 4.35, 23.2]]) pearlAt(p, 0.62);
}

// ---- Arms: tan upper arms under finned aqua shell pauldrons, dark blue elbow bands, finned gauntlets with a pearl,
// tan clawed hands with a blue stream curling round them.
// One arm (the creature's left numbers): shoulder S, elbow E, wrist W, hand H.
module arm(S, E, W, H) {
  oval([2.8, 2.8, 2.6], S, fur, 14);
  limb(S, E, 2.5, 2.2, fur, $fn = limbFn);
  limb(E, W, 2.2, 2.1, fur, $fn = limbFn);
  // pauldron: a shell over the shoulder, layered fins sweeping up and out, a pearl at the front
  oval([3.4, 3.3, 2.4], S + [0.4, 0, 1.6], aqua, 16);
  shard(S + [0.6, -1.2, 2.6], [10, 30, 0], 2.9, 0.7, 6.2, aqua);
  shard(S + [1.6, 0.6, 2.4], [-8, 42, 0], 2.7, 0.7, 5.2, aquaMid);
  shard(S + [0.4, 1.6, 2.6], [-18, 20, 0], 2.5, 0.7, 4.8, aqua);
  pearlAt(S + [1, -3.1, 1.6], 0.6);
  // elbow band and gauntlet: flaring to the wrist, a fin on its outer side, a pearl on its face
  oval([2.5, 2.5, 2.5], E, deep, 12);
  color(aqua) hull() { translate(E + (W - E) * 0.2) sphere(2.5, $fn = 12); translate(W + (H - W) * 0.3) scale([3.3, 2.8, 2.6]) sphere(1, $fn = 12); }
  // fins flaring up and out along the gauntlet's outer side
  shard(E + (W - E) * 0.7 + [2.4, 0.2, -0.4], [0, 28, 0], 2.8, 0.6, 5.6, aquaMid);
  shard(W + [2.6, -0.6, -1.6], [8, 62, 0], 2.3, 0.6, 3.8, aqua);
  shard(E + (W - E) * 0.3 + [1.6, 1.2, 0.6], [-14, 16, 0], 2.2, 0.6, 4.2, aqua);
  pearlAt(E + (W - E) * 0.55 + [0.2, -2.55, 0], 0.55);
  oval([2.6, 2.3, 2.6], H, aqua, 12);   // a water glove
  for (dx = [-1.3, -0.45, 0.45, 1.3]) {
    limb(H + [dx, -0.7, -1.5], H + [dx * 1.25, -1.5, -2.8], 0.7, 0.6, aqua, $fn = 8);
    spike(H + [dx * 1.25, -1.6, -3], [dx * 0.2, -0.5, -1.4], 0.5, 0.05, claw, $fn = 6);
  }
}
module handStream(H) spiral(H + [0.6, 0, 0], 3.6, -110, 150, -3, 6, 0.5, 0.15, stream, 12);
module arms() mirror_x() { arm(SHOULDER, ELBOW, WRIST, HAND); handStream(HAND); }

// ---- Tail: a great water wave rising off the base tail's sweep, foam on its outer edge and crest, a few drops.
module tail() {
  for (i = [0 : len(WAVE) - 2])
    blobN([[[1.1, 0.72, 1] * WAVE_R[i], WAVE[i]], [[1.1, 0.72, 1] * WAVE_R[i + 1], WAVE[i + 1]]],
          i % 2 == 0 ? water : waterDeep);
  stroke(FOAM, 0.55, waterLight);
  // streaks along the wave's face, front and back
  for (s = [[[8, 1.4, 4.6], [13, 0.4, 5.8], [17.4, -0.2, 9.4]], [[8, 9.6, 7.6], [13, 9.8, 8.4], [17.6, 8.2, 11]],
            [[15.4, -0.4, 16.4], [13.6, -0.2, 21], [13.4, 0, 26.4]]])
    stroke(s, 0.35, waterLight);
  for (d = DROPS) oval([d[3], d[3], d[3] * 1.2], [d[0], d[1], d[2]], waterLight, 8);
}

// ---- Head: the base face, its arrow and the streaks round its eyes glowing blue.
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
    // glowing eyes under a blue streak slanting down to the nose, a blue streak under the outer corner
    eye(EYE, 0.9, iris = iris, sclera = sclera, pupil = pupilC, yaw = 22, lid = 0.45, lid_tilt = 28, lid_c = fur,
        squint = 0.2);
    stroke([[0.9, -4.05, 27.9], [2.4, -3.8, 28.35], [3.6, -2.95, 28.8]], 0.24, markBlue);
    stroke([[1.9, -3.95, 26.35], [3.1, -3.45, 26.5], [3.9, -2.55, 27.3]], 0.18, markBlue);
  }
  // glowing arrow on the forehead: blue, a cyan core, its shaft running up under the mane
  color(markBlue) intersection() {
    grownBlob(HEAD, 0.12);
    rotate([90, 0, 0]) linear_extrude(12)
      polygon([[0, 27.3], [-2.5, 29.4], [-1.1, 29.3], [-1.15, 34], [1.15, 34], [1.1, 29.3], [2.5, 29.4]]);
  }
  color(markCore) intersection() {
    grownBlob(HEAD, 0.24);
    rotate([90, 0, 0]) linear_extrude(12)
      polygon([[0, 28.3], [-1.3, 29.6], [-0.45, 29.75], [0, 31.4], [0.45, 29.75], [1.3, 29.6]]);
  }
  // the glowing stripe down the nape
  color(nape) intersection() {
    grownBlob(HEAD, 0.12);
    mirror([0, 1, 0]) rotate([90, 0, 0]) linear_extrude(12) polygon([[0.8, 31], [0.6, 24.5], [-0.6, 24.5], [-0.8, 31]]);
  }
}

// ---- Wild mane: a deep blue mass on the crown and locks swept up, out and back; pale aqua antlers beside it.
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

module ravatar_water() {
  legs();
  footWhirl();
  skirt();
  torso();
  arms();
  tail();
  head();
  maneHair();
  antlers();
}

ravatar_water();
