// Ravatar (water relic): Ravatar with a deep-blue mane and a glowing blue arrow, in pale aqua scale armour with pearl
// studs, finned pauldrons and gauntlets, dark blue finned greaves, its tail turned into a curling wave, ripples at its feet.
include <lib.scad>

fur = [0.9, 0.76, 0.55];
furHi = [0.98, 0.88, 0.7];
furDark = [0.7, 0.55, 0.38];
mane = [0.16, 0.3, 0.46];
maneHi = [0.25, 0.45, 0.62];
mark = [0.2, 0.6, 1];
tattoo = [0.3, 0.55, 0.8];
antler = [0.4, 0.62, 0.82];
rock = [0.2, 0.36, 0.56];
rockDark = [0.13, 0.24, 0.4];
tailGrey = [0.55, 0.74, 0.9];
tailCream = [0.82, 0.92, 1];
claw = [0.95, 0.92, 0.82];
nose = [0.18, 0.12, 0.1];
eyeIris = [0.3, 0.7, 1];
aqua = [0.62, 0.8, 0.94];
aquaDark = [0.42, 0.62, 0.84];
pearl = [0.55, 0.85, 1];
foam = [0.9, 0.97, 1];

module dot(p, r, c) { color(c) translate(p) scale(r) sphere(1, $fn = 8); }
module stroke(pts, r, c = mark) { chain(pts, [for (p = pts) r], c); }
// Swirl tattoo facing direction yaw (0 = -Y), radius R.
module tswirl(p, R, yaw = 0, c = tattoo) {
  n = 14;
  translate(p) rotate([0, 0, yaw])
    chain([for (i = [0 : n]) let(t = i / n, a = t * 540, rr = R * (0.2 + 0.8 * t)) [rr * cos(a), 0, rr * sin(a)]],
          [for (i = [0 : n]) 0.3], c, $fn = 6);
}
// Rough rock chunk.
module chunk(p, r, rot = [0, 0, 0], c = rock) { color(c) translate(p) rotate(rot) scale([1.2, 0.9, 1]) sphere(r, $fn = 7); }

// ---- Legs: thick thighs, rocky greaves, clawed feet.
mirror_x() {
  limb([3.6, 0, 16], [5, -0.6, 9], 3, 2.6, fur);
  limb([5, -0.6, 9], [5.4, 0.4, 3], 2.4, 2, fur);
  ell([3, 3, 3.6], [5.3, -0.2, 6], rockDark);
  ell([3.3, 3.3, 2.4], [5.3, -0.2, 3.6], rock, $fn = 16);
  petal([0.5, 2.2, 3], [7.8, 0.6, 7], [0, 20, 0], aquaDark);
  spike([5.8, -2.6, 9.5], [0.6, -1.2, 2.4], 1, 0.05, rock);
  blob([[[2.6, 3.4, 1.4], [5.6, -1.6, 1.4]], [[2.2, 2, 1.4], [5.6, 0.8, 1.6]]], furDark);
  for (a = [-28, 0, 28]) spike([5.6 + sin(a) * 1.5, -4.8, 1], [sin(a) * 0.5, -1.4, -0.4], 0.55, 0.05, claw);
}

// ---- Hips and the plated rocky loincloth.
ell([6, 4.2, 3.4], [0, 0, 16.5], furDark);
for (x = [-4, -1.4, 1.4, 4]) spike([x, -3.6, 17.5], [x * 0.15, -0.6, -5.5], 1.6, 0.1, (abs(x) < 2) ? rockDark : rock);
for (x = [-3, 0, 3]) spike([x, 3.6, 17.5], [x * 0.15, 0.6, -4.5], 1.5, 0.1, rock);
color(rockDark) translate([0, 0, 17.6]) scale([6.3, 4.5, 1]) cylinder(h = 1.2, r = 1, $fn = 24);

// ---- Torso: V-shaped, muscled chest.
blob([[[4.8, 3.6, 3.6], [0, 0, 20]], [[7.4, 4.6, 4.4], [0, 0, 27]]], fur);
mirror_x() color(furHi) translate([2.4, -3.95, 28.2]) scale([3.2, 0.6, 1.4]) sphere(1, $fn = 14);
for (z = [20.5, 22.5]) mirror_x() color(furHi) translate([1.3, -3.4, z]) scale([1.3, 0.7, 0.8]) sphere(1, $fn = 10);
// Swirl tattoos: chest, shoulders, back.
mirror_x() {
  tswirl([3, -5.1, 27.2], 1.2);
  tswirl([6.4, 3.6, 28], 1.2, 180);
  tswirl([3, 4.6, 25], 1.4, 180);
}
// Shaggy ruff on the chest and shoulders.
for (a = [-70 : 20 : 70]) spike([sin(a) * 5.2, -3 + abs(sin(a)) * 1.2, 30.5], [sin(a) * 1.4, -1.2, -4], 1.3, 0.05, furHi);
for (a = [0 : 30 : 359]) spike([cos(a) * 5, sin(a) * 3.8, 31], [cos(a) * 2.2, sin(a) * 2.2, -2], 1.6, 0.05, fur);
// Spine marking.
stroke([[0, 4.8, 30], [0.8, 4.9, 26.5], [-0.6, 4.5, 23], [0.2, 3.8, 19.5]], 0.75);

// ---- Arms: long, hanging, a little out from the body, clawed hands; stripe tattoos on the forearms.
mirror_x() {
  ell([3, 3, 2.8], [7.2, 0, 28.5], fur);
  limb([7.6, 0, 28], [9.4, -0.6, 21], 2.5, 2.1, fur);
  limb([9.4, -0.6, 21], [10.4, -1.6, 14.5], 2.1, 1.7, fur);
  for (z = [16.5, 18.5]) stroke([[11.3, -1.3, z], [10.6, -2.6, z + 0.6]], 0.3, tattoo);
  ell([1.9, 1.7, 2], [10.6, -1.8, 13], fur);
  for (a = [-30, 0, 30]) spike([10.6 + sin(a) * 1.2, -3, 11.6], [sin(a) * 0.4, -0.8, -1.4], 0.45, 0.05, claw);
}

// ---- Bushy tail: sweeps back and out to the viewer's right, then up; grey over a cream underside.
// A tapering chain of hulled ellipsoids: [radius, point] pairs.
module tailpath(pts, rs, c) { for (i = [0 : len(pts) - 2]) blob([[rs[i], pts[i]], [rs[i + 1], pts[i + 1]]], c); }
tailpath([[2, 4, 15], [7, 6, 9], [12.5, 4.5, 7], [16.5, 2, 10], [18, 0.5, 15], [17.6, 0, 20.5]],
         [[1.8, 1.8, 1.8], [3, 3, 3], [3.6, 3.4, 3.4], [3.4, 3.2, 3.4], [2.6, 2.4, 3], [0.8, 0.8, 1.4]], tailGrey);
tailpath([[7, 4.4, 7.8], [12.5, 2.4, 5.6], [16, -0.2, 8.6], [17, -1.2, 13.5]],
         [[2.6, 2.2, 2.2], [3, 2.4, 2.4], [2.8, 2.2, 2.6], [1.6, 1.4, 2]], tailCream);

// ---- Scale armour.
mirror_x() {
  // Finned pauldrons.
  color(aqua) translate([7.6, 0, 29.6]) scale([4, 4, 2.8]) difference() { sphere(1, $fn = 16); translate([0, 0, -1.3]) cube(2, center = true); }
  petal([0.6, 3, 2.6], [10.4, 0.8, 30.8], [0, -35, 0], aquaDark);
  dot([7.6, -3.8, 30.2], [0.7, 0.7, 0.7], pearl);
  // Finned gauntlets.
  limb([9.7, -0.8, 19.5], [10.4, -1.4, 14], 2.3, 2.1, aqua, $fn = 12);
  petal([0.5, 2.4, 3.4], [12.2, 0.4, 17], [0, -20, 0], aquaDark);
  dot([10.2, -3.2, 16.5], [0.6, 0.6, 0.6], pearl);
}
// Chest and back plates with pearl studs and scale rows.
color(aqua) translate([0, 0.4, 26.5]) scale([7.6, 5.6, 4.8]) difference() { sphere(1, $fn = 12); translate([0, 1.25, 0]) cube(2, center = true); }
color(aqua) translate([0, -0.4, 26.5]) scale([7.8, 6.2, 5.6]) difference() { sphere(1, $fn = 12); translate([0, -1.25, 0]) cube(2, center = true); }
mirror_x() tswirl([2.8, -5.3, 27.4], 1.1, 0, rock);
dot([0, -5.4, 23.6], [0.9, 0.6, 0.9], pearl);
for (g = [[0, 6.1, 29], [-3, 5.6, 29.6], [3, 5.6, 29.6]]) dot(g, [0.7, 0.6, 0.7], pearl);
// Wave crest curling at the tail tip.
module curl(p, R, c, w) {
  n = 14;
  chain([for (i = [0 : n]) let(t = i / n, a = -20 + t * 520, rr = R * (1 - 0.8 * t)) p + [rr * cos(a), 0, rr * sin(a)]],
        [for (i = [0 : n]) w * (1 - 0.6 * i / n)], c, $fn = 7);
}
curl([16, 0.5, 20], 3.6, tailGrey, 1.6);
curl([16, -0.6, 20], 2, foam, 0.5);
for (d = [[19, -1, 25], [14, 0, 25.5], [20.5, 1, 21]]) dot(d, [0.6, 0.6, 0.6], foam);
// Ripples at the feet and water swirling round the claws.
module ring(p, r, a0, a1, w = 0.35) {
  translate(p) rotate([0, 0, a0]) rotate_extrude(angle = a1 - a0, $fn = 24) translate([r, 0]) scale([1, 0.5]) circle(w, $fn = 6);
}
color(aqua) { mirror_x() ring([6, -1, 0.3], 4, 0, 300, 0.4); ring([0, 0, 0.3], 11, 200, 340, 0.4); }
color(foam) mirror_x() ring([6, -1, 0.5], 2.6, 60, 320, 0.3);
color(mark) for (x = [-1, 1]) translate([x * 10.6, -1.8, 13]) rotate([0, 0, x * 40]) ring([0, 0, 0], 2.8, 0, 260, 0.3);

// ---- Head: lion-hound with a short muzzle.
blob([[[4.6, 4.2, 4.2], [0, -0.8, 35]], [[3.6, 3.4, 3], [0, -1.6, 32.6]]], fur);
ell([2.6, 2, 1.8], [0, -4.6, 32.6], furHi);
ell([0.9, 0.6, 0.6], [0, -6.4, 33.4], nose);
color(nose) translate([0, -6, 31.6]) scale([1.2, 0.3, 0.3]) sphere(1, $fn = 10);
// Cheek ruff.
mirror_x() for (z = [31, 33]) spike([3.4, -2.6, z], [2, 0.4, -1], 1.2, 0.05, furHi);
// Eyes: narrow and fierce under heavy brows.
mirror_x() {
  eye([2, -4.4, 35], 1, iris = eyeIris, pupil = [0.1, 0.12, 0.16], yaw = -20);
  color(furDark) translate([2.1, -4.9, 36.2]) rotate([0, -18, -20]) scale([1.6, 0.5, 0.45]) sphere(1, $fn = 12);
}
// Arrow marking: point on the brow, band over the crown into the mane.
color(mark) translate([0, -4.95, 36.6]) rotate([-60, 0, 0]) linear_extrude(0.8, center = true)
  polygon([[0, -1.6], [-1.6, 0.6], [-0.8, 0.6], [-0.8, 1.2], [0.8, 1.2], [0.8, 0.6], [1.6, 0.6]]);
stroke([[0, -4, 38], [0, -2.2, 39.2]], 0.8);
// Ears.
mirror_x() spike([3.6, -0.6, 37.6], [1.8, 0.4, 2.2], 1.2, 0.1, fur);
// Short antlers.
mirror_x() {
  chain([[2, -1.2, 38.6], [3, -1, 41], [4.2, -0.8, 43], [5.4, -0.6, 44]], [0.7, 0.6, 0.45, 0.2], antler);
  limb([3.1, -1, 41], [1.8, -1.4, 42.6], 0.45, 0.15, antler);
}
// Wild mane: a big swept mass of spikes behind and above the head, streaming back.
blob([[[5, 4.6, 4], [0, 2, 37.5]], [[4, 3.6, 3], [0, 4.6, 33]]], mane);
for (s = [[-4, 0, 41, -2, 1.4, 3], [-1.5, 0.5, 42, -0.6, 1.6, 4], [1.5, 0.6, 42, 1, 2, 3.8], [4, 0.4, 40.5, 2.6, 2, 2.4],
          [-5, 2, 38, -3.4, 2.4, 1], [5, 2, 38, 3.4, 2.4, 1.2], [0, 3, 40.5, 0, 5, 2.6], [-3, 4, 38, -1.4, 5, 0.6],
          [3, 4, 38, 1.6, 5, 0.6], [0, 5.5, 35, 0, 4, -2], [-3, 5, 33, -1.4, 3, -3], [3, 5, 33, 1.4, 3, -3]])
  spike([s[0], s[1], s[2]], [s[3], s[4], s[5]], 2.1, 0.1, ((s[0] + s[2]) % 2 == 0) ? maneHi : mane);
// Mane-crossing marking down the back of the head.
stroke([[0, 1.5, 42.2], [0, 5, 39.8], [0, 7.4, 35.5], [0, 6.8, 31.5]], 0.75);
