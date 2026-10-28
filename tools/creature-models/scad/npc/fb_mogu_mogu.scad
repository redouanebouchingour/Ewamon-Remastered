// Mr Mogu Mogu (Mire Route foosball club, team A attack: holds grip L). Young, fair, wavy swept medium-brown hair with a
// long fringe falling over his right eye, blue eyes, light stubble, a bit of a belly from all the eating. Casual: a
// teal tee, beige chinos, red sneakers. His free right fist holds a Mogu Mogu bottle (lychee pink, wide green cap).
// Rig: rigs/npc/fb_mogu_mogu.mjs.
include <_human.scad>

MM_H = 176;
MM_HEAD = 1.06;
MM_GIRTH = 1.08;
HAIR = [0.5, 0.35, 0.2];

human(H = MM_H, head = MM_HEAD, girth = MM_GIRTH, belly = 0.9,
  skin = [0.99, 0.84, 0.74], blush = [0.97, 0.66, 0.62],
  hair = "buzz", hair_c = HAIR, beard = "stubble", beard_c = [0.55, 0.4, 0.26], brow_c = [0.42, 0.29, 0.17],
  eye_c = [0.42, 0.62, 0.86], mouth = "grin",
  shirt_c = [0.13, 0.55, 0.56], sleeve = "short",
  pants_c = [0.78, 0.68, 0.5], shoe_c = [0.86, 0.2, 0.18], sole_c = [0.96, 0.96, 0.94]);

// the hair: a short cap, then a big swept mass parted on his left (+X): most of it sweeps across to his right in a
// wave with long strands falling past his right eye, the short side lies over his left temple
human_head(MM_H, MM_HEAD) color(HAIR) {
  // crown volume, higher towards the front
  hull() {
    translate([0, 4, 13.4]) scale([12.4, 10.5, 5.2]) sphere(1, $fn = 30);
    translate([-1.5, -6.5, 14.4]) rotate([-20, 0, 0]) scale([11.2, 6.4, 5]) sphere(1, $fn = 30);
  }
  // the big wave sweeping from the parting across the forehead to his right
  hull() {
    translate([3.4, -9.2, 15.4]) rotate([-24, 0, 6]) scale([4.2, 4.6, 4]) sphere(1, $fn = 22);
    translate([-5.5, -11.4, 12.2]) rotate([-16, 14, -8]) scale([6, 3.4, 3.8]) sphere(1, $fn = 22);
  }
  // long strands falling past his right eye and over the temple
  hull() {
    translate([-5.5, -11.4, 12.2]) rotate([-16, 14, -8]) scale([5.4, 3.2, 3.4]) sphere(1, $fn = 20);
    translate([-10.4, -8.8, 9.6]) rotate([0, 26, -34]) scale([2.6, 2.4, 3.0]) sphere(1, $fn = 18);
  }
  hull() {
    translate([-8.5, -9.8, 12]) scale([3.4, 3, 3]) sphere(1, $fn = 18);
    translate([-12.6, -4.6, 6.4]) rotate([0, 16, -20]) scale([2.4, 3, 4]) sphere(1, $fn = 18);
  }
  // one long strand dropping over his right brow
  hull() {
    translate([-2.5, -12.4, 12.6]) scale([2.6, 2.2, 2.4]) sphere(1, $fn = 16);
    translate([-6.6, -12.0, 9.3]) rotate([0, 30, -14]) scale([1.8, 1.6, 2.2]) sphere(1, $fn = 14);
  }
  // the short side over his left temple
  hull() {
    translate([7.6, -8.6, 13.6]) rotate([-20, -20, 0]) scale([4.6, 3.6, 3.6]) sphere(1, $fn = 20);
    translate([12.2, -4.2, 8.6]) scale([2.6, 3.4, 3.8]) sphere(1, $fn = 18);
  }
  // the sides and back, swept back over the ears
  for (m = [0, 1]) mirror([m, 0, 0]) hull() {
    translate([11.8, -2, 8.5]) scale([2.8, 4.6, 5]) sphere(1, $fn = 18);
    translate([11.6, 6, 7]) scale([3, 5.2, 5.4]) sphere(1, $fn = 18);
    translate([6, 11.6, 6]) scale([5, 3, 6]) sphere(1, $fn = 18);
  }
}

// the Mogu Mogu bottle in the right fist: axis through the fist along Y (cap forward, so it stands up when he bends
// the elbow), a lychee-pink body, a white label band and the wide bright-green screw cap
human_body(MM_H, MM_GIRTH) translate([-(18.5 + 4 + 0.33), 0, 133 - 54 - 4.5 - 2.6]) {
  color([0.98, 0.45, 0.62, NOGLOW]) rotate([90, 0, 0]) translate([0, 0, -3.6]) {
    cylinder(h = 11.6, r = 3.1, $fn = 24);
    translate([0, 0, 11.6]) cylinder(h = 2.2, r1 = 3.1, r2 = 2.2, $fn = 24);
  }
  color([0.97, 0.97, 0.94]) rotate([90, 0, 0]) translate([0, 0, 2.8]) cylinder(h = 4.6, r = 3.25, $fn = 24);
  color([0.25, 0.85, 0.3, NOGLOW]) rotate([90, 0, 0]) translate([0, 0, 10.2]) cylinder(h = 3.4, r = 2.75, $fn = 24);
}
