// Mesadrake: dunescale's evolution, a long low crawling lizard drawn side-on with its big head to the viewer's left.
// Checklist from the sheet (front x, z; the 10 deg camera lifts parts further back, so scad z is lower behind):
//   head   x -28.4..-9, z 8.6..24: big and round, yellow face, a purple hood over the crown that wraps down round
//          both eyes, a yellow blaze from the snout up between the eyes to the crown
//   face   near eye (-15.6, 15.6) big round, white with a large dark purple iris, black pupil and highlights, purple
//          brow over it; far eye (-25.6, 17) half hidden at the head's edge; two nostril dots (-24 / -21, 11.7);
//          friendly closed smile at the chin
//   horns  two short pale-yellow cones on the crown: near (-13, 21.5 -> -12, 26.6), far (-24.5, 22 -> -25.8, 26.6)
//   mesa   three rust-red flat-topped buttes on the spine, vertical fissures, lighter top rims, a stepped ledge:
//          big over the shoulders x -15..1 top z 39.4, middle x 3..11.5 top z 35.6, small x 12.5..20 top z 31.8
//          sitting on the tail root
//   body   long, purple back, darker yellow belly and chest, the back line z 27 dropping into the tail
//   legs   four splayed crawling legs, yellow with purple shoulders, three pale claws each; near front foot
//          x -7..5 z 0..6, far front paw raised under the chin x -26..-15 z 3..8, near hind x 10..18 z 6..11
//   tail   long purple tail with a yellow underside, out to x 30.6 and curling down and back to its tip (21, 7.5)
//   back   the same buttes, the tail sweeping to the creature's +X; the far front paw raised. Dust swirls: not modelled.
include <lib.scad>

violet = [0.5, 0.3, 0.65];
violetDk = [0.36, 0.2, 0.44];
yellow = [0.92, 0.71, 0.28];
yellowDk = [0.8, 0.57, 0.24];
horn = [0.96, 0.8, 0.48, NOGLOW];
mesa = [0.79, 0.38, 0.17];
mesaDk = [0.6, 0.26, 0.12];
mesaCrack = [0.44, 0.22, 0.11];
mesaTop = [0.9, 0.5, 0.24];
claw = [0.98, 0.89, 0.71, NOGLOW];
ink = [0.16, 0.1, 0.1];
sclera = [0.97, 0.95, 0.93, NOGLOW];
iris = [0.24, 0.11, 0.28];
pupil = [0.07, 0.03, 0.08];

// ---- Body: one long hull, purple above, the belly and chest yellow below z 13.5.
BODY = [[[8, 7.5, 7.5], [-1.5, -22, 14.5]], [[10, 9.5, 10], [0, -13, 17]], [[9.5, 9, 9], [0, -1, 16]], [[9, 8.5, 8.5], [0.5, 11, 15.5]]];
module bodyHull(g = 0) { hull() for (e = BODY) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 30); }
color(violet) bodyHull();
color(yellowDk) intersection() { bodyHull(0.25); translate([-30, -40, -5]) cube([60, 80, 18.5]); }
// Crown hump behind the head, rising to the big butte's foot.
ell([7.5, 7, 7], [-2.5, -21, 19.5], violet);

// ---- Head: authored in its own frame (origin at the cranium's centre, snout along -Y), placed at HP.
HP = [-2.5, -29.5, 17.5];
HR = 0;
CRAN = [[9.5, 8, 8.6], [0, 0, 0.4]];
SNOUT = [[7, 6, 4.8], [0, -5.5, -3.4]];
EYE = [5.1, -7.1, -0.3];
EYE_S = 2.5;
EYE_YAW = 26;
module headFrame() { translate(HP) rotate([0, 0, HR]) children(); }
module headVol(g = 0) {
  hull() for (e = [CRAN, SNOUT]) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 32);
}
// The hood: the crown, a purple mask round each eye (wider above and behind it) and the band behind the eyes, minus
// the yellow blaze that runs up the front between the eyes.
module hoodRegion() {
  difference() {
    union() {
      translate([-20, -20, 4.4]) cube([40, 40, 20]);
      mirror_x() translate(EYE + [1.6, 1.6, 0.9]) scale([3.9, 4.6, 4.2]) sphere(1, $fn = 20);
      mirror_x() translate([4.6, -3, -1.6]) cube([20, 40, 8]);
    }
    hull() { translate([-2.7, -30, -6]) cube([5.4, 28, 0.1]); translate([-1.4, -30, 10]) cube([2.8, 28, 0.1]); }
  }
}
headFrame() {
  color(yellow) headVol();
  color(violet) intersection() { headVol(0.25); hoodRegion(); }
  // Horns: short pale cones on the crown, leaning out and back.
  mirror_x() spike([5.4, 0.2, 5], [1.5, 1.4, 5.4], 2.1, 0.2, horn);
  // Eyes: big round friendly eyes in the purple hood, dark purple irises with highlights.
  mirror_x() eye(EYE, EYE_S, flat = 0.55, iris = iris, pupil = pupil, sclera = sclera, yaw = EYE_YAW, shine = true);
  // A second, smaller highlight low on each iris.
  mirror_x() translate(EYE) rotate([0, 0, EYE_YAW]) color("white") translate([-EYE_S * 0.25, -EYE_S * 0.72, -EYE_S * 0.42]) sphere(EYE_S * 0.11, $fn = 8);
  // Nostrils on the snout's front.
  mirror_x() ell([0.55, 0.35, 0.45], [1.7, -11.3, -2.2], ink);
  // A small closed smile low on the snout.
  color(ink) for (s = [[[-3.2, -9.6, -5.4], [-1.4, -10.6, -6.1]], [[-1.4, -10.6, -6.1], [1.4, -10.6, -6.1]], [[1.4, -10.6, -6.1], [3.2, -9.6, -5.4]]])
    hull() { translate(s[0]) sphere(0.28, $fn = 6); translate(s[1]) sphere(0.28, $fn = 6); }
}
// Neck: fills the gap between the chest and the back of the head.
ell([7, 7, 6.8], [-2.2, -24, 15.5], violet);
color(yellowDk) intersection() { ell([7.25, 7.25, 7.05], [-2.2, -24, 15.5]); translate([-30, -40, -5]) cube([60, 80, 18.5]); }

// ---- Legs: splayed crawling legs, yellow shoulders, arms and feet, three pale claws.
module foot(p, ry = 0) {
  translate(p) rotate([ry, 0, 0]) {
    ell([3.8, 4.4, 2], [0, 0, 0.2], yellow);
    for (a = [-30, 0, 30]) spike([sin(a) * 2.6, -3.2, -0.1], [sin(a) * 0.8, -2.2, -0.6], 0.95, 0.1, claw);
  }
}
// near front (+X): yellow shoulder under the purple back, elbow splayed out, a purple ridge down the back of the forearm
ell([5, 5.4, 5.4], [7.5, -15.5, 15], yellow);
limb([7.5, -15.5, 15], [12, -17, 8], 4.4, 3.9, yellow);
limb([12, -17, 8], [11, -19.5, 2.8], 3.7, 3, yellow);
limb([13.2, -14.6, 9], [12.4, -16.6, 3.4], 2.6, 1.9, violet);
foot([11, -21, 1.6]);
// far front (-X): the paw raised under the chin
ell([5, 5.4, 5.4], [-7.5, -16.5, 15], yellow);
limb([-7.5, -16.5, 15], [-12, -20, 9], 4.1, 3.6, yellow);
limb([-12, -20, 9], [-11, -24, 5], 3.4, 2.8, yellow);
foot([-11, -25.5, 3.8], -12);
// hind legs: yellow thighs under the purple back
mirror_x() {
  ell([5.4, 6, 6], [7.5, 10, 13.5], yellow);
  limb([7.5, 10, 13.5], [12, 7, 8], 4.2, 3.6, yellow);
  limb([12, 7, 8], [11.5, 8.6, 2.6], 3.3, 2.7, yellow);
  foot([11.5, 7, 1.6]);
}

// ---- Tail: long, purple with a yellow underside, out to the creature's +X and curling back to a tip on the ground.
TAIL = [[0, 14, 15], [2.5, 24, 14.5], [7.5, 31, 12], [13.5, 35, 8.5], [16.5, 32, 5], [14.5, 26, 3], [11.5, 21.5, 2.2]];
TAIL_R = [7, 5.8, 4.6, 3.4, 2.5, 1.7, 0.7];
chain(TAIL, TAIL_R, violet);
chain([for (i = [0 : 3]) TAIL[i] + [0, 0, -1.3]], [for (i = [0 : 3]) TAIL_R[i] * 0.88], yellowDk);

// ---- Mesa: rust buttes with flat tops, a lighter top rim, a stepped ledge and dark vertical fissures.
module butte(p, r, h, ledge = 0.72) {
  translate(p) {
    color(mesa) cylinder(h = h * ledge, r1 = r * 1.08, r2 = r, $fn = 28);
    color(mesaDk) translate([0, 0, h * ledge]) cylinder(h = 0.35, r = r * 0.98, $fn = 28);
    color(mesa) translate([0, 1, h * ledge]) cylinder(h = h * (1 - ledge) - 0.5, r1 = r * 0.92, r2 = r * 0.88, $fn = 28);
    color(mesaTop) translate([0, 1, h - 0.5]) cylinder(h = 0.5, r1 = r * 0.88, r2 = r * 0.8, $fn = 28);
    // Fissures down the sides.
    color(mesaCrack) for (a = [0 : 40 : 359]) rotate([0, 0, a + 7])
      translate([r * 0.99, 0, h * (0.08 + 0.1 * sin(a * 3))]) scale([0.3, 0.38, 1]) cylinder(h = h * (0.5 + 0.15 * cos(a * 2)), r = 1, $fn = 4);
  }
}
butte([-0.3, -13.5, 24], 8.6, 13);
butte([0.8, 12.5, 20.5], 5.2, 10);
butte([3.5, 26, 17.5], 4.2, 8.5);
// Boulders where the big butte meets the back.
ell([3.4, 3, 3.2], [6.4, -10, 25], mesa);
ell([2.6, 2.4, 2.4], [-6.4, -16, 24.5], mesaDk);
