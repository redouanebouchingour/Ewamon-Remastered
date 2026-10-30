// Team Ewamon HQ from outside (mirevale.house5; rig: rigs/npc/ewa_hq_front.mjs, static): the things four students
// building a game together put in front of their Amsterdam student house in 2022. Only props; the house is the game's.
// 1 unit = 1 cm. Origin = the plan's door point (the door warp and the gravel path) on the facade wall plane at ground
// level; the facade runs along X (x -450..450), outside is -Y, the wall plane is y = 0 (only things fixed flat on the
// wall reach y 0..-12). The rendered door is NOT at the origin: the building generator puts it at x 65..175 (2.1 m
// tall over a 45 cm plinth), its steps at x 55..185, y 0..-75. Kept clear on the ground: the whole band x -95..250,
// y 0..-170 (steps, the walk-in approach x -80..80, y -47..-167, and the strip between); the street lantern at
// (-190, -150) and the flower patch round (214, -150) stand in front of the props; ground props stay within y 0..-100.
//
//   the logo: a blade sign on an iron bracket at x = 220, just right of the door (y 0..-74, z 158..234), the team's
//             Yaschamp logo (_ewa_screens.scad ewa_logo, their Discord / WhatsApp picture) on both faces, "TEAM
//             EWAMON HQ" under it; a wooden plank sign on the wall at x -33..33, z 180..204, over the approach
//   the bike rack (x -440..-150): two Amsterdam staples with two Dutch bikes each, one per member (red = Red1 with
//             the crate on the front carrier, blue, yellow, black)
//   the bench group (x 262..445): a pallet bench with a crate of energy drinks on its seat, a cushion with the laptop,
//             the Wi-Fi router on the backrest; at the end the green paper bin whose lid will not shut, a stack of
//             pizza boxes leaning on it
//   warm string lights along the wall (x -440..440, z 236..250)
// Ground footprints for collision (x, y centre; half extents x, y): bike rack (-295, -53); 145, 47; bench group
// (354, -52.5); 92, 42.5.
include <../lib.scad>
include <_ewa_screens.scad>

$fa = 12;
$fs = 2;

IRON = [0.1, 0.1, 0.11, NOGLOW];
STEEL = [0.55, 0.56, 0.58, NOGLOW];
TYRE = [0.07, 0.07, 0.075, NOGLOW];
RIM = [0.75, 0.76, 0.78, NOGLOW];
LEATHER = [0.36, 0.22, 0.12, NOGLOW];
WOOD = [0.72, 0.55, 0.34, NOGLOW];
WOOD_DARK = [0.5, 0.35, 0.2, NOGLOW];
PALLET = [0.8, 0.68, 0.48, NOGLOW];
CARD = [0.82, 0.68, 0.48, NOGLOW];
BIN = [0.13, 0.42, 0.22, NOGLOW];
NAVY = [0.11, 0.15, 0.28, NOGLOW];
GILT = [0.9, 0.72, 0.28, NOGLOW];
CREAM = [0.96, 0.93, 0.84, NOGLOW];
WARM = [1.0, 0.8, 0.42, GLOW];

module box(c, lo, hi) color(c) translate(lo) cube(hi - lo);
module tube(pts, r, c) color(c) for (i = [0 : len(pts) - 2]) hull() {
  translate(pts[i]) sphere(r, $fn = 8);
  translate(pts[i + 1]) sphere(r, $fn = 8);
}
FONT = "Liberation Sans:style=Bold";

// ---- a Dutch bike (front towards +X, wheels on z = 0, centred on y = 0) -------------------------------------------

module wheel(c) rotate([90, 0, 0]) {
  color(TYRE) rotate_extrude($fn = 28) translate([28.4, 0]) circle(r = 2.2, $fn = 8);
  color(RIM) rotate_extrude($fn = 28) translate([26, 0]) square([1.6, 1.8], center = true);
  color(RIM) cylinder(h = 8, r = 2.6, center = true, $fn = 10);
  color(RIM) for (a = [0 : 45 : 315]) rotate([0, 0, a]) rotate([0, 90, 0]) cylinder(h = 25.5, r = 0.3, $fn = 4);
  // the mudguard over the top
  color(c) rotate([0, 0, 15]) rotate_extrude(angle = 150, $fn = 24) translate([31.6, 0]) square([1, 5.2], center = true);
}
module bike(c, crate = false) {
  RA = [-44, 0, 30.6];
  FA = [44, 0, 30.6];
  BB = [-6, 0, 28];
  translate(RA) wheel(c);
  translate(FA) wheel(c);
  // the step-through frame: two low down tubes, the seat tube, stays, the fork
  tube([[32, 0, 74], [18, 0, 52], [4, 0, 36], BB], 2.1, c);
  tube([[33, 0, 68], [16, 0, 44], [2, 0, 31], BB], 1.8, c);
  tube([BB, [-17, 0, 80]], 2.1, c);
  tube([[33, 0, 66], [30, 0, 84]], 2.4, c);
  for (m = [-1, 1]) {
    tube([BB, RA + [0, m * 4, 0]], 1.3, c);
    tube([[-15, 0, 76], RA + [0, m * 4, 0]], 1.3, c);
    tube([[33, m * 2.5, 68], FA + [0, m * 4, 0]], 1.5, c);
  }
  // stem and the swept-back bars with black grips
  tube([[30, 0, 84], [28, 0, 96]], 1.4, STEEL);
  for (m = [-1, 1]) {
    tube([[28, 0, 96], [22, m * 12, 99], [10, m * 21, 97]], 1.2, STEEL);
    tube([[10, m * 21, 97], [3, m * 23, 95]], 1.7, TYRE);
  }
  // saddle and seat post
  tube([[-17, 0, 80], [-18, 0, 86]], 1.3, STEEL);
  color(LEATHER) hull() {
    translate([-15, 0, 88]) scale([7, 7, 2.4]) sphere(1, $fn = 14);
    translate([-26, 0, 88.4]) scale([3.5, 2.8, 2.2]) sphere(1, $fn = 10);
  }
  // the enclosed chain guard, cranks and pedals
  color(c) hull() {
    translate(BB + [0, 6, 0]) rotate([90, 0, 0]) cylinder(h = 1.4, r = 9, center = true, $fn = 16);
    translate(RA + [0, 6, 0]) rotate([90, 0, 0]) cylinder(h = 1.4, r = 5, center = true, $fn = 12);
  }
  for (m = [-1, 1]) {
    tube([BB + [0, m * 8, 0], BB + [m * 9, m * 8, -8]], 1.1, IRON);
    box(TYRE, BB + [m * 9 - 4, m * 8 + (m > 0 ? 0 : -3), -9.5], BB + [m * 9 + 4, m * 8 + (m > 0 ? 3 : 0), -7]);
  }
  // rear carrier, lamp
  box(IRON, [-66, -8, 62], [-24, 8, 63.4]);
  for (m = [-1, 1]) tube([[-60, m * 7, 62], RA + [0, m * 5, 0]], 0.8, IRON);
  color(CREAM) translate([37, 0, 70]) rotate([0, 90, 0]) cylinder(h = 4, r1 = 2.2, r2 = 2.8, $fn = 12);
  if (crate) {
    // the front carrier and a wooden crate on it
    box(IRON, [40, -13, 65], [71, 13, 66.4]);
    for (m = [-1, 1]) tube([[64, m * 11, 65], FA + [0, m * 5, 0]], 0.8, IRON);
    color(WOOD) difference() {
      translate([39, -16, 66.4]) cube([33, 32, 24]);
      translate([41, -14, 68.4]) cube([29, 28, 24]);
      for (z = [74, 82]) translate([38, -17, z]) cube([35, 34, 1.4]);
    }
  }
}
// an Amsterdam staple ("nietje"): an inverted U of steel tube along X
module staple() {
  tube([[-32, 0, 2.4], [-32, 0, 68], [-26, 0, 75], [26, 0, 75], [32, 0, 68], [32, 0, 2.4]], 2.4, [0.35, 0.36, 0.38, NOGLOW]);
}

module bike_rack() {
  // two pairs, 2 % under full size so they fit x -440..-150 nose to tail
  for (p = [[-367, [0.82, 0.12, 0.12, NOGLOW], [0.12, 0.32, 0.78, NOGLOW], true],
            [-223, [0.95, 0.76, 0.12, NOGLOW], [0.1, 0.1, 0.11, NOGLOW], false]]) {
    translate([p[0], -53, 0]) staple();
    translate([p[0], -30, 0]) scale(0.98) bike(p[1], crate = p[3]);
    translate([p[0], -76, 0]) rotate([0, 0, 180]) scale(0.98) bike(p[2]);
  }
}

// ---- the bench group ----------------------------------------------------------------------------------------------

// a euro pallet, 120 (x) x 80 (y) x 14.4, its corner at the origin
module pallet() color(PALLET) {
  for (i = [0 : 4]) translate([0, i * 17.5, 12.2]) cube([120, 10, 2.2]);
  for (i = [0 : 2]) translate([i * 52.5, 0, 10]) cube([15, 80, 2.2]);
  for (i = [0 : 2], j = [0 : 2]) translate([i * 52.5 + 0.25, j * 35, 2.2]) cube([14.5, 10, 7.8]);
  for (j = [0 : 2]) translate([0, j * 35, 0]) cube([120, 10, 2.2]);
}
module cushion(size, c) color(c) hull() for (x = [4, size[0] - 4], y = [4, size[1] - 4], z = [3.5, size[2] - 3.5])
  translate([x, y, z]) sphere(3.5, $fn = 10);
module can(c, band) {
  color([0.75, 0.76, 0.78, NOGLOW]) cylinder(h = 0.6, r = 3.0, $fn = 14);
  color(c) translate([0, 0, 0.6]) cylinder(h = 11, r = 3.3, $fn = 14);
  color(band) translate([0, 0, 4.2]) cylinder(h = 3.6, r = 3.35, $fn = 14);
  color([0.75, 0.76, 0.78, NOGLOW]) translate([0, 0, 11.6]) cylinder(h = 0.8, r1 = 3.3, r2 = 2.7, $fn = 14);
}
CAN_A = [[0.08, 0.08, 0.09, NOGLOW], [0.55, 0.95, 0.15, NOGLOW]];
CAN_B = [[0.15, 0.35, 0.85, NOGLOW], [0.8, 0.82, 0.86, NOGLOW]];

BX = 262;   // the bench's left end
module bench() {
  translate([BX, -90, 0]) { pallet(); translate([0, 0, 14.4]) pallet(); }
  // the backrest: a pallet on its long edge against the wall
  translate([BX, -10, 28.8]) rotate([90, 0, 0]) pallet();
  // the drinks crate as a side table on the left of the seat, one cushion on the right
  translate([BX + 4, -84, 28.8]) drinks_crate();
  translate([BX + 46, -89, 28.8]) cushion([73, 64, 9], [0.2, 0.5, 0.55, NOGLOW]);
  translate([BX + 49, -34, 36]) rotate([-12, 0, 0]) cushion([66, 10, 40], [0.85, 0.6, 0.18, NOGLOW]);
  // the laptop, open, a pixel sprite on its screen; a can beside it
  translate([BX + 58, -72, 37.6]) rotate([0, 0, 8]) {
    box([0.62, 0.63, 0.66, NOGLOW], [0, 0, 0], [32, 22, 1.6]);
    box([0.25, 0.25, 0.28, NOGLOW], [2, 3, 1.6], [30, 13, 1.9]);
    translate([0, 22, 1]) rotate([78, 0, 0]) {
      box([0.62, 0.63, 0.66, NOGLOW], [0, 0, 0], [32, 21, 1.1]);
      // the lid leans back; its +Z face (the screen) faces -Y, x to the viewer's right, y up the lid
      color([0.08, 0.1, 0.16, GLOW]) translate([1.5, 1.5, 1.1]) cube([29, 18, 0.2]);
      translate([16 - EWA_RAIDORI[0] * 0.25, 4, 1.3]) scale([0.5, 0.5, 0.2]) ewa_raidori();
    }
  }
  translate([BX + 106, -80, 37.6]) can(CAN_A[0], CAN_A[1]);
  // the Wi-Fi router on top of the backrest, antennas up, a green light on
  translate([BX + 12, -20, 108.8]) {
    box(CREAM, [0, 0, 0], [24, 12, 4]);
    for (x = [3, 21]) color(IRON) translate([x, 9, 4]) rotate([-8, 0, 0]) cylinder(h = 15, r = 0.9, $fn = 8);
    for (x = [6, 9, 12]) color([0.3, 1, 0.4, GLOW]) translate([x, -0.2, 2.3]) cube([1.2, 0.4, 0.8]);
  }
}

// a crate of twelve energy drinks, 40 x 30 x 26, its corner at the origin
module drinks_crate() {
  color([0.18, 0.24, 0.34, NOGLOW]) difference() {
    cube([40, 30, 26]);
    translate([2, 2, 3]) cube([36, 26, 26]);
    for (m = [0, 1]) translate([12, m * 31 - 1, 18]) cube([16, 2, 4]);
  }
  for (i = [0 : 3], j = [0 : 2]) let(k = (i + j) % 2 == 0 ? CAN_A : CAN_B)
    translate([6 + i * 9.4, 6 + j * 9, 3]) can(k[0], k[1]);
}

// the green paper bin (a 140 l kliko, 48 x 55 x 100) against the wall at the end, x 397..445
BIN_X = 397;
BIN_D = 55;
module paper_bin() translate([BIN_X, -12 - BIN_D, 0]) {
  color(BIN) hull() {
    translate([2, 2, 0]) cube([44, BIN_D - 4, 1]);
    translate([0, 0, 96]) cube([48, BIN_D, 4]);
  }
  box([0.9, 0.9, 0.88, NOGLOW], [9, -0.2, 70], [39, 0.4, 80]);
  for (x = [3, 37]) color(TYRE) translate([x, BIN_D - 6, 7]) rotate([0, 90, 0]) cylinder(h = 8, r = 7, $fn = 14);
  // cardboard sticking out, the lid up on it and not shutting
  box(CARD, [7, 10, 92], [37, 14, 110]);
  translate([10, 24, 94]) rotate([-12, 8, 0]) box([0.74, 0.6, 0.42, NOGLOW], [0, 0, 0], [26, 3, 16]);
  translate([0, BIN_D, 100]) rotate([-16, 0, 0]) translate([-1, -BIN_D - 3, 0]) color(BIN) cube([50, BIN_D + 3, 3]);
}

// five pizza boxes on edge, leaning back on the bin's front: they tip on their back bottom edge (the pivot) and
// their top touches the bin at y = -12 - BIN_D; the front reaches y -95
module pizza_stack() translate([BIN_X + 7, -12 - BIN_D - 8.8, 0]) rotate([-15, 0, 0]) translate([0, -20, 0])
  for (i = [0 : 4]) translate([0, i * 4, 0]) {
    box(CARD, [0, 0, 0], [34, 3.9, 34]);
    // the print on each lid: a red band
    box([0.78, 0.18, 0.14, NOGLOW], [6, -0.1, 8], [28, 0, 12]);
  }

// ---- the signs ----------------------------------------------------------------------------------------------------

LOGO_P = 0.85;
// the logo and the name on one face of the blade sign: u to the viewer's right, v up, d out of the face
module sign_face() {
  translate([-EWA_LOGO[0] * LOGO_P / 2, 17.5, 0]) scale([LOGO_P, LOGO_P, 0.6]) ewa_logo(a = NOGLOW);
  color(GILT) translate([0, 9, 0]) linear_extrude(0.5) text("TEAM EWAMON HQ", size = 3.6, font = FONT, halign = "center", valign = "center");
}
module blade_sign() translate([220, 0, 0]) {
  // the wall plate, the arm and its strut
  box(IRON, [-5, -1.5, 196], [5, 0, 234]);
  box(IRON, [-1.3, -74, 227.6], [1.3, -1.5, 230.2]);
  tube([[0, -1.5, 200], [0, -44, 228]], 1.1, IRON);
  color(IRON) translate([0, -74, 228.9]) sphere(2.2, $fn = 10);
  // the board hanging from two rings
  for (y = [-20, -60]) color(IRON) translate([0, y, 225]) rotate([0, 90, 0]) rotate_extrude($fn = 10) translate([2.6, 0]) circle(0.5, $fn = 6);
  box(NAVY, [-1.5, -68, 158], [1.5, -12, 222.6]);
  // a gilt frame round both faces
  color(GILT) difference() {
    translate([-1.8, -68.5, 157.5]) cube([3.6, 57, 65.6]);
    translate([-2, -67, 159]) cube([4, 54, 62.6]);
  }
  // both faces (multmatrix: u -> +Y and d -> +X on the +X face, u -> -Y and d -> -X on the other)
  multmatrix([[0, 0, 1, 1.5], [1, 0, 0, -40], [0, 1, 0, 158], [0, 0, 0, 1]]) sign_face();
  multmatrix([[0, 0, -1, -1.5], [-1, 0, 0, -40], [0, 1, 0, 158], [0, 0, 0, 1]]) sign_face();
}
module plank_sign() translate([0, 0, 192]) {
  box(WOOD_DARK, [-33, -2.4, -12], [33, 0, 12]);
  for (m = [-1, 1]) color(STEEL) translate([m * 30, -2.4, 0]) rotate([90, 0, 0]) cylinder(h = 0.5, r = 0.9, $fn = 8);
  rotate([90, 0, 0]) translate([0, 0, 2.4]) color(CREAM) linear_extrude(0.4) {
    translate([0, 3.6]) text("TEAM EWAMON HQ", size = 4.6, font = FONT, halign = "center", valign = "center");
    translate([0, -5]) text("EST. 2022 · HvA EWA", size = 2.8, font = FONT, halign = "center", valign = "center");
  }
}

// ---- the string lights ------------------------------------------------------------------------------------------

SPAN = 110;
function wire_z(x) = let(s = (x + 440) / SPAN - floor((x + 440) / SPAN)) 249.5 - 32 * s * (1 - s);
module string_lights() {
  pts = [for (x = [-440 : 22 : 440]) [x, -5, wire_z(x)]];
  color(IRON) for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) sphere(0.4, $fn = 4); translate(pts[i + 1]) sphere(0.4, $fn = 4); }
  for (x = [-440 : SPAN : 440]) box(IRON, [x - 1, -6, 246.5], [x + 1, 0, 250]);
  for (x = [-426.25 : 27.5 : 426.25]) translate([x, -5, wire_z(x)]) {
    color(IRON) translate([0, 0, -2.6]) cylinder(h = 2.6, r = 0.9, $fn = 8);
    color(WARM) translate([0, 0, -4.6]) scale([1, 1, 1.25]) sphere(2.1, $fn = 8);
  }
}

// ---- the set ----------------------------------------------------------------------------------------------------

blade_sign();
plank_sign();
bike_rack();
bench();
pizza_stack();
paper_bin();
string_lights();
