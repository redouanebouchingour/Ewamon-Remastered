// Caldermole: Coalette grown into an upright magma kaiju (sprite-match 2026-11-03).
// Checklist from the sprite (front sheet x, z; the scad frame puts the torso at x = y = 0, which reads sheet x -3.5):
// - Body plan: an upright Godzilla. A deep pear torso (sheet -12..5 at z 20, z 5..31), huge plated thighs, thick
//   shins, broad feet with four pale claws each; small arms hanging forward, four pale claws hooking down
//   (near hand at sheet (0, 12.5), far hand (-15, 14)). A long thick tail runs back and round to the creature's left,
//   then rises behind (sheet 12..18, z 5..27) to a thin tip wrapped in a tall flame (sheet 7..18.8, z 25..40).
// - Head: a kaiju profile turned to its right (sheet -15.6..-4.5, z 24.8..32.4): a domed skull, a blunt snout, a
//   heavy lower jaw, a mouth line turning up into a grin, a slanted glaring orange eye under a heavy brow (sheet
//   (-10.4, 29.4)), a nostril on the snout tip. A flame crest rises off the skull, streaming back (sheet -13..-3,
//   z 31..39.5).
// - Dorsal flames: a row of soft flame tongues from behind the head down the spine onto the tail's top (sheet
//   -4..14, z 12..33), red rims, orange, yellow cores.
// - Markings: charcoal plum hide in rounded plates split by glowing yellow-orange lava cracks; a molten heart on the
//   chest (sheet -9.7..-3.9, z 13..21.5, yellow core at (-7.7, 16.8)) with rays branching out; one crack along the
//   tail; dark seams between the tail's plates.
// - Back: the tail's plated length and the full row of dorsal flames along it; cracks over the back.
// - Not modelled: the lava pool it stands in and the smoke wisps.
include <lib.scad>

coal = [0.30, 0.22, 0.26];
coalHi = [0.36, 0.26, 0.33];
coalDark = [0.17, 0.12, 0.16];
ink = [0.08, 0.03, 0.06];
crack = [0.98, 0.70, 0.16, NOGLOW];
heartRed = [0.72, 0.14, 0.02, NOGLOW];
heartOrange = [0.94, 0.45, 0.06, NOGLOW];
heartCore = [0.99, 0.84, 0.30, NOGLOW];
flRed = [0.84, 0.21, 0.02, NOGLOW];
flOrange = [0.96, 0.53, 0.04, NOGLOW];
flYellow = [0.98, 0.79, 0.20, NOGLOW];
claw = [0.80, 0.60, 0.40];
eyeOrange = [0.96, 0.45, 0.05, NOGLOW];
eyeYellow = [0.99, 0.78, 0.22, NOGLOW];

// ---- Flames: layered plates (a red rim, an orange body a little thicker, a yellow core thicker still), so a flat
// flame reads as a soft swelling tongue from every side.
module flameP(pts, t, orange = undef, yellow = undef) {
  plate(pts, t, 0.3, flRed, 0.35);
  if (orange == undef) plate(pts, t + 0.7, 0.3, flOrange, -0.5); else for (o = orange) plate(o, t + 0.7, 0.2, flOrange, 0.15);
  if (yellow == undef) plate(pts, t + 1.4, 0.3, flYellow, -1.4); else for (y = yellow) plate(y, t + 1.4, 0.2, flYellow, 0.15);
}
// A flame tongue outline: base width w, height h, the tip swept `lean * h` along +x (curving like a lick).
function tongue(h, w, lean, n = 6) = concat(
  [for (i = [0 : n]) let(t = i / n) [lean * h * t * t - w / 2 * pow(1 - t, 0.8), h * t]],
  [for (i = [n - 1 : -1 : 1]) let(t = i / n) [lean * h * t * t + w / 2 * pow(1 - t, 0.6), h * t * 0.97]]);
// Red outlines, orange bodies and yellow cores as lists of outlines (a flame of several licks).
module flameL(reds, oranges, yellows, t) {
  for (o = reds) plate(o, t, 0.3, flRed, 0.35);
  for (o = oranges) plate(o, t + 0.7, 0.2, flOrange, 0.1);
  for (o = yellows) plate(o, t + 1.4, 0.2, flYellow, 0.1);
}
function shift(pts, dx) = [for (q = pts) q + [dx, 0]];
// A dorsal flame on point p, its plane turned `ang` about Z (90 = along the spine), sunk 1.5 into the hide: a main
// tongue with a long lick swept back and a short one in front, an orange body and a yellow core nested at its foot.
module dorsal(p, ang, h, w, lean, t = 1.4) {
  H = h + 1.5;
  translate(p) rotate([0, 0, ang]) translate([0, 0, -1.5]) flameL(
    [tongue(H, w * 0.6, lean), shift(tongue(H * 0.7, w * 0.45, lean * 1.5), w * 0.28), shift(tongue(H * 0.55, w * 0.4, lean * 0.9), -w * 0.3)],
    [tongue(H * 0.78, w * 0.4, lean * 1.05), shift(tongue(H * 0.5, w * 0.28, lean * 1.5), w * 0.28)],
    [tongue(H * 0.5, w * 0.28, lean)], t);
}
// Outlines traced from the front sheet go in the picture plane; the scad frame sits 7 units forward of the sheet's.
module sheetPlane(d) translate([0, 7, 0]) pp(d) children();

// ---- Lava cracks.
module crackline(pts, r = 0.3, c = crack) {
  for (i = [0 : len(pts) - 2]) color(c) hull() { translate(pts[i]) sphere(r, $fn = 4); translate(pts[i + 1]) sphere(r, $fn = 4); }
}
function onEll(c, r, az, el, g = 0.15) =
  [c[0] + (r[0] + g) * cos(el) * sin(az), c[1] - (r[1] + g) * cos(el) * cos(az), c[2] + (r[2] + g) * sin(el)];
module crackOn(c, r, pts, w = 0.3) crackline([for (q = pts) onEll(c, r, q[0], q[1])], w);

// ---- Torso: hips, belly, chest, a deep hunched back and the neck base, hulled.
TORSO = [
  [[0, 3, 10.5], [8.8, 8.5, 6]],
  [[0, 1.5, 15], [9, 9, 7]],
  [[0, 0, 21], [8.3, 8, 6.5]],
  [[0, 4.5, 20], [7, 8, 8.5]],
  [[0, 3, 26.5], [6.5, 7, 5]],
];
module torso(g = 0) hull() for (e = TORSO) translate(e[0]) scale(e[1] + [g, g, g]) sphere(1, $fn = 28);
// Where a ray from (0, 2, z) at azimuth az (0 = -Y front, 90 = +X) leaves the torso: lays cracks flush on the hull.
function rayE(z, az, e) = let(c = e[0], r = e[1], h = (z - c[2]) / r[2]) abs(h) >= 1 ? 0 :
  let(s = sqrt(1 - h * h), a = r[0] * s, b = r[1] * s, dx = sin(az), dy = -cos(az), oy = 2 - c[1],
      A = dx * dx / (a * a) + dy * dy / (b * b), B = 2 * oy * dy / (b * b), C = oy * oy / (b * b) - 1, q = B * B - 4 * A * C)
  q < 0 ? 0 : (-B + sqrt(q)) / (2 * A);
function onTorso(az, z, g = 0.2) = let(t = max([for (e = TORSO) rayE(z, az, e)]) + g) [t * sin(az), 2 - t * cos(az), z];
module crackT(pts, w = 0.3, c = crack) crackline([for (q = pts) onTorso(q[0], q[1])], w, c);

color(coal) torso();

// Molten heart on the chest: a dark red lozenge, an orange glow inside it, a yellow-hot core low in the middle.
// Outlines read off the front sheet's zoom; cut flush on the chest (the ball keeps them off the back).
HEART = [0.7, -8, 17.2];
HEART_R = [[-9.2, 21], [-8, 21.8], [-6.5, 21.3], [-5, 20.5], [-4, 19], [-3.9, 17.5], [-4.5, 15.5], [-5.8, 13.3], [-7.5, 14.5],
           [-9, 16], [-9.7, 18], [-9.6, 20]];
HEART_O = [[-9, 19.5], [-7.8, 20.6], [-5.8, 19.4], [-5, 17.5], [-5.6, 15.2], [-6.2, 14.3], [-7.6, 15], [-8.8, 16.5]];
HEART_Y = [[-8.6, 17.8], [-7.5, 18.6], [-6.8, 17.5], [-7, 16], [-7.8, 15.5], [-8.5, 16.3]];
module onChest(g, pts) intersection() { torso(g); translate([0, 7, 0]) prism(pts); translate(HEART) sphere(7, $fn = 12); }
color(heartRed) onChest(0.15, HEART_R);
color(heartOrange) onChest(0.3, HEART_O);
color(heartCore) onChest(0.45, HEART_Y);
// Molten streaks fanning out of the heart, then the rays and the cracks between the hide's plates.
for (r = [[[-8, 19.5], [-20, 21.5]], [[-6, 21], [-14, 23.5]], [[14, 19.5], [24, 20.5]], [[-10, 15.5], [-22, 14]], [[14, 15], [24, 13]],
          [[-4, 14], [-10, 12]]])
  crackT(r, 0.5, heartOrange);
// Rays branching out of the heart and the cracks between the hide's plates.
crackT([[4, 21], [2, 24], [0, 27.5]], 0.4);
crackT([[2, 24], [-10, 26.5]], 0.32);
crackT([[2, 24], [14, 27]], 0.32);
crackT([[-4, 18.5], [-16, 19], [-26, 20.5]], 0.34);
crackT([[12, 18.5], [24, 18], [34, 15.5]], 0.34);
crackT([[2, 13], [-4, 10.5], [-6, 7]], 0.34);
crackT([[-30, 9], [-40, 12], [-44, 15.5], [-50, 20], [-38, 25.5]]);
crackT([[48, 9], [54, 12], [52, 14], [58, 18], [58, 23]]);
crackT([[-6, 20.5], [-22, 23], [-38, 25.5]]);
crackT([[14, 20.5], [28, 22.5], [44, 24.5], [58, 23]]);
crackT([[18, 16.5], [34, 15.5], [52, 14]]);
crackT([[-14, 15], [-30, 14], [-44, 15.5]]);
crackT([[8, 13], [10, 9.5], [6, 6.5]]);
crackT([[-6, 13], [-16, 10], [-30, 9]]);
crackT([[20, 13], [34, 9.5], [48, 9]]);
crackT([[-22, 23], [-26, 18], [-40, 17]]);
mirror_x() {
  crackT([[58, 23], [66, 18], [62, 12], [74, 8]]);
  crackT([[66, 18], [84, 19], [96, 15]]);
  crackT([[84, 19], [92, 26], [104, 29]]);
  crackT([[96, 15], [112, 11], [130, 14]]);
  crackT([[112, 11], [118, 6.5]]);
  crackT([[120, 23], [136, 19], [150, 22]]);
  crackT([[136, 19], [146, 12], [160, 9]]);
  crackT([[70, 28.5], [88, 30]]);
}

// Neck: thick, running up and forward into the back of the skull; a heavy throat under the jaw.
color(coal) hull() {
  translate([0, 1.5, 27.5]) scale([5.5, 5.5, 4]) sphere(1, $fn = 24);
  translate([-1, -3.5, 27.8]) scale([3.6, 3.6, 3.2]) sphere(1, $fn = 20);
  translate([-1.5, -4, 24.5]) scale([3.6, 3.4, 3]) sphere(1, $fn = 20);
}

// ---- Head, built facing -Y about its middle, then turned 35° to the creature's right (the art is drawn near
// profile) and set on the neck.
HEAD_AT = [-2.7, -6, 28.3];
HEAD_YAW = -35;
module head() {
  // skull, brow and snout in one hull: a domed cranium drawn down into a blunt, level snout
  color(coal) hull() {
    translate([0, 1.5, 1.2]) scale([3.6, 3.8, 3]) sphere(1, $fn = 24);
    translate([0, -2.5, 1]) scale([3.3, 3, 2.3]) sphere(1, $fn = 22);
    translate([0, -5.8, -0.8]) scale([2.3, 2.6, 1.4]) sphere(1, $fn = 18);
    translate([0, -7.4, -0.6]) scale([1.9, 1.2, 1.3]) sphere(1, $fn = 14);
  }
  // heavy lower jaw, its lower face a shade lighter
  color(coalHi) hull() {
    translate([0, -0.5, -2.2]) scale([3.2, 3, 1.4]) sphere(1, $fn = 20);
    translate([0, -6.2, -2.6]) scale([1.6, 1.4, 0.8]) sphere(1, $fn = 14);
  }
  mirror_x() {
    // mouth line along the lips, turning up at the back into the grin
    color(ink) for (s = [[[1.75, -7.2, -1.85], [2.5, -4.5, -2.0]], [[2.5, -4.5, -2.0], [3.1, -1.5, -1.95]],
                        [[3.1, -1.5, -1.95], [3.35, 0.6, -1.2]], [[3.35, 0.6, -1.2], [3.4, 1.6, -0.2]]])
      hull() { translate(s[0]) sphere(0.22, $fn = 6); translate(s[1]) sphere(0.22, $fn = 6); }
    // nostril
    color(ink) translate([1.05, -7.6, 0.15]) scale([0.4, 0.3, 0.3]) sphere(1, $fn = 8);
    // a slanted glaring eye, orange over yellow with a dark slit, hooded by a heavy brow
    eye([2.95, -3.1, 1.1], 1.0, iris = eyeYellow, sclera = eyeOrange, pupil = [0.18, 0.03, 0.02], yaw = 50, flat = 0.5,
        lid = 0.3, lid_tilt = 24, lid_c = coal, slit = 0.4);
    color(coal) hull() {
      translate([2.85, -1.6, 2.3]) scale([0.9, 1, 0.65]) sphere(1, $fn = 10);
      translate([2.2, -4.6, 1.75]) scale([0.6, 0.7, 0.45]) sphere(1, $fn = 8);
    }
    // the brow's dark crease running back over the cheek
    color(ink) hull() { translate([3.1, -1.4, 2.0]) sphere(0.16, $fn = 6); translate([3.25, 1.4, 2.2]) sphere(0.16, $fn = 6); }
  }
}
translate(HEAD_AT) rotate([0, 0, HEAD_YAW]) head();
// Flame crest off the skull, streaming back (traced from the front sheet; its foot sunk into the head).
CREST = [[-3.8, 39.5], [-2.9, 39.3], [-3.9, 38.4], [-3.6, 36.2], [-5.3, 34.3], [-3.6, 34.6], [-3.6, 33.8], [-4.6, 31.8],
         [-6.5, 31], [-9.6, 31.2], [-12.3, 29.9], [-13.3, 32.4], [-13.0, 34.7], [-12.6, 35.1], [-12.3, 34.5], [-12.2, 35.2],
         [-10.4, 37.3], [-10.2, 35.5], [-9.0, 36.8], [-7.0, 37.1], [-6.4, 38.4], [-5.7, 37.1], [-5.1, 38.4]];
CREST_O = [[-5.1, 37.1], [-4.9, 36.3], [-6.5, 35.5], [-7.3, 34.5], [-5.2, 35.5], [-6.5, 33.5], [-5.4, 33.7], [-4.9, 33.2],
           [-6.2, 33.1], [-6.7, 31.3], [-9.6, 31.6], [-12.3, 30.2], [-12.8, 33.4], [-12.0, 33.5], [-11.7, 35.0], [-11.1, 35.5],
           [-11.2, 34.5], [-10.8, 34.7], [-10.3, 34.1], [-9.3, 35.7], [-8.2, 36.2], [-7.8, 35.7], [-6.7, 35.8]];
CREST_Y = [[-8.3, 34.5], [-8.0, 34.0], [-9.1, 33.0], [-9.0, 32.7], [-7.5, 33.7], [-6.7, 33.4], [-7.8, 32.6], [-9.6, 31.8],
           [-12.0, 30.8], [-11.5, 34.2], [-11.0, 32.4]];
sheetPlane(-9.9) flameP(CREST, 2.2, [CREST_O], [CREST_Y]);

// ---- Dorsal flames down the spine and on along the tail's top.
SPINE = [  // [point, plane angle, height, width, lean]
  [[0, 2, 30.4], 40, 5.5, 5.5, 0.9],
  [[0, 6, 28.8], 38, 6.5, 6.5, 1.0],
  [[0, 9.5, 25.8], 36, 7, 7, 1.05],
  [[0, 11.8, 21.6], 36, 7, 7, 1.1],
  [[0, 12.4, 17], 36, 6.5, 6.5, 1.1],
  [[3.6, 9, 14], 33, 6, 5.5, 0.9],
  [[8.2, 10.6, 12.8], 30, 5.5, 5, 0.8],
  [[12, 12.6, 12.4], 34, 4.5, 4, 0.7],
];
for (f = SPINE) dorsal(f[0], f[1], f[2], f[3], f[4]);

// ---- Arms: a round shoulder, a short upper arm, a forearm reaching forward, four pale claws hooking down.
mirror_x() {
  color(coal) translate([7, -3, 23]) scale([4, 4, 4.2]) sphere(1, $fn = 20);
  chain([[7.5, -3, 22], [10.3, -2.5, 17.5], [9.5, -7, 13.8]], [3, 2.6, 2.2], coal);
  ell([2.2, 2.4, 1.8], [9.5, -8, 12.8], coal);
  for (k = [-1.5, -0.5, 0.5, 1.5]) chain([[9.5 + k * 1.1, -9.4, 12.4], [9.5 + k * 1.3, -10.6, 11.3], [9.5 + k * 1.3, -10.4, 10]],
                                         [0.5, 0.36, 0.05], claw);
  crackline([[11.3, -4.6, 17.8], [12.6, -3, 18.6], [12, -1.4, 21.2]], 0.26);
  crackline([[11.2, -6.6, 14.8], [12.3, -5, 16.6]], 0.24);
  crackOn([7, -3, 23], [4, 4, 4.2], [[30, 10], [80, 25], [120, 5]], 0.26);
}

// ---- Legs: a huge plated thigh, a thick shin, a broad foot with four pale claws.
mirror_x() {
  color(coal) translate([7.5, 2, 10]) scale([5.5, 6.5, 6.2]) sphere(1, $fn = 24);
  limb([8.2, 1.5, 6], [8.4, 1.2, 3.6], 3.8, 3.3, coal);
  blob([[[3.8, 4.6, 1.6], [8.4, -0.5, 1.6]], [[3.2, 2.6, 1.4], [8.4, 2.5, 1.5]]], coal);
  for (k = [-1.5, -0.5, 0.5, 1.5]) chain([[8.4 + k * 1.9, -4.2, 1.4], [8.4 + k * 2.2, -5.7, 0.8], [8.4 + k * 2.3, -6.3, 0.1]],
                                         [0.7, 0.45, 0.06], claw);
  crackOn([7.5, 2, 10], [5.5, 6.5, 6.2], [[20, 45], [40, 15], [50, -20], [35, -50]]);
  crackOn([7.5, 2, 10], [5.5, 6.5, 6.2], [[40, 15], [80, 20], [110, 0]]);
  crackOn([7.5, 2, 10], [5.5, 6.5, 6.2], [[-10, 30], [10, 0], [0, -35]], 0.26);
}

// ---- Tail: back and round to the creature's left, rising behind into the tip flame.
TAIL = [[0, 5, 10.5], [4.2, 8.5, 9.2], [8.7, 10.5, 8.6], [12.1, 12.5, 9], [13.9, 14, 11.6], [13.9, 14, 15.6],
        [12.9, 13, 19.7], [11.7, 12, 23.4], [11.1, 11, 26.8]];
TAIL_R = [6.4, 5.5, 4.8, 4.2, 3.7, 3.2, 2.7, 2.0, 1.2];
chain(TAIL, TAIL_R, coal, $fn = 22);
// dark seams between the tail's plates
for (i = [2 : len(TAIL) - 2])
  color(coalDark) translate(TAIL[i]) rotate(_dir_rot(TAIL[i + 1] - TAIL[i - 1])) scale([1, 1, 0.07]) sphere(TAIL_R[i] + 0.12, $fn = 16);
// one lava crack running along the tail's top and front
function tnorm(t) = let(u = [0, -0.25, 1], n = u - t * (u * t)) n / norm(n);
crackline([for (i = [1 : len(TAIL) - 2]) let(t = TAIL[i + 1] - TAIL[i - 1], n = tnorm(t / norm(t))) TAIL[i] + n * (TAIL_R[i] + 0.05)], 0.28);
// The tail's flame (traced from the front sheet; the tip sits inside its foot).
TAILFLAME = [[14.7, 40.0], [15.9, 40.0], [15.1, 38.9], [15.1, 37.7], [17.2, 35.2], [17.2, 32.7], [15.9, 30.9], [17.3, 31.6],
             [17.8, 33.4], [18.5, 33.7], [18.3, 31.9], [18.8, 29.3], [17.2, 27.6], [17.7, 27.3], [17.2, 26.6], [14.1, 25.2],
             [11, 24.6], [7.8, 25.3], [7.8, 26.0], [8.6, 26.3], [7.0, 28.0], [7.0, 30.8], [7.8, 32.3], [10.1, 34.5], [9.9, 36.1],
             [11.1, 35.2], [11.5, 33.7], [12.5, 34.5], [12.0, 37.3], [13.0, 38.9]];
TAILFLAME_O = [[13.9, 37.8], [14.3, 37.8], [14.1, 36.3], [15.6, 35.2], [16.4, 33.3], [16.4, 32.4], [14.1, 29.9], [14.1, 29.1],
               [15.5, 29.4], [16.6, 29.3], [17.9, 31.5], [18.0, 30.0], [16.9, 28.3], [15.1, 27.6], [16.1, 26.8], [13.9, 26.3],
               [13.5, 25.3], [11.5, 24.9], [9.1, 25.3], [9.1, 26.5], [7.7, 28.5], [7.7, 31.0], [8.9, 32.5], [10.1, 33.5],
               [10.4, 34.5], [10.7, 33.0], [9.3, 31.4], [9.8, 31.3], [10.8, 32.1], [11.4, 31.4], [12.0, 33.1], [12.7, 32.9], [13.4, 34.1]];
TAILFLAME_Y = [[14.1, 34.5], [14.9, 33.4], [14.9, 32.1], [13.6, 30.4], [13.8, 29.0], [13.3, 28.2], [15.0, 28.7], [14.9, 27.9],
               [13.0, 27.0], [13.8, 26.9], [12.6, 25.3], [11.2, 25.0], [9.7, 25.3], [9.6, 26.9], [8.6, 28.4], [10.1, 27.7],
               [9.6, 28.7], [9.8, 30.5], [10.6, 31.0], [10.4, 30.0], [10.8, 29.5], [11.2, 30.5], [14.1, 32.8]];
sheetPlane(-2.1) flameP(TAILFLAME, 2.5, [TAILFLAME_O], [TAILFLAME_Y]);
