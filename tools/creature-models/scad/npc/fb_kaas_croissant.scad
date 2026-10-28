// Mr Kaas Croissant (Mire Route foosball club, team B defence + goalie, both grips). A really short young man with
// tousled light-brown hair, a big smile and weekend stubble, wraparound sunglasses (badly hungover), a blue linen
// shirt with a croissant sticking out of the breast pocket, beige chinos. He stands on an upside-down yellow beer
// crate (part of the model, bottom at z = 0) to reach the rods. Rig: rigs/npc/fb_kaas_croissant.mjs.
include <_human.scad>

KC_H = 146;
KC_HEAD = 1.1;
KC_GIRTH = 1.08;
CRATE = 24;              // the crate's top: his soles stand at z = CRATE (keep in sync with the rig's C)
HAIR = [0.62, 0.45, 0.27];
SHIRT = [0.33, 0.52, 0.84];
SHADES = [0.07, 0.07, 0.09];
CROISSANT = [0.86, 0.57, 0.22, NOGLOW];
CRATE_C = [0.98, 0.78, 0.12, NOGLOW];
CRATE_D = [0.78, 0.55, 0.06];

translate([0, 0, CRATE]) {
  human(H = KC_H, head = KC_HEAD, girth = KC_GIRTH, belly = 0.15,
    skin = [0.99, 0.82, 0.7], blush = [0.97, 0.66, 0.58],
    hair = "quiff", hair_c = HAIR, beard = "stubble", beard_c = [0.55, 0.4, 0.26], brow_c = [0.5, 0.36, 0.22],
    eye_c = [0.35, 0.55, 0.75], mouth = "grin",
    shirt_c = SHIRT, sleeve = "long", cuff_c = SHIRT * 0.9,
    pants_c = [0.85, 0.76, 0.6], shoe_c = [0.5, 0.31, 0.17], sole_c = [0.3, 0.2, 0.12]);

  human_head(KC_H, KC_HEAD) {
    // tousled: a few loose clumps flicked up and to the side over the wavy cap
    color(HAIR) {
      for (c = [[-5.5, -8.5, 16.6, -30, -25, 1], [1, -9.8, 18.4, -38, 5, 1.1], [6.5, -7.5, 17, -25, 30, 1],
                [-3, -1, 19.5, -12, -15, 1], [4, 0, 19.2, -12, 20, 1]])
        translate([c[0], c[1], c[2]]) rotate([c[3], 0, c[4]]) scale([4.4, 7, 2.8] * c[5]) sphere(1, $fn = 18);
      // longer sides swept back over the top of the ears
      for (m = [0, 1]) mirror([m, 0, 0]) hull() {
        translate([12.2, -5, 9.5]) scale([2.4, 4, 3.5]) sphere(1, $fn = 14);
        translate([12.4, 4, 9]) scale([2.4, 5, 3.5]) sphere(1, $fn = 14);
        translate([10.5, 0, 14]) scale([3, 6, 3]) sphere(1, $fn = 14);
      }
    }
    // wraparound sunglasses floating just off the face (their own joint, `shades`)
    color(SHADES) {
      for (m = [0, 1]) mirror([m, 0, 0]) translate([5.3, -14.55, 1.75]) rotate([0, 0, 16]) hull() {
        translate([-2.4, 0, 0.9]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 1.6, center = true, $fn = 16);
        translate([2.3, 0, 0.9]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 1.6, center = true, $fn = 16);
        translate([0, 0, -0.7]) rotate([90, 0, 0]) scale([1.6, 1, 1]) cylinder(h = 0.8, r = 1.65, center = true, $fn = 18);
      }
      translate([0, -15.3, 2.9]) rotate([0, 90, 0]) cylinder(h = 3.4, r = 0.55, center = true, $fn = 8);
    }
  }

  human_body(KC_H, KC_GIRTH) {
    // shirt collar points
    for (m = [0, 1]) mirror([m, 0, 0]) color(SHIRT * 0.93) hull() {
      translate([3.2, -7.2, 136.0]) sphere(0.8, $fn = 10);
      translate([7.8, -5.6, 135.4]) sphere(0.8, $fn = 10);
      translate([4.4, -9.4, 131.0]) sphere(0.7, $fn = 10);
    }
    // breast pocket on his left and the croissant poking out of it
    color(SHIRT * 0.88) translate([8, -10.6, 120.5]) rotate([4, 0, 12]) cube([7.4, 2.6, 7.5], center = true);
    translate([8.6, -10.9, 124.6]) rotate([-12, -62, 12]) scale(1.45) color(CROISSANT) {
      for (i = [0 : 4]) let(a = -50 + 25 * i, r = [1.7, 2.3, 2.8, 2.3, 1.7][i])
        translate([5.5 * sin(a), 0, 5.5 * cos(a) - 2.5]) rotate([0, a, 0]) scale([r * 1.05, r * 0.9, r * 0.95]) sphere(1, $fn = 16);
    }
  }
}

// the beer crate, upside down: a yellow box with darker hand slots, ribs and a bottle-grid bottom on top
module crate() {
  w = 40; d = 30; h = CRATE - 0.3;
  color(CRATE_C) difference() {
    translate([-w / 2, -d / 2, 0]) cube([w, d, h]);
    // recessed side panels between corner posts
    for (m = [-1, 1]) {
      translate([-w / 2 + 3, m * d / 2 - 0.8 - (m > 0 ? 0 : -0.8) - 0.4, 2.5]) cube([w - 6, 1.2, h - 5]);
      translate([m * w / 2 - 0.8 - (m > 0 ? 0 : -0.8) - 0.4, -d / 2 + 3, 2.5]) cube([1.2, d - 6, h - 5]);
    }
  }
  // dark hand slots on the short sides and a logo band on the long sides
  color(CRATE_D) for (m = [-1, 1]) {
    translate([m * (w / 2 - 0.35), 0, h - 6]) cube([0.8, 11, 3.2], center = true);
    translate([0, m * (d / 2 - 0.35), h / 2 - 1]) cube([24, 0.8, 5], center = true);
  }
  // the grid of the bottle compartments on what is now the top (lines just proud of the surface)
  color(CRATE_D) {
    for (i = [1 : 4]) translate([-w / 2 + i * w / 5, 0, h - 0.2]) cube([0.6, d - 2, 0.6], center = true);
    for (i = [1 : 3]) translate([0, -d / 2 + i * d / 4, h - 0.2]) cube([w - 2, 0.6, 0.6], center = true);
  }
}
crate();
