// Burrowyrm: a cute orange baby wyrm whose neck and big head rise out of its sandy burrow.
//
// Checklist (front sheet, 40 units tall):
// - Body plan: one upright column (body + neck) standing on z = 0 inside a low ring of sand clods, a big round head
//   on top, turned towards the creature's right (-X) so the long muzzle points to the viewer's left.
// - Column: sheet x -9..10 at z 8 narrowing to -6..7 at z 20, orange [0.87, 0.43, 0.19]. Its cream belly plate
//   [0.95, 0.71, 0.32] faces front and wraps round the -X flank (the back art shows it as a band on that side), with
//   four darker segment lines.
// - Head: z 21..37.4, sheet x -14..5, orange cap and back; the face cream: a ring round each eye, the lower face and
//   the long muzzle (tip at sheet x -16.4, z 17..24.5, chin down to z 13.5); an orange tongue runs down the forehead
//   between the eyes to z 24.3.
// - Eyes: huge purple gems with a thin ink rim and white glints. Near eye sheet (-3, 26.3), half 2.6 x 3.1; far eye
//   (-11.5, 27.8), seen narrow. A wide smile along the muzzle's side curling up at the corner, a slanted nostril.
// - Horns: two purple crystal horns on the head top, near one sheet (1, 33..38.3), far one (-8, 35..40).
// - Back: three purple crystal spikes down the back-left of the neck (+X back side), flat white tops, tips pointing
//   out and down: sheet (5..9, 20.5..26), (7..11, 16..20), (10..13, 11..14). The back art shows them on the left edge.
// - Sand: a low ring of rounded clods hugging the base (kept low, under 8 units, no disc under it).
include <lib.scad>

orange = [0.87, 0.43, 0.19];
cream = [0.95, 0.71, 0.32];
band = [0.72, 0.45, 0.2];
sand = [0.86, 0.59, 0.27];
sandDk = [0.76, 0.5, 0.23];
ink = [0.16, 0.12, 0.14];
crystal = [0.42, 0.29, 0.6, NOGLOW];
crystalHi = [0.93, 0.9, 1, NOGLOW];
irisDk = [0.36, 0.24, 0.52, NOGLOW];
iris = [0.5, 0.35, 0.7, NOGLOW];
irisLt = [0.64, 0.48, 0.82, NOGLOW];
white = [1, 1, 1, NOGLOW];

// ---- Frames: the column (belly turned 30 degrees towards -X), the head (facing -Y) and its muzzle (turned towards -X).
CC = [0.4, 1.6, 0];
CT = -30;
HC = [-3.2, -2.5, 29.5];
HT = 0;
MP = [0, -4, 0];   // the muzzle's root on the face (head frame)
MT = -40;         // the muzzle points 40 degrees round towards -X
module colFrame() { translate(CC) rotate([0, 0, CT]) children(); }
module headFrame() { translate(HC) rotate([0, 0, HT]) children(); }
module muzFrame() { translate(MP) rotate([0, 0, MT]) children(); }

// Column ellipsoids in the column frame (belly towards -Y).
COL = [
  [[9.2, 9.6, 1.6], [0, 0, 1.6]],
  [[9.0, 9.6, 3.5], [0, 0, 5]],
  [[8.2, 9.4, 3.8], [0, 0, 10.5]],
  [[6.2, 7.6, 3.2], [0, -0.2, 15.5]],
  [[5.4, 6.0, 3], [-0.3, -1.6, 20.5]],
];
module colBlob(g = 0) { hull() for (e = COL) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 32); }

// Head ellipsoids in the head frame (face towards -Y): the cranium and the lower face.
HEAD = [
  [[9.6, 8, 8], [0, 0, 0]],
  [[7.4, 6.8, 5.5], [0, -2, -4]],
];
module headBlob(g = 0) { hull() for (e = HEAD) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 32); }
// The muzzle: base on the face, the chin, the rounded tip.
MUZ = [
  [[5.3, 4.6, 4.8], [0, -1.5, -9.6]],
  [[4.7, 4.4, 4.6], [0, -4.4, -11.2]],
  [[4.5, 4.1, 4], [0, -7.3, -8.8]],
];
module muzBlob(g = 0) { hull() for (e = MUZ) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 28); }

// Eyes (head frame).
EYE = [5.1, -6.5, -2.6];
EYE_S = 3.0;
EYE_YAW = 16;

// ---- Column and belly.
colFrame() {
  color(orange) colBlob();
  // Cream belly plate: the column's front sector, from the -X flank round to the camera side.
  color(cream) intersection() {
    colBlob(0.25);
    translate([0, 0, -1]) linear_extrude(height = 22.5)
      polygon(concat([[0, 0]], [for (a = [-66 : 12 : 74]) 30 * [sin(a), -cos(a)]]));
  }
  // Segment lines across the belly.
  color(band) for (z = [8.6, 11.8, 14.8, 17.6]) intersection() {
    colBlob(0.38);
    translate([0, 0, z - 0.22]) linear_extrude(height = 0.44)
      polygon(concat([[0, 0]], [for (a = [-62 : 12 : 70]) 30 * [sin(a), -cos(a)]]));
  }
}

// ---- The nape: the back of the head flowing down into the neck (the back art's smooth keyhole outline).
color(orange) hull() {
  headFrame() translate([0, 1.6, -3.5]) scale([6.6, 5.6, 4.5]) sphere(1, $fn = 24);
  colFrame() translate([-0.3, -0.8, 19]) scale([5.4, 6.2, 2]) sphere(1, $fn = 24);
}

// ---- Head.
module gemEye(p, s, yaw) {
  // Same outer shape as lib.scad eye() (the rig's lids fit it): an ink rim, a purple gem, white glints.
  translate(p) rotate([0, 0, yaw]) {
    color(ink) scale([1, 0.45, 1.15]) sphere(s, $fn = 22);
    color(irisDk) translate([0, -s * 0.1, 0]) scale([0.9, 0.38, 1.06]) sphere(s, $fn = 22);
    color(iris) translate([s * 0.06, -s * 0.14, -s * 0.12]) scale([0.76, 0.36, 0.88]) sphere(s, $fn = 20);
    color(irisLt) translate([s * 0.2, -s * 0.2, -s * 0.5]) scale([0.44, 0.33, 0.4]) sphere(s, $fn = 14);
    color(white) translate([-s * 0.16, -s * 0.46, s * 0.26]) scale([0.34, 0.12, 0.38]) sphere(s, $fn = 14);
    color(white) translate([s * 0.4, -s * 0.44, -s * 0.52]) scale([0.15, 0.1, 0.17]) sphere(s, $fn = 8);
  }
}

module crystal_spike(p, d, r) {
  spike(p, d, r, 0.05, crystal);
  // White glint facet on the top side.
  color(crystalHi) translate(p + d * 0.3) rotate(_dir_rot(d)) translate([r * 0.1, 0, r * 0.45]) scale([0.42, 0.42, 1.1]) sphere(r * 0.75, $fn = 8);
}

headFrame() {
  color(orange) headBlob();
  // Cream face: a ring round each eye and the lower face (the orange tongue between the eyes is what is left).
  color(cream) intersection() {
    headBlob(0.25);
    union() {
      mirror_x() translate([5.3, -5.9, -1.9]) scale([4.0, 4.4, 5.0]) sphere(1, $fn = 24);
      translate([0, -7, -9.2]) scale([7.2, 9, 4.2]) sphere(1, $fn = 24);
    }
  }
  muzFrame() {
    color(cream) muzBlob();
    // Nostrils: slanted dark slits on the muzzle's top front.
    mirror_x() color(ink) translate([1.9, -10.5, -7.4]) rotate([0, -25, 0]) scale([0.45, 0.4, 1.0]) sphere(1, $fn = 10);
    // The smile: a dark line along the muzzle's sides (not round the tip), rising towards the corners.
    color(ink) intersection() {
      muzBlob(0.22);
      union() {
        translate([0, -8.4, -11.0]) rotate([5, 0, 0]) translate([-10, 0, -0.2]) cube([20, 4.2, 0.4]);
        translate([0, -4.2, -10.65]) rotate([18, 0, 0]) translate([-10, 0, -0.2]) cube([20, 3.6, 0.4]);
      }
    }
    // The corners curl up into the cheeks.
    mirror_x() color(ink) intersection() {
      muzBlob(0.22);
      translate([5.1, -0.8, -9.0]) rotate([0, 0, -20]) rotate([-35, 0, 0]) translate([-0.2, -0.2, -0.4]) cube([0.4, 0.4, 3.0]);
    }
  }
  // Big purple gem eyes.
  mirror_x() gemEye(EYE, EYE_S, EYE_YAW);
  // Crystal horns.
  mirror_x() crystal_spike([6.0, -0.4, 4.6], [0.9, 0.3, 4.6], 2.4);
}

// ---- Crystal spikes down the back (+X back side), tips out and down.
SPIKES = [
  // [base, direction, base radius]
  [[3.6, 2.8, 24.2], [4.0, 2.3, -2.4], 3.0],
  [[4.4, 3.4, 18.6], [3.8, 2.2, -2.2], 2.8],
  [[5.9, 4.5, 13.0], [3.4, 2.0, -2.0], 2.4],
];
for (s = SPIKES) crystal_spike(s[0], s[1], s[2]);

// ---- The burrow: a low ring of lumpy sand clods hugging the base (no disc under it), tops under z 8.
// [angle, radius from the column, size, height of the centre]
CLODS = [
  [0, 9.4, 4.4, 3.0], [30, 9.6, 4.0, 2.8], [60, 9.4, 4.4, 3.2], [90, 9.6, 4.2, 3.0], [120, 9.4, 4.4, 3.2],
  [150, 9.6, 4.0, 2.8], [180, 9.4, 4.2, 3.0], [210, 9.6, 4.4, 3.2], [240, 9.4, 4.0, 2.8], [270, 9.6, 4.4, 3.2],
  [300, 9.4, 4.2, 3.0], [330, 9.6, 4.0, 2.8],
  [15, 13.2, 3.4, 0], [45, 13.4, 3.2, 0], [75, 13.2, 3.6, 0], [105, 13.4, 3.2, 0], [135, 13.2, 3.4, 0],
  [165, 13.4, 3.2, 0], [195, 13.2, 3.6, 0], [225, 13.4, 3.2, 0], [255, 13.2, 3.4, 0], [285, 13.4, 3.6, 0],
  [315, 13.2, 3.2, 0], [345, 13.4, 3.4, 0],
  // higher clods piled against the body on the sides
  [118, 8.2, 3.0, 5.6], [296, 8.4, 3.0, 5.6], [205, 8.2, 2.6, 5.8], [28, 8.4, 2.6, 5.4],
];
module clod(s) {
  hull() {
    translate([-0.32 * s, 0, 0]) scale([0.72, 0.66, 0.6] * s) sphere(1, $fn = 12);
    translate([0.3 * s, 0.12 * s, 0.06 * s]) scale([0.66, 0.62, 0.56] * s) sphere(1, $fn = 12);
  }
}
for (i = [0 : len(CLODS) - 1]) let(c = CLODS[i], a = c[0])
  color(i % 3 == 1 ? sandDk : sand)
    translate(CC + [c[1] * sin(a), -c[1] * cos(a), max(c[3], c[2] * 0.6)]) rotate([0, 0, a + 90 + 25 * (i % 3)])
      clod(c[2]);
