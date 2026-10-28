// Starwhim: a slender sky-blue deer speckled with constellations, golden crescent-moon antlers, a long pastel mane
// (lilac, gold and aqua) streaming back on the wind, and a trail of little stars at its hooves.
include <lib.scad>

blue = [0.4, 0.6, 0.92];
blueDark = [0.28, 0.42, 0.78];
blueLight = [0.58, 0.76, 1];
gold = [0.98, 0.82, 0.45];
goldDark = [0.85, 0.65, 0.3];
lilac = [0.72, 0.62, 0.95];
aqua = [0.55, 0.88, 0.95];
pinkish = [0.95, 0.75, 0.9];
starW = [1, 0.95, 0.7];
hoof = [0.22, 0.3, 0.55];

module star5(p, r, c, rot = [0, 0, 0], t = 0.3) {
  color(c) translate(p) rotate(rot) rotate([90, 0, 0]) translate([0, 0, -t])
    linear_extrude(height = 2 * t) polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = i % 2 == 0 ? r : r * 0.45) [rr * cos(a), rr * sin(a)]]);
}

// Body along Y (head towards -Y): chest, barrel, haunch.
blob([[[4, 4.6, 4.4], [0, -5, 18]], [[3.6, 5, 3.8], [0, 0.5, 17.5]], [[4, 4.4, 4.4], [0, 6, 18]]], blue);
ell([3, 3.4, 2.4], [0, -0.5, 14.6], blueLight);
// Short upturned tail.
limb([0, 10, 20], [0, 11.5, 22.5], 1.2, 0.6, blueLight);

// Legs: long and thin, a gentle knee, dark hooves. Front left lifted mid-step.
module leg(top, knee, foot) {
  chain([top, knee, foot], [1.6, 1, 0.8], blue);
  color(hoof) translate(foot - [0, 0, 0.5]) cylinder(h = 1.4, r1 = 1, r2 = 0.8, $fn = 12);
}
leg([2, -5, 16], [2.2, -5.5, 8.5], [2.2, -5, 1.2]);
leg([-2, -5, 16], [-2.4, -8.5, 9.5], [-2.4, -9.5, 4.5]);
leg([2, 6.5, 16], [2.3, 8, 8.5], [2.2, 6.5, 1.2]);
leg([-2, 6.5, 16], [-2.3, 8.2, 8.5], [-2.2, 7, 1.2]);

// Neck rising forward to the head.
limb([0, -5.5, 20], [0, -7.5, 28], 3, 2, blue);
// Head: skull and a tapering muzzle, pointed ears.
ell([2.8, 3.2, 2.7], [0, -8.2, 30], blue);
limb([0, -9, 29.6], [0, -12.6, 28.4], 2.1, 1.3, blue);
ell([0.6, 0.5, 0.45], [0, -13.4, 28.7], blueDark);
mirror_x() {
  eye([2, -9.8, 30.6], 0.9, iris = [0.18, 0.22, 0.45], yaw = -55);
  petal([0.8, 0.5, 2], [2.4, -6.8, 32.2], [10, 50, 0], blueLight);
}
// Gold forehead mark.
color(gold) translate([0, -10.1, 31]) scale([0.35, 0.3, 0.8]) sphere(1, $fn = 8);

// Antlers: two golden crescents, a short tine on each.
mirror_x() translate([2, -7.6, 32]) rotate([0, -12, -10]) {
  color(gold) rotate([90, 0, 0]) translate([0, 0, -0.7]) linear_extrude(height = 1.4)
    translate([1.6, 3.6]) difference() {
      circle(3.8, $fn = 36);
      translate([-1.6, 1]) circle(3.6, $fn = 36);
    }
  limb([0.6, 0, 1.6], [-0.8, 0, 3], 0.5, 0.25, goldDark);
}

// Mane: flowing pastel locks from the crown and neck, streaming back and out to the viewer's left.
// A mane mass along the back of the neck, then wavy locks streaming back and a little to the viewer's left.
color(lilac) hull() { translate([0, -6.6, 31.5]) sphere(1.8, $fn = 14); translate([0, -4, 24]) sphere(1.4, $fn = 12); translate([0, -5, 29]) sphere(2.2, $fn = 14); }
locks = [[[0, -6.5, 32], [-1, -3, 34], [-2.5, 0.5, 34], [-3.5, 4, 36], [-5, 7, 36.5], [-7, 8.5, 38]],
         [[0, -6, 30.5], [-1.2, -2.5, 31], [-2.8, 1, 30.5], [-4, 4.5, 31.5], [-6, 8, 30.5], [-8, 9.5, 31.5]],
         [[0, -5.5, 28.5], [-0.8, -2, 27.5], [-2, 1.5, 26.5], [-3.5, 4.5, 26], [-5.5, 7.5, 24], [-7.5, 8, 25]],
         [[0.6, -6.5, 31], [1.4, -3, 32], [2, 0.5, 30], [2, 3.5, 28.5]],
         [[0, -5, 26], [-0.6, -2, 24.5], [-1.5, 1.5, 22.5], [-3, 4.5, 20.5], [-4, 6, 21.5]]];
cols = [lilac, gold, aqua, pinkish, lilac];
for (i = [0 : len(locks) - 1]) chain(locks[i], [for (k = [0 : len(locks[i]) - 1]) 1.7 * (1 - k / len(locks[i])) + 0.35], cols[i]);

// Constellation speckles over the coat.
for (p = [[3.9, -5, 19], [3.4, -2, 16], [4, 1, 18.5], [3.8, 4.5, 20], [4.1, 7, 17], [-3.9, -4, 18], [-3.6, 2, 17],
          [-4, 6, 19.5], [1.5, -8.2, 25], [-1.5, -7.5, 23], [2.5, 6, 22], [-2, -1, 21.5]])
  color(starW) translate(p) sphere(0.45, $fn = 8);
for (seg = [[[3.9, -5, 19], [3.4, -2, 16]], [[3.4, -2, 16], [4, 1, 18.5]], [[4, 1, 18.5], [3.8, 4.5, 20]], [[-3.9, -4, 18], [-3.6, 2, 17]]])
  limb(seg[0], seg[1], 0.12, 0.12, blueLight);

// Star trail at the hooves, sweeping back to the viewer's left.
star5([-4, 9, 1.2], 1.4, gold, [0, 0, 20]);
star5([-7, 11, 0.8], 1.6, lilac, [0, 0, 30]);
star5([-10, 13, 1.2], 1.4, blueLight, [0, 0, 10]);
star5([-12, 15.5, 0.8], 1.8, blueDark, [0, 0, 40]);
star5([-6, 14, 2.5], 1.1, gold, [0, 0, 15]);
for (p = [[-3, 12, 0.5], [-8, 16, 0.4], [-14, 12, 0.6], [6, -10, 26], [-6, -10, 34], [7, 0, 30]])
  color(aqua) translate(p) sphere(0.45, $fn = 8);
