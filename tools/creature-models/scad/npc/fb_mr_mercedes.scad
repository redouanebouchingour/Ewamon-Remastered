// Mr Mercedes (Mire Route foosball club, team A keeper: goalie + defence rods, both grips). Thick dark curly hair
// piled high with faded sides, a short dark full beard, warm skin, brown eyes, a calm grin; a silver tracksuit top
// with a black three-pointed star on the chest and teal piping, black trackpants with silver stripes.
// Rig: rigs/npc/fb_mr_mercedes.mjs.
include <_human.scad>

MM_H = 179;
MM_HEAD = 1.1;
MM_GIRTH = 1.04;
HAIR = [0.09, 0.07, 0.07];
TOP = [0.74, 0.76, 0.8];
PANTS = [0.12, 0.12, 0.14];
STAR = [0.1, 0.1, 0.12];
TEAL = [0.0, 0.6, 0.55, NOGLOW];
SILVER = [0.8, 0.82, 0.86];

human(H = MM_H, head = MM_HEAD, girth = MM_GIRTH, belly = 0.1,
  skin = [0.86, 0.62, 0.47], blush = [0.8, 0.5, 0.4],
  hair = "curly", hair_c = HAIR, beard = "short", brow_c = [0.07, 0.05, 0.05],
  eye_c = [0.36, 0.2, 0.1], mouth = "grin",
  shirt_c = TOP, sleeve = "long", cuff_c = TEAL,
  pants_c = PANTS, shoe_c = [0.97, 0.97, 0.97], sole_c = [0.15, 0.15, 0.16]);

// more curls: a thick crown piled up and forward, the memoji's big curly top
human_head(MM_H, MM_HEAD) color(HAIR) {
  for (i = [0 : 6]) let(a = -66 + 22 * i) translate([12.4 * sin(a), -12.2 * cos(a) + 1.5, 13.2 - 0.9 * abs(i - 3)])
    sphere(3.3, $fn = 14);
  for (i = [0 : 5]) let(a = -55 + 22 * i) translate([9.5 * sin(a), -8.5 * cos(a) + 1, 18.2 - 0.6 * abs(i - 2.5)])
    sphere(3.4, $fn = 14);
  for (i = [0 : 4]) let(a = i * 72 + 20) translate([5 * sin(a), 5 * cos(a), 20]) sphere(3.3, $fn = 14);
  for (i = [0 : 6]) let(a = 110 + 23 * i) translate([12.6 * sin(a), -12.6 * cos(a), 12.5 - 0.5 * abs(i - 3)])
    sphere(3.2, $fn = 14);
}

human_body(MM_H, MM_GIRTH) {
  // the three-pointed star in a ring, on the left of the chest
  translate([7.0, -9.9, 124.5]) rotate([90, 0, 0]) color(STAR) {
    difference() {
      cylinder(h = 1.2, r = 4.3, center = true, $fn = 28);
      cylinder(h = 2, r = 3.4, center = true, $fn = 28);
    }
    for (a = [90, 210, 330]) rotate([0, 0, a]) hull() {
      cylinder(h = 1.2, r = 0.75, center = true, $fn = 8);
      translate([3.6, 0, 0]) cylinder(h = 1.2, r = 0.12, center = true, $fn = 6);
    }
  }
  // collar
  color(TEAL) translate([0, 0.6, 134.2]) difference() {
    cylinder(h = 2.4, r1 = 8.2, r2 = 7.4, $fn = 30);
    translate([0, 0, -0.1]) cylinder(h = 2.6, r = 6.0, $fn = 30);
  }
  for (m = [0, 1]) mirror([m, 0, 0]) {
    // silver side stripes on the trackpants (thigh and shin pieces, clear of the knee)
    color(SILVER) limb([16.4, -0.1, 79], [15.85, -0.45, 55], 0.95, 0.95);
    color(SILVER) limb([15.3, -0.45, 41], [15.0, -0.1, 17], 0.95, 0.95);
    // teal stripes down the sleeves
    color(TEAL) limb(B_SHOULDER + B_ARM * 0.08 + [6.6, 0, 0], B_SHOULDER + B_ARM * 0.3 + [6.5, 0, 0], 0.85, 0.85);
    color(TEAL) limb(B_SHOULDER + B_ARM * 0.36 + [5.0, 0, 0], B_SHOULDER + B_ARM * 0.46 + [4.7, 0, 0], 0.85, 0.85);
    color(TEAL) limb(B_SHOULDER + B_ARM * 0.62 + [4.45, 0, 0], B_SHOULDER + B_ARM * 0.9 + [3.75, 0, 0], 0.85, 0.85);
  }
}
