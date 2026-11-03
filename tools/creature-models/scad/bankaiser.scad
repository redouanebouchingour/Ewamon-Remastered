// Bankaiser, rebuilt from the measurement sheet (front height 40, feet z = 0).
//
// Checklist (front sheet x, z; the art's creature axis sits about 2 to the right of the sheet's x = 0, so a point read
// at sheet x sx is placed with S(sx, z, y) = fromSheet(sx - 2, z, y)):
// - Body plan: a hulking, hunched armoured demon beast buried in a huge shaggy mantle of black feather shards, as wide
//   as it is tall (x -19..19 with the blade, z 0..40). The head sits LOW between the shoulders (no neck), the mass is
//   widest at z 10..30, two short bent armoured legs with big clawed feet stand wide under the hem.
// - Head: a white horned beast skull (x -2..2.5, z 32..37.3) set in a black shaggy hood (x -5..5, z 30..39) with three
//   ragged tufts on top; a short snout pointing down with little fangs (z 32..33).
// - Eyes: two red angry slashes in black sockets, slanted up to the outer corner: near (0.7, 35), far (-2.6, 34.8).
// - Horn: ONE, on the creature's right (-X): a pale bone horn from (-3.6, 36) to its tip (-4.7, 39.8). The back art
//   has the same single horn on that side.
// - Collar: a red gem on the chest (-0.5, 27.5) in a fan of crimson feathers (x -12..7, z 22..30), the far side
//   draped over the right shoulder.
// - Near (+X) shoulder: a white bone pauldron jutting up towards the head (1.5..7.5, 29..33); the near arm hangs in bone
//   armour (6..10, 15..28), a bone claw hand at (8, 16).
// - Far (-X) arm reaches out to grip the blade inside its curve (-15, 20).
// - Blade: a huge white crescent (a moon scythe) on the viewer's left, outer edge x -18.7 at z 24, tips (-12.5, 34)
//   and (-9.5, 13.6), a grey bevel on its inner edge, standing in the picture plane.
// - Mantle: dark feather shards in shades of black and grey, ragged only at the silhouette: long shards sweeping out
//   to the right (+X) at z 20..31 (to x 19), down to the left under the blade at z 8..15 (to x -19), a ragged hem at
//   z 6..9 between and beside the legs.
// - Red ribbons: curling flames rising behind both shoulders (-11..-7, 30..36.5) and (6..10, 26..34), a loop at
//   (8..14, 18..22), a flame by the blade's foot (-19..-14, 12..16), a red chain across the near hem (6..18, 5..12)
//   and a ribbon between the legs (-4..3, 4.5..8.5).
// - Legs: black armour with red trims and a white bone knee guard; feet with three red talons each: far foot stepped
//   forward (-13..-6, 0..6), near foot (4..11, 0..6).
// - Back: the shaggy mantle all round, a pale bone back plate (ribs, spine) between the two mantle halves at z 18..34,
//   the blade on the viewer's right, the horn.
// - Glow: nothing in the sheet glows; the red eyes get a faint glow, every other bright colour NOGLOW.
include <lib.scad>

ink     = [0.06, 0.06, 0.07];
black   = [0.12, 0.13, 0.14];
dark    = [0.21, 0.21, 0.23];
grey    = [0.31, 0.32, 0.34];
bone    = [0.89, 0.89, 0.88, NOGLOW];
boneMid = [0.73, 0.72, 0.72, NOGLOW];
steel   = [0.49, 0.50, 0.50];
crimson = [0.50, 0.07, 0.10];
red     = [0.80, 0.20, 0.25, NOGLOW];
gem     = [0.87, 0.16, 0.20, NOGLOW];
gemHi   = [1, 0.62, 0.64, NOGLOW];
eyeRed  = [0.95, 0.12, 0.14, GLOW];

function S(sx, z, y = 0) = fromSheet(sx - 2, z, y);
// a low-poly ellipsoid for the small parts
module lo(r, p, c, fn = 12) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// A broad feather shard: a flat leaf from its base p along d, w wide and t thick, its flat face turned out.
module shard(p, d, w, t = 0.9, c = dark) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) hull() {
    translate([0, 0, l * 0.3]) scale([t, w, l * 0.32]) sphere(1, $fn = 8);
    translate([0, 0, l]) scale([0.15, 0.25, 0.1]) sphere(1, $fn = 4);
  }
}
SH = [black, dark, grey];

// ---- Torso and mantle -------------------------------------------------------------------------------------------
// the armoured torso under the mantle (its front shows between the mantle's sides)
blob([[[7, 5.6, 5.5], [0, 0.5, 25]], [[6.3, 5.2, 5], [0, 0, 16]]], black);
// the cloak's front edges hanging from the yoke over the chest's sides (wider on the far side)
for (f = [[-6.5, -3.8, 28, [-1.2, -1.6, -13], 3.4, dark], [-8, -2.5, 27, [-2.5, -1.2, -14], 3.4, black],
          [-4.6, -4.6, 22, [-0.8, -1.4, -10], 2.6, grey], [6.5, -3.8, 26, [1, -1.6, -11], 3, dark],
          [7.8, -2.2, 25, [2, -1, -12], 3.2, black]])
  shard([f[0], f[1], f[2]], f[3], f[4], 1, f[5]);
// the shoulder yoke and the cape mass behind (the smooth part of the mantle; the shards make its ragged rim)
ell([10.5, 7.5, 3.6], [0, 1.5, 29.5], dark);
blob([[[9, 5, 4], [0, 5, 28]], [[11, 6, 5], [0, 6, 19]], [[10, 5.5, 3], [0, 5.5, 11]]], dark);
// bone back plate: spine and ribs showing at the back between the cape's two shaggy sides
color(boneMid) intersection() {
  blob([[[9.3, 5.3, 4.3], [0, 5, 28]], [[11.3, 6.3, 5.3], [0, 6, 19]]]);
  translate([-4.5, 6, 17.5]) cube([9, 10, 15]);
}
for (z = [19.5 : 2.6 : 30]) lo([3.6, 1.1, 0.75], [0, 11.6 - (z - 19) * 0.1, z], bone);
lo([0.9, 1.2, 7], [0, 11.8, 25], bone, 14);
// the shard tiers: [z, rx, ry, out, down, width, gap half-angle]
TIERS = [[31.5, 9.5, 6.5, 6, 6, 3.4, 52], [24.5, 10.5, 7, 7, 8, 3.6, 55], [16, 10, 7, 4.5, 10.5, 3.8, 30]];
for (ti = [0 : 2]) let(T = TIERS[ti]) for (k = [0 : 16]) let(a = -90 + T[6] + k * (360 - 2 * T[6]) / 16,
    ca = cos(a), sa = sin(a), nearX = ca > 0.35 && ti < 2, farLow = ca < -0.35 && ti == 2, nearLow = ca > 0.35 && ti == 2)
  if (ti == 2 || abs(a - 90) > 20) shard([T[1] * ca, 2.5 + T[2] * sa, T[0] + (k % 2) * 0.8],
        [(T[3] + (nearX ? 4 : 0) + (farLow ? 4 : 0) + (nearLow ? 4 : 0)) * ca, T[3] * 0.8 * sa, -T[4] + (nearX ? 2.5 : 0) - (k % 2) * 1.2],
        T[5], 1, SH[(k + ti) % 3]);
// the shaggy collar round the hood, over the yoke's top (art z 30..34)
for (k = [0 : 11]) let(a = -90 + 40 + k * 280 / 11)
  shard([6.5 * cos(a), 1.5 + 4.8 * sin(a), 33], [5 * cos(a), 3.5 * sin(a), -3.5 - (k % 2)], 2.8, 0.9, SH[(k + 2) % 3]);
// the near flank's long horizontal sweep (art x 11..19, z 20..31)
for (s = [[S(9, 30.5, 2), [8, 0, 0], 2.6], [S(10, 27, 3), [9.5, 1, -1.5], 2.8], [S(10, 23.5, 3), [9.5, 1, -2.5], 2.8],
          [S(10, 19.5, 3), [8, 1, -4], 2.6], [S(9, 15.5, 2), [8, 0.5, -5.5], 2.8], [S(8, 12, 1), [6.5, 0, -6], 2.6]])
  shard(s[0], s[1], s[2], 1, s[0][2] > 25 ? grey : dark);
// the far side's low sweep under the blade (art x -19..-13, z 8..15)
for (s = [[S(-10, 15, -1), [-8, -2, -3], 2.8], [S(-9.5, 12.5, -2), [-8.5, -2.5, -4], 2.6], [S(-8, 10.5, -3), [-5, -2, -3.5], 2.2]])
  shard(s[0], s[1], s[2], 1, s[0][2] > 13 ? black : dark);
// the front hem between the legs (art z 7..10)
for (x = [-3.2, 0, 3.2]) shard([x, -4.2, 14.5], [x * 0.4, -1.5, -8.5], 2.6, 0.9, x == 0 ? dark : black);

// ---- Collar: the red gem in a fan of crimson feathers --------------------------------------------------------------
for (m = [-1, 1]) for (i = [0 : 3]) let(a = (m > 0 ? 30 : 8) + i * 20)
  shard([m * (1.5 + i * 1.6), -5.8 + i * 0.5, 28.8], [m * 7.5 * cos(a), -1.5, -7 * sin(a) + 1.5], 2.3, 0.7, i % 2 == 0 ? crimson : red);
// draped over the far (-X) shoulder towards the blade (art x -12..-7, z 24..30)
for (i = [0 : 2]) shard([-7 - i * 1.5, -4.5 + i, 29.5 - i * 0.6], [-5, -1.5, -3 - i], 2.3, 0.7, i == 1 ? red : crimson);
lo([4, 1.4, 1.2], [0, -5.6, 29], crimson, 16);
color(gem) translate([0, -6.9, 27.3]) rotate([90, 0, 0]) scale([1, 1.25, 0.75]) sphere(1.7, $fn = 6);
color(gemHi) translate([0.5, -8.1, 28]) sphere(0.4, $fn = 8);
// the cloak drape crossing the chest from the far shoulder, and the armour's hip plates with red trims
for (f = [[-3.5, -5.6, 25, [3, -0.6, -8], 2.6, grey], [-1, -5.8, 22.5, [3.4, -0.4, -7.5], 2.4, dark],
          [1.8, -5.6, 21, [2.6, -0.6, -7], 2.2, black]])
  shard([f[0], f[1], f[2]], f[3], f[4], 0.8, f[5]);
mirror_x() {
  color(crimson) translate([4, -4.2, 14.8]) rotate([0, 0, -25]) scale([3.2, 1.6, 2.6]) sphere(1, $fn = 14);
  color(black) translate([4, -4.5, 15.5]) rotate([0, 0, -25]) scale([3, 1.6, 2.2]) sphere(1, $fn = 14);
}
lo([1.4, 0.9, 2], [-4.5, -5.6, 19], bone, 12);
spike([-4.5, -6, 19.5], [-0.8, -1, -3.2], 0.8, 0.08, bone);

// ---- Head: a white horned beast skull in a black shaggy hood --------------------------------------------------------
HC = S(-0.6, 34.6, -4.8);
HEAD_YAW = 16;
EYE = [1.15, -2.95, 0.55];
translate(HC) rotate([0, 0, HEAD_YAW]) {
  // hood and the mane round the skull: a shaggy black hood, three ragged tufts on top, locks down the sides
  ell([4, 3.7, 3.7], [0, 1.3, 0.5], black);
  for (t = [[-2.3, 0.6, 2.8, [-0.8, 0.6, 2.4]], [0.1, 0.4, 3.4, [0.3, 0.8, 2.2]], [2.5, 0.7, 2.8, [1.1, 0.8, 2.3]]])
    shard([t[0], t[1], t[2]], t[3], 1.6, 0.8, t[0] == 0.1 ? dark : black);
  mirror_x() shard([3.4, 0.2, 1.4], [2.2, 0.6, -4], 2, 0.8, dark);
  mirror_x() shard([3, 2.4, 2.4], [2.6, 2, -3], 2, 0.8, black);
  // the skull: a wide brow and cheekbones narrowing to a short snout pointing down, little fangs
  blob([[[2.1, 1.6, 1.7], [0, -1.6, 1.1]], [[1.9, 1.3, 1], [0, -1.9, 0]]], bone);
  blob([[[1.3, 1.1, 1.1], [0, -2.1, -0.6]], [[0.8, 0.8, 0.7], [0, -2.5, -2]]], bone);
  for (x = [-0.45, 0.45]) spike([x, -3.05, -2.3], [0, -0.1, -0.8], 0.26, 0.04, bone);
  lo([0.55, 0.3, 0.25], [0, -3.25, -1.85], ink);
  // eye sockets and the angry red eyes (outer corner up)
  mirror_x() translate(EYE + [0, 0.25, 0.05]) rotate([0, -24, 24]) scale([1.05, 0.5, 0.55]) color(ink) sphere(1, $fn = 14);
  mirror_x() eye(EYE, 0.6, iris = eyeRed, sclera = eyeRed, pupil = eyeRed, yaw = 24, lid = 0.48, lid_tilt = 34,
                 lid_c = ink, squint = 0.3);
  // heavy brow ridges over the eyes
  mirror_x() translate([1.15, -2.7, 1.3]) rotate([0, -24, 24]) scale([1.2, 0.5, 0.35]) color(bone) sphere(1, $fn = 12);
  // the single horn, on the creature's right (-X)
  chain([[-1.4, -0.6, 2.1], [-1.9, -0.3, 3.8], [-2.3, 0.1, 5.3], [-2.5, 0.6, 6.3]], [0.9, 0.65, 0.38, 0.08], boneMid);
}

// ---- Near (+X) arm in bone armour; the bone pauldron ----------------------------------------------------------------
SHL = [9.5, -2, 29];  ELL = [10, -5, 21.5];  WRL = [10, -6.5, 17];
translate(SHL + [0, -0.3, 1.2]) rotate([0, -18, 0]) scale([3.2, 2.8, 1.5]) color(bone) sphere(1, $fn = 18);
spike(SHL + [-1, -1.3, 2], [-5.5, -1.2, 2.6], 1, 0.1, bone);
spike(SHL + [1.4, -0.8, 1.6], [1.6, -0.4, 1.6], 0.6, 0.06, boneMid);
limb(SHL, ELL, 2.2, 1.9, black);
lo([1.8, 1.4, 2.6], (SHL + ELL) / 2 + [0.3, -1.2, 0], bone, 16);
limb(ELL, WRL, 1.8, 1.6, bone);
lo([1.3, 1.3, 1.3], ELL, steel);
blob([[[1.6, 1.4, 1.2], WRL + [0, -0.4, -0.8]]], boneMid);
for (a = [-35, 0, 35]) spike(WRL + [sin(a) * 1, -1.2, -1.4], [sin(a) * 0.5, -0.8, -1.6], 0.35, 0.04, ink);

// ---- Far (-X) arm, reaching out to the blade's grip --------------------------------------------------------------
SHR = [-9.5, -1, 29];  ELR = [-13.6, -3.2, 24.5];  WRR = [-15.8, -5.6, 21];   // the hand on the blade's inner edge
limb(SHR, ELR, 2.2, 1.9, black);
limb(ELR, WRR, 1.8, 1.5, black);
lo([1.7, 1.3, 2.2], (ELR + WRR) / 2 + [0, -0.8, 0], bone, 16);
lo([1.5, 1.5, 1.5], WRR, boneMid);
// the black grip along the blade's inner edge under the hand
limb([-15, -5.2, 18.3], [-16.2, -5.9, 23.8], 0.7, 0.7, black);

// ---- The crescent blade, in the picture plane on the viewer's left ------------------------------------------------
BLADE_D = 3;
CRES = [[-12.3, 34.8], [-14.9, 33.2], [-17.1, 30.2], [-18.6, 26.2], [-19, 22.2], [-18.2, 18.6], [-16.2, 15.9],
        [-13.2, 14.2], [-9.4, 13.4], [-11.2, 15.6], [-13.4, 17.6], [-14.7, 19.9], [-15.1, 23.5], [-14.8, 27.5],
        [-13.9, 31]];
BEVEL = [[-13.9, 31], [-14.8, 27.5], [-15.1, 23.5], [-14.7, 19.9], [-13.4, 17.6], [-11.2, 15.6], [-12.4, 15.8],
         [-14.4, 17.9], [-15.8, 20.3], [-16.2, 23.5], [-15.9, 27.5], [-14.9, 31]];
pp(BLADE_D) translate([-2, 0, 0]) {
  plate(CRES, 1.2, 0.3, bone, 0.3);
  translate([0, -0.35, 0]) plate(BEVEL, 0.7, 0.2, steel, 0.2);
}

// ---- Legs: black armour, red trims, bone knee guards, clawed feet with red talons ---------------------------------
module legSet(hip, knee, ankle, toe, kneeBone) {
  limb(hip, knee, 3, 2.4, black);
  limb(knee, ankle, 2.2, 1.6, black);
  lo([1.9, 1.3, 2.3], knee + [0, -1.6, 0.4], kneeBone ? bone : steel, 14);
  color(crimson) translate(knee + [0, -0.4, -2.2]) scale([2.2, 2, 0.5]) sphere(1, $fn = 12);
  blob([[[2.1, 2.2, 1.4], ankle + [0, 0, -1.6]], [[1.9, 1.4, 1], toe + [0, 1, 0]]], black);
  for (a = [-30, 0, 30]) let(dd = toe - ankle, h = atan2(dd[0], -dd[1]))
    spike(toe + [sin(a + h) * 1.3, -cos(a + h) * 0.2, -0.1], [sin(a + h) * 1.2, -cos(a + h) * 1.8, -0.9], 0.45, 0.05, red);
}
legSet([-5, -1, 13], [-8.5, -5.5, 8.5], [-9.6, -6.2, 3.2], [-10.6, -9.2, 1.1], false);
legSet([5, 0, 13], [8, -3.5, 8.5], [9, -3.2, 3.2], [9.6, -6.6, 1.1], true);

// ---- Red ribbons and the chain (flat ribbons traced on the sheet, stood in the picture plane at their depth) --------
module ribbon(pts, r, d, c = red, t = 0.9) {
  color(c) pp(d) translate([-2, 0, 0]) rotate([90, 0, 0]) linear_extrude(height = t, center = true)
    for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) circle(r * (1 - 0.5 * i / len(pts)), $fn = 10);
                                          translate(pts[i + 1]) circle(r * (1 - 0.5 * (i + 1) / len(pts)), $fn = 10); }
}
// flames curling up behind the shoulders
ribbon([[-7.5, 29.2], [-9.6, 30.4], [-10.9, 32], [-10, 33.5], [-8.6, 34.3], [-8.4, 35.6], [-9.6, 36.7]], 1.1, 6);
ribbon([[6.4, 26.4], [8.6, 27.6], [9.6, 29.4], [8.3, 31], [8.1, 32.6], [9.4, 33.8]], 1, 5);
// the loop by the near arm
ribbon([[8.6, 18.4], [11, 17.9], [13.4, 19.3], [13.6, 21.2], [11.8, 22], [10.4, 20.8]], 0.75, 0);
// the flame by the blade's foot
ribbon([[-13.6, 13.8], [-15.6, 12.3], [-18.4, 12.6], [-18.7, 14.6], [-16.9, 15.6]], 0.9, -1);
// ribbons trailing between the legs and round the far foot
ribbon([[-4, 5.4], [-1.5, 6.6], [1, 6.4], [3, 5.2]], 0.8, -7, crimson);
ribbon([[-13, 2.6], [-11, 3.4], [-8.8, 2.6]], 0.6, -6, crimson);
// the red chain across the near hem: oval links face-on and edge-on in turn
for (i = [0 : 4]) let(c = [7.2 + i * 2.6, 7.2 + i * 0.9], ang = 18)
  color(red) pp(-6.5 + i * 0.6) translate([-2, 0, 0]) rotate([90, 0, 0]) linear_extrude(height = i % 2 == 0 ? 0.7 : 1.4, center = true)
    translate(c) rotate(ang) if (i % 2 == 0) difference() { scale([1.6, 1]) circle(1, $fn = 14); scale([0.9, 0.4]) circle(1, $fn = 10); }
    else scale([1.7, 0.45]) circle(1, $fn = 10);
