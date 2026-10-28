// The Mire Route foosball table (NPC set; rig: rigs/npc/foosball_table.mjs). 1 unit = 1 cm, origin = the table's
// centre on the ground, long axis along X. Team A (red) holds its rods from the -Y side and attacks +X; team B (blue)
// holds from +Y and attacks -X. The rods, ball and the two scoring beads are separate pieces (never unioned into the
// cabinet: the holes are wider than the rods) so the rig can spin and slide them.
include <../lib.scad>

// ---- dimensions (the contract: .design brief CONTRACT.md "The table") ----
HX = 90;          // cabinet outer half length
HY = 43;          // cabinet outer half width
WALL = 3;         // wall thickness
IX = HX - WALL;   // inner half length (87)
IY = HY - WALL;   // inner half width (40)
TOP = 92;         // rim
FIELD = 78;       // playing surface
BOT = 62;         // cabinet underside
ROD_Z = 87;
ROD_R = 0.8;
HOLE_R = 1.15;
GOAL_HY = 10;     // goal mouth half width
GOAL_TOP = 85;

// rods: x, team (-1 = A red, handles at -Y; +1 = B blue, handles at +Y), man y positions
RODS = [
  [-70, -1, [0]],
  [-50, -1, [-14, 14]],
  [-30, 1, [-24, 0, 24]],
  [-10, -1, [-30, -15, 0, 15, 30]],
  [10, 1, [-30, -15, 0, 15, 30]],
  [30, -1, [-24, 0, 24]],
  [50, 1, [-14, 14]],
  [70, 1, [0]],
];

WOOD = [0.82, 0.53, 0.25, NOGLOW];
WOOD2 = [0.74, 0.46, 0.2, NOGLOW];
WOOD3 = [0.87, 0.6, 0.31, NOGLOW];
TRIM = [0.2, 0.13, 0.08, NOGLOW];
BLACK = [0.07, 0.07, 0.08, NOGLOW];
GREEN = [0.16, 0.48, 0.2, NOGLOW];
LINE = [0.93, 0.95, 0.9, NOGLOW];
CHROME = [0.76, 0.78, 0.82, NOGLOW];
RED = [0.85, 0.1, 0.12, NOGLOW];
BLUE = [0.12, 0.42, 0.9, NOGLOW];
WHITE = [0.97, 0.97, 0.97, NOGLOW];
SKIN = [0.96, 0.76, 0.6, NOGLOW];
HAIR = [0.12, 0.08, 0.06, NOGLOW];
BALL = [1, 1, 1, NOGLOW];

module box(c, lo, hi) color(c) translate(lo) cube(hi - lo);

// ---- cabinet ----
module rod_holes() {
  for (r = RODS) color(BLACK) translate([r[0], 0, ROD_Z]) rotate([90, 0, 0]) cylinder(r = HOLE_R, h = 2 * HY + 8, center = true, $fn = 10);
}

module long_wall(s) {   // s = -1 (team A side) or +1
  difference() {
    union() {
      box(WOOD, [-HX, s > 0 ? IY : -HY, BOT], [HX, s > 0 ? HY : -IY, TOP]);
      // wood grain on the outer face: long thin strips in lighter / darker tones
      for (i = [0 : 9]) let(z = BOT + 2 + i * 2.9, c = i % 3 == 0 ? WOOD2 : i % 3 == 1 ? WOOD3 : WOOD2)
        box(c, [-HX + 1 + (i % 4) * 7, s * HY - (s > 0 ? 0 : 0.12), z], [HX - 1 - (i % 3) * 9, s * HY + (s > 0 ? 0.12 : 0), z + (i % 2 == 0 ? 0.5 : 0.35)]);
      // dark edge trim: top outer edge, top inner edge, vertical ends
      box(TRIM, [-HX, s * HY - 0.5 - (s > 0 ? 0 : 0.1) * 0, TOP - 0.01], [HX, s * HY + 0.5, TOP + 0.4]);
      box(TRIM, [-HX, s * IY - 0.35, TOP - 0.01], [HX, s * IY + 0.35, TOP + 0.4]);
      for (x = [-HX, HX - 0.7]) box(TRIM, [x, s > 0 ? IY : -HY - 0.12, BOT], [x + 0.7, s > 0 ? HY + 0.12 : -IY, TOP + 0.4]);
      // black bearings (end-stops) where the rods pass the wall
      for (r = RODS) color(BLACK) translate([r[0], s * (HY + 1.1), ROD_Z]) rotate([90, 22.5, 0]) cylinder(r = 2.7, h = 2.2, center = true, $fn = 8);
      // bolt heads near the corners and under the rods
      for (x = [-84, 84], z = [BOT + 4, TOP - 4]) color(BLACK) translate([x, s * (HY + 0.2), z]) rotate([90, 0, 0]) cylinder(r = 0.9, h = 0.6, center = true, $fn = 8);
      for (r = RODS) color(BLACK) translate([r[0] + 4, s * (HY + 0.2), BOT + 6]) rotate([90, 0, 0]) cylinder(r = 0.6, h = 0.5, center = true, $fn = 6);
    }
    rod_holes();
  }
}

module end_wall(s) {   // s = -1 (x = -90, team A's goal) or +1
  difference() {
    union() {
      box(WOOD, [s > 0 ? IX : -HX, -IY, BOT], [s > 0 ? HX : -IX, IY, TOP]);
      for (i = [0 : 7]) let(z = BOT + 2.5 + i * 3.5)
        box(i % 2 == 0 ? WOOD2 : WOOD3, [s * HX - (s > 0 ? 0 : 0.12), -IY + 2 + (i % 3) * 4, z], [s * HX + (s > 0 ? 0.12 : 0), IY - 2 - (i % 2) * 6, z + 0.45]);
      box(TRIM, [s > 0 ? HX - 0.5 : -HX - 0.1, -HY, TOP - 0.01], [s > 0 ? HX + 0.1 : -HX + 0.5, HY, TOP + 0.4]);
      box(TRIM, [s * IX - 0.35, -IY, TOP - 0.01], [s * IX + 0.35, IY, TOP + 0.4]);
    }
    // the goal mouth
    color(BLACK) translate([s * (HX - WALL / 2) - 3, -GOAL_HY, FIELD - 0.5]) cube([6, 2 * GOAL_HY, GOAL_TOP - FIELD + 0.5]);
  }
  // goal frame: a black surround on the inner face
  color(BLACK) difference() {
    translate([s * IX - 0.4, 0, (FIELD + GOAL_TOP) / 2 + 0.5]) cube([0.8, 2 * GOAL_HY + 3, GOAL_TOP - FIELD + 2], center = true);
    translate([s * IX, 0, (FIELD + GOAL_TOP) / 2 - 0.5]) cube([3, 2 * GOAL_HY, GOAL_TOP - FIELD + 1], center = true);
  }
  // the goal box behind the mouth (the ball tray of the reference), black, open at the top
  color(BLACK) difference() {
    translate([s > 0 ? HX : -HX - 7, -GOAL_HY - 2, FIELD - 12]) cube([7, 2 * GOAL_HY + 4, GOAL_TOP - FIELD + 14]);
    translate([s > 0 ? HX - 1 : -HX - 6, -GOAL_HY, FIELD - 10]) cube([7, 2 * GOAL_HY, GOAL_TOP - FIELD + 20]);
  }
  // scoring abacus on the rim: posts, a wire and ten counters (team A red at -X, team B blue at +X)
  bead_c = s < 0 ? RED : BLUE;
  ax = s * (HX - WALL / 2);
  for (y = [-17, 17]) box(BLACK, [ax - 0.7, y - 0.6, TOP], [ax + 0.7, y + 0.6, 95.6]);
  color(CHROME) translate([ax, 0, 94.2]) rotate([90, 0, 0]) cylinder(r = 0.3, h = 34, center = true, $fn = 6);
  for (i = [0 : 4]) counter(bead_c, ax, -15 + i * 1.6, false);
  for (i = [0 : 3]) counter(bead_c, ax, 15 - i * 1.6, false);
  // the scoring bead (its own joint in the rig): a ring that slides along the wire
  counter(bead_c, ax, -15 + 5 * 1.6, true);
}

// a counter: a short cylinder along Y on the abacus wire
module counter(c, ax, y, hole) {
  color(c) translate([ax, y, 94.2]) rotate([90, 0, 0]) difference() {
    cylinder(r = 1.25, h = 1.3, center = true, $fn = 10);
    if (hole) cylinder(r = 0.5, h = 3, center = true, $fn = 6);
  }
}

module field() {
  box(GREEN, [-IX, -IY, BOT], [IX, IY, FIELD]);
  lz = FIELD + 0.08;
  color(LINE) {
    // border
    for (s = [-1, 1]) {
      translate([-IX + 2, s * (IY - 2) - 0.3, FIELD - 0.1]) cube([2 * IX - 4, 0.6, 0.18]);
      translate([s * (IX - 2) - 0.3, -IY + 2, FIELD - 0.1]) cube([0.6, 2 * IY - 4, 0.18]);
      // penalty box and goal box
      translate([s > 0 ? IX - 16 : -IX + 15.4, -20, FIELD - 0.1]) cube([0.6, 40, 0.18]);
      translate([s > 0 ? IX - 16 : -IX + 2, -20.3, FIELD - 0.1]) cube([14, 0.6, 0.18]);
      translate([s > 0 ? IX - 16 : -IX + 2, 19.7, FIELD - 0.1]) cube([14, 0.6, 0.18]);
      translate([s > 0 ? IX - 7 : -IX + 6.4, -12, FIELD - 0.1]) cube([0.6, 24, 0.18]);
      translate([s > 0 ? IX - 7 : -IX + 2, -12.3, FIELD - 0.1]) cube([5, 0.6, 0.18]);
      translate([s > 0 ? IX - 7 : -IX + 2, 11.7, FIELD - 0.1]) cube([5, 0.6, 0.18]);
      translate([s * (IX - 24), 0, FIELD - 0.1]) cylinder(r = 0.6, h = 0.18, $fn = 8);
    }
    translate([-0.3, -IY + 2, FIELD - 0.1]) cube([0.6, 2 * IY - 4, 0.18]);
    translate([0, 0, FIELD - 0.1]) difference() {
      cylinder(r = 11, h = 0.18, $fn = 40);
      translate([0, 0, -1]) cylinder(r = 10.4, h = 2, $fn = 40);
    }
    translate([0, 0, FIELD - 0.1]) cylinder(r = 1, h = 0.18, $fn = 10);
  }
  // underside panel and legs
  box(TRIM, [-HX, -HY, BOT - 0.6], [HX, HY, BOT]);
  for (x = [-78, 78], y = [-34, 34]) {
    box(BLACK, [x - 4, y - 4, 3], [x + 4, y + 4, BOT - 0.6]);
    box([0.18, 0.18, 0.2, NOGLOW], [x - 3.4, y - 3.4, 0], [x + 3.4, y + 3.4, 3]);
  }
}

// ---- rods with figures, grips and the ball ----
// a footballer on its rod: the rod through the chest at the origin, facing +X (mirrored for team B), the feet's
// lowest point 8 below the rod (1 cm above the field) and every part within 8.3 of the rod axis, so it can spin
// freely over the field.
module figure(shirt) {
  color(SKIN) translate([0, 0, 4.6]) sphere(r = 1.85, $fn = 10);
  color(HAIR) intersection() {
    translate([-0.25, 0, 4.85]) sphere(r = 1.95, $fn = 10);
    translate([-2.5, -3, 4.9]) cube([4.2, 6, 3]);
  }
  color(HAIR) translate([-0.9, 0, 4.4]) scale([0.9, 1.6, 1.5]) sphere(r = 1.2, $fn = 8);
  // (the width carries the colour: OpenSCAD caches identical hulls with the first one's colour)
  color(shirt) hull() {
    translate([0, 0, 2.6]) cube([2.4, 3.9 + shirt[2] * 1e-3, 1.2], center = true);
    translate([0, 0, -1.6]) cube([2.2, 3.4, 1.2], center = true);
  }
  // arms: short sleeves in the shirt colour, skin forearms hanging at the sides
  for (s = [-1, 1]) {
    color(shirt) translate([0, s * 2.35, 1.9]) cube([1.5, 1, 2], center = true);
    color(SKIN) translate([0.15, s * 2.35, -0.3]) cube([1.1, 0.8, 2.6], center = true);
  }
  color(WHITE) translate([0, 0, -3.3]) cube([2.4, 3.5, 2], center = true);
  for (s = [-1, 1]) {
    color(WHITE) translate([0, s * 0.9, -5.6]) cube([1.2, 1.2, 2.8], center = true);
    color(BLACK) translate([0.35, s * 0.9, -7.6]) cube([2, 1.3, 0.8], center = true);
  }
}

module rod(r) {
  x = r[0];
  t = r[1];
  shirt = t < 0 ? RED : BLUE;
  translate([x, 0, ROD_Z]) {
    // chrome rod: from the stub on the far side (|y| 49) out to the grip on the owner's side
    color(CHROME) translate([0, t * 8.5, 0]) rotate([90, 0, 0]) cylinder(r = ROD_R, h = 49 + 66 - 2, center = true, $fn = 10);
    color(BLACK) translate([0, -t * 48.5, 0]) rotate([90, 0, 0]) cylinder(r = 1.05, h = 1.6, center = true, $fn = 10);
    // the grip: a collar, the rubber handle (|y| 50..66) and a rounded end
    color(BLACK) translate([0, t * 49.6, 0]) rotate([90, 0, 0]) cylinder(r = 1.5, h = 1.2, center = true, $fn = 10);
    color(BLACK) translate([0, t * 58, 0]) rotate([90, 0, 0]) cylinder(r1 = 1.85, r2 = 1.6, h = 16, center = true, $fn = 12);
    color(BLACK) translate([0, t * 66, 0]) scale([1, 0.6, 1]) sphere(r = 1.85, $fn = 12);
    for (y = r[2]) translate([0, y, 0]) if (t < 0) figure(shirt); else mirror([1, 0, 0]) figure(shirt);
  }
}

// ---- the table ----
for (s = [-1, 1]) { long_wall(s); end_wall(s); }
field();
for (r = RODS) rod(r);
// the ball at the centre spot, a hair above the field
color(BALL) translate([0, 0, FIELD + 1.85]) sphere(r = 1.75, $fn = 14);
