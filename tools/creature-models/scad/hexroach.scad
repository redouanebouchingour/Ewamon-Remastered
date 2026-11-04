// Hexroach: a low, cursed cockroach drawn side-on, head to the viewer's left.
// Checklist (front sheet, height 40, feet on z 0):
//  - body: a long low carapace, sheet x -14..26.5, z 9..30: a domed pronotum shield over the head (x -14..2), then
//    five abdomen plates tapering to a pointed rear tip (26.5, 18). Near-black shell, dusky purple plate tops, violet
//    seams between the plates (the back art: a grid of plates split by violet seams).
//  - markings: a jagged violet stripe along the near flank (x -6..16, z 15..21) with thorn-like spikes rising off
//    it (x 3, 6.5, 12.5), a second stripe on the rear (x 16..24, z 17..21), two shorter bands below (x 0..6 and
//    12..18, z 14..18), violet drops on the pronotum (x -16..-14 and -11..-9, z 18..24) and the cheeks.
//  - egg sacs: yellow-green glossy sacs on the upper flanks, green patches and pale glints on top: a long one over
//    the front (1.5, 32), a big one (14.5, 28) r 6.5, a small one at the rear (22, 23.5) r 2.4; the back art shows
//    two on each side, so the far side has its pair too (lower on the flank, hidden from the front).
//  - head: low and wedge-shaped under the shield, x -20..-8, z 10..21; ONE slanted almond orange eye with a pale
//    yellow core at (-9.3, 17.5), about 4.5 x 3.5, lower at the front (a glare); the far eye is its mirror.
//  - antennae: two long dark whips from the head top: the near one (-13, 21) arcs up and back over the body to
//    (8.6, 39), the far one curls up and forward to (-19.8, 31) and back to (-12.6, 39.8).
//  - limbs: six thick dark spiny legs spread wide and low; the front pair are raptorial with big yellow sickle
//    hooks: the far one raised in front of the head (elbow (-21.5, 21), hook down to (-28.5, 3.8)), the near one
//    lowered with its hook along the ground (tip (-8.5, 0.8)); the near rear leg reaches back to (31, 5).
//  - pose: drawn side-on, so the whole body is yawed 20 degrees to its right (YAW) on top of the 30 degree view.
include <lib.scad>

shell = [0.16, 0.13, 0.2];
shellHi = [0.27, 0.22, 0.34];
violet = [0.51, 0.16, 0.6, NOGLOW];
sacC = [0.82, 0.77, 0.24, NOGLOW];
sacHi = [0.94, 0.9, 0.42, NOGLOW];
moss = [0.36, 0.58, 0.16, NOGLOW];
glint = [0.99, 0.99, 0.73, NOGLOW];
hook = [0.86, 0.84, 0.3, NOGLOW];
eyeC = [1, 0.42, 0.08, NOGLOW];
eyeCore = [1, 0.86, 0.4, GLOW];
eyeDeep = [0.92, 0.3, 0.05, NOGLOW];

// The body is authored in its own frame (bx across, by along, the head towards -by) and turned YAW to its right.
// Fb(sheet x, sheet z, bx) is the body-frame point that lands on that spot of the front sheet at the side offset bx
// (the camera sees the body frame from VIEW + YAW, and looks 10 degrees down: deeper points read 0.17 / unit higher).
YAW = 20;
A = VIEW + YAW;
function Fb(sx, sz, bx) = let(by = (sx - cos(A) * bx) / sin(A), d = -sin(A) * bx + cos(A) * by) [bx, by, sz - 0.17 * d];
// The same without the height correction: feet stand on z = 0.
function Fz(sx, z, bx) = [bx, (sx - cos(A) * bx) / sin(A), z];

// Carapace: [sheet x, sheet z, rx, ry, rz]; 0 = pronotum, 1 = its front lip over the head, 2..6 abdomen plates.
PLATES = [[-4, 21.5, 11, 9, 8.6], [-11, 22.5, 9, 6, 6.2], [3, 19.5, 11.5, 8.6, 10], [8.5, 19.5, 11.2, 8.4, 9.4],
          [13.5, 18.8, 10, 8, 8.4], [18.5, 18.2, 7.8, 7, 7], [22.5, 17.8, 5, 5.2, 5.4]];
BELLY = [[9, 22, 5], Fb(8, 14.5, 0)];
HEAD = [[7, 7.2, 6], Fb(-14.5, 14.5, 0)];
SNOUT = [[4.2, 3.4, 3.4], Fb(-19, 12.5, 0)];
EYE = Fb(-9.6, 17.3, 6.1);
// Egg sacs [centre, radius, long axis stretch]: near front, near big, small rear (mirrored), far front, far big.
SACS = [[[7, -3.9, 30.5], 3.6, 1.8], [[7, 13, 27.5], 6.5, 1.12], [[5, 24.5, 21.5], 2.4, 1], [[-5, 24.5, 21.5], 2.4, 1],
        [[-8, -1, 27], 3.4, 1.7], [[-8.5, 13, 24], 6, 1]];
// Antennae (not mirrored): near (+X) and far.
ANT_N = [Fb(-13, 21, 2), Fb(-12.6, 27, 2.4), Fb(-10.2, 32, 2.8), Fb(-5.6, 35.8, 3.2), Fb(0, 38.2, 3.6), Fb(5, 39.2, 4),
         Fb(8.6, 39, 4.2)];
ANT_NR = [0.75, 0.7, 0.62, 0.55, 0.45, 0.33, 0.15];
ANT_F = [Fb(-16.5, 21, -2), Fb(-18.5, 26, -2.6), Fb(-19.8, 31, -3.2), Fb(-18.6, 35.2, -3.8), Fb(-16, 37.8, -4.2),
         Fb(-12.6, 39.8, -4.5)];
ANT_FR = [0.75, 0.68, 0.6, 0.5, 0.36, 0.15];
// Mandibles (mirrored): dark base, yellow hook.
MAND = [[2.4, -22.5, 14.5], [3.2, -25.2, 13.6], [2.6, -27.2, 12.2], [1.2, -28, 10.6]];
// Legs [hip, knee, foot, r]: the middle and rear pairs mirrored.
LEG2 = [Fb(5, 12, 6.5), Fb(10, 12, 12.5), Fz(3.5, 1.4, 14), 2.4];
LEG3 = [Fb(15, 11.5, 6.5), Fb(21.5, 11.5, 13), Fz(26.5, 1.4, 16), 2.4];
// Tarsi (from the foot, along the ground).
TARS2 = [2.6, -2.6, -0.4];
TARS3 = [2.4, 4.2, -0.4];
// Near front leg, lowered: hip, knee, ankle, then the hook along the ground.
LEG1N = [Fb(-5, 12.5, 6), Fb(-1, 13.5, 11.5), Fb(1.5, 7, 12.5), 2.3];
HOOK_N = [Fb(1.5, 7, 12.5), Fz(-2.5, 3, 12.5), Fz(-6, 1.2, 12), Fz(-8.5, 0.8, 11)];
HOOK_NR = [1.9, 1.6, 1.0, 0.1];
// Far front leg, raised before the head: hip, elbow, wrist, then the sickle hook hanging down.
LEG1F = [Fb(-13, 13, -6), Fb(-21.5, 20.5, -10.5), Fb(-27, 15.5, -11.5), 2.3];
HOOK_F = [Fb(-27, 16, -11.5), Fb(-28.6, 11.5, -11.5), Fb(-29, 7, -11), Fb(-28, 3.8, -10.5)];
HOOK_FR = [2.2, 1.9, 1.2, 0.12];

function pl(i) = Fb(PLATES[i][0], PLATES[i][1], 0);

// The shell volume (grown g): what the painted markings are laid on.
module shellVol(g = 0) {
  for (i = [0 : len(PLATES) - 1]) translate(pl(i)) scale([PLATES[i][2], PLATES[i][3], PLATES[i][4]] + [g, g, g])
    sphere(1, $fn = 28);
  translate(HEAD[1]) scale(HEAD[0] + [g, g, g]) sphere(1, $fn = 24);
  translate(SNOUT[1]) scale(SNOUT[0] + [g, g, g]) sphere(1, $fn = 16);
}

// A spiny leg: thick dark segments, a knobbly knee, spines along the shin, small toe claws.
module leg(hip, knee, foot, r, tars = undef) {
  limb(hip, knee, r * 1.25, r * 1.05, shell);
  color(shellHi) translate(knee) sphere(r * 1.2, $fn = 10);
  limb(knee, foot, r * 1.05, r * 0.6, shell);
  out = [sign(knee[0]), 0, 0];
  for (t = [0.3, 0.62]) spike(knee + (foot - knee) * t, out * 1.2 + [0, 0.6, 1.6], r * 0.45, 0.05, shell);
  spike((hip + knee) / 2, [0, 0.5, 1.8], r * 0.45, 0.05, shell);
  // A tarsus lying on the ground, ending in two hooked toes.
  if (tars != undef) {
    tip = foot + tars;
    limb(foot, tip, r * 0.6, r * 0.35, shell);
    for (a = [-40, 40]) spike(tip, rot2(tars, a) * 0.45 + [0, 0, -0.4], r * 0.32, 0.05, shell);
  }
}
function rot2(v, a) = [v[0] * cos(a) - v[1] * sin(a), v[0] * sin(a) + v[1] * cos(a), v[2]];

rotate([0, 0, -YAW]) {
  // ---- Carapace: alternating dark plates, violet seams at the front of each abdomen plate.
  for (i = [0 : len(PLATES) - 1]) {
    P = PLATES[i];
    color(i == 0 || i % 2 == 1 ? shellHi : shell) translate(pl(i)) scale([P[2], P[3], P[4]]) sphere(1, $fn = 28);
    if (i >= 3) color(violet) translate(pl(i) - [0, P[3] * 0.55, 0]) rotate([90, 0, 0])
      scale([P[2] * 0.97, P[4] * 0.97, 1]) cylinder(h = 0.5, r = 1, center = true, $fn = 28);
  }
  // A violet seam down the back between the two plate columns, and one behind the pronotum.
  color(violet) intersection() {
    shellVol(0.2);
    translate([-0.35, -2, 0]) cube([0.7, 34, 40]);
  }
  color(violet) translate(pl(0) + [0, 5.6, 1.4]) rotate([90, 0, 0]) scale([9.6, 6.6, 1])
    cylinder(h = 0.5, r = 1, center = true, $fn = 28);
  // Pointed rear tip.
  spike(Fb(24.6, 18, 0), [0, 4.2, 0.2], 2.4, 0.15, shell);
  ell(BELLY[0], BELLY[1], shell);

  // ---- Head: a low wedge under the shield, a blunt snout.
  ell(HEAD[0], HEAD[1], shell);
  ell(SNOUT[0], SNOUT[1], shell);

  // ---- Eyes: slanted orange almonds with a pale burning core, hooded at the front.
  mirror_x() eye(EYE, 2.9, iris = eyeC, sclera = eyeDeep, pupil = eyeCore, yaw = 52, flat = 0.5, lid = 0.34,
                 lid_tilt = 28, lid_c = shell, squint = 0.24, slit = 1.7, shine = false);

  // ---- Mandibles: dark bases curving to yellow hooks.
  mirror_x() {
    chain([MAND[0], MAND[1]], [1.1, 0.85], shell);
    chain([MAND[1], MAND[2], MAND[3]], [0.85, 0.5, 0.08], hook);
  }

  // ---- Antennae.
  chain(ANT_N, ANT_NR, shell);
  chain(ANT_F, ANT_FR, shell);

  // ---- Egg sacs: glossy, a lighter cap, a mossy patch and a glint turned to the light.
  for (k = [0 : len(SACS) - 1]) {
    s = SACS[k];
    c = s[0];
    r = s[1];
    st = [1, s[2], 1];
    up = [0.45 * sign(c[0]), -0.35, 0.82];
    color(sacC) translate(c) scale(st) sphere(r, $fn = 20);
    color(sacHi) intersection() {
      translate(c) scale(st) sphere(r + 0.12, $fn = 20);
      translate(c + [up[0] * r * 0.6, -0.2 * r, up[2] * r * 0.9]) sphere(r * 0.75, $fn = 14);
    }
    if (k != 2 && k != 3) color(moss) intersection() {
      translate(c) scale(st) sphere(r + 0.22, $fn = 20);
      translate(c + [up[0] * r * 0.55, 0.3 * r * s[2], up[2] * r * 0.85]) sphere(r * 0.42, $fn = 12);
    }
    color(glint) intersection() {
      translate(c) scale(st) sphere(r + 0.3, $fn = 20);
      translate(c + [up[0] * r * 0.5, -0.55 * r * s[2], r * 0.78]) sphere(r * 0.2, $fn = 8);
    }
  }

  // ---- Legs.
  mirror_x() {
    leg(LEG2[0], LEG2[1], LEG2[2], LEG2[3], TARS2);
    leg(LEG3[0], LEG3[1], LEG3[2], LEG3[3], TARS3);
  }
  // Near front leg, its sickle hook laid forward along the ground.
  leg(LEG1N[0], LEG1N[1], LEG1N[2], LEG1N[3], undef);
  chain(HOOK_N, HOOK_NR, hook);
  // Far front leg raised before the head, a yellow spur on the upper arm and the sickle hanging down.
  leg(LEG1F[0], LEG1F[1], LEG1F[2], LEG1F[3], undef);
  chain(HOOK_F, HOOK_FR, hook);
  spike((LEG1F[0] + LEG1F[1]) / 2 + [0, 0, -1], [0, -0.8, -3.4], 0.8, 0.05, hook);
}

// ---- Violet markings painted on the near flank, the pronotum and the cheeks (front-sheet outlines).
MARKS = [
  [[-6.5, 15.4], [0, 16.8], [5, 18.2], [10, 18.8], [14, 19.6], [14.5, 21.3], [13.2, 21.4], [12.6, 24.3], [11.8, 21.4],
   [7.5, 21.2], [6.6, 25], [5.9, 21.1], [3.5, 20.6], [2.9, 22.4], [2.3, 20.4], [0, 19.4], [-4, 17.6], [-6.8, 16.6]],
  [[16.3, 21.2], [23.8, 18.3], [23.8, 17.2], [16.5, 19.6]],
  [[0.4, 15], [6.2, 17.6], [6, 18.6], [0.4, 16.6]],
  [[12.6, 14.3], [18.4, 16.6], [18.2, 17.6], [12.8, 15.8]],
  [[-16.4, 23.7], [-13.8, 23.4], [-14.4, 20], [-15.2, 18.2], [-16, 20.5]],
  [[-11.3, 23.5], [-9, 23.2], [-9.4, 21], [-10.8, 21]],
  [[-5.4, 25.4], [-3.7, 25], [-4, 23.8], [-5.2, 24]],
  [[-19.7, 14.6], [-17, 15.1], [-17.4, 12.6], [-19.4, 12.2]],
  [[-11, 14.8], [-8.2, 14.4], [-8.8, 11], [-10.6, 11.4]],
];
color(violet) intersection() {
  rotate([0, 0, -YAW]) shellVol(0.25);
  union() for (m = MARKS) prism(m);
}
