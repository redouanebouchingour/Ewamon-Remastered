// Scalewisp: a teal wyvern pup crouched on all fours, head low and turned to its right, a big violet bat wing raised
// high on its right (the viewer's left), the left wing spread low, and a long tail looping out behind its left side up
// into a spined frond above its back.
//
// Checklist (sheet frame: height 40, feet on the rock at z 6.4; the rock is not modelled, the creature is dropped by
// FOOT so the feet stand on z = 0):
//   body plan: quadruped, low slung; wings on the back; the long tail loops to +X and up.
//   head: wedge, sheet x -12.4..-4, z 10..20.5; snout tip (-12.4, 10.2..13.6); flat jaw at z 10; horn at (-9.5, 21);
//         crown bumps along the top; eye at (-7.6, 13.6), r 1.1, orange with a red back and a glint, hooded by a brow;
//         mouth line along the jaw; an orange nostril dot at the snout.  Colour teal [0.11, 0.53, 0.51].
//   body: sheet x -3.5..3, z 10..19, back line z 18.5; pale grey-teal belly scales (-3.5..2.4, z 11..13.6).
//   legs: near front leg sheet -4..-1 (z 7..11.5), foot -6.2..-1 with 3 claws; the far front leg and the near hind leg
//         both project onto the dark leg at sheet 2.1..4.1 (z 6..9.3); the far hind thigh is the big oval at 3..7.2,
//         z 10..17 with its lower leg and splayed foot at 5..10, z 6.3..9.6.
//   raised wing (-X): panels P3 (light, -18.8..-5, z 29..39), P7 (mid, -17..-5.7, z 25..29.6), P6 (mid, -14..-4.8,
//         z 18.5..26.7), P8 (dark, -5.7..-1.5, z 19..26.7); the arm -4.7..-2.7 from z 20 to the wrist at 30.5 with two
//         thumb prongs; finger bones to (-18.6, 39.6), (-19, 28.7), (-16.4, 24.2).
//   low wing (+X): panels P5 (light, 4.3..12.3, z 12..26.5), P4 (mid, 11..18.5, z 12..27.7), P9 (dark flank patch
//         1.4..7.6, z 15.6..20.3); wrist/thumb at (11.9, 28.3); leading finger to (19.3, 30.3); the trailing edge from
//         (19.5, 25) down to the bottom tip (10.6, 10.3); the arm along the top of P5.
//   tail: root visible at 9.4..12.5, z 11.6..18.5, loops behind the low wing and comes up as the frond: a thick shaft
//         from (8.8, 23) to the tip (0, 35.3) with 6 spines on its upper-right edge.  The back view shows the whole
//         loop out to +X, down to the ground and up, the frond ending near the middle.
//   back: the wing roots on the shoulders, three dorsal spikes, the tail loop and frond.
//   colours: teal M0 (mid #1c8883, light #3fb6a4, dark #1b666c, deep #154354, grey belly #499589),
//            violet M1 (mid #6d3b7b, light #9f599d, dark #42244f), eye orange/red, no glow marked.
include <lib.scad>

FOOT = 6.4;

teal = [0.11, 0.53, 0.51];
tealLt = [0.25, 0.71, 0.64];
tealDk = [0.11, 0.40, 0.42];
tealDeep = [0.08, 0.26, 0.33];
tealGrey = [0.29, 0.59, 0.54];
purple = [0.43, 0.23, 0.48];
purpleLt = [0.62, 0.35, 0.62];
purpleDk = [0.26, 0.14, 0.31];
eyeOrange = [1, 0.62, 0.12];
eyeRed = [0.85, 0.18, 0.05];
pupilC = [0.15, 0.03, 0.02];

// The art's picture plane: the preview camera is turned 30 degrees, so a child drawn at [sx, 0, z] in sheet units
// projects onto the sheet at exactly sx. `dy` pushes the whole plane that far behind the body's centre line (the
// projection stays the same).
module inplane(dy = 0) {
  translate([0, dy, 0]) rotate([0, 0, 30]) translate([-dy / 2, 0, 0]) children();
}

// A membrane panel from a traced region outline, grown by the ink line's width (the trace follows the colour region
// inside the outline, so the panel would otherwise come out 0.45 units short on every edge).
module mplate(pts, t = 0.5, c) {
  color(c) rotate([90, 0, 0]) linear_extrude(height = t, center = true) offset(r = 0.45) polygon(pts);
}

// Three claws fanning out from the toe point p along direction d (unit-ish, horizontal), spread sideways by s.
module claws(p, d, s, l = 1.3, r = 0.32, c = tealLt) {
  side = [-d[1], d[0], 0] / norm([d[0], d[1]]);
  for (k = [-1, 0, 1]) spike(p + side * k * s * 0.55, d * l + side * k * s * 0.35 + [0, 0, -0.35], r, 0.05, c);
}

// Head in its own frame: the neck joint at the origin, the snout towards -Y, absolute z.
module head() {
  // Skull: a rounded wedge, domed at the back, tapering to a rounded snout at z 10.4..13.6; the jaw underneath.
  blob([[[3.1, 2.9, 4.6], [0, 0.5, 15.2]], [[2.8, 2.4, 4.0], [0, -3.2, 15.0]], [[2.1, 1.8, 2.8], [0, -5.6, 15.4]],
        [[1.5, 1.5, 1.8], [0, -7.8, 12.4]]], teal);
  color(teal) hull() {
    translate([0, -0.5, 11.2]) scale([2.6, 2.6, 1.0]) sphere(1, $fn = 16);
    translate([0, -7.4, 11.0]) scale([1.3, 1.4, 0.7]) sphere(1, $fn = 12);
  }
  // The big orange eye (2.2 units tall in the art) under a brow ridge, looking outward so the camera sees the near
  // one; a brow spike above each eye.
  mirror_x() {
    color(teal) translate([2.0, -4.0, 15.9]) rotate([0, 0, 20]) scale([1.4, 1.9, 0.6]) sphere(1, $fn = 14);
    eye([2.45, -4.2, 14.1], 1.2, iris = eyeRed, sclera = eyeOrange, pupil = pupilC, yaw = 62, flat = 0.55,
        lid = 0.22, lid_tilt = 20, lid_c = tealDk, shine = true, slit = 0.55);
    spike([1.6, -5.6, 18.2], [0.3, -0.3, 2.8], 0.5, 0.05, teal);
    // Mouth line along the jaw and a nostril dot.
    limb([1.5, -8.0, 11.4], [2.5, -3.2, 11.5], 0.16, 0.16, tealDeep);
    ell([0.3, 0.3, 0.3], [1.0, -8.9, 12.9], eyeOrange);
  }
  // Crown bumps along the top of the skull.
  for (y = [-3.2, -1.6, 0, 1.6]) spike([0, y, 19.3 - abs(y + 0.5) * 0.12], [0, 0.4, 1.4], 0.4, 0.05, teal);
}

module creature() {
  // ---- Torso: chest in front, the haunches behind; the grey belly scales under the chest.
  blob([[[3.6, 4, 4.5], [0.5, -3, 14.8]], [[3.6, 3.8, 4.1], [1, 1.5, 15.2]], [[3.8, 3.4, 3.7], [2, 6.5, 14.5]]], teal);
  ell([2.9, 3.4, 1.7], [0.5, -3.5, 11.8], tealGrey);
  // Shoulders where the wings root, a hump between them where the wing arms and the tail's base rise, and three
  // dorsal spikes.
  mirror_x() ell([1.7, 1.9, 1.7], [3, 0.5, 18.8], teal);
  ell([2.8, 2.5, 1.8], [0.5, 0.5, 19.5], teal);
  for (y = [-1.5, 1, 3.5]) spike([0.8, y, 19.6], [0, 0.5, 3.0], 0.55, 0.05, teal);
  // The tail's thick base rising from behind the shoulders (the teal wedge above the back in the art).
  limb([2.5, 1.5, 20], [3.5, 4.5, 25], 1.7, 1.5, teal);

  // ---- Neck and head, turned 35 degrees to the creature's right so the head reads in profile.
  chain([[-0.5, -4.5, 16], [-3, -5, 15.3]], [2.8, 2.5], teal);
  translate([-3, -4, 0]) rotate([0, 0, -35]) head();

  // ---- Legs.
  // Right front leg (the near one in the art): stepped a little out, the foot and claws pointing forward.
  chain([[-1.8, -1.8, 13.5], [-2.2, -2.6, 10], [-1.8, -3, 7.6]], [1.9, 1.4, 1.2], tealDk);
  limb([-1.8, -3.4, 7.1], [-2.2, -5.8, 6.9], 1.1, 0.9, tealDk);
  claws([-2.3, -6, 6.7], [-0.1, -1, 0], 1.3, 1.2);
  // Left front leg: straight down under the chest.
  chain([[4.2, -1, 13.5], [4.4, -1.8, 10], [4.2, -2.4, 7.6]], [1.9, 1.4, 1.2], tealDeep);
  limb([4.2, -2.8, 7.1], [4.2, -4.8, 6.9], 1.1, 0.9, tealDeep);
  claws([4.2, -5, 6.7], [0, -1, 0], 1.5, c = tealDk);
  // Left hind leg: the big thigh, the lower leg behind it, the foot splayed out to the side.
  ell([2.3, 3.2, 3.6], [4, 5.2, 13.5], teal);
  chain([[4.3, 6.8, 10.8], [3.2, 7.6, 8.3], [2.8, 7.6, 7]], [1.6, 1.2, 1.1], teal);
  limb([2.8, 7.4, 6.9], [6.5, 6.2, 6.7], 1.0, 0.85, teal);
  claws([6.7, 6.1, 6.6], [0.95, -0.3, 0], 1.5);
  // Right hind leg: hidden behind the body, its lower leg the dark leg under the haunch.
  ell([2.3, 3.2, 3.2], [-2.6, 5, 14.2], tealDk);
  chain([[-1.5, 7.2, 11.5], [-1.3, 8.8, 8.5], [-1.2, 9.2, 7]], [1.5, 1.2, 1.1], tealDeep);
  limb([-1.2, 9, 6.9], [-1.5, 6.8, 6.7], 1.0, 0.85, tealDeep);
  claws([-1.5, 6.6, 6.6], [0, -1, 0], 1.3, c = tealDk);

  // ---- Raised wing (the creature's right, -X), in the picture plane just behind the body's centre.
  inplane(2.5) {
    mplate([[-18.8, 39], [-14.4, 38.3], [-11.1, 36.6], [-6.6, 32.5], [-5, 29.2], [-9.1, 30.5], [-17.1, 30.1], [-16.6, 31.9], [-15.7, 32.5], [-15.7, 36.6], [-16.8, 38.1], [-18.8, 38.8]], 0.5, purpleLt);
    mplate([[-14.4, 29.6], [-9, 29.6], [-6.6, 28.6], [-5.7, 27.9], [-6.8, 27.2], [-8.8, 27.2], [-14.6, 25.4], [-14.1, 27], [-16, 28.8], [-17, 29]], 0.5, purple);
    mplate([[-6.4, 26.7], [-4.8, 26.7], [-4.8, 25.2], [-6.8, 23.7], [-6.6, 23], [-7.7, 21.9], [-6.1, 18.5], [-7.5, 18.8], [-9.1, 18.5], [-8.6, 19.2], [-8.6, 21.2], [-10.1, 22.7], [-11.7, 23.9], [-14.1, 24.5], [-11.3, 24.8], [-11.1, 25.4], [-6.6, 26.5]], 0.5, purple);
    mplate([[-3.3, 26.7], [-2.2, 26.1], [-2.2, 24.7], [-3.5, 24.1], [-3.5, 21.7], [-2.6, 21.6], [-2.2, 20.5], [-1.5, 20.3], [-2.6, 19.2], [-3.9, 19.2], [-3.9, 20.3], [-5.2, 20.1], [-5.7, 21.4], [-5.7, 22.5], [-3.5, 25.2], [-3.5, 26.5]], 0.5, purpleDk);
    // Arm from the shoulder up to the wrist, two thumb prongs, three finger bones.
    chain([[-3.3, 0, 19.8], [-4.6, 0, 24.5], [-4.3, 0, 31.3]], [1.1, 0.95, 0.9], teal);
    spike([-4.4, 0, 31.3], [-0.9, 0, 3.0], 0.5, 0.05, teal);
    spike([-3.8, 0, 31.2], [0.8, 0, 2.0], 0.42, 0.05, teal);
    limb([-5.0, 0, 32.4], [-18.6, 0, 39.5], 0.95, 0.4, teal);
    mplate([[-19.2, 39.7], [-16.3, 39.7], [-16.9, 38.4], [-18.8, 38.5]], 0.5, teal);
    limb([-5.0, 0, 29.8], [-19, 0, 28.7], 0.5, 0.3, tealDk);
    limb([-5.6, 0, 27.4], [-16.4, 0, 24.2], 0.45, 0.3, tealDk);
  }

  // ---- Low wing (the creature's left, +X): spread low, the fingers hanging down to the wing's bottom tip.
  inplane(2.5) {
    mplate([[17.9, 27.7], [18.5, 27.7], [18.5, 25.6], [18.1, 23.9], [17.4, 23.7], [17.4, 21.6], [16.6, 20.8], [15.7, 17.2], [14.5, 15.2], [11, 12.1], [12.6, 15.2], [12.8, 17.8], [13.4, 17.9], [13.4, 25.7], [15.7, 25.7]], 0.5, purple);
    mplate([[17.9, 27.7], [18.8, 29.9], [19.1, 25.3], [18.5, 25.6], [18.5, 27.7]], 0.5, purple);
    mplate([[11.7, 26.5], [12.3, 26.5], [12.3, 18.5], [11.6, 15.6], [10.3, 13], [9.2, 12.1], [9, 18.3], [8.3, 19.8], [8.3, 21.2], [7.4, 21.7], [6.8, 23], [5.9, 23], [4.7, 21.7], [4.3, 21.9], [5, 23.2], [7.2, 23.2], [7.7, 22.5], [9.6, 22.3], [10.5, 24.1], [11.2, 24.3], [11.6, 25]], 0.5, purpleLt);
    mplate([[5.9, 20.3], [6.8, 20.3], [7.2, 19], [7.6, 15.9], [6.5, 15.9], [5.4, 17.2], [2.7, 16.8], [1.4, 15.6], [2.1, 17], [5.7, 20.1]], 0.5, purpleDk);
    // Arm along the top of the inner panel to the wrist, the thumb, the leading finger, the long finger down the
    // middle to the bottom tip, and a teal rim along the trailing edge.
    chain([[3, 0, 20.5], [8.5, 0, 23], [12, 0, 27.6]], [1.1, 0.9, 0.8], tealDk);
    spike([12, 0, 27.6], [-0.3, 0, 1.1], 0.5, 0.05, tealDk);
    limb([12, 0, 27.8], [19.2, 0, 30.3], 0.6, 0.35, tealDk);
    chain([[12.4, 0, 27], [13.0, 0, 18.5], [10.9, 0, 10.8]], [0.6, 0.5, 0.3], tealDk);
    chain([[19.3, 0, 25.5], [14.8, 0, 14], [10.8, 0, 10.6]], [0.4, 0.4, 0.3], tealDk);
  }

  // ---- Tail: from the rump, looping out behind the left wing, up and over into the frond above the back.
  // The loop stays inside the low wing's outline from the front (hidden behind it) and returns behind the inner
  // panel; the frond then rises in front of the wing's arm along the art's diagonal from (8.8, 23) to (0, 35.3).
  T = [[2, 7, 13.5], [5, 10, 12.5], [8, 11.5, 13.5], [10, 11.5, 16.5], [11, 11.5, 19.5], [9.5, 10, 21.5], [7.5, 8.2, 22.5], [6, 6.5, 23.5], [4.3, 5.0, 26.5], [2.2, 3.5, 29.8], [0.1, 2.0, 33], [-1.0, 1.0, 36]];
  R = [2.3, 1.9, 1.6, 1.4, 1.3, 1.3, 1.4, 1.6, 1.7, 1.45, 1.05, 0.35];
  chain(T, R, teal);
  // Frond spines on the shaft's upper edge, pointing up and to the creature's left-back.
  for (i = [0 : 6]) let(t = i / 6, p = T[7] + (T[11] - T[7]) * t, l = 2.5 - t * 0.9)
    spike(p + [0.3, 0.2, 0.7], [0.5, 0.3, 0.85] * l, 0.55 - t * 0.2, 0.05, tealLt);
}

translate([0, 0, -FOOT]) creature();
