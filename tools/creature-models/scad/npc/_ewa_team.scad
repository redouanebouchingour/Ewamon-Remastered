// Shared parts for Team Ewamon HQ (mirevale.house5): the four students who built the original Ewamon in 2022 (HvA
// EWA course), seated at one desk (ewa_desk.scad). Outfit "mix": suit jackets hung over the chairs (the desk set),
// dress shirts with the sleeves rolled up (`sleeve = "rolled"`), headsets on. Each person is `human()` plus these
// parts; their rigs pose them seated (rigs/npc/_seated.mjs).
include <_human.scad>

EWA_SHIRT = [0.11, 0.11, 0.125];      // the black dress shirts
EWA_FOLD = [0.17, 0.17, 0.19];        // their rolled sleeves and collars
EWA_PANTS = [0.07, 0.07, 0.085];
EWA_SKIN = [0.88, 0.68, 0.53];        // light-medium
EWA_DARK_HAIR = [0.09, 0.07, 0.065];
EWA_EYE = [0.27, 0.16, 0.08];

// A dress shirt's collar: two points over the collarbones, open at the throat (human_body frame, H = 178 landmarks).
// Clear of the neck piece (another joint), on the chest only.
module ewa_collar(c, buttons = undef) {
  for (m = [0, 1]) mirror([m, 0, 0]) color(c) hull() {
    translate([3.0, -7.4, 135.6]) sphere(0.8, $fn = 10);
    translate([8.2, -5.6, 135.2]) sphere(0.8, $fn = 10);
    translate([4.2, -9.4, 130.6]) sphere(0.7, $fn = 10);
  }
  if (buttons != undef) color(buttons) for (z = [126, 119.5]) translate([0, -10.6, z]) scale([0.75, 0.5, 0.75]) sphere(1, $fn = 10);
}

// A gaming headset in the head's frame (human_head): a band over the top at `top` (head units, the hair's top), a cup
// on each ear, a boom mic from the cup on side `mic` (+1 = the person's left, -1 = the right) to the mouth corner.
// `lift` (degrees) pushes it off the left ear and onto the temple, keeping the right cup on its ear. `ax`: the cups'
// distance from the centre (wider for a full beard, so the cushions stay clear of the jaw, another joint).
module ewa_headset(top = 19, lift = 0, mic = 1, accent = [0.85, 0.15, 0.2, NOGLOW], ax = 14.9) {
  band = [0.13, 0.13, 0.15, NOGLOW];
  cup = [0.19, 0.19, 0.21, NOGLOW];
  R = [-ax, 1, 0];
  translate(R) rotate([0, -lift, 0]) translate(-R) {
    color(band) for (i = [0 : 11]) let(a0 = 8 + i * 164 / 12, a1 = 8 + (i + 1) * 164 / 12)
      hull() {
        translate([ax * cos(a0), 1, 2.5 + (top + 1.4 - 2.5) * sin(a0)]) rotate([90, 0, 0]) cylinder(h = 2.6, r = 0.7, center = true, $fn = 8);
        translate([ax * cos(a1), 1, 2.5 + (top + 1.4 - 2.5) * sin(a1)]) rotate([90, 0, 0]) cylinder(h = 2.6, r = 0.7, center = true, $fn = 8);
      }
    for (m = [-1, 1]) translate([m * (ax + 0.2), 1, 0]) rotate([0, 90, 0]) {
      color(cup) cylinder(h = 2.8, r = 4.6, center = true, $fn = 24);
      color(accent) translate([0, 0, m * 1.5]) cylinder(h = 0.5, r = 3.2, center = true, $fn = 20);
      // the cushion against the ear
      color(band) translate([0, 0, -m * 1.6]) scale([1, 1, 0.5]) sphere(4.2, $fn = 20);
    }
  }
  if (mic != 0) {
    // the mic hangs off the cup that is on its ear
    mx = mic * (ax + 0.6);
    P = lift != 0 && mic > 0 ? [R[0] + (ax * 2 + 0.6) * cos(lift), -1, (ax * 2 + 0.6) * sin(lift) - 2.5] : [mx, -1, -2.5];
    color(band) chain([P, [mic * (ax - 0.6), -8.5, -6.4], [mic * 10.5, -13.8, -8.6], [mic * 6.2, -15.6, -8.8]], [0.5, 0.45, 0.42, 0.42]);
    color([0.06, 0.06, 0.07, NOGLOW]) translate([mic * 5.6, -15.8, -8.8]) scale([1.4, 1.2, 1.2]) sphere(1, $fn = 14);
  }
}
