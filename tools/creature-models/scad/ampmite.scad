// Ampmite: a low, wide armoured olive beetle-mite. Remodelled from the sprite 2026-11-03.
//
// Checklist (front sheet, units; the art is drawn side-on, head at the lower left, abdomen to the upper right):
//   body plan   a long low carapace (thorax + a tapering segmented abdomen), yawed 20 degrees towards the creature's
//               right (BODY_YAW) so its length reads as drawn; the head faces the camera's usual way (-Y)
//   head        x -15..-1, z 6..19: a big rounded green helmet, a lighter brow plate, hanging low in front of the body
//   eyes        two big amber compound domes, near one at (-5.5, 14) r 2.5, far one at (-14.5, 13) half hidden; a dark
//               amber band through the middle, a pale shine top front, a slate bezel; rust cheek armour behind each
//   mouth       slate mandibles with grey teeth at (-12..-7, 7..10.5), two gold fangs hanging to z 5, orange nostril
//               spots under the eyes
//   antennae    thin slate stalks from the crown: the near one up and right to (2, 28), the far one up and left to
//               (-20, 27), each ending in a yellow spark burst (to z 40 / 37)
//   carapace    olive segments with lighter top plates and rust lower rims, gold rivets and side bosses
//   bulbs       two gold glass capacitor domes on the back: A over the thorax (-5, 26) r 4.3, B on a stalk over the
//               abdomen (12.5, 28.5) r 5, each with a slate band, faint filament rings and lightning bursting off it
//   legs        six thin slate legs splayed wide, high knees, grey armoured shins, three-pronged rust claw feet:
//               far front foot (-18, 4), near middle (5.5, 2), near rear (19.5, 9)
//   back        the abdomen's segment bands and rust side plates, two rust cerci at the tip
include <lib.scad>

green = [0.53, 0.51, 0.2];
greenDark = [0.38, 0.37, 0.16];
greenLight = [0.6, 0.6, 0.24];
rust = [0.56, 0.26, 0.09];
orange = [0.74, 0.44, 0.11, NOGLOW];
gold = [0.8, 0.55, 0.13, NOGLOW];
goldDark = [0.52, 0.31, 0.07];
pale = [0.98, 0.93, 0.58, NOGLOW];
spark = [0.98, 0.9, 0.48, GLOW];
slate = [0.26, 0.21, 0.26];
slateMid = [0.4, 0.35, 0.39];
grey = [0.62, 0.57, 0.6];
clawC = [0.5, 0.2, 0.08];

BODY_YAW = -20;
HC = [-3.4, -13.6, 11.2];   // head centre (world frame, facing -Y)

module bodyF() rotate([0, 0, BODY_YAW]) children();

// ---- Carapace: thorax (first two) and abdomen (the rest), in the body frame.
SEGS = [
  [[0, -5.6, 12.6], [6.2, 4.4, 5.4]],
  [[0, -0.6, 13.2], [7.4, 4.8, 6]],
  [[0, 4.8, 12.8], [7.6, 4.2, 6]],
  [[0, 9.2, 11.8], [7, 3.8, 5.6]],
  [[0, 13, 10.2], [5.9, 3.4, 4.8]],
  [[0, 16.2, 8.6], [4.5, 2.8, 3.8]],
  [[0, 18.8, 7.2], [3, 2.1, 2.7]],
];
// The shell: a smooth dark-olive hull per pair of neighbouring segments (the line sags towards the tail), a rust rim
// along its lower edge, and per segment a raised olive plate (the dark hull shows between them as the seams) with a
// lighter top plate on it.
module shellPair(i, dz = 0, k = [1, 1, 1]) {
  hull() for (j = [i, i + 1]) let(p = SEGS[j][0], r = SEGS[j][1])
    translate(p + [0, 0, dz * r[2]]) scale([r[0] * k[0], r[1] * k[1], r[2] * k[2]]) sphere(1, $fn = 20);
}
bodyF() {
  for (i = [0 : len(SEGS) - 2]) {
    color(greenDark) shellPair(i);
    color(rust) shellPair(i, -0.3, [1.05, 0.96, 0.7]);
  }
  for (i = [0 : len(SEGS) - 1]) let(p = SEGS[i][0], r = SEGS[i][1]) {
    color(green) translate(p) scale([r[0] * 0.97, r[1] * 0.9, r[2] * 1.07]) sphere(1, $fn = 20);
    color(greenLight) translate(p + [0, -r[1] * 0.1, r[2] * 0.6]) scale([r[0] * 0.62, r[1] * 0.58, r[2] * 0.52]) sphere(1, $fn = 14);
  }
  // neck collar
  color(slate) translate([0, -9.3, 11.2]) scale([4.4, 2.6, 4.2]) sphere(1, $fn = 16);
  // gold rivets on top and bosses on the thorax flanks
  for (s = [0 : 3]) mirror_x() color(gold) translate(SEGS[s][0] + [2.3, -0.4, SEGS[s][1][2] * 0.93]) sphere(0.55, $fn = 8);
  mirror_x() color(gold) translate([7, -0.6, 12.4]) sphere(1.2, $fn = 12);
  // rust cerci at the tail tip
  mirror_x() spike([1.1, 20.2, 6.4], [0.6, 1.6, -2.4], 0.6, 0.1, rust);
}

// ---- Capacitor bulbs (body frame): gold glass on a socket, a slate band, faint filament rings, a pale shine.
BULB_A = [[-1, -5.6, 22.6], 4.3, 17];   // centre, radius, socket foot z
BULB_B = [[3.6, 10.6, 23.6], 4.9, 15];
module bulb(p, r, foot) {
  color(gold) translate(p) sphere(r, $fn = 30);
  color(pale) translate(p + [r * 0.15, -r * 0.62, r * 0.52]) sphere(r * 0.24, $fn = 10);
  color(slate) translate(p) rotate([78, 0, 25]) rotate_extrude($fn = 30) translate([r * 1.0, 0]) circle(0.42, $fn = 6);
  color(goldDark) for (a = [-40, 40]) translate(p) rotate([0, 0, a]) rotate([0, 90, 0]) rotate_extrude($fn = 30) translate([r * 0.99, 0]) circle(0.18, $fn = 4);
  // socket: a slate cup under the glass and a green stalk down into the shell
  color(slate) translate(p - [0, 0, r * 0.97]) cylinder(h = r * 0.3, r1 = r * 0.5, r2 = r * 0.62, $fn = 16);
  color(green) translate([p[0], p[1], foot]) cylinder(h = p[2] - r * 0.9 - foot, r1 = 2.2, r2 = 1.6, $fn = 14);
  color(greenLight) translate([p[0], p[1], p[2] - r * 1.05]) scale([1, 1, 0.55]) sphere(2.1, $fn = 14);
}
bodyF() {
  bulb(BULB_A[0], BULB_A[1], BULB_A[2]);
  bulb(BULB_B[0], BULB_B[1], BULB_B[2]);
}

// ---- Spark burst: a forked bolt, two crossed plates so it reads from every side (about 10.5 tall, base at 0).
BOLT = [[-0.45, 0], [0.45, 0], [0.8, 2.6], [2.2, 3.4], [2.7, 5.2], [1.5, 4.4], [1.1, 5.6], [1.7, 8.2], [2.9, 9.7],
  [1.4, 9.2], [0.9, 11.4], [0.2, 9.2], [-1, 10.3], [-0.5, 7.6], [-1.9, 6.6], [-2.2, 4.9], [-0.7, 5.4], [-0.4, 2.8]];
module burst(s = 1) {
  for (a = [0, 90]) rotate([0, 0, a]) scale(s) plate(BOLT, 0.6, 0.15, spark, grow = 0.1);
}
// bulb sparks (body frame): [anchor, tilt [rx, ry], scale]
SPARKS = [
  [BULB_A[0] + [-1.6, -1.2, 3.6], [-15, -28], 0.62],
  [BULB_B[0] + [0.6, 0.2, 4.6], [0, 6], 0.72],
  [BULB_B[0] + [3.6, -1.6, 2.6], [-10, 55], 0.55],
];
bodyF() for (k = SPARKS) translate(k[0]) rotate([k[1][0], k[1][1], 0]) burst(k[2]);

// ---- Head (world frame, centre HC).
EYE = [5.4, -2, 1.1];           // near (left) eye centre, head frame
EYE_R = [2.4, 2.8, 3.05];     // dome radii: along its outward normal, across, up
EYE_YAW = -35;
ANT = [[1.9, -2.6, 5], [4.4, -2.4, 8.6], [8.2, -1, 12.4], [12.2, 1.2, 15.6]];
ANT_R = [0.55, 0.5, 0.45, 0.4];
MAND = [[2.6, -3.8, -3.6], [2.3, -5.8, -4.4], [0.9, -6.8, -4.8]];
MAND_R = [1.2, 0.9, 0.45];
FANG = [[3.1, -4.4, -4.2], [3.3, -5, -6.3], [2.8, -5.4, -7.5]];
FANG_R = [0.75, 0.6, 0.25];
translate(HC) {
  // skull and brow plate
  color(green) scale([6, 5, 5.8]) sphere(1, $fn = 26);
  color(greenLight) translate([0, -1.3, 3]) scale([4.6, 3.8, 2.8]) sphere(1, $fn = 20);
  color(greenDark) translate([0, -3.6, 3.4]) scale([0.7, 1.4, 1.6]) sphere(1, $fn = 10);
  mirror_x() {
    // compound eye: amber dome, darker band, shine, slate bezel
    translate(EYE) rotate([0, 0, EYE_YAW]) {
      color(gold) scale(EYE_R) sphere(1, $fn = 22);
      color(goldDark) intersection() {
        scale(EYE_R * 1.03) sphere(1, $fn = 22);
        translate([-0.2, -4, -1.5]) cube([4, 8, 1.1]);
      }
      color(pale) translate([1.9, -0.95, 1.35]) sphere(0.7, $fn = 10);
      color(slate) translate([-0.25, 0, 0]) rotate([0, 90, 0]) scale([EYE_R[2] / EYE_R[1], 1, 1])
        rotate_extrude($fn = 22) translate([EYE_R[1] * 0.98, 0]) circle(0.38, $fn = 6);
    }
    // rust cheek armour behind the eye
    color(rust) translate([5.1, 2.4, -1.9]) rotate([0, 0, -12]) scale([2, 4, 4.7]) sphere(1, $fn = 18);
    // orange nostril spots
    color(orange) translate([2.1, -4.7, -1.4]) scale([1, 0.6, 0.8]) sphere(1, $fn = 10);
    // mandibles with grey teeth, and the gold fangs below
    chain(MAND, MAND_R, slate);
    spike([1.6, -6, -4.6], [0, -0.3, -1.3], 0.42, 0.08, grey);
    spike([0.7, -6.6, -4.8], [0, -0.2, -1.1], 0.35, 0.08, grey);
    chain(FANG, FANG_R, gold);
    // antenna and its spark burst
    chain(ANT, ANT_R, slate);
    translate(ANT[3]) rotate([0, 18, 0]) burst(0.95);
  }
}

// ---- Legs (body frame): a slate femur out to the knee, a grey armoured shin, a three-pronged rust claw foot.
LEGS = [
  [[5, -6, 10.2], [10.8, -10.4, 11.6], [13.5, -13.6, 0]],
  [[6.4, -1.2, 10.2], [12.8, -2.2, 12], [16, -3, 0]],
  [[6.4, 3.8, 10.2], [14.2, 8.4, 11.4], [17.5, 12, 0]],
];
ANKLE = 1.45;
module leg(hip, knee, foot) {
  ank = [foot[0], foot[1], ANKLE];
  mid = knee + (ank - knee) * 0.5;
  color(slate) translate(hip) sphere(1.5, $fn = 12);
  limb(hip, knee, 1.2, 0.95, slate);
  color(slateMid) translate(knee) sphere(1.25, $fn = 12);
  limb(knee, mid, 1.45, 0.95, slateMid);
  limb(mid, ank, 0.75, 0.55, slate);
  // claws: forward along the leg's reach and splayed either side of it
  h = atan2(foot[1] - hip[1], foot[0] - hip[0]);
  for (a = [-55, 0, 55]) let(d = [cos(h + a), sin(h + a), 0])
    chain([ank, ank + d * 1.3 + [0, 0, 0.1], ank + d * 2.2 + [0, 0, -1.3]], [0.55, 0.4, 0.12], clawC);
}
bodyF() mirror_x() for (l = LEGS) leg(l[0], l[1], l[2]);
