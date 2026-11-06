// Rivetalon: a steel raptor in a forward-leaning hunting crouch, drawn three-quarter facing left. Dark slate body and
// head, a gold breastplate band round the chest (the back art shows its back half as a chevron plate), a white steel
// pauldron on each wing root, steel thigh plates, steel-cuffed feet with long silver talons. Huge wings of long blade
// feathers spread wide and raised (the near one swept back, the far one forward behind the head), short cyan-tipped
// secondaries under them, a crown of silver blades sweeping back from the brow, a small fierce cyan eye under a steel
// brow, a gold hooked beak (the back art) under a steel visor point, and a long fan of blade tail feathers swung out to
// its left, tipped cyan.
//
// Checklist (front sheet, x = sheet x, z):
//   head: dark, x -14..-6.5, z 23..30; eye (-10.3, 28.7) cyan, ~0.9 wide, white glint, under a steel brow
//   visor point (light steel) (-15.4, 25.8) -> over the eye; beak gold, hooked (back art (3.5, 30))
//   crest: silver blades from the head top (-12.5, 29) to (-11.4, 34), (-7.5, 36.6), (-3.8, 34.7), (-2.2, 32.6), (-3, 30.6)
//   gold band: front x -13.7..-6, z 16..24 (2 rows of plates); back x -6.7..1, z 20.7..29 (chevron top)
//   near pauldron (white steel) x -6.7..3, z 21..28
//   near wing: primaries to (22.9, 39.9), (24.2, 32.7), (20, 26.1), (14.5, 21); coverts to (8.4, 30.9), (13.5, 35.1)
//   far wing (behind the head): blades to (-23, 39.5), (-24.2, 32.6), (-17.4, 37.2), (-14.7, 34.3), dark (-19, 27.2)
//   tail: blades from the rump (4, 14) to (16.7, 16.2), (19.6, 10.1), (10.8, 9.2); back art: long, down to the
//     ground at the creature's left, cyan tips
//   thigh plates (steel) near (-1..4, 9..17), far (-12..-8, 10..14)
//   near leg: hip (1.5, 11) -> ankle (5, 4.5), talons to (5, 0), (8.2, 1.4), (3, 1.8)
//   far leg stepped forward: (-6, 11) -> foot (-11, 7) and talons to (-17.5, 5.5): the art draws that foot 5 higher
//     (further back on the drawn ground); here both feet stand on z = 0.
//   back art: wings spread wide with cyan tips on the lower secondaries; gold trim along the wing roots.
// The art is turned: the bird's axis is turned T degrees towards its right (as Alloylark). S(s, z, w) is the local
// point that lands on sheet (s, z) at lateral offset w (+w = the creature's left, the near side).
include <lib.scad>

T = 20;
KA = sin(30 + T);   // sheet units per unit along the axis
KW = cos(30 + T);   // sheet units per unit of lateral offset
function S(s, z, w = 0) = let(y = (s - KW * w) / KA) [w, y, z - 0.17 * (-0.82 * w + 0.57 * y)];

dark = [0.2, 0.2, 0.31];
darkLt = [0.28, 0.28, 0.42];
steelDk = [0.42, 0.43, 0.6];
steel = [0.52, 0.53, 0.7];
steelLt = [0.67, 0.68, 0.81];
white = [0.82, 0.82, 0.9];
gold = [0.84, 0.6, 0.2, NOGLOW];
goldDk = [0.55, 0.36, 0.08];
cyan = [0.22, 0.84, 0.86, NOGLOW];
ink = [0.08, 0.07, 0.14];
COLS = [steelDk, steel, steelLt, dark, darkLt];

// A flat blade feather from a to b (local points), half-width w at 45 %, half-thickness th, its flat face turned
// `roll` degrees about its own axis; an optional coloured tip.
module blade(a, b, w, c, roll = 0, th = 0.5, tipc = undef, tipl = 0.2) {
  d = b - a;
  l = norm(d);
  translate(a) rotate(_dir_rot(d)) rotate([0, 0, roll]) {
    color(c) hull() {
      scale([w * 0.7, th, 0.6]) sphere(1, $fn = 10);
      translate([0, 0, l * 0.45]) scale([w, th, l * 0.08]) sphere(1, $fn = 12);
      translate([w * 0.2, 0, l * 0.82]) scale([w * 0.5, th * 0.9, l * 0.05]) sphere(1, $fn = 10);
      translate([0, 0, l]) sphere(0.15, $fn = 4);
    }
    if (tipc != undef) color(tipc) hull() {
      translate([0, 0, l * (1 - tipl)]) scale([w * 0.62, th * 1.15, 0.4]) sphere(1, $fn = 10);
      translate([0, 0, l * 1.01]) sphere(0.16, $fn = 4);
    }
  }
}

// Wing blades: [root, tip, half-width, colour index, cyan tip]. Near (left, +w) wing swept back, far one forward.
NEAR = [
  // primaries
  [S(4.5, 28, 7), S(22.9, 39.9, 24), 2.7, 2, false],
  [S(5.5, 26.5, 7.5), S(24.2, 32.7, 25), 2.7, 1, false],
  [S(5.5, 24.5, 7.5), S(20, 26.1, 22), 2.5, 2, false],
  [S(4.5, 23, 7), S(14.5, 21, 17), 2.0, 0, false],
  [S(5, 27, 7.5), S(18.5, 33.5, 19), 2.4, 0, false],
  [S(5.5, 25.5, 7.5), S(18, 28.5, 19), 2.4, 2, false],
  [S(5, 24, 7.5), S(14, 24.5, 15), 2.2, 1, false],
  // coverts
  [S(-0.5, 25.5, 5.5), S(8.4, 30.9, 10), 1.8, 2, false],
  [S(2.5, 27, 6.5), S(13.5, 35.1, 13), 2.0, 0, false],
  [S(3, 25.5, 6.5), S(15.5, 30, 16), 1.9, 1, false],
  [S(3, 24.5, 6.5), S(11, 27.5, 12), 1.9, 2, false],
  [S(2.5, 23.5, 6), S(9, 24.5, 10.5), 1.7, 0, false],
  // short secondaries hanging under the wing, cyan tips (the back art)
  [S(3, 22.5, 6.5), S(8.5, 17.5, 11), 1.3, 0, true],
  [S(4, 23, 7), S(12, 18.5, 14), 1.4, 1, true],
];
FAR = [
  [S(-4, 27.5, -7), S(-23, 39.5, -24), 2.7, 2, false],
  [S(-5, 26, -7.5), S(-24.2, 32.6, -25), 2.7, 1, false],
  [S(-4, 27, -6.5), S(-17.4, 37.2, -18), 2.2, 2, false],
  [S(-4, 26, -6), S(-14.7, 34.3, -15), 1.6, 0, false],
  [S(-5, 24, -7), S(-19, 27.2, -19), 2.0, 3, false],
  [S(-4.5, 25.5, -6), S(-12.5, 30.5, -11), 1.8, 0, false],
  [S(-4.5, 27, -7), S(-20, 36.2, -21), 2.3, 0, false],
  [S(-5, 25, -7.5), S(-21, 30.5, -21), 2.3, 2, false],
  [S(-4, 26.5, -6), S(-10.5, 33, -10), 1.5, 1, false],
  [S(-5, 22.5, -6.5), S(-10.5, 17.5, -11), 1.3, 0, true],
  [S(-5.5, 23, -7), S(-14, 18.5, -14), 1.4, 1, true],
];
// Tail blades from the rump, swung out to the creature's left, the long ones tipped cyan.
TAIL = [
  [S(4, 16, 1.5), S(16.7, 16.2, 6), 1.7, 2, false],
  [S(4, 14, 1.5), S(19.6, 10.1, 9), 2.0, 1, true],
  [S(4, 13, 1), S(10.8, 9.2, 4), 1.4, 0, false],
  [S(4, 13, 2), S(17, 5, 13), 1.8, 2, true],
  [S(3.5, 12.5, 0), S(12, 3.5, 7), 1.6, 1, true],
  [S(3.5, 13.5, -0.5), S(13, 12.5, 2), 1.4, 3, false],
];
TAILROLL = 40;
WW = 1.3;   // wing blades' width factor

// Torso ellipsoids (local): chest, upper back, belly, rump.
CHEST = [S(-9, 19.5), [4.6, 5, 6]];
BACK = [S(-2.5, 20.5), [5.2, 6.2, 5.2]];
BELLY = [S(-3.5, 14.5), [4.6, 6, 4.2]];
RUMP = [S(3.5, 15), [3.8, 5, 3.8]];
HEAD = [S(-10.3, 26.8), [3.1, 3.7, 3.2]];
EYE = S(-10.3, 28.6, 2.55);
BAND = [S(-6, 21.8), 17, 7];   // the gold band's slab: centre, tilt (back higher), height

// The gold band's slab, limited to the breast (front) and the upper back.
module gband(h) {
  intersection() {
    translate(BAND[0]) rotate([BAND[1], 0, 0]) cube([30, 40, h], center = true);
    union() {
      translate([-15, -40 - 8.5, 0]) cube([30, 40, 60]);
      translate([-4.2, 0.5, 0]) cube([8.4, 30, 60]);
    }
  }
}

module torso(g = 0) {
  hull() for (e = [CHEST, BACK, BELLY, RUMP]) translate(e[0]) scale(e[1] + [g, g, g]) sphere(1, $fn = 28);
}

rotate([0, 0, -T]) {
  // ---- Body: one dark hull leaning forward, the neck up to the head.
  color(dark) torso();
  color(dark) hull() {
    translate(S(-9.5, 21.5)) scale([3.6, 3.6, 3.6]) sphere(1, $fn = 20);
    translate(HEAD[0] + [0, 0.6, -0.8]) scale([2.8, 3, 2.6]) sphere(1, $fn = 20);
  }
  // Gold plates: the torso grown a little, cut to a tilted band (front low, back high), kept on the breast and on the
  // upper back between the wing roots (the sides stay dark under the pauldrons).
  color(gold) intersection() {
    torso(0.35);
    gband(BAND[2]);
  }
  // Seams: one across each plate, a few down it.
  color(goldDk) intersection() {
    torso(0.45);
    gband(0.35);
  }
  color(goldDk) intersection() {
    torso(0.45);
    gband(BAND[2]);
    union() for (a = [-25, 25, 180]) translate(BAND[0]) rotate([0, 0, a]) translate([0, -10, 0]) cube([0.35, 20, 20], center = true);
  }

  // ---- Head: dark, round, a steel visor point over the gold beak, the brow over a fierce cyan eye.
  ell(HEAD[1], HEAD[0], dark);
  // gold hooked beak
  color(gold) hull() {
    translate(S(-13, 26.2)) scale([1.4, 1.6, 1.5]) sphere(1, $fn = 14);
    translate(S(-15.6, 25.6)) scale([0.7, 0.8, 0.9]) sphere(1, $fn = 10);
    translate(S(-16.8, 24.2)) sphere(0.25, $fn = 6);
  }
  color(darkLt) hull() {
    translate(S(-12.8, 25)) scale([1.1, 1.2, 0.9]) sphere(1, $fn = 12);
    translate(S(-15, 24.6)) sphere(0.3, $fn = 6);
  }
  // steel visor: a cap over the crown with a point forward over the beak
  color(steelLt) hull() {
    translate(S(-15.4, 26.4)) sphere(0.35, $fn = 6);
    translate(S(-12.5, 28.6)) scale([2.2, 2, 1.1]) sphere(1, $fn = 14);
    translate(S(-9.5, 29.4)) scale([2.9, 3, 1.4]) sphere(1, $fn = 16);
  }
  mirror_x() {
    // the brow ridge over each eye, slanting down to the beak (the glare)
    color(white) hull() {
      translate(S(-12.6, 28.4, 1.8)) sphere(0.4, $fn = 8);
      translate(S(-8, 30.2, 2.4)) scale([0.7, 1.4, 0.6]) sphere(1, $fn = 10);
    }
    // eye: a cyan iris in a dark socket, hooded by the brow, a white glint
    eye(EYE, 0.72, iris = cyan, sclera = ink, pupil = cyan, yaw = 62, lid = 0.3, lid_c = dark, lid_tilt = 18, shine = true);
  }

  // ---- Crest: silver blades from the brow sweeping back and up.
  blade(S(-12.5, 29.2), S(-11.6, 35), 0.9, steelLt, th = 0.45);
  blade(S(-12.8, 29.6), S(-7.3, 37.2), 1.6, steelLt, th = 0.5);
  mirror_x() {
    blade(S(-11.5, 29.4, 1), S(-3.6, 35, 1.6), 1.5, steel, th = 0.45);
    blade(S(-11.5, 29, 1.8), S(-2, 32.8, 2.6), 1.4, steelLt, th = 0.45);
    blade(S(-10.5, 28.6, 2.3), S(-3, 30.5, 3.2), 1.0, steel, th = 0.4);
  }

  // ---- Wings: a steel pauldron over each root, a dark arm along the leading edge, gold trim, then the blades.
  mirror_x() {
    color(steelLt) translate(S(-1.5, 24.5, 4.6)) rotate([20, 15, 0]) scale([1.9, 4.4, 3.6]) sphere(1, $fn = 20);
  }
  for (k = [1, -1]) {
    color(darkLt) hull() {
      translate([5 * k, -2, 25]) scale([1.4, 1.8, 1.8]) sphere(1, $fn = 12);
      translate(k > 0 ? S(10, 29.5, 11) : S(-10, 29.5, -11)) scale([0.6, 1, 1]) sphere(1, $fn = 10);
    }
    color(gold) hull() {
      translate([4.5 * k, -2.4, 27.6]) sphere(0.4, $fn = 8);
      translate(k > 0 ? S(10, 31, 11) : S(-10, 31, -11)) sphere(0.35, $fn = 8);
    }
  }
  // the wing's dark inner fan: the hull of the root and the inner part of each primary and covert
  for (W = [NEAR, FAR]) color(steelDk) hull() {
    for (b = W) if (!b[4]) translate(b[0] + (b[1] - b[0]) * 0.38) scale([1, 0.5, 1]) sphere(0.6, $fn = 8);
    translate(W[0][0]) scale([1.4, 0.8, 1.6]) sphere(1, $fn = 8);
  }
  for (b = NEAR) blade(b[0], b[1], b[2] * WW, COLS[b[3]], th = 0.55, tipc = b[4] ? cyan : undef);
  for (b = FAR) blade(b[0], b[1], b[2] * WW, COLS[b[3]], th = 0.55, tipc = b[4] ? cyan : undef);

  // ---- Tail: a fan of blades from the rump.
  for (b = TAIL) blade(b[0], b[1], b[2], COLS[b[3]], roll = TAILROLL, th = 0.6, tipc = b[4] ? cyan : undef);

  // ---- Legs: steel thigh plates, dark shanks, steel ankle cuffs, silver talons.
  mirror_x() color(steel) translate(S(1.5, 13, 4)) rotate([15, 0, 0]) scale([2.6, 3.8, 4]) sphere(1, $fn = 18);
  // near leg (left, +w): down and a little back
  limb(S(2, 11, 3.6), S(5, 4.2, 3.8), 2.2, 1.6, dark);
  color(steelLt) translate(S(5, 4, 3.8)) scale([2.1, 2.2, 1.9]) sphere(1, $fn = 14);
  limb(S(5, 3.6, 3.8), S(3, 1.2, 5.6), 1.2, 0.25, white);
  limb(S(5, 3.6, 3.8), S(5, 0.2, 4), 1.3, 0.25, white);
  limb(S(5, 3.6, 3.8), S(8.2, 1, 3), 1.2, 0.25, white);
  limb(S(5, 3.6, 3.8), S(7, 3, 2.5), 1.0, 0.2, steelLt);
  // far leg (right, -w): stepped forward
  limb(S(-5, 11, -3.6), S(-10.5, 3.6, -3.8), 2.2, 1.6, dark);
  color(steelLt) translate(S(-10.5, 3.4, -3.8)) scale([2.1, 2.2, 1.9]) sphere(1, $fn = 14);
  limb(S(-10.5, 3, -3.8), S(-17, 0.4, -3.8), 1.3, 0.25, white);
  limb(S(-10.5, 3, -3.8), S(-15, 0.3, -2), 1.2, 0.25, white);
  limb(S(-10.5, 3, -3.8), S(-15, 0.3, -5.8), 1.2, 0.25, white);
  limb(S(-10.5, 3, -3.8), S(-7.5, 1.2, -3.8), 1.0, 0.2, steelLt);
}
