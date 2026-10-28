// Mr Motor (Mire Route foosball club, team B midfield: holds grip R). Only rides his motorbike and eats eggs with
// cottage cheese. Blond curtains under an open-face red bike helmet (white stripe, little peak), a short blond beard, a
// calm smile, grey-green eyes; a black leather biker jacket over a white tee, jeans, dark boots.
// Rig: rigs/npc/fb_mr_motor.mjs.
include <_human.scad>

MO_H = 181;
MO_HEAD = 1.06;
MO_GIRTH = 1.05;
JACKET = [0.11, 0.105, 0.12];
RED = [0.82, 0.12, 0.1, NOGLOW];

human(H = MO_H, head = MO_HEAD, girth = MO_GIRTH, belly = 0.1,
  skin = [0.99, 0.81, 0.73], blush = [0.96, 0.66, 0.6],
  hair = "curtains", hair_c = [0.96, 0.82, 0.5, NOGLOW], beard = "short", beard_c = [0.8, 0.6, 0.32], brow_c = [0.7, 0.52, 0.28],
  eye_c = [0.45, 0.58, 0.5], mouth = "smile",
  shirt_c = JACKET, sleeve = "long", cuff_c = [0.2, 0.2, 0.22],
  pants_c = [0.2, 0.28, 0.45], shoe_c = [0.24, 0.16, 0.11], sole_c = [0.08, 0.08, 0.08]);

// the open-face helmet: a hollow shell (it clears the jaw/beard shell), open over the face, down over the ears at the
// sides, a white stripe over the crown, a snap-on peak and goggles strapped on the front
module rim_region(lift = 0) union() {
  // the front: above a plane, z = 10.4 at the forehead
  multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, -0.42, 1, 3.7 + lift], [0, 0, 0, 1]]) translate([-30, -30, 0]) cube([60, 60, 40]);
  // the sides and back: from behind the eyes, down to z = 1 over the ears and z = -6 at the back
  translate([0, -6.5, 0]) multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, -0.33, 1, 1.2 + lift], [0, 0, 0, 1]]) translate([-30, 0, 0]) cube([60, 40, 40]);
}
module shell(gr) intersection() {
  difference() {
    translate([0, 0.6, 1.6]) scale(SKULL + [3.3 + gr, 3.3 + gr, 2.5 + gr]) sphere(1, $fn = 30);
    translate([0, 0.6, 1.6]) scale(SKULL + [1.5, 1.5, 1.1]) sphere(1, $fn = 30);
  }
  rim_region();
}
human_head(MO_H, MO_HEAD) {
  color(RED) shell(0);
  color([0.97, 0.97, 0.95]) intersection() { shell(0.25); translate([-2.4, -30, -20]) cube([4.8, 60, 60]); }
  // the padded black rim
  color([0.12, 0.12, 0.13]) difference() { shell(0.4); rim_region(1.4); }
  // the peak over the forehead
  color(RED) translate([0, -15.6, 12.4]) rotate([-12, 0, 0]) scale([8.8, 4.6, 0.9]) sphere(1, $fn = 28);
  // goggles on the helmet's front, above the peak
  for (m = [-1, 1]) translate([m * 4.4, -14.2, 16.2]) rotate([-62, 0, m * 10]) {
    color([0.75, 0.75, 0.78]) cylinder(h = 2.2, r = 3.3, $fn = 22);
    color([0.2, 0.35, 0.45]) translate([0, 0, 2.0]) cylinder(h = 0.5, r = 2.6, $fn = 22);
  }
  color([0.75, 0.75, 0.78]) translate([0, -15.8, 15]) scale([1.6, 1.2, 1]) sphere(1, $fn = 12);
}

// the jacket's front: a white tee showing at the neck, wide lapels and a silver zip, all on the chest
human_body(MO_H, MO_GIRTH) {
  color([0.96, 0.96, 0.94]) translate([0, -9.4, 130.6]) rotate([10, 0, 0]) scale([5.6, 1.2, 3.4]) sphere(1, $fn = 20);
  for (m = [0, 1]) mirror([m, 0, 0])
    color([0.28, 0.27, 0.3]) translate([6.4, -10.3, 127.6]) rotate([10, 0, -24]) scale([3.6, 1.3, 6.6]) sphere(1, $fn = 18);
  color([0.78, 0.78, 0.8]) translate([-1.6, -10.6, 120.5]) rotate([8, 6, 0]) scale([0.7, 0.7, 5.5]) sphere(1, $fn = 10);
}
