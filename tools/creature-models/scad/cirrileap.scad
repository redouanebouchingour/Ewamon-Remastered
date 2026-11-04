// Cirrileap, rebuilt from the measurement sheet (front height 40, the near front hoof on z = 0).
//
// Checklist (front sheet x, z):
// - Body plan: a leaping cloud ram seen side-on, facing the viewer's left. One big billowy cloud body, x -16..17.5,
//   z 8..26: soft overlapping round billows, pale periwinkle on top and in front (the chest ruff), mid blue under and
//   behind. Long along Y (chest y -16, rump y 15), so the 30 degree view halves it; wide like a cloud.
// - Head: a slim pale ram face looking at the viewer, nose down, x -13.5..-8.2, forehead z 29, muzzle z 21.5, sitting
//   in the cloud ruff. Turned 15 degrees towards the camera.
// - Eyes: two small dark navy almond eyes, gently slanted, a white glint: far (-12.4, 24.9), near (-10, 24.8).
// - Nose / mouth: a small dark mouth line and nostrils at the muzzle tip, (-11.5, 22.2).
// - Horns: golden-brown ram horns with dark ridges, curling round from the top of the head: the near one a big coil
//   seen nearly face-on (x -8.8..-2, z 25.9..31.8, coil centre (-4.6, 28.2)), the far one edge-on, its tip out to
//   (-15, 27).
// - Wings: two big feathered wings swept up and back from the shoulders, pale coverts along the leading edge, then a
//   row of light feathers, then long blue primaries; near wing root (3.5, 24.5), tip (16.7, 40), primaries out to
//   (19.5, 36), (18.7, 30); far wing behind the head, x -19.5..-13, z 22..39.
// - Legs mid-leap: near front reaching down-forward, hoof on the ground (-9, 0.5); far front reaching further forward
//   and up (-16.5, 3.5); both hind legs tucked under, shadowed dark blue, hooves at (9.5, 5) and (0.5, 7.5). A pale
//   cloud cuff on each front leg (z 6..11), slim blue shins, small split hooves.
// - Tail: a curling cloud wisp out the back (15..18, 17..24), small curls under the rump.
// - Back: the same cloud body, the wing roots, the horns curling at the right, cloud tail at the left.
// - Glow: nothing glows.
include <lib.scad>

cloud    = [0.55, 0.70, 0.95, NOGLOW];
cloudHi  = [0.66, 0.78, 0.97, NOGLOW];
cloudMid = [0.47, 0.64, 0.93, NOGLOW];
face     = [0.80, 0.88, 0.99, NOGLOW];
legC     = [0.41, 0.58, 0.85];
legDeep  = [0.27, 0.43, 0.77];
hoof     = [0.15, 0.28, 0.63];
wingCov  = [0.62, 0.75, 0.97, NOGLOW];
wingLt   = [0.51, 0.66, 0.94, NOGLOW];
wingMid  = [0.38, 0.54, 0.88, NOGLOW];
wingDeep = [0.25, 0.41, 0.78];
horn     = [0.66, 0.53, 0.40];
hornDark = [0.40, 0.27, 0.16];
ink      = [0.06, 0.12, 0.38];
eyeC     = [0.05, 0.08, 0.25];

// A cloud billow: a flattened ball.
module puff(p, r, c) { color(c) translate(p) scale([r, r, r * 0.88]) sphere(1, $fn = r < 3 ? 14 : 18); }
// a low-poly ellipsoid for the small parts (the game smooths the shading)
module lowEll(r, p, c, fn = 14) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// ---- Body: a soft core under big overlapping billows (x, y, z, r, shade: 0 cloud, 1 pale, 2 mid)
blob([[[7.5, 7.5, 7], [0, -10, 15.5]], [[7.5, 8.5, 6.5], [0, 9, 16]]], cloudMid);
PUFFS = [
  // the chest ruff, pale, under and round the head
  [-4.5, -14.5, 13.5, 5.2, 1], [3, -15.5, 12.5, 4.6, 1], [-5, -12.5, 19.5, 5.2, 1], [1.5, -15, 19, 5, 1],
  [-1, -10, 24, 4.8, 1], [4, -9, 23.5, 4.2, 1], [1.5, -5, 28, 3.2, 1], [3.5, -2.5, 27, 3.8, 1], [2.5, -4.5, 31, 1.7, 1],
  [-6, -15, 10.5, 3.6, 1], [0, -17, 10.5, 3.2, 1],
  // the middle
  [7, -3, 16, 5.2, 0], [-7, -3, 16, 5.2, 0], [5, 1, 22, 5.2, 0], [-5, 1, 22, 5, 0], [0, -4, 11.5, 4.6, 2],
  // the rump
  [7, 8, 15, 5.4, 0], [-7, 8, 15, 5.2, 0], [4, 10, 21.5, 5.2, 0], [-4, 10, 21.5, 5, 0], [1, 15.5, 16, 5.6, 0], [6, 14, 18, 4.5, 0],
  [3, 13, 11.5, 4, 2], [-3, 13, 11.5, 4, 2]];
SHADE = [cloud, cloudHi, cloudMid];
for (p = PUFFS) puff([p[0], p[1], p[2]], p[3], SHADE[p[4]]);
// the tail: a cloud wisp curling up out of the rump, swung out a little to the creature's left
TAIL = [[3, 18.5, 19, 4.4], [5, 21, 22.8, 2.8], [4.5, 20.5, 25.6, 1.6]];
for (p = TAIL) puff([p[0], p[1], p[2]], p[3], cloudHi);
// small curls hanging under the rump
puff([7, 16, 11], 3.2, cloudMid);
puff([8.5, 18.5, 9.5], 1.8, cloudMid);

// ---- Legs, mid-leap: [cuff, shin top, hoof]
LEG_FL = [[2.2, -17.5, 7], [2, -18, 5], [1.6, -19.8, 1.9]];          // near front, hoof on the ground
LEG_FR = [[-3.8, -18.7, 9], [-3.9, -19.6, 7], [-4.7, -23.2, 4.3]];   // far front, reaching forward
LEG_B  = [[4.5, 10, 10.5], [4.5, 10.5, 9.5], [4.5, 11.8, 5.6]];      // hind legs, tucked
module hoofAt(p, o) { lowEll([1.45, 1.8, 1], p + o, hoof); }
module foreleg(L) {
  lowEll([2.8, 2.8, 3.4], L[0], cloudHi, 18);
  limb(L[1], L[2], 1.35, 1.05, legC);
  hoofAt(L[2], [-0.2, -0.6, -0.9]);
}
foreleg(LEG_FL);
foreleg(LEG_FR);
mirror_x() {
  lowEll([2.6, 2.8, 2.8], LEG_B[0], cloudMid, 16);
  limb(LEG_B[1], LEG_B[2], 1.45, 1.1, legDeep);
  hoofAt(LEG_B[2], [0, -0.5, -0.9]);
}

// ---- Head, in its own frame: centre HP, turned HY towards the camera
HP = [-1.8, -19, 25];
HY = 15;
EYE = [1.4, -2.45, 0.2];
HORN = [1.9, 0.9, 4.2];
module ramHorn() {
  // a coil in the XZ plane from its root at the origin, round over the top and down, curling in, edging outward (-Y)
  n = 16;
  r0 = 3.8;
  C = [-r0 * cos(150), 0, -r0 * sin(150)];
  function pt(i) = let(a = 150 - i * 350 / n, r = r0 - 2.9 * i / n) C + [r * cos(a), -0.14 * i, r * sin(a)];
  for (i = [0 : n - 1]) color(i % 3 == 2 ? hornDark : horn) hull() {
    translate(pt(i)) sphere(1.35 - 0.85 * i / n, $fn = 9);
    translate(pt(i + 1)) sphere(1.35 - 0.85 * (i + 1) / n, $fn = 9);
  }
}
translate(HP) rotate([0, 0, HY]) {
  // a long ram face, the nose tipped down
  blob([[[2.9, 3, 2.8], [0, 0.6, 1.6]], [[1.6, 1.9, 1.6], [0, -2.3, -2.3]]], face);
  mirror_x() eye(EYE, 0.6, iris = eyeC, sclera = eyeC, pupil = eyeC, yaw = 20, shine = true, lid = 0.15, lid_tilt = 12, lid_c = face);
  // nostrils and a small mouth
  mirror_x() ell([0.2, 0.15, 0.13], [0.45, -3.95, -1.6], ink);
  chain([[-0.55, -3.8, -2.95], [0, -3.95, -2.8], [0.55, -3.8, -2.95]], [0.12, 0.12, 0.12], ink);
  // the horns: coils facing out and forward
  mirror_x() translate(HORN) rotate([0, 0, 45]) ramHorn();
}

// ---- Wings, in the wing's own frame (u = X out along the wing, v = Z up, the face towards -Y), root at the origin
WING_ROOT = [6.5, -8, 22];
WING_YAW = 25;
WING_ROLL = [0, 8];
WING_K = 1;
PB = [[5.5, 9.5], [5.2, 8.4], [4.8, 7.2], [4.4, 6], [4, 4.8], [3.5, 3.6], [3, 2.5], [2.4, 1.4], [1.8, 0.4], [1.2, -0.6]];
PT = [[15.7, 17.9], [17.5, 16], [18.5, 13.5], [18.5, 10.5], [17.7, 7.8], [15.5, 5.2], [12.5, 2.6], [9.5, 0], [7.2, -2.4], [5, -4]];
module feather(b, t, w, y, c) {
  B = [b[0], y, b[1]];
  T = [t[0], y, t[1]];
  color(c) hull() {
    translate(B) scale([w * 0.8, 0.5, w * 0.8]) sphere(1, $fn = 10);
    translate(B + (T - B) * 0.6) scale([w, 0.45, w]) sphere(1, $fn = 10);
    translate(T) scale([w * 0.5, 0.3, w * 0.5]) sphere(1, $fn = 8);
  }
}
module wing() {
  // the pale shoulder of the wing, from the root out to the fan's base arc
  blob([[[2, 1.3, 2], [0, -0.6, 0]], [[1.4, 1.1, 1.4], [PB[0][0], -0.6, PB[0][1]]],
        [[1.4, 1.1, 1.4], [PB[len(PB) - 1][0], -0.6, PB[len(PB) - 1][1]]]], wingCov);
  // three rows of feathers fanning from that arc: pale coverts, a light middle row, the long blue primaries
  for (i = [0 : len(PB) - 1]) feather(PB[i], PB[i] + (PT[i] - PB[i]) * 0.4, 1.5, -0.7, wingCov);
  for (i = [1 : 2 : len(PB) - 1]) feather(PB[i], PB[i] + (PT[i] - PB[i]) * 0.68, 1.3, -0.2, wingLt);
  for (i = [0 : len(PB) - 1]) feather(PB[i], PT[i], 1.4, 0.3 + 0.2 * i, i % 2 == 0 ? wingMid : wingDeep);
}
// the near (+X) wing raised, the far one tipped down a little more (the art draws them so)
translate(WING_ROOT) rotate([0, 0, WING_YAW]) rotate([0, WING_ROLL[0], 0]) scale(WING_K) wing();
mirror([1, 0, 0]) translate(WING_ROOT) rotate([0, 0, WING_YAW]) rotate([0, WING_ROLL[1], 0]) scale(WING_K) wing();
