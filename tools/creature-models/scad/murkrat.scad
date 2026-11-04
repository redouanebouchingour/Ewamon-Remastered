// Murkrat: a big charcoal rat crouched side-on on its long hind feet, one clawed arm reaching forward, the other
// paw held at its chest, acid-green eyes and green drool, a cloud of dark smoke billowing up off its back.
//
// Checklist (front sheet; the art stands on a ground shadow, the feet line is sheet z 3.6 = scad z 0):
//   head    : long wedge, cranium (-9.5, 17.5) r 4, snout down-left to the nose (-16.5, 12.8); turned 25 deg to its
//             right and pitched 22 deg down. One round ear (-7.3, 19.5) r 2.1, dark inside.
//   face    : near eye an angry dark almond (-11.2, 16.2) with a small acid-green iris; far eye a sliver at (-15.1, 16.7).
//             Open mouth, jaw dropped; green drool strands from the near corner (-11.5, 13 -> 9) and (-13.2, 12 -> 10.8).
//             Whiskers out past the nose to (-18.6, 13.5).
//   arms    : far (-X) arm reaching forward under the chin, clawed hand (-17..-14, 7..10), claws hooked down;
//             near (+X) paw held up at the chest (-3.3, 9..13), long claws hanging.
//   body    : big hunched pear, back top (0, 24.8), chest edge (-7, 12..20), rump edge (10, 8..17), belly z 6.
//   hind    : near haunch a round thigh (4.5, 12) r 4, long foot flat on the ground heel (9, 5) to toes (3, 3.8);
//             far hind leg dark under the belly (-7..-2, 6..12), foot forward (-9.6..-4, 4.2..6).
//   tail    : bare, grey, ringed: from the rump (10, 12.5) down to (12, 5), then forward along the ground to (-2.5, 4).
//   smoke   : a cloud x -17..14, z 17..40 behind the rat: billows merged into one cloud, pale swirl
//             streaks rising to the upper right; flame-like wisps on its right edge, a curling tongue at the top
//             right (10, 40), a detached curl top left (-2, 37), dark wisps behind the head.
//   back    : the same cloud from behind, the tail curling out to the side, both hind feet, the reaching arm.
include <lib.scad>

G = 3.6;   // the sheet's foot line: everything is authored in sheet z and dropped by G

fur = [0.3, 0.32, 0.35];
furDk = [0.21, 0.22, 0.25];
earIn = [0.12, 0.11, 0.14];
claw = [0.47, 0.47, 0.49];
tailC = [0.35, 0.35, 0.38];
ring = [0.26, 0.27, 0.3];
nose = [0.07, 0.07, 0.09];
mouthC = [0.2, 0.06, 0.08];
tooth = [0.85, 0.83, 0.74];
drool = [0.45, 0.85, 0.15, NOGLOW];
smokeDk = [0.17, 0.17, 0.21];
smokeLt = [0.35, 0.38, 0.41];

// the head's frame: cranium centre, yaw towards its right, pitch down
HC = [-3.5, -13, 18.3];
HROT = [22, 0, -25];
function rx(a, p) = [p[0], p[1] * cos(a) - p[2] * sin(a), p[1] * sin(a) + p[2] * cos(a)];
function rz(a, p) = [p[0] * cos(a) - p[1] * sin(a), p[0] * sin(a) + p[1] * cos(a), p[2]];
function hw(p) = HC + rz(HROT[2], rx(HROT[0], p));

translate([0, 0, -G]) {
  // ---- body: a hunched pear, chest forward and low, rump high and round
  blob([[[6, 6, 6.5], [0, -5, 15]], [[7.5, 7.5, 8.5], [0, 4, 14.5]], [[6, 7, 4.5], [0, 0, 20]]], fur);
  // shoulders running into the head (no neck to speak of)
  limb([0, -4, 17.5], HC, 5, 3.8, fur);

  // ---- head
  translate(HC) rotate(HROT) {
    // skull and snout
    blob([[[4.2, 4.4, 4.1], [0, 0, 0]], [[2.4, 3, 2], [0, -4.5, 0]], [[1.1, 1.3, 1], [0, -9, -0.2]]], fur);
    ell([0.85, 0.75, 0.75], [0, -9.9, -0.2], nose);
    // dropped lower jaw and the open mouth between
    blob([[[1.8, 2, 1], [0, -3.5, -2.6]], [[0.9, 1, 0.6], [0, -7.5, -2.7]]], fur);
    ell([1.4, 3, 0.8], [0, -5.6, -1.9], mouthC);
    mirror_x() spike([0.45, -8.4, -1], [0, -0.1, -0.9], 0.3, 0.05, tooth);
    // eyes: dark angry almonds with a small acid-green iris
    mirror_x() {
      eye([2.1, -3.5, 1.2], 1.6, iris = [0.8, 0.95, 0.2, GLOW], sclera = [0.04, 0.04, 0.05], pupil = [0.8, 0.95, 0.2, GLOW],
          yaw = 55, flat = 0.5, lid = 0.32, lid_tilt = 22, lid_c = furDk, squint = 0.22);
      // whiskers
      for (a = [-8, 8]) color(claw) translate([0.9, -8.2, -0.4]) rotate([a, 0, -15]) rotate([0, 90, 0]) cylinder(h = 4, r = 0.11, $fn = 5);
    }
    // round ears, dark inside
    mirror_x() translate([2.5, 1.4, 3.7]) rotate([0, 25, 35]) {
      color(fur) scale([2.3, 0.7, 2.4]) sphere(1, $fn = 20);
      color(earIn) translate([0, -0.35, 0]) scale([1.7, 0.45, 1.8]) sphere(1, $fn = 16);
    }
  }
  // green drool hanging from the near corner of the mouth
  limb(hw([0.8, -6.6, -2.4]), [hw([0.8, -6.6, -2.4])[0], hw([0.8, -6.6, -2.4])[1], 9.4], 0.42, 0.34, drool);
  ell([0.5, 0.5, 0.65], [hw([0.8, -6.6, -2.4])[0], hw([0.8, -6.6, -2.4])[1], 9.2], drool);
  limb(hw([0.9, -8, -2]), [hw([0.9, -8, -2])[0], hw([0.9, -8, -2])[1], 10.8], 0.34, 0.28, drool);

  // ---- arms
  // far arm reaching forward under the chin, hand hooked down
  chain([[-4.5, -7, 14], [-5.6, -12, 10.4], [-6.6, -18, 9.6]], [1.9, 1.2, 0.9], fur);
  ell([1.1, 1.5, 0.8], [-6.8, -18.8, 9.2], fur);
  for (k = [-1, 0, 1]) spike([-6.8 + 0.6 * k, -19.6, 9], [0.25 * k, -1, -2.2], 0.36, 0.05, claw);
  // near paw held at the chest, claws hanging
  chain([[4, -4, 16], [4.4, -7, 10.6], [3.2, -10.3, 12]], [1.8, 1.2, 0.9], fur);
  ell([1, 1, 1.1], [3.1, -10.8, 11.6], fur);
  for (k = [-1, 0, 1]) spike([3.1 + 0.55 * k, -11.3, 11], [0.15 * k, -0.6, -2.4], 0.32, 0.05, claw);

  // ---- hind legs: round thighs, long feet flat on the ground (the far one stepped forward)
  ell([3.5, 5, 5.5], [5, 0.5, 12], fur);
  limb([5.3, 3, 8.5], [5.6, 7, 4.8], 1.7, 1, fur);
  blob([[[1.1, 1.6, 0.8], [5.6, 6.5, 4.4]], [[1, 1.2, 0.6], [5.4, -2, 4.2]]], fur);
  for (k = [-1, 0, 1]) spike([5.4 + 0.55 * k, -2.9, 4.1], [0.2 * k, -1.4, -0.3], 0.3, 0.05, claw);
  ell([3.5, 5, 5.5], [-5, 0.5, 12], fur);
  limb([-5, 0, 9], [-5, -1, 4.8], 1.7, 1, furDk);
  blob([[[1.2, 1.8, 0.8], [-5, -1, 4.4]], [[1, 1.2, 0.6], [-5, -8.5, 4.2]]], furDk);
  for (k = [-1, 0, 1]) spike([-5 + 0.55 * k, -9.4, 4.1], [0.2 * k, -1.4, -0.3], 0.3, 0.05, claw);

  // ---- tail: bare and ringed, out behind the rump and forward along the ground
  chain(TAIL, TAIL_R, tailC);
  for (i = [1 : len(TAIL) - 3]) for (t = [0.25, 0.75]) let(d = TAIL[i + 1] - TAIL[i], r = TAIL_R[i] + (TAIL_R[i + 1] - TAIL_R[i]) * t)
    color(ring) translate(TAIL[i] + d * t) rotate(_dir_rot(d)) cylinder(h = 0.35, r = r + 0.08, center = true, $fn = 10);

  // ---- smoke: soft billows merged by hulls into one rolling cloud, pale streaks laid flush on it, flame-like
  // wisps licking off its edges
  for (l = LINKS) pp(0) puffs([for (i = l) PUFFS[i]], smokeDk);
  // the billowing top edge: round heads half sunk in the cloud
  for (q = BUMPS) pp(0) color(smokeDk) translate([q[0], q[4], q[1]]) scale([q[2], q[2] * 0.75, q[3]]) sphere(1, $fn = 16);
  color(smokeLt) intersection() {
    union() for (l = LINKS) pp(0) puffs([for (i = l) PUFFS[i]], smokeLt, 0.3);
    union() for (s = SWIRLS) pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) offset(r = 0.7) offset(delta = -0.7) polygon(s);
  }
  for (w = WISPS) pp(w[2]) tongue(w[0], w[1], smokeDk);
  for (d = DOTS) pp(d[2]) ell([d[3], d[3] * 0.8, d[3]], [d[0], 0, d[1]], smokeDk);
}

TAIL = [[1.5, 11, 13], [5, 13.5, 9], [8, 11, 5.5], [8.6, 5, 4.6], [7.2, -2, 4.5], [4.2, -8, 4.5], [2.6, -10.2, 5.4]];
TAIL_R = [1.4, 1.2, 1, 0.8, 0.65, 0.5, 0.3];

// billows: [sheet x, sheet z, radius across, radius up, depth behind the picture plane]; the cloud is about 0.75
// as deep as it is wide
PUFFS = [
  [-14, 21.5, 3, 3.4, 1],      // 0 behind the head
  [-11, 26, 2.8, 3, 1.5],      // 1
  [-8, 29.6, 3.5, 3.2, 2.5],   // 2 the left billow
  [-4, 30.3, 3, 2.8, 3],       // 3
  [-7.5, 23.5, 3.5, 3, 2],     // 4
  [-1.5, 25, 5, 4.5, 3],       // 5 the core over the back
  [3.5, 26.5, 5, 5, 3.5],      // 6
  [2.8, 33.6, 3.6, 3.5, 4],    // 7 the top billow
  [7, 31.4, 3, 3, 4],          // 8
  [10.5, 27.6, 3.3, 3.5, 3.5], // 9 the right billow
  [11.2, 22.6, 2.8, 3, 3.5],   // 10
  [9, 17.6, 3, 3.8, 3.5],      // 11
];
BUMPS = [
  [-12, 27.4, 1.7, 1.7, 1.5], [-9, 31, 2.4, 1.8, 2.5], [-5.4, 31.6, 2, 1.6, 3], [0.6, 35.4, 2.3, 2, 4],
  [4.4, 36, 2.3, 1.6, 4], [8, 33.8, 2, 1.7, 4], [12.4, 27.2, 1.8, 2, 3.5], [12.2, 20.4, 1.5, 1.8, 3.5], [11.4, 15.6, 1.2, 1.5, 3.5],
];
// neighbours hulled together, so the billows merge without the crevices of a pile of balls
LINKS = [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [3, 7], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [6, 9], [1, 4], [3, 5]];
module puffs(ps, c, grow = 0) {
  color(c) hull() for (q = ps) translate([q[0], q[4], q[1]]) scale([q[2] + grow, q[2] * 0.75 + grow, q[3] + grow]) sphere(1, $fn = 20);
}
// a flame-like tongue: flattened capsules tapering along the points (wide across the view, thin in depth)
module tongue(pts, rs, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() {
    translate([pts[i][0], 0, pts[i][1]]) scale([1, 0.55, 1]) sphere(rs[i], $fn = 12);
    translate([pts[i + 1][0], 0, pts[i + 1][1]]) scale([1, 0.55, 1]) sphere(rs[i + 1], $fn = 12);
  }
}

// pale streaks rising to the upper right (sheet outlines, cut through the cloud along the view)
SWIRLS = [
  [[-13, 21.5], [-11, 21.5], [-5.5, 26.5], [-1.5, 28.6], [-1.3, 30], [-6.5, 29.8], [-9.5, 26]],
  [[-6, 22.6], [-4, 22.6], [1, 26.8], [3, 29.4], [2, 30.4], [-1, 28.4], [-4.5, 25.4]],
  [[2.6, 26.8], [4, 26.4], [5.2, 29], [6.6, 31.6], [5.6, 33], [3, 32.6], [2, 31], [3.6, 30.4]],
  [[8.3, 17.5], [10, 18.8], [11.2, 23.6], [9.6, 24.2], [8.4, 21]],
  [[7.6, 25.5], [9.8, 26.5], [10.4, 30.5], [8.8, 31], [7.6, 28.5]],
];

// flame-like wisps: [sheet points, radii, depth]
WISPS = [
  [[[8.6, 34.4], [10.6, 35.6], [11.4, 37.2], [10.6, 38.4], [9.6, 38.6], [9.9, 39.8]], [1.5, 1.1, 0.8, 0.55, 0.4, 0.25], 4],
  [[[11, 27.5], [12.3, 29.5], [12.4, 31.4]], [1.3, 0.8, 0.35], 3.5],
  [[[12.5, 23.6], [13.6, 25], [14.2, 26.8]], [1.1, 0.8, 0.35], 3.5],
  [[[-15, 19], [-16.4, 20.6], [-16.8, 22.6]], [1.3, 0.8, 0.3], 1],
  [[[-13.6, 25.5], [-14.8, 26.6], [-14.6, 27.8]], [1, 0.6, 0.25], 1],
  [[[-4.6, 32.6], [-3.1, 34.2], [-2.5, 35.8], [-1.5, 37.2], [-0.3, 37.8]], [1.1, 0.85, 0.6, 0.45, 0.3], 3],
];

// detached puffs: [sheet x, z, depth, r]
DOTS = [[-14.6, 25.6, 1, 0.55], [13.6, 30.2, 3.5, 0.55], [11.3, 12.6, 4, 0.5], [0.4, 38.8, 3, 0.45], [-5.6, 36.6, 2, 0.5]];
