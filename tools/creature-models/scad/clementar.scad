// Clementar: a tan fennec elder in a long hooded olive-plaid djellaba, a maroon fez with a green star between two tall
// orange-and-cream-banded ears, two sly half-lidded eyes, and a cluster of three leafy oranges held up on each
// open hand. A big bushy tail sweeps out along the ground behind it and curls up at the tip.
//
// Checklist (sheet frame: height 40, feet z = 0, x = art centre; sheet x = 0.866 x + 0.5 y at the 30 deg camera):
//   head      light tan [0.82, 0.68, 0.38] wide fox head x -7.8..7.4, z 25.6..33.6; widest at the ear bases (z 31..33),
//             tapering to the chin at (-4, 25.6); cream [0.94, 0.82, 0.58] lower face x -7.5..-0.7, z 25.6..29.5
//   snout     short, the dark maroon nose at sheet (-4.6, 27.5); a smiling mouth line (-3.2, 26.5) -> (-1, 27.4)
//   eyes      two sly half-lidded almonds, orange iris, dark lid: near (-2.6..0.1, 29..30.1) with a highlight, far
//             (-6.6..-4.5, 29..30.2) darker, its inner corner behind the muzzle bridge (a full eye on the model)
//   ears      two tall plates: far (left) x -10.5..-4.4, z 30.2..39.9; near (right) x 1..9.2, z 30.8..39.9; each an
//             orange [0.93, 0.47, 0.06] band on the outer side, a cream band and a green line on the inner side, a
//             tan rim; backs darker tan. Big and wide, splayed in a V, facing forward and a little outward
//   fez       maroon [0.47, 0.13, 0.13] truncated cone x -4.6..0.7, z 32.7..37.6 (worn forward), green star at (-2.8, 35)
//   robe      olive M2 [0.27, 0.23, 0.13] djellaba with dark [0.18, 0.14, 0.08] plaid lines: hem x -8.8..4.8 at z 5,
//             waist x -7.6..5 at z 15.5, shoulders x -8..6.3 at z 24.5, the hood rising behind the head to (3.8, 28.2);
//             its dark lining shows at x 1..5.8, z 22.3..27.8; tan chest fur in the V x -5.8..1, z 22.3..28;
//             cream front trim x -4.7..-3.1, z 17.4..22.6
//   sash      woven gold [0.82, 0.68, 0.38] / red [0.47, 0.13, 0.13] / olive band z 14.5..17; its fringed end hangs
//             down-left from (-7.6, 15.8) to (-14.4, 11) and (-12, 7.6)
//   sleeves   wide, draped: far from the shoulder (-8, 24.5) to the wrist (-12, 20) and the drape corner (-13.4, 15.2);
//             near from (6.3, 23.5) to the wrist (10.8, 19.5) and the corner (9, 15.1); undersides dark
//   hands     tan, open palms up under the fruit: far x -17..-11.6, z 17.5..21.3; near x 9.6..14, z 18.7..21.1
//   oranges   r 1.7, painted (the sheet's GLOWS is only brightness; a small highlight glows): near (10.3, 26.2), (7.8, 22.9), (12, 23.6); far (-13.9, 25.6), (-16.6, 23), (-12.9, 22.3);
//             green leaves between them (not in the sheet palette, ~[0.30, 0.52, 0.22])
//   tail      light tan pillow along the ground to the right, x 3.2..19.6, z 4.1..19.5, curling up to a tip at (17, 19.5)
//   feet      tan: far foot x -9.6..-4.8 (toes out to the left), near foot x 2.4..5.8 (toes towards the camera), z 0..4.9
//   back      plaid robe, the hood's outside, the sash and its end on the creature's right, the tail on its left,
//             the ears tan from behind, the fez; the ground shadow in the art is not modelled
include <lib.scad>

tan = [0.82, 0.68, 0.38];
tanDk = [0.65, 0.49, 0.28];
cream = [0.94, 0.82, 0.58];
orange = [0.93, 0.47, 0.06, NOGLOW];    // the sheet lists #ed790e as GLOWS for its brightness; the fruit is not a light
orangeHi = [0.98, 0.62, 0.16, GLOW];    // the fruit's small highlight (the sprite's glow mask is these spots)
orangeEar = [0.93, 0.47, 0.06, NOGLOW];
olive = [0.30, 0.27, 0.15];
oliveLt = [0.38, 0.37, 0.21];
dark = [0.18, 0.14, 0.08];
ink = [0.10, 0.04, 0.02];
maroon = [0.47, 0.13, 0.13];
maroonDk = [0.34, 0.13, 0.08];
gold = [0.82, 0.68, 0.38];
leaf = [0.30, 0.43, 0.20, NOGLOW];
iris = [0.86, 0.52, 0.22, NOGLOW];
eyeDk = [0.30, 0.17, 0.07];
noseC = [0.30, 0.17, 0.15];
star = [0.22, 0.52, 0.27, NOGLOW];

// The half-space in front of depth d0 (pp frame): a marking cut with it only shows on the camera-facing surface.
module front(d0 = 0) { pp(0) translate([-60, d0 - 120, -60]) cube(120); }
// Lay the children (a body part grown a little) flush on the surface where the camera sees the sheet outline pts.
module mark(pts, d0 = 0) { intersection() { union() children(); prism(pts); front(d0); } }

// ---- robe: a long djellaba, a hull of flattened ellipsoids cut to the sheet outline
robePts = [[-8.8, 5.0], [-2, 4.7], [4.8, 4.9], [5.8, 7], [5.6, 12], [5.2, 15], [5.5, 18], [6.0, 21], [6.3, 23.5],
           [5.3, 26.2], [3.8, 28.2], [2.0, 29.0], [-2.0, 29.0], [-5.5, 28.0], [-7.0, 26.8], [-8.0, 24.6],
           [-8.3, 20], [-7.8, 17], [-7.6, 15.5], [-8.2, 12], [-8.5, 8]];
module robeHull(g = 0) {
  hull() {
    translate([0, -0.4, 4.8]) scale([9.2 + g, 7.2 + g, 1.2]) sphere(1, $fn = 26);
    translate([0, -0.2, 10]) scale([8.0 + g, 6.4 + g, 1.2]) sphere(1, $fn = 26);
    translate([0, 0, 15.5]) scale([7.4 + g, 5.8 + g, 1.2]) sphere(1, $fn = 26);
    translate([0, 0, 21.5]) scale([7.4 + g, 5.8 + g, 1.5]) sphere(1, $fn = 26);
    translate([0, 0.3, 24.5]) scale([7.0 + g, 5.4 + g, 1.5]) sphere(1, $fn = 26);
    translate([0, 2.2, 28]) scale([4.5 + g, 3.6 + g, 1.4]) sphere(1, $fn = 22);
  }
}
module robeCut(g = 0) { intersection() { robeHull(g); prism(robePts); } }
color(olive) robeCut();
// plaid: dark rings and radial lines, lighter bands between the rings
color(dark) intersection() {
  robeCut(0.25);
  union() {
    for (z = [7, 10, 13, 19.5, 22.5]) translate([-30, -30, z - 0.2]) cube([60, 60, 0.4]);
    for (a = [0 : 30 : 330]) rotate([0, 0, a]) translate([-0.2, 0, 3]) cube([0.4, 30, 23]);
  }
}
color(oliveLt) intersection() {
  robeCut(0.2);
  union() for (z = [8.5, 11.5, 21]) translate([-30, -30, z - 0.35]) cube([60, 60, 0.7]);
}
// the hood's dark lining, open behind the neck on the creature's left
hoodInPts = [[-3.2, 22.3], [1.0, 26.3], [2.5, 27.9], [4.5, 27.4], [5.9, 25.5], [5.9, 23.4], [4.2, 22.2], [1.5, 23.4],
             [-2.0, 21.6]];
color(dark) mark(hoodInPts) robeHull(0.4);
// tan chest fur in the V of the collar, with the neck behind it
chestPts = [[-5.2, 27.3], [-3.2, 22.6], [0.6, 26.2], [-1.2, 27.7]];
color(tan) mark(chestPts) robeHull(0.5);
ell([2.4, 1.5, 2.4], [0, -4.2, 24.8], tan);
// cream trim down the front opening
trimPts = [[-4.7, 22.7], [-3.1, 22.7], [-3.1, 17.3], [-4.7, 17.3]];
color(cream) mark(trimPts) robeHull(0.55);
color(dark) mark([[-4.1, 22.7], [-3.7, 22.7], [-3.7, 17.3], [-4.1, 17.3]]) robeHull(0.7);
// the woven sash: a gold band with a red stripe and olive checks
color(gold) intersection() { robeCut(0.5); translate([-30, -30, 14.5]) cube([60, 60, 2.5]); }
color(maroon) intersection() { robeCut(0.7); translate([-30, -30, 15.3]) cube([60, 60, 1.0]); }
color(olive) intersection() {
  robeCut(0.85);
  translate([-30, -30, 15.3]) cube([60, 60, 1.0]);
  union() for (a = [0 : 36 : 359]) rotate([0, 0, a]) translate([-0.5, 0, 0]) cube([1.0, 30, 40]);
}
// the sash's fringed end hanging down the creature's right side
sashEndPts = [[-7.6, 16.0], [-9.6, 13.8], [-12.2, 12.2], [-14.4, 11.1], [-14.2, 10.2], [-12.4, 9.5], [-12.1, 7.6],
              [-11.0, 7.6], [-10.6, 9.4], [-9.0, 11.2], [-7.4, 13.2]];
pp(3.2) {
  plate(sashEndPts, 1.2, 0.3, [0.71, 0.37, 0.14]);
  translate([0, -0.25, 0]) plate([[-8.6, 14.9], [-10.6, 12.8], [-11.9, 12.0], [-12.1, 11.3], [-10.3, 12.0], [-8.2, 14.4]], 1.2, 0.2, gold);
  translate([0, -0.25, 0]) plate([[-11.2, 10.4], [-13.4, 10.6], [-13.5, 10.0], [-11.4, 9.7]], 1.2, 0.15, olive);
}

// ---- sleeves: wide draped djellaba sleeves on arms held out sideways, palms up
module sleeveHull(g = 0) {
  hull() {
    translate([6.2, -1.2, 23.0]) sphere(2.7 + g, $fn = 20);
    translate([12.3, -2.8, 19.6]) sphere(2.2 + g, $fn = 20);
    translate([13.0, -2.4, 15.9]) sphere(1.0 + g, $fn = 12);
    translate([5.8, -1.0, 16.1]) sphere(1.0 + g, $fn = 12);
  }
}
module sleeve() {
  color(olive) sleeveHull();
  // plaid: light bands along the sleeve and dark lines across it
  color(oliveLt) intersection() { sleeveHull(0.15); union() for (z = [18.0, 21.6]) translate([0, -20, z - 0.45]) cube([30, 40, 0.9]); }
  color(dark) intersection() { sleeveHull(0.2); union() for (x = [8.2, 10.8]) translate([x - 0.2, -20, 10]) cube([0.4, 40, 20]); }
  color(dark) hull() {
    translate([13.0, -2.6, 15.8]) sphere(1.05, $fn = 12);
    translate([5.8, -1.2, 16.0]) sphere(1.05, $fn = 12);
    translate([9.8, -2.6, 17.4]) sphere(1.3, $fn = 12);
  }
}
// ---- hands: open palms holding the fruit from below, a thumb up at the inner side
module hand() {
  color(tan) hull() {
    translate([14.0, -4.8, 19.5]) scale([2.3, 2.0, 1.3]) sphere(1, $fn = 18);
    translate([16.6, -5.4, 19.8]) sphere(1.1, $fn = 12);
  }
  limb([13.4, -5.0, 20.2], [12.0, -6.2, 21.8], 0.7, 0.55, tan);   // thumb
  for (p = [[17.0, -5.0, 21.2], [16.2, -7.0, 20.9], [14.6, -7.4, 20.7]]) limb([15.0, -5.4, 20.0], p, 0.7, 0.55, tan);
}


// ---- oranges: three per hand with leaves, resting on the palm (placed off the near cluster's sheet positions). The
// fruit is bright paint, not a light: only a small highlight on each orange glows, like the sprite's glow mask.
module orangeAt(r, p) {
  color(orange) translate(p) scale(r) sphere(1, $fn = 20);
  color(orangeHi) translate(p + [r[0] * 0.25, -r[1] * 0.72, r[2] * 0.55]) scale(r * 0.28) sphere(1, $fn = 8);
}
module leafAt(r, p, rot) { color(leaf) translate(p) rotate(rot) scale(r) sphere(1, $fn = 10); }
module cluster() {
  orangeAt([2.2, 2.0, 1.95], fromSheet(10.2, 25.5, -4.6));
  orangeAt([2.2, 2.0, 1.9], fromSheet(8.0, 22.6, -4.8));
  orangeAt([2.4, 2.1, 1.95], fromSheet(12.4, 23.2, -5.4));
  // leaves: a pair at the top-right, one at the top-left, one low on the right (small, dark green)
  leafAt([1.4, 0.4, 0.6], fromSheet(12.6, 28.4, -4.4), [0, -30, 30]);
  leafAt([1.1, 0.4, 0.55], fromSheet(14.2, 24.6, -4.6), [0, 40, 20]);
  leafAt([1.0, 0.35, 0.5], fromSheet(6.6, 25.3, -4.6), [0, -25, 30]);
  leafAt([0.7, 0.3, 0.4], fromSheet(10.0, 28.0, -4.6), [0, 60, 30]);
}
// the far arm reads about two units further out in the art than a mirror of the near one
for (s = [1, -1]) mirror([s < 0 ? 1 : 0, 0, 0]) translate([s < 0 ? 1.8 : 0, 0, 0]) { sleeve(); hand(); cluster(); }

// ---- head: a wide fennec face. A broad skull, cream cheek ruffs flaring out below the eyes, a short broad muzzle
// with a small dark nose (it stays inside the face's outline in the art), a cream lower face and a smug closed smile.
SKULL = [[0, -2.6, 30.2], [5.2, 4.3, 3.3]];
JAW = [[0, -4.6, 27.3], [2.9, 2.8, 2.1]];
RUFF = [[3.5, -3.8, 28.3], [1.8, 1.7, 1.45]];
MUZ1 = [[0, -5.7, 28.4], [2.4, 2.3, 2.1]];
MUZ2 = [[0, -8.8, 27.9], [1.2, 1.1, 1.0]];
NOSE = [[0, -9.8, 28.2], [0.75, 0.6, 0.55]];
module skull(g = 0) {
  hull() {
    translate(SKULL[0]) scale(SKULL[1] + [g, g, g]) sphere(1, $fn = 28);
    translate(JAW[0]) scale(JAW[1] + [g, g, g]) sphere(1, $fn = 22);
  }
}
module muzzle(g = 0) {
  hull() {
    translate(MUZ1[0]) scale(MUZ1[1] + [g, g, g]) sphere(1, $fn = 20);
    translate(MUZ2[0]) scale(MUZ2[1] + [g, g, g]) sphere(1, $fn = 14);
  }
}
module ruffs(g = 0) { mirror_x() translate(RUFF[0]) scale(RUFF[1] + [g, g, g]) sphere(1, $fn = 24); }
color(tan) skull();
color(tan) muzzle();
color(tan) ruffs();
// the cream lower face: everything under the eye line, cut to the art's shape, on the camera-facing side
creamPts = [[-9, 29.0], [-6.5, 28.9], [-4.6, 28.9], [-3.3, 28.6], [-2.4, 28.7], [-0.6, 28.8], [1.2, 28.8],
            [3.0, 29.1], [5.5, 29.3], [5.5, 24], [-9, 24]];
color(cream) mark(creamPts, -3.0) { skull(0.25); muzzle(0.25); ruffs(0.25); }
// the muzzle's top stays tan from the nose up to the brow
bridgePts = [[-5.8, 28.2], [-4.6, 28.9], [-3.3, 29.6], [-2.2, 29.4], [-2.6, 28.6], [-3.6, 28.0], [-5.2, 27.7]];
color(tan) mark(bridgePts, -4.0) muzzle(0.45);
ell(NOSE[1], NOSE[0], noseC);
// the smile: a dark line from under the nose along the jaw, curling up at the near cheek
mouthPts = [[-4.6, 26.95], [-3.4, 26.45], [-2.3, 26.6], [-1.6, 27.1], [-1.35, 27.55], [-1.6, 27.55], [-2.0, 27.0],
            [-2.6, 26.85], [-3.4, 26.75], [-4.5, 27.2]];
color(ink) mark(mouthPts, -5) { muzzle(0.4); skull(0.35); }
// eyes: two sly half-lidded eyes with orange irises, a dark upper lid and a little lower lid, a highlight under the lid
EYE = [2.4, -6.3, 30.3];
EYE_S = 1.05;
EYE_YAW = 24;
EYE_SQ = [1.3, 1, 0.62];   // the eyes are wide almonds: the eye() squashed about its centre
mirror_x() translate(EYE) scale(EYE_SQ) translate(-EYE) {
  eye(EYE, EYE_S, iris = iris, sclera = eyeDk, yaw = EYE_YAW, pupil = ink, flat = 0.5, lid = 0.4, lid_tilt = 6,
      lid_c = dark, squint = 0.14, slit = 0.75);
  translate(EYE) rotate([0, 0, EYE_YAW]) color("white") translate([EYE_S * 0.3, -EYE_S * 0.84, -EYE_S * 0.12]) sphere(EYE_S * 0.17, $fn = 8);
}

// ---- ears: huge, wide, splayed out in a V. Each is a plate standing on the head's top side, facing forward and a
// little outward; the front has a tan rim, an orange inner band on the outer side, a cream band and a green line on
// the inner side; the back is darker tan with a lighter middle. Outline (x outward from the root, z up), from the
// near ear on the sheet: the outer edge nearly vertical, the inner edge leaning out to the tip.
EAR_AT = [6.0, -2.5, 31.3];
EAR_ROT = [-6, 13, 16];
earPts = [[-4.0, 1.4], [-3.6, 2.6], [-2.9, 4.0], [-0.5, 6.0], [1.4, 7.7], [2.6, 8.9], [3.6, 9.3], [4.5, 8.8], [4.7, 6.0], [4.4, 3.2],
          [3.4, 1.2], [1.6, -0.4], [-0.4, -0.9], [-2.6, -0.3]];
earOrangePts = [[1.0, 0.4], [2.3, 0.7], [3.4, 2.0], [4.0, 4.0], [4.0, 6.5], [3.7, 8.3], [3.1, 8.3], [2.4, 7.0],
                [1.6, 5.5], [1.0, 3.5]];
earCreamPts = [[-0.9, 0.3], [1.0, 0.4], [1.0, 3.5], [1.6, 5.5], [2.4, 7.0], [2.9, 8.1], [1.9, 7.3], [0.5, 6.0],
               [-0.7, 4.8], [-1.3, 3.2], [-1.4, 1.5]];
earGreenPts = [[-1.8, 1.4], [-1.45, 1.4], [-1.25, 3.2], [-0.6, 4.6], [0.6, 5.8], [1.6, 6.8], [1.4, 7.0], [0.4, 6.2],
               [-0.9, 5.0], [-1.6, 3.4]];
earBackPts = [[-1.8, 1.2], [-1.4, 3.6], [0.3, 5.2], [2.0, 6.8], [3.4, 7.4], [3.6, 5.5], [3.4, 3.0], [2.6, 1.4], [0.6, 0.6]];
module ear() {
  plate(earPts, 1.0, 0.35, tan, grow = 0);
  translate([0, -0.42, 0]) plate(earOrangePts, 0.3, 0.3, orangeEar, grow = 0);
  translate([0, -0.42, 0]) plate(earCreamPts, 0.3, 0.3, cream, grow = 0);
  translate([0, -0.5, 0]) plate(earGreenPts, 0.3, 0.1, leaf, grow = 0);
  translate([0, 0.42, 0]) plate(earBackPts, 0.3, 0.4, tanDk, grow = 0);
}
mirror_x() translate(EAR_AT) rotate(EAR_ROT) ear();

// ---- fez: a maroon flat-topped cone worn on the crown between the ears, a dark band at the base, a dark tassel cord
// down its near side, and the green five-point star outline (a pentagram of lines, its middle open) on the front.
FEZ = [0, -3.4, 32.2];
module fez(g = 0) { translate(FEZ) cylinder(h = 5.4, r1 = 2.85 + g, r2 = 2.5 + g, $fn = 28); }
color(maroon) fez();
color(maroonDk) translate(FEZ) cylinder(h = 0.6, r = 2.95, $fn = 28);
color(maroonDk) translate(FEZ + [0, 0, 5.35]) cylinder(h = 0.15, r = 2.4, $fn = 28);
limb(FEZ + [0, 0, 5.55], FEZ + [2.0, 0.5, 5.3], 0.22, 0.22, ink);
limb(FEZ + [2.0, 0.5, 5.3], FEZ + [2.75, 0.3, 2.6], 0.22, 0.32, ink);
STAR_C = [-2.6, 35.0];
STAR_R = 1.45;
function starP(i) = STAR_C + STAR_R * [cos(90 + 72 * i), sin(90 + 72 * i)];
module bar(a, b, w) {
  d = b - a;
  n = [-d[1], d[0]] / norm(d) * w / 2;
  prism([a + n, b + n, b - n, a - n]);
}
color(star) intersection() {
  fez(0.12);
  union() for (i = [0 : 4]) bar(starP(i), starP(i + 2), 0.36);
  front(-3.0);
}

// ---- feet and ankles: the creature's right foot stepped out and turned outward, the left pointing at the camera
module foot(ankle, toe) {
  color(tan) hull() {
    translate(ankle + [0, 0, 2.4]) sphere(1.5, $fn = 14);
    translate(toe + [0, 0, 1.2]) scale([1.4, 1.2, 1.0]) sphere(1, $fn = 14);
  }
  d = toe - ankle;
  side = [-d[1], d[0], 0] / norm([d[0], d[1], 0]);
  for (s = [-1, 0, 1]) color(tan) translate(toe + side * s * 1.0 + [0, 0, 0.75]) sphere(0.75, $fn = 10);
  limb(ankle + [0, 0, 2.6], ankle + [0, 0, 7], 1.4, 1.4, tan);
}
foot([-5.2, -3.6, 0], [-7.4, -7.4, 0]);
foot([4.8, -1.6, 0], [7.2, -5.8, 0]);

// ---- tail: a big bushy pale tail behind the creature's left side. It leaves the robe at the hip, sweeps down and
// right along the ground and curls up to a tip that flicks out to the right. A smooth chain of round segments on
// the art's spine (sheet x, sheet z, depth behind the picture plane, radius), 1.3 low for the camera's downward look.
TAIL = [[4.8, 11.6, 4.8, 3.2], [7.9, 9.2, 6.4, 4.2], [11.4, 8.7, 7.4, 4.7], [14.4, 10.6, 7.8, 4.3],
        [15.3, 13.9, 7.8, 3.6], [16.4, 16.8, 7.6, 2.7], [17.6, 18.7, 7.4, 1.7], [19.1, 19.2, 7.2, 0.7]];
function tailP(t) = fromSheet(t[0], t[1] - 1.3, t[2]);
module tailBody(g = 0) {
  for (i = [0 : len(TAIL) - 2]) hull() for (j = [i, i + 1])
    translate(tailP(TAIL[j])) scale([1, 0.9, 1]) sphere(TAIL[j][3] + g, $fn = 18);
}
color(tan) tailBody();
// the darker fold where the curl turns up over the lower sweep
foldPts = [[11.2, 13.4], [11.9, 13.6], [13.2, 12.3], [14.0, 11.0], [13.5, 10.9], [12.4, 12.2]];
color(tanDk) intersection() { tailBody(0.2); translate([0, 0, -1.3]) prism(foldPts); front(7.0); }
