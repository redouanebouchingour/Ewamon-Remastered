// Dunescale: a chunky orange ankylosaur / armadillo on four short legs, drawn side-on with its face to the viewer's
// left. Checklist from the sheet (front x, z):
//   head  x -22..-2, z 17..37: a big pale-orange wedge, turned 20 deg to its right so it reads in profile
//   face  one big slanted almond eye at (-8.7, 26) (white, purple iris low at the front, thick ink upper lid),
//         a broad pale rhino horn on the nose (tip -22.6, 25.7), a mouth line z 18..21, a purple stripe over the eye
//         from the nose bridge (-16, 27) up to the frill (-5, 33), a rust cap of two plates on the crown (z 33..37)
//   frills purple fans with white streaks and a pale horn on the top edge, one each side behind the cheeks
//         (near x -4..4, z 21..37; far one pokes out at x -20..-15, z 26..39)
//   shell rust domed back of rounded plates (x 2..19, z 13..36), pointed plates along the spine
//   body  orange, pale oval patches on the thighs, a purple collar across the throat (x -12..-5, z 14..20)
//   legs  four short thick legs, purple band at z 4..8.5, three pale claws each
//   tail  short, from under the shell to the right, purple spike tip (x 19..22, z 10..14)
//   back  the shell's plates fill it; the tail swings out to the creature's +X (viewer's left from behind).
include <lib.scad>

skin = [0.86, 0.54, 0.18];
face = [0.95, 0.72, 0.33, NOGLOW];
pale = [0.96, 0.78, 0.4, NOGLOW];
horn = [0.97, 0.83, 0.5, NOGLOW];
shellC = [0.8, 0.44, 0.13];
shellB = [0.74, 0.39, 0.13];
shellDk = [0.56, 0.3, 0.13];
violet = [0.5, 0.26, 0.72, NOGLOW];
violetDk = [0.24, 0.12, 0.32];
streak = [0.97, 0.95, 1, NOGLOW];
claw = [0.96, 0.93, 0.86, NOGLOW];
ink = [0.17, 0.12, 0.14];

// ---- Head: authored in its own frame (origin at the head's centre, snout along -Y, near side +X), placed at HP and
// turned HR about Z towards the creature's right.
HP = [-1.5, -16.4, 26.5];
HR = -20;
HS = 1.12;
HEAD = [[[6.2, 6.5, 7], [0, 1, 1]], [[4.6, 5, 4.8], [0, -5, -2.5]], [[3.6, 3.5, 3.8], [0, -11, -4.6]]];
EYE = [5, -3, 0.6];

module headFrame() { translate(HP) rotate([0, 0, HR]) scale(HS) children(); }

// The eye, looking along -Y like lib.scad eye() (same sclera, so the rig's eyeKit lids fit): a big white almond with
// a small purple iris low at the front, a thick ink upper lid and a highlight on the iris.
module almondEye(s, flat = 0.45) {
  color([0.97, 0.96, 0.97, NOGLOW]) scale([1, flat, 1.15]) sphere(s, $fn = 20);
  color(ink) intersection() {
    scale([1.08, 0.9, 1.14]) sphere(s, $fn = 20);
    rotate([12, 0, 0]) translate([-3 * s, -3 * s, s * 0.55]) cube(6 * s);
  }
  color(ink) intersection() {
    scale([1.06, 0.88, 1.13]) sphere(s, $fn = 20);
    translate([-3 * s, -3 * s, -6 * s - s * 0.92]) cube(6 * s);
  }
  color(violet) translate([-0.26 * s, -0.3 * s, -0.3 * s]) scale([0.48, 0.2, 0.6]) sphere(s, $fn = 16);
  color(violetDk) translate([-0.28 * s, -0.42 * s, -0.33 * s]) scale([0.22, 0.12, 0.3]) sphere(s, $fn = 12);
  color("white") translate([-0.1 * s, -0.5 * s, -0.12 * s]) sphere(s * 0.14, $fn = 8);
}

module growBlob(parts, g) { hull() for (e = parts) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 28); }

// Frill fan, in its own plate frame (x outwards along the fan, z up, origin at the root inside the head).
FAN = [[-0.3, -4.5], [-0.6, 4.5], [5.6, 10.5], [7.5, 8.2], [10.2, 6.5], [9.2, 4.6], [10, 2.2], [9.5, 0.2], [7.8, -2.2], [3.8, -5]];
RIM = [[-1, 3.8], [-0.5, 5.2], [5.4, 10.8], [6.9, 12.6], [6.3, 10], [0.4, 4.2]];
module frill() {
  plate(FAN, 1.2, 0.4, violet);
  plate(RIM, 1.8, 0.3, pale, grow = 0.2);
  for (s = [[[1, 6.6], [8.6, 7.2], [8.6, 6.5], [1.2, 6]], [[1.5, 1.5], [9.2, 1.1], [9.2, 0.5], [1.6, 0.9]],
            [[2, 4], [7.4, 3.9], [7.4, 3.4], [2, 3.5]]])
    plate(s, 1.6, 0.15, streak, grow = 0.15);
}

headFrame() {
  // Head: a big wedge, crown at the back, the snout tapering forwards and down.
  blob(HEAD, face);
  // Purple stripe from the nose bridge over the eyes and back to the frills, laid flush on the head.
  color(violet) intersection() {
    growBlob(HEAD, 0.25);
    translate([0, -1, 5.6]) rotate([24, 0, 0]) cube([30, 18, 2.4], center = true);
  }
  // Rust crown: two rounded plates on top of the head, the back one rising to a blunt point.
  ell([4.8, 4.6, 2.4], [0, -3.6, 5.6], shellC);
  ell([5, 4.4, 2.8], [0, 2.6, 6.6], shellB);
  color(shellC) hull() { translate([0, 3.6, 9]) scale([1.8, 2.2, 1]) sphere(1, $fn = 12); translate([0, 6, 12]) sphere(0.5, $fn = 8); }
  // Broad pale rhino horn on the nose, pointing forwards and up.
  spike([0, -10.6, -2.4], [0, -4.6, 3.4], 3.1, 0.35, horn);
  // Mouth line along each side of the snout.
  mirror_x() color(ink) hull() {
    translate([2.6, -13, -5.3]) sphere(0.28, $fn = 6);
    translate([4.2, -6, -5.6]) sphere(0.28, $fn = 6);
  }
  mirror_x() color(ink) hull() {
    translate([4.2, -6, -5.6]) sphere(0.28, $fn = 6);
    translate([4.1, -2.4, -4.6]) sphere(0.28, $fn = 6);
  }
  // Eyes: big slanted almonds, white with a purple iris, a thick ink upper lid and a bright highlight.
  mirror_x() translate(EYE) rotate([0, 35, 50]) almondEye(3);
  // Frills behind the cheeks, spread sideways.
  mirror_x() translate([4.6, 3, 0.5]) rotate([0, 0, 12]) frill();
}

// Neck under the head.
limb([0, -11, 17], [-1.2, -15, 22], 5, 4.5, skin);

// ---- Body: a long barrel, the chest under the head.
BODY = [[[6.5, 5.5, 6], [0, -15, 14.5]], [[8, 9, 6], [0, -3, 14]], [[7.5, 8, 5.8], [0, 8, 13.5]], [[6, 5, 5], [0, 14, 13]]];
blob(BODY, skin);
// Pale chest under the jaw and the purple collar across the throat.
ell([4.6, 1.6, 4], [0, -19.6, 13.2], pale);
color(violet) intersection() {
  growBlob([BODY[0]], 0.35);
  translate([0, -15, 16.5]) rotate([37, 0, 0]) cube([30, 30, 2.6], center = true);
}

// ---- Shell: a dome of rounded rust plates on dark gaps, cut off above the flanks.
SC = [0, 3.5, 18];
SR = [10, 15.5, 15];
function sp(u, v) = SC + [SR[0] * sqrt(1 - u * u) * sin(v), SR[1] * u, SR[2] * sqrt(1 - u * u) * cos(v)];
function sn(u, v) = let(d = sp(u, v) - SC, n = [d[0] / (SR[0] * SR[0]), d[1] / (SR[1] * SR[1]), d[2] / (SR[2] * SR[2])]) n / norm(n);
color(shellDk) intersection() {
  translate(SC) scale(SR) sphere(1, $fn = 36);
  translate([0, 5, 13 + 50]) cube(100, center = true);
}
ROWS = [[34, [-0.74, -0.37, 0, 0.37, 0.74]], [66, [-0.55, -0.18, 0.18, 0.55, 0.86]], [98, [-0.74, -0.37, 0, 0.37, 0.74]]];
for (row = ROWS, si = [-1, 1], i = [0 : len(row[1]) - 1]) let(u = row[1][i], v = si * row[0], p = sp(u, v), n = sn(u, v),
    r = 4.3 * (1 - 0.25 * abs(u)))
  if (p[2] > 13.5) color((i + row[0]) % 2 == 0 ? shellC : shellB) translate(p - n * 0.5) rotate(_dir_rot(n))
    scale([r, r, 1.8]) sphere(1, $fn = 12);
// Rounded, blunt-pointed plates along the spine.
for (q = [[-0.62, 5], [-0.26, 4.6], [0.12, 3.8], [0.48, 3], [0.8, 2.2]]) let(p = sp(q[0], 0), n = sn(q[0], 0))
  color(shellC) hull() {
    translate(p - n * 0.6) scale([2.6, 3.1, 1.6]) sphere(1, $fn = 14);
    translate(p + n * q[1] + [0, 0.6, 0]) sphere(0.9, $fn = 10);
  }

// ---- Tail: short, swung out to the creature's left, with small plates and a purple spike tip.
TAIL = [[0, 13, 12.5], [2.5, 19, 10.8], [5.5, 24.5, 10], [8, 28.5, 10.4]];
chain(TAIL, [4.4, 3.5, 2.6, 1.8], skin);
for (p = [[1.4, 17.5, 14], [3.8, 22, 12.6], [6, 26, 11.8]]) ell([2.2, 2.6, 1.6] * (p[1] > 25 ? 0.75 : 1), p, shellC);
spike([8, 28.5, 10.4], [1.6, 2.6, 1.6], 1.9, 0.1, violet);
color(streak) translate([9, 30.1, 11.4]) rotate([0, 0, -30]) scale([0.3, 1.1, 0.35]) sphere(1, $fn = 8);

// ---- Legs: short and thick, a pale patch on each thigh, a purple band and three pale claws.
module leg(x, y, t) {
  ell([4.2, 4.6, 4.8] * t, [x, y, 11.5], skin);
  // pale oval patch on the outside of the thigh, laid flush
  color(pale) intersection() {
    ell([4.2, 4.6, 4.8] * t + [0.25, 0.25, 0.25], [x, y, 11.5]);
    translate([x + 4.4 * t, y, 12.4]) scale([3, 2.5 * t, 3.2 * t]) sphere(1, $fn = 20);
  }
  limb([x, y, 10], [x, y - 0.4, 3], 3.6, 3.3, skin);
  color(violet) translate([x, y - 0.3, 6.2]) cylinder(h = 2.8, r = 3.65, center = true, $fn = 22);
  ell([3.8, 4.3, 2], [x, y - 1, 2], skin);
  for (a = [-30, 0, 30]) spike([x + sin(a) * 2.5, y - 4.3, 1.2], [sin(a) * 0.5, -1.6, -0.5], 0.85, 0.1, claw);
}
mirror_x() { leg(7, -15, 1); leg(7, 11, 1.1); }
