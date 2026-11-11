// Tidalfang: a slender teal sea dragon coiled upright, remodelled to its sprite (2026-11-06).
// Checklist (front sheet, 40 units tall, 36.5 wide; the art stands on a rock, z 0..~5, which is not modelled: the feet
// stand on sheet z 5, so everything is authored in sheet z and lowered G = 5):
//   head  turned towards the viewer's left and tipped nose-down: a broad scaled skull (x -13..-3, z 23..31.5), a short
//         muzzle to (-10.8, 24) with a smile line rising to the right and two nostrils. Two big cute eyes: near
//         (-6.5, 27.5), far (-11.8, 27.2), r ~1.15: black rim, big black pupil, a lilac-grey iris low, a white glint.
//         Two teal-grey horns straight up from the crown, tips (-11, 35.8) and (-3, 35.3). Spiky pale frill fins
//         behind the cheeks (-14..-12, 26..32) and (-3..1.5, 25..32.5).
//   body  an upright scaled neck and chest with a pale grey-white belly in bands (x -8..0, z 10..24).
//   sail  a big pale fin rising behind the head and shoulders (x -9..13.4, z 20..40): mint membrane, lilac towards the
//         base, teal ribs fanning to scalloped tips, lilac veins.
//   tail  the scaled body coils: up behind the near shoulder, over the top (z 25) and down the viewer's right into a
//         big loop (x 5..15, z 6..25) with a pale underside and a pale fin inside it, then behind the legs to the
//         left, ending in a spiral with a pale fin (x -17..-10, z 5..15). Flush lighter scales all over it.
//   arms  little clawed arms: the near one grips the coil (3..6, 16..21), the far one (-10..-8, 14..20) with a fin.
//   legs  thighs (1..6.5, 11..14) and (-7..-4, 9..14), three-toed clawed feet on the rock.
//   drops water drops round it.
include <lib.scad>

G = 5;
teal = [0.14, 0.6, 0.66];
tealDk = [0.05, 0.37, 0.45];
rib = [0.1, 0.52, 0.6];
scaleHi = [0.32, 0.82, 0.84];
mint = [0.78, 0.97, 0.93];
lilac = [0.68, 0.7, 0.84];
belly = [0.76, 0.8, 0.85];
bellyBand = [0.55, 0.6, 0.67];
horn = [0.45, 0.66, 0.66];
claw = [0.86, 0.93, 0.94];
drop = [0.35, 0.62, 0.93, NOGLOW];
ink = [0.04, 0.06, 0.08];
eyeIris = [0.7, 0.7, 0.82];

// The family's cute eye: the shape of lib.scad's eye() (so the rig's lids fit it) but drawn like the art: a dark eye
// with a big pupil, an iris crescent low on the outer side and a white glint high on the inner side.
module cuteEye(p, size, yaw, flat = 0.55, iris = eyeIris, navy = [0.04, 0.06, 0.08], glint = 1) {
  translate(p) rotate([0, 0, yaw]) {
    color(navy) scale([1, flat, 1.15]) sphere(size, $fn = 20);
    color(iris) intersection() {
      translate([0, -size * flat * 0.5, -size * 0.12]) scale([0.82, 0.55, 0.92]) sphere(size, $fn = 18);
      translate([-size * 0.1 * glint, -size * 2, -size * 0.25]) rotate([0, -35 * glint, 0]) translate([-size * 2, 0, -size * 2]) cube([size * 4, size * 2, size * 2]);
    }
    color([0.02, 0.03, 0.04]) translate([-size * 0.08 * glint, -size * flat * 0.7, size * 0.08]) scale([0.5, 0.42, 0.62]) sphere(size, $fn = 14);
    color("white") translate([-size * 0.32 * glint, -size * flat * 0.98, size * 0.4]) scale([1, 0.6, 1.1]) sphere(size * 0.26, $fn = 10);
  }
}
// halfSpace(n, p, k): the points whose offset from p along the unit normal n is more than k (the belly technique).
module halfSpace(n, p, k) { translate(p + n * k) rotate(_dir_rot(n)) translate([-60, -60, 0]) cube([120, 120, 120]); }
function F(sx, z, y) = fromSheet(sx, z, y);
// Catmull-Rom spline through control points P, n samples per span.
function cr(a, b, c, d, t) = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
function spline(P, n) = concat([for (i = [0 : len(P) - 2]) for (k = [0 : n - 1])
  cr(P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)], k / n)], [P[len(P) - 1]]);
function lerpR(R, n) = concat([for (i = [0 : len(R) - 2]) for (k = [0 : n - 1]) R[i] + (R[i + 1] - R[i]) * k / n], [R[len(R) - 1]]);

// ---------- head: its own frame (x = side, -y = muzzle), turned 15 deg towards the camera and tipped 18 deg nose-down
HC = [-8, -3.6, 28.4];
module headFrame() { translate(HC) rotate([0, 0, 15]) rotate([18, 0, 0]) scale(1.3) children(); }
module frill(s) {
  // three pale fins fanning out behind the cheek, each a flattened leaf with a teal rib down it
  for (f = [[48, 3.6], [12, 3.8], [-24, 3]]) let(a = f[0], l = f[1]) translate([s * 3, 1, 0.4]) rotate([0, -s * a, s * 25]) {
    color(mint) translate([s * l * 0.55, 0, 0]) scale([l * 0.62, 0.3, 0.75]) sphere(1, $fn = 12);
    color(tealDk) hull() { sphere(0.3, $fn = 6); translate([s * l * 1.12, 0, 0]) sphere(0.1, $fn = 6); }
  }
}
module head() {
  // Broad skull hulled into a short muzzle.
  color(teal) hull() {
    translate([0, 0.2, 0.4]) scale([3.9, 3.4, 3.1]) sphere(1, $fn = 24);
    translate([0, -2.6, -1.3]) scale([3, 2.6, 2.4]) sphere(1, $fn = 18);
    translate([0, -4.6, -2.6]) scale([1.9, 1.6, 1.5]) sphere(1, $fn = 14);
  }
  // Pale chin.
  color(belly) translate([0, -2.6, -3.2]) scale([2.2, 2.4, 0.9]) sphere(1, $fn = 14);
  // Smile and nostrils.
  mirror_x() color(ink) {
    hull() { translate([0.8, -5.9, -3.2]) sphere(0.16, $fn = 6); translate([1.8, -4.6, -2.95]) sphere(0.16, $fn = 6); }
    hull() { translate([1.8, -4.6, -2.95]) sphere(0.16, $fn = 6); translate([2.6, -2.8, -2.2]) sphere(0.16, $fn = 6); }
  }
  mirror_x() ell([0.3, 0.25, 0.22], [0.7, -6.1, -1.9], ink);
  // Lighter scales on the brow and crown.
  for (p = [[0, -1.2, 3.2], [-1.4, -0.4, 3.2], [1.4, -0.4, 3.2], [0, 1, 3.4], [-0.7, -2.6, 2.1], [0.7, -2.6, 2.1]])
    color(scaleHi) translate(p) scale([0.7, 0.7, 0.2]) sphere(1, $fn = 6);
  // Eyes: big, round and cute.
  mirror_x() cuteEye([2.5, -2.3, 0.1], 1.4, 38, glint = -1);
  // Brow ridges, soft.
  mirror_x() color(teal) translate([2.3, -2.2, 1.55]) rotate([0, 0, 38]) scale([1.4, 0.7, 0.45]) sphere(1, $fn = 10);
  // Horns: straight up from the crown, a little outwards.
  mirror_x() chain([[1.7, 0.6, 2.4], [2.2, 1.1, 5], [2.5, 1.6, 7.2]], [0.95, 0.65, 0.12], horn);
  // Frill fins behind the cheeks.
  frill(1); frill(-1);
}
translate([0, 0, -G]) headFrame() head();

// ---------- neck and torso: an upright S from the hips into the head
spine = [[0, 1.6, 11], [-0.8, 0, 16.5], [-2.6, -1.4, 21], [-5.2, -2.6, 24.4], [-7.8, -3.2, 27.4]];
spineR = [4.6, 4.4, 3.6, 2.9, 2.6];
// Pale belly on the front of the neck and chest, in bands.
NB = [-0.55, -0.83, 0];
module bellyPart(g) { intersection() { chain(spine, [for (r = spineR) r + g]); halfSpace(NB, [-2.5, -1.2, 18], 1.2); translate([-30, -30, 8.5]) cube([60, 60, 18.5]); } }
translate([0, 0, -G]) {
  chain(spine, spineR, teal);
  color(belly) bellyPart(0.22);
  for (z = [11 : 1.9 : 25]) color(bellyBand) intersection() { bellyPart(0.34); translate([-30, -30, z]) rotate([10, 0, 0]) cube([60, 60, 0.4]); }
  // Lighter scales on the back of the neck.
  for (i = [1 : len(spine) - 1]) for (k = [-1, 0, 1]) let(dir = [0.3 + k * 0.7, 0.75, 0.1])
    color(scaleHi) translate(spine[i] + dir / norm(dir) * spineR[i] * 0.95) rotate(_dir_rot(dir)) scale([spineR[i] * 0.28, spineR[i] * 0.28, 0.25]) sphere(1, $fn = 6);
}

// ---------- the sail: a big pale fin behind the head and shoulders, in the picture plane
sailPts = [[-8.4, 26], [-8.2, 33], [-7.2, 37], [-6, 39.6], [-4.2, 39.8], [-1.6, 38.2], [1.8, 39.2], [3.4, 35.8], [6.4, 36.6],
           [7.9, 32.6], [10.9, 32.2], [11.4, 29.2], [12.9, 27.2], [13.2, 23.6], [10, 21], [4, 19.6], [-2, 19.6], [-6.4, 22]];
lilacPts = [[-9.5, 18], [-9.5, 28], [-5, 29.5], [0, 30], [5, 28.6], [9, 26.6], [12, 24.6], [14.5, 23], [14.5, 18]];
SAILB = [1.6, 20.4];
sailTips = [[-6, 39.6], [-1.6, 38.2], [1.8, 39.2], [6.4, 36.6], [10.9, 32.2], [12.9, 27.2]];
sailBases = [[-7, 28], [-4.4, 25], [-1.6, 23.4], [2, 22.6], [5.4, 22.4], [8.8, 22.6]];
SD = 4.2;
translate([0, 0, -G]) pp(SD) translate([0, 0, 20]) rotate([-22, 0, 0]) scale([1, 1, 1.08]) translate([0, 0, -20]) {
  plate(sailPts, 1, 0.3, mint);
  color(lilac) intersection() { plate(sailPts, 1.14, 0.3); rotate([90, 0, 0]) linear_extrude(height = 4, center = true) polygon(lilacPts); }
  for (s = [-1, 1]) {
    // teal ribs to the tips, on both faces, thick at the base
    for (k = [0 : len(sailTips) - 1]) let(t = sailTips[k], b = sailBases[k]) color(rib) hull() { translate([b[0], s * 0.5, b[1]]) scale([0.75, 0.3, 0.75]) sphere(1, $fn = 8); translate([t[0], s * 0.5, t[1]]) scale([0.3, 0.25, 0.3]) sphere(1, $fn = 6); }
    // lilac veins between the ribs
    for (k = [0 : len(sailTips) - 2]) let(m = (sailTips[k] + sailTips[k + 1]) / 2) color(lilac)
      let(b = (sailBases[k] + sailBases[k + 1]) / 2) hull() { translate([b[0] + (m[0] - b[0]) * 0.3, s * 0.6, b[1] + (m[1] - b[1]) * 0.3]) sphere(0.16, $fn = 6); translate([m[0] - (m[0] - b[0]) * 0.12, s * 0.58, m[1] - (m[1] - b[1]) * 0.12]) sphere(0.14, $fn = 6); }
  }
}

// ---------- tail: the coil and the spiral, a pale underside, flush lighter scales
tailC = [F(0, 12, 4.5), F(2.4, 18, 3.4), F(1.6, 22.6, 0.4), F(6, 24, -1.4), F(12, 22.4, -1.8), F(14.6, 17, -1.8), F(14, 10.4, -1.4),
         F(10, 6.8, -1), F(5.6, 7.4, 0.2), F(1, 6.6, 3), F(-5, 6.4, 3.4), F(-10, 6, 1.2), F(-14.6, 6, -1), F(-17.6, 8.4, -1.8),
         F(-17, 13, -1.8), F(-14, 14, -1.8), F(-12.4, 11.6, -1.8), F(-13.6, 9.6, -1.8)];
tailCR = [3.4, 3.2, 3.1, 3.1, 3, 2.9, 2.8, 2.6, 2.4, 2.3, 2.2, 2, 1.9, 1.7, 1.4, 1.1, 0.85, 0.6];
tail = spline(tailC, 2);
tailR = lerpR(tailCR, 2);
translate([0, 0, -G]) {
  chain(tail, tailR, teal, $fn = 14);
  // Pale underside along the inside of the loop and round the spiral (the side towards the loop's centre).
  LC = F(10.8, 13.5, -1.4);
  for (i = [4 : 15]) let(p = tail[i], d = (LC - p) / norm(LC - p)) color(belly) hull() {
    translate(p + d * tailR[i] * 0.42) scale([tailR[i] * 0.66, tailR[i] * 0.66, tailR[i] * 0.66]) sphere(1, $fn = 10);
    translate(tail[i + 1] + d * tailR[i + 1] * 0.42) scale([tailR[i + 1] * 0.66, tailR[i + 1] * 0.66, tailR[i + 1] * 0.66]) sphere(1, $fn = 10);
  }
  SC = F(-15, 11, -1.8);
  for (i = [24 : 31]) let(p = tail[i], d = (SC - p) / max(norm(SC - p), 0.01)) color(belly) hull() {
    translate(p + d * tailR[i] * 0.4) sphere(tailR[i] * 0.66, $fn = 8);
    translate(tail[i + 1] + d * tailR[i + 1] * 0.4) sphere(tailR[i + 1] * 0.66, $fn = 8);
  }
  // Flush scales: lighter teal patches in staggered rows, cut to the tail's own surface grown a hair.
  color(scaleHi) intersection() { chain(tail, [for (r = tailR) r + 0.1], $fn = 14); union() for (i = [1 : len(tail) - 8]) let(d = tail[i + 1] - tail[i - 1], u = d / norm(d), a = cross(u, [0, 0, 1]), sd = a / max(norm(a), 0.01),
                                    up = cross(sd, u))
    for (k = (i % 2 == 0 ? [-80, -40, 0, 40, 80] : [-60, -20, 20, 60])) let(n = up * cos(k) + sd * sin(k))
      translate(tail[i] + n * tailR[i]) sphere(tailR[i] * 0.3, $fn = 6); }
  // Pale fins: inside the loop and in the spiral, in the picture plane.
  pp(-1.2) {
    plate([[7.4, 10.4], [8.6, 15.6], [10.6, 17.6], [11.6, 13.4], [11, 9.4], [9.4, 8.6]], 0.7, mint);
    plate([[-15.8, 9.4], [-16.2, 12.6], [-14.6, 13.6], [-13.4, 12.2], [-14, 10.2]], 0.6, lilac);
  }
}

// ---------- arms: the near one grips the coil, the far one has a fin flap
translate([0, 0, -G]) {
  chain([[2.6, -1.6, 19.4], [4.6, -3.2, 17.2], [5.8, -4, 19.4]], [1.4, 1.1, 1], teal);
  for (a = [-35, 0, 35]) spike([5.9 + sin(a) * 0.7, -4.6, 19.8], [sin(a) * 0.5, -0.6, 1.2], 0.32, 0.05, claw);
  chain([[-3.6, -1.2, 19.4], [-6.4, -2.4, 17], [-7.8, -4, 15.4]], [1.4, 1.1, 1], teal);
  for (a = [-35, 0, 35]) spike([-7.9 + sin(a) * 0.7, -4.6, 15], [sin(a) * 0.5, -1, -0.8], 0.32, 0.05, claw);
  color(mint) hull() { translate([-6.4, -2, 17.6]) sphere(0.3, $fn = 6); translate([-5.2, -1, 19.6]) sphere(0.25, $fn = 6); translate([-9.8, -1.6, 19.8]) sphere(0.2, $fn = 6); }
  limb([-6.4, -2, 17.6], [-9.8, -1.6, 19.8], 0.25, 0.12, tealDk);
}

// ---------- legs: strong thighs, digitigrade shins, three clawed toes; feet on sheet z 5 (the ground)
module leg(thigh, tr, knee, ankle, s) {
  ell(tr, thigh, teal);
  chain([thigh + [0, 0.4, -2], knee, ankle], [2, 1.5, 1.2], teal);
  for (a = [-30, 0, 30]) let(tip = ankle + [sin(a) * 1.8, -2.4, -1]) {
    limb(ankle, tip, 0.8, 0.5, teal);
    spike(tip, [sin(a) * 0.4, -1, -0.5], 0.42, 0.05, claw);
  }
  // a lilac fin flap at the back of the shin
  color(lilac) hull() { translate(knee + [0, 0.6, 0]) sphere(0.25, $fn = 6); translate(ankle + [0, 0.8, 0.6]) sphere(0.25, $fn = 6); translate(knee + [s * 1, 2.8, -1.6]) sphere(0.2, $fn = 6); }
}
translate([0, 0, -G]) {
  leg([3.8, 0.4, 12.4], [2.8, 3.4, 3], [4.6, 1.4, 9], [5, -0.6, 6.2], 1);
  leg([-3.8, -0.6, 11.8], [2.6, 3.2, 2.8], [-5.2, -1.2, 8.4], [-6, -2.2, 6.2], -1);
}

// ---------- water drops
translate([0, 0, -G]) for (d = [F(-15.8, 24, -3), F(-13.6, 21, -3), F(-14.6, 18.4, -3), F(14.2, 27.6, 0), F(15.4, 24.4, 0), F(17, 21.6, 0),
                                F(-2, 8.6, -6), F(16.4, 8.4, 0)])
  color(drop) translate(d) { sphere(0.75, $fn = 10); translate([0, 0, 0.35]) cylinder(h = 1.3, r1 = 0.7, r2 = 0, $fn = 10); }
