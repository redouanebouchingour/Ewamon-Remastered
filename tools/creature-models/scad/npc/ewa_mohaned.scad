// Mohaned, "Internet Friend" (Team Ewamon HQ, mirevale.house5): the original Ewamon's database man, seated at the
// team desk (ewa_desk.scad). Dark hair slicked back, a neatly trimmed short beard, thin metal-frame glasses,
// light-medium skin; a white dress shirt with the sleeves rolled up and a loosened black bow tie, black trousers, no
// headset. Rig: rigs/npc/ewa_mohaned.mjs (seated, _seated.mjs).
include <_ewa_team.scad>

MO_H = 180;
MO_HEAD = 1.08;
MO_GIRTH = 1.0;
HAIR = [0.1, 0.075, 0.065];
WHITE = [0.95, 0.95, 0.93, NOGLOW];
METAL = [0.62, 0.6, 0.56, NOGLOW];
TIE = [0.05, 0.05, 0.06, NOGLOW];

human(H = MO_H, head = MO_HEAD, girth = MO_GIRTH, belly = 0.05,
  skin = [0.86, 0.66, 0.5], blush = [0.82, 0.54, 0.43],
  hair = "buzz", hair_c = HAIR, beard = "trim", brow_c = [0.07, 0.05, 0.05],
  eye_c = EWA_EYE, mouth = "grin",
  shirt_c = WHITE, sleeve = "rolled", cuff_c = [0.88, 0.88, 0.86, NOGLOW],
  pants_c = EWA_PANTS, shoe_c = [0.1, 0.08, 0.07], sole_c = [0.05, 0.05, 0.05]);

// the slicked dome's surface height over (x, y), head units
function slick_z(x, y) = 1.0 + (SKULL[2] + 2.6) * sqrt(max(0, 1 - pow(x / (SKULL[0] + 1.5), 2) - pow((y - 1.2) / (SKULL[1] + 2.0), 2)));

human_head(MO_H, MO_HEAD) {
  // slicked back: a smooth glossy dome from a high front hairline, swept back over the crown, with comb lines
  color(HAIR) intersection() {
    translate([0, 1.2, 1.0]) scale(SKULL + [1.5, 2.0, 2.6]) sphere(1, $fn = 40);
    multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, -0.5, 1, 9.5 - 0.5 * 13], [0, 0, 0, 1]]) translate([-30, -30, 0]) cube([60, 60, 40]);
  }
  color(HAIR * 0.6) for (x = [-6, -2, 2, 6]) chain([for (y = [-9, -3, 3, 8]) [x, y, slick_z(x, y) - 0.15]], [0.45, 0.45, 0.45, 0.45]);
  // thin metal frames floating just off the face (head joint): two rings, a bridge, temples back to the ears
  color(METAL) {
    for (m = [-1, 1]) translate([m * 5.4, -15.4, 1.4]) rotate([90, 0, m * 14]) difference() {
      scale([1.08, 0.9, 1]) cylinder(h = 0.5, r = 3.4, center = true, $fn = 22);
      scale([1.08, 0.9, 1]) cylinder(h = 1, r = 2.9, center = true, $fn = 22);
    }
    hull() { translate([-1.9, -15.9, 2.0]) sphere(0.3, $fn = 6); translate([1.9, -15.9, 2.0]) sphere(0.3, $fn = 6); }
    for (m = [-1, 1]) hull() { translate([m * 8.9, -14.4, 2.2]) sphere(0.3, $fn = 6); translate([m * 13.2, -1, 1.6]) sphere(0.3, $fn = 6); }
  }
}

human_body(MO_H, MO_GIRTH) {
  ewa_collar(WHITE * 0.94, buttons = [0.8, 0.8, 0.78, NOGLOW]);
  // the loosened bow tie, sitting low and askew under the open collar
  translate([0.8, -10.1, 128.6]) rotate([8, 0, -14]) color(TIE) {
    for (m = [-1, 1]) hull() {
      sphere(0.9, $fn = 10);
      translate([m * 4.0, 0, 1.1]) scale([0.6, 0.6, 1.7]) sphere(1, $fn = 10);
      translate([m * 4.0, 0, -1.1]) scale([0.6, 0.6, 1.7]) sphere(1, $fn = 10);
    }
    scale([1.2, 0.9, 1.1]) sphere(1.1, $fn = 10);
  }
}
