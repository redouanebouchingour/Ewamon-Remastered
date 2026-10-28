// Alloylark: a small steel songbird, charcoal body with a riveted gold collar plate, a swept steel helm crest over cyan
// eyes, wings of blade feathers spread wide and a blade-feather tail tipped in cyan.
include <lib.scad>

body = [0.22, 0.22, 0.27];
bodyHi = [0.34, 0.34, 0.4];
steel = [0.72, 0.73, 0.8];
steelDk = [0.5, 0.5, 0.58];
gold = [0.92, 0.68, 0.12];
goldDk = [0.62, 0.42, 0.06];
cyan = [0.15, 0.82, 0.78];
beak = [0.3, 0.3, 0.36];

// A flat blade feather from p along d, width w (flat in the plane holding d and `flat` normal).
module blade(p, d, w, c, tip = undef, th = 0.35) {
  l = norm(d);
  translate(p) rotate(_dir_rot(d)) {
    color(c) hull() {
      scale([w, th, 0.8]) sphere(1, $fn = 10);
      translate([0, 0, l * 0.45]) scale([w * 0.9, th, 1]) sphere(1, $fn = 10);
      translate([0, 0, l]) sphere(0.1, $fn = 4);
    }
    if (tip != undef) color(tip) hull() {
      translate([0, 0, l * 0.78]) scale([w * 0.45, th * 1.15, 0.6]) sphere(1, $fn = 8);
      translate([0, 0, l * 1.0]) sphere(0.12, $fn = 4);
    }
  }
}

// Body: a plump egg leaning forward.
blob([[[6.5, 6.5, 6.5], [0, 1, 14]], [[5.2, 5, 5], [0, -1.5, 19]]], body);
// Gold collar band all around the upper chest, with a larger riveted plate on the breast.
color(gold) translate([0, -0.6, 19.5]) scale([6.3, 6.1, 2.6]) sphere(1, $fn = 28);
color(gold) translate([0, -3.6, 15.8]) rotate([12, 0, 0]) scale([5.4, 3.6, 5.2]) sphere(1, $fn = 24);
color(goldDk) translate([0, -6.95, 16]) rotate([12, 0, 0]) cube([0.4, 0.6, 7.5], center = true);
color(goldDk) translate([0, -6.9, 15.6]) rotate([12, 0, 0]) cube([7.5, 0.6, 0.4], center = true);
mirror_x() for (z = [13.2, 18]) color([1, 0.9, 0.55]) translate([2.6, -6.9, z]) sphere(0.45, $fn = 8);

// Head: round charcoal head under a steel helm, crest blades swept back.
ell([4.6, 4.6, 4.4], [0, -2.4, 25.5], body);
color(steel) translate([0, -2, 26.6]) scale([4.9, 5, 3.8]) difference() {
  sphere(1, $fn = 28);
  translate([0, 0, -1.3]) cube(2.4, center = true);
}
// Visor brow ridge over the eyes.
color(steel) translate([0, -5.6, 27.3]) rotate([-8, 0, 0]) scale([4.6, 1.6, 1.2]) sphere(1, $fn = 18);
blade([0, -4, 29.5], [0, 10, 7], 1.8, steel);
blade([-2, -3, 29], [-3, 10, 4.5], 1.6, steelDk);
blade([2, -3, 29], [3, 10, 4.5], 1.6, steelDk);
blade([0, -1, 28.5], [0, 8, 1.5], 1.2, steel);
// Beak: short, dark, hooked.
color(beak) hull() {
  translate([0, -6.4, 25.2]) scale([1.4, 1, 1.2]) sphere(1, $fn = 14);
  translate([0, -9.2, 24.4]) sphere(0.25, $fn = 8);
}
// Cyan eyes set in the dark face under the visor.
mirror_x() {
  color(cyan) translate([2.5, -5.6, 26.2]) rotate([0, 0, -25]) scale([1.5, 0.6, 1]) sphere(1, $fn = 14);
  color("white") translate([2.2, -6.0, 26.5]) sphere(0.3, $fn = 8);
}

// Wings: blade feathers fanning up and out from the shoulders, steel over a dark coverts pad.
mirror_x() {
  ell([3.4, 3, 3.8], [5.2, 1.2, 18.5], steelDk);
  for (i = [0 : 4]) {
    a = 62 - i * 14;           // elevation of the blade
    l = 17 - abs(i - 1) * 1.6;
    blade([6, 1.5 + i * 0.4, 19 - i * 0.6], [l * cos(a), 3 + i * 1.2, l * sin(a)], 2.8, i % 2 == 0 ? steel : steelDk,
          tip = i > 2 ? cyan : undef);
  }
  // Short covert blades over the wing root.
  for (i = [0 : 2]) blade([5.5, 0.5, 20 - i * 1.8], [6, 1.5, 3 - i * 2], 1.3, steel);
}

// Tail: a fan of blade feathers angled back and down, tipped in cyan.
for (i = [-2 : 2]) blade([i * 0.8, 5.5, 11], [i * 3, 12, -4 + abs(i) * 0.5], 2.2, abs(i) % 2 == 0 ? steel : steelDk, tip = cyan);

// Legs: steel-plated thighs, thin dark shanks, three forward talons and a back spur.
mirror_x() {
  ell([2.8, 3, 3], [3.6, -0.5, 9.5], steelDk);
  limb([3.8, -0.6, 8], [4.4, -1, 2], 1.3, 1.1, steelDk);
  ell([1.6, 1.6, 1.4], [4.4, -1, 4.5], steel);
  for (a = [-30, 0, 30]) limb([4.4, -1, 1.6], [4.4 + sin(a) * 3.4, -1 - cos(a) * 3.6, 0.6], 0.8, 0.4, beak);
  limb([4.4, -1, 1.6], [4.4, 1.6, 0.6], 0.55, 0.3, beak);
}
