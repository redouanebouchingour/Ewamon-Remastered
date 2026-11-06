// Ravatar (earth relic): Ravatar's body (copied from scad/ravatar.scad) in mossy stone armour studded with glowing
// green gems, massive stone gauntlets, a glowing green arrow, eyes and veins, its tail splintering into wood and rock,
// boulders and green energy at its feet.
// Checklist (front sheet, 40 units; the art stands in the base's frame, its feet on sheet z 1.5 over the rubble):
//   - body, mane, antlers, muzzle, smirk, bark skirt, plated thighs and rock greaves as the base; fur a paler tan
//   - arrow: a wide glowing green arrow, point between the eyes (z 28), wings at z 29.5, shaft into the mane and down
//     the nape (back sheet); eyes glowing green in dark green sockets
//   - stone armour (grey-olive with moss): a gorget, plates over the pecs with green swirl inlays, a big green gem on
//     the sternum (sheet -4.3, 21.3); huge pauldrons with a peak and gems (front and back); a domed shell over the
//     upper back with five gems; green veins on the abs and the lower back
//   - upper arms bare tan; forearms and fists inside massive stone gauntlets (near one sheet x 5..12.5, z 10..21)
//   - tail: the base's grey-over-cream brush, its upper half splintering into brown wood / rock shards (sheet x 13..19,
//     z 17..27) with pebbles flying off
//   - two boulders hovering beside the feet (sheet -17..-14 and 14..18, z 5..9), small stones on the ground, green
//     energy arcs round the feet
include <lib.scad>

fur = [0.74, 0.6, 0.42];
furLight = [0.9, 0.82, 0.62];
cream = [0.92, 0.86, 0.68, NOGLOW];
mane = [0.28, 0.26, 0.25];
maneHi = [0.4, 0.37, 0.34];
antler = [0.4, 0.33, 0.28];
mark = [0.5, 0.92, 0.34, GLOW];
bark = [0.47, 0.41, 0.33];
barkHi = [0.58, 0.51, 0.4];
barkDark = [0.3, 0.27, 0.23];
stone = [0.4, 0.39, 0.31];
stoneDark = [0.27, 0.26, 0.22];
moss = [0.42, 0.48, 0.26];
gem = [0.28, 0.74, 0.2, GLOW];
gemHi = [0.78, 1, 0.62, GLOW];
vein = [0.48, 0.88, 0.32, NOGLOW];
tailGrey = [0.36, 0.33, 0.3];
tailCream = [0.86, 0.79, 0.6, NOGLOW];
splinter = [0.5, 0.42, 0.33];
splinterDark = [0.34, 0.28, 0.23];
toeClaw = [0.55, 0.45, 0.36];
paw = fur;
limbFn = 14;   // the arm / thigh capsules' facets
ink = [0.16, 0.13, 0.13];
eyeGlow = [0.52, 0.94, 0.34, GLOW];
socket = [0.16, 0.3, 0.13];

// ---- Shapes shared by several parts (the rig file copies these numbers).
HEAD = [[[4.3, 3.8, 3.8], [0, -0.6, 26.8]], [[3.4, 3.1, 2.8], [0, -0.3, 30]]];
TORSO = [[[3.8, 3, 2.5], [0, 0.2, 15.5]], [[6.2, 3.9, 3.6], [0, -0.2, 20]], [[5.6, 3.6, 2.6], [0, 0.6, 23]]];
GORGET = [[5.6, 3.3, 2.4], [0, -0.4, 23.8]];
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
// the splinters off the tail's upper half: [base, direction, base radius, colour 0/1]
SPLINTERS = [[[17.4, 2.6, 18], [-1.6, 0.4, 7.4], 1.3, 0], [[18.6, 1.8, 20.6], [0.6, 0, 6.4], 1.2, 1],
             [[16.4, 3.4, 15.6], [-3, 1.2, 5.6], 1.1, 0], [[19.6, 1.6, 17], [3, -0.2, 4.8], 1, 1],
             [[18, 4, 18.6], [1.2, 2.4, 5.4], 1, 0], [[19.2, 2.2, 13.4], [3.4, 0, 2.4], 0.9, 0],
             [[16.6, 4.6, 13], [-2.6, 2, 4], 0.9, 1]];
PEBBLES = [[[21.6, 2, 27.2], 0.55], [[23.2, 1.2, 20.6], 0.5], [[14.6, 4.6, 27.6], 0.45], [[23.8, 2, 13.2], 0.5],
           [[20, 3.6, 30], 0.4]];
EYE = [2.4, -3.45, 27.3];
// boulders and stones round the feet: [centre, size]
STONES = [[[-16.5, 2, 5], 2.1], [[19.6, 3, 4.8], 2.1], [[11.2, -6, 1], 1.1], [[21, -3, 1.2], 1.2],
          [[-7.9, -6, 0.8], 0.8], [[-15.9, -2, 1.1], 1.1]];
ANTLER = [[3.6, 0, 29.6], [5.4, 0.2, 32.2], [6.6, 0.4, 35], [6.3, 0.6, 37.2]];
ANTLER_R = [1.1, 0.9, 0.6, 0.15];
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

module oval(r, p, c, fn = 12) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
module leaf(r, p, rot, c, fn = 10) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
module blobN(parts, c, fn = 14) { color(c) hull() for (e = parts) translate(e[1]) scale(e[0]) sphere(1, $fn = fn); }
module grownBlob(parts, g, fn = 22) { hull() for (e = parts) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = fn); }
module stroke(pts, r, c) { chain(pts, [for (p = pts) r], c); }
// Swirl in the XZ plane facing yaw (0 = -Y), radius R.
module tswirl(p, R, yaw = 0, c = vein, w = 0.28) {
  n = 8;
  translate(p) rotate([0, 0, yaw])
    chain([for (i = [0 : n]) let(t = i / n, a = t * 500, rr = R * (0.2 + 0.8 * t)) [rr * cos(a), 0, rr * sin(a)]],
          [for (i = [0 : n]) w], c, $fn = 4);
}
// A pointed bark / rock plate: a flat oval base w x t with a ridge down its face, its point h along +Z.
module shard(p, rot, w, t, h, c) {
  color(c) translate(p) rotate(rot) hull() {
    scale([w, t, 0.3]) sphere(1, $fn = 10);
    translate([0, -t * 0.7, h * 0.4]) sphere(t * 0.5, $fn = 6);
    translate([0, 0, h]) sphere(0.1, $fn = 6);
  }
}
module lock(p, d1, d2, d3, r, c) { chain([p, p + d1, p + d1 + d2, p + d1 + d2 + d3], [r, r * 0.75, r * 0.45, 0.1], c, $fn = 10); }
module tuft(p, d, w, c) { color(c) hull() { translate(p) scale([w, w * 0.7, w]) sphere(1, $fn = 10); translate(p + d) sphere(0.15, $fn = 6); } }
// A rough stone: a low-poly ellipsoid turned by rot.
module chunk(p, r, rot = [0, 0, 0], c = stone, fn = 7) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
// A cut green gem with a highlight, facing yaw (0 = -Y).
module gemstone(p, r, yaw = 0) {
  translate(p) rotate([0, 0, yaw]) {
    color(stoneDark) scale([1.35, 0.5, 1.6]) sphere(r, $fn = 8);
    color(gem) translate([0, -r * 0.3, 0]) scale([1, 0.55, 1.35]) sphere(r, $fn = 6);
    color(gemHi) translate([-r * 0.3, -r * 0.75, r * 0.35]) sphere(r * 0.28, $fn = 5);
  }
}

// ---- Legs: thighs under bark plates, rock greaves, splayed clawed feet (the base's).
module legs() mirror_x() {
  limb(HIP, KNEE, 3, 2.4, barkDark, $fn = limbFn);
  oval([2.1, 2, 1.8], KNEE + [0, -0.6, 0.6], fur, 14);
  limb(KNEE, ANKLE, 2.3, 1.8, fur, $fn = 12);
  shard([5.9, -2.8, 7.8], [-15, -8, 0], 2.5, 0.9, 7, bark);
  shard([8.1, -1.2, 8.4], [-10, 22, 0], 2.2, 0.85, 6.2, barkHi);
  shard([4.4, -2.5, 10.4], [-18, -16, 0], 1.9, 0.8, 5, barkHi);
  shard([8.4, 0.8, 8.6], [10, 24, 0], 1.8, 0.75, 4.8, bark);
  shard([6.2, 2.2, 9.6], [18, 8, 0], 1.8, 0.75, 4.6, barkDark);
  oval([2.6, 2.6, 2.5], [8.8, -1.4, 5], barkDark, 14);
  for (a = [-50, 10, 70, 140, 210]) translate([8.8, -1.4, 4]) rotate([0, 0, a]) translate([0, -2.2, 0])
    shard([0, 0, 0], [16, 0, 0], 1.55, 0.7, 4, (a % 120 == 10) ? barkHi : bark);
  translate(FOOT) rotate([0, 0, 18]) {
    blobN([[[1.9, 1.7, 1.3], [0, 0.4, 1.4]], [[2, 1.6, 1.1], [0, -1.8, 1.1]]], paw, 11);
    for (dx = [-1.15, 0, 1.15]) {
      oval([0.65, 0.9, 0.6], [dx, -3.1, 0.75], paw, 8);
      spike([dx, -3.8, 0.7], [dx * 0.25, -1.1, -0.55], 0.42, 0.05, toeClaw);
    }
  }
}

// ---- Bark skirt: belt, plates hanging at the front, back and hips (the base's).
module skirt() {
  oval([4.1, 3.3, 2], [0, 0.3, 13.4], barkDark, 16);
  oval([4.25, 3.55, 0.9], [0, 0.2, 15.6], stoneDark, 18);
  shard([0, -3.3, 15.4], [180, 0, 0], 2.6, 0.8, 8.6, bark);
  mirror_x() shard([2.3, -2.9, 15.2], [182, -12, 0], 1.8, 0.7, 6.6, barkHi);
  shard([0, 3.6, 15.4], [178, 0, 0], 2.2, 0.8, 6.8, bark);
  mirror_x() {
    shard([2.6, 3, 15.2], [178, -12, 0], 1.7, 0.7, 5.6, barkDark);
    shard([3.9, -1.4, 15.4], [178, -28, 0], 1.8, 0.7, 5.2, bark);
    shard([3.9, 1.4, 15.4], [178, -28, 0], 1.7, 0.7, 4.8, barkHi);
  }
}

// ---- Torso: tan, abs with green veins; a stone gorget and pec plates with green inlays, a big sternum gem; a domed
// stone shell over the upper back with gems; green veins on the lower back.
module torso() {
  blobN(TORSO, fur, 22);
  mirror_x() {
    oval([2.7, 1.3, 1.9], [2.7, -3, 20.6], fur, 14);   // pecs
    for (z = [16.4, 17.8]) oval([1.05, 0.7, 0.62], [1.05, -2.95 - (z - 16.4) * 0.12, z], furLight, 8);   // abs
    // the stone pec plate and its green swirl inlay
    translate([2.85, -3.4, 21.2]) rotate([0, 0, 16]) {
      oval([2.9, 1.15, 2.1], [0, 0, 0], stone, 9);
      tswirl([0, -1.15, -0.1], 1.1, 0, vein, 0.3);
    }
    stroke([[1.1, -3.85, 17.2], [2.2, -3.6, 18.2], [3.2, -3.3, 17.8]], 0.2, vein);   // veins on the abs
  }
  stroke([[-0.6, -4.05, 18.6], [0.4, -4.1, 19.6], [-0.2, -4.2, 20.2]], 0.2, vein);
  blobN([GORGET], stone, 12);
  for (p = [[-3.6, -2.4, 25.4], [3.4, -2.8, 24.6], [0, 2.8, 25.6]]) oval([1.4, 0.8, 0.6], p, moss, 7);
  gemstone([0, -4.6, 21.3], 0.95);
  // the back shell, mossy, with gems
  color(stone) intersection() {
    grownBlob(TORSO, 0.9, 14);
    translate([-8, 0.6, 18.4]) cube([16, 7, 8.4]);
  }
  for (p = [[-2.8, 4.4, 24.4], [3, 4.4, 22.2], [0, 4.6, 20.6]]) oval([1.6, 0.6, 1], p, moss, 7);
  for (g = [[-2.8, 4.75, 22.8, 0.85, 168], [2.8, 4.75, 22.8, 0.85, 192], [0, 4.6, 19.4, 0.7, 180]])
    gemstone([g[0], g[1], g[2]], g[3], g[4]);
  // green veins on the lower back
  stroke([[-2.4, 3.4, 15.2], [-1.2, 3.6, 16.6], [-1.8, 3.8, 17.8]], 0.2, vein);
  stroke([[0.6, 3.4, 15.4], [1.8, 3.6, 16.4], [1.4, 3.8, 17.8]], 0.2, vein);
}

// ---- Arms: tan upper arms; the forearm and fist inside a massive stone gauntlet (the creature's left numbers:
// shoulder S, elbow E, wrist W, hand H).
module arm(S, E, W, H) {
  oval([2.8, 2.8, 2.6], S, fur, 13);
  limb(S, E, 2.5, 2.2, fur, $fn = limbFn);
  // gauntlet: stone blocks round the forearm, a blocky fist with knuckle stones
  d = W - E;
  color(stone) hull() {
    translate(E + d * 0.12) scale([2.9, 2.9, 2.7]) sphere(1, $fn = 7);
    translate(W) scale([3, 2.9, 2.6]) sphere(1, $fn = 7);
  }
  color(stoneDark) hull() {
    translate(H + [0, 0, 0.2]) scale([2.9, 2.8, 2.4]) sphere(1, $fn = 7);
    translate(H + [0, -0.9, -1.2]) scale([2.6, 2.4, 2]) sphere(1, $fn = 7);
  }
  for (dx = [-1.5, -0.5, 0.5, 1.5]) chunk(H + [dx, -2.9, -1.3], [0.62, 0.55, 0.8], [10, 0, dx * 8], stone, 6);
  chunk(E + d * 0.5 + [0.4, -0.6, 2.2], [1.8, 1.4, 0.7], [20, 0, 10], moss, 7);
  chunk(E + d * 0.1 + [1.8, 0.4, 1.2], [1.3, 1.8, 0.9], [0, 30, 0], stoneDark, 7);
}
// Pauldron: a huge mossy stone block with a peak and gems front, side and back.
module pauldron(S) {
  chunk(S + [0.7, 0, 1.3], [4.3, 4.2, 3.3], [0, 18, 0], stone, 9);
  chunk(S + [0.5, 0, 3.4], [3.2, 3.2, 1.5], [0, 14, 20], moss, 8);
  color(stone) hull() {
    translate(S + [0.2, 0.2, 4.2]) scale([1.8, 1.8, 0.6]) sphere(1, $fn = 6);
    translate(S + [-0.6, 0.4, 8]) sphere(0.15, $fn = 5);
  }
  chunk(S + [2.6, -0.8, -0.6], [2.4, 3, 1.8], [0, 46, 0], stoneDark, 7);
  gemstone(S + [1, -4.25, 1.6], 0.75, 10);
  gemstone(S + [4.4, -1.2, 1.4], 0.65, 70);
  gemstone(S + [1, 4.25, 1.6], 0.7, 170);
}
module arms() mirror_x() { arm(SHOULDER, ELBOW, WRIST, HAND); pauldron(SHOULDER); }

// ---- Tail: the base's brush, grey over a cream edge, its upper half splintering into wood and rock.
module tail() {
  for (i = [0 : len(TAIL) - 3])
    blobN([[[TAIL_R[i], TAIL_R[i] * 0.8, TAIL_R[i]], TAIL[i]], [[TAIL_R[i + 1], TAIL_R[i + 1] * 0.8, TAIL_R[i + 1]], TAIL[i + 1]]], tailGrey);
  for (i = [0 : len(CREAM) - 3])
    blobN([[[CREAM_R[i], CREAM_R[i] * 0.85, CREAM_R[i]], CREAM[i]], [[CREAM_R[i + 1], CREAM_R[i + 1] * 0.85, CREAM_R[i + 1]], CREAM[i + 1]]], tailCream);
  for (t = [[[9.6, 5, 4], [3.4, -0.4, -1.2], 1.7, tailCream], [[14.8, 3.8, 5], [3.8, -0.4, -0.2], 1.8, tailCream],
            [[20, 2.6, 9.8], [1.8, -0.4, 3.2], 1.7, tailCream], [[12.4, 6.6, 11.2], [-1, 0, 3.6], 1.7, tailGrey],
            [[11, 8.4, 8.8], [3, 0.8, 0.6], 1.7, tailGrey], [[5.6, 7.6, 9.4], [3, 0.6, -0.6], 1.5, tailGrey]])
    tuft(t[0], t[1], t[2], t[3]);
  for (s = SPLINTERS) {
    color(s[3] == 1 ? splinterDark : splinter) hull() {
      translate(s[0]) scale([s[2], s[2] * 0.7, s[2] * 0.6]) sphere(1, $fn = 6);
      translate(s[0] + s[1]) sphere(0.12, $fn = 4);
    }
  }
  // twigs off the splinters
  for (t = [[[16.6, 2.9, 22], [-2.4, 0.2, 1.6]], [[19, 1.8, 24.2], [2, 0, 1.2]], [[18.4, 4.6, 21.4], [1.6, 1, 1.6]]])
    limb(t[0], t[0] + t[1], 0.35, 0.1, splinterDark, $fn = 5);
  for (p = PEBBLES) chunk(p[0], [p[1], p[1], p[1]], [p[0][0] * 9, p[0][2] * 7, 0], stoneDark, 6);
}

// ---- Boulders and stones round the feet, green energy arcs on the ground.
module stones() {
  for (b = STONES) chunk(b[0], b[1] * [1.2, 0.95, 1], [b[0][0] * 9, b[0][1] * 13, b[0][0] * 5], b[1] > 1.5 ? stoneDark : stone, 8);
  mirror_x() for (k = [[[9.8, -1.6, 0], 4.2, 150, 170], [[9.8, -1.6, 0], 5.6, 300, 120]])
    color(vein) translate(k[0]) rotate([0, 0, k[2]]) rotate_extrude(angle = k[3], $fn = 16) translate([k[1], 0.25]) scale([1, 0.45]) circle(0.38, $fn = 4);
}

// ---- Head: the base face with glowing green eyes in dark sockets and the wide green arrow.
module head() {
  blobN(HEAD, fur, 24);
  oval([2.1, 1.9, 1.5], [0, -3.9, 24.4], furLight, 16);   // muzzle
  oval([1.6, 1.4, 0.9], [0, -3.6, 23.1], fur, 12);   // chin
  oval([0.9, 0.55, 0.52], [0, -5.65, 25.3], ink, 12);   // nose
  stroke([[0, -5.75, 24.9], [0, -5.45, 23.7]], 0.15, ink);
  stroke([[-1.35, -4.85, 23.75], [-0.5, -5.35, 23.45], [0.5, -5.35, 23.5], [1.4, -4.9, 23.95]], 0.18, ink);
  mirror_x() spike([0.75, -5.25, 23.6], [0.05, -0.1, -0.55], 0.2, 0.03, cream);   // fangs
  mirror_x() {
    leaf([3, 1, 1.7], [4.6, -1.4, 25.2], [0, 28, 25], cream);
    leaf([2.4, 0.9, 1.3], [4.2, -2.2, 23.4], [0, 42, 20], cream);
    leaf([0.85, 0.5, 1.7], [3.4, 0.2, 30.6], [0, 25, 0], fur);
    eye(EYE, 0.9, iris = eyeGlow, sclera = socket, pupil = eyeGlow, yaw = 22, lid = 0.45, lid_tilt = 28, lid_c = fur,
        slit = 0.4, squint = 0.2);
    stroke([[0.9, -4.05, 27.9], [2.4, -3.8, 28.35], [3.6, -2.95, 28.8]], 0.2, ink);
  }
  color(mark) intersection() {
    grownBlob(HEAD, 0.12);
    rotate([90, 0, 0]) linear_extrude(12)
      polygon([[0, 27.6], [-2.8, 29.5], [-1.3, 29.6], [-1.35, 34], [1.35, 34], [1.3, 29.6], [2.8, 29.5]]);
  }
  color(mark) intersection() {
    grownBlob(HEAD, 0.12);
    mirror([0, 1, 0]) rotate([90, 0, 0]) linear_extrude(12) polygon([[-1.1, 26.6], [1.1, 26.6], [1.3, 33], [-1.3, 33]]);
  }
}

module maneHair() {
  blobN(MANE, mane, 16);
  for (l = LOCKS) lock(l[0], l[1], l[2], l[3], l[4], l[5] == 1 ? maneHi : mane);
}
module antlers() mirror_x() {
  chain(ANTLER, ANTLER_R, antler);
  limb([5.45, 0.2, 32.4], [7.3, -0.1, 33.6], 0.6, 0.15, antler);
}

module ravatar_earth() {
  legs();
  skirt();
  torso();
  arms();
  tail();
  stones();
  head();
  maneHair();
  antlers();
}

ravatar_earth();
