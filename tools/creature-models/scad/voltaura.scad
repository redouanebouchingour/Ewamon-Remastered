// Voltaura: a slim navy-blue electric biped leaning forward, a rounded helmet head in near profile with one angry
// yellow eye, two long gold blade-horns sweeping up and back into whip tips with blue sparks, big pale-yellow
// lightning-bolt wings rimmed in electric cyan (an upper and a lower bolt per side), a gold lightning bolt down the
// chest, the right arm out front holding a gold netted orb in a clawed palm, the left arm hanging with a gold bolt
// bracer and gold claws, digitigrade legs with gold toe claws, and a long gold tail that leaves the hip as two cords,
// loops out to its left and ends in a blue crystal in a gold cup.
//
// Checklist (front sheet; LOCAL sheet x = sheet x + OX, the hips at scad x = 0):
// - head: dome x -9.7..-3.8, z 26.2..31.1; muzzle down-left, no mouth; one eye (-6.4, 28.2) yellow almond, slanted,
//   gold brow band over it that runs back over the head into the near horn. The far eye is hidden (head in profile).
// - horns: near (-4.5, 30.5) -> (-1, 35.5) -> whip tip (2.8, 36.7); far (-9.3, 29) -> (-7, 34.5) -> tip (-3.6, 37.3);
//   blade ~1.5 wide, tips thin with cyan spark flames.
// - neck thick (sheet -5..-1.5 at z 25), gold collar band at its base.
// - chest V: shoulders (pads) near (-0.5, 22.5), far (-6.8, 21.8); waist z 15; gold bolt x -6.8..-1.3, z 14..24.3.
// - far arm (viewer-left): out front at z 16..18 to the palm (-14.3, 18.5); gold bolt on the forearm; gold finger
//   claws up round the orb; orb (-14, 22.8) r 2.1 gold, dark net seams, a cyan arc round it.
// - near arm: upper arm down-out to the elbow (3.8, 19.6), forearm with gold bolt bracer to the wrist (1.6, 13.6),
//   four gold claws down to z 9.5.
// - legs digitigrade: far knee (-6.8, 9), hock (-4.8, 5.5), foot (-6, 2) toes left; near knee (0, 9), hock (2.3, 5.5),
//   foot (3.3, 1) facing the viewer; gold toe claws.
// - wings: near upper bolt root (1, 21..25) to tip (17.3, 37.2), zigzag teeth; near lower bolt to (10.8, 11.8); the far
//   pair peeks out at x -11.4..-6. Pale yellow, cyan rim (the rim glows).
// - tail: two cords from the hip (3.5, 13) down to (9, 4.5), one gold tube with a grey groove round the loop to
//   (16.4, 8.5), up to (14.5, 14.8), gold cup and blue crystal (15.5, 17.2).
// - back: shoulder gold bands, the wing roots, the tail root at the lower back.
include <lib.scad>

OX = 2.25;                       // sheet x -> local sheet x (the hips at scad x = 0)
function sh(pts) = [for (p = pts) [p[0] + OX, p[1]]];
CAM = [0.5, -0.866, 0];           // towards the preview camera, in the ground plane

blue = [0.08, 0.28, 0.53, NOGLOW];
blueDk = [0.05, 0.19, 0.4, NOGLOW];
gold = [0.9, 0.84, 0.3, NOGLOW];
goldDk = [0.45, 0.41, 0.2, NOGLOW];
groove = [0.54, 0.55, 0.5, NOGLOW];
wingFill = [0.94, 0.97, 0.69, NOGLOW];
wingRim = [0.6, 0.86, 0.95, NOGLOW];
sparkC = [0.67, 0.91, 0.96, GLOW];
crystal = [0.3, 0.55, 0.85, NOGLOW];
eyeY = [0.96, 0.86, 0.24, NOGLOW];

module torus(R, r, c) { color(c) rotate_extrude($fn = 28) translate([R, 0]) circle(r, $fn = 8); }

// ---- Head (centre H): a rounded helmet in near profile, the muzzle forward and down.
H = [-0.9, -7, 28.6];
module headMass(g = 0) {
  translate(H) hull() {
    translate([0, 0.4, 0.75]) scale([2.55 + g, 2.75 + g, 2.1 + g]) sphere(1, $fn = 26);
    translate([0, -2.5, -0.5]) scale([2.0 + g, 2.4 + g, 1.7 + g]) sphere(1, $fn = 22);
    translate([0, -2.6, -1.65]) scale([1.45 + g, 1.6 + g, 1.0 + g]) sphere(1, $fn = 18);
  }
}
color(blue) headMass();
// Eyes on the sides of the muzzle, looking out and forward: the near one faces the camera, the far one is
// hidden by the profile as drawn. Angry: hooded, slanted, slit pupil, a glint.
EYE = [1.85, -3.0, -0.5];
for (s = [1, -1]) {
  p = [H[0] + s * EYE[0], H[1] + EYE[1], H[2] + EYE[2]];
  eye(p, 1.0, iris = eyeY, sclera = eyeY, pupil = [0.05, 0.09, 0.18], yaw = s * 46, shine = true, flat = 0.5,
      lid = 0.28, lid_tilt = 28, lid_c = blue, slit = 0.3);
}
// Gold blade-horns: a brow band from the front of the eye over it and the crown, then up and back into a whip.
HORN = [[1.45, -4.0, 0.15], [2.05, -2.2, 1.2], [2.05, -0.2, 1.95], [2.25, 2.0, 4.1], [2.7, 4.6, 5.9],
        [3.1, 7.6, 6.4], [3.6, 11.8, 6.0]];
HORN_R = [0.24, 0.38, 0.75, 0.9, 0.55, 0.26, 0.12];
for (s = [1, -1]) {
  chain([for (q = HORN) [H[0] + s * q[0], H[1] + q[1], H[2] + q[2]]], HORN_R, gold);
  // Spark flame at the tip.
  t = HORN[len(HORN) - 1];
  tp = [H[0] + s * (t[0] + 0.2), H[1] + t[1] + 0.3, H[2] + t[2] + 0.2];
  ell([0.75, 0.75, 0.85], tp, sparkC);
  spike(tp + [0, 0, 0.5], [s * 0.2, 0.2, 1.3], 0.45, 0.05, sparkC);
}

// ---- Neck, leaning forward from the chest top to the head.
chain([[0, -2.5, 22.8], [-0.35, -4.4, 25.6], [-0.8, -6.0, 27.6]], [1.75, 1.45, 1.25], blue);
// Gold collar round its base.
translate([0, -2.75, 23.6]) rotate([-38, 0, 0]) torus(1.75, 0.38, gold);

// ---- Torso: a V chest leaning forward over a thin waist and narrow hips.
module chest(g = 0) {
  hull() {
    translate([0, -2.6, 22.6]) scale([3.3 + g, 2.0 + g, 1.5 + g]) sphere(1, $fn = 26);
    translate([0, -2.2, 20.3]) scale([3.0 + g, 2.2 + g, 2.4 + g]) sphere(1, $fn = 26);
    translate([0, -1.2, 16.8]) scale([1.9 + g, 1.7 + g, 1.8 + g]) sphere(1, $fn = 20);
  }
}
color(blue) chest();
ell([1.8, 1.6, 2.0], [0, -0.5, 15.2], blue);                   // waist
ell([2.6, 2.2, 2.0], [0, 0.3, 12.6], blue);                    // pelvis
// Gold lightning bolt down the chest, laid flush on the front of the chest.
CHEST_BOLT = [[-1.3, 24.4], [-3.2, 21.2], [-2.6, 19.6], [-4.3, 18.6], [-3.3, 17.3], [-4.6, 13.9], [-5.6, 16.5],
              [-6.1, 18.2], [-6.9, 19.8], [-6.7, 21.4], [-6.0, 22.4], [-5.2, 21.3], [-3.6, 22.9], [-1.9, 24.7]];
color(gold) intersection() {
  chest(0.22);
  prism(sh(CHEST_BOLT));
  translate(CAM * 1.6) chest(0.22);
}

// ---- Shoulders: rounded blue pads with a gold band round each upper arm.
mirror_x() {
  ell([1.55, 1.6, 1.7], [3.7, -2.6, 22.1], blue);
}

// ---- Near arm (+X, viewer-right): hangs with the elbow a little back, gold bolt bracer, four claws down.
ARM_N = [[3.7, -2.6, 22.0], [6.7, 0.4, 19.6], [6.2, -3.0, 13.8]];
limb(ARM_N[0], ARM_N[1], 1.1, 0.95, blue);
limb(ARM_N[1], ARM_N[2], 1.3, 1.1, blue);
translate(ARM_N[0] + [0.9, 0.6, -0.8]) rotate([0, 0, 45]) rotate([0, 90, 0]) torus(1.0, 0.25, gold);
ell([1.05, 1.0, 1.1], [6.1, -3.2, 13.0], blue);                // hand
NEAR_BRACER = [[3.6, 20.9], [4.4, 19.7], [2.9, 17.9], [3.9, 16.2], [2.2, 14.2], [2.6, 16.4], [1.4, 18.3], [3.0, 19.4]];
color(gold) intersection() {
  limb(ARM_N[1], ARM_N[2], 1.5, 1.3, gold);
  prism(sh(NEAR_BRACER));
  translate(CAM * 1.2) limb(ARM_N[1], ARM_N[2], 1.5, 1.3, gold);
}
for (k = [-1.5, -0.5, 0.5, 1.5])
  spike([6.1, -3.3, 12.6] + [0.866, 0.5, 0] * k * 0.75, [k * 0.35, -0.5, -2.7], 0.36, 0.05, gold);

// ---- Far arm (-X, viewer-left): out in front, palm up under the orb.
ARM_F = [[-3.7, -2.6, 22.0], [-3.7, -3.4, 17.3], [-7.2, -8.0, 17.5]];
limb(ARM_F[0], ARM_F[1], 1.1, 1.0, blue);
limb(ARM_F[1], ARM_F[2], 1.3, 1.1, blue);
translate(ARM_F[0] + [-0.3, 0, -1.2]) torus(1.0, 0.25, gold);
FAR_BRACER = [[-6.0, 17.4], [-9.0, 18.3], [-8.0, 17.0], [-11.2, 16.6], [-10.6, 15.8], [-6.6, 16.6]];
color(gold) intersection() {
  limb(ARM_F[1], ARM_F[2], 1.5, 1.3, gold);
  prism(sh(FAR_BRACER));
  translate(CAM * 1.2) limb(ARM_F[1], ARM_F[2], 1.5, 1.3, gold);
}
HAND_F = [-8.4, -9.5, 18.3];
ell([1.3, 1.3, 0.85], HAND_F, blue);
// Four claws curl up on the outer side of the palm, a thumb on the inner side.
for (a = [100, 140, 180, 220, 330])
  spike(HAND_F + [cos(a) * 1.05, sin(a) * 1.05, 0.3], [cos(a) * 0.55, sin(a) * 0.55, 2.0], 0.38, 0.05, gold);
// The orb: gold, a dark net of seams, a cyan arc of charge round it.
ORB = [-8.2, -9.3, 22.9];
color(gold) translate(ORB) sphere(2.1, $fn = 26);
translate(ORB) {
  rotate([90, 0, 30]) torus(2.08, 0.13, goldDk);
  rotate([0, 90, 30]) torus(2.08, 0.13, goldDk);
  rotate([45, 0, -60]) torus(2.08, 0.13, goldDk);
  for (a = [0, 180]) rotate([68, 0, -10]) rotate([0, 0, a + 20]) color(sparkC) rotate_extrude(angle = 110, $fn = 28) translate([2.95, 0]) circle(0.2, $fn = 6);
}

// ---- Legs: digitigrade, the knee forward, the hock back, gold toe claws.
module leg(hip, knee, hock, ankle, toe, s) {
  limb(hip, knee, 2.2, 1.4, blue);
  limb(knee, hock, 1.45, 1.15, blue);
  limb(hock, ankle, 1.15, 0.95, blue);
  blob([[[1.1, 1.1, 0.85], ankle - [0, 0, 0.55]], [[0.95, 0.95, 0.65], toe]], blue);
  d = toe - ankle;
  dir = d / norm(d);
  side = [-dir[1], dir[0], 0];
  for (k = [-1, 0, 1])
    spike(toe + dir * 0.4 + side * k * 0.55 + [0, 0, -0.1], dir * 1.2 + side * k * 0.35 + [0, 0, -0.35], 0.33, 0.05, gold);
}
leg([-1.9, 0.3, 12.3], [-3.8, -2.4, 9.0], [-3.6, 1.2, 5.5], [-3.8, -0.4, 1.4], [-4.6, -2.9, 0.7]);
leg([1.9, 0.3, 12.3], [4.2, -2.6, 9.2], [5.4, 0.4, 5.2], [5.9, -0.8, 1.4], [7.0, -2.9, 0.7]);

// ---- Wings: the upper and lower bolt per side in one plane through the root, swept 33 deg back, a pale fill
// with a cyan rim a little wider and thinner. Outlines are the front sheet's (x + WX = distance from the root).
WX = 1.0;
WSWEEP = 33;
WING_UP = [[-0.5, 21.0], [1.2, 20.9], [4.8, 21.1], [9.7, 21.9], [8.3, 23.0], [14.5, 26.9], [11.6, 27.6], [17.4, 37.3],
           [16.6, 37.4], [12.1, 34.5], [5.2, 30.7], [1.2, 27.9], [3.9, 26.0], [1.2, 24.0], [-0.5, 23.5]];
WING_LO = [[0, 15.0], [5.2, 15.5], [10.7, 12.2], [7.7, 16.6], [9.8, 17.7], [4.8, 19.3], [0.5, 19.8]];
function wsh(pts) = [for (p = pts) [p[0] + WX, p[1]]];
mirror_x() translate([1.2, 0.4, 0]) rotate([0, 0, WSWEEP]) {
  for (w = [WING_UP, WING_LO]) {
    plate(wsh(w), 1.1, 0.1, wingFill, grow = -0.45);
    plate(wsh(w), 0.7, 0.1, wingRim, grow = 0.4);
  }
}

// ---- Tail: two gold cords from the hip, merging into one tube with a grey groove round the loop, a gold cup and a
// blue crystal at the tip.
T_ROOT = [[0, 2.5, 13.6], [5.25, 2.4, 12.6], [8.5, 1.8, 9.8], [10.3, 1.2, 6.3], [12.5, 0.8, 4.4]];
chain(T_ROOT, [0.55, 0.42, 0.4, 0.42, 0.55], gold);
chain([for (p = T_ROOT) p + [0.65, 0, 0.65]], [0.5, 0.38, 0.36, 0.38, 0.5], gold);
T_LOOP = [[12.5, 0.8, 4.4], [16.5, 0.4, 3.7], [20.4, 0, 4.9], [21.9, 0, 7.6], [21.6, 0, 10.2], [20.3, 0, 12.6],
          [19.6, 0, 14.8], [20.0, 0, 16.0]];
T_LOOP_R = [0.7, 0.72, 0.72, 0.7, 0.62, 0.5, 0.42, 0.42];
chain(T_LOOP, T_LOOP_R, gold);
chain([for (i = [0 : 4]) T_LOOP[i] + CAM * 0.42 + [0, 0, 0.1]], [0.4, 0.45, 0.45, 0.42, 0.35], groove);
// Gold cup and the crystal.
for (a = [-38, 38]) petal([0.45, 0.45, 1.0], [20.05, 0, 16.0], [0, a, 0], gold);
ell([0.95, 0.9, 1.35], [20.4, 0, 17.4], crystal);
ell([0.55, 0.5, 0.85], [20.45, -0.45, 17.5], sparkC);
