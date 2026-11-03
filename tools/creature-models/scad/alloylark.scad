// Alloylark: a steel songbird in a low forward crouch, drawn side-on facing left. Dark body, a gold breastplate,
// a silver helm whose ridge runs from the beak tip back over the eye to a swept point, a crest blade and a forward
// horn, cyan slit eyes, a round steel pauldron over each wing root, wings of long silver blade feathers raised up and
// back, a short blade tail, thigh plates and grey-taloned dark feet (one stepped forward).
//
// Checklist (front sheet, x = sheet x, z):
//   head: dark, x -21..-6, z 22..31; cyan slit eye at (-12.2, 29.7), 0.5 x 1.7; grey cheek patch under the eye
//     (-16..-9, 24..27); rounded steel guard behind the eye (-10..-5, 26..31)
//   helm ridge (silver): (-24.5, 26) beak tip -> (-2.5, 35.5) swept tip, over the eye
//   crest blade (silver): (-17, 31) -> (-7, 39.8); forward horn (silver): (-19, 29.5) -> (-25, 36.3)
//   dark forehead tuft (-21, 27) -> (-24.3, 31); dark lower beak under the ridge's tip (-23.7, 25)
//   gold breastplate x -17..-4, z 12.5..25.4, a band right round the chest (the back art shows its back half)
//   pauldron (steel, light) (-5..2, 16.5..25.5); flank plate (1..6, 13..19); thigh plate (-3..4, 9..14.5)
//   near wing: blades from the shoulder (1..6, 21..25) to tips (22.7, 37.8), (25, 31), (21, 22.8), dark coverts
//   tail: blades (5..10, 10..17) -> (18.3, 16.2), (16, 10.8), a dark short one to (11, 17.8)
//   near leg: hip (2.5, 10) -> ankle (3.5, 3.5), talons down to z 0 at x -1..7.4
//   far leg stepped forward: (-6, 10) -> ankle (-10.5, 5), talons to (-16, 0.5), (-15.5, 3.8), back toe (-6, 3.3)
//   back art: wings spread wide, gold band round the back, cyan tips on the tail blades and short cyan blades under
//     the wings. The magenta fringe in the art is a glow on the outline, not a part.
// The art is a profile: the bird's axis is turned T degrees towards its right (the game's 30° turn then shows it
// side-on). S(s, z, w) is the local point that lands on sheet (s, z) at lateral offset w (+w = the creature's left).
include <lib.scad>

T = 25;
KA = sin(30 + T);   // sheet units per unit along the axis
KW = cos(30 + T);   // sheet units per unit of lateral offset
function S(s, z, w = 0) = let(y = (s - KW * w) / KA) [w, y, z - 0.17 * (-0.82 * w + 0.57 * y)];

dark = [0.2, 0.19, 0.25];
darkLt = [0.26, 0.25, 0.31];
steel = [0.72, 0.73, 0.79];
steelLt = [0.86, 0.86, 0.91];
steelDk = [0.58, 0.59, 0.66];
silver = [0.86, 0.86, 0.91];
silverMid = [0.78, 0.79, 0.85];
gold = [0.88, 0.65, 0.2, NOGLOW];
goldDk = [0.5, 0.3, 0.06];
cyan = [0.25, 0.85, 0.9, NOGLOW];

// A flat blade feather from a to b (local points), half-width w at 40 %, half-thickness th; its flat face stands in
// the vertical plane through a and b (_dir_rot).
module blade(a, b, w, c, th = 0.45, tipc = undef, tipl = 0.25) {
  d = b - a;
  l = norm(d);
  translate(a) rotate(_dir_rot(d)) {
    color(c) hull() {
      scale([w * 0.75, th, 0.6]) sphere(1, $fn = 10);
      translate([0, 0, l * 0.5]) scale([w, th, l * 0.08]) sphere(1, $fn = 12);
      translate([w * 0.25, 0, l * 0.84]) scale([w * 0.55, th * 0.9, l * 0.05]) sphere(1, $fn = 10);
      translate([0, 0, l]) sphere(0.15, $fn = 4);
    }
    if (tipc != undef) color(tipc) hull() {
      translate([0, 0, l * (1 - tipl)]) scale([w * 0.62, th * 1.15, 0.4]) sphere(1, $fn = 10);
      translate([0, 0, l * 1.01]) sphere(0.15, $fn = 4);
    }
  }
}

// A blade whose flat face is turned `roll` degrees about its own axis (wing feathers lying in the wing's plane).
module bladeR(a, b, w, c, roll = 0, th = 0.45, tipc = undef) {
  d = b - a;
  l = norm(d);
  translate(a) rotate(_dir_rot(d)) rotate([0, 0, roll]) {
    color(c) hull() {
      scale([w * 0.75, th, 0.6]) sphere(1, $fn = 10);
      translate([0, 0, l * 0.5]) scale([w, th, l * 0.08]) sphere(1, $fn = 12);
      translate([w * 0.25, 0, l * 0.84]) scale([w * 0.55, th * 0.9, l * 0.05]) sphere(1, $fn = 10);
      translate([0, 0, l]) sphere(0.15, $fn = 4);
    }
    if (tipc != undef) color(tipc) hull() {
      translate([0, 0, l * 0.75]) scale([w * 0.62, th * 1.15, 0.4]) sphere(1, $fn = 10);
      translate([0, 0, l * 1.01]) sphere(0.15, $fn = 4);
    }
  }
}

// Chest: tipped forward, the gold band laid on it.
CH = S(-10.5, 18.5);
CHR = [5.2, 5.6, 7];
CHT = [22, 0, 0];
WR = -35;   // the wing blades' roll: their upper faces turned up to the light

rotate([0, 0, -T]) {
  // ---- Body: chest, back, belly and rump in one hull, the neck up to the head.
  color(dark) hull() {
    translate(CH) rotate(CHT) scale(CHR) sphere(1, $fn = 28);
    translate(S(-3, 19.5)) scale([5.2, 5, 4.5]) sphere(1, $fn = 24);
    translate(S(-2, 12.5)) scale([5, 6, 4]) sphere(1, $fn = 24);
    translate(S(5, 14.5)) scale([3.8, 5, 3.4]) sphere(1, $fn = 20);
  }
  ell([3.8, 3.8, 4.4], S(-12.5, 23.5), dark);
  // Gold breastplate: a band of the chest, grown a little, tipped so it rises towards the shoulders.
  color(gold) intersection() {
    translate(CH) rotate(CHT) scale(CHR + [0.35, 0.35, 0.35]) sphere(1, $fn = 32);
    translate(CH) rotate([-38, 0, 0]) translate([0, -3, 1.5]) cube([20, 16, 12], center = true);
  }
  // The band's back half, round the upper back (the back art).
  color(gold) intersection() {
    translate(S(-3, 19.5)) scale([5.55, 5.35, 4.85]) sphere(1, $fn = 28);
    translate(S(-3, 19.5)) rotate([-12, 0, 0]) translate([0, 2, -0.5]) cube([14, 8, 5.5], center = true);
  }
  // Seams on the plate: one down the breast, one across it.
  color(goldDk) intersection() {
    translate(CH) rotate(CHT) scale(CHR + [0.45, 0.45, 0.45]) sphere(1, $fn = 32);
    translate(CH) rotate([-38, 0, 0]) translate([0, -3, -0.5]) cube([20, 16, 0.35], center = true);
  }
  color(goldDk) intersection() {
    translate(CH) rotate(CHT) scale(CHR + [0.45, 0.45, 0.45]) sphere(1, $fn = 32);
    translate(CH) rotate([-38, 0, 0]) translate([0, -3, 1.5]) cube([20, 16, 12], center = true);
    translate(CH) rotate([0, 0, 0]) translate([0, -4.5, 0]) cube([20, 0.35, 16], center = true);
  }

  // ---- Head: dark, round at the back, narrowing to the beak under the helm.
  color(dark) hull() {
    translate(S(-13.5, 27.3)) scale([4.4, 6, 4.4]) sphere(1, $fn = 24);
    translate(S(-18.5, 25.8)) scale([3, 3, 2.8]) sphere(1, $fn = 16);
  }
  // Lower beak: a dark point under the helm's tip.
  color(dark) hull() {
    translate(S(-19.5, 25.6)) scale([1.6, 1.6, 1.3]) sphere(1, $fn = 12);
    translate(S(-23.8, 25.1)) sphere(0.2, $fn = 6);
  }
  // Helm ridge: broad over the crown, a sharp point forward (the beak's top) and a swept point back.
  color(silver) hull() {
    translate(S(-24.8, 26.2)) sphere(0.3, $fn = 6);
    translate(S(-19, 28.7)) scale([2.4, 2.4, 1.4]) sphere(1, $fn = 14);
    translate(S(-13, 31.2)) scale([3.6, 3.4, 1.6]) sphere(1, $fn = 18);
    translate(S(-7.5, 33.3)) scale([2, 2.4, 1.3]) sphere(1, $fn = 12);
    translate(S(-2.4, 35.6)) sphere(0.3, $fn = 6);
  }
  // Steel guard behind the eye, the cheek patch under it (both sides).
  mirror_x() {
    color(steelLt) translate(S(-8.5, 28.4, 2.2)) scale([2.6, 2.8, 2.6]) sphere(1, $fn = 16);
    color(steel) translate(S(-14.5, 25.6, 3.3)) rotate([0, 0, 10]) scale([1.4, 3.4, 1.5]) sphere(1, $fn = 14);
  }
  // Crest blade, forward horn and the dark forehead tuft.
  blade(S(-15.5, 30.5), S(-7, 39.8), 2.3, silver, th = 0.6);
  blade(S(-18, 29.3), S(-25.2, 36.4), 1.9, silver, th = 0.55);
  blade(S(-19, 27), S(-24.5, 31.2), 1.8, darkLt, th = 0.6);
  // Cyan slit eyes on the sides of the head.
  mirror_x() color(cyan) translate(S(-12.3, 29.4, 3.9)) rotate([0, 0, -20]) scale([0.5, 0.85, 1.15]) sphere(1, $fn = 12);

  // ---- Wings: a steel pauldron over each root, dark coverts, three long blades raised up and back.
  mirror_x() {
    color(steelLt) translate(S(-1.5, 21, 4.3)) rotate([15, 0, 0]) scale([2.4, 4.6, 5]) sphere(1, $fn = 20);
    color(steelLt) translate(S(4, 16, 3.4)) rotate([-15, 0, 0]) scale([2.2, 5, 3.4]) sphere(1, $fn = 16);
    // grey rump plate over the tail root
    color(steel) translate(S(8.5, 12.5, 2.2)) rotate([-10, 0, 0]) scale([2, 4.2, 2.4]) sphere(1, $fn = 14);
    color(steelDk) hull() {
      translate(S(3, 23.5, 5.5)) scale([1.4, 3, 2.8]) sphere(1, $fn = 12);
      translate(S(12, 26.5, 7.5)) scale([0.6, 3.4, 2.8]) sphere(1, $fn = 10);
    }
    bladeR(S(0.5, 24.5, 5.5), S(22.7, 37.8, 9.5), 2.8, silver, roll = WR, th = 0.6);
    bladeR(S(4.5, 24, 6), S(25, 31, 10), 2.6, silver, roll = WR, th = 0.6);
    bladeR(S(5.5, 21.5, 6), S(21, 22.8, 10), 2.4, silverMid, roll = WR, th = 0.6);
    // Short cyan blade tucked under the wing (the back art).
    blade(S(7, 19.5, 4.5), S(10, 17.5, 9), 0.7, cyan, th = 0.35);
  }

  // ---- Tail: blades fanned back from the rump, the lower ones tipped cyan (the back art).
  mirror_x() {
    blade(S(5, 14.5, 1.2), S(18.3, 16.2, 2.6), 1.7, silver, th = 0.5);
    blade(S(5, 12.5, 1.2), S(16, 10.6, 3), 1.6, steelLt, th = 0.5, tipc = cyan);
    blade(S(6, 15.8, 0.6), S(11.5, 17.8, 1.2), 1.2, steelDk, th = 0.45);
  }

  // ---- Legs. Thigh plates both sides; the near (left, +X) leg back and straight, the far one stepped forward.
  mirror_x() color(steel) translate(S(0.5, 12, 3.4)) rotate([20, 0, 0]) scale([2.2, 4.4, 3.2]) sphere(1, $fn = 16);
  // near leg
  limb(S(2.2, 10.5, 3), S(3.3, 3.6, 3), 1.8, 1.3, darkLt);
  ell([1.3, 1.3, 1.2], S(3.3, 3.2, 3), darkLt);
  limb(S(3.3, 3, 3), S(-1.3, 0.5, 4.2), 1.2, 0.3, silverMid);
  limb(S(3.3, 3, 3), S(1.6, 0.25, 3), 1.2, 0.3, silverMid);
  limb(S(3.3, 3, 3), S(7.2, 0.5, 2.4), 1.2, 0.3, silverMid);
  // far leg: a heavy dark thigh down to the stepped-forward foot
  limb(S(-3, 11.5, -3), S(-8.5, 7.5, -3), 2.8, 1.8, dark);
  limb(S(-5, 10, -3), S(-10.3, 5.2, -3), 1.8, 1.3, darkLt);
  ell([1.3, 1.3, 1.2], S(-10.4, 5, -3), darkLt);
  limb(S(-10.4, 5, -3), S(-16, 0.5, -3.6), 1.2, 0.3, silverMid);
  limb(S(-10.4, 5, -3), S(-15.6, 3.8, -2.4), 1.2, 0.3, silverMid);
  limb(S(-10.4, 5, -3), S(-6, 3.2, -3), 0.9, 0.25, darkLt);
}
