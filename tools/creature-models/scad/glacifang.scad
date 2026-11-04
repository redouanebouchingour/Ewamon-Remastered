// Glacifang: a crystalline white-blue ice drake prowling on all fours, its big horned head low and forward with the
// jaw open on cream fangs and frost bubbles at the mouth, slanted angry green eyes, cracked-ice scale cells, chunky
// pale crystal shards over the shoulders, big raised bat wings with pale panels (lavender on the back) and a thick
// tail swinging out to its left and curling down to the ground.
//
// Checklist (front sheet, z as on the sheet; the art stands on a rock, foot line about z 5.5; G lowers everything):
//   head      big, x -16..-4, z 10.8..22: faces the viewer (only turned 15 deg to the creature's right), so the far
//             eye peeks at the head's left edge (x -15.3) and the near eye sits at x -9.3; short broad boxy muzzle
//             (front z 12.5..17.5), the gape slanting from under the eye down to the front, cream teeth with a red
//             mouth, lower jaw z 10.8..12.5, a dark nostril (x -13.2, z 14.2)
//   eyes      two green almond eyes (~2 tall), a slit pupil and a white glint, a heavy brow slanting down to the nose
//   horns     two pale crystal horns up and back off the skull (tips x -12.5 z 27.4 and x -10.5 z 25), small crest
//             spikes between, jagged cheek frills pointing back (x -6..-4, z 16..19)
//   bubbles   frost bubbles in front of the mouth (x -21..-16, z 12..21)
//   body      a deep chest and a round rump, pale white-blue with darker cracked-ice scale cells, grey-blue belly and
//             throat (x -6..-0.5, z 11.5..15); thick neck
//   crystals  three big pale cyan shards over the shoulders (tips x -5.3 z 30.4, x -0.2 z 33.5, x 2 z 30.4), smaller
//             ones down the spine and along the tail root (x 10..16, z 19..24)
//   legs      near foreleg: a big pale shoulder (x -3..3.6, z 9.6..19), forearm to a paw x -4..1 with white claws;
//             far foreleg reaching forward under the head (paw x -14..-12); near haunch round x 5..12 z 9..22 with a
//             scale grid, hind paw x 5..13 with white claws
//   tail      thick (r ~2.5), off the rump out to the creature's left, down the right edge (x 14..18, z 6..21) and
//             curling to the ground (tip x 14..17, z 5..7), grey-blue underside, crystal spikes along its top
//   wings     big, raised: near wing forearm near vertical (x 4..6, z 24..34.5), wrist claw (x 1.7, z 36.5), the top
//             edge to the tip (21.6, 39.2), three finger spars to (16.6, 28.6), (12.4, 28.6), (10.8, 26.4), scalloped
//             trailing edge; far wing raised behind the crystals (x -15.5..-4.5, z 27..39.6); pale panels, blue bones
//   back      wings spread wide with lavender panels, the crystal crest down the spine, the tail sweeping out to the
//             creature's left (the back art lifts it high; the front wins: it curls down)
include <lib.scad>

G = 5.6;   // the art's foot line on the rock

skin = [0.76, 0.87, 0.95];
skinLt = [0.88, 0.95, 0.98];
cell = [0.88, 0.95, 0.98, NOGLOW];
cellDk = [0.47, 0.64, 0.82];
belly = [0.59, 0.69, 0.72];
crystal = [0.7, 0.88, 0.97, NOGLOW];
crystalDk = [0.5, 0.72, 0.9];
crystalHi = [0.9, 0.97, 1.0, NOGLOW];
memb = [0.84, 0.93, 0.97, NOGLOW];
membMd = [0.72, 0.86, 0.95];
lav = [0.66, 0.66, 0.88];
bone = [0.8, 0.9, 0.98];
spar = [0.42, 0.58, 0.78];
claw = [0.92, 0.97, 1.0, NOGLOW];
fang = [0.96, 0.9, 0.74, NOGLOW];
mouthC = [0.7, 0.36, 0.38];
nostril = [0.2, 0.28, 0.4];
irisC = [0.3, 0.68, 0.26, NOGLOW];
scleraC = [0.5, 0.84, 0.4, NOGLOW];
pupilC = [0.06, 0.16, 0.06];
bubble = [0.78, 0.9, 0.97, NOGLOW];

// Head: its own frame (faces -Y, origin between the eyes), placed at HC and turned HRZ to the creature's right.
HC = [-3.7, -17, 12.6];
HRZ = 0;
HS = 1.18;
EYE = [2.95, -1.8, 0.7];
EYES = 1.3;
EYEYAW = 28;

// Wings (left one; mirrored): a vertical plane through the shoulder WS, swept WA back from +X. Points in it are
// [u, z]: the near wing traced off the front sheet, u = (sheet x - WX) / cos(WA - 30), z = sheet z - G.
WS = [4, -3, 16];
WA = 25;
WX = 0.866 * WS[0] + 0.5 * WS[1];
WK = 1.1;   // the wing drawn a little wider than traced: the art's far wing reaches further out
WL = 4;     // and raised: the near wing's tip is the highest point of the drawing (0 at the root, WL at the top)
function wu(q) = [(q[0] - WX) / cos(WA - 30) * WK, q[1] + WL * max(0, q[1] - 22) / 17.6 - G];
function wp(q) = [WS[0] + q[0] * cos(WA), WS[1] + q[0] * sin(WA), q[1]];
WWu = wu([4.4, 34.4]);
WEu = wu([3.7, 28.5]);
// finger tips: the first ends the top edge, the others radiate down across the membrane
WTu = [wu([21.6, 39.2]), wu([17.4, 34.4]), wu([16.6, 28.6]), wu([12.4, 28.6]), wu([10.8, 26.4])];
WW = wp(WWu);
WE = wp(WEu);
WT = [for (t = WTu) wp(t)];
// the trailing edge between two finger tips: an arc pulled in towards the wrist (the scallop)
function scallop(a, b, k = 0.2) = [for (t = [0.25, 0.5, 0.75]) let(m = a + (b - a) * t) m + (WWu - m) * k * sin(180 * t)];
WING = concat([for (q = [[3.2, 22.6], [3.6, 27], [4.0, 31], [4.4, 34.4], [6, 36.3], [8.5, 37.8], [11.5, 38.9], [14.5, 39.6], [18, 39.6]]) wu(q)],
  [for (k = [0 : len(WTu) - 2]) each concat([WTu[k]], scallop(WTu[k], WTu[k + 1], k == 0 ? 0.16 : 0.3))],
  [WTu[len(WTu) - 1]], [for (q = [[10.0, 23.6], [7, 22.4]]) wu(q)]);

// Tail: off the rump out to the creature's left, down its side and curling forward onto the ground.
TP = [[2, 9, 13], [7, 12, 14], [11.6, 11.2, 10.8], [15, 7.8, 6.6], [17, 4.2, 2.6], [17.8, 0.8, 1.1], [16.8, -2.2, 0.7]];
TR = [3.9, 3.6, 3.3, 2.8, 2.2, 1.5, 0.5];

// Six-sided crystal shard from p along d.
module shard(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    cylinder(h = l * 0.55, r = r, $fn = 6);
    translate([0, 0, l]) sphere(r * 0.1, $fn = 4);
  }
}
// Cracked-ice scale cells on an ellipsoid (centre cen, radii r): each [azimuth, elevation, half-angle]. A cell is the
// ellipsoid grown by `g`, cut by a six-sided cone from the centre, so it lies flush on the curved surface; the thin
// gaps between neighbouring cells show the body colour underneath as the cracks.
module cells(cen, r, list, g, c) {
  for (t = list) let(az = t[0], el = t[1], ha = t[2], L = max(r) * 1.4)
    color(c) intersection() {
      translate(cen) scale(r + [g, g, g]) sphere(1, $fn = 28);
      translate(cen) rotate(_dir_rot([r[0] * cos(el) * cos(az), r[1] * cos(el) * sin(az), r[2] * sin(el)])) rotate([0, 0, az])
        cylinder(h = L, r1 = 0, r2 = L * tan(ha), $fn = 6);
    }
}
// Hard brow ridge over an eye at p (radius s, turned yaw like the eye), slanting down towards the nose.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.1, s * 1.15]) scale([s * 0.65, s * 0.8, s * 0.45]) sphere(1, $fn = 10);
    translate([-s * 1.05, -s * 0.2, s * (1.15 - drop)]) scale([s * 0.55, s * 0.7, s * 0.38]) sphere(1, $fn = 10);
    translate([0, s * 1.0, s * 1.1]) scale([s * 1.2, s * 0.7, s * 0.55]) sphere(1, $fn = 10);
  }
}

// ---------------------------------------------------------------- head
module head() {
  // Skull: a broad cranium and a short boxy muzzle, whiter than the body.
  color(skinLt) hull() {
    translate([0, 2.6, 1.0]) scale([4.4, 4.0, 3.6]) sphere(1, $fn = 22);
    translate([0, -1.4, -0.9]) scale([3.9, 2.6, 2.8]) sphere(1, $fn = 18);
    translate([0, -4.2, -1.4]) scale([2.7, 1.4, 2.4]) sphere(1, $fn = 14);
  }
  // Nostrils at the front of the muzzle.
  mirror_x() color(nostril) translate([1.0, -5.45, 0.1]) rotate([0, 0, 30]) scale([0.36, 0.2, 0.18]) sphere(1, $fn = 8);
  // Lower jaw, dropped a little open; the red mouth between.
  color(skin) hull() {
    translate([0, 0.8, -4.3]) scale([3.3, 2.6, 1.4]) sphere(1, $fn = 14);
    translate([0, -3.9, -5.2]) scale([2.1, 1.1, 0.95]) sphere(1, $fn = 10);
  }
  color(belly) hull() { translate([0, 0.6, -5.2]) scale([2.6, 2.2, 0.7]) sphere(1, $fn = 12); translate([0, -3.2, -5.8]) scale([1.4, 0.9, 0.45]) sphere(1, $fn = 8); }
  color(mouthC) hull() {
    translate([0, 0.4, -3.2]) scale([3.1, 2.4, 1.2]) sphere(1, $fn = 12);
    translate([0, -3.8, -4.1]) scale([1.9, 0.9, 0.9]) sphere(1, $fn = 8);
  }
  // Cream fangs: an upper row hanging off the lip, a lower row rising, the front pair bigger.
  mirror_x() {
    for (i = [0 : 3]) spike([0.9 + i * 0.6, -4.5 + i * 1.3, -3.0 - i * 0.05], [0, 0, -1.5 + i * 0.15], 0.46, 0.05, fang);
    for (i = [0 : 2]) spike([1.2 + i * 0.6, -3.7 + i * 1.5, -4.7 + i * 0.1], [0, 0, 1.1], 0.38, 0.05, fang);
  }
  // Green slanted eyes with a glint under a hard brow.
  mirror_x() {
    eye(EYE, EYES, iris = irisC, sclera = scleraC, pupil = pupilC, yaw = EYEYAW, flat = 0.5,
        lid = 0.3, lid_tilt = 26, lid_c = skinLt, slit = 0.35, shine = true);
    brow(EYE + [-0.1, 0.25, 0.35], EYES, EYEYAW, 0.9, skinLt);
  }
  // Two crystal horns sweeping up and back, small crest spikes between them, jagged cheek frills.
  mirror_x() {
    chain([[2.3, 2.0, 3.4], [2.8, 3.8, 7.6], [3.0, 5.8, 10.6]], [1.6, 0.95, 0.12], crystal);
    shard([1.0, 0.8, 3.8], [0.3, 1.6, 3.2], 0.6, crystalHi);
    shard([3.7, 3.2, -2.2], [1.6, 3.4, -0.6], 0.75, crystal);
    shard([4.0, 3.6, 0.2], [1.6, 3.2, 0.8], 0.7, crystalHi);
    shard([3.4, 5.0, 2.2], [1.2, 2.6, 1.6], 0.6, crystal);
  }
  shard([0, 3.6, 4.0], [0, 2.0, 3.0], 0.7, crystal);
}

// ---------------------------------------------------------------- body
module body() {
  // Torso: a deep chest and a round rump.
  blob([[[6.4, 6.6, 7], [0, -7, 12.2]], [[6, 6, 6.4], [0, 5, 11.2]]], skin);
  // Grey-blue belly and throat underneath.
  blob([[[4.2, 3.8, 3.4], [0, -10.5, 8.6]], [[4.2, 6, 2.4], [0, -1, 6.2]]], belly);
  // Neck: thick, bending forward and to the creature's right into the back of the skull.
  chain([[0, -6.5, 15.4], [-2.0, -10.2, 15.4], [-3.6, -12.8, 14.4]], [4.8, 4.3, 3.8], skin);
  color(belly) hull() { translate([-1.4, -11, 11.2]) scale([2.8, 2.4, 2]) sphere(1, $fn = 12); translate([-0.4, -11.4, 9]) scale([3, 2.4, 2]) sphere(1, $fn = 12); }
  // Cracked-ice scale cells over the shoulders, flanks and back.
  mirror_x() {
    cells([0, -7, 12.2], [6.4, 6.6, 7], [for (az = [-60 : 22 : 30]) for (el = [0 : 20 : 60]) [az + el * 0.3, el, 9.6]], 0.1, cell);
    cells([0, 5, 11.2], [6, 6, 6.4], [for (az = [-10 : 24 : 70]) for (el = [10 : 20 : 50]) [az + el * 0.3, el, 9.6]], 0.1, cell);
  }

  translate(HC) rotate([0, 0, HRZ]) scale(HS) head();

  // ---------------------------------------------------------- crystals
  // Three big shards over the shoulders, the middle one tallest, leaning back; smaller ones down the spine.
  shard([0, -7.5, 16.5], [0, 5, 11.5], 2.4, crystal);
  mirror_x() {
    shard([2.6, -7.4, 16], [0.6, 2.4, 8], 1.7, crystalHi);
    shard([2.8, -4.0, 16.4], [1.2, 2.0, 5.2], 1.3, crystal);
  }
  shard([0, -10.6, 16.6], [-0.6, 0.6, 5.2], 1.0, crystalHi);
  for (s = [[-2.6, 16.6, 5.4, 1.1], [0.6, 16.4, 4.4, 0.95], [3.6, 15.7, 3.6, 0.85], [6.6, 14.8, 3.0, 0.75], [9.2, 13.6, 2.4, 0.65]])
    shard([0, s[0], s[1] - 1], [0, 1.4, s[2]], s[3], s[0] > 2 ? crystal : crystalHi);

  // ---------------------------------------------------------- legs
  module paw(p, toes, spread) {
    color(skin) hull() { translate(p) scale([1.9, 2.1, 1.0]) sphere(1, $fn = 12); translate(p + [0, 1.4, 0.5]) scale([1.5, 1.4, 1.0]) sphere(1, $fn = 10); }
    for (k = [0 : toes - 1]) let(a = (k - (toes - 1) / 2) * spread)
      spike(p + [sin(a) * 1.4, -1.6, -0.25], [sin(a) * 0.6, -1.9, -0.25], 0.42, 0.06, claw);
  }
  mirror_x() {
    // Foreleg: a big pale shoulder, the upper arm back to a bent elbow, the forearm down to a broad paw.
    ell([4.0, 4.4, 5.0], [5.4, -8, 10], skin);
    cells([5.4, -8, 10], [4.0, 4.4, 5.0], [for (az = [-50 : 30 : 40]) for (el = [-20 : 22 : 40]) [az + el * 0.3, el, 11]], 0.1, cell);
    limb([5.8, -8, 8], [6.4, -8.6, 4.8], 3.5, 2.9, skin);
    limb([6.4, -8.6, 4.8], [6, -12, 1.8], 2.9, 2.3, skin);
    paw([6, -12.8, 1.1], 4, 26);
    // Haunch: a big round thigh with a scale grid, the shin down to the hind paw.
    ell([4.0, 5.2, 6.0], [6, 5.5, 10], skin);
    cells([6, 5.5, 10], [4.0, 5.2, 6.0], [for (az = [-40 : 24 : 40]) for (el = [-30 : 20 : 45]) [az + el * 0.3, el, 10]], 0.1, cell);
    limb([6.6, 6.4, 6.4], [7.2, 8.8, 3.4], 3.6, 2.8, skin);
    limb([7.2, 8.8, 3.4], [7, 6.4, 1.8], 2.8, 2.2, skin);
    paw([7, 5.4, 1.0], 3, 30);
  }

  // ---------------------------------------------------------- tail
  chain(TP, TR, skin);
  // Grey-blue underside along the inner curve, darker cell bands across the top.
  color(belly) for (i = [0 : len(TP) - 3]) hull() {
    translate(TP[i] + [-TR[i] * 0.35, -TR[i] * 0.3, -TR[i] * 0.45]) sphere(TR[i] * 0.62, $fn = 10);
    translate(TP[i + 1] + [-TR[i + 1] * 0.35, -TR[i + 1] * 0.3, -TR[i + 1] * 0.45]) sphere(TR[i + 1] * 0.62, $fn = 10);
  }
  for (i = [0 : len(TP) - 3]) let(d = TP[i + 1] - TP[i], r = TR[i] + (TR[i + 1] - TR[i]) * 0.5)
    color(cell) translate(TP[i] + d * 0.5) rotate(_dir_rot(d)) scale([r * 1.06, r * 1.06, r * 0.3]) sphere(1, $fn = 8);
  // Crystal spikes along its top and outer edge.
  for (k = [[0, 0.3, [0.4, 0.6, 3.0], 0.75], [0, 0.75, [0.9, 0.6, 2.6], 0.7], [1, 0.3, [1.6, 0.4, 2.4], 0.65], [1, 0.75, [2.2, 0, 1.8], 0.6],
            [2, 0.4, [2.4, -0.4, 1.2], 0.55], [3, 0.2, [2.2, -0.6, 0.4], 0.5]])
    let(i = k[0], p = TP[i] + (TP[i + 1] - TP[i]) * k[1], r = TR[i] + (TR[i + 1] - TR[i]) * k[1], n = k[2] / norm(k[2]))
      shard(p + n * r * 0.7, k[2], k[3], i % 2 == 0 ? crystal : crystalHi);

  // Frost bubbles in front of the mouth.
  for (b = [[-11.4, -21.4, 9.4, 0.75], [-12.4, -22.6, 11.6, 0.9], [-11.6, -23.2, 13.8, 0.6], [-13.2, -21.6, 13.0, 0.55], [-12.2, -20.6, 15.8, 0.45]])
    color(bubble) translate([b[0], b[1], b[2]]) sphere(b[3], $fn = 10);
}

// ---------------------------------------------------------------- wings
// Bat wing: the traced membrane as a plate in the wing plane, lavender panels on its back face (the back art), the bone
// arm along the leading edge, finger spars from the wrist to each tip, a hooked thumb claw.
module wing() {
  translate([WS[0], WS[1], 0]) rotate([0, 0, WA]) {
    plate(WING, 1.3, 0.3, memb);
    // pale-blue streaks between the spars on the front, lavender panels on the back
    for (k = [1 : len(WTu) - 2]) let(a = WTu[k], b = WTu[k + 1], m = (a + b) / 2) {
      translate([0, -0.5, 0]) plate([WWu + (a - WWu) * 0.75, WWu + (m - WWu) * 0.66, WWu + (b - WWu) * 0.75, WWu + (b - WWu) * 0.3, WWu + (a - WWu) * 0.3], 0.4, 0.3, membMd, 0);
      translate([0, 0.5, 0]) plate([WWu + (a - WWu) * 0.88, WWu + (m - WWu) * 0.74, WWu + (b - WWu) * 0.88, WWu + (b - WWu) * 0.2, WWu + (a - WWu) * 0.2], 0.4, 0.3, lav, 0);
    }
    translate([0, 0.5, 0]) plate([wu([3.6, 23.4]), wu([4.0, 30.5]), WWu + (WTu[4] - WWu) * 0.8, wu([8, 23])], 0.4, 0.3, lav, 0);
  }
  // the pale bone arm: shoulder, elbow, wrist, and on along the top edge to the tip
  chain([WS, WE, WW, WT[0]], [1.7, 1.25, 1.0, 0.4], bone);
  chain([WW, wp(wu([3.0, 35.8])), wp(wu([1.8, 36.6]))], [0.7, 0.42, 0.06], claw);
  // finger spars radiating down across the membrane, standing proud of both faces
  for (k = [1 : len(WT) - 1]) limb(WW, WT[k], 0.95, 0.75, spar);
  for (f = WT) spike(f, (f - WW) * 0.06, 0.3, 0.03, claw);
}

body();
mirror_x() wing();
