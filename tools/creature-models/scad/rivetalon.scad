// Rivetalon: Alloylark grown into a tall armoured raptor. Charcoal body under a riveted gold breastplate with gold
// shoulder trim, a crown of steel blade crests over cyan eyes and a gold-tipped beak, huge spread wings of blade
// feathers and a long trailing blade tail tipped in cyan.
include <lib.scad>

body = [0.22, 0.22, 0.27];
bodyHi = [0.34, 0.34, 0.4];
steel = [0.7, 0.7, 0.82];
steelDk = [0.46, 0.46, 0.58];
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


// Body: a deep keel-chested torso, upright.
blob([[[7, 6.5, 7], [0, 1.5, 17]], [[6, 5.5, 6], [0, -1, 23]]], body);
// Gold breastplate: a shield on the chest with rivets and a seam; gold trim around the shoulders.
color(gold) translate([0, -3.8, 21]) rotate([10, 0, 0]) scale([5.8, 3.8, 5.6]) sphere(1, $fn = 24);
color(goldDk) translate([0, -7.4, 21]) rotate([10, 0, 0]) cube([0.4, 0.6, 9], center = true);
for (z = [18.5, 22.5]) color(goldDk) translate([0, -7.3 + (z - 21) * 0.17, z]) rotate([10, 0, 0]) cube([8, 0.6, 0.35], center = true);
mirror_x() for (z = [17.5, 21, 24]) color([1, 0.9, 0.55]) translate([3.6, -7.0 + (z - 21) * 0.17, z]) sphere(0.45, $fn = 8);
color(gold) translate([0, 0, 25.5]) scale([6.4, 6, 1.6]) sphere(1, $fn = 28);

// Neck and head: a raised head under a steel helm with a crown of swept blade crests.
limb([0, -1, 25], [0, -2.4, 30], 3.4, 3.2, body);
ell([4.4, 4.8, 4.2], [0, -3, 32.5], body);
color(steel) translate([0, -2.6, 33.6]) scale([4.8, 5.2, 3.8]) difference() {
  sphere(1, $fn = 28);
  translate([0, 0, -1.3]) cube(2.4, center = true);
}
color(steel) translate([0, -6.4, 34.2]) rotate([-10, 0, 0]) scale([4.4, 1.6, 1.1]) sphere(1, $fn = 18);
blade([0, -5, 36.5], [0, 7, 9], 1.8, steel);
blade([-1.6, -4, 36], [-4, 8, 7], 1.6, steelDk);
blade([1.6, -4, 36], [4, 8, 7], 1.6, steelDk);
blade([-2.6, -2.5, 35], [-6, 9, 3], 1.5, steel);
blade([2.6, -2.5, 35], [6, 9, 3], 1.5, steel);
blade([0, -1, 35.5], [0, 9, 2], 1.3, steel);
// Hooked beak, dark with a gold tip.
color(beak) hull() {
  translate([0, -7, 32]) scale([1.4, 1.2, 1.2]) sphere(1, $fn = 14);
  translate([0, -9.6, 31.2]) sphere(0.5, $fn = 8);
}
color(gold) hull() {
  translate([0, -9.6, 31.2]) sphere(0.6, $fn = 8);
  translate([0, -10.6, 30.2]) sphere(0.2, $fn = 8);
}
mirror_x() {
  color(cyan) translate([2.4, -6.3, 33.1]) rotate([0, 0, -25]) scale([1.4, 0.6, 0.85]) sphere(1, $fn = 14);
  color("white") translate([2.2, -6.8, 33.4]) sphere(0.3, $fn = 8);
}

// Wings: two tiers of long blade feathers spread wide and high, cyan tips on the lowest primaries.
mirror_x() {
  ell([4, 3.5, 4.5], [6, 1.5, 23], steelDk);
  color(gold) translate([6.2, -0.4, 25.5]) rotate([0, 30, 0]) scale([2.6, 2.4, 1]) sphere(1, $fn = 16);
  for (i = [0 : 6]) {
    a = 76 - i * 9;
    l = 24 - abs(i - 2) * 1.6;
    blade([7, 2 + i * 0.4, 24 - i * 0.6], [l * cos(a) * 1.15, 2 + i * 0.9, l * sin(a)], 3, i % 2 == 0 ? steel : steelDk,
          tip = i > 4 ? cyan : undef);
  }
  for (i = [0 : 3]) blade([6.5, 0.8, 25 - i * 1.5], [8, 1.5, 6 - i * 2.5], 1.8, i % 2 == 0 ? steel : steelDk);
}

// Tail: long blade feathers trailing back and down to the ground, tipped in cyan.
for (i = [-3 : 3]) blade([i * 0.8, 6.5, 14], [i * 3.2, 15, -11 + abs(i) * 1.2], 2.2, abs(i) % 2 == 0 ? steel : steelDk, tip = cyan);

// Legs: armoured thighs, steel knee caps, dark shanks, big talons in a wide stance.
mirror_x() {
  ell([3.4, 3.6, 3.8], [4.4, 0, 12], steelDk);
  limb([4.8, -0.5, 10], [6, -1, 2.2], 1.5, 1.3, steelDk);
  ell([1.9, 1.9, 1.6], [5.4, -1, 6], steel);
  for (a = [-30, 0, 30]) limb([6, -1, 1.6], [6 + sin(a) * 3.8, -1 - cos(a) * 4, 0.6], 0.9, 0.4, beak);
  limb([6, -1, 1.6], [6, 2, 0.6], 0.7, 0.3, beak);
}
