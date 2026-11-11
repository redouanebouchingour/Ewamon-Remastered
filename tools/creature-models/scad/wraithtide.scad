// Wraithtide: a ghost fish. A big bone skull is its face, set in the front of a round teal hood-head, two glowing cyan
// eyes in black sockets under angry brows and cyan flame trailing from both; a long teal body tapering to a thin stalk
// and a big forked ragged tail fan; a ragged dorsal sail; two drooping pectoral fins; a ragged drape under the chin;
// a drape of grey-teal smoke hanging under it in wavy flat strands, the longest curling down to the ground.
//
// Checklist (front sheet, x = sheet x, z):
// - drawn side-on, nose to the viewer's left: the fish's mid plane is the picture plane, so the fish is built in pp()
//   (x along the fish, y its width, + away from the viewer). The skull faces between the viewer and the nose.
// - skull x -16.2..-5, z 21.5..32.5 (cranium -16..-5.5, z 24..32.5; teeth -14.2..-9, z 21.5..24.5), bone; the main
//   shape of the head (made a little bigger than drawn so it reads as the face from the three-quarter view).
//   Eyes: sheet (-14.2, 26.9) far and (-9.4, 26.7) near, black ring, cyan iris, pale core, heavy black brow on top.
//   Nose: a dark inverted heart at (-12.2, 25). Teeth: four with dark gaps.
// - cyan flames: from the far eye out to the left (x -18.7, z 26..32), from the near eye up and back (x -3.5, z 32.5).
// - head / hood: x -16.7..+1, z 17.5..38.5; body: back line (0, 35) to the stalk (5.5, 23.5..28.5), teal.
// - tail fan: x 4..17.4, z 14.7..32.8, forked (upper lobe to (17.4, 31.4), lower lobe to (14.3, 14.7)), pale teal.
// - dorsal sail: x -9..4.9, z 30.6..39.9, ragged spines swept back.
// - pectorals: near one x -4..4.5, z 15.8..23 drooping back; far one x -7.4..-3, z 13.4..22.
// - fins thin and translucent-looking: pale teal with a lighter rim, darker rays.
// - chin drape: x -16.7..-13, z 15.8..24.
// - smoke: x -13.6..5.6, z 7..20.5, wavy strands (tendrils on the left to z 10.3), the long one an S-curl to z 0.
// - back art: the skull in profile facing the nose, a cyan spiral flame over it; same fins and smoke.
include <lib.scad>

teal = [0.32, 0.65, 0.64];
fin = [0.58, 0.85, 0.81, NOGLOW];
finRim = [0.8, 0.96, 0.92, NOGLOW];
finDk = [0.36, 0.66, 0.64];
bone = [0.79, 0.81, 0.77];
rim = [0.47, 0.8, 0.77, NOGLOW];
socket = [0.05, 0.07, 0.08];
glow = [0.13, 0.82, 0.71, GLOW];
flame = [0.28, 0.89, 0.78, GLOW];
core = [0.62, 0.96, 0.9, GLOW];
smoke = [0.46, 0.55, 0.56];
smokeLt = [0.55, 0.64, 0.64];
smokeDk = [0.37, 0.45, 0.47];

// Outlines read off the front sheet ([x, z]).
TAIL = [[3.5, 28.6], [7.3, 29.2], [9.1, 31.2], [12, 32.4], [15.1, 33], [17.6, 31.6], [15.6, 31.3], [13.3, 30.6], [14.2, 29.6],
  [11.2, 27.6], [13.8, 27.4], [10.9, 25], [9.4, 24.6], [12.4, 19.2], [10.4, 20], [11.1, 17.4], [14.5, 14.6], [9.4, 16.2],
  [6.6, 20], [4.3, 23.4]];
DORSAL = [[-9.5, 36.3], [-7.4, 39.1], [-4.7, 40], [2.9, 39.2], [-1.2, 37.6], [5, 33.8], [0.8, 33.9], [3.5, 31.8], [1.8, 30.4],
  [-3, 33], [-6.5, 35]];
PEC = [[-4.5, 23.4], [-1, 23.4], [1.8, 22.8], [4.4, 20], [2.2, 18.8], [3.5, 17.2], [2.4, 16.7], [4.7, 15.8], [-0.4, 16.2],
  [-3.6, 19.6]];
PEC_FAR = [[-2.5, 22.5], [-1.2, 21.5], [-3.5, 18], [-6.2, 14], [-7.6, 13.3], [-7.4, 15.9], [-6.4, 19.2], [-5, 21.8]];
DRAPE = [[-13.4, 24.5], [-16.9, 24.5], [-16.9, 16.2], [-15.4, 15.6], [-14.9, 18.6], [-14.5, 16.8], [-13.9, 18.4], [-12.8, 21]];

// Fin rays: [x, z] points on the fin's face; the lens's half-thickness there puts them on its surface.
TAIL_RAYS = [[[5.5, 27.4], [10, 30], [15.5, 32.2]], [[5.5, 26.8], [9.5, 27.6], [13, 27.6]], [[5.5, 25.5], [8.4, 24.4], [10.2, 24.9]],
  [[5.4, 24.6], [8.6, 21], [11.4, 19]], [[5, 24], [8.6, 19.4], [13.6, 15]]];
function lensY(q) = 1.4 * sqrt(max(0.02, 1 - pow((q[0] - 11) / 10, 2) - pow((q[1] - 23.5) / 13, 2)));
DORSAL_RAYS = [[[-5, 35.4], [-4.5, 37.6], [-4.2, 39.4]], [[-2, 34.5], [0, 37.6], [2.3, 38.9]], [[0, 33.6], [2.5, 34.2], [4.4, 34]]];
function dorsalY(q) = 1.2 * sqrt(max(0.02, 1 - pow((q[0] + 2) / 9.5, 2) - pow((q[1] - 35) / 6.2, 2)));
module mirror_y() { children(); mirror([0, 1, 0]) children(); }

// The prism of a front-sheet outline for parts already inside pp() (lib's prism() adds its own pp()), grown by d.
module ppPrism(pts, d = 0.35) { rotate([90, 0, 0]) linear_extrude(height = 120, center = true) offset(delta = d) polygon(pts); }
// A thin fin: a lens (radii r at p) cut to the outline, pale, with a lighter rim band round its edge.
module finLens(pts, r, p) {
  color(fin) intersection() { translate(p) scale(r) sphere(1, $fn = 28); ppPrism(pts, -0.35); }
  color(finRim) intersection() {
    translate(p) scale(r) sphere(1, $fn = 28);
    difference() { ppPrism(pts); ppPrism(pts, -0.35); }
  }
}

// ---- Smoke ribbons (as rimeidol's streams): a Catmull-Rom curve through the points P, swept by thin flat ellipses
// (width Wv[i] at each point, tapering to a point at the last), hulled in short steps, the band's face along N (the
// viewer: -y inside pp()). rigs/wraithtide.mjs repeats the curve for the long curl.
CAM = [0, -1, 0];
RK = 3;   // hull steps per control segment
function _cr(P, s) = let(n = len(P), i = min(floor(s), n - 2), t = s - i,
  p0 = P[max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[min(i + 2, n - 1)])
  0.5 * ((2 * p1) + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
function _lin(V, s) = let(n = len(V), i = min(floor(s), n - 2), t = s - i) V[i] * (1 - t) + V[i + 1] * t;
function _unit(v) = v / norm(v);
module _rstep(P, Wv, N, th, s) {
  n = len(P);
  p = _cr(P, s);
  T = _unit(_cr(P, min(s + 0.05, n - 1)) - _cr(P, max(s - 0.05, 0)));
  wd = _unit(cross(N, T));
  nn = cross(T, wd);
  w = _lin(Wv, s);
  t = max(0.16, th * min(1, w / 1.4));
  multmatrix([[T[0] * 0.35, wd[0] * w, nn[0] * t, p[0]], [T[1] * 0.35, wd[1] * w, nn[1] * t, p[1]],
              [T[2] * 0.35, wd[2] * w, nn[2] * t, p[2]], [0, 0, 0, 1]]) sphere(1, $fn = 8);
}
module ribbon(P, Wv, N, th, c) {
  m = (len(P) - 1) * RK;
  color(c) for (j = [0 : m - 1]) hull() { _rstep(P, Wv, N, th, j / RK); _rstep(P, Wv, N, th, (j + 1) / RK); }
}
// pp coordinates [x, y, z]; the strands hang from inside the hood's underside.
CURL = [[-1.5, 0, 20.5], [0.6, 0, 16.2], [3.4, 0, 12.6], [3.7, 0, 8.8], [2.2, 0, 6], [-0.8, 0, 4.5], [-3.3, 0, 3.4],
  [-3.6, 0, 1.7], [-2.2, 0, 0.5]];
CURL_W = [3.6, 3.8, 3.4, 2.7, 2, 1.5, 1.1, 0.75, 0.25];
STRANDS = [
  [[[-7.2, 0.6, 21.5], [-7.6, 0.6, 18.4], [-6.9, 0.6, 15.6], [-7.4, 0.6, 13.6]], [6.6, 6.4, 4.4, 0.5], smoke],
  [[[-12.4, -1, 21], [-13, -1, 17], [-12, -1, 14], [-13, -1, 11.2], [-12.2, -1, 10.2]], [2.5, 2.4, 1.9, 1.1, 0.2], smokeDk],
  [[[-9, -2, 20.5], [-9.9, -2, 16.5], [-8.6, -2, 13.2], [-9.7, -2, 10.8], [-10.4, -2, 10.2]], [3.2, 3.1, 2.4, 1.2, 0.2], smoke],
  [[[-5.5, -2.6, 20.5], [-6.2, -2.6, 16.2], [-5, -2.6, 12.6], [-6.3, -2.6, 9.4], [-7.4, -2.6, 8.8]], [3.6, 3.6, 2.8, 1.4, 0.2], smokeLt],
  [[[-7, 2.4, 20], [-4.4, 2.4, 15.4], [-1.4, 2.4, 11.8], [0.4, 2.4, 8.4], [-0.6, 2.4, 6.6]], [3.8, 3.6, 2.8, 1.5, 0.2], smokeDk],
  [[[-11, 3, 20], [-11.6, 3, 15.6], [-10.5, 3, 12.4], [-11.3, 3, 10.4]], [2.8, 2.6, 1.7, 0.2], smoke],
];

// Skull (faces -Y, origin at the cranium's centre). Its place in the fish: SKULL_AT turned SKULL_YAW and scaled
// SKULL_S, inside pp().
SKULL_AT = [-10, -5.6, 30.1];
SKULL_YAW = -22;
SKULL_S = 1.3;
module skull() {
  // cranium, the cheekbone band under the eyes, the teeth block (the jaw)
  ell([5.4, 4.6, 4.6], [0, 0.2, 0.3], bone);
  ell([4.2, 3.4, 2.3], [0, -1.1, -2.5], bone);
  ell([2.8, 2.5, 1.9], [0, -1.7, -4.7], bone);
  // gaps between the four teeth, on the jaw's front
  for (x = [-1.4, 0, 1.4]) color(socket)
    translate([x, -1.7 - 2.5 * sqrt(1 - pow(x / 2.8, 2)) + 0.1, -5.1]) rotate([0, 0, x * 12]) cube([0.22, 0.6, 1.7], center = true);
  // nose: an inverted heart
  color(socket) hull() {
    translate([0, -4.3, -1.9]) sphere(0.25, $fn = 8);
    translate([0.45, -4.25, -3.0]) sphere(0.38, $fn = 10);
    translate([-0.45, -4.25, -3.0]) sphere(0.38, $fn = 10);
  }
  // the glowing socket eyes: a black socket round a glowing ball, a heavy black brow on top (the eye() numbers are
  // copied by the rig's eyeKit)
  for (sx = [-1, 1]) color(socket) translate([2.7 * sx, -3.25, -1]) rotate([0, 0, 24 * sx]) scale([2.1, 0.8, 2.1]) sphere(1, $fn = 20);
  eye([2.7, -3.6, -1.1], 1.35, iris = core, sclera = glow, pupil = core, yaw = 24, flat = 0.55, lid = 0.16, lid_tilt = 22,
      lid_c = socket, squint = 0, slit = 1, shine = true);
  eye([-2.7, -3.6, -1.1], 1.35, iris = core, sclera = glow, pupil = core, yaw = -24, flat = 0.55, lid = 0.16, lid_tilt = 22,
      lid_c = socket, squint = 0, slit = 1, shine = true);
  // the hood's pale rim framing the skull
  ell([6.2, 4.4, 5.8], [0, 1.4, -0.2], rim);
  // cyan flame plumes: from the far eye out towards the nose and licking up, from the near eye up round the cranium
  chain([[-4.2, -3.2, -1.1], [-5.6, -2.6, -1.4], [-6.6, -2.0, -0.4], [-6.3, -1.6, 0.9], [-7.0, -1.2, 2.0], [-6.5, -0.9, 3.1]],
        [0.7, 0.75, 0.65, 0.5, 0.32, 0.12], flame);
  chain([[4.0, -3.2, -0.4], [5.0, -2.5, 0.8], [5.5, -1.4, 2.0], [5.7, -0.2, 3.1], [5.3, 0.9, 4.0]], [0.65, 0.6, 0.5, 0.35, 0.12], flame);
}

pp(0) {
  // head / hood: a big round bulb, and the body tapering to the tail stalk
  blob([[[8.6, 6.8, 9.6], [-7.2, 0, 27.4]], [[6.5, 6, 7], [-0.5, 0, 28]]], teal);
  blob([[[5.2, 5, 5.6], [0.5, 0, 27.6]], [[2.2, 2.2, 2.6], [5, 0, 26.1]]], teal);
  // tail fan, forked, with darker rays on both faces from the stalk out to the lobes
  finLens(TAIL, [10, 1.4, 13], [11, 0, 23.5]);
  for (r = TAIL_RAYS) mirror_y() chain([for (q = r) [q[0], -lensY(q) + 0.12, q[1]]], [0.32, 0.26, 0.16], finDk);
  // dorsal sail
  finLens(DORSAL, [9.5, 1.2, 6.2], [-2, 0, 35]);
  for (r = DORSAL_RAYS) mirror_y() chain([for (q = r) [q[0], -dorsalY(q) + 0.12, q[1]]], [0.3, 0.24, 0.14], finDk);
  // pectorals, near and far, drooping back
  finLens(PEC, [6.5, 1, 6], [0, -3.6, 19.5]);
  finLens(PEC_FAR, [4.5, 1, 6], [-4.5, 3.6, 18]);
  // the ragged drape under the chin
  color(finDk) intersection() { translate([-15, 0, 20.5]) scale([2.6, 2.8, 6]) sphere(1, $fn = 20); ppPrism(DRAPE); }
  // smoke: wavy flat strands hanging from the body, the longest curling down to the ground
  for (st = STRANDS) ribbon(st[0], st[1], CAM, 0.9, st[2]);
  ribbon(CURL, CURL_W, CAM, 1.1, smoke);
  // the skull face
  translate(SKULL_AT) rotate([0, 0, SKULL_YAW]) scale(SKULL_S) skull();
}
